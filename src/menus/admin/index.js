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
const { isAdmin } = require('../../middleware/isAdmin');
const { e, ef } = require('../../utils/emoji');
const { backButton, renderMenu } = require('../../utils/keyboard');

async function show(ctx) {
  if (!isAdmin(ctx)) {
    await ctx.answerCbQuery('Доступ запрещён').catch(() => {});
    return;
  }
  const text = `${e('admin')} <b>Админ-панель</b>`;
  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback(`${ef('list')} Категории`, 'admin:categories:1'),
      Markup.button.callback(`${ef('catalog')} Товары`, 'admin:products:1'),
    ],
    [
      Markup.button.callback(`${ef('orders')} Заказы`, 'admin:orders:all:1'),
      Markup.button.callback(`${ef('send')} Рассылка`, 'admin:bcast'),
    ],
    [Markup.button.callback(`${ef('stats')} Статистика`, 'admin:stats')],
    [backButton('menu:main', `${ef('cross')} Выйти`)],
  ]);
  return renderMenu(ctx, text, keyboard);
}

module.exports = { show };
