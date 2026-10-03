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

const ORDER_COLUMNS = `o.*, p.name AS product_name, p.type AS product_type,
  u.tg_id AS user_tg_id, u.username AS user_username`;

function create({ user_id, product_id, price_paid, status = 'pending', delivery = null }) {
  const info = db
    .prepare(
      'INSERT INTO orders (user_id, product_id, price_paid, status, delivery) VALUES (?, ?, ?, ?, ?)'
    )
    .run(user_id, product_id, price_paid, status, delivery);
  return info.lastInsertRowid;
}

function get(id) {
  return db
    .prepare(
      `SELECT ${ORDER_COLUMNS}
       FROM orders o
       LEFT JOIN products p ON p.id = o.product_id
       LEFT JOIN users u ON u.id = o.user_id
       WHERE o.id = ?`
    )
    .get(id);
}

function listByUser(userId, page = 1, pageSize = 5) {
  const offset = (page - 1) * pageSize;
  return db
    .prepare(
      `SELECT ${ORDER_COLUMNS}
       FROM orders o
       LEFT JOIN products p ON p.id = o.product_id
       LEFT JOIN users u ON u.id = o.user_id
       WHERE o.user_id = ?
       ORDER BY o.id DESC
       LIMIT ? OFFSET ?`
    )
    .all(userId, pageSize, offset);
}

function countByUser(userId) {
  return db.prepare('SELECT COUNT(*) AS c FROM orders WHERE user_id = ?').get(userId).c;
}

function allList({ status = null, page = 1, pageSize = 10 } = {}) {
  const offset = (page - 1) * pageSize;
  const where = status ? 'WHERE o.status = ?' : '';
  const params = status ? [status] : [];
  return db
    .prepare(
      `SELECT ${ORDER_COLUMNS}
       FROM orders o
       LEFT JOIN products p ON p.id = o.product_id
       LEFT JOIN users u ON u.id = o.user_id
       ${where}
       ORDER BY o.id DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, pageSize, offset);
}

function updateStatus(id, status) {
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, id);
}

function updateDelivery(id, delivery) {
  db.prepare("UPDATE orders SET delivery = ?, status = ? WHERE id = ?").run(delivery, 'delivered', id);
}

function countAll(status = null) {
  if (status) return db.prepare('SELECT COUNT(*) AS c FROM orders WHERE status = ?').get(status).c;
  return db.prepare('SELECT COUNT(*) AS c FROM orders').get().c;
}

function revenue() {
  const row = db
    .prepare(
      "SELECT COALESCE(SUM(price_paid), 0) AS s FROM orders WHERE status IN ('paid', 'delivered')"
    )
    .get();
  return Number(row.s) || 0;
}

module.exports = { create, get, listByUser, countByUser, allList, updateStatus, updateDelivery, countAll, revenue };
