// src/utils/helpers.js
// Shared utility functions

import slugifyLib from 'slugify';
import xss from 'xss';

// ---------------------------------------------------------------------------
//  Slug generation
// ---------------------------------------------------------------------------
export function slugify(text) {
  return slugifyLib(text, {
    lower: true,
    strict: true,
    remove: /[*+~.()'"!:@]/g,
  });
}

// ---------------------------------------------------------------------------
//  XSS sanitization for user content
// ---------------------------------------------------------------------------
export function sanitize(input) {
  if (typeof input !== 'string') return input;
  return xss(input, {
    whiteList: {
      a: ['href', 'title', 'target'],
      b: [], strong: [], i: [], em: [],
      p: [], br: [], ul: [], ol: [], li: [],
      h1: [], h2: [], h3: [], h4: [], h5: [], h6: [],
      blockquote: [], code: [], pre: [],
      img: ['src', 'alt', 'width', 'height'],
    },
  });
}

// ---------------------------------------------------------------------------
//  Pagination query param parser
// ---------------------------------------------------------------------------
export function parsePagination(query) {
  const page  = Math.max(1, parseInt(query.page)  || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 12));
  return { page, limit };
}

// ---------------------------------------------------------------------------
//  Parse comma-separated filter strings
// ---------------------------------------------------------------------------
export function parseFilter(value) {
  if (!value) return null;
  return value.split(',').map(v => v.trim()).filter(Boolean);
}

// ---------------------------------------------------------------------------
//  Build a public file URL from a relative path
// ---------------------------------------------------------------------------
export function buildFileUrl(filePath) {
  if (!filePath) return null;
  if (filePath.startsWith('http')) return filePath;
  const base = process.env.PUBLIC_URL || 'http://localhost:5000';
  return `${base}/${filePath.replace(/^\//, '')}`;
}

// ---------------------------------------------------------------------------
//  Async wrapper — catches errors and passes to next()
// ---------------------------------------------------------------------------
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// ---------------------------------------------------------------------------
//  Format file size to human-readable
// ---------------------------------------------------------------------------
export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

// ---------------------------------------------------------------------------
//  Extract media type from mime type string
// ---------------------------------------------------------------------------
export function getMediaType(mimeType) {
  if (!mimeType) return 'document';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'document';
}

// ---------------------------------------------------------------------------
//  Strip undefined/null keys from object (for dynamic SQL updates)
// ---------------------------------------------------------------------------
export function cleanObject(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== '')
  );
}

// ---------------------------------------------------------------------------
//  Build dynamic SET clause for UPDATE queries
//  Returns { setClauses: 'col1=$1, col2=$2', values: [...] }
// ---------------------------------------------------------------------------
export function buildSetClause(fields, startIndex = 1) {
  const keys    = Object.keys(fields);
  const values  = Object.values(fields);
  const clauses = keys.map((k, i) => `${k} = $${i + startIndex}`);
  return { setClauses: clauses.join(', '), values };
}
