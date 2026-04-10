// src/modules/users/users.controller.js

import bcrypt from 'bcryptjs';
import { query, paginate } from './database.js';
import * as res from './response.js';
import { asyncHandler, parsePagination } from './helpers.js';
import logger from './logger.js';

export const list = asyncHandler(async (req, resp) => {
  const { page, limit } = parsePagination(req.query);
  const result = await paginate(
    'SELECT id, name, email, role, is_active, last_login_at, created_at FROM users ORDER BY created_at DESC',
    'SELECT COUNT(*) FROM users',
    [], page, limit
  );
  return res.paginated(resp, result);
});

export const getById = asyncHandler(async (req, resp) => {
  const result = await query(
    'SELECT id, name, email, role, is_active, last_login_at, created_at FROM users WHERE id=$1',
    [req.params.id]
  );
  if (!result.rows.length) return res.notFound(resp, 'User');
  return res.success(resp, result.rows[0]);
});

export const create = asyncHandler(async (req, resp) => {
  const { name, email, password, role } = req.body;
  const exists = await query('SELECT id FROM users WHERE email=$1', [email.toLowerCase()]);
  if (exists.rows.length) return res.badRequest(resp, 'Email already in use');
  const hash = await bcrypt.hash(password, 12);
  const result = await query(
    'INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING id, name, email, role, created_at',
    [name, email.toLowerCase(), hash, role || 'editor']
  );
  logger.info('User created', { userId: result.rows[0].id });
  return res.created(resp, result.rows[0], 'User created');
});

export const update = asyncHandler(async (req, resp) => {
  const { name, email, role, is_active } = req.body;
  if (req.user.id === req.params.id && role && role !== req.user.role) {
    return res.forbidden(resp, 'Cannot change your own role');
  }
  const result = await query(
    'UPDATE users SET name=$1, email=$2, role=$3, is_active=$4, updated_at=NOW() WHERE id=$5 RETURNING id, name, email, role, is_active',
    [name, email?.toLowerCase(), role, is_active !== false, req.params.id]
  );
  if (!result.rows.length) return res.notFound(resp, 'User');
  return res.success(resp, result.rows[0], 'User updated');
});

export const remove = asyncHandler(async (req, resp) => {
  if (req.user.id === req.params.id) return res.badRequest(resp, 'Cannot delete your own account');
  await query('UPDATE users SET is_active=false WHERE id=$1', [req.params.id]);
  return res.success(resp, null, 'User deactivated');
});

export const resetPassword = asyncHandler(async (req, resp) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) return res.badRequest(resp, 'Password must be at least 8 characters');
  const hash = await bcrypt.hash(newPassword, 12);
  await query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, req.params.id]);
  return res.success(resp, null, 'Password reset successfully');
});
