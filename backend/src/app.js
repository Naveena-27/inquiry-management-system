import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { pool } from './db.js';
import {
  canTransition, inquirySchema, statusChangeSchema, loginSchema, fieldErrors, STATUSES,
} from './rules.js';

// Require JWT secret for authentication.
const SECRET = process.env.JWT_SECRET;
if (!SECRET) throw new Error('JWT_SECRET is not set. Copy .env.example to .env and set it.');

const app = express();
app.use(express.json());
app.use(cookieParser());

const fail = (res, status, code, message, extra ={}) =>
  res.status(status).json({ error:{ code, message, ...extra } });

// Forward async route errors to the global error handler.
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Authentication
function requireAuth(req, res, next) {
  try {
    req.user = jwt.verify(req.cookies.token, SECRET);
    next();
  } catch {
    fail(res, 401, 'UNAUTHENTICATED', 'Please sign in to continue.');
  }
}

app.post('/api/auth/login', wrap(async (req, res) => {
  const p = loginSchema.safeParse(req.body);
  if (!p.success) return fail(res, 400, 'VALIDATION', 'Invalid input', { fields: fieldErrors(p.error) });
  const { rows } = await pool.query('SELECT * FROM users WHERE email=$1', [p.data.email.toLowerCase()]);

  const u = rows[0];
  if (!u || !(await bcrypt.compare(p.data.password, u.password_hash)))
    return fail(res, 401, 'BAD_CREDENTIALS', 'Incorrect email or password.');

  const user = { id: u.id, name: u.name, role: u.role };
  res.cookie('token', jwt.sign(user, SECRET, { expiresIn: '8h' }), {
    httpOnly: true, sameSite: 'lax', maxAge: 8 * 3600 * 1000,
    secure: process.env.NODE_ENV === 'production', 
  });
  res.json({ user });
}));

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.status(204).end();
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  const { id, name, role } = req.user;
  res.json({ user: { id, name, role } });
});

// ---------- access rule ----------
// Staff see only inquiries they own. Managers see all.
const scope = (user) => ({ all: user.role === 'manager', id: user.id });

// Validate inquiry ID before querying the database.
function parseId(req, res) {
  const raw = req.params.id;
  const id = /^[0-9]{1,9}$/.test(raw) ? Number(raw) : 0;
  if (id <= 0) {
    fail(res, 400, 'INVALID_ID', 'Inquiry ID must be a positive whole number.');
    return null;
  }
  return id;
}

async function findAccessible(id, user) {
  const s = scope(user);
  const { rows } = await pool.query(
    'SELECT i.*, u.name AS owner_name FROM inquiries i JOIN users u ON u.id=i.owner_id WHERE i.id=$1 AND ($2 OR i.owner_id=$3)',
    [id, s.all, s.id]
  );
  return rows[0]; // undefined => not found OR no access (same response on purpose)
}

// ---------- inquiries ----------
app.get('/api/inquiries', requireAuth, wrap(async (req, res) => {
  const { status, q } = req.query;
  if (status && !STATUSES.includes(status))
    return fail(res, 400, 'VALIDATION', 'Unknown status filter.');

  const s = scope(req.user);
  const params = [s.all, s.id];

  let sql = `SELECT i.*, u.name AS owner_name FROM inquiries i JOIN users u ON u.id=i.owner_id
             WHERE ($1 OR i.owner_id=$2)`;

  if (status) { params.push(status); sql += ` AND i.status=$${params.length}`; }

  if (q && String(q).trim()) {
    // Treat search wildcards as literal characters.
    params.push(`%${String(q).trim().replace(/[\\%_]/g, '\\$&')}%`);
    sql += ` AND (i.customer_name ILIKE $${params.length} OR i.subject ILIKE $${params.length} OR i.contact ILIKE $${params.length})`;
  }

  sql += ' ORDER BY i.updated_at DESC LIMIT 200';

  const { rows } = await pool.query(sql, params);
  res.json({ inquiries: rows });
}));

