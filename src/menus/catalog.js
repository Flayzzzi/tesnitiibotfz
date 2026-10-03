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
const config = require('../config');
const categories = require('../db/models/categories');
const products = require('../db/models/products');
const users = require('../db/models/users');
const notifications = require('../db/models/notifications');
const commerce = require('../db/commerce');
const { e, ef, emojiChar } = require('../utils/emoji');
const { esc, formatBalance, formatProduct, divider } = require('../utils/format');
const { backButton } = require('../utils/keyboard');
const { renderCatalogView } = require('../utils/catalog_view');
const { paginate } = require('../utils/paginate');
const logger = require('../utils/logger');

const PAGE_SIZE = 5;

function ensureUser(ctx) {
  const existing = users.getUserByTg(ctx.from.id);
  if (existing) return existing;
  users.upsertUser({
    tg_id: ctx.from.id,
    username: ctx.from.username || null,
    first_name: ctx.from.first_name || null,
  });
  return users.getUserByTg(ctx.from.id);
}

async function showCategories(ctx) {
  const cats = categories.all(true);
  if (!cats.length) {
    return ctx.reply(`${e('catalog')} Каталог пока пуст. Загляни позже, тут уже готовятся лоты.`, {
      parse_mode: 'HTML',
      reply_markup: Markup.inlineKeyboard([[backButton()]]).reply_markup,
    });
  }
  const rows = [];
  for (let i = 0; i < cats.length; i += 2) {
    const row = [];
    row.push(Markup.button.callback(`${emojiChar(cats[i].emoji_key) || ef('list')} ${cats[i].name}`, `catalog:category:${cats[i].id}`));
    if (cats[i + 1]) row.push(Markup.button.callback(`${emojiChar(cats[i + 1].emoji_key) || ef('list')} ${cats[i + 1].name}`, `catalog:category:${cats[i + 1].id}`));
    rows.push(row);
  }
  rows.push([backButton()]);
  const header = `${e('catalog')} <b>Каталог</b>\n\nВыбери категорию:`;
  return renderCatalogView(ctx, header, Markup.inlineKeyboard(rows));
}

async function showProducts(ctx, categoryId, page) {
  const cat = categories.get(categoryId);
  if (!cat || !cat.visible) return showCategories(ctx);
  const prods = products.all({ visibleOnly: true, categoryId });
  const pg = paginate(prods, page, PAGE_SIZE);
  const rows = pg.items.map((p, i) => [
    Markup.button.callback(`${(pg.page - 1) * PAGE_SIZE + i + 1}. ${p.name} (${formatBalance(p.price)})`, `catalog:product:${p.id}`),
  ]);
  const nav = paginationRowLocal(pg, categoryId);
  if (nav.length) rows.push(nav);
  rows.push([backButton('catalog:back')]);
  const header = `${e('catalog')} <b>Товары</b>\n\n${pg.total ? 'Выбери товар:' : `${e('cross')} Товаров пока нет`}`;
  return renderCatalogView(ctx, header, Markup.inlineKeyboard(rows), cat.image_url);
}

function paginationRowLocal(pg, categoryId) {
  const row = [];
  if (pg.hasPrev) row.push(Markup.button.callback(`${ef('back')} ←`, `catalog:catnav:${categoryId}:${pg.page - 1}`));
  if (pg.hasNext) row.push(Markup.button.callback('→', `catalog:catnav:${categoryId}:${pg.page + 1}`));
  return row;
}

async function showProduct(ctx, productId) {
  const p = products.get(productId);
  if (!p || !p.visible) {
    await ctx.answerCbQuery('Товар не найден.').catch(() => {});
    return showCategories(ctx);
  }
  const user = ensureUser(ctx);
  const inStock = p.type !== 'auto' || p.stock > 0;
  const rows = [];
  if (inStock) {
    rows.push([Markup.button.callback(`${ef('cart')} Купить за ${formatBalance(p.price)}`, `catalog:buy:${p.id}`)]);
  }
  const subscribed = notifications.isSubscribed(user.id, p.id);
  rows.push([
    Markup.button.callback(
      subscribed ? `${ef('notify')} Отписаться от уведомлений` : `${ef('notify')} Уведомить когда появится`,
      subscribed ? `catalog:unnotify:${p.id}` : `catalog:notify:${p.id}`
    ),
  ]);
  rows.push([backButton(p.category_id ? `catalog:cat:${p.category_id}` : 'catalog:back')]);
  return renderCatalogView(ctx, formatProduct(p), Markup.inlineKeyboard(rows), p.image_url);
}

async function handleBuy(ctx, productId) {
  const p = products.get(productId);
  if (!p || !p.visible) return ctx.answerCbQuery('Товар не найден.').catch(() => {});
  if (p.type === 'auto' && p.stock <= 0) return ctx.answerCbQuery('Нет в наличии.').catch(() => {});
  const user = ensureUser(ctx);
  const text = `${e('cart')} Купить <b>${esc(p.name)}</b> за <b>${formatBalance(p.price)}</b>?\n\n${e('money')} Твой баланс: <b>${formatBalance(
    user.balance
  )}</b>`;
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback(`${ef('check')} Подтвердить`, `catalog:confirm:${p.id}`)],
    [Markup.button.callback(`${ef('cross')} Отмена`, 'catalog:cancel')],
  ]);
  return renderCatalogView(ctx, text, keyboard);
}

