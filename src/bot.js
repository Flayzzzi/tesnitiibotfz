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
const { Telegraf } = require('telegraf');
const sessionModule = require('@telegraf/session');
const session = sessionModule.session || sessionModule.default;
const config = require('./config');
const db = require('./db');
const sessionStore = require('./db/session_store');
const autoRegister = require('./middleware/autoRegister');
const rateLimit = require('./middleware/rateLimit');
const { isAdmin } = require('./middleware/isAdmin');
const logger = require('./utils/logger');
const { isImageDocument } = require('./utils/media');
const { setBot } = require('./notifications');

const mainMenu = require('./menus/main');
const catalog = require('./menus/catalog');
const profile = require('./menus/profile');
const support = require('./menus/support');
const about = require('./menus/about');
const topup = require('./menus/topup');
const adminIndex = require('./menus/admin/index');
const adminCategories = require('./menus/admin/categories');
const adminProducts = require('./menus/admin/products');
const adminOrders = require('./menus/admin/orders');
const adminBroadcast = require('./menus/admin/broadcast');
const adminStats = require('./menus/admin/stats');
const adminEditMsg = require('./menus/admin/edit_message');
const startHandler = require('./handlers/start');
const textHandler = require('./handlers/text');
const adminCommand = require('./handlers/admin_commands');

const bot = new Telegraf(config.BOT_TOKEN);
setBot(bot);

const USER_COMMANDS = [{ command: 'start', description: 'Открыть меню' }];
const ADMIN_COMMANDS = [
  ...USER_COMMANDS,
  { command: 'admin', description: 'Админ-панель' },
  { command: 'edit', description: 'Редактировать текущее меню' },
];

async function registerCommands() {
  await bot.telegram.setMyCommands(USER_COMMANDS);
  for (const adminId of config.ADMIN_IDS) {
    try {
      await bot.telegram.setMyCommands(ADMIN_COMMANDS, { scope: { type: 'chat', chat_id: adminId } });
    } catch (err) {
      logger.warn('admin command registration failed', adminId, err.message);
    }
  }
}

// This middleware runs before sessions and command matching. It lets us tell
// the difference between Telegram not delivering an update, a command not
// matching, and a failure while building the main menu.
bot.use(async (ctx, next) => {
  const text = ctx.message && ctx.message.text;
  if (typeof text === 'string' && /^\/start(?:\s|@|$)/i.test(text)) {
    logger.debug('/start update received', {
      updateId: ctx.update && ctx.update.update_id,
      chatId: ctx.chat && ctx.chat.id,
      userId: ctx.from && ctx.from.id,
      text,
      entities: ctx.message.entities,
    });
  }
  return next();
});

bot.use(session({ store: sessionStore }));
bot.use(async (ctx, next) => {
  ctx.session.step = ctx.session.step ?? null;
  ctx.session.wizard = ctx.session.wizard ?? {};
  ctx.session.adminWizard = ctx.session.adminWizard ?? {};
  ctx.session.lastView = ctx.session.lastView ?? null;
  ctx.session.lastViewMsgId = ctx.session.lastViewMsgId ?? null;
  return next();
});
bot.use(autoRegister);

bot.start(startHandler);
bot.command('admin', adminCommand);
bot.command('edit', (ctx) => adminEditMsg.start(ctx));
bot.on('text', async (ctx) => {
  if (!rateLimit.allow(ctx.from?.id ?? -1)) {
    logger.warn('text rate limited', {
      updateId: ctx.update && ctx.update.update_id,
      userId: ctx.from && ctx.from.id,
    });
    return;
  }
  return textHandler(ctx);
});
async function handleImageUpload(ctx) {
  const flow = ctx.session.adminWizard && ctx.session.adminWizard.flow;
  if (flow === 'addCategory' || flow === 'editCategory') return adminCategories.onMessage(ctx);
  if (flow === 'addProduct' || flow === 'editProduct') return adminProducts.onMessage(ctx);
  if (flow === 'edit_menu') return adminEditMsg.handlePhoto(ctx);
  return ctx.reply('Изображение сейчас не ожидается. Выбери действие кнопками или отправь /start.');
}

