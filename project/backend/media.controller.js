// src/modules/media/media.controller.js
// Full media management — upload, list, get, delete, with Sharp processing

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { query, transaction } from './database.js';
import { getFileUrl } from './upload.js';
import * as res from './response.js';
import { asyncHandler, getMediaType, parsePagination, buildFileUrl } from './helpers.js';
import logger from './logger.js';
import { v4 as uuidv4 } from 'uuid';

// ---------------------------------------------------------------------------
//  Helper — build full media object with variants & URL
// ---------------------------------------------------------------------------
async function enrichMedia(row) {
  const variants = await query(
    'SELECT * FROM media_variants WHERE media_id = $1 ORDER BY variant_key',
    [row.id]
  );
  return {
    ...row,
    public_url: getFileUrl(row.file_path),
    variants: variants.rows.map(v => ({
      ...v,
      public_url: getFileUrl(v.file_path),
    })),
  };
}

// ---------------------------------------------------------------------------
//  POST /api/media/upload  (single file)
// ---------------------------------------------------------------------------
export const upload = asyncHandler(async (req, resp) => {
  if (!req.file) return res.badRequest(resp, 'No file provided');

  const file = req.file;
  const mediaType = getMediaType(file.mimetype);
  const filePath = file.path.replace(/\\/g, '/');

  // Get image dimensions using Sharp
  let width = null, height = null;
  if (mediaType === 'image') {
    try {
      const metadata = await sharp(file.path).metadata();
      width = metadata.width;
      height = metadata.height;
    } catch {
      // Non-critical — continue without dimensions
    }
  }

  const altText    = req.body.alt_text || null;
  const caption    = req.body.caption  || null;

  // Save metadata to DB
  const result = await query(
    `INSERT INTO media
       (original_name, file_path, mime_type, media_type, size_bytes, width, height, alt_text, caption, uploaded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [
      file.originalname, filePath, file.mimetype, mediaType,
      file.size, width, height, altText, caption, req.user?.id || null,
    ]
  );

  const media = result.rows[0];

  // Generate thumbnail variant for images (async — don't block response)
  if (mediaType === 'image') {
    generateThumbnail(media).catch(err =>
      logger.error('Thumbnail generation failed', { mediaId: media.id, error: err.message })
    );
  }

  logger.info('Media uploaded', {
    mediaId: media.id, filename: file.originalname, size: file.size,
  });

  return res.created(resp, await enrichMedia(media), 'File uploaded successfully');
});

// ---------------------------------------------------------------------------
//  POST /api/media/upload-multiple
// ---------------------------------------------------------------------------
export const uploadMultiple = asyncHandler(async (req, resp) => {
  if (!req.files?.length) return res.badRequest(resp, 'No files provided');

  const inserted = [];

  for (const file of req.files) {
    const mediaType = getMediaType(file.mimetype);
    const filePath  = file.path.replace(/\\/g, '/');
    let width = null, height = null;

    if (mediaType === 'image') {
      try {
        const metadata = await sharp(file.path).metadata();
        width = metadata.width;
        height = metadata.height;
      } catch {}
    }

    const result = await query(
      `INSERT INTO media (original_name, file_path, mime_type, media_type, size_bytes, width, height, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [file.originalname, filePath, file.mimetype, mediaType, file.size, width, height, req.user?.id || null]
    );

    const media = result.rows[0];
    inserted.push(await enrichMedia(media));

    if (mediaType === 'image') {
      generateThumbnail(media).catch(() => {});
    }
  }

  return res.created(resp, inserted, `${inserted.length} files uploaded successfully`);
});