async function handleConfirm(ctx, productId) {
  const p = products.get(productId);
  if (!p || !p.visible) return ctx.answerCbQuery('Товар не найден.').catch(() => {});
  if (p.type === 'auto' && p.stock <= 0) {
    return renderCatalogView(
      ctx,
      `${e('cross')} Товар закончился.`,
      Markup.inlineKeyboard([[backButton('catalog:back')]])
    );
  }
  const user = ensureUser(ctx);
  if (Number(user.balance) < Number(p.price)) {
    return renderCatalogView(
      ctx,
      `${e('cross')} Недостаточно средств.\n\n${e('money')} Баланс: <b>${formatBalance(user.balance)}</b>\nНужно: <b>${formatBalance(
        p.price
      )}</b>`,
      Markup.inlineKeyboard([
        [Markup.button.callback(`${ef('topup')} Пополнить баланс`, 'menu:topup')],
        [backButton()],
      ])
    );
  }
  let result;
  try {
    result = commerce.purchase({ userId: user.id, productId: p.id });
  } catch (err) {
    // Only the money-moving transaction is guarded here. If it throws, nothing
    // was committed (better-sqlite3 rolls the transaction back), so it is safe
    // to tell the user the purchase did not go through.
    logger.error('purchase failed', err);
    return renderCatalogView(
      ctx,
      `${e('cross')} Не получилось провести покупку. Попробуй ещё раз через пару минут.`,
      Markup.inlineKeyboard([[backButton('menu:main')]])
    );
  }

  if (result.kind === 'unavailable') return ctx.answerCbQuery('Товар не найден.').catch(() => {});
  if (result.kind === 'out_of_stock') {
    return renderCatalogView(ctx, `${e('cross')} Товар закончился.`, Markup.inlineKeyboard([[backButton('catalog:back')]]));
  }
  if (result.kind === 'insufficient_funds') {
    return renderCatalogView(
      ctx,
      `${e('cross')} Недостаточно средств.\n\n${e('money')} Баланс: <b>${formatBalance(result.user.balance)}</b>\nНужно: <b>${formatBalance(result.product.price)}</b>`,
      Markup.inlineKeyboard([[Markup.button.callback(`${ef('topup')} Пополнить баланс`, 'menu:topup')], [backButton()]])
    );
  }
  if (result.kind !== 'purchased') {
    logger.error('purchase unexpected outcome', result.kind);
    return renderCatalogView(
      ctx,
      `${e('cross')} Не получилось провести покупку. Попробуй ещё раз через пару минут.`,
      Markup.inlineKeyboard([[backButton('menu:main')]])
    );
  }

  // The purchase is already committed. Everything below is best-effort UI:
  // a failure here must not surface as "purchase failed" to the user.
  logger.info(`purchase user=${user.id} product=${p.id} amount=${p.price}`);

  if (result.product.type === 'auto') {
    const text = `${e('check')} <b>Заказ #${result.orderId} оплачен!</b>\n\n${e('cart')} <b>${esc(result.product.name)}</b>\n${divider()}\n<code>${esc(
      result.delivery
    )}</code>\n${divider()}\n\n${e('money')} Баланс: <b>${formatBalance(result.balance)}</b>\n\n${ef('history')} Код также сохранён в «Профиль → Мои заказы».`;
    return renderCatalogView(ctx, text, Markup.inlineKeyboard([[backButton('menu:main')]])).catch((err) =>
      logger.error('purchase receipt render failed', err)
    );
  }

  await renderCatalogView(
    ctx,
    `${e('check')} <b>Заказ #${result.orderId} оплачен!</b>\n\n${e('cart')} <b>${esc(result.product.name)}</b> за ${formatBalance(
      result.product.price
    )}.\n\n${e('admin')} Товар выдадут вручную, обычно в течение 15–60 минут. Статус смотри в «Профиль → Мои заказы».`,
    Markup.inlineKeyboard([[backButton('menu:main')]])
  ).catch((err) => logger.error('purchase receipt render failed', err));
  for (const adminId of config.ADMIN_IDS) {
    try {
      await ctx.telegram.sendMessage(
        adminId,
        `${e('notify')} Новый заказ #${result.orderId}: ${esc(result.product.name)} от ${esc(user.first_name || '')} @${esc(
          user.username || ''
        )}`,
        { parse_mode: 'HTML' }
      );
    } catch (err) {
      logger.warn('admin notify failed', adminId, err.message);
    }
  }
}

async function subscribeNotify(ctx, productId) {
  const user = ensureUser(ctx);
  notifications.subscribe(user.id, productId);
  await ctx.answerCbQuery('Включил. Напишу, когда товар появится.').catch(() => {});
  return showProduct(ctx, productId);
}

async function unsubscribeNotify(ctx, productId) {
  const user = ensureUser(ctx);
  notifications.unsubscribe(user.id, productId);
  await ctx.answerCbQuery('Уведомления отключил.').catch(() => {});
  return showProduct(ctx, productId);
}

module.exports = {
  showCategories,
  showProducts,
  showProduct,
  handleBuy,
  handleConfirm,
  subscribeNotify,
  unsubscribeNotify,
};