app.post('/api/inquiries', requireAuth, wrap(async (req, res) => {
  const p = inquirySchema.safeParse(req.body);
  if (!p.success) return fail(res, 400, 'VALIDATION', 'Please fix the highlighted fields.', { fields: fieldErrors(p.error) });
  const d = p.data;
  
  try {
    const { rows } = await pool.query(
      `INSERT INTO inquiries (customer_name, contact, subject, description, owner_id)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [d.customer_name, d.contact, d.subject, d.description, req.user.id]
    );
    res.status(201).json({ inquiry: rows[0] });
  } catch (e) {
    if (e.code === '23505') {
      const { rows } = await pool.query(
        `SELECT id FROM inquiries WHERE owner_id=$1 AND lower(contact)=lower($2) AND lower(subject)=lower($3) AND status<>'Resolved'`,
        [req.user.id, d.contact, d.subject]
      );
      return fail(res, 409, 'DUPLICATE', 'An open inquiry with this contact and subject already exists.', { existingId: rows[0]?.id });
    }
    throw e;
  }
}));

app.get('/api/inquiries/:id', requireAuth, wrap(async (req, res) => {
  const id = parseId(req, res); if (id === null) return;
  const inquiry = await findAccessible(id, req.user);
  if (!inquiry) return fail(res, 404, 'NOT_FOUND', 'Inquiry not found.');
  res.json({ inquiry });
}));

app.patch('/api/inquiries/:id/status', requireAuth, wrap(async (req, res) => {
  const id = parseId(req, res); if (id === null) return;
  const p = statusChangeSchema.safeParse(req.body);
  if (!p.success) return fail(res, 400, 'VALIDATION', 'Invalid status change.', { fields: fieldErrors(p.error) });

  const current = await findAccessible(id, req.user);
  if (!current) return fail(res, 404, 'NOT_FOUND', 'Inquiry not found.');

  if (current.version !== p.data.version)
    return fail(res, 409, 'STALE', 'This inquiry was updated elsewhere. Showing the latest version.', { current });
  if (!canTransition(current.status, p.data.status))
    return fail(res, 422, 'INVALID_TRANSITION', `Cannot change from ${current.status} to ${p.data.status}.`, { current });

  // Prevent concurrent updates using the inquiry version.
  let rows;
  try {
    ({ rows } = await pool.query(
      `UPDATE inquiries SET status=$1, version=version+1, updated_at=now()
       WHERE id=$2 AND version=$3 RETURNING *`,
      [p.data.status, id, p.data.version]
    ));
  } catch (e) {
    // Prevent duplicate open inquiries when reopening.
    if (e.code === '23505') {
      const dup = await pool.query(
        `SELECT id FROM inquiries WHERE owner_id=$1 AND lower(contact)=lower($2) AND lower(subject)=lower($3)
         AND status<>'Resolved' AND id<>$4`,
        [current.owner_id, current.contact, current.subject, id]
      );
      return fail(res, 409, 'DUPLICATE',
        'Cannot reopen: another open inquiry with the same contact and subject already exists.',
        { existingId: dup.rows[0]?.id });
    }
    throw e;
  }

  if (!rows[0]) {
    const latest = await findAccessible(id, req.user);
    return fail(res, 409, 'STALE', 'This inquiry was updated elsewhere. Showing the latest version.', { current: latest });
  }
  res.json({ inquiry: { ...rows[0], owner_name: current.owner_name } });
}));

app.use('/api', (req, res) => fail(res, 404, 'NOT_FOUND', 'Route not found.'));
app.use((err, req, res, next) => {
  // Handle invalid JSON requests.
  if (err.type === 'entity.parse.failed') return fail(res, 400, 'BAD_JSON', 'Request body is not valid JSON.');
  if (err.status >= 400 && err.status < 500) return fail(res, err.status, 'BAD_REQUEST', 'Bad request.');
  console.error(err);
  fail(res, 500, 'SERVER_ERROR', 'Something went wrong. Please try again.');
});

export default app;
