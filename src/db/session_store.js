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
const db = require('./index');
const logger = require('../utils/logger');

const store = {
  async get(key) {
    const row = db.prepare('SELECT data FROM sessions WHERE key = ?').get(key);
    if (!row) return undefined;

    try {
      return JSON.parse(row.data);
    } catch (err) {
      // A bad session must not prevent every subsequent update from reaching
      // the bot. Drop it and let the session middleware start a clean one.
      logger.warn('discarding invalid session', key, err.message);
      db.prepare('DELETE FROM sessions WHERE key = ?').run(key);
      return undefined;
    }
  },
  async set(key, value) {
    db.prepare(
      `INSERT INTO sessions (key, data, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
    ).run(key, JSON.stringify(value));
  },
  async delete(key) {
    db.prepare('DELETE FROM sessions WHERE key = ?').run(key);
  },
};

module.exports = store;
