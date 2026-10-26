CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('staff','manager'))
);

CREATE TABLE IF NOT EXISTS inquiries (
  id SERIAL PRIMARY KEY,
  customer_name TEXT NOT NULL,
  contact TEXT NOT NULL,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'New' CHECK (status IN ('New','In Progress','Resolved')),
  version INT NOT NULL DEFAULT 1,
  owner_id INT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inquiries_owner_idx ON inquiries(owner_id);
CREATE INDEX IF NOT EXISTS inquiries_status_idx ON inquiries(status);

-- Duplicate policy: same owner + same contact + same subject cannot be open twice.
CREATE UNIQUE INDEX IF NOT EXISTS inquiries_open_dup
  ON inquiries (owner_id, lower(contact), lower(subject))
  WHERE status <> 'Resolved';
