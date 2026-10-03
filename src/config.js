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
require('dotenv').config();

function required(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return String(value).trim();
}

const ADMIN_IDS = String(process.env.ADMIN_IDS || '')
  .split(',')
  .map((s) => Number(s.trim()))
  .filter((n) => Number.isFinite(n) && n > 0);

if (!ADMIN_IDS.length) {
  throw new Error('ADMIN_IDS must contain at least one Telegram user id');
}

module.exports = {
  BOT_TOKEN: required('BOT_TOKEN'),
  ADMIN_IDS,
  PLATEGA_MERCHANT_ID: process.env.PLATEGA_MERCHANT_ID,
  PLATEGA_SECRET: process.env.PLATEGA_SECRET,
  PLATEGA_API_URL: process.env.PLATEGA_API_URL || 'https://app.platega.io/transaction/process',
  PLATEGA_PAYMENT_METHOD: Number(process.env.PLATEGA_PAYMENT_METHOD) || 2,
  PLATEGA_CURRENCY: process.env.PLATEGA_CURRENCY || 'RUB',
  WEBHOOK_URL: process.env.WEBHOOK_URL,
  WEBHOOK_PORT: Number(process.env.WEBHOOK_PORT) || 3001,
  DB_PATH: process.env.DB_PATH || './data/shop.db',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  TOPUP_MIN: Number(process.env.TOPUP_MIN) || 10,
};
