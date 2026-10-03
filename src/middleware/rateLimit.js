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
const config = require('../config');

const MAX_PER_WINDOW = 30;
const WINDOW_MS = 10000;

const hits = new Map();

const SWEEP_EVERY = 500;
let opsSinceSweep = 0;

// Drop entries whose most recent hit fell outside the window so the map does
// not grow without bound as one-off users accumulate.
function sweep(now) {
  for (const [uid, times] of hits) {
    if (!times.length || now - times[times.length - 1] >= WINDOW_MS) hits.delete(uid);
  }
}

function allow(userId) {
  if (config.ADMIN_IDS.includes(userId)) return true;
  const now = Date.now();
  if (++opsSinceSweep >= SWEEP_EVERY) {
    opsSinceSweep = 0;
    sweep(now);
  }
  const recent = (hits.get(userId) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(userId, recent);
    return false;
  }
  recent.push(now);
  hits.set(userId, recent);
  return true;
}

module.exports = { allow };