// src/modules/partners/partners.controller.js
import { query } from './database.js';
import { getFileUrl } from './upload.js';
import * as res from './response.js';
import { asyncHandler } from './helpers.js';

export const list = asyncHandler(async (req, resp) => {
  const result = await query(
    `SELECT p.*, m.file_path AS logo_path FROM partners p
     LEFT JOIN media m ON m.id = p.logo_id
     WHERE p.is_visible = true ORDER BY p.sort_order ASC`
  );
  return res.success(resp, result.rows.map(p => ({
    ...p, logo_url: p.logo_path ? getFileUrl(p.logo_path) : null,
  })));
});

export const create = asyncHandler(async (req, resp) => {
  const { name, logo_id, website_url, sort_order } = req.body;
  const result = await query(
    'INSERT INTO partners (name, logo_id, website_url, sort_order) VALUES ($1,$2,$3,$4) RETURNING *',
    [name, logo_id, website_url, sort_order || 0]
  );
  return res.created(resp, result.rows[0], 'Partner created');
});

export const update = asyncHandler(async (req, resp) => {
  const b = req.body;
  const result = await query(
    'UPDATE partners SET name=$1, logo_id=$2, website_url=$3, sort_order=$4, is_visible=$5 WHERE id=$6 RETURNING *',
    [b.name, b.logo_id, b.website_url, b.sort_order, b.is_visible !== false, req.params.id]
  );
  if (!result.rows.length) return res.notFound(resp, 'Partner');
  return res.success(resp, result.rows[0], 'Partner updated');
});

export const remove = asyncHandler(async (req, resp) => {
  await query('DELETE FROM partners WHERE id=$1', [req.params.id]);
  return res.success(resp, null, 'Partner deleted');
});
