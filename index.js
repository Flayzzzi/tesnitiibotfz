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
const config = require('./src/config');
const express = require('express');
const db = require('./src/db');
const { bot, registerCommands } = require('./src/bot');
const createWebhookRouter = require('./src/payments/webhook');
const logger = require('./src/utils/logger');

const app = express();
app.use(express.json());
app.use(createWebhookRouter(bot));
let server;
server = app.listen(config.WEBHOOK_PORT, () => {
  logger.info(`Webhook server listening on port ${config.WEBHOOK_PORT}`);
});

async function startBot() {
  try {
    await registerCommands();
    logger.info('Telegram commands registered');
  } catch (err) {
    logger.warn('Telegram command registration failed', err.message);
  }
  try {
    await bot.launch();
    logger.info('Telegram bot polling started');
  } catch (err) {
    logger.error('bot launch failed', err);
    // Keep a non-zero status so a process manager can restart a bot that is
    // serving payment webhooks but cannot receive Telegram updates.
    process.exitCode = 1;
  }
}
startBot();

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return process.exit(1);
  shuttingDown = true;
  logger.info(`${signal} received, shutting down`);
  try {
    await bot.stop(signal);
  } catch (err) {
    logger.warn('bot stop failed', err.message);
  }
  try {
    server.close();
  } catch {}
  setTimeout(() => process.exit(0), 200).unref();
}
process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
