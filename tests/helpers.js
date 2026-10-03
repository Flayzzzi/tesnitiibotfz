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
function makeCtx(from = { id: 111, username: 'u111', first_name: 'Tester' }) {
  const sent = [];
  const ctx = {
    from,
    sent,
    session: { step: null, wizard: {}, adminWizard: {} },
    answerCbQuery: async (...args) => sent.push({ type: 'answer', args }),
    telegram: { sendMessage: async (...args) => sent.push({ type: 'dm', args }) },
  };
  ctx.reply = async (text, opts) => {
    sent.push({ type: 'reply', text, opts });
    return { message_id: sent.length };
  };
  ctx.editMessageText = async (text, opts) => {
    sent.push({ type: 'edit', text, opts });
    return;
  };
  return ctx;
}

function asCallback(ctx) {
  ctx.callbackQuery = { data: 'x' };
  return ctx;
}

module.exports = { makeCtx, asCallback };