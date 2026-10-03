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
const notifications = require('../db/models/notifications');
const { e } = require('../utils/emoji');
const { esc } = require('../utils/format');
const logger = require('../utils/logger');

let bot = null;

function setBot(instance) {
  bot = instance;
}

async function notifyStockSubscribers(productId, productName) {
  if (!bot) return 0;
  const subs = notifications.byProduct(productId);
  if (!subs.length) return 0;
  let sent = 0;
  const sentUserIds = [];
  const text = `${e('notify')} Товар <b>${esc(productName)}</b> снова в наличии!`;
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('Посмотреть товар', `catalog:product:${productId}`)],
  ]);
  for (const s of subs) {
    try {
      await bot.telegram.sendMessage(s.tg_id, text, { parse_mode: 'HTML', reply_markup: keyboard.reply_markup });
      sent++;
      sentUserIds.push(s.user_id);
    } catch (err) {
      logger.warn('stock notify failed', s.tg_id, err.message);
    }
  }
  notifications.clearForUsers(productId, sentUserIds);
  logger.info(`stock notification sent to ${sent} subscribers for product ${productId}`);
  return sent;
}

module.exports = { setBot, notifyStockSubscribers };
