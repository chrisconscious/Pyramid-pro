// src/modules/analytics/analytics.controller.js
// Dashboard analytics — contacts, blogs, projects, site-wide stats

import { query } from './database.js';
import * as res from './response.js';
import { asyncHandler } from './helpers.js';

// GET /api/analytics/dashboard — main admin dashboard data
export const dashboard = asyncHandler(async (req, resp) => {
  try {
    const [contacts, projects, blogs, media, conversations] = await Promise.all([
      query(`SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status='new') AS new_count,
        COUNT(*) FILTER (WHERE created_at >= NOW()-INTERVAL '30 days') AS last_30_days
        FROM contacts`),
      query(`SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE is_featured=true) AS featured,
        COUNT(*) FILTER (WHERE created_at >= NOW()-INTERVAL '30 days') AS last_30_days
        FROM projects WHERE publish_status='published'`),
      query(`SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status='published') AS published,
        COUNT(*) FILTER (WHERE status='draft') AS drafts,
        SUM(view_count) AS total_views
        FROM blogs`),
      query(`SELECT COUNT(*) AS total, SUM(size_bytes) AS total_size FROM media WHERE is_active=true`),
      query(`SELECT COUNT(*) AS total FROM ai_conversations`),
    ]);

    return res.success(resp, {
      contacts:      contacts.rows[0],
      projects:      projects.rows[0],
      blogs:         blogs.rows[0],
      media:         media.rows[0],
      ai_conversations: conversations.rows[0],
    });
  } catch (err) {
    logger.warn('Analytics dashboard DB query failed; using fallback empty analytics data', { error: err.message });
    return res.success(resp, {
      contacts: { total: 0, new_count: 0, last_30_days: 0 },
      projects: { total: 0, featured: 0, last_30_days: 0 },
      blogs: { total: 0, published: 0, drafts: 0, total_views: 0 },
      media: { total: 0, total_size: 0 },
      ai_conversations: { total: 0 },
    });
  }
});

// GET /api/analytics/contacts/trend — last 12 weeks
export const contactTrend = asyncHandler(async (req, resp) => {
  try {
    const result = await query(`
      SELECT
        DATE_TRUNC('week', created_at) AS week,
        COUNT(*) AS count
      FROM contacts
      WHERE created_at >= NOW() - INTERVAL '12 weeks'
      GROUP BY week ORDER BY week ASC
    `);
    return res.success(resp, result.rows);
  } catch (err) {
    logger.warn('Analytics contacts trend DB query failed; returning empty trend', { error: err.message });
    return res.success(resp, []);
  }
});

// GET /api/analytics/blogs/popular — top 10 by views
export const popularBlogs = asyncHandler(async (req, resp) => {
  try {
    const result = await query(
      `SELECT id, title, slug, view_count, published_at
       FROM blogs WHERE status='published'
       ORDER BY view_count DESC LIMIT 10`
    );
    return res.success(resp, result.rows);
  } catch (err) {
    logger.warn('Analytics popular blogs DB query failed; returning empty list', { error: err.message });
    return res.success(resp, []);
  }
});

// GET /api/analytics/projects/by-category
export const projectsByCategory = asyncHandler(async (req, resp) => {
  try {
    const result = await query(
      `SELECT category, COUNT(*) AS count
       FROM projects WHERE publish_status='published' AND category IS NOT NULL
       GROUP BY category ORDER BY count DESC`
    );
    return res.success(resp, result.rows);
  } catch (err) {
    logger.warn('Analytics projects by category DB query failed; returning empty data', { error: err.message });
    return res.success(resp, []);
  }
});
