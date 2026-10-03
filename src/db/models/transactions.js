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

function create({ user_id, amount, type, ref_id = null, status = 'pending' }) {
  const info = db
    .prepare(
      'INSERT INTO transactions (user_id, amount, type, ref_id, status) VALUES (?, ?, ?, ?, ?)'
    )
    .run(user_id, amount, type, ref_id, status);
  return info.lastInsertRowid;
}

function get(id) {
  return db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
}

function getByRef(ref_id) {
  return db.prepare('SELECT * FROM transactions WHERE ref_id = ?').get(ref_id);
}

function markStatus(id, status) {
  db.prepare('UPDATE transactions SET status = ? WHERE id = ?').run(status, id);
}

function listByUser(userId, { type = null, page = 1, pageSize = 5 } = {}) {
  const offset = (page - 1) * pageSize;
  const where = ['user_id = ?'];
  const params = [userId];
  if (type) {
    where.push('type = ?');
    params.push(type);
  }
  return db
    .prepare(`SELECT * FROM transactions WHERE ${where.join(' AND ')} ORDER BY id DESC LIMIT ? OFFSET ?`)
    .all(...params, pageSize, offset);
}

function countByUser(userId, type = null) {
  if (type) return db.prepare('SELECT COUNT(*) AS c FROM transactions WHERE user_id = ? AND type = ?').get(userId, type).c;
  return db.prepare('SELECT COUNT(*) AS c FROM transactions WHERE user_id = ?').get(userId).c;
}

module.exports = { create, get, getByRef, markStatus, listByUser, countByUser };
