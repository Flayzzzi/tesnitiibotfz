/*!
 * FZZ MARKET Bot (shopbot) — PROPRIETARY & CONFIDENTIAL
 * Author / Developer: t.me/@best_wrld
 * Copyright (c) 2026 t.me/@best_wrld. All rights reserved.
 *
 * PROVIDED FOR EVALUATION AND REVIEW ONLY.
 * Any use, reproduction, distribution, deployment, hosting, or creation of
 * derivative works, in whole or in part, is PROHIBITED without prior written
 * permission of the author. See LICENSE file.
 *
 * Licensed copy: FZZ MARKET  |  Copy-ID: F15D131F882B
 */
process.env.DB_PATH = '/tmp/opencode/tests-payments.db';
process.env.PLATEGA_MERCHANT_ID = 'merch-uuid-123';
process.env.PLATEGA_SECRET = 'secret-key';
process.env.PLATEGA_API_URL = 'http://localhost:3199/transaction/process';
process.env.BOT_TOKEN = 'test:token';
process.env.ADMIN_IDS = '111';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const express = require('express');
const http = require('http');
const fs = require('fs');

const platega = require('../src/payments/platega');
const users = require('../src/db/models/users');
const transactions = require('../src/db/models/transactions');

// --- fake Platega invoice server -------------------------------------------------
let invoiceServer;
let lastInvoiceReq = null;
before(async () => {
  invoiceServer = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      lastInvoiceReq = { url: req.url, headers: req.headers, body: JSON.parse(body || '{}') };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ paymentMethod: 'SBPQR', transactionId: 't1', redirect: 'https://pay.example/abc', status: 'PENDING', merchantId: 'm1', usdtRate: 93.4 }));
    });
  });
  await new Promise((r) => invoiceServer.listen(3199, () => r()));
});

// --- webhook server --------------------------------------------------------------
const sent = [];
const bot = { telegram: { sendMessage: async (id, text, opts) => { sent.push({ id, text, opts }); return {}; } } };
const app = express();
app.use(express.json());
app.use(require('../src/payments/webhook')(bot));
let webhookServer;
let base;
before(async () => {
  webhookServer = app.listen(0);
  await new Promise((r) => webhookServer.once('listening', () => r()));
  base = `http://localhost:${webhookServer.address().port}/webhook/platega`;
});

after(() => {
  invoiceServer.close();
  webhookServer.close();
  for (const f of ['/tmp/opencode/tests-payments.db', '-shm', '-wal']) {
    try { fs.unlinkSync('/tmp/opencode/tests-payments.db' + (f.startsWith('-') ? f : '')); } catch {}
  }
});

function cb(body) {
  return fetch(base, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-MerchantId': 'merch-uuid-123', 'X-Secret': 'secret-key' },
    body: JSON.stringify(body),
  });
}

// --- verifyWebhook ---------------------------------------------------------------
test('verifyWebhook accepts valid merchant+secret and known statuses', () => {
  const h = { 'x-merchantid': 'merch-uuid-123', 'x-secret': 'secret-key' };
  assert.ok(platega.verifyWebhook(h, { status: 'CONFIRMED' }));
  assert.ok(platega.verifyWebhook(h, { status: 'canceled' }));
  assert.ok(platega.verifyWebhook(h, { status: 'CHARGEBACKED' }));
});

test('verifyWebhook rejects wrong secret, wrong merchant, unknown status', () => {
  assert.ok(!platega.verifyWebhook({ 'x-merchantid': 'merch-uuid-123', 'x-secret': 'wrong' }, { status: 'CONFIRMED' }));
  assert.ok(!platega.verifyWebhook({ 'x-merchantid': 'x', 'x-secret': 'secret-key' }, { status: 'CONFIRMED' }));
  assert.ok(!platega.verifyWebhook({ 'x-merchantid': 'merch-uuid-123', 'x-secret': 'secret-key' }, { status: 'WEIRD' }));
});

// --- createInvoice ---------------------------------------------------------------
test('createInvoice sends correct headers/body and returns redirect url', async () => {
  const inv = await platega.createInvoice({ amount: 150, orderId: '1f9a0000-0000-4000-8000-000000000001' });
  assert.strictEqual(inv.url, 'https://pay.example/abc');
  assert.strictEqual(lastInvoiceReq.headers['x-merchantid'], 'merch-uuid-123');
  assert.strictEqual(lastInvoiceReq.headers['x-secret'], 'secret-key');
  assert.strictEqual(lastInvoiceReq.body.paymentMethod, 2);
  assert.strictEqual(lastInvoiceReq.body.id, '1f9a0000-0000-4000-8000-000000000001');
  assert.strictEqual(lastInvoiceReq.body.paymentDetails.amount, 150);
  assert.strictEqual(lastInvoiceReq.body.paymentDetails.currency, 'RUB');
  assert.strictEqual(lastInvoiceReq.body.payload, '1f9a0000-0000-4000-8000-000000000001');
});

test('createInvoice throws when platega not configured', async () => {
  const saved = { m: platega ? null : null };
  const oldM = process.env.PLATEGA_MERCHANT_ID;
  process.env.PLATEGA_MERCHANT_ID = '';
  // force re-read by clearing cached values
  const cfg = require('../src/config');
  const old = cfg.PLATEGA_MERCHANT_ID;
  cfg.PLATEGA_MERCHANT_ID = undefined;
  await assert.rejects(() => platega.createInvoice({ amount: 1, orderId: 'x' }), /not configured/);
  cfg.PLATEGA_MERCHANT_ID = old;
  process.env.PLATEGA_MERCHANT_ID = oldM;
});

