// src/modules/projects/projects.controller.js

import { query, paginate, transaction } from './database.js';
import { getFileUrl } from './upload.js';
import * as res from './response.js';
import { asyncHandler, slugify, parsePagination } from './helpers.js';
import logger from './logger.js';

// ---------------------------------------------------------------------------
//  Enrich project with cover image and gallery
// ---------------------------------------------------------------------------
async function enrichProject(project) {
  const [coverRes, galleryRes] = await Promise.all([
    project.cover_media_id
      ? query('SELECT * FROM media WHERE id=$1', [project.cover_media_id])
      : { rows: [] },
    query(
      `SELECT pm.role, pm.caption, pm.sort_order,
              m.id, m.file_path, m.mime_type, m.media_type, m.width, m.height, m.alt_text, m.duration_sec
       FROM project_media pm
       JOIN media m ON m.id = pm.media_id AND m.is_active = true
       WHERE pm.project_id = $1
       ORDER BY pm.sort_order`,
      [project.id]
    ),
  ]);

  const cover = coverRes.rows[0]
    ? { ...coverRes.rows[0], public_url: getFileUrl(coverRes.rows[0].file_path) }
    : null;

  const gallery = galleryRes.rows.map(m => ({
    ...m,
    public_url: getFileUrl(m.file_path),
  }));

  return { ...project, cover, gallery };
}

// ---------------------------------------------------------------------------
//  GET /api/projects
// ---------------------------------------------------------------------------
export const list = asyncHandler(async (req, resp) => {
  const { page, limit } = parsePagination(req.query);
  const { category, featured, status, audience, search, sort = 'sort_order', order = 'desc' } = req.query;

  const conditions = ["p.publish_status = 'published'"];
  const params = [];

  if (category) { params.push(category);        conditions.push(`p.category = $${params.length}`); }
  if (featured)  { params.push(featured === 'true'); conditions.push(`p.is_featured = $${params.length}`); }
  if (status)    { params.push(status);           conditions.push(`p.status = $${params.length}`); }
  if (audience && audience !== 'all') { params.push(audience); conditions.push(`p.audience IN ('all', $${params.length})`); }
  if (search)    { params.push(`%${search}%`);    conditions.push(`(p.title ILIKE $${params.length} OR p.location ILIKE $${params.length})`); }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const allowedSorts = { sort_order: 'p.sort_order', created_at: 'p.created_at', title: 'p.title', completed_at: 'p.completed_at' };
  const sortCol = allowedSorts[sort] || 'p.sort_order';
  const sortDir = order === 'asc' ? 'ASC' : 'DESC';

  const result = await paginate(
    `SELECT p.*, m.file_path as cover_path FROM projects p
     LEFT JOIN media m ON m.id = p.cover_media_id
     ${where} ORDER BY ${sortCol} ${sortDir}`,
    `SELECT COUNT(*) FROM projects p ${where}`,
    params, page, limit
  );

  result.rows = result.rows.map(p => ({
    ...p,
    cover_url: getFileUrl(p.cover_path),
  }));

  return res.paginated(resp, result);
});

// ---------------------------------------------------------------------------
//  GET /api/projects/featured
// ---------------------------------------------------------------------------
export const featured = asyncHandler(async (req, resp) => {
  const result = await query(
    `SELECT p.*, m.file_path as cover_path FROM projects p
     LEFT JOIN media m ON m.id = p.cover_media_id
     WHERE p.is_featured = true AND p.publish_status = 'published'
     ORDER BY p.sort_order ASC LIMIT 6`
  );
  const rows = result.rows.map(p => ({ ...p, cover_url: getFileUrl(p.cover_path) }));
  return res.success(resp, rows);
});

// ---------------------------------------------------------------------------
//  GET /api/projects/:id
// ---------------------------------------------------------------------------
export const getById = asyncHandler(async (req, resp) => {
  const result = await query(
    "SELECT * FROM projects WHERE id=$1 AND publish_status='published'",
    [req.params.id]
  );
  if (!result.rows.length) return res.notFound(resp, 'Project');
  return res.success(resp, await enrichProject(result.rows[0]));
});

// ---------------------------------------------------------------------------
//  GET /api/projects/slug/:slug
// ---------------------------------------------------------------------------
export const getBySlug = asyncHandler(async (req, resp) => {
  const result = await query(
    "SELECT * FROM projects WHERE slug=$1 AND publish_status='published'",
    [req.params.slug]
  );
  if (!result.rows.length) return res.notFound(resp, 'Project');
  return res.success(resp, await enrichProject(result.rows[0]));
});

