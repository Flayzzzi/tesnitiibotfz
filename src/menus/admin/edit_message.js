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
const content = require('../../content');
const { isAdmin } = require('../../middleware/isAdmin');
const { Markup } = require('telegraf');
const { withInputMenu } = require('../../utils/input_menu');
const { isHttpUrl, imageMessageReference } = require('../../utils/media');
const { restoreCustomEmojiMarkers, restoreIncomingCustomEmojiEntities } = require('../../utils/markdown');

const VIEW_NAMES = {
  main: 'Главное меню',
  about: 'О магазине',
  support: 'Поддержка',
};

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buttonLabelPreview(label) {
  const raw = String(label || '');
  const match = /^\\?!\[([^\]\n]*)\]\(tg:\/\/emoji\?id=(\d+)\)([\s\S]*)$/.exec(raw);
  // Inline buttons cannot render custom emoji, so preview the exact fallback
  // glyph the button will actually show instead of a premium <tg-emoji> that
  // only works in message bodies (which would mislead the admin).
  if (!match) return esc(raw);
  return `${esc(match[1])}${esc(match[3])}`;
}

const ACTIONS = {
  catalog: ['Каталог', 'menu:catalog'],
  topup: ['Пополнить баланс', 'menu:topup'],
  profile: ['Профиль', 'menu:profile'],
  about: ['О магазине', 'menu:about'],
  support: ['Поддержка', 'menu:support'],
  main: ['Главное меню', 'menu:main'],
  write: ['Написать в поддержку', 'support:write'],
};

function normalizeButtons(buttons) {
  return (buttons || []).map((button) => {
    if (Array.isArray(button)) return [String(button[0] || ''), String(button[1] || '')];
    return [String(button.label || ''), String(button.data || '')];
  });
}

function reShowMenu(ctx, view) {
  if (view === 'main') {
    const mainMenu = require('../main');
    return mainMenu.show(ctx);
  }
  if (view === 'about') {
    const about = require('../about');
    return about.showAbout(ctx);
  }
  if (view === 'support') {
    const support = require('../support');
    return support.showSupport(ctx);
  }
}

async function start(ctx, view) {
  if (!isAdmin(ctx)) {
    return ctx.reply('Доступ запрещён.');
  }
  view = view || ctx.session.lastView;
  if (!view || !VIEW_NAMES[view]) {
    return ctx.reply(
      'Сначала открой меню, которое хочешь изменить.\n\n' +
        'Кнопка «О магазине», «Поддержка» или главное меню — потом «✏️ Редактировать».',
    );
  }

  const stored = content.get(view);
  const currentText =
    stored && stored.text ? stored.text : content.getDefaultText(view) || '(текст не задан)';
  const currentButtons = normalizeButtons(stored && stored.buttons ? stored.buttons : content.getDefaultButtons(view));
  ctx.session.adminWizard = {
    flow: 'edit_menu',
    view,
    step: 'editor_menu',
    newText: null,
    buttons: currentButtons,
    buttonsChanged: false,
  };

  return ctx.reply(
    `✏️ <b>Редактируем: ${VIEW_NAMES[view]}</b>\n\n` +
      `Выбери, что изменить или сразу отправь новый текст. Изменения сохранятся только после «✅ Готово».\n\n` +
      `<b>Текущий шаблон:</b>\n<pre>${esc(currentText)}</pre>`,
    { parse_mode: 'HTML', reply_markup: editorStartKeyboard(view).reply_markup },
  );
}

async function reset(ctx, view) {
  if (!isAdmin(ctx)) {
    return ctx.reply('Доступ запрещён.');
  }
  view = view || ctx.session.lastView;
  if (!view || !VIEW_NAMES[view]) {
    return ctx.reply('Не удалось определить меню.');
  }

  content.set(view, null);
  return reShowMenu(ctx, view);
}

