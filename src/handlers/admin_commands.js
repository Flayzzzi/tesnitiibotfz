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
const adminIndex = require('../menus/admin/index');

module.exports = async (ctx) => {
  if (!isAdmin(ctx)) {
    return ctx.reply('Доступ запрещён.', { parse_mode: 'HTML' });
  }
  return adminIndex.show(ctx);
};
