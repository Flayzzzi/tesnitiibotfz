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
const orders = require('../../db/models/orders');
const users = require('../../db/models/users');
const commerce = require('../../db/commerce');
const { e, ef } = require('../../utils/emoji');
const { esc, formatBalance, formatStatus, formatDate, divider } = require('../../utils/format');
const { backButton, renderMenu } = require('../../utils/keyboard');
const { paginate } = require('../../utils/paginate');
const logger = require('../../utils/logger');
const { withInputMenu } = require('../../utils/input_menu');

const PAGE_SIZE = 10;
const FILTERS = ['all', 'pending', 'paid', 'delivered', 'cancelled', 'refunded'];
const FILTER_LABEL = {
  all: 'Все',
  pending: 'Ожидают',
  paid: 'Оплачены',
  delivered: 'Доставлены',
  cancelled: 'Отменены',
  refunded: 'Возврат',
};

async function show(ctx, status = 'all', page = 1) {
  if (!isAdmin(ctx)) return ctx.answerCbQuery('Доступ запрещён').catch(() => {});
  const filter = FILTERS.includes(status) ? status : 'all';
  const total = orders.countAll(filter === 'all' ? null : filter);
  const items = orders.allList({ status: filter === 'all' ? null : filter, page, pageSize: PAGE_SIZE });
  const rows = [];
  for (const o of items) {
    const label = `#${o.id} • ${esc(o.product_name || 'Товар')} • ${formatBalance(o.price_paid)} • ${formatStatus(o.status)}`;
    rows.push([Markup.button.callback(label, `admin:order:view:${o.id}`)]);
  }
  const filterRows = [];
  const half = Math.ceil(FILTERS.length / 2);
  filterRows.push(
    FILTERS.slice(0, half).map((f) => Markup.button.callback(`${FILTER_LABEL[f]}${f === filter ? ' ✓' : ''}`, `admin:orders:${f}:1`))
  );
  filterRows.push(
    FILTERS.slice(half).map((f) => Markup.button.callback(`${FILTER_LABEL[f]}${f === filter ? ' ✓' : ''}`, `admin:orders:${f}:1`))
  );
  const pg = paginate([...Array(total)], page, PAGE_SIZE);
  const nav = [];
  if (pg.hasPrev) nav.push(Markup.button.callback(`${ef('back')} ←`, `admin:orders:${filter}:${pg.page - 1}`));
  if (pg.hasNext) nav.push(Markup.button.callback('→', `admin:orders:${filter}:${pg.page + 1}`));
  if (nav.length) rows.push(nav);
  rows.push([backButton('admin:main')]);
  const text = `${e('orders')} <b>Заказы</b> (${FILTER_LABEL[filter]})${total ? `, всего ${total}` : ''}\n\n${
    items.length ? '' : `${e('cross')} Заказов нет.`
  }`;
  return renderMenu(ctx, text, Markup.inlineKeyboard([...filterRows, ...rows]));
}

async function showDetail(ctx, id) {
  const o = orders.get(id);
  if (!o) return ctx.answerCbQuery('Заказ не найден.').catch(() => {});
  const lines = [
    `${e('orders')} <b>Заказ #${o.id}</b>`,
    divider(),
    `${e('cart')} Товар: <b>${esc(o.product_name || '—')}</b>`,
    `${e('money')} Сумма: <b>${formatBalance(o.price_paid)}</b>`,
    `${e('time')} Дата: ${formatDate(o.created_at)}`,
    `${e('notify')} Статус: ${formatStatus(o.status)}`,
  ];
  if (o.delivery) {
    lines.push('', `${e('check')} <b>Выдано:</b>`, divider(), `<code>${esc(o.delivery)}</code>`, divider());
  }
  const userLabel = o.user_username ? `@${esc(o.user_username)}` : esc(o.user_tg_id || '');
  lines.push('', `${e('profile')} Покупатель: <b>${userLabel}</b>`);

  const rows = [];
  const canDeliver = o.product_type === 'manual' && o.status === 'paid';
  const canRefund = o.status === 'paid' || o.status === 'delivered';
  if (canDeliver) {
    rows.push([Markup.button.callback(`${ef('check')} Выдать товар`, `admin:order:deliver:${o.id}`)]);
  }
  if (canRefund) {
    rows.push([Markup.button.callback(`${ef('money')} Вернуть средства`, `admin:order:refund:${o.id}`)]);
  }
  rows.push([backButton('admin:orders:all:1')]);
  return renderMenu(ctx, lines.join('\n'), Markup.inlineKeyboard(rows));
}

