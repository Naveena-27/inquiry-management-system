import fs from 'node:fs';
import bcrypt from 'bcryptjs';
import { pool } from '../src/db.js';

const schema = fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
await pool.query(schema);

const users = [
  ['staff1@example.com', 'Staff One', 'staff'],
  ['staff2@example.com', 'Staff Two', 'staff'],
  ['manager@example.com', 'Manager', 'manager'],
];
for (const [email, name, role] of users) {
  const hash = await bcrypt.hash('password123', 10);
  await pool.query(
    `INSERT INTO users (email, name, password_hash, role) VALUES ($1,$2,$3,$4)
     ON CONFLICT (email) DO NOTHING`,
    [email, name, hash, role]
  );
}
console.log('Migration + seed done.');
await pool.end();
