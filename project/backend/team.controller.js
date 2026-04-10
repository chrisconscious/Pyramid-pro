// src/modules/team/team.controller.js

import { query } from './database.js';
import { getFileUrl } from './upload.js';
import * as res from './response.js';
import { asyncHandler } from './helpers.js';

// GET /api/team
export const list = asyncHandler(async (req, resp) => {
  const result = await query(
    `SELECT t.*, m.file_path AS photo_path
     FROM team_members t
     LEFT JOIN media m ON m.id = t.photo_id
     WHERE t.is_visible = true
     ORDER BY t.sort_order ASC`
  );
  return res.success(resp, result.rows.map(t => ({
    ...t, photo_url: t.photo_path ? getFileUrl(t.photo_path) : null,
  })));
});

// POST /api/team
export const create = asyncHandler(async (req, resp) => {
  const { name, role_title, bio, photo_id, email, linkedin_url, sort_order } = req.body;
  const result = await query(
    `INSERT INTO team_members (name, role_title, bio, photo_id, email, linkedin_url, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [name, role_title, bio, photo_id, email, linkedin_url, sort_order || 0]
  );
  return res.created(resp, result.rows[0], 'Team member created');
});

// PUT /api/team/:id
export const update = asyncHandler(async (req, resp) => {
  const b = req.body;
  const result = await query(
    `UPDATE team_members SET name=$1, role_title=$2, bio=$3, photo_id=$4,
     email=$5, linkedin_url=$6, sort_order=$7, is_visible=$8, updated_at=NOW()
     WHERE id=$9 RETURNING *`,
    [b.name, b.role_title, b.bio, b.photo_id, b.email, b.linkedin_url, b.sort_order, b.is_visible !== false, req.params.id]
  );
  if (!result.rows.length) return res.notFound(resp, 'Team member');
  return res.success(resp, result.rows[0], 'Team member updated');
});

// DELETE /api/team/:id
export const remove = asyncHandler(async (req, resp) => {
  await query("UPDATE team_members SET is_visible=false WHERE id=$1", [req.params.id]);
  return res.success(resp, null, 'Team member hidden');
});
