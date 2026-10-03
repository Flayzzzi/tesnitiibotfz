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
const platega = require('../payments/platega');
const transactions = require('../db/models/transactions');
const users = require('../db/models/users');
const { e, ef } = require('../utils/emoji');
const { formatBalance } = require('../utils/format');
const logger = require('../utils/logger');
const { withInputMenu } = require('../utils/input_menu');

async function askAmount(ctx) {
  ctx.session.step = 'topup_amount';
  ctx.session.adminWizard = {};
  const text = `${e('topup')} <b>Пополнение баланса</b>\n\nВведи сумму в рублях (минимум <b>${config.TOPUP_MIN}₽</b>):`;
  return ctx.reply(text, withInputMenu({ parse_mode: 'HTML' }));
}

async function processAmount(ctx, raw) {
  const amount = Number(String(raw).replace(',', '.'));
  if (!Number.isFinite(amount) || amount <= 0) {
    return ctx.reply(`${e('cross')} Это не похоже на сумму. Введи число, например 100.`, { parse_mode: 'HTML' });
  }
  if (amount < config.TOPUP_MIN) {
    return ctx.reply(`${e('cross')} Минимальная сумма пополнения: ${formatBalance(config.TOPUP_MIN)}.`, {
      parse_mode: 'HTML',
    });
  }
  const user = users.getUserByTg(ctx.from.id);
  if (!user) {
    return ctx.reply(`${e('cross')} Не нашёл тебя в системе. Нажми /start и возвращайся.`, { parse_mode: 'HTML' });
  }
  const orderId = platega.randomUuid();
  ctx.session.step = null;
  try {
    const inv = await platega.createInvoice({ amount, orderId });
    if (!inv || !inv.url) throw new Error('platega returned no url');
    transactions.create({ user_id: user.id, amount, type: 'topup', ref_id: orderId, status: 'pending' });
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.url(`${ef('topup')} Оплатить ${formatBalance(amount)}`, inv.url)],
      [Markup.button.callback(`${ef('cross')} Отмена`, 'topup:cancel')],
    ]);
    logger.info(`topup invoice created user=${user.id} amount=${amount} order=${orderId}`);
    return ctx.reply(
      `${e('topup')} Оплати <b>${formatBalance(amount)}</b> по кнопке ниже. После оплаты баланс пополнится сам.`,
      { parse_mode: 'HTML', reply_markup: keyboard.reply_markup }
    );
  } catch (err) {
    logger.error('create invoice failed', err);
    const messages = [];
    if (!config.PLATEGA_MERCHANT_ID || !config.PLATEGA_SECRET) {
      messages.push(
        `${e('cross')} <b>Оплата временно недоступна.</b>\n\nМы уже решаем этот вопрос, скоро всё заработает. Загляни чуть позже или напиши в поддержку.`
      );
    } else {
      messages.push(`${e('cross')} Не получилось создать платёж. Попробуй ещё раз через пару минут.`);
    }
    return ctx.reply(messages.join('\n'), { parse_mode: 'HTML' });
  }
}

async function cancel(ctx) {
  ctx.session.step = null;
  await ctx.answerCbQuery('Отменено').catch(() => {});
  return require('./main').show(ctx);
}

module.exports = { askAmount, processAmount, cancel };
