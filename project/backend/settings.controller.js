// src/modules/settings/settings.controller.js
// Key-value global config — powers everything from WhatsApp number to hero video

import { query } from './database.js';
import { getFileUrl } from './upload.js';
import * as res from './response.js';
import { asyncHandler } from './helpers.js';
import logger from './logger.js';

function formatSetting(s) {
  return {
    key:          s.key,
    value:        s.value,
    value_json:   s.value_json,
    setting_type: s.setting_type,
    group_name:   s.group_name,
    label:        s.label,
    is_public:    s.is_public,
    media_url:    s.media_file_path ? getFileUrl(s.media_file_path) : null,
  };
}

// GET /api/settings  — public returns only is_public=true settings
export const list = asyncHandler(async (req, resp) => {
  const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin' || req.user?.role === 'editor';
  const { group } = req.query;

  const conditions = isAdmin ? [] : ['s.is_public = true'];
  const params = [];

  if (group) { params.push(group); conditions.push(`s.group_name = $${params.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query(
    `SELECT s.*, m.file_path AS media_file_path
     FROM settings s
     LEFT JOIN media m ON m.id = s.media_id
     ${where}
     ORDER BY s.group_name, s.key`,
    params
  );

  // Return as flat key-value map for frontend convenience
  const map = {};
  for (const s of result.rows) {
    map[s.key] = formatSetting(s);
  }

  return res.success(resp, {
    map,   // { whatsapp_number: {...}, hero_video_url: {...} }
    list: result.rows.map(formatSetting),
  });
});

// GET /api/settings/:key  — get single setting
export const getByKey = asyncHandler(async (req, resp) => {
  const result = await query(
    `SELECT s.*, m.file_path AS media_file_path
     FROM settings s LEFT JOIN media m ON m.id = s.media_id
     WHERE s.key = $1`,
    [req.params.key]
  );
  if (!result.rows.length) return res.notFound(resp, 'Setting');
  return res.success(resp, formatSetting(result.rows[0]));
});

// PUT /api/settings  — bulk upsert array of { key, value, ... }
export const bulkUpdate = asyncHandler(async (req, resp) => {
  const { settings } = req.body;
  if (!Array.isArray(settings) || !settings.length) {
    return res.badRequest(resp, 'settings array required');
  }

  for (const s of settings) {
    if (!s.key) continue;
    await query(
      `INSERT INTO settings (key, value, value_json, media_id, setting_type, group_name, label, is_public, updated_by, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
       ON CONFLICT (key) DO UPDATE SET
         value=$2, value_json=$3, media_id=$4, setting_type=$5,
         group_name=$6, label=$7, is_public=$8, updated_by=$9, updated_at=NOW()`,
      [
        s.key, s.value || null, s.value_json ? JSON.stringify(s.value_json) : null,
        s.media_id || null, s.setting_type || 'text',
        s.group_name || 'general', s.label || null,
        s.is_public !== undefined ? s.is_public : false,
        req.user.id,
      ]
    );
  }

  logger.info('Settings updated', { count: settings.length, userId: req.user.id });
  return res.success(resp, null, `${settings.length} setting(s) saved`);
});

// PUT /api/settings/:key  — update single setting
export const updateOne = asyncHandler(async (req, resp) => {
  const { value, value_json, media_id, is_public } = req.body;
  const result = await query(
    `UPDATE settings SET value=$1, value_json=$2, media_id=$3, is_public=$4,
     updated_by=$5, updated_at=NOW()
     WHERE key=$6 RETURNING *`,
    [value, value_json ? JSON.stringify(value_json) : null, media_id, is_public, req.user.id, req.params.key]
  );
  if (!result.rows.length) return res.notFound(resp, 'Setting');
  logger.info('Setting updated', { key: req.params.key, userId: req.user.id });
  return res.success(resp, formatSetting(result.rows[0]), 'Setting updated');
});
