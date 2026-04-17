// src/modules/blogs/blogs.controller.js

import { query, paginate, transaction } from './database.js';
import { getFileUrl } from './upload.js';
import * as res from './response.js';
import { asyncHandler, slugify, parsePagination, sanitize } from './helpers.js';
import logger from './logger.js';

async function enrichBlog(blog) {
  const [coverRes, mediaRes, catRes, authorRes] = await Promise.all([
    blog.cover_media_id
      ? query('SELECT id, file_path, alt_text, width, height FROM media WHERE id=$1', [blog.cover_media_id])
      : { rows: [] },
    query(
      `SELECT bm.role, bm.sort_order, m.id, m.file_path, m.mime_type, m.media_type, m.alt_text
       FROM blog_media bm JOIN media m ON m.id = bm.media_id AND m.is_active=true
       WHERE bm.blog_id=$1 ORDER BY bm.sort_order`,
      [blog.id]
    ),
    blog.category_id
      ? query('SELECT id, name, slug FROM blog_categories WHERE id=$1', [blog.category_id])
      : { rows: [] },
    blog.author_id
      ? query('SELECT id, name, avatar_url FROM users WHERE id=$1', [blog.author_id])
      : { rows: [] },
  ]);

  return {
    ...blog,
    cover: coverRes.rows[0] ? { ...coverRes.rows[0], public_url: getFileUrl(coverRes.rows[0].file_path) } : null,
    media: mediaRes.rows.map(m => ({ ...m, public_url: getFileUrl(m.file_path) })),
    category: catRes.rows[0] || null,
    author: authorRes.rows[0] || null,
  };
}

