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
const db = require('../index');

function upsertUser({ tg_id, username = null, first_name = null }) {
  const existing = db.prepare('SELECT id FROM users WHERE tg_id = ?').get(tg_id);
  if (existing) {
    db.prepare(
      'UPDATE users SET username = COALESCE(?, username), first_name = COALESCE(?, first_name) WHERE tg_id = ?'
    ).run(username, first_name, tg_id);
    return existing.id;
  }
  const info = db
    .prepare('INSERT INTO users (tg_id, username, first_name) VALUES (?, ?, ?)')
    .run(tg_id, username, first_name);
  return info.lastInsertRowid;
}

function getUserByTg(tg_id) {
  return db.prepare('SELECT * FROM users WHERE tg_id = ?').get(tg_id);
}

function getUserById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function addBalance(userId, amount) {
  db.prepare('UPDATE users SET balance = round(balance + ?, 2) WHERE id = ?').run(amount, userId);
}

function deductBalance(userId, amount) {
  // Guard against overdraw: never let a balance go negative. Returns whether
  // the deduction actually applied so callers can react to insufficient funds.
  const info = db
    .prepare('UPDATE users SET balance = round(balance - ?, 2) WHERE id = ? AND balance >= ?')
    .run(amount, userId, amount);
  return info.changes === 1;
}

function updateNotify(userId, value) {
  db.prepare('UPDATE users SET notify_stock = ? WHERE id = ?').run(value ? 1 : 0, userId);
}

function spent(userId) {
  const row = db
    .prepare(
      "SELECT COALESCE(SUM(amount), 0) AS s FROM transactions WHERE user_id = ? AND type = 'purchase' AND status = 'paid'"
    )
    .get(userId);
  return Number(row.s) || 0;
}

function count() {
  return db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
}

function all() {
  return db.prepare('SELECT * FROM users ORDER BY id ASC').all();
}

function allTgIds() {
  return db.prepare('SELECT tg_id FROM users').all().map((r) => r.tg_id);
}

module.exports = {
  upsertUser,
  getUserByTg,
  getUserById,
  addBalance,
  deductBalance,
  updateNotify,
  spent,
  count,
  all,
  allTgIds,
};
