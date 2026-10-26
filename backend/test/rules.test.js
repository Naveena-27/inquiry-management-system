import test from 'node:test';
import assert from 'node:assert/strict';
import { canTransition, inquirySchema } from '../src/rules.js';

test('status transitions: New cannot jump to Resolved, Resolved can be reopened', () => {
  assert.equal(canTransition('New', 'Resolved'), false);
  assert.equal(canTransition('New', 'In Progress'), true);
  assert.equal(canTransition('In Progress', 'Resolved'), true);
  assert.equal(canTransition('Resolved', 'In Progress'), true);
  assert.equal(canTransition('Resolved', 'New'), false);
});

test('inquiry validation rejects missing/invalid fields', () => {
  const bad = inquirySchema.safeParse({ customer_name: '', contact: 'abc', subject: 'x', description: 'short' });
  assert.equal(bad.success, false);
  const fields = new Set(bad.error.issues.map((i) => i.path[0]));
  for (const f of ['customer_name', 'contact', 'subject', 'description']) assert.ok(fields.has(f));
});

test('inquiry validation accepts email or phone contact', () => {
  const base = { customer_name: 'Nimal', subject: 'Delivery late', description: 'My order has not arrived yet.' };
  assert.ok(inquirySchema.safeParse({ ...base, contact: 'nimal@mail.com' }).success);
  assert.ok(inquirySchema.safeParse({ ...base, contact: '+94 77 123 4567' }).success);
});
