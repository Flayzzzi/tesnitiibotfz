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
const express = require('express');
const commerce = require('../db/commerce');
const { verifyWebhook } = require('./platega');
const { e } = require('../utils/emoji');
const { formatBalance } = require('../utils/format');
const logger = require('../utils/logger');

function createWebhookRouter(bot) {
  const router = express.Router();

  router.post('/webhook/platega', async (req, res) => {
    const body = req.body || {};
    if (!verifyWebhook(req.headers, body)) {
      return res.status(403).json({ error: 'invalid signature' });
    }
    const orderId = body.payload || body.id;
    if (!orderId) {
      return res.status(400).json({ error: 'missing order id' });
    }
    const status = String(body.status || '').toUpperCase();
    // Platega may report the amount at the top level or nested under
    // paymentDetails (the same shape createInvoice sends). Accept both.
    const rawAmount = body.amount != null ? body.amount : body.paymentDetails && body.paymentDetails.amount;
    const amount = Number(rawAmount);
    const result = commerce.settleTopup({ orderId, status, amount });
    if (result.kind === 'not_found') {
      logger.warn('webhook for unknown order', orderId);
      return res.status(404).json({ error: 'transaction not found' });
    }
    if (result.kind === 'amount_mismatch') {
      logger.warn('webhook amount mismatch', { order: orderId, got: rawAmount, expected: result.tx.amount });
      return res.status(400).json({ error: 'amount mismatch' });
    }

    if (result.kind === 'credited') {
      logger.info(`topup credited user=${result.tx.user_id} amount=${result.tx.amount}`);
      try {
        await bot.telegram.sendMessage(
          result.user.tg_id,
          `${e('check')} Баланс пополнен на <b>${formatBalance(result.tx.amount)}</b>.\n\n${e('money')} Текущий баланс: <b>${formatBalance(result.user.balance)}</b>`,
          { parse_mode: 'HTML' }
        );
      } catch (err) {
        logger.warn('topup notify failed', result.user.tg_id, err.message);
      }
    } else if (result.kind === 'chargebacked') {
      logger.warn(`topup chargeback user=${result.tx.user_id} amount=${result.tx.amount}`);
      try {
        await bot.telegram.sendMessage(
          result.user.tg_id,
          `${e('cross')} Платёж на <b>${formatBalance(result.tx.amount)}</b> был отменён платёжной системой. Средства списаны с баланса.`,
          { parse_mode: 'HTML' }
        );
      } catch (err) {
        logger.warn('chargeback notify failed', result.user.tg_id, err.message);
      }
    } else if (result.kind === 'failed') {
      logger.info(`topup failed user=${result.tx.user_id} amount=${result.tx.amount} order=${orderId}`);
    }

    return res.json({ ok: true });
  });

  return router;
}

module.exports = createWebhookRouter;
