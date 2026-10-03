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
process.env.DB_PATH = '/tmp/opencode/tests-menus.db';
process.env.BOT_TOKEN = 'test:token';
process.env.ADMIN_IDS = '111';

const { test, after, before } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');

const users = require('../src/db/models/users');
const products = require('../src/db/models/products');
const categories = require('../src/db/models/categories');
const orders = require('../src/db/models/orders');
const { makeCtx, asCallback } = require('./helpers');

const main = require('../src/menus/main');
const catalog = require('../src/menus/catalog');
const profile = require('../src/menus/profile');
const about = require('../src/menus/about');
const support = require('../src/menus/support');

let catId;
let autoPid;
let manualPid;
let uid;
let autoOrderId;

before(() => {
  catId = categories.create({ name: 'Игры', emoji_key: 'star' });
  autoPid = products.create({
    category_id: catId,
    name: 'Код Steam 100P',
    description: 'Пополнение Steam',
    price: 90,
    type: 'auto',
    content: 'AAA-CODE\nBBB-CODE',
    stock: 2,
  });
  manualPid = products.create({
    category_id: catId,
    name: 'Аккаунт Dota2',
    description: 'Выдача вручную',
    price: 250,
    type: 'manual',
    content: null,
    stock: 0,
  });
  uid = users.upsertUser({ tg_id: 111, username: 'u111', first_name: 'Tester' });
  users.addBalance(uid, 500);
});

after(() => {
  for (const suffix of ['', '-shm', '-wal']) {
    try { fs.unlinkSync('/tmp/opencode/tests-menus.db' + suffix); } catch {}
  }
});

function findSent(ctx, predicate) {
  let m;
  if (typeof predicate === 'function') {
    for (let i = ctx.sent.length - 1; i >= 0; i--) {
      if (predicate(ctx.sent[i])) { m = ctx.sent[i]; break; }
    }
  }
  m = m || ctx.sent[ctx.sent.length - 1];
  assert.ok(m, 'expected a message');
  return m;
}

test('main menu shows balance and buttons', async () => {
  const ctx = makeCtx();
  ctx.replyWithPhoto = async (photo, opts) => {
    ctx.sent.push({ type: 'photo', photo, opts });
    return { message_id: ctx.sent.length };
  };
  await main.show(ctx);
  const m = findSent(ctx, (x) => x.type === 'photo');
  assert.match(m.opts.caption, /Добро пожаловать в FZZ MARKET, @u111/);
  assert.strictEqual(m.opts.parse_mode, 'MarkdownV2');
  const markup = JSON.stringify(m.opts.reply_markup);
  assert.match(markup, /Каталог/);
  assert.match(markup, /Пополнить/);
  assert.match(markup, /Профиль/);
  assert.match(markup, /О магазине/);
  assert.match(markup, /Поддержка/);
});

test('catalog shows categories gracefully', async () => {
  const ctx = makeCtx();
  await catalog.showCategories(ctx);
  const m = findSent(ctx, (x) => x.type === 'reply');
  assert.match(m.text, /Каталог/);
  assert.match(JSON.stringify(m.opts.reply_markup), /Игры/);
});

test('catalog shows products list + product cards with stock/manual labels', async () => {
  let ctx = makeCtx();
  await catalog.showProducts(ctx, catId, 1);
  assert.match(findSent(ctx).text, /Товары/);
  assert.match(findSent(ctx).text, /Выбери товар/);

  ctx = makeCtx();
  await catalog.showProduct(ctx, autoPid);
  let m = findSent(ctx, (x) => x.type === 'reply');
  assert.match(m.text, /Код Steam 100P/);
  assert.match(m.text, /В наличии: <b>2 шт\./);

  ctx = makeCtx();
  await catalog.showProduct(ctx, manualPid);
  m = findSent(ctx, (x) => x.type === 'reply');
  assert.match(m.text, /Выдача вручную/);
});