function editorKeyboard(buttons, view) {
  const rows = buttons.map(([label], index) => [
    Markup.button.callback(`✏️ ${label || 'Без названия'}`, `admin:button:edit:${index}`),
    Markup.button.callback('🗑', `admin:button:remove:${index}`),
  ]);
  rows.push([Markup.button.callback('📝 Изменить текст', 'admin:button:text')]);
  rows.push([Markup.button.callback('➕ Добавить кнопку', 'admin:button:add')]);
  if (view === 'main') rows.push([Markup.button.callback('🖼 Изменить обложку', 'admin:button:image')]);
  if (buttons.length) rows.push([Markup.button.callback('🧹 Очистить', 'admin:button:clear')]);
  rows.push([
    Markup.button.callback('✅ Готово', 'admin:button:done'),
    Markup.button.callback('✖️ Отмена', 'admin:button:cancel'),
  ]);
  return Markup.inlineKeyboard(rows);
}

function editorStartKeyboard(view) {
  const rows = [
    [Markup.button.callback('📝 Изменить текст', 'admin:button:text')],
    [Markup.button.callback('🔘 Изменить кнопки', 'admin:button:buttons')],
  ];
  if (view === 'main') rows.splice(1, 0, [Markup.button.callback('🖼 Изменить обложку', 'admin:button:image')]);
  rows.push([
    Markup.button.callback('✅ Готово', 'admin:button:done'),
    Markup.button.callback('✖️ Отмена', 'admin:button:cancel'),
  ]);
  return Markup.inlineKeyboard(rows);
}

function textEditorPrompt(currentText) {
  return `📝 <b>Текущий шаблон:</b>\n<pre>${esc(currentText)}</pre>\n\n` +
    `<b>Переменные:</b>\n<code>${esc(content.getVariableGuide())}</code>\n\n` +
    `<b>Форматирование нового шаблона: MarkdownV2</b>\n` +
    `Жирный: <code>*текст*</code> • курсив: <code>_текст_</code> • код: <code>\`текст\`</code>\n` +
    `Premium emoji: <code>![🤝](tg://emoji?id=ЧИСЛОВОЙ_ID)</code>\n` +
    `ID можно получить через @LibToolbot.\n\n` +
    `Отправь новый шаблон в MarkdownV2 или «—» чтобы оставить как есть.`;
}

async function showButtonEditor(ctx) {
  const w = ctx.session.adminWizard;
  const labels = w.buttons.length
    ? w.buttons.map(([label], index) => `${index + 1}. ${buttonLabelPreview(label)}`).join('\n')
    : 'Кнопок пока нет.';
  const imageNotice = w.imageChanged ? '\n\n🖼 Новая обложка выбрана. Нажми «✅ Готово», чтобы сохранить её.' : '';
  const text = `<b>Кнопки</b>\n\n${labels}\n\nНажми ✏️, чтобы изменить кнопку, или ➕, чтобы добавить новую. Действие выбирается кнопкой — код вводить не нужно.${imageNotice}`;
  const opts = { parse_mode: 'HTML', reply_markup: editorKeyboard(w.buttons, w.view).reply_markup };
  if (ctx.callbackQuery) {
    return ctx.editMessageText(text, opts).catch((err) => {
      if (String(err.message).includes('not modified')) return undefined;
      return ctx.reply(text, opts);
    });
  }
  return ctx.reply(text, opts);
}

async function showActionPicker(ctx) {
  const w = ctx.session.adminWizard;
  const rows = [
    ['catalog', 'topup'],
    ['profile', 'about'],
    ['support', 'main'],
    ['write'],
  ].map((keys) => keys.map((key) => Markup.button.callback(ACTIONS[key][0], `admin:button:target:${key}`)));
  if (w.editIndex != null) rows.push([Markup.button.callback('Оставить текущее действие', 'admin:button:target:keep')]);
  rows.push([
    Markup.button.callback('🔗 URL', 'admin:button:target:url'),
    Markup.button.callback('⌨️ Другое действие', 'admin:button:target:custom'),
  ]);
  return ctx.reply(`Выбери действие для кнопки <b>${buttonLabelPreview(w.pendingLabel)}</b>:`, {
    parse_mode: 'HTML',
    reply_markup: Markup.inlineKeyboard(rows).reply_markup,
  });
}

