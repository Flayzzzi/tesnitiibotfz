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
process.env.DB_PATH = '/tmp/opencode/tests-start.db';
process.env.CONTENT_FILE = '/tmp/opencode/tests-start-content.json';
process.env.BOT_TOKEN = 'test:token';
process.env.ADMIN_IDS = '111';

const { after, test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const { Telegram } = require('telegraf');

const apiCalls = [];
for (const method of ['getMe', 'sendMessage', 'sendPhoto']) {
  Telegram.prototype[method] = async function (...args) {
    apiCalls.push({ method, args });
    if (method === 'getMe') return { id: 1, is_bot: true, first_name: 'Test', username: 'testbot' };
    return { message_id: 1 };
  };
}

const { bot } = require('../src/bot');
const db = require('../src/db');

after(() => {
  for (const file of [
    '/tmp/opencode/tests-start.db',
    '/tmp/opencode/tests-start.db-shm',
    '/tmp/opencode/tests-start.db-wal',
    '/tmp/opencode/tests-start-content.json',
  ]) {
    try { fs.unlinkSync(file); } catch {}
  }
});

test('/start resets a stale wizard and opens the main menu even without a command entity', async () => {
  apiCalls.length = 0;
  db.prepare('INSERT OR REPLACE INTO sessions (key, data, updated_at) VALUES (?, ?, datetime(\'now\'))').run(
    '111:111',
    JSON.stringify({
      session: {
        step: 'topup_amount',
        wizard: { partial: true },
        adminWizard: { flow: 'broadcast' },
      },
      expires: null,
    })
  );

  await bot.handleUpdate({
    update_id: 800001,
    message: {
      message_id: 1,
      date: Math.floor(Date.now() / 1000),
      chat: { id: 111, type: 'private' },
      from: { id: 111, is_bot: false, first_name: 'Tester' },
      text: '/start',
    },
  });

  const reply = apiCalls.find((call) => call.method === 'sendPhoto');
  assert.ok(reply, '/start should send the menu as one photo message');
  assert.match(reply.args[2].caption, /Добро пожаловать в FZZ MARKET/);
  assert.strictEqual(reply.args[2].parse_mode, 'MarkdownV2');

  const stored = JSON.parse(db.prepare('SELECT data FROM sessions WHERE key = ?').get('111:111').data);
  assert.deepStrictEqual(stored.session, {
    step: null,
    wizard: {},
    adminWizard: {},
    lastView: 'main',
    lastViewMsgId: 1,
  });
});