test('purchase auto: delivered order stores content and deducts balance', async () => {
  const ctx = makeCtx();
  await catalog.handleBuy(ctx, autoPid);
  const buyReply = findSent(ctx, (x) => x.type === 'reply');
  assert.match(JSON.stringify(buyReply.opts.reply_markup), /Подтвердить/);

  await catalog.handleConfirm(ctx, autoPid);
  const m = findSent(ctx, (x) => x.type === 'reply');
  assert.match(m.text, /Заказ #\d+ оплачен/);
  assert.match(m.text, /AAA-CODE/, 'delivered code shown');

  const o = orders.listByUser(uid)[0];
  autoOrderId = o.id;
  assert.strictEqual(o.status, 'delivered');
  assert.strictEqual(o.delivery, 'AAA-CODE');
  assert.strictEqual(products.get(autoPid).stock, 1, 'stock decremented');
  assert.strictEqual(users.getUserById(uid).balance, 410, 'balance deducted');
});

test('purchase manual: status paid, admin notified, no double spend', async () => {
  const ctx = makeCtx();
  await catalog.handleBuy(ctx, manualPid);
  await catalog.handleConfirm(ctx, manualPid);
  const reply = findSent(ctx, (x) => x.type === 'reply' && /выдан администратором/.test(x.text));
  assert.ok(reply, 'manual order message shown');
  const dm = findSent(ctx, (x) => x.type === 'dm' && /Новый заказ/.test(x.text));
  assert.ok(dm, 'admin notified');

  const o = orders.listByUser(uid)[0];
  assert.strictEqual(o.status, 'paid');
  assert.strictEqual(users.getUserById(uid).balance, 160);
});

test('insufficient balance shows topup hint and creates no order', async () => {
  const cheapUid = users.upsertUser({ tg_id: 222, username: 'poor' });
  const ctx = makeCtx({ id: 222, username: 'poor', first_name: 'Poor' });
  await catalog.handleConfirm(ctx, autoPid);
  const m = findSent(ctx, (x) => x.type === 'reply');
  assert.match(m.text, /Недостаточно средств/);
  assert.strictEqual(orders.countByUser(cheapUid), 0);
});

test('profile shows balance, orders detail incl. delivered content', async () => {
  let ctx = makeCtx();
  await profile.showProfile(ctx);
  let profileMessage = findSent(ctx, (x) => x.type === 'reply');
  assert.match(profileMessage.text, /Баланс: <b>160\.00₽/);
  const profileMarkup = JSON.stringify(profileMessage.opts.reply_markup);
  assert.match(profileMarkup, /📄 Мои заказы/);
  assert.match(profileMarkup, /📈 История пополнений/);
  assert.match(profileMarkup, /💰 Пополнить баланс/);
  assert.match(profileMarkup, /🔔 Уведомления: ВКЛ/);

  ctx = makeCtx();
  await profile.showOrders(ctx, 1);
  assert.match(findSent(ctx, (x) => x.type === 'reply').text, /Мои заказы/);

  ctx = makeCtx();
  await profile.showOrder(ctx, autoOrderId);
  const m = findSent(ctx, (x) => x.type === 'reply');
  assert.match(m.text, new RegExp(`Заказ #${autoOrderId}`));
  assert.match(m.text, /AAA-CODE/);
});

test('profile topups history renders empty state', async () => {
  const ctx = makeCtx();
  await profile.showTopups(ctx, 1);
  const m = findSent(ctx, (x) => x.type === 'reply');
  assert.match(m.text, /История пополнений/);
  assert.match(m.text, /Пока пусто/);
});

test('about includes return policy; support includes FAQ + write button', async () => {
  let ctx = makeCtx();
  await about.showAbout(ctx);
  assert.match(findSent(ctx, (x) => x.type === 'reply').text, /Политика возврата/);

  ctx = makeCtx();
  await support.showSupport(ctx);
  const m = findSent(ctx, (x) => x.type === 'reply');
  assert.match(m.text, /Поддержка/);
  assert.match(JSON.stringify(m.opts.reply_markup), /Написать в поддержку/);
});

test('callback rendering path keeps the main menu as one photo message', async () => {
  const ctx = asCallback(makeCtx());
  ctx.deleteMessage = async () => ctx.sent.push({ type: 'delete' });
  ctx.replyWithPhoto = async (photo, opts) => {
    ctx.sent.push({ type: 'photo', photo, opts });
    return { message_id: ctx.sent.length };
  };
  await main.show(ctx);
  const m = ctx.sent[ctx.sent.length - 1];
  assert.strictEqual(m.type, 'photo');
  assert.match(m.opts.caption, /Добро пожаловать в FZZ MARKET/);
});

test('invalid MarkdownV2 content falls back to a plain message instead of breaking /start', async () => {
  const ctx = makeCtx();
  const calls = [];
  ctx.replyWithPhoto = async () => {
    throw new Error("400: Bad Request: can't parse entities: Character '!' is reserved");
  };
  ctx.reply = async (text, opts) => {
    calls.push({ text, opts });
    if (opts && opts.parse_mode === 'MarkdownV2') {
      throw new Error("400: Bad Request: can't parse entities: Character '!' is reserved");
    }
    return { message_id: 1 };
  };

  await main.show(ctx);
  assert.strictEqual(calls.length, 2);
  assert.strictEqual(calls[0].opts.parse_mode, 'MarkdownV2');
  assert.strictEqual(calls[1].opts.parse_mode, undefined);
  assert.match(calls[1].text, /Добро пожаловать в FZZ MARKET/);
  assert.doesNotMatch(calls[1].text, /\\!/);
});
