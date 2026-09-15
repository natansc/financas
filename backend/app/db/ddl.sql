-- backend/db/ddl.sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS accounts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('CHECKING','CREDIT_CARD','CASH')),
  balance numeric(12,2) NOT NULL DEFAULT 0,
  pluggy_account_id text UNIQUE
);

CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  icon text,
  color_hex text,
  type text NOT NULL CHECK (type IN ('INCOME','EXPENSE'))
);

CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  category_id uuid REFERENCES categories(id),
  description text,
  amount numeric(12,2) NOT NULL,
  date timestamptz NOT NULL,
  is_manual boolean DEFAULT false,
  pluggy_transaction_id varchar(255) UNIQUE,
  raw_payload jsonb,
  CONSTRAINT uq_transactions_pluggy_id UNIQUE (pluggy_transaction_id)
);