// ---------------------------------------------------------------------------
//  GET /api/media  (paginated list)
// ---------------------------------------------------------------------------
export const list = asyncHandler(async (req, resp) => {
  const { page, limit } = parsePagination(req.query);
  const { type, search } = req.query;

  const conditions = ['m.is_active = true'];
  const params = [];

  if (type) {
    params.push(type);
    conditions.push(`m.media_type = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(m.original_name ILIKE $${params.length} OR m.alt_text ILIKE $${params.length})`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await query(
    `SELECT COUNT(*) FROM media m ${where}`, params
  );

  params.push(limit, (page - 1) * limit);
  const dataResult = await query(
    `SELECT m.*, u.name as uploader_name
     FROM media m
     LEFT JOIN users u ON u.id = m.uploaded_by
     ${where}
     ORDER BY m.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const total = parseInt(countResult.rows[0].count);

  return res.paginated(resp, {
    rows: dataResult.rows.map(r => ({ ...r, public_url: getFileUrl(r.file_path) })),
    total, page, limit,
    totalPages: Math.ceil(total / limit),
    hasNext: page * limit < total,
    hasPrev: page > 1,
  });
});

// ---------------------------------------------------------------------------
//  GET /api/media/:id
// ---------------------------------------------------------------------------
export const getById = asyncHandler(async (req, resp) => {
  const result = await query('SELECT * FROM media WHERE id = $1 AND is_active = true', [req.params.id]);
  if (!result.rows.length) return res.notFound(resp, 'Media');
  return res.success(resp, await enrichMedia(result.rows[0]));
});

// ---------------------------------------------------------------------------
//  PUT /api/media/:id  (update alt_text, caption)
// ---------------------------------------------------------------------------
export const update = asyncHandler(async (req, resp) => {
  const { alt_text, caption } = req.body;
  const result = await query(
    'UPDATE media SET alt_text=$1, caption=$2, updated_at=NOW() WHERE id=$3 AND is_active=true RETURNING *',
    [alt_text, caption, req.params.id]
  );
  if (!result.rows.length) return res.notFound(resp, 'Media');
  return res.success(resp, await enrichMedia(result.rows[0]), 'Media updated');
});

// ---------------------------------------------------------------------------
//  DELETE /api/media/:id  (soft delete + remove file)
// ---------------------------------------------------------------------------
export const remove = asyncHandler(async (req, resp) => {
  const result = await query(
    'UPDATE media SET is_active=false WHERE id=$1 RETURNING file_path',
    [req.params.id]
  );
  if (!result.rows.length) return res.notFound(resp, 'Media');

  // Delete file from disk
  const filePath = result.rows[0].file_path;
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (err) {
    logger.warn('Could not delete file', { filePath, error: err.message });
  }

  logger.info('Media deleted', { mediaId: req.params.id });
  return res.success(resp, null, 'Media deleted');
});

// ---------------------------------------------------------------------------
//  Internal — generate thumbnail variant with Sharp
// ---------------------------------------------------------------------------
async function generateThumbnail(media) {
  const ext = path.extname(media.file_path);
  const thumbPath = media.file_path.replace(ext, `-thumb${ext}`);

  await sharp(media.file_path)
    .resize(400, 300, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 80 })
    .toFile(thumbPath);

  await query(
    `INSERT INTO media_variants (media_id, variant_key, file_path, mime_type, size_bytes)
     VALUES ($1, 'thumbnail', $2, 'image/jpeg', $3)
     ON CONFLICT (media_id, variant_key) DO UPDATE SET file_path=$2, updated_at=NOW()`,
    [media.id, thumbPath, fs.statSync(thumbPath).size]
  );

  // Also generate WebP variant
  const webpPath = media.file_path.replace(ext, '.webp');
  await sharp(media.file_path).webp({ quality: 85 }).toFile(webpPath);
  await query(
    `INSERT INTO media_variants (media_id, variant_key, file_path, mime_type, size_bytes)
     VALUES ($1, 'webp', $2, 'image/webp', $3)
     ON CONFLICT (media_id, variant_key) DO UPDATE SET file_path=$2, updated_at=NOW()`,
    [media.id, webpPath, fs.statSync(webpPath).size]
  );
}
