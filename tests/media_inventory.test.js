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
process.env.DB_PATH = '/tmp/opencode/tests-media-inventory.db';
process.env.BOT_TOKEN = 'test:token';
process.env.ADMIN_IDS = '111';

const { test, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const { Telegram } = require('telegraf');
const categories = require('../src/db/models/categories');
const products = require('../src/db/models/products');
const users = require('../src/db/models/users');
const subscriptions = require('../src/db/models/notifications');
const adminCategories = require('../src/menus/admin/categories');
const adminProducts = require('../src/menus/admin/products');
const catalog = require('../src/menus/catalog');
const main = require('../src/menus/main');
const about = require('../src/menus/about');
const { setBot } = require('../src/notifications');
const { renderCatalogView } = require('../src/utils/catalog_view');

function makeCtx({ callback = false, photoMessage = false } = {}) {
  const sent = [];
  const ctx = {
    from: { id: 111, username: 'admin', first_name: 'Admin' },
    chat: { id: 111 },
    session: { step: null, wizard: {}, adminWizard: {} },
    sent,
    answerCbQuery: async (...args) => sent.push({ type: 'answer', args }),
    deleteMessage: async () => sent.push({ type: 'delete' }),
    reply: async (text, opts) => { sent.push({ type: 'reply', text, opts }); return { message_id: sent.length }; },
    replyWithPhoto: async (photo, opts) => { sent.push({ type: 'photo', photo, opts }); return { message_id: sent.length }; },
    editMessageText: async (text, opts) => { sent.push({ type: 'editText', text, opts }); return true; },
    editMessageMedia: async (media, opts) => { sent.push({ type: 'editMedia', media, opts }); return true; },
    telegram: { sendMessage: async (...args) => sent.push({ type: 'dm', args }) },
  };
  if (callback) ctx.callbackQuery = { data: 'x', message: photoMessage ? { photo: [{ file_id: 'old' }] } : { text: 'old' } };
  return ctx;
}

async function categoryText(ctx, text) {
  ctx.message = { text };
  return adminCategories.onMessage(ctx);
}

async function categoryPhoto(ctx, fileId) {
  ctx.message = { photo: [{ file_id: fileId }] };
  return adminCategories.onMessage(ctx);
}

async function categoryDocument(ctx, fileId, fileName = 'image.png') {
  ctx.message = { document: { file_id: fileId, file_name: fileName, mime_type: 'image/png' } };
  return adminCategories.onMessage(ctx);
}

async function productText(ctx, text) {
  ctx.message = { text };
  return adminProducts.onMessage(ctx);
}

async function productPhoto(ctx, fileId) {
  ctx.message = { photo: [{ file_id: fileId }] };
  return adminProducts.onMessage(ctx);
}

async function productDocument(ctx, fileId, fileName = 'image.jpg') {
  ctx.message = { document: { file_id: fileId, file_name: fileName, mime_type: 'image/jpeg' } };
  return adminProducts.onMessage(ctx);
}

async function createProduct(categoryId, name, imageStep) {
  const ctx = makeCtx();
  await adminProducts.startAdd(ctx);
  await adminProducts.setCategory(ctx, categoryId);
  await productText(ctx, name);
  await productText(ctx, 'Description');
  await productText(ctx, '10');
  await imageStep(ctx);
  await adminProducts.setType(ctx, 'manual');
  await adminProducts.setVisibility(ctx, 1);
  return products.all({ categoryId }).find((product) => product.name === name);
}

test('category and product wizards validate names and persist all supported image actions', async () => {
  let ctx = makeCtx();
  await adminCategories.startAdd(ctx);
  await categoryText(ctx, '   ');
  assert.strictEqual(ctx.session.adminWizard.step, 0, 'empty category names do not advance');
  await categoryPhoto(ctx, 'wrong-step-photo');
  assert.strictEqual(ctx.session.adminWizard.step, 0, 'a photo cannot create an empty category');

  await categoryText(ctx, 'Photo category');
  await categoryPhoto(ctx, 'category-file');
  const photoCategory = categories.all().find((category) => category.name === 'Photo category');
  assert.strictEqual(photoCategory.image_url, 'tgfile:category-file');

  ctx = makeCtx();
  await adminCategories.startAdd(ctx);
  await categoryText(ctx, 'Document category');
  await categoryDocument(ctx, 'category-document-file');
  assert.strictEqual(categories.all().find((category) => category.name === 'Document category').image_url, 'tgfile:category-document-file');

  ctx = makeCtx();
  await adminCategories.startAdd(ctx);
  await categoryText(ctx, 'URL category');
  await categoryText(ctx, 'https://images.example/category.jpg');
  const urlCategory = categories.all().find((category) => category.name === 'URL category');
  assert.strictEqual(urlCategory.image_url, 'https://images.example/category.jpg');

  ctx = makeCtx();
  await adminCategories.startAdd(ctx);
  await categoryText(ctx, 'No-image category');
  await categoryText(ctx, '-');
  const emptyCategory = categories.all().find((category) => category.name === 'No-image category');
  assert.strictEqual(emptyCategory.image_url, null);

  ctx = makeCtx();
  await adminCategories.startEdit(ctx, photoCategory.id);
  await categoryText(ctx, 'Renamed category');
  await categoryText(ctx, '—');
  assert.deepStrictEqual(categories.get(photoCategory.id).image_url, 'tgfile:category-file');
  assert.strictEqual(categories.get(photoCategory.id).name, 'Renamed category');
  await adminCategories.startEdit(ctx, photoCategory.id);
  await categoryText(ctx, '-');
  await categoryPhoto(ctx, 'category-replacement');
  assert.strictEqual(categories.get(photoCategory.id).image_url, 'tgfile:category-replacement');
  await adminCategories.startEdit(ctx, photoCategory.id);
  await categoryText(ctx, '-');
  await categoryText(ctx, 'https://images.example/replacement.jpg');
  assert.strictEqual(categories.get(photoCategory.id).image_url, 'https://images.example/replacement.jpg');
  await adminCategories.startEdit(ctx, photoCategory.id);
  await categoryText(ctx, '-');
  await categoryText(ctx, 'УДАЛИТЬ');
  assert.strictEqual(categories.get(photoCategory.id).image_url, null);

  const productCategory = categories.create({ name: 'Products' });
  ctx = makeCtx();
  await adminProducts.startAdd(ctx);
  await adminProducts.setCategory(ctx, productCategory);
  await productText(ctx, ' ');
  assert.strictEqual(ctx.session.adminWizard.step, 1, 'empty product names do not advance');
  const photoProduct = await createProduct(productCategory, 'Photo product', (c) => productPhoto(c, 'product-file'));
  const documentProduct = await createProduct(productCategory, 'Document product', (c) => productDocument(c, 'product-document-file'));
  const urlProduct = await createProduct(productCategory, 'URL product', (c) => productText(c, 'https://images.example/product.jpg'));
  const noImageProduct = await createProduct(productCategory, 'No-image product', (c) => productText(c, '-'));
  assert.strictEqual(photoProduct.image_url, 'tgfile:product-file');
  assert.strictEqual(documentProduct.image_url, 'tgfile:product-document-file');
  assert.strictEqual(urlProduct.image_url, 'https://images.example/product.jpg');
  assert.strictEqual(noImageProduct.image_url, null);

  ctx = makeCtx();
  await adminProducts.startFieldEdit(ctx, photoProduct.id, 'image');
  await productPhoto(ctx, 'product-replacement');
  assert.strictEqual(products.get(photoProduct.id).image_url, 'tgfile:product-replacement');
  await adminProducts.startFieldEdit(ctx, photoProduct.id, 'image');
  await adminProducts.onEditText(ctx, 'https://images.example/product-replacement.jpg');
  assert.strictEqual(products.get(photoProduct.id).image_url, 'https://images.example/product-replacement.jpg');
  await adminProducts.startFieldEdit(ctx, photoProduct.id, 'image');
  await adminProducts.onEditText(ctx, 'удалить');
  assert.strictEqual(products.get(photoProduct.id).image_url, null);
});

test('catalog consumes stored media, retains keyboards, and safely transitions views', async () => {
  const catText = categories.create({ name: 'Text category' });
  const catFile = categories.create({ name: 'File category', image_url: 'tgfile:raw-file-id' });
  const catUrl = categories.create({ name: 'URL category', image_url: 'https://images.example/category.png' });
  const textProduct = products.create({ category_id: catText, name: 'Text product', price: 5, type: 'manual' });
  const fileProduct = products.create({ category_id: catFile, name: 'File product', price: 5, type: 'manual', image_url: 'tgfile:product-file-id' });
  const urlProduct = products.create({ category_id: catUrl, name: 'URL product', price: 5, type: 'manual', image_url: 'https://images.example/product.png' });

  let ctx = makeCtx();
  await catalog.showProducts(ctx, catText, 1);
  assert.strictEqual(ctx.sent.at(-1).type, 'reply');

  ctx = makeCtx({ callback: true });
  await catalog.showProducts(ctx, catFile, 1);
  assert.strictEqual(ctx.sent.at(-1).type, 'photo');
  assert.strictEqual(ctx.sent.at(-1).photo, 'raw-file-id');
  assert.ok(ctx.sent.at(-1).opts.reply_markup.inline_keyboard.length);

  ctx = makeCtx({ callback: true });
  await catalog.showProducts(ctx, catUrl, 1);
  assert.strictEqual(ctx.sent.at(-1).photo, 'https://images.example/category.png');

  ctx = makeCtx({ callback: true });
  await catalog.showProduct(ctx, fileProduct);
  assert.strictEqual(ctx.sent.at(-1).photo, 'product-file-id');

  ctx = makeCtx({ callback: true, photoMessage: true });
  await catalog.showProduct(ctx, urlProduct);
  assert.strictEqual(ctx.sent.at(-1).type, 'editMedia', 'media-to-media uses editMessageMedia');
  assert.strictEqual(ctx.sent.at(-1).media.media, 'https://images.example/product.png');

  ctx = makeCtx({ callback: true, photoMessage: true });
  await catalog.showProduct(ctx, textProduct);
  assert.deepStrictEqual(ctx.sent.map((item) => item.type), ['delete', 'reply'], 'media-to-text replaces the callback message');

  ctx = makeCtx({ callback: true });
  ctx.replyWithPhoto = async () => { throw new Error('bad image'); };
  await catalog.showProducts(ctx, catFile, 1);
  assert.strictEqual(ctx.sent.at(-1).type, 'reply');
  assert.match(ctx.sent.at(-1).text, /Товары/, 'failed media retains the complete product-list view');

  const longProduct = products.create({ category_id: catText, name: 'Long product', description: 'x'.repeat(1100), price: 5, type: 'manual', image_url: 'tgfile:long-file' });
  ctx = makeCtx({ callback: true });
  await catalog.showProduct(ctx, longProduct);
  assert.strictEqual(ctx.sent.at(-1).type, 'editText');
  assert.match(ctx.sent.at(-1).text, new RegExp('x{1100}'));
});

test('photo-origin catalog actions and stock addition remain operational', async () => {
  const cat = categories.create({ name: 'Action category', image_url: 'tgfile:category-action' });
  const auto = products.create({ category_id: cat, name: 'Auto', price: 1, type: 'auto', content: 'A', stock: 1, image_url: 'tgfile:auto' });
  const out = products.create({ category_id: cat, name: 'Out', price: 1, type: 'auto', content: null, stock: 0, image_url: 'tgfile:out' });
  const userId = users.upsertUser({ tg_id: 111 });
  users.addBalance(userId, 10);
  let ctx = makeCtx({ callback: true, photoMessage: true });
  await catalog.handleBuy(ctx, auto);
  assert.strictEqual(ctx.sent.at(-1).type, 'reply');
  ctx = makeCtx({ callback: true, photoMessage: true });
  await catalog.handleConfirm(ctx, auto);
  assert.strictEqual(ctx.sent.at(-1).type, 'reply');
  ctx = makeCtx({ callback: true, photoMessage: true });
  await catalog.showCategories(ctx);
  assert.strictEqual(ctx.sent.at(-1).type, 'reply', 'cancel/back target is safe from a photo callback');
  ctx = makeCtx({ callback: true, photoMessage: true });
  await catalog.subscribeNotify(ctx, out);
  await catalog.unsubscribeNotify(ctx, out);
  assert.ok(ctx.sent.some((item) => item.type === 'editMedia'), 'notify/unnotify retain a media product view');

  const sent = [];
  setBot({ telegram: { sendMessage: async (...args) => sent.push(args) } });
  subscriptions.subscribe(userId, out);
  ctx = makeCtx();
  await adminProducts.startFieldEdit(ctx, out, 'content');
  await adminProducts.onEditText(ctx, ' X \n\n Y ');
  assert.deepStrictEqual(products.get(out).content, 'X\nY');
  assert.strictEqual(products.get(out).stock, 2);
  assert.strictEqual(sent.length, 1, 'zero-to-available notifies subscribers');
  assert.strictEqual(subscriptions.byProduct(out).length, 0, 'notification cleanup is preserved');
  await adminProducts.startFieldEdit(ctx, out, 'content');
  await adminProducts.onEditText(ctx, '   \n ');
  assert.strictEqual(products.get(out).stock, 2, 'empty stock input changes nothing');
  await adminProducts.startFieldEdit(ctx, out, 'content');
  await adminProducts.onEditText(ctx, 'Z');
  assert.strictEqual(sent.length, 1, 'adding stock to an available product does not notify');

  const manual = products.create({ category_id: cat, name: 'Manual', price: 1, type: 'manual' });
  ctx = makeCtx();
  await adminProducts.showEditMenu(ctx, manual);
  assert.doesNotMatch(JSON.stringify(ctx.sent.at(-1).opts.reply_markup), /Добавить контент/);
});

test('the real bot routes a product-image photo update to the edit handler', async () => {
  const calls = [];
  for (const method of ['sendMessage', 'editMessageText', 'answerCbQuery', 'getMe', 'deleteWebhook', 'setWebhook']) {
    Telegram.prototype[method] = async function (...args) {
      calls.push({ method, args });
      if (method === 'getMe') return { id: 1, is_bot: true, first_name: 'Bot', username: 'bot' };
      return method === 'editMessageText' || method === 'answerCbQuery' ? true : { message_id: 1 };
    };
  }
  const cat = categories.create({ name: 'Routing' });
  const product = products.create({ category_id: cat, name: 'Routed image', price: 1, type: 'manual' });
  const { bot } = require('../src/bot');
  const from = { id: 111, is_bot: false, first_name: 'Admin', username: 'admin' };
  const now = Math.floor(Date.now() / 1000);
  await bot.handleUpdate({ update_id: 990001, callback_query: { id: 'route-1', from, chat_instance: 'x', data: `admin:pedit:${product}:image`, message: { message_id: 1, date: now, chat: { id: 111, type: 'private' }, from, text: 'old' } } });
  await bot.handleUpdate({ update_id: 990002, message: { message_id: 2, date: now, chat: { id: 111, type: 'private' }, from, photo: [{ file_id: 'routed-photo' }] } });
  assert.strictEqual(products.get(product).image_url, 'tgfile:routed-photo');
});

test('main menu sends the bundled banner with its editable MarkdownV2 caption', async () => {
  const ctx = makeCtx();
  await main.show(ctx);
  const message = ctx.sent.at(-1);
  assert.strictEqual(message.type, 'photo');
  assert.match(message.photo.source, /[\\/]assets[\\/]fzz-market\.png$/);
  assert.strictEqual(message.opts.parse_mode, 'MarkdownV2');
  assert.match(message.opts.caption, /Добро пожаловать в FZZ MARKET/);
});

test('a callback from the main-menu photo can open a text view', async () => {
  const ctx = makeCtx({ callback: true, photoMessage: true });
  await about.showAbout(ctx);
  assert.deepStrictEqual(ctx.sent.map((item) => item.type), ['delete', 'reply']);
  assert.match(ctx.sent.at(-1).text, /О магазине/);
});

test('MarkdownV2 entity errors are repaired in the photo caption without dropping the image', async () => {
  const ctx = makeCtx();
  let attempts = 0;
  ctx.replyWithPhoto = async (photo, opts) => {
    attempts += 1;
    if (opts.caption.includes('!') && !opts.caption.includes('\\!')) {
      throw new Error("400: Bad Request: can't parse entities: Character '!' is reserved and must be escaped with the preceding '\\'");
    }
    ctx.sent.push({ type: 'photo', photo, opts });
    return { message_id: 1 };
  };

  await renderCatalogView(ctx, '*Готово!*', { reply_markup: { inline_keyboard: [] } }, 'tgfile:banner', { parse_mode: 'MarkdownV2' });
  assert.strictEqual(attempts, 2);
  assert.strictEqual(ctx.sent.at(-1).type, 'photo');
  assert.strictEqual(ctx.sent.at(-1).opts.caption, '*Готово\\!*');
});

test('MarkdownV2 caption repair also retains an existing photo message', async () => {
  const ctx = makeCtx({ callback: true, photoMessage: true });
  let attempts = 0;
  ctx.editMessageMedia = async (media, opts) => {
    attempts += 1;
    if (media.caption.includes('!') && !media.caption.includes('\\!')) {
      throw new Error("400: Bad Request: can't parse entities: Character '!' is reserved and must be escaped with the preceding '\\'");
    }
    ctx.sent.push({ type: 'editMedia', media, opts });
    return true;
  };

  await renderCatalogView(ctx, '*Готово!*', { reply_markup: { inline_keyboard: [] } }, 'tgfile:banner', { parse_mode: 'MarkdownV2' });
  assert.strictEqual(attempts, 2);
  assert.strictEqual(ctx.sent.at(-1).type, 'editMedia');
  assert.strictEqual(ctx.sent.at(-1).media.caption, '*Готово\\!*');
});

test('an unclosed MarkdownV2 bold entity is repaired without dropping the photo', async () => {
  const ctx = makeCtx();
  const caption = '🤩 ![🎁](tg://emoji?id=5470077185773579690) *незакрытый bold';
  const offset = Buffer.byteLength(caption.slice(0, caption.indexOf('*')), 'utf8');
  let attempts = 0;
  ctx.replyWithPhoto = async (photo, opts) => {
    attempts += 1;
    if (!opts.caption.includes('\\*незакрытый')) {
      throw new Error(`400: Bad Request: can't parse entities: Can't find end of Bold entity at byte offset ${offset}`);
    }
    ctx.sent.push({ type: 'photo', photo, opts });
    return { message_id: 1 };
  };

  await renderCatalogView(ctx, caption, { reply_markup: { inline_keyboard: [] } }, 'tgfile:banner', { parse_mode: 'MarkdownV2' });
  assert.strictEqual(attempts, 2);
  assert.strictEqual(ctx.sent.at(-1).type, 'photo');
  assert.match(ctx.sent.at(-1).opts.caption, /\\\*незакрытый/);
});

after(() => {
  for (const suffix of ['', '-shm', '-wal']) {
    try { fs.unlinkSync('/tmp/opencode/tests-media-inventory.db' + suffix); } catch {}
  }
});
