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
process.env.BOT_TOKEN = 'test:token';
process.env.ADMIN_IDS = '111';
process.env.PREMIUM_EMOJI_IDS = 'welcome=5267163272645215724';

const { test } = require('node:test');
const assert = require('node:assert');
const { markdownEmoji } = require('../src/utils/emoji');
const { escapeUnescapedMarkdownV2Character, escapeUnclosedBoldAtOffset, restoreCustomEmojiMarkers, formatCustomEmojisForParseMode, restoreIncomingCustomEmojiEntities } = require('../src/utils/markdown');
const { plainTextFallback, fromStoredButtons } = require('../src/utils/keyboard');

test('MarkdownV2 custom emoji keeps its required leading exclamation mark', () => {
  const emoji = '![🤩](tg://emoji?id=5267163272645215724)';
  assert.strictEqual(escapeUnescapedMarkdownV2Character(emoji, '!'), emoji);
  assert.strictEqual(markdownEmoji('welcome'), '![🤝](tg://emoji?id=5267163272645215724)');
  assert.strictEqual(plainTextFallback(emoji, 'MarkdownV2'), '🤩');
});

test('a literal MarkdownV2 exclamation mark remains escaped', () => {
  assert.strictEqual(escapeUnescapedMarkdownV2Character('Готово!', '!'), 'Готово\\!');
});

test('an unclosed bold delimiter is repaired at Telegram’s UTF-8 byte offset', () => {
  const text = '🤩 ![🎁](tg://emoji?id=5470077185773579690) *незакрытый bold';
  const offset = Buffer.byteLength(text.slice(0, text.indexOf('*')), 'utf8');
  assert.strictEqual(
    escapeUnclosedBoldAtOffset(text, offset),
    '🤩 ![🎁](tg://emoji?id=5470077185773579690) \\*незакрытый bold'
  );
});

test('a legacy escaped custom emoji marker is restored without changing ordinary escapes', () => {
  assert.strictEqual(
    restoreCustomEmojiMarkers('Готово\\! и \\![🤩](tg://emoji?id=5267163272645215724)'),
    'Готово\\! и ![🤩](tg://emoji?id=5267163272645215724)'
  );
});

test('an HTML menu receives Telegram HTML custom-emoji markup without changing stored Markdown input', () => {
  const emoji = '![🤩](tg://emoji?id=5267163272645215724)';
  assert.strictEqual(
    formatCustomEmojisForParseMode(emoji, 'HTML'),
    '<tg-emoji emoji-id="5267163272645215724">🤩</tg-emoji>'
  );
  assert.strictEqual(formatCustomEmojisForParseMode(emoji, 'MarkdownV2'), emoji);
});

test('a custom emoji in a stored inline-button label collapses to its plain fallback glyph', () => {
  // Telegram ignores custom_emoji markup inside inline-button text, so the
  // marker must degrade to the visible fallback glyph plus any trailing label.
  const keyboard = fromStoredButtons([['![🎁](tg://emoji?id=5470077185773579690)Поддержка', 'menu:support']]);
  assert.deepStrictEqual(keyboard.reply_markup.inline_keyboard, [[{
    text: '🎁Поддержка',
    callback_data: 'menu:support',
    hide: false,
  }]]);
});

test('an incoming custom emoji entity becomes a MarkdownV2 custom emoji and consumes a pasted leading exclamation mark', () => {
  assert.strictEqual(
    restoreIncomingCustomEmojiEntities('!⭐ Поддержка', [{ type: 'custom_emoji', offset: 1, length: 1, custom_emoji_id: '5127961690641156032' }]),
    '![⭐](tg://emoji?id=5127961690641156032) Поддержка'
  );
});
