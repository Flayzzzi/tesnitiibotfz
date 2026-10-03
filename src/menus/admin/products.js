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
const categories = require('../../db/models/categories');
const products = require('../../db/models/products');
const { e, ef } = require('../../utils/emoji');
const { esc, formatBalance: fmtBalance } = require('../../utils/format');
const { backButton, renderMenu } = require('../../utils/keyboard');
const { paginate } = require('../../utils/paginate');
const { isHttpUrl, imageMessageReference } = require('../../utils/media');
const { notifyStockSubscribers } = require('../../notifications');
const { withInputMenu } = require('../../utils/input_menu');

const PAGE_SIZE = 5;

async function show(ctx, page = 1) {
  if (!isAdmin(ctx)) return ctx.answerCbQuery('Доступ запрещён').catch(() => {});
  const prods = products.all({});
  const pg = paginate(prods, page, PAGE_SIZE);
  const rows = [];
  for (const p of pg.items) {
    const imageHtml = p.image_url ? '🖼' : '';
    const meta = `${p.category_name ? esc(p.category_name) : '—'}${p.type === 'auto' ? ` • сток: ${p.stock}` : ''}`;
    rows.push([Markup.button.callback(`${imageHtml} ${p.visible ? ef('eye') : '🙈'} ${p.name} (${fmtBalance(p.price)})`, `admin:product:edit:${p.id}`)]);
    rows.push([
      Markup.button.callback(meta, `admin:product:edit:${p.id}`),
      Markup.button.callback(`${ef('edit')} Изменить`, `admin:product:edit:${p.id}`),
      Markup.button.callback(`${ef('trash')}`, `admin:product:del:${p.id}`),
    ]);
  }
  const nav = [];
  if (pg.hasPrev) nav.push(Markup.button.callback(`${ef('back')} ←`, `admin:products:${pg.page - 1}`));
  if (pg.hasNext) nav.push(Markup.button.callback('→', `admin:products:${pg.page + 1}`));
  if (nav.length) rows.push(nav);
  rows.push([
    Markup.button.callback(`${ef('plus')} Добавить товар`, 'admin:product:add'),
    backButton('admin:main'),
  ]);
  return renderMenu(ctx, `${e('catalog')} <b>Товары</b>\n\n${pg.total ? `Всего: ${pg.total}` : 'Пока нет товаров'}`, Markup.inlineKeyboard(rows));
}

async function promptCategory(ctx) {
  const cats = categories.all();
  if (!cats.length) {
    ctx.session.adminWizard = {};
    return ctx.reply(`${e('cross')} Сначала создай категорию в «Категории».`, { parse_mode: 'HTML' });
  }
  const rows = [];
  for (let i = 0; i < cats.length; i += 2) {
    const row = [];
    row.push(Markup.button.callback(cats[i].name, `admin:paddcat:${cats[i].id}`));
    if (cats[i + 1]) {
      row.push(Markup.button.callback(cats[i + 1].name, `admin:paddcat:${cats[i + 1].id}`));
    }
    rows.push(row);
  }
  rows.push([backButton('admin:products:1')]);
  return ctx.reply(`${e('list')} Выбери категорию для нового товара:`, {
    parse_mode: 'HTML',
    reply_markup: Markup.inlineKeyboard(rows).reply_markup,
  });
}

async function startAdd(ctx) {
  ctx.session.adminWizard = { flow: 'addProduct', step: 0, data: {} };
  await ctx.answerCbQuery().catch(() => {});
  return promptCategory(ctx);
}

async function setCategory(ctx, categoryId) {
  const w = ctx.session.adminWizard;
  if (!w || w.flow !== 'addProduct') return ctx.answerCbQuery('Сессия истекла').catch(() => {});
  w.data.categoryId = categoryId;
  w.step = 1;
  await ctx.answerCbQuery().catch(() => {});
  return ctx.reply('Введите название товара:', withInputMenu({ parse_mode: 'HTML' }));
}

