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
function paginate(array, page, pageSize = 5) {
  const total = array.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page || 1), pages);
  const start = (safePage - 1) * pageSize;
  return {
    items: array.slice(start, start + pageSize),
    total,
    pages,
    page: safePage,
    hasPrev: safePage > 1,
    hasNext: safePage < pages,
  };
}

module.exports = { paginate };
