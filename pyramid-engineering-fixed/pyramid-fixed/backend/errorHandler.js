// errorHandler.js
// Global error handling middleware

import logger from './logger.js';

export const errorHandler = (err, req, res, next) => {
  // Log all errors
  logger.error('Unhandled error', {
    message:  err.message,
    stack:    err.stack,
    method:   req.method,
    path:     req.path,
    body:     req.body,
    userId:   req.user?.id,
  });

  // Postgres unique violation
  if (err.code === '23505') {
    const field = err.detail?.match(/Key \((.+?)\)/)?.[1] || 'field';
    return res.status(409).json({
      success:   false,
      message:   `A record with this ${field} already exists`,
      timestamp: new Date().toISOString(),
    });
  }

  // Postgres FK violation
  if (err.code === '23503') {
    return res.status(400).json({
      success:   false,
      message:   'Referenced record does not exist',
      timestamp: new Date().toISOString(),
    });
  }

  // Postgres not null violation
  if (err.code === '23502') {
    return res.status(400).json({
      success:   false,
      message:   `Required field missing: ${err.column}`,
      timestamp: new Date().toISOString(),
    });
  }

  // Multer file size error
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success:   false,
      message:   `File too large. Maximum size is ${process.env.MAX_FILE_SIZE_MB || 50}MB`,
      timestamp: new Date().toISOString(),
    });
  }

  // Multer unexpected field
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success:   false,
      message:   'Unexpected file field',
      timestamp: new Date().toISOString(),
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success:   false,
      message:   'Invalid token',
      timestamp: new Date().toISOString(),
    });
  }

  // Default 500
  const statusCode = err.statusCode || err.status || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message || 'Internal server error';

  return res.status(statusCode).json({
    success:   false,
    message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    timestamp: new Date().toISOString(),
  });
};

// ---------------------------------------------------------------------------
//  404 handler — for unmatched routes
// ---------------------------------------------------------------------------
export const notFoundHandler = (req, res) => {
  res.status(404).json({
    success:   false,
    message:   `Route ${req.method} ${req.path} not found`,
    timestamp: new Date().toISOString(),
  });
};
