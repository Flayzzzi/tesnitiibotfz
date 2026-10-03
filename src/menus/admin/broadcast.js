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
const { Markup } = require('telegraf');
const { isAdmin } = require('../../middleware/isAdmin');
const users = require('../../db/models/users');
const { e, ef } = require('../../utils/emoji');
const logger = require('../../utils/logger');
const { withInputMenu } = require('../../utils/input_menu');
const { restoreIncomingCustomEmojiEntities, formatCustomEmojisForParseMode } = require('../../utils/markdown');

async function start(ctx) {
  if (!isAdmin(ctx)) return ctx.answerCbQuery('Доступ запрещён').catch(() => {});
  ctx.session.adminWizard = { flow: 'broadcast', step: 0, data: {} };
  await ctx.answerCbQuery().catch(() => {});
  return ctx.reply(`${e('send')} Введите текст рассылки (можно с HTML-разметкой):`, withInputMenu({ parse_mode: 'HTML' }));
}

async function onText(ctx, text) {
  const w = ctx.session.adminWizard;
  if (!w || w.flow !== 'broadcast') return false;
  // Premium emoji arrive as custom_emoji entities alongside a plain fallback
  // glyph. Restore them into HTML <tg-emoji> so the broadcast (parse_mode=HTML)
  // keeps the premium version instead of only the fallback glyph.
  const restored = restoreIncomingCustomEmojiEntities(text, ctx.message && ctx.message.entities);
  const htmlText = formatCustomEmojisForParseMode(restored, 'HTML');
  w.data.text = htmlText;
  w.step = 1;
  await ctx.reply(`Предпросмотр:\n\n${htmlText}\n\nОтправить всем пользователям?`, {
    parse_mode: 'HTML',
    reply_markup: Markup.inlineKeyboard([
      [Markup.button.callback(`${ef('check')} Отправить`, 'admin:bcast:send')],
      [Markup.button.callback(`${ef('cross')} Отмена`, 'admin:bcast:cancel')],
    ]).reply_markup,
  });
  return true;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function retryAfterSeconds(err) {
  const params = err && (err.parameters || (err.response && err.response.parameters));
  return params && params.retry_after ? Number(params.retry_after) : 0;
}

async function send(ctx) {
  const w = ctx.session.adminWizard;
  if (!w || w.flow !== 'broadcast') return ctx.answerCbQuery('Нет сообщения').catch(() => {});
  const text = w.data.text;
  const tgIds = users.allTgIds();
  // Clear the wizard up front so a double click on "Отправить" cannot start a
  // second broadcast over the same list.
  ctx.session.adminWizard = {};
  await ctx.answerCbQuery('Начал рассылку').catch(() => {});
  let ok = 0;
  for (const id of tgIds) {
    try {
      await ctx.telegram.sendMessage(id, text, { parse_mode: 'HTML' });
      ok++;
    } catch (err) {
      // Respect Telegram flood control: on 429 wait the requested time and try
      // this recipient once more before giving up on them.
      const wait = retryAfterSeconds(err);
      if (wait) {
        await sleep((wait + 1) * 1000);
        try {
          await ctx.telegram.sendMessage(id, text, { parse_mode: 'HTML' });
          ok++;
          continue;
        } catch (retryErr) {
          logger.warn('broadcast failed', id, retryErr.message);
        }
      } else {
        logger.warn('broadcast failed', id, err.message);
      }
    }
    // Stay under Telegram's ~30 messages/second broadcast limit.
    await sleep(40);
  }
  return ctx.reply(`${e('check')} Рассылка завершена: ${ok}/${tgIds.length}`, { parse_mode: 'HTML' });
}

async function cancel(ctx) {
  ctx.session.adminWizard = {};
  await ctx.answerCbQuery('Отменено').catch(() => {});
  return require('./index').show(ctx);
}

module.exports = { start, onText, send, cancel };
