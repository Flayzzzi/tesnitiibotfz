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
process.env.DB_PATH = '/tmp/opencode/tests-integration.db';
process.env.CONTENT_FILE = '/tmp/opencode/tests-content.json';
process.env.BOT_TOKEN = 'test:token';
process.env.ADMIN_IDS = '111';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');

const categories = require('../src/db/models/categories');
const products = require('../src/db/models/products');
const content = require('../src/content');

let seq = 0;
let cbSeq = 0;

function baseUpdate() {
  const d = Math.floor(Date.now() / 1000);
  const from = { id: 111, is_bot: false, first_name: 'T', username: 't111' };
  return { d, from };
}

function msgUpdate(text) {
  const { d, from } = baseUpdate();
  return {
    update_id: ++seq + 100000,
    message: {
      message_id: ++seq,
      date: d,
      chat: { id: 111, type: 'private', first_name: 'T', username: 't111' },
      from,
      text,
    },
  };
}

function customEmojiMsgUpdate(text, customEmojiId, offset, length) {
  const update = msgUpdate(text);
  update.message.entities = [{ type: 'custom_emoji', offset, length, custom_emoji_id: customEmojiId }];
  return update;
}

function photoUpdate(fileId = 'photo-file-id') {
  const { d, from } = baseUpdate();
  return {
    update_id: ++seq + 100000,
    message: {
      message_id: ++seq,
      date: d,
      chat: { id: 111, type: 'private', first_name: 'T', username: 't111' },
      from,
      photo: [{ file_id: fileId, width: 100, height: 100 }],
    },
  };
}

function imageDocumentUpdate(fileId = 'document-file-id', fileName = 'image.png') {
  const { d, from } = baseUpdate();
  return {
    update_id: ++seq + 100000,
    message: {
      message_id: ++seq,
      date: d,
      chat: { id: 111, type: 'private', first_name: 'T', username: 't111' },
      from,
      document: { file_id: fileId, file_name: fileName, mime_type: fileName.endsWith('.png') ? 'image/png' : 'image/jpeg' },
    },
  };
}

function cbUpdate(data) {
  const { d, from } = baseUpdate();
  return {
    update_id: ++seq + 200000,
    callback_query: {
      id: 'cb-' + ++cbSeq,
      from,
      chat_instance: 'x',
      data,
      message: {
        message_id: 1000 + cbSeq,
        date: d,
        chat: { id: 111, type: 'private', first_name: 'T', username: 't111' },
        from,
        text: 'prev',
      },
    },
  };
}

function cmdUpdate(text) {
  const u = msgUpdate(text);
  u.message.entities = [{ type: 'bot_command', offset: 0, length: text.indexOf(' ') === -1 ? text.length : text.indexOf(' ') }];
  return u;
}

const apiCalls = [];
const { Telegram } = require('telegraf');
for (const m of ['sendMessage', 'sendPhoto', 'editMessageText', 'deleteMessage', 'answerCbQuery', 'getMe', 'deleteWebhook', 'setWebhook', 'setMyCommands']) {
  Telegram.prototype[m] = async function (...args) {
    apiCalls.push({ kind: m, args });
    if (m === 'getMe') return { id: 1, is_bot: true, first_name: 'T', username: 't111' };
    if (m === 'editMessageText' || m === 'deleteMessage' || m === 'answerCbQuery') return true;
    return { message_id: 1 };
  };
}

let bot;
let registerCommands;
before(async () => {
  ({ bot, registerCommands } = require('../src/bot'));
});

after(() => {
  for (const suffix of ['', '-shm', '-wal']) {
    try { fs.unlinkSync('/tmp/opencode/tests-integration.db' + suffix); } catch {}
  }
});

async function send(update) {
  await bot.handleUpdate(update);
}

function lastSendText() {
  for (let i = apiCalls.length - 1; i >= 0; i--) {
    const c = apiCalls[i];
    if (c.kind === 'sendMessage') return c.args[1];
    if (c.kind === 'sendPhoto') return c.args[2] && c.args[2].caption;
    if (c.kind === 'editMessageText') return c.args[3];
  }
  return null;
}

