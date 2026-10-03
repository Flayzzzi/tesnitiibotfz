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
const users = require('../db/models/users');
const orders = require('../db/models/orders');
const transactions = require('../db/models/transactions');
const { e, ef } = require('../utils/emoji');
const { esc, formatBalance, formatStatus, formatDate, divider } = require('../utils/format');
const { backButton, renderMenu } = require('../utils/keyboard');
const { paginate } = require('../utils/paginate');

const PAGE_SIZE = 5;

function ensureUser(ctx) {
  const existing = users.getUserByTg(ctx.from.id);
  if (existing) return existing;
  users.upsertUser({
    tg_id: ctx.from.id,
    username: ctx.from.username || null,
    first_name: ctx.from.first_name || null,
  });
  return users.getUserByTg(ctx.from.id);
}

async function showProfile(ctx) {
  const user = ensureUser(ctx);
  const spent = users.spent(user.id);
  const text = `${e('profile')} <b>Профиль</b>\n\n${e('money')} Баланс: <b>${formatBalance(user.balance)}</b>\n${
    e('history')
  } Потрачено: ${formatBalance(spent)}\n\n${e('notify')} Уведомления: <b>${user.notify_stock ? 'ВКЛ' : 'ВЫКЛ'}</b>`;
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('📄 Мои заказы', 'profile:orders:1')],
    [Markup.button.callback('📈 История пополнений', 'profile:topups:1')],
    [Markup.button.callback('💰 Пополнить баланс', 'menu:topup')],
    [Markup.button.callback(`🔔 Уведомления: ${user.notify_stock ? 'ВКЛ' : 'ВЫКЛ'}`, 'profile:notify')],
    [backButton('menu:main')],
  ]);
  return renderMenu(ctx, text, keyboard);
}

async function showOrders(ctx, page) {
  const user = ensureUser(ctx);
  const total = orders.countByUser(user.id);
  const items = orders.listByUser(user.id, page, PAGE_SIZE);
  return renderOrderList(ctx, items, total, page, `${e('orders')} <b>Мои заказы</b>`);
}

async function showTopups(ctx, page) {
  const user = ensureUser(ctx);
  const total = transactions.countByUser(user.id, 'topup');
  const items = transactions.listByUser(user.id, { type: 'topup', page, pageSize: PAGE_SIZE });
  const body = items
    .map((t) => {
      const sign = t.status === 'paid' ? '+' : '';
      return `${e('topup')} ${sign}${formatBalance(Math.abs(t.amount))} • ${formatStatus(t.status)} • ${formatDate(t.created_at)}`;
    })
    .join('\n\n');
  const title = `${e('history')} <b>История пополнений</b>`;
  const rows = [];
  for (let i = 0; i < items.length; i++) {
    rows.push([Markup.button.callback(`${e('topup')} ${formatDate(items[i].created_at)}`, 'noop')]);
  }
  const pg = paginate([...Array(total)], page, PAGE_SIZE);
  const nav = [];
  if (pg.hasPrev) nav.push(Markup.button.callback(`${ef('back')} ←`, `profile:topups:${page - 1}`));
  if (pg.hasNext) nav.push(Markup.button.callback('→', `profile:topups:${page + 1}`));
  if (nav.length) rows.push(nav);
  rows.push([backButton('profile:main')]);
  return renderMenu(ctx, `${title}\n\n${body || `${e('cross')} Пока пусто.`}`, Markup.inlineKeyboard(rows));
}

async function renderOrderList(ctx, items, total, page, title) {
  const rows = [];
  for (const o of items) {
    rows.push([
      Markup.button.callback(`${e('cart')} #${o.id} • ${formatBalance(o.price_paid)} • ${formatStatus(o.status)}`, 'noop'),
      Markup.button.callback('👁', `profile:order:${o.id}`),
    ]);
  }
  const pg = paginate([...Array(total)], page, PAGE_SIZE);
  const nav = [];
  if (pg.hasPrev) nav.push(Markup.button.callback(`${ef('back')} ←`, `profile:orders:${page - 1}`));
  if (pg.hasNext) nav.push(Markup.button.callback('→', `profile:orders:${page + 1}`));
  if (nav.length) rows.push(nav);
  rows.push([backButton('profile:main')]);
  const text = items.length
    ? `${title} (${total})\n\n${items
        .map(
          (o) =>
            `${e('cart')} <b>#${o.id}</b> ${o.product_name ? esc(o.product_name) : 'Товар'}\n${e('money')} ${formatBalance(
              o.price_paid
            )} • ${formatStatus(o.status)}\n${e('time')} ${formatDate(o.created_at)}`
        )
        .join('\n\n')}`
    : `${title}\n\n${e('cross')} Пока пусто.`;
  return renderMenu(ctx, text, Markup.inlineKeyboard(rows));
}

async function showOrder(ctx, orderId) {
  const user = ensureUser(ctx);
  const o = orders.get(orderId);
  if (!o || o.user_id !== user.id) {
    return ctx.answerCbQuery('Заказ не найден.').catch(() => {});
  }
  const lines = [
    `${e('orders')} <b>Заказ #${o.id}</b>`,
    divider(),
    `${e('cart')} Товар: <b>${o.product_name ? esc(o.product_name) : '—'}</b>`,
    `${e('money')} Сумма: <b>${formatBalance(o.price_paid)}</b>`,
    `${e('time')} Дата: ${formatDate(o.created_at)}`,
    `${e('notify')} Статус: ${formatStatus(o.status)}`,
  ];
  if (o.delivery) {
    lines.push('', `${e('check')} <b>Выданный товар:</b>`, divider(), `<code>${esc(o.delivery)}</code>`, divider());
  } else if (o.status === 'paid') {
    lines.push('', `${e('admin')} Ожидает выдачи администратором.`);
  }
  const kb = Markup.inlineKeyboard([
    [Markup.button.callback(`${ef('support')} Обратиться в поддержку`, 'support:write')],
    [backButton('profile:orders:1')],
  ]);
  return renderMenu(ctx, lines.join('\n'), kb);
}

async function toggleNotifications(ctx) {
  const user = ensureUser(ctx);
  users.updateNotify(user.id, user.notify_stock ? 0 : 1);
  await ctx.answerCbQuery('Обновлено').catch(() => {});
  return showProfile(ctx);
}

module.exports = { showProfile, showOrders, showOrder, showTopups, toggleNotifications };
