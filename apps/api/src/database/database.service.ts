import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Pool, QueryResultRow } from "pg";
import { env } from "../config";
import { migrations } from "./migrations";
@Injectable()
export class Database implements OnModuleInit, OnModuleDestroy {
  readonly pool = new Pool({ connectionString: env.DATABASE_URL });
  async onModuleInit() {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(752819)");
      await client.query(`CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL,
    preferences JSONB NOT NULL DEFAULT '{"locale":"pt-BR","hourCycle":"h23","dateFormat":"dd/MM/yyyy","timezone":"America/Recife","theme":"light"}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now());
   CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL, start_at TIMESTAMPTZ NOT NULL, end_at TIMESTAMPTZ NOT NULL,
    category TEXT NOT NULL DEFAULT 'personal', completed BOOLEAN NOT NULL DEFAULT false,
    CHECK (end_at > start_at));
   CREATE INDEX IF NOT EXISTS events_user_start ON events(user_id, start_at);`);
      await client.query(
        "CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())",
      );
      for (const migration of migrations) {
        if (
          !(
            await client.query(
              "SELECT version FROM schema_migrations WHERE version=$1",
              [migration.version],
            )
          ).rowCount
        ) {
          await client.query(migration.sql);
          await client.query(
            "INSERT INTO schema_migrations(version) VALUES($1)",
            [migration.version],
          );
        }
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
  query<T extends QueryResultRow = any>(sql: string, values: unknown[] = []) {
    return this.pool.query<T>(sql, values);
  }
  async onModuleDestroy() {
    await this.pool.end();
  }
}