async function deliver(ctx, id) {
  const o = orders.get(id);
  if (!o) return ctx.answerCbQuery('Заказ не найден.').catch(() => {});
  if (o.status !== 'paid') return ctx.answerCbQuery('Заказ уже выдан или отменён.').catch(() => {});
  ctx.session.adminWizard = { flow: 'deliverOrder', step: 0, data: { id } };
  await ctx.answerCbQuery().catch(() => {});
  return ctx.reply(
    `Выдача заказа #${o.id}: <b>${esc(o.product_name || '')}</b>\n\nОтправьте выдачу (логин/пароль, ссылку или иной контент). Возможно несколько строк:`,
    withInputMenu({ parse_mode: 'HTML' })
  );
}

async function onDeliverText(ctx, text) {
  const w = ctx.session.adminWizard;
  if (!w || w.flow !== 'deliverOrder') return false;
  const o = orders.get(w.data.id);
  if (!o || o.status !== 'paid') {
    ctx.session.adminWizard = {};
    return false;
  }
  const delivery = String(text).trim();
  orders.updateDelivery(o.id, delivery);
  const user = users.getUserById(o.user_id);
  ctx.session.adminWizard = {};
  try {
    await ctx.telegram.sendMessage(
      user.tg_id,
      `${e('check')} <b>Заказ #${o.id} доставлен!</b>\n\n${e('cart')} <b>${esc(o.product_name || 'Товар')}</b>\n${divider()}\n<code>${esc(
        delivery
      )}</code>\n${divider()}\n\n${ef('history')} Выдача также сохранена в «Профиль → Мои заказы».`,
      { parse_mode: 'HTML' }
    );
  } catch (err) {
    logger.warn('deliver notify failed', err.message);
  }
  await ctx.reply(`${e('check')} Заказ #${o.id} выдан покупателю.`, { parse_mode: 'HTML' });
  await showDetail(ctx, o.id);
  return true;
}

async function askRefund(ctx, id) {
  const o = orders.get(id);
  if (!o) return ctx.answerCbQuery('Заказ не найден.').catch(() => {});
  if (o.status !== 'paid' && o.status !== 'delivered') {
    return ctx.answerCbQuery('Этот заказ нельзя вернуть.').catch(() => {});
  }
  return renderMenu(
    ctx,
    `${e('cross')} Вернуть <b>${formatBalance(o.price_paid)}</b> по заказу #${o.id} на баланс покупателя?`,
    Markup.inlineKeyboard([
      [Markup.button.callback(`${ef('check')} Да, вернуть`, `admin:order:refundyes:${o.id}`)],
      [Markup.button.callback(`${ef('cross')} Отмена`, `admin:order:view:${o.id}`)],
    ])
  );
}

async function doRefund(ctx, id) {
  const result = commerce.refundOrder(id);
  if (result.kind === 'not_found') return ctx.answerCbQuery('Заказ не найден.').catch(() => {});
  if (result.kind !== 'refunded') {
    return ctx.answerCbQuery('Этот заказ нельзя вернуть.').catch(() => {});
  }
  const { order: o, user } = result;
  logger.info(`order refunded order=${o.id} user=${o.user_id} amount=${o.price_paid}`);
  try {
    await ctx.telegram.sendMessage(
      user.tg_id,
      `${e('check')} <b>Возврат по заказу #${o.id}</b>\n\n${e('money')} ${formatBalance(
        o.price_paid
      )} вернули на баланс.\n\n${e('money')} Текущий баланс: <b>${formatBalance(user.balance)}</b>`,
      { parse_mode: 'HTML' }
    );
  } catch (err) {
    logger.warn('refund notify failed', err.message);
  }
  await ctx.answerCbQuery('Возврат оформлен').catch(() => {});
  return show(ctx, 'all', 1);
}

module.exports = { show, showDetail, deliver, onDeliverText, askRefund, doRefund };
