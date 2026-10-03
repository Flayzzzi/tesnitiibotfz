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
const crypto = require('crypto');
const axios = require('axios');
const config = require('../config');

const STATUS_CONFIRMED = 'CONFIRMED';
const STATUS_CANCELED = 'CANCELED';
const STATUS_CHARGEBACKED = 'CHARGEBACKED';
const VALID_STATUSES = [STATUS_CONFIRMED, STATUS_CANCELED, STATUS_CHARGEBACKED];

function randomUuid() {
  return crypto.randomUUID();
}

function headers() {
  return {
    'Content-Type': 'application/json',
    'X-MerchantId': config.PLATEGA_MERCHANT_ID,
    'X-Secret': config.PLATEGA_SECRET,
  };
}

async function createInvoice({ amount, orderId }) {
  if (!config.PLATEGA_MERCHANT_ID || !config.PLATEGA_SECRET) {
    throw new Error('Platega is not configured (PLATEGA_MERCHANT_ID / PLATEGA_SECRET)');
  }
  const payload = {
    paymentMethod: config.PLATEGA_PAYMENT_METHOD,
    id: orderId,
    paymentDetails: {
      amount,
      currency: config.PLATEGA_CURRENCY,
    },
    description: `Пополнение баланса на ${amount} ${config.PLATEGA_CURRENCY}`,
    payload: orderId,
  };
  if (config.WEBHOOK_URL) {
    payload.return = config.WEBHOOK_URL;
    payload.failedUrl = config.WEBHOOK_URL;
  }
  const res = await axios.post(config.PLATEGA_API_URL, payload, { headers: headers(), timeout: 15000 });
  const data = res.data || {};
  if (!data.redirect) throw new Error('platega returned no redirect url');
  return { ...data, url: data.redirect };
}

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a == null ? '' : a));
  const bufB = Buffer.from(String(b == null ? '' : b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function verifyWebhook(headers = {}, body = {}) {
  // Never authenticate a webhook when credentials are not configured: with both
  // sides undefined a naive `!==` comparison would pass and accept forged calls.
  if (!config.PLATEGA_MERCHANT_ID || !config.PLATEGA_SECRET) return false;
  const merchant = headers['x-merchantid'];
  const secret = headers['x-secret'];
  if (!safeEqual(merchant, config.PLATEGA_MERCHANT_ID) || !safeEqual(secret, config.PLATEGA_SECRET)) return false;
  return VALID_STATUSES.includes(String(body.status || '').toUpperCase());
}

module.exports = { createInvoice, verifyWebhook, randomUuid, STATUS_CONFIRMED, STATUS_CANCELED, STATUS_CHARGEBACKED };
