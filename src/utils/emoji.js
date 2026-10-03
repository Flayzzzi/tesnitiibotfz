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
function configuredEmojiIds() {
  return String(process.env.PREMIUM_EMOJI_IDS || '')
    .split(',')
    .reduce((ids, entry) => {
      const eq = entry.indexOf('=');
      if (eq === -1) return ids;
      const key = entry.slice(0, eq).trim();
      const value = entry.slice(eq + 1).trim();
      if (key && /^\d+$/.test(value)) ids[key] = value;
      return ids;
    }, {});
}

const EMOJI_MAP = {
  catalog: 'PLACEHOLDER',
  profile: 'PLACEHOLDER',
  support: 'PLACEHOLDER',
  about: 'PLACEHOLDER',
  topup: 'PLACEHOLDER',
  back: 'PLACEHOLDER',
  cart: 'PLACEHOLDER',
  check: 'PLACEHOLDER',
  cross: 'PLACEHOLDER',
  star: 'PLACEHOLDER',
  notify: 'PLACEHOLDER',
  admin: 'PLACEHOLDER',
  money: 'PLACEHOLDER',
  orders: 'PLACEHOLDER',
  history: 'PLACEHOLDER',
  plus: 'PLACEHOLDER',
  minus: 'PLACEHOLDER',
  edit: 'PLACEHOLDER',
  trash: 'PLACEHOLDER',
  eye: 'PLACEHOLDER',
  send: 'PLACEHOLDER',
  stats: 'PLACEHOLDER',
  list: 'PLACEHOLDER',
  up: 'PLACEHOLDER',
  down: 'PLACEHOLDER',
  time: 'PLACEHOLDER',
  search: 'PLACEHOLDER',
  st_pending: 'PLACEHOLDER',
  st_paid: 'PLACEHOLDER',
  st_delivered: 'PLACEHOLDER',
  st_cancelled: 'PLACEHOLDER',
  st_refunded: 'PLACEHOLDER',
  st_failed: 'PLACEHOLDER',
  ...configuredEmojiIds(),
};

const EMOJI_FALLBACK = {
  catalog: '📦',
  profile: '👤',
  support: '🛟',
  about: 'ℹ️',
  topup: '💳',
  back: '◀️',
  cart: '🛒',
  check: '✅',
  cross: '❌',
  star: '⭐',
  notify: '🔔',
  admin: '⚙️',
  money: '💰',
  orders: '📋',
  history: '📊',
  plus: '➕',
  minus: '➖',
  edit: '✏️',
  trash: '🗑',
  eye: '👁',
  send: '📣',
  stats: '📈',
  list: '📦',
  up: '⬆️',
  down: '⬇️',
  time: '🕒',
  search: '🔍',
  st_pending: '⏳',
  st_paid: '💰',
  st_delivered: '✅',
  st_cancelled: '🚫',
  st_refunded: '↩️',
  st_failed: '❌',
  welcome: '🤝',
};

function e(key) {
  const id = EMOJI_MAP[key];
  const fallback = EMOJI_FALLBACK[key] ?? '•';
  if (!id || id === 'PLACEHOLDER') return fallback;
  return `<tg-emoji emoji-id="${id}">${fallback}</tg-emoji>`;
}

function ef(key) {
  return EMOJI_FALLBACK[key] ?? '•';
}

function markdownEmoji(key) {
  const id = EMOJI_MAP[key];
  const fallback = ef(key);
  if (!id || id === 'PLACEHOLDER') return fallback;
  return `![${fallback}](tg://emoji?id=${id})`;
}

const SKIP = new Set(['', '—', '-', '–']);

function cleanKey(key) {
  return String(key || '').trim();
}

function emojiChar(key) {
  const k = cleanKey(key);
  if (SKIP.has(k)) return '';
  if (EMOJI_MAP[k]) return EMOJI_FALLBACK[k];
  return k;
}

function emojiText(key) {
  const k = cleanKey(key);
  if (SKIP.has(k)) return '';
  if (EMOJI_MAP[k]) return e(k);
  return k;
}

module.exports = { e, ef, markdownEmoji, emojiChar, emojiText, EMOJI_MAP, EMOJI_FALLBACK };
