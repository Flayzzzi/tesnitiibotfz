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
const content = require('../content');
const config = require('../config');
const { backButton, fromStoredButtons, renderMenu } = require('../utils/keyboard');
const { formatCustomEmojisForParseMode } = require('../utils/markdown');

function buildKeyboard(ctx) {
  const edited = content.get('about');
  const rows = edited && edited.buttons
    ? fromStoredButtons(edited.buttons).reply_markup.inline_keyboard
    : [[backButton('menu:main')]];
  if (config.ADMIN_IDS.includes(ctx.from && ctx.from.id)) {
    rows.push([
      Markup.button.callback('✏️ Редактировать', 'admin:edit:about'),
      Markup.button.callback('🔄 Сбросить', 'admin:reset:about'),
    ]);
  }
  return Markup.inlineKeyboard(rows);
}

async function showAbout(ctx) {
  const stored = content.get('about');
  const template = stored && stored.text ? stored.text : content.getDefaultText('about');
  const parseMode = content.getParseMode('about');
  const text = formatCustomEmojisForParseMode(content.renderTemplate(template), parseMode);
  const res = await renderMenu(ctx, text, buildKeyboard(ctx), { parse_mode: parseMode });
  ctx.session.lastView = 'about';
  ctx.session.lastViewMsgId = res && res.message_id ? res.message_id : ctx.session.lastViewMsgId;
  return res;
}

module.exports = { showAbout };
