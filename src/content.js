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
const fs = require('fs');
const path = require('path');
const config = require('./config');

const FILE = process.env.CONTENT_FILE || path.join(path.dirname(config.DB_PATH), 'content.json');

let cache = null;

const VARIABLES = [
  { key: 'balance', desc: 'баланс (123.45₽)' },
  { key: 'username', desc: 'имя пользователя' },
  { key: 'first_name', desc: 'имя' },
  { key: 'nickname', desc: 'ник/отображаемое имя' },
  { key: 'user_id', desc: 'ID' },
  { key: 'welcome_emoji', desc: 'premium emoji приветствия (если настроен)' },
];

const DEFAULT_TEXT = {
  main:
    '{welcome_emoji} *Добро пожаловать в FZZ MARKET, @{username}\\!*\n\n' +
    '🗂 *Здесь ты найдёшь всё необходимое в одном месте:*\n' +
    '🎮 Игровые аккаунты и товары\n\n' +
    '🔑 Подписки и различные услуги\n\n' +
    '💰 Игровая валюта и донат\n\n' +
    '📚 Гайды и полезные материалы\n\n' +
    '🛍 Другие цифровые товары\n\n' +
    '✨ *Почему стоит выбрать нас?*\n' +
    '⚡️ Быстрая выдача товара\n' +
    '💳 Удобное пополнение баланса\n' +
    '🛡 Гарантия на приобретённые товары\n' +
    '💬 Оперативная поддержка\n' +
    '🔥 Регулярные обновления ассортимента\n\n' +
    '❤️ *Приятных покупок и добро пожаловать в FZZ MARKET\\!*',
  about:
    'ℹ️ <b>О магазине — ShopBot</b>\n\n' +
    'Здесь будет описание магазина: чем торгуешь, как работаешь и почему стоит покупать именно у тебя.\n\n' +
    'Пример:\n' +
    '• Цифровые товары: аккаунты, пополнения, доступы\n' +
    '• Выдача сразу после оплаты\n' +
    '• Отвечаем в чате быстро\n' +
    '• Новые лоты появляются регулярно\n\n' +
    '⭐ <b>Политика возврата</b>\n' +
    '• Вернём деньги, если товар не выдали или он оказался нерабочим.\n' +
    '• После выдачи цифровые товары возврату не подлежат.\n' +
    '• Если ошибка с нашей стороны, деньги вернём на баланс.\n' +
    '• Обращение рассматриваем до 24 часов. Пиши в поддержку.\n' +
    '![🎁](tg://emoji?id=5470077185773579690)',
  support:
    '💬 <b>Поддержка</b>\n\n' +
    'Частые вопросы:\n\n' +
    '• <b>Как получить товар?</b>\n' +
    '  Авто-товары приходят сразу после оплаты. Ручные выдают в течение 15–60 минут. Статус смотри в «Профиль → Мои заказы».\n\n' +
    '• <b>Как пополнить баланс?</b>\n' +
    '  «Пополнить» → выбери сумму → оплати через платёжную систему. Баланс зачислится сам.\n\n' +
    '• <b>Как вернуть деньги?</b>\n' +
    '  Напиши в поддержку, разберёмся. Подробнее в «О магазине».\n\n' +
    '• <b>Товар оказался нерабочим?</b>\n' +
    '  Напиши в поддержку и приложи номер заказа, проверим и заменим или вернём деньги.',
};

const DEFAULT_BUTTONS = {
  main: [
    ['🗂 Каталог', 'menu:catalog'],
    ['💰 Пополнить', 'menu:topup'],
    ['👤 Профиль', 'menu:profile'],
    ['ℹ О магазине', 'menu:about'],
    ['💭 Поддержка', 'menu:support'],
  ],
  about: [['⬅️ Назад', 'menu:main']],
  support: [
    ['✉️ Написать в поддержку', 'support:write'],
    ['⬅️ Назад', 'menu:main'],
  ],
};

const DEFAULT_PARSE_MODE = {
  main: 'MarkdownV2',
  about: 'HTML',
  support: 'HTML',
};

const DEFAULT_IMAGE = {
  main: 'asset:fzz-market.png',
};

function renderTemplate(text, vars = {}) {
  if (!text) return '';
  return text.replace(/\{(\w+)\}/g, (match, key) => {
    if (key in vars) return String(vars[key]);
    return match;
  });
}

function getVariableGuide() {
  return VARIABLES.map((v) => `{${v.key}} — ${v.desc}`).join('\n');
}

function load() {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    cache = {};
  }
  return cache;
}

function get(key) {
  return load()[key] || null;
}

function set(key, value) {
  const all = load();
  if (value == null) delete all[key];
  else all[key] = value;
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(all, null, 2));
  cache = all;
}

function getDefaultText(key) {
  return DEFAULT_TEXT[key] || null;
}

function getDefaultButtons(key) {
  return DEFAULT_BUTTONS[key] || null;
}

function getParseMode(key) {
  const stored = get(key);
  return (stored && stored.parse_mode) || DEFAULT_PARSE_MODE[key] || 'HTML';
}

function getImage(key) {
  const stored = get(key);
  if (stored && Object.prototype.hasOwnProperty.call(stored, 'image_url')) return stored.image_url;
  return DEFAULT_IMAGE[key] || null;
}

function filePath() {
  return FILE;
}

module.exports = {
  get,
  set,
  load,
  filePath,
  getDefaultText,
  getDefaultButtons,
  getParseMode,
  getImage,
  renderTemplate,
  getVariableGuide,
  VARIABLES,
};