// --- webhook end-to-end ----------------------------------------------------------
function newUser(tgId) {
  return users.upsertUser({ tg_id: tgId, username: `u${tgId}`, first_name: 'U' });
}

test('CONFIRMED credits balance and notifies, replay is idempotent', async () => {
  sent.length = 0;
  const uid = newUser(700001);
  const ref = '2a9b0000-0000-4000-8000-000000000002';
  transactions.create({ user_id: uid, amount: 100, type: 'topup', ref_id: ref, status: 'pending' });

  const r1 = await cb({ id: ref, payload: ref, amount: 100, currency: 'RUB', status: 'CONFIRMED' });
  assert.strictEqual(r1.status, 200);
  assert.strictEqual(users.getUserById(uid).balance, 100);
  assert.strictEqual(transactions.getByRef(ref).status, 'paid');
  assert.strictEqual(sent.length, 1);

  const r2 = await cb({ id: ref, payload: ref, amount: 100, currency: 'RUB', status: 'CONFIRMED' });
  assert.strictEqual(r2.status, 200);
  assert.strictEqual(users.getUserById(uid).balance, 100, 'no double credit');
  assert.strictEqual(sent.length, 1, 'no duplicate notify');
});

test('pending + amount mismatch returns 400 and does not credit', async () => {
  const uid = newUser(700002);
  const ref = '3b9c0000-0000-4000-8000-000000000003';
  transactions.create({ user_id: uid, amount: 100, type: 'topup', ref_id: ref, status: 'pending' });
  const r = await cb({ id: ref, payload: ref, amount: 999, currency: 'RUB', status: 'CONFIRMED' });
  assert.strictEqual(r.status, 400);
  assert.strictEqual(users.getUserById(uid).balance, 0);
  assert.strictEqual(transactions.getByRef(ref).status, 'pending');
});

test('missing webhook amount returns 400 and does not credit', async () => {
  const uid = newUser(700005);
  const ref = '3c9d0000-0000-4000-8000-000000000003';
  transactions.create({ user_id: uid, amount: 100, type: 'topup', ref_id: ref, status: 'pending' });
  const r = await cb({ id: ref, payload: ref, status: 'CONFIRMED' });
  assert.strictEqual(r.status, 400);
  assert.strictEqual(users.getUserById(uid).balance, 0);
  assert.strictEqual(transactions.getByRef(ref).status, 'pending');
});

test('CANCELED marks pending failed, does nothing to paid', async () => {
  sent.length = 0;
  const uid = newUser(700003);
  const ref = '4c9d0000-0000-4000-8000-000000000004';
  transactions.create({ user_id: uid, amount: 50, type: 'topup', ref_id: ref, status: 'pending' });
  const r = await cb({ id: ref, payload: ref, amount: 50, currency: 'RUB', status: 'CANCELED' });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(transactions.getByRef(ref).status, 'failed');

  const ref2 = '5d9e0000-0000-4000-8000-000000000005';
  transactions.create({ user_id: uid, amount: 50, type: 'topup', ref_id: ref2, status: 'paid' });
  const r2 = await cb({ id: ref2, payload: ref2, amount: 50, currency: 'RUB', status: 'CANCELED' });
  assert.strictEqual(r2.status, 200);
  assert.strictEqual(transactions.getByRef(ref2).status, 'paid', 'paid tx must not be failed by CANCELED');

  const r3 = await cb({ id: ref, payload: ref, amount: 50, currency: 'RUB', status: 'CONFIRMED' });
  assert.strictEqual(r3.status, 200);
  assert.strictEqual(transactions.getByRef(ref).status, 'failed', 'failed tx must not be credited by a stale CONFIRMED');
  assert.strictEqual(users.getUserById(uid).balance, 0);
});

test('CHARGEBACKED after paid deducts balance and marks refunded', async () => {
  sent.length = 0;
  const uid = newUser(700004);
  users.addBalance(uid, 200);
  const ref = '6e9f0000-0000-4000-8000-000000000006';
  transactions.create({ user_id: uid, amount: 100, type: 'topup', ref_id: ref, status: 'paid' });
  const r = await cb({ id: ref, payload: ref, amount: 100, currency: 'RUB', status: 'CHARGEBACKED' });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(users.getUserById(uid).balance, 100, 'balance reduced by 100');
  assert.strictEqual(transactions.getByRef(ref).status, 'refunded');
});

test('webhook rejects invalid credentials', async () => {
  const r = await fetch(base, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-MerchantId': 'merch-uuid-123', 'X-Secret': 'nope' },
    body: JSON.stringify({ id: 'x', status: 'CONFIRMED' }),
  });
  assert.strictEqual(r.status, 403);
});

test('webhook rejects unknown order with 404', async () => {
  const r = await fetch(base, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-MerchantId': 'merch-uuid-123', 'X-Secret': 'secret-key' },
    body: JSON.stringify({ id: 'unknown-ref', payload: 'unknown-ref', amount: 1, status: 'CONFIRMED' }),
  });
  assert.strictEqual(r.status, 404);
});