async function onMessage(ctx) {
  const text = ctx.message.text || '';
  const imageReference = imageMessageReference(ctx.message);
  const w = ctx.session.adminWizard;

  if (!w) return false;

  if (w.flow === 'addProduct') {
    if (w.step === 0) {
      // Step 0 handled by category prompt, but handle photo here
      if (imageReference) {
        w.data.image_url = imageReference;
        w.step = 1;
        return ctx.reply('Введите название товара:', withInputMenu({ parse_mode: 'HTML' }));
      }
      return promptCategory(ctx);
    }
    if (w.step === 1) {
      const name = text.trim();
      if (!name) {
        await ctx.reply(`${e('cross')} Название не должно быть пустым. Введите название товара:`, withInputMenu({ parse_mode: 'HTML' }));
        return true;
      }
      w.data.name = name;
      w.step = 2;
      return ctx.reply('Введите описание:', withInputMenu({ parse_mode: 'HTML' }));
    }
    if (w.step === 2) {
      w.data.description = text;
      w.step = 3;
      return ctx.reply('Введите цену в рублях:', withInputMenu({ parse_mode: 'HTML' }));
    }
    if (w.step === 3) {
      const price = Number(String(text).replace(',', '.'));
      if (!Number.isFinite(price) || price <= 0) {
        await ctx.reply(`${e('cross')} Введите корректную цену:`, withInputMenu({ parse_mode: 'HTML' }));
        return true;
      }
      w.data.price = price;
      w.step = 4;
      return ctx.reply('Пришлите изображение товара (фото или PNG/JPG файлом), HTTP(S) URL или «—» чтобы пропустить:', withInputMenu({ parse_mode: 'HTML' }));
    }
    if (w.step === 4) {
      let imageUrl = null;
      if (imageReference) {
        imageUrl = imageReference;
      } else {
        const trimmed = text.trim();
        if (trimmed === '—' || trimmed === '-') {
          imageUrl = null;
        } else if (isHttpUrl(trimmed)) {
          imageUrl = trimmed;
        } else {
          await ctx.reply(`${e('cross')} Пришлите изображение, HTTP(S) URL или «—».`, withInputMenu({ parse_mode: 'HTML' }));
          return true;
        }
      }
      w.data.image_url = imageUrl;
      w.step = 5;
      return ctx.reply('Тип товара:', {
        parse_mode: 'HTML',
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('🤖 Авто (мгновенная выдача)', 'admin:paddtype:auto')],
          [Markup.button.callback('👤 Ручной (выдача админом)', 'admin:paddtype:manual')],
        ]).reply_markup,
      });
    }
    if (w.step === 5) {
      w.data.type = text;
      if (text === 'auto') {
        w.step = 6;
      } else {
        w.step = 7;
      }
      return ctx.reply('Видимость товара:', {
        parse_mode: 'HTML',
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback(`${ef('eye')} Видимый`, 'admin:paddvis:1')],
          [Markup.button.callback('🙈 Скрытый', 'admin:paddvis:0')],
        ]).reply_markup,
      });
    }
    if (w.step === 6) {
      const lines = String(text).split('\n').map((s) => s.trim()).filter(Boolean);
      w.data.content = lines.join('\n');
      w.data.stock = lines.length;
      w.step = 7;
      return ctx.reply('Видимость товара:', {
        parse_mode: 'HTML',
        reply_markup: visibilityKeyboard(),
      });
    }
    if (w.step === 7) {
      return finishAdd(ctx, text === '1');
    }
    return false;
  }

  if (w.flow === 'editProduct') {
    const p = products.get(w.data.id);
    if (!p) return false;

    if (w.data.field === 'image' && imageReference) {
      products.update(p.id, { image_url: imageReference });
      ctx.session.adminWizard = {};
      return ctx.reply(`${e('check')} Обновлено.`, {
        parse_mode: 'HTML',
        reply_markup: Markup.inlineKeyboard([[Markup.button.callback('Вернуться к товару', `admin:product:edit:${p.id}`)]]).reply_markup,
      });
    }
    return false;
  }
  return false;
}

async function showEditMenu(ctx, id) {
  return startEditMenu(ctx, id);
}

