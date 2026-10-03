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
const { Input } = require('telegraf');

const ASSET_DIR = path.resolve(__dirname, '../../assets');

function normalizeMediaReference(value) {
  const reference = String(value || '').trim();
  if (!reference) return null;
  if (reference.startsWith('tgfile:')) {
    const fileId = reference.slice('tgfile:'.length).trim();
    return fileId || null;
  }
  return isHttpUrl(reference) ? reference : null;
}

function mediaInput(value) {
  const reference = String(value || '').trim();
  if (reference.startsWith('asset:')) {
    const filename = reference.slice('asset:'.length).trim();
    const assetPath = path.resolve(ASSET_DIR, filename);
    if (!filename || path.dirname(assetPath) !== ASSET_DIR || !fs.existsSync(assetPath)) return null;
    return Input.fromLocalFile(assetPath);
  }
  return normalizeMediaReference(reference);
}

function isHttpUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function imageMessageReference(message) {
  const photo = message && message.photo;
  const largest = photo && photo[photo.length - 1];
  if (largest && largest.file_id) return `tgfile:${largest.file_id}`;

  const document = message && message.document;
  if (!isImageDocument(document)) return null;
  return `tgfile:${document.file_id}`;
}

function isImageDocument(document) {
  if (!document || !document.file_id) return false;
  const mimeType = String(document.mime_type || '').toLowerCase();
  const filename = String(document.file_name || '').toLowerCase();
  return mimeType === 'image/jpeg' || mimeType === 'image/png' || /\.(?:jpe?g|png)$/.test(filename);
}

module.exports = { normalizeMediaReference, mediaInput, isHttpUrl, imageMessageReference, isImageDocument };