// GET /api/blogs
export const list = asyncHandler(async (req, resp) => {
  const { page, limit } = parsePagination(req.query);
  const { category, featured, search, tags, status } = req.query;

  const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin' || req.user?.role === 'editor';
  const conditions = isAdmin ? [] : ["b.status = 'published'"];
  const params = [];

  if (status && isAdmin)  { params.push(status);    conditions.push(`b.status = $${params.length}`); }
  if (category)           { params.push(category);   conditions.push(`bc.slug = $${params.length}`); }
  if (featured)           { params.push(featured === 'true'); conditions.push(`b.is_featured = $${params.length}`); }
  if (search)             { params.push(`%${search}%`); conditions.push(`(b.title ILIKE $${params.length} OR b.excerpt ILIKE $${params.length})`); }
  if (tags)               { params.push(tags.split(',')); conditions.push(`b.tags && $${params.length}::text[]`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await paginate(
    `SELECT b.id, b.title, b.slug, b.excerpt, b.status, b.is_featured,
            b.published_at, b.read_time_min, b.view_count, b.tags,
            b.cover_media_id, b.category_id, b.author_id, b.created_at,
            m.file_path AS cover_path, bc.name AS category_name, bc.slug AS category_slug,
            u.name AS author_name
     FROM blogs b
     LEFT JOIN media m ON m.id = b.cover_media_id
     LEFT JOIN blog_categories bc ON bc.id = b.category_id
     LEFT JOIN users u ON u.id = b.author_id
     ${where} ORDER BY b.published_at DESC NULLS LAST, b.created_at DESC`,
    `SELECT COUNT(*) FROM blogs b LEFT JOIN blog_categories bc ON bc.id = b.category_id ${where}`,
    params, page, limit
  );

  result.rows = result.rows.map(b => ({ ...b, cover_url: getFileUrl(b.cover_path) }));
  return res.paginated(resp, result);
});

// GET /api/blogs/featured
export const featured = asyncHandler(async (req, resp) => {
  const result = await query(
    `SELECT b.*, m.file_path AS cover_path, bc.name AS category_name, u.name AS author_name
     FROM blogs b
     LEFT JOIN media m ON m.id = b.cover_media_id
     LEFT JOIN blog_categories bc ON bc.id = b.category_id
     LEFT JOIN users u ON u.id = b.author_id
     WHERE b.is_featured=true AND b.status='published'
     ORDER BY b.published_at DESC LIMIT 3`
  );
  return res.success(resp, result.rows.map(b => ({ ...b, cover_url: getFileUrl(b.cover_path) })));
});

// GET /api/blogs/:slug
export const getBySlug = asyncHandler(async (req, resp) => {
  const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';
  const result = await query(
    `SELECT * FROM blogs WHERE slug=$1 ${isAdmin ? '' : "AND status='published'"}`,
    [req.params.slug]
  );
  if (!result.rows.length) return res.notFound(resp, 'Blog');

  // Increment view count asynchronously
  query('UPDATE blogs SET view_count = view_count + 1 WHERE id=$1', [result.rows[0].id]).catch(() => {});

  return res.success(resp, await enrichBlog(result.rows[0]));
});

// POST /api/blogs
export const create = asyncHandler(async (req, resp) => {
  const body = req.body;
  const slug = body.slug || slugify(body.title);
  const cleanBody = sanitize(body.body);

  const result = await query(
    `INSERT INTO blogs
       (title, slug, excerpt, body, category_id, cover_media_id, author_id,
        status, is_featured, tags, meta_description, read_time_min, published_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
    [
      body.title, slug, body.excerpt, cleanBody, body.category_id,
      body.cover_media_id, req.user.id,
      body.status || 'draft', body.is_featured || false,
      body.tags || [], body.meta_description, body.read_time_min,
      body.status === 'published' ? (body.published_at || new Date()) : null,
    ]
  );

  logger.info('Blog created', { blogId: result.rows[0].id, title: body.title });
  return res.created(resp, result.rows[0], 'Blog post created');
});

// PUT /api/blogs/:id
export const update = asyncHandler(async (req, resp) => {
  const body = req.body;
  const cleanBody = body.body ? sanitize(body.body) : undefined;

  const current = await query('SELECT * FROM blogs WHERE id=$1', [req.params.id]);
  if (!current.rows.length) return res.notFound(resp, 'Blog');

  const wasPublished = current.rows[0].status === 'published';
  const isNowPublished = body.status === 'published';

  const result = await query(
    `UPDATE blogs SET
       title=$1, slug=$2, excerpt=$3, body=$4, category_id=$5,
       cover_media_id=$6, status=$7, is_featured=$8, tags=$9,
       meta_description=$10, read_time_min=$11,
       published_at = CASE WHEN $7='published' AND $12::boolean=false THEN NOW() ELSE published_at END,
       updated_at=NOW()
     WHERE id=$13 RETURNING *`,
    [
      body.title, body.slug || current.rows[0].slug,
      body.excerpt, cleanBody || current.rows[0].body,
      body.category_id, body.cover_media_id,
      body.status, body.is_featured, body.tags || [],
      body.meta_description, body.read_time_min,
      wasPublished, req.params.id,
    ]
  );

  return res.success(resp, result.rows[0], 'Blog updated');
});

// DELETE /api/blogs/:id
export const remove = asyncHandler(async (req, resp) => {
  const result = await query(
    "UPDATE blogs SET status='archived' WHERE id=$1 RETURNING id",
    [req.params.id]
  );
  if (!result.rows.length) return res.notFound(resp, 'Blog');
  return res.success(resp, null, 'Blog archived');
});

// POST /api/blogs/:id/media
export const addMedia = asyncHandler(async (req, resp) => {
  const { media_id, role = 'inline', sort_order = 0 } = req.body;
  await query(
    `INSERT INTO blog_media (blog_id, media_id, role, sort_order)
     VALUES ($1,$2,$3,$4) ON CONFLICT (blog_id, media_id, role) DO UPDATE SET sort_order=$4`,
    [req.params.id, media_id, role, sort_order]
  );
  return res.created(resp, null, 'Media added');
});

// DELETE /api/blogs/:id/media/:mediaId
export const removeMedia = asyncHandler(async (req, resp) => {
  await query('DELETE FROM blog_media WHERE blog_id=$1 AND media_id=$2', [req.params.id, req.params.mediaId]);
  return res.success(resp, null, 'Media removed');
});

// GET /api/blogs/categories
export const getCategories = asyncHandler(async (req, resp) => {
  const result = await query('SELECT * FROM blog_categories ORDER BY name');
  return res.success(resp, result.rows);
});

// POST /api/blogs/categories
export const createCategory = asyncHandler(async (req, resp) => {
  const { name } = req.body;
  const slug = slugify(name);
  const result = await query(
    'INSERT INTO blog_categories (name, slug) VALUES ($1,$2) ON CONFLICT (slug) DO NOTHING RETURNING *',
    [name, slug]
  );
  return res.created(resp, result.rows[0], 'Category created');
});

// GET /api/blogs/:slug/related
export const related = asyncHandler(async (req, resp) => {
  const blog = await query("SELECT id, category_id, tags FROM blogs WHERE slug=$1", [req.params.slug]);
  if (!blog.rows.length) return res.notFound(resp, 'Blog');

  const { id, category_id, tags } = blog.rows[0];
  const result = await query(
    `SELECT b.id, b.title, b.slug, b.excerpt, b.published_at, b.read_time_min,
            m.file_path AS cover_path
     FROM blogs b
     LEFT JOIN media m ON m.id = b.cover_media_id
     WHERE b.id != $1 AND b.status='published'
       AND (b.category_id=$2 OR b.tags && $3::text[])
     ORDER BY b.published_at DESC LIMIT 3`,
    [id, category_id, tags || []]
  );
  return res.success(resp, result.rows.map(b => ({ ...b, cover_url: getFileUrl(b.cover_path) })));
});
