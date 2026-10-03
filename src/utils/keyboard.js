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
const { Markup } = require('telegraf');
const { ef } = require('./emoji');

function grid(buttons, perRow = 2) {
  const rows = [];
  for (let i = 0; i < buttons.length; i += perRow) {
    rows.push(buttons.slice(i, i + perRow));
  }
  return Markup.inlineKeyboard(rows);
}

function backButton(data = 'menu:main', label) {
  return Markup.button.callback(label || `${ef('back')} Назад`, data);
}

function paginationRow({ hasPrev, hasNext, prevData, nextData }) {
  const row = [];
  if (hasPrev) row.push(Markup.button.callback(`${ef('back')} Назад`, prevData));
  if (hasNext) row.push(Markup.button.callback('Вперёд →', nextData));
  return row;
}

function storedButtonLabel(label) {
  const raw = String(label == null ? '' : label);
  const match = /^\\?!\[([^\]\n]*)\]\(tg:\/\/emoji\?id=(\d+)\)([\s\S]*)$/.exec(raw);
  if (!match) return { text: raw };

  // Inline keyboards do not render text entities at all: Telegram ignores any
  // custom_emoji markup in button labels (icon_custom_emoji_id exists only for
  // forum topics, not for InlineKeyboardButton). Collapse the marker to its
  // plain fallback glyph plus any trailing text so the button stays readable.
  return { text: `${match[1]}${match[3]}` };
}

function fromStoredButtons(buttons, perRow = 2) {
  const normalized = buttons.map((item) => {
    if (item && typeof item === 'object' && !(Array.isArray(item))) {
      return [item.label || item[0] || '', item.data || item[1] || ''];
    }
    return Array.isArray(item) ? item : [String(item), ''];
  });
  const rows = [];
  for (let i = 0; i < normalized.length; i += perRow) {
    const row = normalized.slice(i, i + perRow).map(([label, data]) => {
      const d = String(data == null ? 'noop' : data);
      const { text } = storedButtonLabel(label);
      return d.startsWith('url:')
        ? Markup.button.url(text, d.slice(4))
        : Markup.button.callback(text, d);
    });
    rows.push(row);
  }
  return Markup.inlineKeyboard(rows);
}

function isEntityParseError(err) {
  return /can't parse entities/i.test(String(err && err.message ? err.message : err));
}

function callbackMessageHasText(ctx) {
  const message = ctx.callbackQuery && ctx.callbackQuery.message;
  // Inline callbacks have no message object and keep Telegram's normal edit
  // path. A callback from a photo/caption has a message but no editable text.
  return !message || typeof message.text === 'string';
}

function plainTextFallback(text, parseMode) {
  if (parseMode !== 'MarkdownV2') return text;
  return String(text)
    .replace(/\\!\[([^\]]+)]\(tg:\/\/emoji\?id=\d+\)/g, '![$1](tg://emoji?id=0)')
    .replace(/!?\[([^\]]+)]\(tg:\/\/emoji\?id=\d+\)/g, '$1')
    .replace(/\\([_*\[\]()~`>#+\-=|{}.!])/g, '$1')
    .replace(/[*_~`]/g, '');
}

function menuOptions(keyboard, options = {}) {
  const opts = { parse_mode: options.parse_mode || 'HTML' };
  if (keyboard && keyboard.reply_markup) opts.reply_markup = keyboard.reply_markup;
  return opts;
}

function replyMenu(ctx, text, keyboard, options = {}) {
  const opts = menuOptions(keyboard, options);
  const fallback = () => {
    const { parse_mode, ...fallbackOpts } = opts;
    return ctx.reply(plainTextFallback(text, parse_mode), fallbackOpts);
  };
  return ctx.reply(text, opts).catch((err) => {
    if (isEntityParseError(err)) return fallback();
    throw err;
  });
}

function renderMenu(ctx, text, keyboard, options = {}) {
  const opts = menuOptions(keyboard, options);
  const fallback = () => replyMenu(ctx, text, keyboard, options);
  if (ctx.callbackQuery) {
    if (!callbackMessageHasText(ctx)) {
      return ctx.deleteMessage().catch(() => undefined).then(fallback);
    }
    return ctx.editMessageText(text, opts).catch((err) => {
      if (String(err.message).includes('not modified')) return undefined;
      if (isEntityParseError(err)) return fallback();
      throw err;
    });
  }
  return replyMenu(ctx, text, keyboard, options);
}

module.exports = { grid, backButton, paginationRow, fromStoredButtons, renderMenu, replyMenu, plainTextFallback };