bot.on('photo', handleImageUpload);
bot.on('document', async (ctx) => {
  if (!isImageDocument(ctx.message && ctx.message.document)) {
    return ctx.reply('Нужен PNG или JPG/JPEG файл.');
  }
  return handleImageUpload(ctx);
});

bot.catch(async (err, ctx) => {
  logger.error('update processing failed', {
    updateId: ctx.update && ctx.update.update_id,
    userId: ctx.from && ctx.from.id,
    error: err && err.stack ? err.stack : String(err),
  });

  // Do not leave a user with a silent command failure. The reply is best-effort
  // because errors can also originate from Telegram's sendMessage API itself.
  if (ctx.chat) {
    await ctx.reply('Не удалось обработать сообщение. Попробуй ещё раз через минуту.').catch(() => {});
  }
});

bot.on('callback_query', async (ctx) => {
  if (!rateLimit.allow(ctx.from?.id ?? -1)) {
    logger.warn('callback rate limited', {
      updateId: ctx.update && ctx.update.update_id,
      userId: ctx.from && ctx.from.id,
      data: ctx.callbackQuery && ctx.callbackQuery.data,
    });
    await ctx.answerCbQuery('Слишком много действий. Подожди несколько секунд.').catch(() => {});
    return;
  }
  try {
    await dispatch(ctx);
  } catch (err) {
    logger.error('callback error', err);
  } finally {
    ctx.answerCbQuery().catch(() => {});
  }
});

async function dispatch(ctx) {
  const data = ctx.callbackQuery.data || '';
  const [scope, action, a, b] = data.split(':');
  switch (scope) {
    case 'noop':
      return;
    case 'menu':
      return menuRouter(ctx, action);
    case 'catalog':
      return catalogRouter(ctx, action, a, b);
    case 'profile':
      return profileRouter(ctx, action, a);
    case 'support':
      return supportRouter(ctx, action);
    case 'topup':
      return topupRouter(ctx, action);
    case 'admin':
      return adminRouter(ctx, action, a, b);
    default:
      await ctx.answerCbQuery('Неизвестное действие').catch(() => {});
      return;
  }
}

function menuRouter(ctx, action) {
  switch (action) {
    case 'main':
      return mainMenu.show(ctx);
    case 'catalog':
      return catalog.showCategories(ctx);
    case 'topup':
      return topup.askAmount(ctx);
    case 'profile':
      return profile.showProfile(ctx);
    case 'about':
      return about.showAbout(ctx);
    case 'support':
      return support.showSupport(ctx);
    case 'admin':
      return adminIndex.show(ctx);
    default:
      return unknownCallback(ctx, `menu:${action || ''}`);
  }
}

function catalogRouter(ctx, action, a, b) {
  switch (action) {
    case 'category':
      return catalog.showProducts(ctx, parseInt(a) || 0, 1);
    case 'catnav':
      return catalog.showProducts(ctx, parseInt(a) || 0, parseInt(b) || 1);
    case 'cat':
      return catalog.showProducts(ctx, parseInt(a) || 0, 1);
    case 'back':
      return catalog.showCategories(ctx);
    case 'product':
      return catalog.showProduct(ctx, parseInt(a) || 0);
    case 'buy':
      return catalog.handleBuy(ctx, parseInt(a) || 0);
    case 'confirm':
      return catalog.handleConfirm(ctx, parseInt(a) || 0);
    case 'cancel':
      return catalog.showCategories(ctx);
    case 'notify':
      return catalog.subscribeNotify(ctx, parseInt(a) || 0);
    case 'unnotify':
      return catalog.unsubscribeNotify(ctx, parseInt(a) || 0);
    default:
      return unknownCallback(ctx, `catalog:${action || ''}`);
  }
}

function profileRouter(ctx, action, a) {
  switch (action) {
    case 'main':
      return profile.showProfile(ctx);
    case 'orders':
      return profile.showOrders(ctx, parseInt(a) || 1);
    case 'order':
      return profile.showOrder(ctx, parseInt(a) || 0);
    case 'topups':
      return profile.showTopups(ctx, parseInt(a) || 1);
    case 'notify':
      return profile.toggleNotifications(ctx);
    case 'topup':
      return topup.askAmount(ctx);
    default:
      return unknownCallback(ctx, `profile:${action || ''}`);
  }
}

