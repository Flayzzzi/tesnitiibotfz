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
const db = require('./index');
const categories = require('./models/categories');
const products = require('./models/products');

function seed() {
  if (categories.all().length) {
    console.log('[seed] DB already has data, skipping.');
    return;
  }
  const games = categories.create({ name: 'Игры', emoji_key: 'star' });
  const topup = categories.create({ name: 'Пополнения', emoji_key: 'topup' });

  products.create({
    category_id: games,
    name: 'Steam Gift Card 100₽',
    description: 'Код пополнения Steam на 100 рублей. Активация в клиенте Steam.',
    price: 90,
    type: 'auto',
    content: 'XXXX-0001-AAAA\nXXXX-0002-BBBB\nXXXX-0003-CCCC',
    stock: 3,
    visible: 1,
  });
  products.create({
    category_id: games,
    name: 'Игровая валюта (ручная выдача)',
    description: 'Пополнение игровой валюты. Выдача в течение 15 минут.',
    price: 150,
    type: 'manual',
    content: null,
    stock: 0,
    visible: 1,
  });
  products.create({
    category_id: topup,
    name: 'Mobile Balance 50₽',
    description: 'Пополнение мобильного баланса.',
    price: 50,
    type: 'auto',
    content: 'TICKET-001\nTICKET-002',
    stock: 2,
    visible: 1,
  });

  console.log('[seed] Sample data created.');
}

if (require.main === module) seed();

module.exports = seed;
