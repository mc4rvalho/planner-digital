require("reflect-metadata");
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { NestFactory } = require("@nestjs/core");
const { ValidationPipe } = require("@nestjs/common");
const request = require("supertest");
const { randomUUID } = require("node:crypto");
const { AppModule } = require("../apps/api/dist/app.module");
const { Database } = require("../apps/api/dist/database/database.service");
const { JwtService } = require("@nestjs/jwt");
let app, db, http, alice, bob, eventId;
const suffix = randomUUID();
const emailA = `alice-${suffix}@example.com`,
  emailB = `bob-${suffix}@example.com`;
before(async () => {
  app = await NestFactory.create(AppModule, { logger: false });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();
  db = app.get(Database);
  http = request(app.getHttpServer());
});
after(async () => {
  if (db)
    await db.query("DELETE FROM users WHERE email=ANY($1::text[])", [
      [emailA, emailB],
    ]);
  if (app) await app.close();
});
test("auth, per-user isolation, atomic scheduling and preferences", async (t) => {
  await t.test("private endpoints reject missing credentials", async () => {
    await http.get("/events?from=2026-01-01&to=2027-01-01").expect(401);
  });
  await t.test(
    "registration hashes passwords and never returns hashes",
    async () => {
      const a = await http
        .post("/usuarios/cadastrar")
        .send({ nome: "Alice", usuario: emailA, senha: "strong-password-123" })
        .expect(201);
      alice = a.body;
      const b = await http
        .post("/usuarios/cadastrar")
        .send({ nome: "Bob", usuario: emailB, senha: "another-password-123" })
        .expect(201);
      bob = b.body;
      assert.ok(alice.accessToken);
      assert.equal(alice.user.password, undefined);
      const row = (
        await db.query("SELECT password FROM users WHERE id=$1", [
          alice.user.id,
        ])
      ).rows[0];
      assert.notEqual(row.password, "strong-password-123");
      assert.match(row.password, /^\$2/);
    },
  );
  await t.test(
    "login accepts correct credentials and denies invalid password",
    async () => {
      await http
        .post("/usuarios/logar")
        .send({ usuario: emailA, senha: "wrong" })
        .expect(401);
      const r = await http
        .post("/usuarios/logar")
        .send({ usuario: emailA, senha: "strong-password-123" })
        .expect(200);
      assert.equal(r.body.user.id, alice.user.id);
    },
  );
  await t.test("expired and tampered JWTs are rejected", async () => {
    const expired = new JwtService().sign(
      { sub: alice.user.id },
      {
        secret: process.env.JWT_SECRET,
        expiresIn: -1,
        issuer: "planner-digital",
        audience: "planner-app",
      },
    );
    await http
      .get("/usuarios/me")
      .auth(expired, { type: "bearer" })
      .expect(401);
    await http
      .get("/usuarios/me")
      .auth(alice.accessToken.slice(0, -8) + "tampered", { type: "bearer" })
      .expect(401);
  });
  const event = {
    title: "Private meeting",
    start: "2026-10-01T09:00:00-03:00",
    end: "2026-10-01T10:00:00-03:00",
    category: "work",
  };
  await t.test("save and isolate event ownership", async () => {
    const r = await http
      .post("/events")
      .auth(alice.accessToken, { type: "bearer" })
      .send({ events: [event] })
      .expect(201);
    eventId = r.body[0].id;
    const a = await http
      .get("/events?from=2026-10-01&to=2026-10-02")
      .auth(alice.accessToken, { type: "bearer" })
      .expect(200);
    assert.equal(a.body.length, 1);
    const b = await http
      .get("/events?from=2026-10-01&to=2026-10-02")
      .auth(bob.accessToken, { type: "bearer" })
      .expect(200);
    assert.equal(b.body.length, 0);
    await http
      .patch(`/events/${eventId}`)
      .auth(bob.accessToken, { type: "bearer" })
      .send({ completed: true })
      .expect(404);
    await http
      .delete(`/events/${eventId}`)
      .auth(bob.accessToken, { type: "bearer" })
      .expect(404);
  });
  await t.test("batch conflicts roll back all inserts", async () => {
    await http
      .post("/events")
      .auth(alice.accessToken, { type: "bearer" })
      .send({
        events: [
          { ...event, start: "2026-10-01T08:00:00-03:00", end: event.start },
          event,
        ],
      })
      .expect(409);
    const count = (
      await db.query("SELECT count(*) FROM events WHERE user_id=$1", [
        alice.user.id,
      ])
    ).rows[0].count;
    assert.equal(count, "1");
  });
  await t.test(
    "concurrent conflicting writes allow exactly one event",
    async () => {
      const next = {
        ...event,
        start: "2026-10-02T09:00:00-03:00",
        end: "2026-10-02T10:00:00-03:00",
      };
      const outcomes = await Promise.all([
        http
          .post("/events")
          .auth(alice.accessToken, { type: "bearer" })
          .send({ events: [next] }),
        http
          .post("/events")
          .auth(alice.accessToken, { type: "bearer" })
          .send({ events: [next] }),
      ]);
      assert.deepEqual(outcomes.map((r) => r.status).sort(), [201, 409]);
    },
  );
  await t.test(
    "preferences persist and invalid timezones are rejected",
    async () => {
      const p = {
        locale: "en-US",
        hourCycle: "h12",
        dateFormat: "MM/dd/yyyy",
        timezone: "America/New_York",
        theme: "dark",
      };
      await http
        .patch("/preferences")
        .auth(alice.accessToken, { type: "bearer" })
        .send(p)
        .expect(200);
      const me = await http
        .get("/usuarios/me")
        .auth(alice.accessToken, { type: "bearer" })
        .expect(200);
      assert.deepEqual(me.body.preferences, p);
      await http
        .patch("/preferences")
        .auth(alice.accessToken, { type: "bearer" })
        .send({ ...p, timezone: "Mars/Olympus" })
        .expect(400);
    },
  );
  await t.test(
    "malformed input is rejected and missing AI fails explicitly",
    async () => {
      await http
        .post("/events")
        .auth(alice.accessToken, { type: "bearer" })
        .send({ events: [{ ...event, end: event.start }] })
        .expect(400);
      await http
        .post("/events")
        .auth(alice.accessToken, { type: "bearer" })
        .send({ events: [{ ...event, user_id: bob.user.id }] })
        .expect(400);
      await http
        .get("/events?from=invalid&to=2026-10-02")
        .auth(alice.accessToken, { type: "bearer" })
        .expect(400);
      if (!process.env.GEMINI_API_KEY)
        await http
          .post("/planner/propose")
          .auth(alice.accessToken, { type: "bearer" })
          .send({ text: "Plan a walk tomorrow", referenceDate: "2026-10-01" })
          .expect(503);
    },
  );
  await t.test("owner completes and deletes own event", async () => {
    await http
      .patch(`/events/${eventId}`)
      .auth(alice.accessToken, { type: "bearer" })
      .send({ completed: true })
      .expect(200);
    await http
      .delete(`/events/${eventId}`)
      .auth(alice.accessToken, { type: "bearer" })
      .expect(200);
  });
  await t.test("AI output is validated and suggestions never persist automatically", async () => {
    const { env } = require('../apps/api/dist/config');
    const { PlannerService } = require('../apps/api/dist/planner/planner.service');
    const originalKey = env.GEMINI_API_KEY;
    const originalFetch = global.fetch;
    const service = app.get(PlannerService);
    const before = (await db.query('SELECT count(*) FROM events WHERE user_id=$1', [alice.user.id])).rows[0].count;
    const response = (data) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(data) }] } }] }), { status: 200 });
    try {
      env.GEMINI_API_KEY = 'test-provider-key';
      global.fetch = async () => response({ events: [event] });
      const result = await service.propose('Plan a meeting', '2026-10-01', alice.user.preferences, []);
      assert.equal(result.events[0].title, event.title);
      global.fetch = async () => response({ events: [{ ...event, end: event.start }] });
      await assert.rejects(service.propose('Plan a meeting', '2026-10-01', alice.user.preferences, []), /AI_UNAVAILABLE/);
      global.fetch = async () => response({ events: [] });
      await assert.rejects(service.propose('Plan something', '2026-10-01', alice.user.preferences, []), /ADD_MORE_DETAILS/);
      const after = (await db.query('SELECT count(*) FROM events WHERE user_id=$1', [alice.user.id])).rows[0].count;
      assert.equal(before, after);
    } finally {
      env.GEMINI_API_KEY = originalKey;
      global.fetch = originalFetch;
    }
  });
});
