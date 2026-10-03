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
const users = require('../../db/models/users');
const orders = require('../../db/models/orders');
const products = require('../../db/models/products');
const { e } = require('../../utils/emoji');
const { esc, formatBalance } = require('../../utils/format');
const { backButton, renderMenu } = require('../../utils/keyboard');

async function show(ctx) {
  if (!isAdmin(ctx)) return ctx.answerCbQuery('Доступ запрещён').catch(() => {});
  const userCount = users.count();
  const revenue = orders.revenue();
  const orderCount = orders.countAll();
  const low = products.lowStock(3);
  const lowText = low.length
    ? low.map((p) => `${e('cross')} ${esc(p.name)} (${p.stock} шт.)`).join('\n')
    : `${e('check')} Все товары в наличии.`;
  const text = `${e('stats')} <b>Статистика</b>\n\n${e('profile')} Пользователей: <b>${userCount}</b>\n${
    e('money')
  } Выручка: <b>${formatBalance(revenue)}</b>\n${e('orders')} Заказов: <b>${orderCount}</b>\n\n${e(
    'notify'
  )} <b>Заканчиваются (≤3):</b>\n${lowText}`;
  return renderMenu(ctx, text, Markup.inlineKeyboard([[backButton('admin:main')]]));
}

module.exports = { show };
