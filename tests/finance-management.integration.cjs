require("reflect-metadata");
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { NestFactory } = require("@nestjs/core");
const request = require("supertest");
const { AppModule } = require("../apps/api/dist/app.module");
const { Database } = require("../apps/api/dist/database/database.service");
const { FinanceService } = require("../apps/api/dist/finance/finance.service");
const { PlannerService } = require("../apps/api/dist/planner/planner.service");
const { env } = require("../apps/api/dist/config");
let app, db, http, user, other, bill, investment;
const email = `management-${randomUUID()}@example.com`,
  otherEmail = `management-other-${randomUUID()}@example.com`;
const body = {
  title: "Energia",
  kind: "fixed",
  totalCents: 40000,
  dueDate: "2026-10-31",
  categoryId: null,
  months: 1,
};
const transaction = (amountCents = 30000, extra = {}) => ({
  description: "Energia paga",
  amountCents,
  type: "expense",
  date: "2026-10-15",
  categoryId: null,
  obligationId: bill,
  investmentId: null,
  ...extra,
});
const auth = (req, account = user) =>
  req.set("Authorization", `Bearer ${account.accessToken}`);
before(async () => {
  app = await NestFactory.create(AppModule, { logger: false });
  await app.init();
  db = app.get(Database);
  http = request(app.getHttpServer());
  user = (
    await http
      .post("/usuarios/cadastrar")
      .send({
        nome: "Management Test",
        usuario: email,
        senha: "test-password-strong",
      })
      .expect(201)
  ).body;
  other = (
    await http
      .post("/usuarios/cadastrar")
      .send({
        nome: "Other Test",
        usuario: otherEmail,
        senha: "test-password-strong",
      })
      .expect(201)
  ).body;
});
after(async () => {
  if (db)
    await db.query("DELETE FROM users WHERE email=ANY($1)", [
      [email, otherEmail],
    ]);
  if (app) await app.close();
});
test("financial commitments, partial payments, investment capital and proposal linking", async (t) => {
  await t.test(
    "repeated bills clamp month-end dates without drifting and preserve individual totals",
    async () => {
      const result = await auth(http.post("/finance/obligations"))
        .send({ ...body, months: 3 })
        .expect(201);
      bill = result.body[0].id;
      const bills = (await auth(http.get("/finance/obligations")).expect(200))
        .body;
      assert.deepEqual(
        bills.map((x) => x.dueDate),
        ["2026-10-31", "2026-11-30", "2026-12-31"],
      );
      assert.ok(
        bills.every((x) => x.totalCents === 40000 && x.paidCents === 0),
      );
      await auth(http.post("/finance/obligations"))
        .send({ ...body, kind: "debt", months: 2 })
        .expect(400);
    },
  );
  let payment;
  await t.test(
    "pay 300 of 400 leaves 100; cash flow records only the payment",
    async () => {
      payment = (
        await auth(http.post("/finance/transactions"))
          .send({ transactions: [transaction()] })
          .expect(201)
      ).body[0].id;
      const bills = (await auth(http.get("/finance/obligations"))).body;
      assert.equal(bills.find((x) => x.id === bill).paidCents, 30000);
      assert.equal(bills.find((x) => x.id === bill).remainingCents, 10000);
      const dashboard = (
        await auth(http.get("/finance?from=2026-10-01&to=2026-11-01"))
      ).body;
      assert.equal(dashboard.summary.expense, 30000);
      await auth(http.post("/finance/transactions"))
        .send({ transactions: [transaction(10001)] })
        .expect(409);
      const { months, ...edit } = body;
      await auth(http.patch(`/finance/obligations/${bill}`))
        .send({ ...edit, totalCents: 29999 })
        .expect(409);
      await auth(http.delete(`/finance/obligations/${bill}`)).expect(409);
    },
  );
  await t.test(
    "concurrent payments cannot overpay and rejected batches roll back",
    async () => {
      const results = await Promise.all(
        [1, 2].map(() =>
          auth(http.post("/finance/transactions")).send({
            transactions: [transaction(10000)],
          }),
        ),
      );
      assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
      const final = results.find((r) => r.status === 201).body[0].id;
      await auth(http.delete(`/finance/transactions/${final}`)).expect(200);
      await auth(http.post("/finance/transactions"))
        .send({ transactions: [transaction(7000), transaction(7000)] })
        .expect(409);
      assert.equal(
        (await auth(http.get("/finance/obligations"))).body.find(
          (x) => x.id === bill,
        ).remainingCents,
        10000,
      );
    },
  );
  await t.test(
    "editing and deleting a payment updates the balance and history across months",
    async () => {
      await auth(http.patch(`/finance/transactions/${payment}`))
        .send(transaction(20000, { date: "2026-09-30" }))
        .expect(200);
      let b = (await auth(http.get("/finance/obligations"))).body.find(
        (x) => x.id === bill,
      );
      assert.equal(b.remainingCents, 20000);
      const h = (
        await auth(http.get(`/finance/obligations/${bill}/transactions`))
      ).body;
      assert.equal(h[0].id, payment);
      assert.equal(h[0].date, "2026-09-30");
      await auth(http.delete(`/finance/transactions/${payment}`)).expect(200);
      b = (await auth(http.get("/finance/obligations"))).body.find(
        (x) => x.id === bill,
      );
      assert.equal(b.remainingCents, 40000);
    },
  );
  await t.test(
    "ownership is enforced for bills, investments, payments and histories",
    async () => {
      assert.deepEqual(
        (await auth(http.get("/finance/obligations"), other)).body,
        [],
      );
      await auth(
        http.get(`/finance/obligations/${bill}/transactions`),
        other,
      ).expect(404);
      await auth(http.post("/finance/transactions"), other)
        .send({ transactions: [transaction(1000)] })
        .expect(400);
      await auth(http.delete(`/finance/obligations/${bill}`), other).expect(
        404,
      );
      const { months, ...edit } = body;
      await auth(http.patch(`/finance/obligations/${bill}`), other)
        .send(edit)
        .expect(404);
    },
  );
  let contribution;
  await t.test(
    "investment contributions and redemptions balance without double counting",
    async () => {
      investment = (
        await auth(http.post("/finance/investments"))
          .send({ name: "Reserva", targetCents: 100000 })
          .expect(201)
      ).body.id;
      contribution = (
        await auth(http.post("/finance/transactions"))
          .send({
            transactions: [
              transaction(50000, {
                obligationId: null,
                investmentId: investment,
                description: "Aporte",
                date: "2026-10-01",
              }),
            ],
          })
          .expect(201)
      ).body[0].id;
      await auth(http.post("/finance/transactions"))
        .send({
          transactions: [
            transaction(20000, {
              type: "income",
              obligationId: null,
              investmentId: investment,
              description: "Resgate",
              date: "2026-10-02",
            }),
          ],
        })
        .expect(201);
      const inv = (await auth(http.get("/finance/investments"))).body[0];
      assert.equal(inv.balanceCents, 30000);
      assert.equal(inv.contributedCents, 50000);
      assert.equal(inv.redeemedCents, 20000);
      const dashboard = (
        await auth(http.get("/finance?from=2026-10-01&to=2026-11-01"))
      ).body;
      assert.equal(dashboard.summary.invested, 50000);
      assert.equal(dashboard.summary.redeemed, 20000);
      assert.equal(dashboard.summary.spending, 0);
    },
  );
  await t.test(
    "redemptions, historic edits and deletion cannot overdraw investment capital",
    async () => {
      await auth(http.post("/finance/transactions"))
        .send({
          transactions: [
            transaction(30001, {
              type: "income",
              obligationId: null,
              investmentId: investment,
            }),
          ],
        })
        .expect(409);
      await auth(http.post("/finance/transactions"))
        .send({
          transactions: [
            transaction(1000, {
              type: "income",
              obligationId: null,
              investmentId: investment,
              date: "2026-09-01",
            }),
          ],
        })
        .expect(409);
      await auth(http.delete(`/finance/transactions/${contribution}`)).expect(
        409,
      );
      await auth(http.patch(`/finance/transactions/${contribution}`))
        .send(
          transaction(50000, {
            obligationId: null,
            investmentId: investment,
            date: "2026-10-03",
          }),
        )
        .expect(409);
      await auth(http.post("/finance/transactions"), other)
        .send({
          transactions: [
            transaction(1000, { obligationId: null, investmentId: investment }),
          ],
        })
        .expect(400);
      await auth(
        http.get(`/finance/investments/${investment}/transactions`),
        other,
      ).expect(404);
    },
  );
  await t.test(
    "AI proposals link only actual paid amounts and never write before confirmation",
    async () => {
      const fetch = global.fetch,
        key = env.GEMINI_API_KEY;
      env.GEMINI_API_KEY = "test-key";
      try {
        global.fetch = async (_url, init) => {
          const data = JSON.parse(init.body);
          const context = JSON.parse(data.contents[0].parts[0].text);
          assert.ok(context.obligations.some((x) => x.id === bill));
          assert.match(data.systemInstruction.parts[0].text, /ONLY 300/);
          return new Response(
            JSON.stringify({
              candidates: [
                {
                  content: {
                    parts: [
                      {
                        text: JSON.stringify({
                          transactions: [transaction(30000)],
                        }),
                      },
                    ],
                  },
                },
              ],
            }),
          );
        };
        const result = await app
          .get(FinanceService)
          .propose(
            user.user.id,
            "Paguei 300 da energia de 400; faltam 100",
            "2026-10-15",
            "pt-BR",
          );
        assert.equal(result.transactions[0].obligationId, bill);
        assert.equal(
          (await auth(http.get("/finance/obligations"))).body.find(
            (x) => x.id === bill,
          ).paidCents,
          0,
        );
      } finally {
        global.fetch = fetch;
        env.GEMINI_API_KEY = key;
      }
    },
  );
  await t.test(
    "explicit routine works with no Gemini, rejects conflicts and never saves automatically",
    async () => {
      const key = env.GEMINI_API_KEY;
      env.GEMINI_API_KEY = "";
      try {
        const service = app.get(PlannerService);
        const text =
          "Rodar das 05h30 até às 12h.\nAlmoçar e Descansar das 12h até às 15h.\nArrumar a casa às 16h até às 17h.\nRodar das 17h até às 20h.\nEstudar das 20h até às 22h.";
        const proposal = await service.propose(
          text,
          "2026-10-15",
          user.user.preferences,
          [],
        );
        assert.equal(proposal.events.length, 5);
        assert.equal(proposal.source, "explicit");
        await assert.rejects(
          service.propose(text, "2026-10-15", user.user.preferences, [
            {
              ...proposal.events[0],
              start: new Date(proposal.events[0].start),
              end: new Date(proposal.events[0].end),
            },
          ]),
          /EVENT_CONFLICT/,
        );
        const count = (
          await db.query(
            "SELECT count(*)::int AS count FROM events WHERE user_id=$1",
            [user.user.id],
          )
        ).rows[0].count;
        assert.equal(count, 0);
      } finally {
        env.GEMINI_API_KEY = key;
      }
    },
  );
});
