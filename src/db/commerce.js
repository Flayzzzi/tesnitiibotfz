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

function contentLines(content) {
  return String(content || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

const purchase = db.transaction(({ userId, productId }) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
  if (!product || !product.visible) return { kind: 'unavailable' };

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return { kind: 'user_missing' };
  if (Number(user.balance) < Number(product.price)) return { kind: 'insufficient_funds', user, product };

  let delivery = null;
  if (product.type === 'auto') {
    const lines = contentLines(product.content);
    if (product.stock <= 0 || !lines.length) return { kind: 'out_of_stock', product };
    delivery = lines.shift();
    db.prepare('UPDATE products SET content = ?, stock = ? WHERE id = ?').run(lines.join('\n'), lines.length, product.id);
  }

  const order = db
    .prepare('INSERT INTO orders (user_id, product_id, price_paid, status, delivery) VALUES (?, ?, ?, ?, ?)')
    .run(user.id, product.id, product.price, product.type === 'auto' ? 'delivered' : 'paid', delivery);
  const balanceUpdate = db
    .prepare('UPDATE users SET balance = round(balance - ?, 2) WHERE id = ? AND balance >= ?')
    .run(product.price, user.id, product.price);
  if (balanceUpdate.changes !== 1) throw new Error('purchase balance changed before checkout completed');
  db.prepare('INSERT INTO transactions (user_id, amount, type, ref_id, status) VALUES (?, ?, ?, ?, ?)').run(
    user.id,
    product.price,
    'purchase',
    `order-${order.lastInsertRowid}`,
    'paid'
  );

  const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  return {
    kind: 'purchased',
    orderId: order.lastInsertRowid,
    product,
    delivery,
    balance: updatedUser.balance,
  };
});

const refundOrder = db.transaction((orderId) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return { kind: 'not_found' };
  if (order.status !== 'paid' && order.status !== 'delivered') return { kind: 'ineligible', order };

  const changed = db
    .prepare("UPDATE orders SET status = 'refunded' WHERE id = ? AND status IN ('paid', 'delivered')")
    .run(order.id);
  if (changed.changes !== 1) return { kind: 'ineligible', order };
  db.prepare('UPDATE users SET balance = round(balance + ?, 2) WHERE id = ?').run(order.price_paid, order.user_id);
  db.prepare('INSERT INTO transactions (user_id, amount, type, ref_id, status) VALUES (?, ?, ?, ?, ?)').run(
    order.user_id,
    order.price_paid,
    'refund',
    `order-${order.id}`,
    'paid'
  );
  return { kind: 'refunded', order, user: db.prepare('SELECT * FROM users WHERE id = ?').get(order.user_id) };
});

const settleTopup = db.transaction(({ orderId, status, amount }) => {
  const tx = db.prepare('SELECT * FROM transactions WHERE ref_id = ?').get(orderId);
  if (!tx || tx.type !== 'topup') return { kind: 'not_found' };
  if (!Number.isFinite(amount) || Math.abs(amount - Number(tx.amount)) > 0.01) return { kind: 'amount_mismatch', tx };

  if (status === 'CONFIRMED') {
    if (tx.status !== 'pending') return { kind: 'ignored', tx };
    db.prepare("UPDATE transactions SET status = 'paid' WHERE id = ? AND status = 'pending'").run(tx.id);
    db.prepare('UPDATE users SET balance = round(balance + ?, 2) WHERE id = ?').run(tx.amount, tx.user_id);
    return { kind: 'credited', tx, user: db.prepare('SELECT * FROM users WHERE id = ?').get(tx.user_id) };
  }

  if (status === 'CANCELED') {
    if (tx.status !== 'pending') return { kind: 'ignored', tx };
    db.prepare("UPDATE transactions SET status = 'failed' WHERE id = ? AND status = 'pending'").run(tx.id);
    return { kind: 'failed', tx };
  }

  if (status === 'CHARGEBACKED') {
    if (tx.status !== 'paid') return { kind: 'ignored', tx };
    db.prepare("UPDATE transactions SET status = 'refunded' WHERE id = ? AND status = 'paid'").run(tx.id);
    db.prepare('UPDATE users SET balance = round(balance - ?, 2) WHERE id = ?').run(tx.amount, tx.user_id);
    return { kind: 'chargebacked', tx, user: db.prepare('SELECT * FROM users WHERE id = ?').get(tx.user_id) };
  }

  return { kind: 'ignored', tx };
});

module.exports = { purchase, refundOrder, settleTopup };
