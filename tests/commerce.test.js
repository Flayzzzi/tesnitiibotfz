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
process.env.DB_PATH = '/tmp/opencode/tests-commerce.db';
process.env.BOT_TOKEN = 'test:token';
process.env.ADMIN_IDS = '111';

const { after, test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');

const db = require('../src/db');
const commerce = require('../src/db/commerce');
const users = require('../src/db/models/users');
const categories = require('../src/db/models/categories');
const products = require('../src/db/models/products');
const orders = require('../src/db/models/orders');
const transactions = require('../src/db/models/transactions');
const subscriptions = require('../src/db/models/notifications');
const { setBot, notifyStockSubscribers } = require('../src/notifications');

function fixture({ balance = 100, content = 'CODE-1' } = {}) {
  const userId = users.upsertUser({ tg_id: 900000 + Date.now() + Math.floor(Math.random() * 1000) });
  users.addBalance(userId, balance);
  const categoryId = categories.create({ name: `C-${Date.now()}-${Math.random()}` });
  const productId = products.create({
    category_id: categoryId,
    name: 'Auto item',
    price: 50,
    type: 'auto',
    content,
    stock: content ? content.split('\n').length : 0,
  });
  return { userId, categoryId, productId };
}

test('checkout rolls back delivery, order, balance, and purchase record when order creation fails', () => {
  const { userId, productId } = fixture();
  db.exec("CREATE TRIGGER reject_checkout BEFORE INSERT ON orders BEGIN SELECT RAISE(ABORT, 'reject checkout'); END;");
  try {
    assert.throws(() => commerce.purchase({ userId, productId }), /reject checkout/);
  } finally {
    db.exec('DROP TRIGGER reject_checkout');
  }

  assert.strictEqual(products.get(productId).content, 'CODE-1');
  assert.strictEqual(products.get(productId).stock, 1);
  assert.strictEqual(users.getUserById(userId).balance, 100);
  assert.strictEqual(orders.countByUser(userId), 0);
  assert.strictEqual(transactions.countByUser(userId, 'purchase'), 0);
});

test('refund rolls back order status and balance when its transaction record cannot be created', () => {
  const { userId, productId } = fixture({ balance: 0 });
  const orderId = orders.create({ user_id: userId, product_id: productId, price_paid: 50, status: 'delivered' });
  db.exec("CREATE TRIGGER reject_refund BEFORE INSERT ON transactions WHEN NEW.type = 'refund' BEGIN SELECT RAISE(ABORT, 'reject refund'); END;");
  try {
    assert.throws(() => commerce.refundOrder(orderId), /reject refund/);
  } finally {
    db.exec('DROP TRIGGER reject_refund');
  }

  assert.strictEqual(orders.get(orderId).status, 'delivered');
  assert.strictEqual(users.getUserById(userId).balance, 0);
  assert.strictEqual(transactions.countByUser(userId, 'refund'), 0);
});

test('top-up settlement permits only configured one-way state transitions', () => {
  const userId = users.upsertUser({ tg_id: 901000 + Date.now() });
  transactions.create({ user_id: userId, amount: 40, type: 'topup', ref_id: 'topup-pending', status: 'pending' });
  assert.strictEqual(commerce.settleTopup({ orderId: 'topup-pending', status: 'CONFIRMED', amount: 40 }).kind, 'credited');
  assert.strictEqual(users.getUserById(userId).balance, 40);
  assert.strictEqual(commerce.settleTopup({ orderId: 'topup-pending', status: 'CHARGEBACKED', amount: 40 }).kind, 'chargebacked');
  assert.strictEqual(users.getUserById(userId).balance, 0);
  assert.strictEqual(commerce.settleTopup({ orderId: 'topup-pending', status: 'CONFIRMED', amount: 40 }).kind, 'ignored');

  transactions.create({ user_id: userId, amount: 30, type: 'topup', ref_id: 'topup-canceled', status: 'pending' });
  assert.strictEqual(commerce.settleTopup({ orderId: 'topup-canceled', status: 'CANCELED', amount: 30 }).kind, 'failed');
  assert.strictEqual(commerce.settleTopup({ orderId: 'topup-canceled', status: 'CONFIRMED', amount: 30 }).kind, 'ignored');
  assert.strictEqual(users.getUserById(userId).balance, 0);

  assert.strictEqual(commerce.settleTopup({ orderId: 'topup-canceled', status: 'CONFIRMED', amount: Number.NaN }).kind, 'amount_mismatch');
});

test('top-up settlement cannot change a purchase transaction with the same reference', () => {
  const userId = users.upsertUser({ tg_id: 901500 + Date.now() });
  users.addBalance(userId, 100);
  transactions.create({ user_id: userId, amount: 50, type: 'purchase', ref_id: 'order-foreign', status: 'paid' });

  assert.strictEqual(commerce.settleTopup({ orderId: 'order-foreign', status: 'CHARGEBACKED', amount: 50 }).kind, 'not_found');
  assert.strictEqual(transactions.getByRef('order-foreign').status, 'paid');
  assert.strictEqual(users.getUserById(userId).balance, 100);
});

test('stock notification cleanup preserves subscriptions whose Telegram delivery fails', async () => {
  const { productId } = fixture();
  const sentUser = users.upsertUser({ tg_id: 902001 });
  const failedUser = users.upsertUser({ tg_id: 902002 });
  subscriptions.subscribe(sentUser, productId);
  subscriptions.subscribe(failedUser, productId);
  setBot({
    telegram: {
      sendMessage: async (tgId) => {
        if (tgId === 902002) throw new Error('blocked');
      },
    },
  });

  assert.strictEqual(await notifyStockSubscribers(productId, 'Auto item'), 1);
  assert.strictEqual(subscriptions.isSubscribed(sentUser, productId), false);
  assert.strictEqual(subscriptions.isSubscribed(failedUser, productId), true);
});

after(() => {
  for (const suffix of ['', '-shm', '-wal']) {
    try { fs.unlinkSync('/tmp/opencode/tests-commerce.db' + suffix); } catch {}
  }
});
