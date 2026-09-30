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
  {
    version: 2,
    sql: `
CREATE TABLE IF NOT EXISTS finance_obligations (
 id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 title TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('fixed','variable','debt')),
 total_cents INTEGER NOT NULL CHECK(total_cents>0), due_on DATE NOT NULL,
 category_id UUID, series_id UUID, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(id,user_id), FOREIGN KEY(category_id,user_id) REFERENCES finance_categories(id,user_id)
);
CREATE INDEX IF NOT EXISTS finance_obligations_user_due ON finance_obligations(user_id,due_on);
CREATE TABLE IF NOT EXISTS finance_investments (
 id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 name TEXT NOT NULL, target_cents INTEGER CHECK(target_cents>0),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(id,user_id)
);
ALTER TABLE finance_transactions ADD COLUMN IF NOT EXISTS obligation_id UUID;
ALTER TABLE finance_transactions ADD COLUMN IF NOT EXISTS investment_id UUID;
ALTER TABLE finance_transactions ADD CONSTRAINT transaction_obligation_owner FOREIGN KEY(obligation_id,user_id) REFERENCES finance_obligations(id,user_id);
ALTER TABLE finance_transactions ADD CONSTRAINT transaction_investment_owner FOREIGN KEY(investment_id,user_id) REFERENCES finance_investments(id,user_id);
ALTER TABLE finance_transactions ADD CONSTRAINT transaction_one_link CHECK(obligation_id IS NULL OR investment_id IS NULL);
ALTER TABLE finance_transactions ADD CONSTRAINT obligation_payment_expense CHECK(obligation_id IS NULL OR type='expense');
CREATE INDEX finance_transaction_obligation ON finance_transactions(obligation_id);
CREATE INDEX finance_transaction_investment ON finance_transactions(investment_id);
`,
  },
];
