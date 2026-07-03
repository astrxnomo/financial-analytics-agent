CREATE TABLE IF NOT EXISTS departments (
  id   integer PRIMARY KEY,
  name text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS categories (
  id   integer PRIMARY KEY,
  name text NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind IN ('expense', 'revenue'))
);

CREATE TABLE IF NOT EXISTS transactions (
  id            integer PRIMARY KEY,
  date          date NOT NULL,
  amount        numeric(12, 2) NOT NULL,
  department_id integer NOT NULL REFERENCES departments(id),
  category_id   integer NOT NULL REFERENCES categories(id),
  type          text NOT NULL CHECK (type IN ('income', 'expense')),
  description   text NOT NULL
);

CREATE TABLE IF NOT EXISTS budgets (
  id            integer PRIMARY KEY,
  department_id integer NOT NULL REFERENCES departments(id),
  month         date NOT NULL,
  amount        numeric(12, 2) NOT NULL,
  UNIQUE (department_id, month)
);

CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_tx_dept ON transactions(department_id);
CREATE INDEX IF NOT EXISTS idx_tx_cat  ON transactions(category_id);
