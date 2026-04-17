// src/modules/pages/pages.controller.js
// CMS core — pages + blocks + content + media (the heart of the dynamic system)

import { query, transaction } from './database.js';
import { getFileUrl } from './upload.js';
import * as res from './response.js';
import { asyncHandler, slugify } from './helpers.js';
import logger from './logger.js';

// ---------------------------------------------------------------------------
//  Internal — fetch full page with blocks → contents → media
// ---------------------------------------------------------------------------
async function buildFullPage(pageId, locale = 'en', isAdmin = false) {
  // Fetch page
  const pageResult = await query(
    `SELECT p.*, m.file_path as og_image_path, m.public_url as og_image_url
     FROM pages p
     LEFT JOIN media m ON m.id = p.og_image_id
     WHERE p.id = $1`,
    [pageId]
  );
  if (!pageResult.rows.length) return null;
  const page = pageResult.rows[0];

  // Fetch blocks
  const blocksResult = await query(
    `SELECT * FROM content_blocks
     WHERE page_id = $1 ${isAdmin ? '' : "AND is_visible = true"}
     ORDER BY sort_order ASC`,
    [pageId]
  );

  const blocks = [];
  for (const block of blocksResult.rows) {
    // Fetch key-value content for this block (in requested locale, fall back to 'en')
    const contentResult = await query(
      `SELECT key, value, value_json
       FROM block_contents
       WHERE block_id = $1 AND locale = $2
       ORDER BY sort_order`,
      [block.id, locale]
    );

    // Fall back to English if no content in requested locale
    let content = contentResult.rows;
    if (!content.length && locale !== 'en') {
      const fallback = await query(
        `SELECT key, value, value_json FROM block_contents
         WHERE block_id = $1 AND locale = 'en' ORDER BY sort_order`,
        [block.id]
      );
      content = fallback.rows;
    }

    // Convert content array to key → value map
    const contentMap = {};
    for (const c of content) {
      contentMap[c.key] = c.value_json ?? c.value;
    }

    // Fetch media attached to this block
    const mediaResult = await query(
      `SELECT bm.role, bm.sort_order,
              m.id, m.file_path, m.mime_type, m.media_type,
              m.width, m.height, m.alt_text, m.caption, m.duration_sec
       FROM block_media bm
       JOIN media m ON m.id = bm.media_id AND m.is_active = true
       WHERE bm.block_id = $1
       ORDER BY bm.sort_order`,
      [block.id]
    );

    const media = mediaResult.rows.map(m => ({
      ...m,
      public_url: getFileUrl(m.file_path),
    }));

    blocks.push({
      ...block,
      content: contentMap,
      media,
    });
  }

  return { ...page, blocks };
}

// ---------------------------------------------------------------------------
//  GET /api/pages/:slug
// ---------------------------------------------------------------------------
export const getBySlug = asyncHandler(async (req, resp) => {
  const { slug } = req.params;
  const locale   = req.query.locale || 'en';
  const isAdmin  = req.user?.role === 'admin' || req.user?.role === 'super_admin';

  const pageResult = await query(
    `SELECT id FROM pages WHERE slug = $1 ${isAdmin ? '' : "AND status = 'published'"}`,
    [slug]
  );

  if (!pageResult.rows.length) return res.notFound(resp, 'Page');

  const page = await buildFullPage(pageResult.rows[0].id, locale, isAdmin);
  return res.success(resp, page);
});

// ---------------------------------------------------------------------------
//  GET /api/pages  (list all pages)
// ---------------------------------------------------------------------------
export const list = asyncHandler(async (req, resp) => {
  const result = await query(
    `SELECT id, title, slug, status, sort_order, created_at, updated_at
     FROM pages
     ORDER BY sort_order ASC, created_at ASC`
  );
  return res.success(resp, result.rows);
});

