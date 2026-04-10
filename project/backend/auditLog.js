// src/middleware/auditLog.js
// Automatically log admin write operations to audit_logs table

import { query } from './database.js';
import logger from './logger.js';

export const auditLog = (action, entityType) => async (req, res, next) => {
  // Store original json method
  const originalJson = res.json.bind(res);

  res.json = function(body) {
    // Only log successful write operations
    if (body?.success && req.user) {
      const entityId = body?.data?.id || req.params?.id || null;
      query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          req.user.id,
          action,
          entityType,
          entityId,
          JSON.stringify(body?.data || {}),
          req.ip,
          req.get('user-agent'),
        ]
      ).catch(err => logger.error('Audit log error', { error: err.message }));
    }
    return originalJson(body);
  };

  next();
};
