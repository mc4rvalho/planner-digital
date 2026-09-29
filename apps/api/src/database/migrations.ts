export const migrations = [
  {
    version: 1,
    sql: `
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS password_resets (
 token_hash TEXT PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS password_resets_user ON password_resets(user_id);
CREATE TABLE IF NOT EXISTS finance_categories (
 id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 name TEXT NOT NULL, color TEXT NOT NULL, UNIQUE(user_id,name), UNIQUE(id,user_id)
);
CREATE TABLE IF NOT EXISTS finance_transactions (
 id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 description TEXT NOT NULL, amount_cents INTEGER NOT NULL CHECK(amount_cents>0),
 type TEXT NOT NULL CHECK(type IN ('income','expense')), occurred_on DATE NOT NULL,
 category_id UUID, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 FOREIGN KEY(category_id,user_id) REFERENCES finance_categories(id,user_id)
);
CREATE INDEX IF NOT EXISTS finance_user_date ON finance_transactions(user_id,occurred_on);
`,
  },
];
