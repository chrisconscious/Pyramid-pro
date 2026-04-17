// src/modules/services/services.controller.js

import { query } from './database.js';
import { getFileUrl } from './upload.js';
import * as res from './response.js';
import { asyncHandler, slugify } from './helpers.js';
import logger from './logger.js';

async function enrichService(svc) {
  const [iconRes, coverRes] = await Promise.all([
    svc.icon_media_id  ? query('SELECT * FROM media WHERE id=$1', [svc.icon_media_id])  : { rows: [] },
    svc.cover_media_id ? query('SELECT * FROM media WHERE id=$1', [svc.cover_media_id]) : { rows: [] },
  ]);
  return {
    ...svc,
    icon:  iconRes.rows[0]  ? { ...iconRes.rows[0],  public_url: getFileUrl(iconRes.rows[0].file_path)  } : null,
    cover: coverRes.rows[0] ? { ...coverRes.rows[0], public_url: getFileUrl(coverRes.rows[0].file_path) } : null,
  };
}

// GET /api/services
export const list = asyncHandler(async (req, resp) => {
  const { audience, status } = req.query;
  const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';
  const conditions = isAdmin ? [] : ["status = 'published'"];
  const params = [];

  if (audience && audience !== 'all') {
    params.push(audience);
    conditions.push(`audience IN ('all', $${params.length})`);
  }
  if (status && isAdmin) { params.push(status); conditions.push(`status = $${params.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await query(
    `SELECT * FROM services ${where} ORDER BY sort_order ASC, created_at ASC`,
    params
  );
  const rows = await Promise.all(result.rows.map(enrichService));
  return res.success(resp, rows);
});

// GET /api/services/:id
export const getById = asyncHandler(async (req, resp) => {
  const result = await query('SELECT * FROM services WHERE id=$1', [req.params.id]);
  if (!result.rows.length) return res.notFound(resp, 'Service');
  return res.success(resp, await enrichService(result.rows[0]));
});

// GET /api/services/slug/:slug
export const getBySlug = asyncHandler(async (req, resp) => {
  const result = await query("SELECT * FROM services WHERE slug=$1 AND status='published'", [req.params.slug]);
  if (!result.rows.length) return res.notFound(resp, 'Service');
  return res.success(resp, await enrichService(result.rows[0]));
});

// POST /api/services
export const create = asyncHandler(async (req, resp) => {
  const body = req.body;
  const slug = body.slug || slugify(body.title);
  const result = await query(
    `INSERT INTO services
       (title, slug, short_desc, full_desc, audience, icon_media_id, cover_media_id, status, sort_order, features, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [
      body.title, slug, body.short_desc, body.full_desc, body.audience || 'all',
      body.icon_media_id, body.cover_media_id, body.status || 'published',
      body.sort_order || 0, JSON.stringify(body.features || []), req.user.id,
    ]
  );
  logger.info('Service created', { id: result.rows[0].id });
  return res.created(resp, result.rows[0], 'Service created');
});

// PUT /api/services/:id
export const update = asyncHandler(async (req, resp) => {
  const body = req.body;
  const result = await query(
    `UPDATE services SET
       title=$1, slug=$2, short_desc=$3, full_desc=$4, audience=$5,
       icon_media_id=$6, cover_media_id=$7, status=$8, sort_order=$9,
       features=$10, updated_by=$11, updated_at=NOW()
     WHERE id=$12 RETURNING *`,
    [
      body.title, body.slug, body.short_desc, body.full_desc, body.audience,
      body.icon_media_id, body.cover_media_id, body.status, body.sort_order,
      JSON.stringify(body.features || []), req.user.id, req.params.id,
    ]
  );
  if (!result.rows.length) return res.notFound(resp, 'Service');
  return res.success(resp, result.rows[0], 'Service updated');
});

// DELETE /api/services/:id
export const remove = asyncHandler(async (req, resp) => {
  const result = await query(
    "UPDATE services SET status='archived' WHERE id=$1 RETURNING id",
    [req.params.id]
  );
  if (!result.rows.length) return res.notFound(resp, 'Service');
  return res.success(resp, null, 'Service archived');
});

// PATCH /api/services/reorder — bulk sort_order update
export const reorder = asyncHandler(async (req, resp) => {
  const { items } = req.body; // [{ id, sort_order }]
  for (const item of items) {
    await query('UPDATE services SET sort_order=$1 WHERE id=$2', [item.sort_order, item.id]);
  }
  return res.success(resp, null, 'Services reordered');
});