async function startEditMenu(ctx, id) {
  const p = products.get(id);
  if (!p) return ctx.answerCbQuery('Товар не найден.').catch(() => {});
  const rows = [
    [Markup.button.callback(`Название`, `admin:pedit:${id}:name`)],
    [Markup.button.callback(`Описание`, `admin:pedit:${id}:description`)],
    [Markup.button.callback(`Цена: ${fmtBalance(p.price)}`, `admin:pedit:${id}:price`)],
    [Markup.button.callback(`Изображение${p.image_url ? ' 🖼' : ''}`, `admin:pedit:${id}:image`)],
    [Markup.button.callback(`${p.type === 'auto' ? '🤖' : '👤'} Тип: ${p.type === 'auto' ? 'Авто' : 'Ручной'}`, `admin:pedittype:${id}:${p.type === 'auto' ? 'manual' : 'auto'}`)],
  ];
  if (p.type === 'auto') {
    rows.push([Markup.button.callback(`${ef('plus')} Добавить контент (сток: ${p.stock})`, `admin:pedit:${id}:content`)]);
  }
  rows.push([Markup.button.callback(`${p.visible ? ef('eye') : '🙈'} Видимость: ${p.visible ? 'Видим' : 'Скрыт'}`, `admin:peditvis:${id}:${p.visible ? 0 : 1}`)]);
  rows.push([backButton('admin:products:1')]);
  return renderMenu(ctx, `${e('edit')} <b>${esc(p.name)}</b>\n${fmtBalance(p.price)} • ${e('list')} сток: ${p.stock}`, Markup.inlineKeyboard(rows));
}

async function startFieldEdit(ctx, id, field) {
  const p = products.get(id);
  if (!p) return ctx.answerCbQuery('Товар не найден.').catch(() => {});
  ctx.session.adminWizard = { flow: 'editProduct', step: 0, data: { id, field } };
  await ctx.answerCbQuery().catch(() => {});
  if (field === 'content') {
    return ctx.reply('Вставьте новые строки контента (будут добавлены к существующим):', withInputMenu({ parse_mode: 'HTML' }));
  }
  if (field === 'price') {
    return ctx.reply(`Текущая цена: ${fmtBalance(p.price)}\n\nВведите новую цену:`, withInputMenu({ parse_mode: 'HTML' }));
  }
  if (field === 'image') {
    return ctx.reply('Пришлите изображение (фото или PNG/JPG файлом), HTTP(S) URL; «—» — оставить, «удалить» — убрать изображение:', withInputMenu({ parse_mode: 'HTML' }));
  }
  const current = p[field] ?? '';
  return ctx.reply(`Текущее значение:\n<code>${esc(String(current))}</code>\n\nВведите новое:`, withInputMenu({ parse_mode: 'HTML' }));
}

async function onEditText(ctx, text) {
  const w = ctx.session.adminWizard;
  if (!w || w.flow !== 'editProduct') return false;
  const p = products.get(w.data.id);
  if (!p) {
    ctx.session.adminWizard = {};
    return false;
  }
  switch (w.data.field) {
    case 'name':
      products.update(p.id, { name: text });
      break;
    case 'description':
      products.update(p.id, { description: text });
      break;
    case 'price': {
      const price = Number(String(text).replace(',', '.'));
      if (!Number.isFinite(price) || price <= 0) {
        await ctx.reply(`${e('cross')} Введите корректную цену:`, withInputMenu({ parse_mode: 'HTML' }));
        return true;
      }
      products.update(p.id, { price });
      break;
    }
    case 'image': {
      const value = String(text).trim();
      if (value === '—' || value === '-') break;
      if (value.toLowerCase() === 'удалить') {
        products.update(p.id, { image_url: null });
        break;
      }
      if (!isHttpUrl(value)) {
        await ctx.reply(`${e('cross')} Пришлите фото, HTTP(S) URL, «—» или «удалить».`, withInputMenu({ parse_mode: 'HTML' }));
        return true;
      }
      products.update(p.id, { image_url: value });
      break;
    }
    case 'content': {
      const lines = String(text).split('\n').map((line) => line.trim()).filter(Boolean);
      if (!lines.length) {
        await ctx.reply(`${e('cross')} Добавьте хотя бы одну непустую строку контента.`, withInputMenu({ parse_mode: 'HTML' }));
        return true;
      }
      const becameAvailable = products.addStock(p.id, lines);
      const updated = products.get(p.id);
      if (becameAvailable) await notifyStockSubscribers(updated.id, updated.name);
      break;
    }
    default:
      return false;
  }
  ctx.session.adminWizard = {};
  return ctx.reply(`${e('check')} Обновлено.`, {
    parse_mode: 'HTML',
    reply_markup: Markup.inlineKeyboard([[Markup.button.callback('Вернуться к товару', `admin:product:edit:${p.id}`)]]).reply_markup,
  });
}

