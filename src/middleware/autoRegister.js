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
const users = require('../db/models/users');
const logger = require('../utils/logger');

module.exports = (ctx, next) => {
  if (ctx.from) {
    try {
      users.upsertUser({
        tg_id: ctx.from.id,
        username: ctx.from.username || null,
        first_name: ctx.from.first_name || null,
      });
    } catch (err) {
      logger.error('autoRegister failed', err);
    }
  }
  return next();
};
