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
const main = require('../menus/main');
const logger = require('../utils/logger');

module.exports = async (ctx) => {
  logger.debug('/start handler entered', {
    chatId: ctx.chat && ctx.chat.id,
    userId: ctx.from && ctx.from.id,
    payload: ctx.startPayload || '',
  });

  // `/start` is the recovery entry point. A user may have left the bot while
  // filling in a form, so do not retain a stale wizard step when reopening it.
  ctx.session.step = null;
  ctx.session.wizard = {};
  ctx.session.adminWizard = {};

  try {
    const message = await main.show(ctx);
    logger.debug('/start main menu sent', {
      chatId: ctx.chat && ctx.chat.id,
      messageId: message && message.message_id,
    });
    return message;
  } catch (err) {
    logger.error('/start main menu failed', {
      chatId: ctx.chat && ctx.chat.id,
      userId: ctx.from && ctx.from.id,
      error: err && err.stack ? err.stack : String(err),
    });
    throw err;
  }
};