async function setType(ctx, type) {
  const w = ctx.session.adminWizard;
  if (w && w.flow === 'addProduct') {
    if (w.step !== 5) return ctx.answerCbQuery('Сначала заполните предыдущие поля').catch(() => {});
    w.data.type = type;
    w.step = type === 'auto' ? 6 : 7;
    await ctx.answerCbQuery().catch(() => {});
    if (type === 'auto') {
      return ctx.reply('Вставьте строки контента для выдачи товара:', withInputMenu({ parse_mode: 'HTML' }));
    }
    return ctx.reply('Видимость товара:', {
      parse_mode: 'HTML',
      reply_markup: visibilityKeyboard(),
    });
  } else if (w && w.data?.id) {
    products.setType(w.data.id, type);
    await ctx.answerCbQuery('Тип обновлён').catch(() => {});
  } else {
    await ctx.answerCbQuery().catch(() => {});
  }
}

async function setEditType(ctx, id, type) {
  products.update(id, { type });
  await ctx.answerCbQuery('Тип обновлён').catch(() => {});
  return showEditMenu(ctx, id);
}

async function setVisibility(ctx, visible) {
  const w = ctx.session.adminWizard;
  if (w && w.flow === 'addProduct') {
    if (w.step !== 7) return ctx.answerCbQuery('Сначала заполните предыдущие поля').catch(() => {});
    await ctx.answerCbQuery().catch(() => {});
    return finishAdd(ctx, visible === 1 || visible === true);
  } else if (w && w.data?.id) {
    products.update(w.data.id, { visible });
    await ctx.answerCbQuery('Обновлено').catch(() => {});
  } else {
    await ctx.answerCbQuery().catch(() => {});
  }
}

function visibilityKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback(`${ef('eye')} Видимый`, 'admin:paddvis:1')],
    [Markup.button.callback('🙈 Скрытый', 'admin:paddvis:0')],
  ]).reply_markup;
}

async function finishAdd(ctx, visible) {
  const w = ctx.session.adminWizard;
  if (!w || w.flow !== 'addProduct') return false;

  const d = w.data;
  products.create({
    category_id: d.categoryId,
    name: d.name,
    description: d.description || '',
    price: d.price,
    type: d.type || 'manual',
    content: d.content || null,
    stock: d.type === 'auto' ? Number(d.stock) || 0 : 0,
    image_url: d.image_url || null,
    visible: visible ? 1 : 0,
  });
  ctx.session.adminWizard = {};
  await ctx.reply(`${e('check')} Товар «${esc(d.name)}» создан!`, {
    parse_mode: 'HTML',
    reply_markup: Markup.inlineKeyboard([
      [Markup.button.callback(`${ef('plus')} Добавить ещё`, 'admin:product:add'), backButton('admin:products:1')],
    ]).reply_markup,
  });
  return undefined;
}

async function setEditVisibility(ctx, id, visible) {
  products.update(id, { visible });
  await ctx.answerCbQuery('Обновлено').catch(() => {});
  return showEditMenu(ctx, id);
}

async function toggle(ctx, id) {
  const p = products.get(id);
  if (!p) return ctx.answerCbQuery('Товар не найден.').catch(() => {});
  products.update(id, { visible: p.visible ? 0 : 1 });
  await ctx.answerCbQuery('Обновлено').catch(() => {});
  return show(ctx);
}

async function askDelete(ctx, id) {
  const p = products.get(id);
  if (!p) return ctx.answerCbQuery('Товар не найден.').catch(() => {});
  return renderMenu(
    ctx,
    `${e('cross')} Удалить товар <b>${esc(p.name)}</b>? История заказов сохранится.`,
    Markup.inlineKeyboard([
      [Markup.button.callback(`${ef('check')} Да, удалить`, `admin:product:delyes:${id}`)],
      [Markup.button.callback(`${ef('cross')} Отмена`, `admin:products:1`)],
    ])
  );
}

async function doDelete(ctx, id) {
  products.remove(id);
  await ctx.answerCbQuery('Удалено').catch(() => {});
  return show(ctx);
}

module.exports = {
  show,
  startAdd,
  setCategory,
  onMessage,
  setType,
  setVisibility,
  showEditMenu,
  startFieldEdit,
  onEditText,
  setEditType,
  setEditVisibility,
  toggle,
  askDelete,
  doDelete,
};
