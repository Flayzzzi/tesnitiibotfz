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

const MENU_BUTTON = '🏠 Меню';

function inputMenu() {
  return Markup.keyboard([[MENU_BUTTON]]).resize().persistent();
}

function withInputMenu(options = {}) {
  return { ...options, reply_markup: inputMenu().reply_markup };
}

module.exports = { MENU_BUTTON, inputMenu, withInputMenu };