test('END-TO-END: admin creates category and auto product through real routing', async () => {
  apiCalls.length = 0;
  await send(cbUpdate('admin:catadd'));
  assert.match(lastSendText(), /название категории/);
  await send(msgUpdate('Игры'));
  await send(msgUpdate('—'));
  const cat = categories.all().find((c) => c.name === 'Игры');
  assert.ok(cat, 'category created via callbacks+messages');

  await send(cbUpdate('admin:product:add'));
  const picker = apiCalls.slice().reverse().find((c) => c.kind === 'sendMessage' && /Выбери категорию/.test(c.args[1]));
  assert.ok(picker, 'category picker message sent');
  assert.ok(picker.args[2] && picker.args[2].reply_markup && picker.args[2].reply_markup.inline_keyboard.length > 0, 'category picker has buttons');
  await send(cbUpdate(`admin:paddcat:${cat.id}`));
  assert.match(lastSendText(), /название товара/);
  await send(msgUpdate('Код Steam 100'));
  await send(msgUpdate('Пополнение Steam'));
  await send(msgUpdate('90'));
  await send(msgUpdate('—'));
  await send(cbUpdate('admin:paddtype:auto'));
  await send(msgUpdate('AAA-1\nBBB-2'));
  await send(cbUpdate('admin:paddvis:1'));

  const p = products.all({ categoryId: cat.id }).find((x) => x.name === 'Код Steam 100');
  assert.ok(p, 'product created via real routing');
  assert.strictEqual(p.price, 90);
  assert.strictEqual(p.type, 'auto');
  assert.strictEqual(p.stock, 2);
});

test('END-TO-END: topup with Platega unset returns human error, no hard crash', async () => {
  apiCalls.length = 0;
  await send(cbUpdate('menu:topup'));
  assert.match(lastSendText(), /Пополнение баланса/);
  await send(msgUpdate('100'));
  const text = lastSendText();
  assert.match(text, /Оплата временно недоступна/, 'human error message shown');
});

test('END-TO-END: category wizard accepts and persists a Telegram photo', async () => {
  apiCalls.length = 0;
  await send(cbUpdate('admin:catadd'));
  await send(msgUpdate('Фото-категория'));
  await send(photoUpdate('telegram-photo-123'));

  const category = categories.all().find((item) => item.name === 'Фото-категория');
  assert.ok(category, 'category created after a photo update');
  assert.strictEqual(category.image_url, 'tgfile:telegram-photo-123');
  assert.ok(apiCalls.some((call) => call.kind === 'sendMessage' && /Категория.*создана/.test(call.args[1])));
});

test('END-TO-END: button-based edit flow — admin:edit:main', async () => {
  apiCalls.length = 0;
  const contentFile = process.env.CONTENT_FILE;
  try { fs.unlinkSync(contentFile); } catch {}

  // open main menu, click Edit button
  await send(cbUpdate('menu:main'));
  await send(cbUpdate('admin:edit:main'));
  assert.match(lastSendText(), /Редактируем:/, 'edit wizard opened');
  await send(cbUpdate('admin:button:text'));
  assert.match(lastSendText(), /Переменные/, 'variable guide shown');
  assert.doesNotMatch(lastSendText(), /store_name/, 'the hard-coded store-name variable is not advertised');

  // send new template
  await send(msgUpdate('Привет, {first_name} ! Баланс: {balance}'));
  assert.match(lastSendText(), /Кнопки/, 'interactive button editor opened');

  // Replace buttons through the interactive editor without entering callback syntax.
  await send(cbUpdate('admin:button:clear'));
  await send(cbUpdate('admin:button:add'));
  await send(msgUpdate('Каталог'));
  await send(cbUpdate('admin:button:target:catalog'));
  await send(cbUpdate('admin:button:add'));
  await send(msgUpdate('Профиль'));
  await send(cbUpdate('admin:button:target:profile'));
  await send(cbUpdate('admin:button:done'));
  // last send is the re-shown menu with new text
  assert.match(lastSendText(), /Привет, .* ! Баланс:/, 'menu re-shown with the stored template text');

  // verify stored in JSON
  const stored = JSON.parse(fs.readFileSync(contentFile, 'utf8'));
  assert.strictEqual(stored.main.text, 'Привет, {first_name} ! Баланс: {balance}');
  assert.strictEqual(stored.main.parse_mode, 'MarkdownV2');
  assert.deepStrictEqual(stored.main.buttons, [['Каталог', 'menu:catalog'], ['Профиль', 'menu:profile']]);

  // re-open main: variable {first_name} should be resolved
  await send(cbUpdate('menu:main'));
  assert.match(lastSendText(), /Привет, T ! Баланс:/, 'variable resolved');
});

