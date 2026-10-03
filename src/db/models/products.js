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

const FIELDS = ['category_id', 'name', 'description', 'price', 'type', 'content', 'stock', 'image_url', 'visible'];

function all({ visibleOnly = false, categoryId = null } = {}) {
  const where = [];
  const params = [];
  if (visibleOnly) where.push('p.visible = 1');
  if (categoryId) where.push('p.category_id = ?');
  if (categoryId) params.push(categoryId);
  const sql = `SELECT p.*, c.name AS category_name
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY p.id DESC`;
  return db.prepare(sql).all(...params);
}

function get(id) {
  return db
    .prepare(
      `SELECT p.*, c.name AS category_name
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.id = ?`
    )
    .get(id);
}

function create({ category_id, name, description = '', price, type = 'auto', content = null, stock = 0, image_url = null, visible = 1 }) {
  const info = db
    .prepare(
      `INSERT INTO products (category_id, name, description, price, type, content, stock, image_url, visible)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(category_id, name, description, price, type, content, stock, image_url, visible);
  return info.lastInsertRowid;
}

function update(id, patch) {
  const keys = Object.keys(patch).filter((k) => FIELDS.includes(k));
  if (!keys.length) return;
  const set = keys.map((k) => `${k} = ?`).join(', ');
  const values = keys.map((k) => patch[k]);
  db.prepare(`UPDATE products SET ${set} WHERE id = ?`).run(...values, id);
}

function remove(id) {
  const del = db.transaction(() => {
    db.prepare('UPDATE orders SET product_id = NULL WHERE product_id = ?').run(id);
    db.prepare('DELETE FROM stock_notifications WHERE product_id = ?').run(id);
    db.prepare('DELETE FROM products WHERE id = ?').run(id);
  });
  del();
}

function contentLines(product) {
  return String(product.content || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

function popContentLine(id) {
  const pop = db.transaction(() => {
    const p = get(id);
    if (!p) return null;
    const lines = contentLines(p);
    if (!lines.length) return null;
    const line = lines.shift();
    db.prepare('UPDATE products SET content = ?, stock = MAX(0, stock - 1) WHERE id = ?').run(lines.join('\n'), id);
    return line;
  });
  return pop();
}

function addStock(id, newLines) {
  const add = db.transaction(() => {
    const p = get(id);
    if (!p) return false;
    const wasZero = p.type === 'auto' && p.stock <= 0;
    const lines = contentLines(p).concat(newLines.filter(Boolean));
    db.prepare('UPDATE products SET content = ?, stock = ? WHERE id = ?').run(lines.join('\n'), lines.length, id);
    return wasZero;
  });
  return add();
}

function lowStock(threshold = 3) {
  return db
    .prepare(`SELECT * FROM products WHERE type = 'auto' AND stock <= ? ORDER BY stock ASC`)
    .all(threshold);
}

function count() {
  return db.prepare('SELECT COUNT(*) AS c FROM products').get().c;
}

// Exported for admin module compatibility
function setType(id, type) {
  db.prepare('UPDATE products SET type = ? WHERE id = ?').run(type, id);
}

function setEditVisibility(id, visible) {
  db.prepare('UPDATE products SET visible = ? WHERE id = ?').run(visible, id);
}

function toggle(id) {
  const p = get(id);
  if (!p) return;
  db.prepare('UPDATE products SET visible = ? WHERE id = ?').run(p.visible ? 0 : 1, id);
}

module.exports = { all, get, create, update, remove, contentLines, popContentLine, addStock, lowStock, count, setType, setEditVisibility, toggle };
