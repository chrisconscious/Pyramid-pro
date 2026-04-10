// src/config/upload.js
// Multer configuration for file uploads

import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { getMediaType } from './helpers.js';

const UPLOAD_DIR   = process.env.UPLOAD_DIR || 'uploads';
const MAX_SIZE_MB  = parseInt(process.env.MAX_FILE_SIZE_MB) || 50;
const MAX_SIZE_B   = MAX_SIZE_MB * 1024 * 1024;

const ALLOWED_TYPES = [
  // Images
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml',
  // Videos
  'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo',
  // Documents
  'application/pdf',
];

// ---------------------------------------------------------------------------
//  Disk storage — organise by type/year-month
// ---------------------------------------------------------------------------
const storage = multer.diskStorage({
  destination(req, file, cb) {
    const mediaType = getMediaType(file.mimetype);
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const dir = path.join(UPLOAD_DIR, mediaType, month);

    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${uuidv4()}${ext}`;
    cb(null, uniqueName);
  },
});

// ---------------------------------------------------------------------------
//  File filter — only allow configured MIME types
// ---------------------------------------------------------------------------
const fileFilter = (req, file, cb) => {
  if (ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE',
      `File type ${file.mimetype} is not allowed. Allowed: ${ALLOWED_TYPES.join(', ')}`
    ));
  }
};

// ---------------------------------------------------------------------------
//  Multer instances
// ---------------------------------------------------------------------------

// Single file upload (e.g. cover image)
export const uploadSingle = (fieldName = 'file') =>
  multer({ storage, fileFilter, limits: { fileSize: MAX_SIZE_B } }).single(fieldName);

// Multiple files (e.g. project gallery)
export const uploadMultiple = (fieldName = 'files', maxCount = 20) =>
  multer({ storage, fileFilter, limits: { fileSize: MAX_SIZE_B } }).array(fieldName, maxCount);

// Multiple named fields (e.g. cover + gallery together)
export const uploadFields = (fields) =>
  multer({ storage, fileFilter, limits: { fileSize: MAX_SIZE_B } }).fields(fields);

// ---------------------------------------------------------------------------
//  Get public URL from disk path
// ---------------------------------------------------------------------------
export function getFileUrl(filePath) {
  if (!filePath) return null;
  const normalized = filePath.replace(/\\/g, '/');
  const base = process.env.PUBLIC_URL || 'http://localhost:5000';
  return `${base}/${normalized}`;
}

export default { uploadSingle, uploadMultiple, uploadFields, getFileUrl };
