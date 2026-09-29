require("reflect-metadata");
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID, randomBytes, createHash } = require("node:crypto");
const { NestFactory } = require("@nestjs/core");
const { ValidationPipe } = require("@nestjs/common");
const request = require("supertest");
const { AppModule } = require("../apps/api/dist/app.module");
const { Database } = require("../apps/api/dist/database/database.service");
const { ResetMailer } = require("../apps/api/dist/users/account.controller");
const { FinanceService } = require("../apps/api/dist/finance/finance.service");
const { env } = require("../apps/api/dist/config");
const suffix = randomUUID(),
  email = `features-${suffix}@example.com`,
  otherEmail = `other-${suffix}@example.com`;
let app,
  db,
  http,
  user,
  other,
  mail = [];
before(async () => {
  app = await NestFactory.create(AppModule, { logger: false });
  app.useBodyParser("json", { limit: "512kb" });
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
  user = (
    await http
      .post("/usuarios/cadastrar")
      .send({
        nome: "Feature User",
        usuario: email,
        senha: "initial-password-123",
      })
      .expect(201)
  ).body;
  other = (
    await http
      .post("/usuarios/cadastrar")
      .send({
        nome: "Other User",
        usuario: otherEmail,
        senha: "initial-password-123",
      })
      .expect(201)
  ).body;
  app.get(ResetMailer).send = async (email, token) => {
    mail.push({ email, token });
  };
});
after(async () => {
  if (db)
    await db.query("DELETE FROM users WHERE email=ANY($1::text[])", [
      [email, otherEmail],
    ]);
  if (app) await app.close();
});
const auth = (r, session = user) =>
  r.auth(session.accessToken, { type: "bearer" });
