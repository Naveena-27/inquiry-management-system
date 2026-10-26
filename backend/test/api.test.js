import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import { pool } from '../src/db.js';

test('GET /api/inquiries rejects unauthenticated requests with 401', async () => {
  const server = app.listen(0);

  try {
    const { port } = server.address();

    const response = await fetch(
      `http://127.0.0.1:${port}/api/inquiries`
    );

    assert.equal(response.status, 401);

    const body = await response.json();
    assert.equal(body.error.code, 'UNAUTHENTICATED');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});


test('staff cannot access another staff member inquiry', async () => {
  const server = app.listen(0);

  try {
    const { port } = server.address();
    const base = `http://127.0.0.1:${port}`;

    const login1 = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'staff1@example.com',
        password: 'password123',
      }),
    });

    assert.equal(login1.status, 200);

    const cookie1 = login1.headers.get('set-cookie');

   const unique = Date.now();
   const created = await fetch(`${base}/api/inquiries`, {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
       Cookie: cookie1,
     },
     body: JSON.stringify({
       customer_name: 'Access Test Customer',
       contact: `access-${unique}@example.com`,
       subject: `Access control test ${unique}`,
       description: 'Inquiry created to test staff ownership access.',
     }),
   });

    assert.equal(created.status, 201);

    const createdBody = await created.json();
    const inquiryId = createdBody.inquiry.id;

    const login2 = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'staff2@example.com',
        password: 'password123',
      }),
    });

    assert.equal(login2.status, 200);

    const cookie2 = login2.headers.get('set-cookie');
    const response = await fetch(`${base}/api/inquiries/${inquiryId}`, {
      headers: { Cookie: cookie2 },
    });

    assert.equal(response.status, 404);

    const body = await response.json();
    assert.equal(body.error.code, 'NOT_FOUND');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});


test('invalid inquiry id returns 400 instead of a server error', async () => {
  const server = app.listen(0);

  try {
    const { port } = server.address();
    const base = `http://127.0.0.1:${port}`;
    const login = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'staff1@example.com',
        password: 'password123',
      }),
    });

    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie');

    const response = await fetch(
      `${base}/api/inquiries/999999999999999999`,
      {
        headers: { Cookie: cookie },
      }
    );

    assert.equal(response.status, 400);

    const body = await response.json();
    assert.equal(body.error.code, 'INVALID_ID');
  } finally { await new Promise((resolve) => server.close(resolve));}
});

test('stale inquiry version returns 409 with the latest data', async () => {
  const server = app.listen(0);

  try {
    const { port } = server.address();
    const base = `http://127.0.0.1:${port}`;

    const login = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'staff1@example.com',
        password: 'password123',
      }),
    });

    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie');
    const unique = Date.now();

    const created = await fetch(`${base}/api/inquiries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
      },
      body: JSON.stringify({
        customer_name: 'Stale Test Customer',
        contact: `stale-${unique}@example.com`,
        subject: `Stale version test ${unique}`,
        description: 'Inquiry created to test stale version handling.',
      }),
    });

    assert.equal(created.status, 201);

    const createdBody = await created.json();
    const inquiry = createdBody.inquiry;

    // First update succeeds: version 1 -> version 2
    const firstUpdate = await fetch(
      `${base}/api/inquiries/${inquiry.id}/status`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: cookie,
        },
        body: JSON.stringify({
          status: 'In Progress',
          version: inquiry.version,
        }),
      }
    );

    assert.equal(firstUpdate.status, 200);

    // Simulate another tab still using the old version
    const staleUpdate = await fetch(
      `${base}/api/inquiries/${inquiry.id}/status`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: cookie,
        },
        body: JSON.stringify({
          status: 'In Progress',
          version: inquiry.version,
        }),
      }
    );

    assert.equal(staleUpdate.status, 409);

    const body = await staleUpdate.json();
    assert.equal(body.error.code, 'STALE');
    assert.equal(body.error.current.version, inquiry.version + 1);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});


test('New inquiry cannot jump directly to Resolved', async () => {
  const server = app.listen(0);

  try {
    const { port } = server.address();
    const base = `http://127.0.0.1:${port}`;

    const login = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'staff1@example.com',
        password: 'password123',
      }),
    });

    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie');
    const unique = Date.now();

    const created = await fetch(`${base}/api/inquiries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
      },
      body: JSON.stringify({
        customer_name: 'Transition Test Customer',
        contact: `transition-${unique}@example.com`,
        subject: `Transition test ${unique}`,
        description: 'Inquiry created to test invalid status transitions.',
      }),
    });

    assert.equal(created.status, 201);

    const createdBody = await created.json();
    const inquiry = createdBody.inquiry;

    // New -> Resolved is not allowed
    const response = await fetch(
      `${base}/api/inquiries/${inquiry.id}/status`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: cookie,
        },
        body: JSON.stringify({
          status: 'Resolved',
          version: inquiry.version,
        }),
      }
    );

    assert.equal(response.status, 422);

    const body = await response.json();
    assert.equal(body.error.code, 'INVALID_TRANSITION');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

after(async () => {
  await pool.query(`
    DELETE FROM inquiries
    WHERE subject LIKE 'Access control test %'
       OR subject LIKE 'Stale version test %'
       OR subject LIKE 'Transition test %'
  `);
});