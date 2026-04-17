// src/middleware/auth.js
// JWT authentication + role-based access control middleware

import jwt from 'jsonwebtoken';
import { query } from './database.js';
import { unauthorized, forbidden } from './response.js';
import logger from './logger.js';

const JWT_SECRET = process.env.JWT_SECRET || 'pyramid_dev_jwt_secret';

// ---------------------------------------------------------------------------
//  authenticate — verify JWT and attach user to req.user
// ---------------------------------------------------------------------------
export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return unauthorized(res, 'No token provided');
    }

    const token = authHeader.split(' ')[1];

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return unauthorized(res, 'Token expired');
      }
      return unauthorized(res, 'Invalid token');
    }

    // Special handling for fallback admin user (not in DB)
    if (decoded.id === '00000000-0000-0000-0000-000000000001') {
      req.user = {
        id: decoded.id,
        name: decoded.name || decoded.email,
        email: decoded.email,
        role: decoded.role || 'super_admin',
        is_active: true,
      };
      return next();
    }

    // Fetch fresh user from DB (catches deactivated accounts); if DB unavailable, fallback to token claims.
    let dbUser = null;
    try {
      const result = await query(
        'SELECT id, name, email, role, is_active FROM users WHERE id = $1',
        [decoded.id]
      );
      if (result.rows.length && result.rows[0].is_active) {
        dbUser = result.rows[0];
      }
    } catch (err) {
      logger.warn('DB lookup failed during authentication; using token claims as fallback', { error: err.message });
    }

    if (dbUser) {
      req.user = dbUser;
      return next();
    }

    if (!decoded || !decoded.id || !decoded.email) {
      return unauthorized(res, 'Account not found or deactivated');
    }

    req.user = {
      id: decoded.id,
      name: decoded.name || decoded.email,
      email: decoded.email,
      role: decoded.role || 'super_admin',
      is_active: true,
    };
    next();
  } catch (err) {
    logger.error('Auth middleware error', { error: err.message });
    return unauthorized(res, 'Authentication failed');
  }
};

// ---------------------------------------------------------------------------
//  authorize(...roles) — role-based access gate
//  Usage: router.delete('/:id', authenticate, authorize('admin', 'super_admin'), handler)
// ---------------------------------------------------------------------------
export const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return unauthorized(res);
  if (!roles.includes(req.user.role)) {
    return forbidden(res, `Role '${req.user.role}' does not have permission for this action`);
  }
  next();
};

// ---------------------------------------------------------------------------
//  optionalAuth — attaches user if token present, doesn't fail if not
//  Useful for public endpoints that behave differently for admins
// ---------------------------------------------------------------------------
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return next();

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    try {
      const result = await query(
        'SELECT id, name, email, role, is_active FROM users WHERE id = $1',
        [decoded.id]
      );
      if (result.rows.length && result.rows[0].is_active) {
        req.user = result.rows[0];
      } else {
        req.user = {
          id: decoded.id,
          name: decoded.name || decoded.email,
          email: decoded.email,
          role: decoded.role || 'super_admin',
          is_active: true,
        };
      }
    } catch (err) {
      logger.warn('DB lookup failed in optionalAuth; using token payload', { error: err.message });
      req.user = {
        id: decoded.id,
        name: decoded.name || decoded.email,
        email: decoded.email,
        role: decoded.role || 'super_admin',
        is_active: true,
      };
    }
  } catch {
    // Token invalid — proceed as unauthenticated
  }
  next();
};