test("profile, event editing, financial isolation and password lifecycle", async (t) => {
  await t.test(
    "profile accepts a real raster avatar, rejects SVG, and persists name",
    async () => {
      const photo =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=";
      const result = await auth(http.patch("/account/profile"))
        .send({ name: "Updated Name", photo })
        .expect(200);
      assert.equal(result.body.name, "Updated Name");
      assert.equal(result.body.photo, photo);
      assert.equal(result.body.password, undefined);
      await auth(http.patch("/account/profile"))
        .send({
          name: "Name",
          photo: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
        })
        .expect(400);
      await auth(http.patch("/account/profile"))
        .send({ name: "Name", photo: null, userId: other.user.id })
        .expect(400);
      const me = await auth(http.get("/usuarios/me"));
      assert.equal(me.body.photo, photo);
    },
  );
  await t.test(
    "event editing preserves completion and rejects conflicts and another owner",
    async () => {
      const event = {
        title: "Before",
        start: "2026-10-10T09:00:00Z",
        end: "2026-10-10T10:00:00Z",
        category: "work",
      };
      const created = await auth(http.post("/events"))
        .send({
          events: [
            event,
            {
              ...event,
              start: "2026-10-10T11:00:00Z",
              end: "2026-10-10T12:00:00Z",
            },
          ],
        })
        .expect(201);
      const id = created.body[0].id;
      await auth(http.patch(`/events/${id}`))
        .send({ completed: true })
        .expect(200);
      const changed = await auth(http.patch(`/events/${id}`))
        .send({ ...event, title: "After", end: "2026-10-10T10:30:00Z" })
        .expect(200);
      assert.equal(changed.body.title, "After");
      assert.equal(changed.body.completed, true);
      await auth(http.patch(`/events/${id}`))
        .send({ ...event, end: "2026-10-10T11:30:00Z" })
        .expect(409);
      await auth(http.patch(`/events/${id}`), other)
        .send(event)
        .expect(404);
      const list = await auth(
        http.get("/events?from=2026-10-10&to=2026-10-11"),
      );
      assert.equal(list.body[0].title, "After");
    },
  );
  let categoryId, transactionId;
  await t.test(
    "financial writes use integer cents and enforce category ownership",
    async () => {
      await http.get("/finance?from=2026-10-01&to=2026-11-01").expect(401);
      categoryId = (
        await auth(http.post("/finance/categories"))
          .send({ name: "Food", color: "#123456" })
          .expect(201)
      ).body.id;
      const base = {
        description: "Groceries",
        amountCents: 1234,
        type: "expense",
        date: "2026-10-10",
        categoryId,
      };
      await auth(http.post("/finance/transactions"), other)
        .send({ transactions: [base] })
        .expect(400);
      await auth(http.post("/finance/transactions"))
        .send({ transactions: [{ ...base, amountCents: 12.34 }] })
        .expect(400);
      await auth(http.post("/finance/transactions"))
        .send({ transactions: [{ ...base, amountCents: -1 }] })
        .expect(400);
      const result = await auth(http.post("/finance/transactions"))
        .send({
          transactions: [
            base,
            {
              ...base,
              description: "Salary",
              amountCents: 50000,
              type: "income",
              categoryId: null,
            },
          ],
        })
        .expect(201);
      transactionId = result.body[0].id;
      await auth(http.patch(`/finance/transactions/${transactionId}`), other)
        .send(base)
        .expect(404);
      await auth(
        http.delete(`/finance/transactions/${transactionId}`),
        other,
      ).expect(404);
      await auth(http.patch(`/finance/categories/${categoryId}`), other)
        .send({ name: "Stolen", color: "#000000" })
        .expect(404);
      await auth(
        http.delete(`/finance/categories/${categoryId}`),
        other,
      ).expect(404);
    },
  );
  await t.test(
    "dashboard sums cents, filters dates and isolates users; edits are reflected",
    async () => {
      const path = "/finance?from=2026-10-01&to=2026-11-01";
      let result = (await auth(http.get(path)).expect(200)).body;
      assert.deepEqual(result.summary, {
        income: 50000,
        expense: 1234,
        count: 2,
        balance: 48766,
      });
      assert.equal(result.daily[0].date, "2026-10-10");
      assert.equal(result.byCategory[0].amount, 1234);
      assert.equal((await auth(http.get(path), other)).body.summary.count, 0);
      await auth(http.patch(`/finance/transactions/${transactionId}`))
        .send({
          description: "Updated groceries",
          amountCents: 2345,
          type: "expense",
          date: "2026-10-11",
          categoryId,
        })
        .expect(200);
      await auth(http.patch(`/finance/categories/${categoryId}`))
        .send({ name: "Meals", color: "#aabbcc" })
        .expect(200);
      result = (await auth(http.get(path))).body;
      assert.equal(result.summary.balance, 47655);
      assert.equal(result.byCategory[0].name, "Meals");
      assert.equal(result.transactions[0].description, "Updated groceries");
      assert.equal(
        (await auth(http.get("/finance?from=2026-11-01&to=2026-12-01"))).body
          .summary.count,
        0,
      );
    },
  );
  await t.test(
    "deleting a category keeps its transactions; bad batches roll back",
    async () => {
      await auth(http.delete(`/finance/categories/${categoryId}`)).expect(200);
      const path = "/finance?from=2026-10-01&to=2026-11-01";
      const list = (await auth(http.get(path))).body;
      assert.equal(list.summary.count, 2);
      assert.equal(list.transactions[0].categoryId, null);
      const input = {
        description: "Temporary",
        amountCents: 100,
        type: "expense",
        date: "2026-10-12",
        categoryId: null,
      };
      await auth(http.post("/finance/transactions"))
        .send({ transactions: [input, { ...input, categoryId: randomUUID() }] })
        .expect(400);
      assert.equal((await auth(http.get(path))).body.summary.count, 2);
    },
  );
  await t.test(
    "finance AI validates provider data without saving or trusting foreign categories",
    async () => {
      const originalFetch = global.fetch,
        originalKey = env.GEMINI_API_KEY;
      const service = app.get(FinanceService);
      const candidate = {
        description: "Bus",
        amountCents: 450,
        type: "expense",
        date: "2026-10-10",
        categoryId: null,
      };
      const reply = (data) =>
        new Response(
          JSON.stringify({
            candidates: [
              { content: { parts: [{ text: JSON.stringify(data) }] } },
            ],
          }),
          { status: 200 },
        );
      try {
        env.GEMINI_API_KEY = "test-only";
        global.fetch = async () => reply({ transactions: [candidate] });
        const before = (
          await db.query(
            "SELECT count(*) FROM finance_transactions WHERE user_id=$1",
            [user.user.id],
          )
        ).rows[0].count;
        assert.equal(
          (
            await service.propose(
              user.user.id,
              "Spent 4.50 on bus",
              "2026-10-10",
              "en-US",
            )
          ).transactions[0].amountCents,
          450,
        );
        global.fetch = async () =>
          reply({ transactions: [{ ...candidate, categoryId: randomUUID() }] });
        await assert.rejects(
          service.propose(user.user.id, "Spent 4.50", "2026-10-10", "en-US"),
          /AI_UNAVAILABLE/,
        );
        global.fetch = async () =>
          reply({ transactions: [{ ...candidate, amountCents: 4.5 }] });
        await assert.rejects(
          service.propose(user.user.id, "Spent 4.50", "2026-10-10", "en-US"),
          /AI_UNAVAILABLE/,
        );
        assert.equal(
          (
            await db.query(
              "SELECT count(*) FROM finance_transactions WHERE user_id=$1",
              [user.user.id],
            )
          ).rows[0].count,
          before,
        );
      } finally {
        global.fetch = originalFetch;
        env.GEMINI_API_KEY = originalKey;
      }
    },
  );
  await t.test(
    "password change requires the current password and revokes old JWTs",
    async () => {
      await auth(http.post("/account/password"))
        .send({ currentPassword: "wrong", newPassword: "new-password-456" })
        .expect(401);
      const old = user.accessToken;
      user = (
        await auth(http.post("/account/password"))
          .send({
            currentPassword: "initial-password-123",
            newPassword: "new-password-456",
          })
          .expect(201)
      ).body;
      await http.get("/usuarios/me").auth(old, { type: "bearer" }).expect(401);
      await auth(http.get("/usuarios/me")).expect(200);
      await http
        .post("/usuarios/logar")
        .send({ usuario: email, senha: "initial-password-123" })
        .expect(401);
      await http
        .post("/usuarios/logar")
        .send({ usuario: email, senha: "new-password-456" })
        .expect(200);
    },
  );
  await t.test(
    "recovery is generic, hashed, expiring, single-use and revokes sessions",
    async () => {
      const originalHost = env.SMTP_HOST,
        originalFrom = env.SMTP_FROM;
      env.SMTP_HOST = "smtp.test";
      env.SMTP_FROM = "no-reply@example.com";
      try {
        const unknown = await http
          .post("/account/forgot-password")
          .send({ email: "missing-" + suffix + "@example.com" })
          .expect(201);
        const known = await http
          .post("/account/forgot-password")
          .send({ email })
          .expect(201);
        assert.deepEqual(known.body, unknown.body);
        assert.equal(known.body.token, undefined);
        assert.equal(mail.length, 1);
        const raw = mail[0].token;
        const stored = (
          await db.query("SELECT * FROM password_resets WHERE user_id=$1", [
            user.user.id,
          ])
        ).rows[0];
        assert.notEqual(stored.token_hash, raw);
        assert.equal(
          stored.token_hash,
          createHash("sha256").update(raw).digest("hex"),
        );
        const expired = randomBytes(32).toString("hex");
        await db.query(
          "INSERT INTO password_resets(token_hash,user_id,expires_at) VALUES($1,$2,now()-interval '1 minute')",
          [createHash("sha256").update(expired).digest("hex"), user.user.id],
        );
        await http
          .post("/account/reset-password")
          .send({ token: expired, newPassword: "reset-password-789" })
          .expect(400);
        const results = await Promise.all([
          http
            .post("/account/reset-password")
            .send({ token: raw, newPassword: "reset-password-789" }),
          http
            .post("/account/reset-password")
            .send({ token: raw, newPassword: "reset-password-789" }),
        ]);
        assert.deepEqual(results.map((r) => r.status).sort(), [201, 400]);
        await auth(http.get("/usuarios/me")).expect(401);
        await http
          .post("/usuarios/logar")
          .send({ usuario: email, senha: "reset-password-789" })
          .expect(200);
        assert.equal(
          (
            await db.query(
              "SELECT count(*) FROM password_resets WHERE user_id=$1",
              [user.user.id],
            )
          ).rows[0].count,
          "0",
        );
      } finally {
        env.SMTP_HOST = originalHost;
        env.SMTP_FROM = originalFrom;
      }
    },
  );
});