// ---------------------------------------------------------------------------
//  POST /api/projects
// ---------------------------------------------------------------------------
export const create = asyncHandler(async (req, resp) => {
  const body = req.body;
  const slug = body.slug || slugify(body.title);

  const result = await query(
    `INSERT INTO projects
       (title, slug, short_desc, full_desc, category, audience, location,
        client_name, client_type, status, publish_status, is_featured,
        started_at, completed_at, duration_months, budget_low, budget_high,
        area_sqm, floors, cover_media_id, sort_order, tags, meta_description, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
     RETURNING *`,
    [
      body.title, slug, body.short_desc, body.full_desc, body.category, body.audience || 'all',
      body.location, body.client_name, body.client_type, body.status || 'completed',
      body.publish_status || 'published', body.is_featured || false,
      body.started_at, body.completed_at, body.duration_months,
      body.budget_low, body.budget_high, body.area_sqm, body.floors,
      body.cover_media_id, body.sort_order || 0, body.tags || [], body.meta_description, req.user.id,
    ]
  );

  logger.info('Project created', { projectId: result.rows[0].id, title: body.title });
  return res.created(resp, result.rows[0], 'Project created');
});

// ---------------------------------------------------------------------------
//  PUT /api/projects/:id
// ---------------------------------------------------------------------------
export const update = asyncHandler(async (req, resp) => {
  const body = req.body;
  const result = await query(
    `UPDATE projects SET
       title=$1, slug=$2, short_desc=$3, full_desc=$4, category=$5,
       audience=$6, location=$7, client_name=$8, client_type=$9, status=$10,
       publish_status=$11, is_featured=$12, started_at=$13, completed_at=$14,
       duration_months=$15, budget_low=$16, budget_high=$17, area_sqm=$18,
       floors=$19, cover_media_id=$20, sort_order=$21, tags=$22,
       meta_description=$23, updated_by=$24, updated_at=NOW()
     WHERE id=$25 RETURNING *`,
    [
      body.title, body.slug, body.short_desc, body.full_desc, body.category,
      body.audience, body.location, body.client_name, body.client_type, body.status,
      body.publish_status, body.is_featured, body.started_at, body.completed_at,
      body.duration_months, body.budget_low, body.budget_high, body.area_sqm,
      body.floors, body.cover_media_id, body.sort_order, body.tags,
      body.meta_description, req.user.id, req.params.id,
    ]
  );

  if (!result.rows.length) return res.notFound(resp, 'Project');
  return res.success(resp, result.rows[0], 'Project updated');
});

// ---------------------------------------------------------------------------
//  DELETE /api/projects/:id
// ---------------------------------------------------------------------------
export const remove = asyncHandler(async (req, resp) => {
  const result = await query(
    "UPDATE projects SET publish_status='archived' WHERE id=$1 RETURNING id",
    [req.params.id]
  );
  if (!result.rows.length) return res.notFound(resp, 'Project');
  return res.success(resp, null, 'Project archived');
});

// ---------------------------------------------------------------------------
//  POST /api/projects/:id/media  (attach media)
// ---------------------------------------------------------------------------
export const addMedia = asyncHandler(async (req, resp) => {
  const { media_id, role = 'gallery', caption, sort_order = 0 } = req.body;
  await query(
    `INSERT INTO project_media (project_id, media_id, role, caption, sort_order)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (project_id, media_id, role) DO UPDATE SET sort_order=$5, caption=$4`,
    [req.params.id, media_id, role, caption, sort_order]
  );
  return res.created(resp, null, 'Media added to project');
});

// ---------------------------------------------------------------------------
//  DELETE /api/projects/:id/media/:mediaId
// ---------------------------------------------------------------------------
export const removeMedia = asyncHandler(async (req, resp) => {
  await query(
    'DELETE FROM project_media WHERE project_id=$1 AND media_id=$2',
    [req.params.id, req.params.mediaId]
  );
  return res.success(resp, null, 'Media removed from project');
});

// ---------------------------------------------------------------------------
//  GET /api/projects/categories  (distinct list for frontend filters)
// ---------------------------------------------------------------------------
export const categories = asyncHandler(async (req, resp) => {
  const result = await query(
    "SELECT DISTINCT category FROM projects WHERE category IS NOT NULL AND publish_status='published' ORDER BY category"
  );
  return res.success(resp, result.rows.map(r => r.category));
});
