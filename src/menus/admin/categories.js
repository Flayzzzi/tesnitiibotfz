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
const { esc } = require('../../utils/format');
const { backButton, renderMenu } = require('../../utils/keyboard');
const { isHttpUrl, imageMessageReference } = require('../../utils/media');
const { withInputMenu } = require('../../utils/input_menu');

async function show(ctx, page = 1) {
  if (!isAdmin(ctx)) return ctx.answerCbQuery('Доступ запрещён').catch(() => {});
  const cats = categories.all();
  const rows = cats.map((c) => [
    Markup.button.callback(`${ef('up')}`, `admin:catup:${c.id}`),
    Markup.button.callback(`${c.name}${c.image_url ? ` 🖼` : ''}`, `admin:catedit:${c.id}`),
    Markup.button.callback(`${ef('down')}`, `admin:catdown:${c.id}`),
    Markup.button.callback(`${ef('trash')}`, `admin:catdel:${c.id}`),
  ]);
  rows.push([
    Markup.button.callback(`${ef('plus')} Добавить категорию`, 'admin:catadd'),
    backButton('admin:main'),
  ]);
  return renderMenu(ctx, `${e('list')} <b>Категории</b>\n\n↑/↓ порядок, ✏ имя, 🖼 изображение, 🗑 удалить`, Markup.inlineKeyboard(rows));
}

async function move(ctx, id, dir) {
  categories.move(id, dir);
  await ctx.answerCbQuery().catch(() => {});
  return show(ctx);
}

async function startAdd(ctx) {
  ctx.session.adminWizard = { flow: 'addCategory', step: 0, data: {} };
  await ctx.answerCbQuery().catch(() => {});
  return ctx.reply('Введите название категории:', withInputMenu({ parse_mode: 'HTML' }));
}

async function onMessage(ctx) {
  const text = ctx.message.text || '';
  const imageReference = imageMessageReference(ctx.message);
  const w = ctx.session.adminWizard;

  if (!w) return false;

  if (w.flow === 'addCategory') {
    if (w.step === 0) {
      const name = text.trim();
      if (!name) {
        await ctx.reply(`${e('cross')} Название не должно быть пустым. Введите название категории:`, withInputMenu({ parse_mode: 'HTML' }));
        return true;
      }
      w.data.name = name;
      w.step = 1;
      return ctx.reply('Пришлите изображение (фото или PNG/JPG файлом), HTTP(S) URL либо «—» чтобы пропустить:', withInputMenu({ parse_mode: 'HTML' }));
    }
    if (w.step === 1) {
      let imageUrl = null;
      if (imageReference) {
        imageUrl = imageReference;
      } else {
        // Text input - check if it's a URL or —
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

      if (imageUrl) {
        categories.create({ name: w.data.name, emoji_key: null, image_url: imageUrl });
      } else {
        categories.create({ name: w.data.name, emoji_key: null, image_url: null });
      }
      ctx.session.adminWizard = {};
      return ctx.reply(`${e('check')} Категория «${esc(w.data.name)}» создана.`, {
        parse_mode: 'HTML',
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback(`${ef('plus')} Добавить ещё`, 'admin:catadd'), backButton('admin:categories:1')],
        ]).reply_markup,
      });
    }
    return false;
  }

  if (w.flow === 'editCategory') {
    if (w.step === 0) {
      const name = text.trim();
      if (name !== '—' && name !== '-') {
        if (!name) {
          await ctx.reply(`${e('cross')} Название не должно быть пустым. Введите новое название или «—»:`, withInputMenu({ parse_mode: 'HTML' }));
          return true;
        }
        categories.update(w.data.id, { name });
      }
      w.step = 1;
      return ctx.reply('Пришлите изображение (фото или PNG/JPG файлом), HTTP(S) URL; «—» — оставить, «удалить» — убрать изображение:', withInputMenu({ parse_mode: 'HTML' }));
    }
    if (w.step === 1) {
      let imageUrl = null;
      if (imageReference) {
        imageUrl = imageReference;
      } else {
        const trimmed = text.trim();
        if (trimmed === '—' || trimmed === '-') {
          // Keep current image, do nothing
        } else if (trimmed.toLowerCase() === 'удалить') {
          categories.update(w.data.id, { image_url: null });
        } else if (isHttpUrl(trimmed)) {
          imageUrl = trimmed;
        } else {
          await ctx.reply(`${e('cross')} Пришлите изображение, HTTP(S) URL, «—» или «удалить».`, withInputMenu({ parse_mode: 'HTML' }));
          return true;
        }
      }

      if (imageUrl) {
        categories.update(w.data.id, { image_url: imageUrl });
      }
      // If no photo and not '—', also keep current name (already handled above)
      ctx.session.adminWizard = {};
      return ctx.reply(`${e('check')} Категория обновлена.`, {
        parse_mode: 'HTML',
        reply_markup: Markup.inlineKeyboard([[backButton('admin:categories:1')]]).reply_markup,
      });
    }
    return false;
  }
  return false;
}

async function startEdit(ctx, id) {
  const cat = categories.get(id);
  if (!cat) return ctx.answerCbQuery('Категория не найдена.').catch(() => {});
  ctx.session.adminWizard = { flow: 'editCategory', step: 0, data: { id } };
  await ctx.answerCbQuery().catch(() => {});
  return ctx.reply(`Текущее название: <b>${esc(cat.name)}</b>\n\nПришлите новое название или «—»:`, withInputMenu({ parse_mode: 'HTML' }));
}

async function askDelete(ctx, id) {
  const cat = categories.get(id);
  if (!cat) return ctx.answerCbQuery('Категория не найдена.').catch(() => {});
  const prodCount = products.all({ categoryId: id }).length;
  return renderMenu(
    ctx,
    `${e('cross')} Удалить категорию <b>${esc(cat.name)}</b>?\n\nБудут удалены связанные товары (${prodCount}).`,
    Markup.inlineKeyboard([
      [Markup.button.callback(`${ef('check')} Да, удалить`, `admin:catdelyes:${id}`)],
      [Markup.button.callback(`${ef('cross')} Отмена`, 'admin:categories:1')],
    ])
  );
}

async function doDelete(ctx, id) {
  const cat = categories.get(id);
  if (!cat) return ctx.answerCbQuery('Категория не найдена.').catch(() => {});
  const prods = products.all({ categoryId: id });
  const del = async () => {
    for (const p of prods) products.remove(p.id);
    categories.remove(id);
  };
  await del();
  await ctx.answerCbQuery('Удалено').catch(() => {});
  return show(ctx);
}

module.exports = { show, move, startAdd, onMessage, startEdit, askDelete, doDelete };
