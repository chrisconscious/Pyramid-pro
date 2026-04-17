// src/modules/translations/translations.controller.js
// Multi-language support — EN / SW / FR for any entity

import { query } from './database.js';
import * as res from './response.js';
import { asyncHandler } from './helpers.js';

// GET /api/translations/:entityType/:entityId?locale=sw
export const get = asyncHandler(async (req, resp) => {
  const { entityType, entityId } = req.params;
  const { locale = 'en' } = req.query;

  const result = await query(
    `SELECT field, value FROM translations
     WHERE entity_type=$1 AND entity_id=$2 AND locale=$3`,
    [entityType, entityId, locale]
  );

  // Convert to field → value map
  const map = {};
  for (const row of result.rows) map[row.field] = row.value;

  return res.success(resp, { entityType, entityId, locale, translations: map });
});

// PUT /api/translations/:entityType/:entityId
// Body: { locale: 'sw', translations: { title: '...', description: '...' } }
export const upsert = asyncHandler(async (req, resp) => {
  const { entityType, entityId } = req.params;
  const { locale, translations } = req.body;

  if (!locale || !translations) return res.badRequest(resp, 'locale and translations required');

  for (const [field, value] of Object.entries(translations)) {
    await query(
      `INSERT INTO translations (entity_type, entity_id, field, locale, value)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (entity_type, entity_id, field, locale)
       DO UPDATE SET value=$5, updated_at=NOW()`,
      [entityType, entityId, field, locale, value]
    );
  }

  return res.success(resp, null, `Translations saved for locale '${locale}'`);
});

// GET /api/translations/:entityType/:entityId/all — all locales
export const getAll = asyncHandler(async (req, resp) => {
  const { entityType, entityId } = req.params;
  const result = await query(
    'SELECT locale, field, value FROM translations WHERE entity_type=$1 AND entity_id=$2 ORDER BY locale, field',
    [entityType, entityId]
  );

  // Group by locale
  const grouped = {};
  for (const row of result.rows) {
    if (!grouped[row.locale]) grouped[row.locale] = {};
    grouped[row.locale][row.field] = row.value;
  }

  return res.success(resp, { entityType, entityId, locales: grouped });
});

// DELETE /api/translations/:entityType/:entityId?locale=sw
export const remove = asyncHandler(async (req, resp) => {
  const { entityType, entityId } = req.params;
  const { locale } = req.query;

  const params = [entityType, entityId];
  const localeClause = locale ? `AND locale = $3` : '';
  if (locale) params.push(locale);

  await query(
    `DELETE FROM translations WHERE entity_type=$1 AND entity_id=$2 ${localeClause}`,
    params
  );

  return res.success(resp, null, 'Translations removed');
});
