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

function subscribe(userId, productId) {
  db.prepare('INSERT OR IGNORE INTO stock_notifications (user_id, product_id) VALUES (?, ?)').run(userId, productId);
}

function unsubscribe(userId, productId) {
  db.prepare('DELETE FROM stock_notifications WHERE user_id = ? AND product_id = ?').run(userId, productId);
}

function isSubscribed(userId, productId) {
  return !!db.prepare('SELECT 1 AS x FROM stock_notifications WHERE user_id = ? AND product_id = ?').get(userId, productId);
}

function byProduct(productId) {
  return db
    .prepare(
      `SELECT n.id, n.user_id, n.product_id, u.tg_id
       FROM stock_notifications n
       JOIN users u ON u.id = n.user_id
       WHERE n.product_id = ? AND u.notify_stock = 1`
    )
    .all(productId);
}

function clearProduct(productId) {
  db.prepare('DELETE FROM stock_notifications WHERE product_id = ?').run(productId);
}

function clearForUsers(productId, userIds) {
  const ids = [...new Set(userIds)].filter(Number.isInteger);
  if (!ids.length) return;
  const placeholders = ids.map(() => '?').join(', ');
  db.prepare(`DELETE FROM stock_notifications WHERE product_id = ? AND user_id IN (${placeholders})`).run(productId, ...ids);
}

module.exports = { subscribe, unsubscribe, isSubscribed, byProduct, clearProduct, clearForUsers };
