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
const logger = require('./logger');
const { mediaInput } = require('./media');
const { renderMenu, replyMenu } = require('./keyboard');
const { repairMarkdownV2EntityError } = require('./markdown');

// Telegram captions are capped at 1024 characters after entity parsing. We use
// the raw HTML length as a conservative bound so catalog information is never
// silently truncated; overlong cards remain complete text messages instead.
const CAPTION_LIMIT = 1024;

function callbackMessageIsPhoto(ctx) {
  return Boolean(ctx.callbackQuery && ctx.callbackQuery.message && ctx.callbackQuery.message.photo);
}

async function replaceWithReply(ctx, method, ...args) {
  if (ctx.callbackQuery) {
    await ctx.deleteMessage().catch((err) => logger.warn('catalog message delete failed', err.message));
  }
  return ctx[method](...args);
}

async function sendPhotoWithCaption(ctx, media, caption, options) {
  if (ctx.callbackQuery) {
    await ctx.deleteMessage().catch((err) => logger.warn('catalog message delete failed', err.message));
  }
  let recoveredCaption = caption;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await ctx.replyWithPhoto(media, { ...options, caption: recoveredCaption });
    } catch (err) {
      if (options.parse_mode !== 'MarkdownV2') throw err;
      const repaired = repairMarkdownV2EntityError(recoveredCaption, err);
      if (!repaired || repaired === recoveredCaption) throw err;
      recoveredCaption = repaired;
    }
  }
  throw new Error('MarkdownV2 caption could not be repaired after four attempts');
}

async function editPhotoWithCaption(ctx, media, caption, options) {
  let recoveredCaption = caption;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await ctx.editMessageMedia({ type: 'photo', media, caption: recoveredCaption }, options);
    } catch (err) {
      if (options.parse_mode !== 'MarkdownV2') throw err;
      const repaired = repairMarkdownV2EntityError(recoveredCaption, err);
      if (!repaired || repaired === recoveredCaption) throw err;
      recoveredCaption = repaired;
    }
  }
  throw new Error('MarkdownV2 media caption could not be repaired after four attempts');
}

async function renderCatalogView(ctx, text, keyboard, imageUrl = null, renderOptions = {}) {
  const options = { parse_mode: renderOptions.parse_mode || 'HTML' };
  if (keyboard && keyboard.reply_markup) options.reply_markup = keyboard.reply_markup;
  const media = mediaInput(imageUrl);
  const canUseCaption = media && text.length <= CAPTION_LIMIT;
  const sourceIsPhoto = callbackMessageIsPhoto(ctx);

  if (!canUseCaption) {
    if (sourceIsPhoto) {
      if (ctx.callbackQuery) {
        await ctx.deleteMessage().catch((err) => logger.warn('catalog message delete failed', err.message));
      }
      return replyMenu(ctx, text, keyboard, renderOptions);
    }
    return renderMenu(ctx, text, keyboard, renderOptions);
  }

  if (sourceIsPhoto) {
    try {
      return await editPhotoWithCaption(ctx, media, text, options);
    } catch (err) {
      logger.warn('catalog media edit failed; showing text view', err.message);
      return renderMenu(ctx, text, keyboard, renderOptions);
    }
  }

  try {
    return await sendPhotoWithCaption(ctx, media, text, options);
  } catch (err) {
    logger.warn('catalog media send failed; showing text view', err.message);
    return replyMenu(ctx, text, keyboard, renderOptions);
  }
}

module.exports = { renderCatalogView, CAPTION_LIMIT };
