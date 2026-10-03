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
const config = require('../config');
const { isAdmin } = require('../middleware/isAdmin');
const topup = require('../menus/topup');
const adminCategories = require('../menus/admin/categories');
const adminProducts = require('../menus/admin/products');
const adminOrders = require('../menus/admin/orders');
const adminBroadcast = require('../menus/admin/broadcast');
const adminEditMsg = require('../menus/admin/edit_message');
const startHandler = require('./start');
const { e } = require('../utils/emoji');
const { esc } = require('../utils/format');
const logger = require('../utils/logger');
const { MENU_BUTTON } = require('../utils/input_menu');

module.exports = async (ctx) => {
  const text = String(ctx.message.text || '');

  // Telegram normally attaches a `bot_command` entity to `/start`, but a
  // malformed/forwarded update can arrive as plain text. Let `/start` recover
  // the session before any abandoned wizard is allowed to consume it.
  const startMatch = text.match(/^\/start(?:@([a-z\d_]+))?(?:\s|$)/i);
  const addressedToThisBot = startMatch && (!startMatch[1] || !ctx.me || startMatch[1].toLowerCase() === ctx.me.toLowerCase());
  if (startMatch && addressedToThisBot) return startHandler(ctx);

  if (text === MENU_BUTTON) {
    ctx.session.step = null;
    ctx.session.wizard = {};
    ctx.session.adminWizard = {};
    return require('../menus/main').show(ctx);
  }

  const w = ctx.session.adminWizard;

  if (w && w.flow && isAdmin(ctx)) {
    let handled = false;
    if (w.flow === 'addCategory' || w.flow === 'editCategory') handled = await adminCategories.onMessage(ctx);
    else if (w.flow === 'addProduct') handled = await adminProducts.onMessage(ctx);
    else if (w.flow === 'editProduct') handled = await adminProducts.onEditText(ctx, text);
    else if (w.flow === 'deliverOrder') handled = await adminOrders.onDeliverText(ctx, text);
    else if (w.flow === 'broadcast') handled = await adminBroadcast.onText(ctx, text);
    else if (w.flow === 'edit_menu') handled = await adminEditMsg.handleText(ctx, text);
    if (handled) return;
    return;
  }

  if (ctx.session.step === 'support_msg') {
    return forwardSupport(ctx, text);
  }

  if (ctx.session.step === 'topup_amount') {
    return topup.processAmount(ctx, text);
  }

  const main = require('../menus/main');
  return main.show(ctx);
};

async function forwardSupport(ctx, text) {
  const user = ctx.from;
  const label = user.username ? `@${user.username}` : `${user.first_name || 'Пользователь'}`;
  for (const adminId of config.ADMIN_IDS) {
    try {
      await ctx.telegram.sendMessage(
        adminId,
        `${e('support')} <b>Сообщение от пользователя</b>\n\n${e('profile')} ${esc(label)} (ID: ${user.id})\n\n${esc(text)}`,
        { parse_mode: 'HTML' }
      );
    } catch (err) {
      logger.warn('forward to admin failed', adminId, err.message);
    }
  }
  ctx.session.step = null;
  return ctx.reply(`${e('check')} Отправил! Скоро ответим.`, { parse_mode: 'HTML' });
}
