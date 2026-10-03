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
const config = require('../config');
const users = require('../db/models/users');
const content = require('../content');
const { formatBalance } = require('../utils/format');
const { markdownEmoji } = require('../utils/emoji');
const { fromStoredButtons } = require('../utils/keyboard');
const { renderCatalogView } = require('../utils/catalog_view');
const { escapeMarkdownV2Literal, restoreCustomEmojiMarkers } = require('../utils/markdown');

function buildMenu(ctx) {
  const edited = content.get('main');
  const rows = edited && edited.buttons
    ? fromStoredButtons(edited.buttons).reply_markup.inline_keyboard
    : [
        [
          Markup.button.callback('🗂 Каталог', 'menu:catalog'),
          Markup.button.callback('💰 Пополнить', 'menu:topup'),
        ],
        [Markup.button.callback('👤 Профиль', 'menu:profile')],
        [
          Markup.button.callback('ℹ О магазине', 'menu:about'),
          Markup.button.callback('💭 Поддержка', 'menu:support'),
        ],
      ];
  if (config.ADMIN_IDS.includes(ctx.from && ctx.from.id)) {
    rows.push([Markup.button.callback('⚙️ Админ-панель', 'menu:admin')]);
    rows.push([
      Markup.button.callback('✏️ Редактировать', 'admin:edit:main'),
      Markup.button.callback('🔄 Сбросить', 'admin:reset:main'),
    ]);
  }
  return Markup.inlineKeyboard(rows);
}

async function show(ctx) {
  const user = users.getUserByTg(ctx.from && ctx.from.id);
  const stored = content.get('main');
  const template = stored && stored.text ? stored.text : content.getDefaultText('main');
  const text = content.renderTemplate(template, {
    balance: formatBalance(user ? user.balance : 0),
    username: escapeMarkdownV2Literal((ctx.from && (ctx.from.username || ctx.from.first_name)) || 'покупатель'),
    first_name: escapeMarkdownV2Literal((ctx.from && ctx.from.first_name) || ''),
    nickname: escapeMarkdownV2Literal((ctx.from && (ctx.from.first_name || ctx.from.username)) || ''),
    user_id: (ctx.from && ctx.from.id) || '',
    welcome_emoji: markdownEmoji('welcome'),
  });
  // Telegram renders a photo above its caption in one message bubble. This
  // keeps the banner, MarkdownV2 text, and inline buttons together.
  const parseMode = content.getParseMode('main');
  const caption = parseMode === 'MarkdownV2' ? restoreCustomEmojiMarkers(text) : text;
  const res = await renderCatalogView(ctx, caption, buildMenu(ctx), content.getImage('main'), {
    parse_mode: parseMode,
  });
  ctx.session.lastView = 'main';
  ctx.session.lastViewMsgId = res && res.message_id ? res.message_id : ctx.session.lastViewMsgId;
  return res;
}

module.exports = { show };
