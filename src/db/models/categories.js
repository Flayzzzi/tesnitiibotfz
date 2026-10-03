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

const FIELDS = ['name', 'emoji_key', 'image_url', 'sort_order', 'visible'];

function all(onlyVisible = false) {
  let sql = 'SELECT * FROM categories';
  if (onlyVisible) sql += ' WHERE visible = 1';
  sql += ' ORDER BY sort_order ASC, id ASC';
  return db.prepare(sql).all();
}

function get(id) {
  return db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
}

function create({ name, emoji_key = null, image_url = null }) {
  const max = db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM categories').get().m;
  const info = db
    .prepare('INSERT INTO categories (name, emoji_key, image_url, sort_order) VALUES (?, ?, ?, ?)')
    .run(name, emoji_key, image_url, max + 1);
  return info.lastInsertRowid;
}

function update(id, patch) {
  const keys = Object.keys(patch).filter((k) => FIELDS.includes(k));
  if (!keys.length) return;
  const set = keys.map((k) => `${k} = ?`).join(', ');
  const values = keys.map((k) => patch[k]);
  db.prepare(`UPDATE categories SET ${set} WHERE id = ?`).run(...values, id);
}

function remove(id) {
  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
}

function move(id, direction) {
  const list = all();
  const i = list.findIndex((c) => c.id === id);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= list.length) return false;
  const a = list[i];
  const b = list[j];
  const swap = db.transaction(() => {
    db.prepare('UPDATE categories SET sort_order = ? WHERE id = ?').run(b.sort_order, a.id);
    db.prepare('UPDATE categories SET sort_order = ? WHERE id = ?').run(a.sort_order, b.id);
  });
  swap();
  return true;
}

module.exports = { all, get, create, update, remove, move };
