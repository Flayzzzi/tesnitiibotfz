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
const { withInputMenu } = require('../utils/input_menu');
const { formatCustomEmojisForParseMode } = require('../utils/markdown');

function buildKeyboard(ctx) {
  const edited = content.get('support');
  const rows = edited && edited.buttons
    ? fromStoredButtons(edited.buttons).reply_markup.inline_keyboard
    : [
        [Markup.button.callback('✉️ Написать в поддержку', 'support:write')],
        [backButton('menu:main')],
      ];
  if (config.ADMIN_IDS.includes(ctx.from && ctx.from.id)) {
    rows.push([
      Markup.button.callback('✏️ Редактировать', 'admin:edit:support'),
      Markup.button.callback('🔄 Сбросить', 'admin:reset:support'),
    ]);
  }
  return Markup.inlineKeyboard(rows);
}

async function showSupport(ctx) {
  const stored = content.get('support');
  const template = stored && stored.text ? stored.text : content.getDefaultText('support');
  const parseMode = content.getParseMode('support');
  const text = formatCustomEmojisForParseMode(content.renderTemplate(template), parseMode);
  const res = await renderMenu(ctx, text, buildKeyboard(ctx), { parse_mode: parseMode });
  ctx.session.lastView = 'support';
  ctx.session.lastViewMsgId = res && res.message_id ? res.message_id : ctx.session.lastViewMsgId;
  return res;
}

async function startWrite(ctx) {
  ctx.session.step = 'support_msg';
  await ctx.reply('💬 Опиши проблему одним сообщением. Если есть номер заказа, приложи его.', withInputMenu({
    parse_mode: 'HTML',
  }));
  await ctx.answerCbQuery().catch(() => {});
}

module.exports = { showSupport, startWrite };