// ---------------------------------------------------------------------------
//  POST /api/pages  (create page)
// ---------------------------------------------------------------------------
export const create = asyncHandler(async (req, resp) => {
  const { title, slug, description, og_image_id, status, sort_order } = req.body;
  const pageSlug = slug || slugify(title);

  const result = await query(
    `INSERT INTO pages (title, slug, description, og_image_id, status, sort_order, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [title, pageSlug, description, og_image_id, status || 'published', sort_order || 0, req.user.id]
  );

  logger.info('Page created', { pageId: result.rows[0].id, title });
  return res.created(resp, result.rows[0], 'Page created');
});

// ---------------------------------------------------------------------------
//  PUT /api/pages/:id  (update page)
// ---------------------------------------------------------------------------
export const update = asyncHandler(async (req, resp) => {
  const { title, slug, description, og_image_id, status, sort_order } = req.body;

  const result = await query(
    `UPDATE pages SET
       title=$1, slug=$2, description=$3, og_image_id=$4,
       status=$5, sort_order=$6, updated_by=$7, updated_at=NOW()
     WHERE id=$8 RETURNING *`,
    [title, slug, description, og_image_id, status, sort_order, req.user.id, req.params.id]
  );

  if (!result.rows.length) return res.notFound(resp, 'Page');
  return res.success(resp, result.rows[0], 'Page updated');
});

// ---------------------------------------------------------------------------
//  DELETE /api/pages/:id
// ---------------------------------------------------------------------------
export const remove = asyncHandler(async (req, resp) => {
  const result = await query(
    'DELETE FROM pages WHERE id=$1 AND is_system=false RETURNING id',
    [req.params.id]
  );
  if (!result.rows.length) return res.notFound(resp, 'Page');
  return res.success(resp, null, 'Page deleted');
});

// ===========================================================================
//  CONTENT BLOCKS
// ===========================================================================

// ---------------------------------------------------------------------------
//  POST /api/pages/:pageId/blocks  (add block to page)
// ---------------------------------------------------------------------------
export const createBlock = asyncHandler(async (req, resp) => {
  const { block_type, label, sort_order, is_visible, audience, css_class } = req.body;

  const result = await query(
    `INSERT INTO content_blocks (page_id, block_type, label, sort_order, is_visible, audience, css_class, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [req.params.pageId, block_type, label, sort_order || 0, is_visible !== false, audience || 'all', css_class, req.user.id]
  );

  return res.created(resp, result.rows[0], 'Block created');
});

// ---------------------------------------------------------------------------
//  PUT /api/pages/:pageId/blocks/:blockId/content  (upsert key-value content)
// ---------------------------------------------------------------------------
export const upsertBlockContent = asyncHandler(async (req, resp) => {
  const { blockId } = req.params;
  const { locale = 'en', content } = req.body; // content = { key: value, ... }

  if (!content || typeof content !== 'object') {
    return res.badRequest(resp, 'content object required');
  }

  await transaction(async (client) => {
    for (const [key, value] of Object.entries(content)) {
      const isJson = typeof value === 'object' || Array.isArray(value);
      await client.query(
        `INSERT INTO block_contents (block_id, key, value, value_json, locale)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (block_id, key, locale)
         DO UPDATE SET value=$3, value_json=$4, updated_at=NOW()`,
        [blockId, key, isJson ? null : String(value), isJson ? JSON.stringify(value) : null, locale]
      );
    }
  });

  return res.success(resp, null, 'Block content saved');
});

// ---------------------------------------------------------------------------
//  POST /api/pages/:pageId/blocks/:blockId/media  (attach media to block)
// ---------------------------------------------------------------------------
export const attachBlockMedia = asyncHandler(async (req, resp) => {
  const { blockId } = req.params;
  const { media_id, role = 'image', sort_order = 0 } = req.body;

  await query(
    `INSERT INTO block_media (block_id, media_id, role, sort_order)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (block_id, media_id, role) DO UPDATE SET sort_order=$4`,
    [blockId, media_id, role, sort_order]
  );

  return res.created(resp, null, 'Media attached to block');
});

// ---------------------------------------------------------------------------
//  DELETE /api/pages/:pageId/blocks/:blockId/media/:mediaId
// ---------------------------------------------------------------------------
export const detachBlockMedia = asyncHandler(async (req, resp) => {
  const { blockId, mediaId } = req.params;
  await query('DELETE FROM block_media WHERE block_id=$1 AND media_id=$2', [blockId, mediaId]);
  return res.success(resp, null, 'Media detached');
});

// ---------------------------------------------------------------------------
//  PATCH /api/pages/:pageId/blocks/reorder  (drag & drop sort)
// ---------------------------------------------------------------------------
export const reorderBlocks = asyncHandler(async (req, resp) => {
  const { blocks } = req.body; // [{ id, sort_order }, ...]

  await transaction(async (client) => {
    for (const b of blocks) {
      await client.query(
        'UPDATE content_blocks SET sort_order=$1 WHERE id=$2 AND page_id=$3',
        [b.sort_order, b.id, req.params.pageId]
      );
    }
  });

  return res.success(resp, null, 'Blocks reordered');
});
