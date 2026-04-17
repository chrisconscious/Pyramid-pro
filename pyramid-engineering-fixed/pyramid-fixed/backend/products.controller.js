// src/modules/products/products.controller.js
// Product management with media integration
// Example endpoint for demonstrating database + file upload workflow

import { query, transaction, paginate } from './database.js';
import { getFileUrl } from './upload.js';
import * as res from './response.js';
import { asyncHandler, slugify, sanitize, buildSetClause, parsePagination } from './helpers.js';
import logger from './logger.js';

// ---------------------------------------------------------------------------
//  Helper — enrich product with media details
// ---------------------------------------------------------------------------
async function enrichProduct(product) {
  if (!product.image_media_id && !product.gallery_ids) return product;

  const [imageRes, galleryRes] = await Promise.all([
    product.image_media_id 
      ? query('SELECT * FROM media WHERE id=$1 AND is_active=true', [product.image_media_id])
      : { rows: [] },
    product.gallery_ids && product.gallery_ids.length
      ? query(`SELECT * FROM media WHERE id = ANY($1) AND is_active=true ORDER BY created_at DESC`, 
          [product.gallery_ids])
      : { rows: [] },
  ]);

  return {
    ...product,
    image: imageRes.rows[0] 
      ? { ...imageRes.rows[0], public_url: getFileUrl(imageRes.rows[0].file_path) }
      : null,
    gallery: galleryRes.rows.map(m => ({
      ...m,
      public_url: getFileUrl(m.file_path),
    })),
  };
}

