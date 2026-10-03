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
const { e } = require('./emoji');

function esc(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtNum(n) {
  return (Math.round(Number(n) * 100) / 100).toFixed(2);
}

function formatBalance(n) {
  return `${fmtNum(n)}₽`;
}

const STATUS_META = {
  pending: { key: 'st_pending', label: 'Ожидает' },
  paid: { key: 'st_paid', label: 'Оплачен' },
  delivered: { key: 'st_delivered', label: 'Доставлен' },
  cancelled: { key: 'st_cancelled', label: 'Отменён' },
  refunded: { key: 'st_refunded', label: 'Возврат' },
  failed: { key: 'st_failed', label: 'Ошибка' },
};

function formatStatus(status) {
  const meta = STATUS_META[status] || { key: null, label: status };
  return `${meta.key ? e(meta.key) : ''} ${meta.label}`.trim();
}

function formatDate(dt) {
  if (!dt) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(String(dt));
  if (!m) return String(dt);
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatOrder(o) {
  return `${e('cart')} <b>#${o.id}</b> ${esc(o.product_name || 'Товар')}\n${e('money')} ${formatBalance(
    o.price_paid
  )} • ${formatStatus(o.status)}\n${e('time')} ${formatDate(o.created_at)}`;
}

function divider() {
  return '<code>──────────────</code>';
}

function formatProduct(p) {
  const lines = [
    `${e('catalog')} <b>${esc(p.name)}</b>`,
    divider(),
    esc(p.description || '—'),
    '',
    `${e('money')} Цена: <b>${formatBalance(p.price)}</b>`,
  ];
  if (p.type === 'auto') {
    lines.push(p.stock > 0 ? `${e('check')} В наличии: <b>${p.stock} шт.</b>` : `${e('cross')} <b>Нет в наличии</b>`);
  } else {
    lines.push(`${e('admin')} Выдача вручную`);
  }
  return lines.join('\n');
}

module.exports = { esc, fmtNum, formatBalance, formatStatus, formatDate, formatOrder, formatProduct, divider };
