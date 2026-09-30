import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { DateTime } from "luxon";
import type { PoolClient } from "pg";
import { Database } from "../database/database.service";
import type { ObligationInput, InvestmentInput } from "./schemas";

@Injectable()
export class FinanceManagementService {
  constructor(private readonly db: Database) {}
  async mutate<T>(userId: string, action: (client: PoolClient) => Promise<T>) {
    const c = await this.db.pool.connect();
    try {
      await c.query("BEGIN");
      await c.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [userId]);
      const result = await action(c);
      await c.query("COMMIT");
      return result;
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  }
  async obligations(userId: string) {
    return (
      await this.db.query(
        `SELECT o.id,o.title,o.kind,o.total_cents AS "totalCents",o.due_on::text AS "dueDate",o.category_id AS "categoryId",o.series_id AS "seriesId",
      COALESCE(sum(t.amount_cents),0)::float8 AS "paidCents",(o.total_cents-COALESCE(sum(t.amount_cents),0))::float8 AS "remainingCents"
      FROM finance_obligations o LEFT JOIN finance_transactions t ON t.obligation_id=o.id AND t.user_id=o.user_id
      WHERE o.user_id=$1 GROUP BY o.id ORDER BY o.due_on,o.created_at`,
        [userId],
      )
    ).rows;
  }
  async investments(userId: string) {
    return (
      await this.db.query(
        `SELECT i.id,i.name,i.target_cents AS "targetCents",
      COALESCE(sum(t.amount_cents) FILTER(WHERE t.type='expense'),0)::float8 AS "contributedCents",
      COALESCE(sum(t.amount_cents) FILTER(WHERE t.type='income'),0)::float8 AS "redeemedCents",
      COALESCE(sum(CASE WHEN t.type='expense' THEN t.amount_cents ELSE -t.amount_cents END),0)::float8 AS "balanceCents"
      FROM finance_investments i LEFT JOIN finance_transactions t ON t.investment_id=i.id AND t.user_id=i.user_id
      WHERE i.user_id=$1 GROUP BY i.id ORDER BY i.created_at`,
        [userId],
      )
    ).rows;
  }
  async obligation(
    userId: string,
    input: ObligationInput,
    id?: string,
    months = 1,
    weeks = 1,
  ) {
    return this.mutate(userId, async (c) => {
      if (
        input.categoryId &&
        !(
          await c.query(
            "SELECT id FROM finance_categories WHERE id=$1 AND user_id=$2",
            [input.categoryId, userId],
          )
        ).rowCount
      )
        throw new BadRequestException("CATEGORY_INVALID");
      if (id) {
        if (
          !(
            await c.query(
              "SELECT id FROM finance_obligations WHERE id=$1 AND user_id=$2",
              [id, userId],
            )
          ).rowCount
        )
          throw new NotFoundException();
        const {
          rows: [sum],
        } = await c.query(
          "SELECT COALESCE(sum(amount_cents),0)::float8 AS paid FROM finance_transactions WHERE obligation_id=$1 AND user_id=$2",
          [id, userId],
        );
        if (input.totalCents < sum.paid)
          throw new ConflictException("BELOW_PAID_AMOUNT");
        await c.query(
          "UPDATE finance_obligations SET title=$3,kind=$4,total_cents=$5,due_on=$6,category_id=$7 WHERE id=$1 AND user_id=$2",
          [
            id,
            userId,
            input.title,
            input.kind,
            input.totalCents,
            input.dueDate,
            input.categoryId,
          ],
        );
        return [{ id }];
      }
      const count = Math.max(months, weeks);
      const seriesId = count > 1 ? randomUUID() : null;
      const result = [];
      for (let occurrence = 0; occurrence < count; occurrence++) {
        const nextId = randomUUID();
        const due = DateTime.fromISO(input.dueDate, { zone: "UTC" })
          .plus(weeks > 1 ? { weeks: occurrence } : { months: occurrence })
          .toISODate();
        await c.query(
          "INSERT INTO finance_obligations(id,user_id,title,kind,total_cents,due_on,category_id,series_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
          [
            nextId,
            userId,
            input.title,
            input.kind,
            input.totalCents,
            due,
            input.categoryId,
            seriesId,
          ],
        );
        result.push({ id: nextId });
      }
      return result;
    });
  }
  async investment(userId: string, input: InvestmentInput, id?: string) {
    return this.mutate(userId, async (c) => {
      const result = id
        ? await c.query(
            "UPDATE finance_investments SET name=$3,target_cents=$4 WHERE id=$1 AND user_id=$2 RETURNING id",
            [id, userId, input.name, input.targetCents],
          )
        : await c.query(
            "INSERT INTO finance_investments(id,user_id,name,target_cents) VALUES($1,$2,$3,$4) RETURNING id",
            [randomUUID(), userId, input.name, input.targetCents],
          );
      if (!result.rowCount) throw new NotFoundException();
      return result.rows[0];
    });
  }
  async history(userId: string, id: string, kind: "obligation" | "investment") {
    const table =
      kind === "obligation" ? "finance_obligations" : "finance_investments";
    const column = kind === "obligation" ? "obligation_id" : "investment_id";
    if (
      !(
        await this.db.query(
          `SELECT id FROM ${table} WHERE id=$1 AND user_id=$2`,
          [id, userId],
        )
      ).rowCount
    )
      throw new NotFoundException();
    return (
      await this.db.query(
        `SELECT t.id,t.description,t.amount_cents AS "amountCents",t.type,t.occurred_on::text AS date,t.category_id AS "categoryId",t.obligation_id AS "obligationId",t.investment_id AS "investmentId" FROM finance_transactions t WHERE t.${column}=$1 AND t.user_id=$2 ORDER BY t.occurred_on DESC,t.created_at DESC`,
        [id, userId],
      )
    ).rows;
  }
  async remove(userId: string, id: string, kind: "obligation" | "investment") {
    return this.mutate(userId, async (c) => {
      const table =
        kind === "obligation" ? "finance_obligations" : "finance_investments";
      const column = kind === "obligation" ? "obligation_id" : "investment_id";
      if (
        !(
          await c.query(`SELECT id FROM ${table} WHERE id=$1 AND user_id=$2`, [
            id,
            userId,
          ])
        ).rowCount
      )
        throw new NotFoundException();
      if (
        (
          await c.query(
            `SELECT id FROM finance_transactions WHERE ${column}=$1 AND user_id=$2 LIMIT 1`,
            [id, userId],
          )
        ).rowCount
      )
        throw new ConflictException("HAS_LINKED_TRANSACTIONS");
      await c.query(`DELETE FROM ${table} WHERE id=$1 AND user_id=$2`, [
        id,
        userId,
      ]);
      return { deleted: true };
    });
  }
}