function supportRouter(ctx, action) {
  if (action === 'write') return support.startWrite(ctx);
  return support.showSupport(ctx);
}

function topupRouter(ctx, action) {
  if (action === 'cancel') return topup.cancel(ctx);
  return topup.askAmount(ctx);
}

async function adminRouter(ctx, action, a, b) {
  if (!isAdmin(ctx)) {
    await ctx.answerCbQuery('Доступ запрещён').catch(() => {});
    return;
  }
  switch (action) {
    case 'main':
      return adminIndex.show(ctx);
    case 'categories':
      return adminCategories.show(ctx, parseInt(a) || 1);
    case 'catadd':
      return adminCategories.startAdd(ctx);
    case 'catup':
      return adminCategories.move(ctx, parseInt(a) || 0, -1);
    case 'catdown':
      return adminCategories.move(ctx, parseInt(a) || 0, 1);
    case 'catedit':
      return adminCategories.startEdit(ctx, parseInt(a) || 0);
    case 'catdel':
      return adminCategories.askDelete(ctx, parseInt(a) || 0);
    case 'catdelyes':
      return adminCategories.doDelete(ctx, parseInt(a) || 0);
    case 'catdelno':
      return adminCategories.show(ctx, 1);
    case 'products':
      return adminProducts.show(ctx, parseInt(a) || 1);
    case 'product':
      return productSubRouter(ctx, a, b);
    case 'paddcat':
      return adminProducts.setCategory(ctx, parseInt(a) || 0);
    case 'paddtype':
      return adminProducts.setType(ctx, a);
    case 'paddvis':
      return adminProducts.setVisibility(ctx, parseInt(a) || 0);
    case 'pedit':
      return adminProducts.startFieldEdit(ctx, parseInt(a) || 0, b);
    case 'pedittype':
      return adminProducts.setEditType(ctx, parseInt(a) || 0, b);
    case 'peditvis':
      return adminProducts.setEditVisibility(ctx, parseInt(a) || 0, parseInt(b) || 0);
    case 'orders':
      return adminOrders.show(ctx, a, parseInt(b) || 1);
    case 'order':
      if (a === 'view') return adminOrders.showDetail(ctx, parseInt(b) || 0);
      if (a === 'deliver') return adminOrders.deliver(ctx, parseInt(b) || 0);
      if (a === 'refund') return adminOrders.askRefund(ctx, parseInt(b) || 0);
      if (a === 'refundyes') return adminOrders.doRefund(ctx, parseInt(b) || 0);
      if (a === 'refundno') return adminOrders.showDetail(ctx, parseInt(b) || 0);
      return;
    case 'bcast':
      if (a === 'send') return adminBroadcast.send(ctx);
      if (a === 'cancel') return adminBroadcast.cancel(ctx);
      return adminBroadcast.start(ctx);
    case 'stats':
      return adminStats.show(ctx);
    case 'edit':
      return adminEditMsg.start(ctx, a);
    case 'reset':
      return adminEditMsg.reset(ctx, a);
    case 'button':
      if (a === 'target') return adminEditMsg.handleButtonTarget(ctx, b);
      return adminEditMsg.handleButton(ctx, a, b);
    default:
      return unknownCallback(ctx, `admin:${action || ''}`);
  }
}

async function unknownCallback(ctx, data) {
  logger.warn('unknown callback action', {
    updateId: ctx.update && ctx.update.update_id,
    userId: ctx.from && ctx.from.id,
    data,
  });
  return ctx.answerCbQuery('Это действие больше недоступно. Открой меню заново.').catch(() => {});
}

function productSubRouter(ctx, a, b) {
  if (a === 'add') return adminProducts.startAdd(ctx);
  if (a === 'edit') return adminProducts.showEditMenu(ctx, parseInt(b) || 0);
  if (a === 'del') return adminProducts.askDelete(ctx, parseInt(b) || 0);
  if (a === 'delyes') return adminProducts.doDelete(ctx, parseInt(b) || 0);
  if (a === 'delno') return adminProducts.show(ctx, 1);
  if (a === 'toggle') return adminProducts.toggle(ctx, parseInt(b) || 0);
  return ctx.answerCbQuery('Действие недоступно').catch(() => {});
}

module.exports = { bot, registerCommands, USER_COMMANDS, ADMIN_COMMANDS };
