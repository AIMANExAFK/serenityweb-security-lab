import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

export function codeDigest(secret, purpose, userId, code) {
  if (!Buffer.isBuffer(secret) || secret.length < 32) throw new Error('Secret too short');
  return createHmac('sha256', secret)
    .update(JSON.stringify([purpose, userId, String(code)]))
    .digest();
}

export class Challenges {
  #secret;
  #records = new Map();
  constructor(secret, { now = Date.now, ttlMs = 600_000, maxAttempts = 5 } = {}) {
    if (!Buffer.isBuffer(secret) || secret.length < 32) throw new Error('Secret too short');
    if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0
      || !Number.isSafeInteger(maxAttempts) || maxAttempts <= 0) throw new Error('Invalid limits');
    this.#secret = Buffer.from(secret);
    this.now = now;
    this.ttlMs = ttlMs;
    this.maxAttempts = maxAttempts;
  }
  issue(userId, purpose = 'password-reset') {
    if (!userId || !purpose) throw new Error('Missing context');
    const code = String(randomInt(100_000, 1_000_000));
    this.#records.set(JSON.stringify([purpose, userId]), {
      hash: codeDigest(this.#secret, purpose, userId, code),
      expires: this.now() + this.ttlMs, attempts: 0,
    });
    // Delivery is the caller's responsibility; only the hash is retained here.
    return code;
  }
  consume(userId, code, purpose = 'password-reset') {
    const key = JSON.stringify([purpose, userId]);
    const record = this.#records.get(key);
    if (!record) return false;
    if (this.now() >= record.expires || record.attempts >= this.maxAttempts) {
      this.#records.delete(key);
      return false;
    }
    record.attempts += 1;
    const received = codeDigest(this.#secret, purpose, userId, code);
    const matches = timingSafeEqual(received, record.hash);
    if (matches || record.attempts >= this.maxAttempts) this.#records.delete(key);
    return matches;
  }
}

// Input claims must already have a verified signature, expiry, issuer and audience.
export async function authorizeAdmin(verifiedClaims, lookupUser) {
  if (!verifiedClaims?.userId || !Number.isSafeInteger(verifiedClaims.authVersion)) return false;
  const user = await lookupUser(verifiedClaims.userId);
  return !!user && user.active === true && user.role === 'admin'
    && user.authVersion === verifiedClaims.authVersion;
}

export function paymentSchedule(totalCents, count) {
  if (!Number.isSafeInteger(totalCents) || totalCents <= 0
    || ![1, 2, 3].includes(count) || count > totalCents) throw new Error('Invalid schedule');
  const base = Math.floor(totalCents / count);
  return Array.from({ length: count }, (_, index) => base + (index < totalCents % count ? 1 : 0));
}

// Signature verification of the raw webhook body must precede this function.
// The Set and object model are a single-process test double, not a database transaction.
export function acceptPaymentEvent(event, order, processedIds) {
  if (!event?.id || event.type !== 'checkout.session.completed' || event.paymentStatus !== 'paid'
    || !order?.id || event.orderId !== order.id || event.currency !== order.currency
    || !Number.isSafeInteger(order.amountCents) || order.amountCents <= 0
    || event.amountCents !== order.amountCents) throw new Error('Payment mismatch');
  if (processedIds.has(event.id)) return 'duplicate';
  processedIds.add(event.id);
  if (order.paid) return 'already-paid';
  order.paid = true;
  return 'accepted';
}