// ---------------------------------------------------------------------------
//  GET /api/products  — List all products with pagination
// ---------------------------------------------------------------------------
export const listProducts = asyncHandler(async (req, resp) => {
  const { page, limit } = parsePagination(req.query);
  const { category, inStock } = req.query;
  
  const conditions = [];
  const params = [];

  if (category) {
    params.push(category);
    conditions.push(`category = $${params.length}`);
  }

  if (inStock === 'true') {
    conditions.push(`stock_quantity > 0`);
  } else if (inStock === 'false') {
    conditions.push(`stock_quantity <= 0`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  
  const result = await paginate(
    `SELECT * FROM products ${where} ORDER BY created_at DESC`,
    `SELECT COUNT(*) as count FROM products ${where}`,
    params,
    page,
    limit
  );

  result.rows = await Promise.all(result.rows.map(enrichProduct));

  logger.info('Products listed', { page, limit, total: result.total });
  return res.success(resp, result);
});

// ---------------------------------------------------------------------------
//  GET /api/products/:id  — Get product by ID
// ---------------------------------------------------------------------------
export const getProduct = asyncHandler(async (req, resp) => {
  const result = await query(
    'SELECT * FROM products WHERE id=$1',
    [req.params.id]
  );

  if (!result.rows.length) {
    return res.notFound(resp, 'Product');
  }

  const product = await enrichProduct(result.rows[0]);
  logger.info('Product retrieved', { id: req.params.id });
  return res.success(resp, product);
});

// ---------------------------------------------------------------------------
//  POST /api/products  — Create new product
// ---------------------------------------------------------------------------
export const createProduct = asyncHandler(async (req, resp) => {
  const { name, description, category, price, stock_quantity, image_media_id, sku } = req.body;

  // Validation
  if (!name) return res.badRequest(resp, 'Product name is required');
  if (!category) return res.badRequest(resp, 'Category is required');
  if (price === undefined || price === null) return res.badRequest(resp, 'Price is required');

  const slug = slugify(name);
  const sanitized = sanitize(description || '');

  const result = await query(
    `INSERT INTO products (name, slug, description, category, price, stock_quantity, image_media_id, sku, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [name, slug, sanitized, category, price, stock_quantity || 0, image_media_id || null, sku || null, req.user?.id || null]
  );

  const product = await enrichProduct(result.rows[0]);
  logger.info('Product created', { id: product.id, name });
  return res.created(resp, product, 'Product created successfully');
});

// ---------------------------------------------------------------------------
//  PUT /api/products/:id  — Update product
// ---------------------------------------------------------------------------
export const updateProduct = asyncHandler(async (req, resp) => {
  const { name, description, category, price, stock_quantity, image_media_id, sku } = req.body;

  // Verify product exists
  const existing = await query('SELECT * FROM products WHERE id=$1', [req.params.id]);
  if (!existing.rows.length) {
    return res.notFound(resp, 'Product');
  }

  const updates = {};
  if (name) {
    updates.name = name;
    updates.slug = slugify(name);
  }
  if (description !== undefined) {
    updates.description = sanitize(description);
  }
  if (category) updates.category = category;
  if (price !== undefined) updates.price = price;
  if (stock_quantity !== undefined) updates.stock_quantity = stock_quantity;
  if (image_media_id) updates.image_media_id = image_media_id;
  if (sku) updates.sku = sku;

  updates.updated_by = req.user?.id || null;

  const { setClauses, values } = buildSetClause(updates);
  values.push(req.params.id);

  const result = await query(
    `UPDATE products SET ${setClauses} WHERE id=$${values.length} RETURNING *`,
    values
  );

  const product = await enrichProduct(result.rows[0]);
  logger.info('Product updated', { id: req.params.id });
  return res.success(resp, product, 'Product updated successfully');
});

// ---------------------------------------------------------------------------
//  DELETE /api/products/:id  — Delete product
// ---------------------------------------------------------------------------
export const deleteProduct = asyncHandler(async (req, resp) => {
  const result = await query(
    'DELETE FROM products WHERE id=$1 RETURNING id',
    [req.params.id]
  );

  if (!result.rows.length) {
    return res.notFound(resp, 'Product');
  }

  logger.info('Product deleted', { id: req.params.id });
  return res.success(resp, null, 'Product deleted successfully');
});

// ---------------------------------------------------------------------------
//  POST /api/products/:id/gallery  — Add media to product gallery
// ---------------------------------------------------------------------------
export const addToGallery = asyncHandler(async (req, resp) => {
  const { media_id } = req.body;

  if (!media_id) {
    return res.badRequest(resp, 'media_id is required');
  }

  // Verify product and media exist
  const [productRes, mediaRes] = await Promise.all([
    query('SELECT * FROM products WHERE id=$1', [req.params.id]),
    query('SELECT * FROM media WHERE id=$1', [media_id]),
  ]);

  if (!productRes.rows.length) {
    return res.notFound(resp, 'Product');
  }
  if (!mediaRes.rows.length) {
    return res.notFound(resp, 'Media');
  }

  const product = productRes.rows[0];
  const current = product.gallery_ids || [];

  // Prevent duplicates
  if (current.includes(media_id)) {
    return res.badRequest(resp, 'Media already in gallery');
  }

  // Add to gallery
  const updated = await query(
    `UPDATE products SET gallery_ids = array_append(gallery_ids, $1) WHERE id=$2 RETURNING *`,
    [media_id, req.params.id]
  );

  const enriched = await enrichProduct(updated.rows[0]);
  logger.info('Media added to product gallery', { productId: req.params.id, mediaId: media_id });
  return res.success(resp, enriched, 'Media added to gallery');
});

// ---------------------------------------------------------------------------
//  DELETE /api/products/:id/gallery/:media_id  — Remove from gallery
// ---------------------------------------------------------------------------
export const removeFromGallery = asyncHandler(async (req, resp) => {
  const { id, media_id } = req.params;

  const updated = await query(
    `UPDATE products SET gallery_ids = array_remove(gallery_ids, $1) WHERE id=$2 RETURNING *`,
    [media_id, id]
  );

  if (!updated.rows.length) {
    return res.notFound(resp, 'Product');
  }

  const enriched = await enrichProduct(updated.rows[0]);
  logger.info('Media removed from gallery', { productId: id, mediaId: media_id });
  return res.success(resp, enriched, 'Media removed from gallery');
});