function saveButton(w, data) {
  const button = [w.pendingLabel, data];
  if (w.editIndex == null) w.buttons.push(button);
  else w.buttons[w.editIndex] = button;
  w.buttonsChanged = true;
  w.editIndex = null;
  w.pendingLabel = null;
  w.step = 'button_menu';
}

async function handleText(ctx, rawText) {
  const w = ctx.session.adminWizard;
  if (!w || w.flow !== 'edit_menu') return false;

  const view = w.view;
  const stored = content.get(view);
  const currentButtons = normalizeButtons(stored && stored.buttons ? stored.buttons : content.getDefaultButtons(view));

  const inputText = restoreIncomingCustomEmojiEntities(rawText, ctx.message && ctx.message.entities);

  if (w.step === 'text' || w.step === 'editor_menu') {
    const newText = inputText === '—' || inputText === '-' ? null : restoreCustomEmojiMarkers(inputText);

    Object.assign(ctx.session.adminWizard, {
      step: 'button_menu',
      newText,
      buttons: currentButtons,
      buttonsChanged: false,
    });
    await showButtonEditor(ctx);
    return true;
  }

  if (w.step === 'button_label') {
    const rawLabel = String(inputText).trim();
    const keepLabel = rawLabel === '—' || rawLabel === '-';
    if ((!rawLabel || keepLabel) && w.editIndex == null) {
      await ctx.reply('Название кнопки не должно быть пустым.');
      return true;
    }
    w.pendingLabel = keepLabel ? w.buttons[w.editIndex][0] : rawLabel;
    w.step = 'button_target';
    await showActionPicker(ctx);
    return true;
  }

  if (w.step === 'button_action') {
    const value = String(inputText).trim();
    if (!value) {
      await ctx.reply('Действие не должно быть пустым.');
      return true;
    }
    if (w.actionMode === 'url' && !/^https?:\/\//i.test(value)) {
      await ctx.reply('Нужна ссылка, начинающаяся с http:// или https://.');
      return true;
    }
    saveButton(w, w.actionMode === 'url' ? `url:${value}` : value);
    await showButtonEditor(ctx);
    return true;
  }

  if (w.step === 'image') {
    const value = String(rawText).trim();
    if (value === '—') {
      w.imageChanged = true;
      w.imageUrl = undefined;
    } else if (value === '-' || value.toLowerCase() === 'удалить') {
      w.imageChanged = true;
      w.imageUrl = null;
    } else if (isHttpUrl(value)) {
      w.imageChanged = true;
      w.imageUrl = value;
    } else {
      await ctx.reply('Пришли фото, HTTP(S) URL, «—» чтобы оставить текущую обложку, или «удалить».');
      return true;
    }
    w.step = 'button_menu';
    await showButtonEditor(ctx);
    return true;
  }

  return false;
}