test('END-TO-END: direct text sent from the editor start screen is saved', async () => {
  apiCalls.length = 0;
  const contentFile = process.env.CONTENT_FILE;
  try { fs.unlinkSync(contentFile); } catch {}

  await send(cbUpdate('admin:edit:main'));
  await send(msgUpdate('asdasdasd ![🎁](tg://emoji?id=5470077185773579690)'));
  assert.match(lastSendText(), /Кнопки/, 'direct text opens the save panel');
  await send(cbUpdate('admin:button:done'));

  const stored = JSON.parse(fs.readFileSync(contentFile, 'utf8'));
  assert.strictEqual(stored.main.text, 'asdasdasd ![🎁](tg://emoji?id=5470077185773579690)');
  assert.strictEqual(stored.main.parse_mode, 'MarkdownV2');
});

test('END-TO-END: a premium-emoji button label degrades to its plain fallback glyph', async () => {
  apiCalls.length = 0;
  const contentFile = process.env.CONTENT_FILE;
  try { fs.unlinkSync(contentFile); } catch {}

  await send(cbUpdate('admin:edit:main'));
  await send(cbUpdate('admin:button:buttons'));
  await send(cbUpdate('admin:button:clear'));
  await send(cbUpdate('admin:button:add'));
  await send(customEmojiMsgUpdate('!⭐ ПОДДЕРЖКА', '5127961690641156032', 1, 1));
  await send(cbUpdate('admin:button:target:support'));
  await send(cbUpdate('admin:button:done'));

  const mainMessage = apiCalls.filter((call) => call.kind === 'sendPhoto').at(-1);
  const button = mainMessage.args[2].reply_markup.inline_keyboard[0][0];
  // Telegram does not render custom emoji inside inline-button text, so the
  // marker must collapse to the visible fallback glyph plus the trailing label.
  assert.strictEqual(button.text, '⭐ ПОДДЕРЖКА');
  assert.strictEqual(button.icon_custom_emoji_id, undefined);
  assert.doesNotMatch(button.text, /tg:\/\/emoji/);
});

test('END-TO-END: main-menu cover can be uploaded before editing text and is persisted on Done', async () => {
  apiCalls.length = 0;
  const contentFile = process.env.CONTENT_FILE;
  try { fs.unlinkSync(contentFile); } catch {}

  await send(cbUpdate('menu:main'));
  await send(cbUpdate('admin:edit:main'));
  await send(cbUpdate('admin:button:image'));
  await send(photoUpdate('main-menu-file-id'));
  await send(cbUpdate('admin:button:done'));

  const stored = JSON.parse(fs.readFileSync(contentFile, 'utf8'));
  assert.strictEqual(stored.main.image_url, 'tgfile:main-menu-file-id');
  const cover = apiCalls.filter((call) => call.kind === 'sendPhoto').at(-1);
  assert.ok(cover, 'saved cover is rendered immediately');
  assert.strictEqual(cover.args[1], 'main-menu-file-id', 'Telegram file_id is sent directly back to Telegram');
});

test('END-TO-END: a PNG/JPG document is accepted as the main-menu cover', async () => {
  apiCalls.length = 0;
  const contentFile = process.env.CONTENT_FILE;
  try { fs.unlinkSync(contentFile); } catch {}

  await send(cbUpdate('admin:edit:main'));
  await send(cbUpdate('admin:button:image'));
  await send(imageDocumentUpdate('main-menu-document-id', 'cover.jpg'));
  await send(cbUpdate('admin:button:done'));

  const stored = JSON.parse(fs.readFileSync(contentFile, 'utf8'));
  assert.strictEqual(stored.main.image_url, 'tgfile:main-menu-document-id');
});

