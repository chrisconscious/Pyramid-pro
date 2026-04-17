// src/modules/testimonials/testimonials.controller.js

import { query } from './database.js';
import { getFileUrl } from './upload.js';
import * as res from './response.js';
import { asyncHandler } from './helpers.js';

function enrich(t) {
  return { ...t, avatar_url: t.avatar_path ? getFileUrl(t.avatar_path) : null };
}

// GET /api/testimonials
export const list = asyncHandler(async (req, resp) => {
  const { featured, client_type } = req.query;
  const conditions = ["t.status = 'published'"];
  const params = [];

  if (featured)    { params.push(true);        conditions.push(`t.is_featured = $${params.length}`); }
  if (client_type) { params.push(client_type); conditions.push(`t.client_type = $${params.length}`); }

  const result = await query(
    `SELECT t.*, m.file_path AS avatar_path, p.title AS project_title, p.slug AS project_slug
     FROM testimonials t
     LEFT JOIN media m ON m.id = t.avatar_id
     LEFT JOIN projects p ON p.id = t.project_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY t.sort_order ASC, t.created_at DESC`,
    params
  );

  return res.success(resp, result.rows.map(enrich));
});

// POST /api/testimonials
export const create = asyncHandler(async (req, resp) => {
  const { client_name, client_role, client_type, body, rating, project_id, avatar_id, is_featured, sort_order } = req.body;
  const result = await query(
    `INSERT INTO testimonials
       (client_name, client_role, client_type, body, rating, project_id, avatar_id, is_featured, sort_order, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'published') RETURNING *`,
    [client_name, client_role, client_type, body, rating, project_id, avatar_id, is_featured || false, sort_order || 0]
  );
  return res.created(resp, result.rows[0], 'Testimonial created');
});

// PUT /api/testimonials/:id
export const update = asyncHandler(async (req, resp) => {
  const b = req.body;
  const result = await query(
    `UPDATE testimonials SET client_name=$1, client_role=$2, client_type=$3, body=$4,
     rating=$5, project_id=$6, avatar_id=$7, is_featured=$8, sort_order=$9, status=$10, updated_at=NOW()
     WHERE id=$11 RETURNING *`,
    [b.client_name, b.client_role, b.client_type, b.body, b.rating,
     b.project_id, b.avatar_id, b.is_featured, b.sort_order, b.status || 'published', req.params.id]
  );
  if (!result.rows.length) return res.notFound(resp, 'Testimonial');
  return res.success(resp, result.rows[0], 'Testimonial updated');
});

// DELETE /api/testimonials/:id
export const remove = asyncHandler(async (req, resp) => {
  await query('DELETE FROM testimonials WHERE id=$1', [req.params.id]);
  return res.success(resp, null, 'Testimonial deleted');
});
