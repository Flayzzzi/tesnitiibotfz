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
process.env.DB_PATH = '/tmp/opencode/tests-admin.db';
process.env.BOT_TOKEN = 'test:token';
process.env.ADMIN_IDS = '111';

const { test, after, before } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');

const users = require('../src/db/models/users');
const products = require('../src/db/models/products');
const categories = require('../src/db/models/categories');
const orders = require('../src/db/models/orders');
const { makeCtx } = require('./helpers');

const adminIndex = require('../src/menus/admin/index');
const adminCategories = require('../src/menus/admin/categories');
const adminProducts = require('../src/menus/admin/products');
const adminOrders = require('../src/menus/admin/orders');
const adminEditMsg = require('../src/menus/admin/edit_message');

let catId;
let manualPid;
let uid;

before(() => {
  catId = categories.create({ name: 'Игры', emoji_key: 'star' });
  manualPid = products.create({
    category_id: catId,
    name: 'Аккаунт (ручная выдача)',
    description: 'Выдача админом',
    price: 250,
    type: 'manual',
    content: null,
    stock: 0,
  });
  uid = users.upsertUser({ tg_id: 111, username: 'u111', first_name: 'Tester' });
  users.addBalance(uid, 300);
});

after(() => {
  for (const suffix of ['', '-shm', '-wal']) {
    try { fs.unlinkSync('/tmp/opencode/tests-admin.db' + suffix); } catch {}
  }
});

function lastMsg(ctx) {
  const m = ctx.sent[ctx.sent.length - 1];
  assert.ok(m, 'expected a message');
  return m;
}

async function sendCategoryText(ctx, text) {
  ctx.message = { text };
  return adminCategories.onMessage(ctx);
}

async function sendProductText(ctx, text) {
  ctx.message = { text };
  return adminProducts.onMessage(ctx);
}

test('admin panels render without a payment provider configured', async () => {
  const ctx = makeCtx();
  await adminIndex.show(ctx);
  assert.match(lastMsg(ctx).text, /Админ-панель/);

  await adminCategories.show(ctx, 1);
  assert.match(lastMsg(ctx).text, /Категории/);

  await adminProducts.show(ctx, 1);
  assert.match(lastMsg(ctx).text, /Товары/);

  await adminOrders.show(ctx, 'all', 1);
  assert.match(lastMsg(ctx).text, /Заказы/);
});

test('admin creates a category and products with no Platega env', async () => {
  // add category
  let ctx = makeCtx();
  await adminCategories.startAdd(ctx);
  assert.strictEqual(ctx.session.adminWizard.flow, 'addCategory');
  await sendCategoryText(ctx, 'YouTube');
  await sendCategoryText(ctx, '—');
  const newCat = categories.all().find((c) => c.name === 'YouTube');
  assert.ok(newCat, 'category created');

  // add product (wizard through all steps)
  ctx = makeCtx();
  await adminProducts.startAdd(ctx);
  assert.strictEqual(ctx.session.adminWizard.flow, 'addProduct');
  await adminProducts.setCategory(ctx, newCat.id);
  await sendProductText(ctx, 'Ютуб Премиум 1 мес');
  await sendProductText(ctx, 'Официальный премиум');
  await sendProductText(ctx, '199,99');
  await sendProductText(ctx, '—');
  await adminProducts.setType(ctx, 'auto');
  await sendProductText(ctx, 'LOG1\nLOG2\nLOG3');
  await adminProducts.setVisibility(ctx, 1);
  const p = products.all({ categoryId: newCat.id }).find((x) => x.name === 'Ютуб Премиум 1 мес');
  assert.ok(p, 'product created');
  assert.strictEqual(p.price, 199.99);
  assert.strictEqual(p.type, 'auto');
  assert.strictEqual(p.stock, 3);

  // manual product + content edit
  ctx = makeCtx();
  await adminProducts.startAdd(ctx);
  await adminProducts.setCategory(ctx, newCat.id);
  await sendProductText(ctx, 'Аккаунт (ручная)');
  await sendProductText(ctx, 'Выдача админом');
  await sendProductText(ctx, '500');
  await sendProductText(ctx, '—');
  await adminProducts.setType(ctx, 'manual');
  await adminProducts.setVisibility(ctx, 1);
  const manual = products.all({ categoryId: newCat.id }).find((x) => x.name === 'Аккаунт (ручная)');
  assert.ok(manual);
  assert.strictEqual(manual.type, 'manual');
  assert.strictEqual(manual.stock, 0);

  // edit flow: change name
  ctx = makeCtx();
  await adminProducts.showEditMenu(ctx, p.id);
  await adminProducts.startFieldEdit(ctx, p.id, 'name');
  await adminProducts.onEditText(ctx, 'Ютуб Премиум 1 мес (изм)');
  assert.strictEqual(products.get(p.id).name, 'Ютуб Премиум 1 мес (изм)');
});

test('admin delivers a manual order through the wizard and refunds it', async () => {
  const orderId = orders.create({
    user_id: uid,
    product_id: manualPid,
    price_paid: 250,
    status: 'paid',
    delivery: null,
  });

  // deliver wizard captures content
  const ctx = makeCtx();
  await adminOrders.showDetail(ctx, orderId);
  assert.match(lastMsg(ctx).text, /Заказ #/);
  assert.match(JSON.stringify(lastMsg(ctx).opts.reply_markup), /Выдать товар/);

  await adminOrders.deliver(ctx, orderId);
  assert.strictEqual(ctx.session.adminWizard.flow, 'deliverOrder');
  await adminOrders.onDeliverText(ctx, 'user:pass@steam');
  let o = orders.get(orderId);
  assert.strictEqual(o.status, 'delivered');
  assert.strictEqual(o.delivery, 'user:pass@steam');
  assert.strictEqual(users.getUserById(uid).balance, 300, 'no balance change on delivery');

  // refund after deliver -> balance restored
  await adminOrders.doRefund(ctx, orderId);
  o = orders.get(orderId);
  assert.strictEqual(o.status, 'refunded');
  assert.strictEqual(users.getUserById(uid).balance, 550, 'refunded amount returned');
  const tx = require('../src/db/models/transactions').getByRef(`order-${orderId}`);
  assert.strictEqual(tx.type, 'refund');
});

test('admin main-menu editor accepts a Telegram photo as the banner', async () => {
  const ctx = makeCtx();
  ctx.session.adminWizard = { flow: 'edit_menu', view: 'main', step: 'image', buttons: [] };
  ctx.message = { photo: [{ file_id: 'banner-small' }, { file_id: 'banner-large' }] };

  assert.strictEqual(await adminEditMsg.handlePhoto(ctx), true);
  assert.strictEqual(ctx.session.adminWizard.imageUrl, 'tgfile:banner-large');
  assert.strictEqual(ctx.session.adminWizard.step, 'button_menu');
});