async function handleButton(ctx, action, value) {
  const w = ctx.session.adminWizard;
  if (!w || w.flow !== 'edit_menu') return ctx.answerCbQuery('Редактирование не активно.').catch(() => {});
  if (action === 'text') {
    const stored = content.get(w.view);
    const currentText = stored && stored.text ? stored.text : content.getDefaultText(w.view) || '(текст не задан)';
    w.step = 'text';
    await ctx.answerCbQuery().catch(() => {});
    return ctx.reply(textEditorPrompt(currentText), withInputMenu({ parse_mode: 'HTML' }));
  }
  if (action === 'buttons') {
    w.step = 'button_menu';
    await ctx.answerCbQuery().catch(() => {});
    return showButtonEditor(ctx);
  }
  if (action === 'image' && w.view === 'main') {
    w.step = 'image';
    await ctx.answerCbQuery().catch(() => {});
    return ctx.reply('Пришли новое фото, HTTP(S) URL, «—» чтобы оставить текущую обложку, или «удалить».', withInputMenu({ parse_mode: 'HTML' }));
  }
  if (action === 'done' || action === 'cancel') {
    // These actions are valid both from the start panel and from the buttons panel.
  } else if (w.step !== 'button_menu') {
    return ctx.answerCbQuery('Сначала выбери, что изменить.').catch(() => {});
  }
  const index = Number(value);
  if (action === 'edit' || action === 'remove') {
    if (!Number.isInteger(index) || !w.buttons[index]) return ctx.answerCbQuery('Кнопка не найдена.').catch(() => {});
    if (action === 'remove') {
      w.buttons.splice(index, 1);
      w.buttonsChanged = true;
      await ctx.answerCbQuery('Удалено').catch(() => {});
      return showButtonEditor(ctx);
    }
    w.editIndex = index;
    w.step = 'button_label';
    await ctx.answerCbQuery().catch(() => {});
    return ctx.reply(`Новое название для «${buttonLabelPreview(w.buttons[index][0])}» или «—», чтобы оставить:`, withInputMenu({ parse_mode: 'HTML' }));
  }
  if (action === 'add') {
    w.editIndex = null;
    w.step = 'button_label';
    await ctx.answerCbQuery().catch(() => {});
    return ctx.reply('Введите название новой кнопки:', withInputMenu({ parse_mode: 'HTML' }));
  }
  if (action === 'clear') {
    w.buttons = [];
    w.buttonsChanged = true;
    await ctx.answerCbQuery('Список очищен.').catch(() => {});
    return showButtonEditor(ctx);
  }
  if (action === 'done') {
    const updates = {};
    if (w.newText !== null) {
      updates.text = w.newText;
      updates.parse_mode = 'MarkdownV2';
    }
    if (w.buttonsChanged) updates.buttons = w.buttons;
    if (w.imageChanged && w.imageUrl !== undefined) updates.image_url = w.imageUrl;
    ctx.session.adminWizard = {};
    await ctx.answerCbQuery().catch(() => {});
    if (!Object.keys(updates).length) return ctx.reply('Ничего не изменено.');
    content.set(w.view, { ...content.get(w.view), ...updates });
    return reShowMenu(ctx, w.view);
  }
  if (action === 'cancel') {
    const view = w.view;
    ctx.session.adminWizard = {};
    await ctx.answerCbQuery('Отменено').catch(() => {});
    return reShowMenu(ctx, view);
  }
  return ctx.answerCbQuery('Неизвестное действие.').catch(() => {});
}

async function handlePhoto(ctx) {
  const w = ctx.session.adminWizard;
  if (!w || w.flow !== 'edit_menu' || w.view !== 'main' || w.step !== 'image') return false;
  const imageUrl = imageMessageReference(ctx.message);
  if (!imageUrl) return false;
  w.imageChanged = true;
  w.imageUrl = imageUrl;
  w.step = 'button_menu';
  await showButtonEditor(ctx);
  return true;
}

async function handleButtonTarget(ctx, target) {
  const w = ctx.session.adminWizard;
  if (!w || w.flow !== 'edit_menu' || w.step !== 'button_target') return ctx.answerCbQuery('Сначала выбери кнопку.').catch(() => {});
  if (target === 'url' || target === 'custom') {
    w.step = 'button_action';
    w.actionMode = target;
    await ctx.answerCbQuery().catch(() => {});
    return ctx.reply(target === 'url' ? 'Введите HTTP(S) ссылку:' : 'Введите callback-действие:', withInputMenu({ parse_mode: 'HTML' }));
  }
  if (target === 'keep') {
    if (w.editIndex == null) return ctx.answerCbQuery('Для новой кнопки нужно выбрать действие.').catch(() => {});
    saveButton(w, w.buttons[w.editIndex][1]);
  } else if (ACTIONS[target]) {
    saveButton(w, ACTIONS[target][1]);
  } else {
    return ctx.answerCbQuery('Неизвестное действие.').catch(() => {});
  }
  await ctx.answerCbQuery('Готово').catch(() => {});
  return showButtonEditor(ctx);
}

module.exports = { start, handleText, handlePhoto, reset, handleButton, handleButtonTarget };
