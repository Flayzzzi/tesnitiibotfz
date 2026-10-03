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
const MARKDOWN_V2_RESERVED = new Set(['_', '*', '[', ']', '(', ')', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!']);

function isEscaped(text, index) {
  let slashes = 0;
  for (let cursor = index - 1; cursor >= 0 && text[cursor] === '\\'; cursor -= 1) slashes += 1;
  return slashes % 2 === 1;
}

const CUSTOM_EMOJI_MARKER = /!\[[^\]\n]*\]\(tg:\/\/emoji\?id=\d+\)/g;

function customEmojiMarkerRanges(text) {
  const ranges = [];
  const re = new RegExp(CUSTOM_EMOJI_MARKER.source, 'g');
  let match;
  while ((match = re.exec(text)) !== null) ranges.push([match.index, match.index + match[0].length]);
  return ranges;
}

function isInsideCustomEmojiMarker(ranges, index) {
  return ranges.some(([start, end]) => index >= start && index < end);
}

function restoreCustomEmojiMarkers(value) {
  return String(value || '').replace(/\\!\[([^\]\n]*)\]\(tg:\/\/emoji\?id=(\d+)\)/g, '![$1](tg://emoji?id=$2)');
}

function formatCustomEmojisForParseMode(value, parseMode) {
  const text = restoreCustomEmojiMarkers(value);
  if (parseMode !== 'HTML') return text;
  return text.replace(/!\[([^\]\n]*)\]\(tg:\/\/emoji\?id=(\d+)\)/g, '<tg-emoji emoji-id="$2">$1</tg-emoji>');
}

function restoreIncomingCustomEmojiEntities(value, entities) {
  let text = String(value || '');
  const customEntities = (entities || [])
    .filter((entity) => entity && entity.type === 'custom_emoji' && entity.custom_emoji_id)
    .sort((a, b) => b.offset - a.offset);

  for (const entity of customEntities) {
    const start = Number(entity.offset);
    const length = Number(entity.length);
    if (!Number.isInteger(start) || !Number.isInteger(length) || start < 0 || length < 1) continue;
    const alternative = text.slice(start, start + length);
    if (!alternative) continue;

    // A leading ! is commonly pasted together with a premium emoji while
    // following Markdown examples. Consume it so it never leaks into a label.
    const markerStart = start > 0 && text[start - 1] === '!' && !isEscaped(text, start - 1) ? start - 1 : start;
    text = `${text.slice(0, markerStart)}![${alternative}](tg://emoji?id=${entity.custom_emoji_id})${text.slice(start + length)}`;
  }
  return text;
}

function escapeUnescapedMarkdownV2Character(value, character) {
  const text = String(value || '');
  if (!MARKDOWN_V2_RESERVED.has(character)) return text;
  // Never escape reserved characters that belong to a custom-emoji marker
  // (`![fallback](tg://emoji?id=123)`). Escaping any of its `!` `[` `]` `(` `)`
  // would break the marker, so protect the whole span, not just the `!`.
  const ranges = customEmojiMarkerRanges(text);
  let output = '';
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === character && !isEscaped(text, index) && !isInsideCustomEmojiMarker(ranges, index)) output += '\\';
    output += text[index];
  }
  return output;
}

function escapeMarkdownV2Literal(value) {
  return String(value || '').replace(/([_\*\[\]\(\)~`>#+\-=|{}.!])/g, '\\$1');
}

function indexAtUtf8Offset(text, byteOffset) {
  let bytes = 0;
  for (let index = 0; index < text.length;) {
    if (bytes === byteOffset) return index;
    const char = String.fromCodePoint(text.codePointAt(index));
    bytes += Buffer.byteLength(char, 'utf8');
    if (bytes > byteOffset) return -1;
    index += char.length;
  }
  return bytes === byteOffset ? text.length : -1;
}

function escapeUnclosedBoldAtOffset(value, byteOffset) {
  const text = String(value || '');
  const index = indexAtUtf8Offset(text, Number(byteOffset));
  if (index < 0 || text[index] !== '*' || isEscaped(text, index)) return null;
  return `${text.slice(0, index)}\\*${text.slice(index + 1)}`;
}

function repairMarkdownV2EntityError(value, error) {
  const message = String(error && error.message ? error.message : error);
  const match = /Character '(.{1})' is reserved and must be escaped/i.exec(message);
  if (match) return escapeUnescapedMarkdownV2Character(value, match[1]);

  const unclosedBold = /Can't find end of Bold entity at byte offset (\d+)/i.exec(message);
  return unclosedBold ? escapeUnclosedBoldAtOffset(value, unclosedBold[1]) : null;
}

module.exports = {
  escapeUnescapedMarkdownV2Character,
  escapeUnclosedBoldAtOffset,
  escapeMarkdownV2Literal,
  repairMarkdownV2EntityError,
  restoreCustomEmojiMarkers,
  formatCustomEmojisForParseMode,
  restoreIncomingCustomEmojiEntities,
};
