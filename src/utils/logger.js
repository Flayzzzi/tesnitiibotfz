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
const { LOG_LEVEL } = require('../config');

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const level = LEVELS[LOG_LEVEL] ?? LEVELS.info;

const ts = () => new Date().toISOString();

function log(lvl, args) {
  if (LEVELS[lvl] <= level) {
    console.log(`${ts()} [${lvl.toUpperCase()}]`, ...args);
  }
}

module.exports = {
  error: (...a) => log('error', a),
  warn: (...a) => log('warn', a),
  info: (...a) => log('info', a),
  debug: (...a) => log('debug', a),
};