test('END-TO-END: /edit command still works via lastView', async () => {
  apiCalls.length = 0;
  const contentFile = process.env.CONTENT_FILE;
  try { fs.unlinkSync(contentFile); } catch {}

  await send(cbUpdate('menu:main'));
  await send(cmdUpdate('/edit'));
  assert.match(lastSendText(), /Редактируем:/);
  await send(cbUpdate('admin:button:text'));
  await send(msgUpdate('Тест /edit'));
  assert.match(lastSendText(), /Кнопки/);
  await send(cbUpdate('admin:button:done'));
  // last send is the re-shown menu with the stored text
  assert.match(lastSendText(), /Тест \/edit/, 'menu re-shown with stored text');

  const stored = JSON.parse(fs.readFileSync(contentFile, 'utf8'));
  assert.strictEqual(stored.main.text, 'Тест /edit');
});

test('END-TO-END: reset clears content.json and shows defaults', async () => {
  apiCalls.length = 0;
  const contentFile = process.env.CONTENT_FILE;
  try { fs.unlinkSync(contentFile); } catch {}

  // set something
  await send(cbUpdate('admin:edit:main'));
  await send(cbUpdate('admin:button:text'));
  await send(msgUpdate('custom'));
  await send(cbUpdate('admin:button:done'));

  let stored = JSON.parse(fs.readFileSync(contentFile, 'utf8'));
  assert.strictEqual(stored.main.text, 'custom');

  // reset — last send is the re-shown menu with defaults
  await send(cbUpdate('admin:reset:main'));
  assert.match(lastSendText(), /Добро пожаловать в FZZ MARKET/, 'defaults restored after reset');
});

test('incoming admin command routes and Telegram command menus are registered', async () => {
  apiCalls.length = 0;
  await send(cmdUpdate('/admin'));
  assert.match(lastSendText(), /Админ-панель/, '/admin is handled by the routed command handler');

  apiCalls.length = 0;
  await registerCommands();
  const registrations = apiCalls.filter((call) => call.kind === 'setMyCommands');
  assert.strictEqual(registrations.length, 2, 'registers a global list and an admin chat list');
  assert.deepStrictEqual(registrations[0].args[0], [{ command: 'start', description: 'Открыть меню' }]);
  assert.deepStrictEqual(registrations[1].args[1], { scope: { type: 'chat', chat_id: 111 } });
  assert.match(JSON.stringify(registrations[1].args[0]), /admin/);
  assert.match(JSON.stringify(registrations[1].args[0]), /edit/);
});

test('the persistent menu button exits a text-entry wizard and returns to the main menu', async () => {
  apiCalls.length = 0;
  const product = products.all({})[0];
  assert.ok(product, 'fixture product exists');
  await send(cbUpdate(`admin:pedit:${product.id}:content`));
  const prompt = apiCalls.slice().reverse().find((call) => call.kind === 'sendMessage' && /Вставьте новые строки контента/.test(call.args[1]));
  assert.ok(prompt, 'content prompt sent');
  assert.match(JSON.stringify(prompt.args[2].reply_markup.keyboard), /Меню/, 'reply keyboard is attached below the composer');

  await send(msgUpdate('🏠 Меню'));
  assert.match(lastSendText(), /Добро пожаловать в FZZ MARKET/, 'menu button clears the wizard and returns home');
});

test('renderTemplate resolves known variables, keeps unknown', () => {
  const result = content.renderTemplate(
    'Привет, {first_name}! Баланс: {balance}.未知: {unknown}',
    { first_name: 'Максим', balance: '100₽' },
  );
  assert.strictEqual(result, 'Привет, Максим! Баланс: 100₽.未知: {unknown}');
});

test('renderTemplate returns empty string for null/undefined input', () => {
  assert.strictEqual(content.renderTemplate(null), '');
  assert.strictEqual(content.renderTemplate(undefined), '');
  assert.strictEqual(content.renderTemplate(''), '');
});
