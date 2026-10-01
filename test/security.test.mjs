import test from 'node:test';
import assert from 'node:assert/strict';
import { Challenges, codeDigest, authorizeAdmin, paymentSchedule, acceptPaymentEvent } from '../src/security.mjs';

const secret = Buffer.alloc(32, 0x42); // Public, synthetic test fixture; never a production secret.
test('a challenge is six digits and can be consumed only once', () => {
  const store = new Challenges(secret);
  const code = store.issue('demo-user');
  assert.match(code, /^\d{6}$/);
  assert.equal(store.consume('demo-user', code), true);
  assert.equal(store.consume('demo-user', code), false);
});
test('expiry includes the exact boundary', () => {
  let now = 0;
  const store = new Challenges(secret, { now: () => now, ttlMs: 100 });
  const code = store.issue('demo-user');
  now = 100;
  assert.equal(store.consume('demo-user', code), false);
});
test('attempt limit locks even a subsequently correct code', () => {
  const store = new Challenges(secret, { maxAttempts: 2 });
  const code = store.issue('demo-user');
  assert.equal(store.consume('demo-user', 'not-a-code'), false);
  assert.equal(store.consume('demo-user', 'not-a-code'), false);
  assert.equal(store.consume('demo-user', code), false);
});
test('context binds a digest to both purpose and user', () => {
  const a = codeDigest(secret, 'password-reset', 'demo-a', '123456');
  assert.notDeepEqual(a, codeDigest(secret, 'email-verification', 'demo-a', '123456'));
  assert.notDeepEqual(a, codeDigest(secret, 'password-reset', 'demo-b', '123456'));
});
test('unknown context is rejected without consuming another challenge', () => {
  const store = new Challenges(secret);
  const code = store.issue('demo-a');
  assert.equal(store.consume('demo-b', code), false);
  assert.equal(store.consume('demo-a', code, 'email-verification'), false);
  assert.equal(store.consume('demo-a', code), true);
});
test('a new challenge replaces the previous stored digest', () => {
  const store = new Challenges(secret);
  store.issue('demo-a');
  const second = store.issue('demo-a');
  assert.equal(store.consume('demo-a', second), true);
  assert.equal(store.consume('demo-a', second), false);
});
test('limits and secret are validated', () => {
  assert.throws(() => new Challenges(Buffer.alloc(1)));
  assert.throws(() => new Challenges(secret, { ttlMs: 0 }));
});
test('current account role and session version control access', async () => {
  const claims = { userId: 'demo-admin', authVersion: 3 };
  const current = { active: true, role: 'admin', authVersion: 3 };
  assert.equal(await authorizeAdmin(claims, async () => current), true);
  for (const user of [null, { ...current, active: false }, { ...current, role: 'client' }, { ...current, authVersion: 4 }]) {
    assert.equal(await authorizeAdmin(claims, async () => user), false);
  }
  assert.equal(await authorizeAdmin(null, async () => current), false);
});
test('a lookup failure does not grant access', async () => {
  await assert.rejects(authorizeAdmin({ userId: 'demo', authVersion: 1 }, async () => { throw new Error('offline'); }));
});
test('integer cent schedules preserve the complete total', () => {
  for (const amount of [3, 101, 10001, 99999]) {
    for (const count of [1, 2, 3]) {
      const schedule = paymentSchedule(amount, count);
      assert.equal(schedule.reduce((sum, value) => sum + value, 0), amount);
      assert.ok(schedule.every(value => Number.isInteger(value) && value > 0));
    }
  }
  for (const amount of [0, -1, NaN, 1.5, Infinity]) assert.throws(() => paymentSchedule(amount, 2));
  assert.throws(() => paymentSchedule(100, 4));
});
const order = () => ({ id: 'demo-order', currency: 'eur', amountCents: 10001, paid: false });
const event = () => ({ id: 'demo-event', type: 'checkout.session.completed', paymentStatus: 'paid', orderId: 'demo-order', currency: 'eur', amountCents: 10001 });
test('payment validation precedes changes to order state', () => {
  for (const mismatch of [{ amountCents: 1 }, { currency: 'usd' }, { orderId: 'other' }, { paymentStatus: 'unpaid' }, { type: 'other' }]) {
    const target = order(); const ids = new Set();
    assert.throws(() => acceptPaymentEvent({ ...event(), ...mismatch }, target, ids));
    assert.equal(target.paid, false); assert.equal(ids.size, 0);
  }
});
test('replayed events and a second event cannot pay an order twice', () => {
  const target = order(); const ids = new Set();
  assert.equal(acceptPaymentEvent(event(), target, ids), 'accepted');
  assert.equal(acceptPaymentEvent(event(), target, ids), 'duplicate');
  assert.equal(acceptPaymentEvent({ ...event(), id: 'demo-event-2' }, target, ids), 'already-paid');
});
