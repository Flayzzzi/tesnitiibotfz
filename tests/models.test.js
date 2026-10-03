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
process.env.DB_PATH = '/tmp/opencode/tests-models.db';
process.env.BOT_TOKEN = 'test:token';
process.env.ADMIN_IDS = '111';

const { test, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');

const users = require('../src/db/models/users');
const orders = require('../src/db/models/orders');
const products = require('../src/db/models/products');
const categories = require('../src/db/models/categories');
const transactions = require('../src/db/models/transactions');
const notifications = require('../src/db/models/notifications');
const config = require('../src/config');

after(() => {
  for (const suffix of ['', '-shm', '-wal']) {
    try { fs.unlinkSync('/tmp/opencode/tests-models.db' + suffix); } catch {}
  }
});

test('app loads without Platega configured', () => {
  assert.ok(!config.PLATEGA_MERCHANT_ID, 'merchant id absent');
  assert.ok(!config.PLATEGA_SECRET, 'secret absent');
  assert.doesNotThrow(() => require('../src/bot'));
});

test('users: upsert, balance add/deduct, notify toggle, spent', () => {
  const uid = users.upsertUser({ tg_id: 800001, username: 'a', first_name: 'A' });
  const same = users.upsertUser({ tg_id: 800001, username: 'b' });
  assert.strictEqual(same, uid, 'upsert returns existing id');
  users.addBalance(uid, 100);
  users.addBalance(uid, 50.55);
  assert.strictEqual(users.getUserById(uid).balance, 150.55);
  users.deductBalance(uid, 50);
  assert.strictEqual(users.getUserById(uid).balance, 100.55);
  users.updateNotify(uid, 0);
  assert.strictEqual(users.getUserByTg(800001).notify_stock, 0);
  transactions.create({ user_id: uid, amount: 30, type: 'purchase', ref_id: 'o-1', status: 'paid' });
  transactions.create({ user_id: uid, amount: 30, type: 'purchase', ref_id: 'o-2', status: 'failed' });
  assert.strictEqual(users.spent(uid), 30);
});

test('categories: create, move, visibility, remove', () => {
  const a = categories.create({ name: 'Игры', emoji_key: 'star' });
  const b = categories.create({ name: 'YouTube', emoji_key: null });
  assert.ok(categories.move(a, 1));
  const list = categories.all();
  assert.strictEqual(list[0].id, b);
  assert.strictEqual(list[1].id, a);
  categories.update(a, { visible: 0 });
  assert.strictEqual(categories.all(true).length, 1);
  categories.remove(b);
  assert.strictEqual(categories.get(b), undefined);
  categories.update(a, { visible: 1 });
});

test('products: create, get, content lines, pop, addStock, remove', () => {
  const cat = categories.create({ name: 'Тест' });
  const pid = products.create({
    category_id: cat,
    name: 'Код Steam',
    description: 'тест',
    price: 90,
    type: 'auto',
    content: 'AAA\nBBB\nCCC',
    stock: 3,
  });
  const p = products.get(pid);
  assert.strictEqual(p.name, 'Код Steam');
  assert.strictEqual(p.category_name, 'Тест');
  assert.strictEqual(products.contentLines(p).length, 3);

  assert.strictEqual(products.popContentLine(pid), 'AAA');
  assert.strictEqual(products.get(pid).stock, 2);

  const wasZero = products.addStock(pid, ['DDD']);
  assert.strictEqual(wasZero, false, 'stock was not zero');
  assert.strictEqual(products.get(pid).stock, 3);

  const pid2 = products.create({ category_id: cat, name: 'Пусто', price: 1, type: 'auto', content: null, stock: 0 });
  assert.strictEqual(products.addStock(pid2, ['X']), true, 'from zero returns wasZero');
  assert.strictEqual(products.get(pid2).stock, 1);

  products.remove(pid);
  assert.strictEqual(products.get(pid), undefined);
  products.remove(pid2);
  categories.remove(cat);
});

test('notifications: subscribe, dedupe, byProduct, clear', () => {
  const uid = users.upsertUser({ tg_id: 800002 });
  const cat = categories.create({ name: 'N' });
  const pid = products.create({ category_id: cat, name: 'X', price: 1 });
  notifications.subscribe(uid, pid);
  notifications.subscribe(uid, pid);
  assert.strictEqual(notifications.byProduct(pid).length, 1);
  notifications.clearProduct(pid);
  assert.strictEqual(notifications.byProduct(pid).length, 0);
  products.remove(pid);
  categories.remove(cat);
});

test('orders: create with delivery, updateDelivery, refund status', () => {
  const uid = users.upsertUser({ tg_id: 800003 });
  const id = orders.create({ user_id: uid, product_id: null, price_paid: 50, status: 'paid', delivery: '#SECRET-1' });
  assert.strictEqual(orders.get(id).delivery, '#SECRET-1');

  orders.updateDelivery(id, '#NEW-SECRET');
  const o = orders.get(id);
  assert.strictEqual(o.delivery, '#NEW-SECRET');
  assert.strictEqual(o.status, 'delivered');
  assert.ok(orders.revenue() >= 50, 'delivered order counts to revenue');

  orders.updateStatus(id, 'refunded');
  assert.strictEqual(orders.get(id).status, 'refunded');
  assert.strictEqual(orders.revenue(), 0, 'refunded order excluded from revenue');
});