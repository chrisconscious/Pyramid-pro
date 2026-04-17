// src/middleware/validate.js
// Joi-based request validation middleware

import Joi from 'joi';
import { validationError } from './response.js';

// ---------------------------------------------------------------------------
//  validate(schema, target) — validates req[target] against Joi schema
//  Usage: router.post('/', validate(mySchema), handler)
// ---------------------------------------------------------------------------
export const validate = (schema, target = 'body') => (req, res, next) => {
  const { error, value } = schema.validate(req[target], {
    abortEarly:   false,
    stripUnknown: true,
    convert:      true,
  });

  if (error) {
    const errors = error.details.map(d => ({
      field:   d.path.join('.'),
      message: d.message.replace(/['"]/g, ''),
    }));
    return validationError(res, errors);
  }

  // Replace with sanitized/cast values
  req[target] = value;
  next();
};

// ---------------------------------------------------------------------------
//  Common Joi schemas (reusable across modules)
// ---------------------------------------------------------------------------
export const schemas = {
  // Pagination
  pagination: Joi.object({
    page:     Joi.number().integer().min(1).default(1),
    limit:    Joi.number().integer().min(1).max(100).default(12),
    sort:     Joi.string().valid('created_at', 'updated_at', 'title', 'sort_order').default('created_at'),
    order:    Joi.string().valid('asc', 'desc').default('desc'),
    locale:   Joi.string().valid('en', 'sw', 'fr').default('en'),
    status:   Joi.string().valid('draft', 'published', 'archived'),
    category: Joi.string().max(100),
    featured: Joi.boolean(),
    search:   Joi.string().max(200),
    audience: Joi.string().valid('individual', 'company', 'government', 'all'),
  }),

  // Auth
  login: Joi.object({
    email:    Joi.string().email().required(),
    password: Joi.string().min(6).required(),
  }),

  // Contact form
  contact: Joi.object({
    name:        Joi.string().min(2).max(255).required(),
    email:       Joi.string().email().required(),
    phone:       Joi.string().max(30).optional().allow('', null),
    subject:     Joi.string().max(500).optional().allow('', null),
    message:     Joi.string().min(10).max(5000).required(),
    audience:    Joi.string().valid('individual', 'company', 'government').optional(),
    service_ref: Joi.string().uuid().optional().allow(null),
    project_ref: Joi.string().max(255).optional().allow('', null),
  }),

  // Blog
  blog: Joi.object({
    title:            Joi.string().min(3).max(500).required(),
    slug:             Joi.string().optional(),
    excerpt:          Joi.string().max(1000).optional().allow('', null),
    body:             Joi.string().min(10).required(),
    category_id:      Joi.string().uuid().optional().allow(null),
    cover_media_id:   Joi.string().uuid().optional().allow(null),
    status:           Joi.string().valid('draft', 'published', 'archived').default('draft'),
    is_featured:      Joi.boolean().default(false),
    tags:             Joi.array().items(Joi.string()).optional(),
    meta_description: Joi.string().max(500).optional().allow('', null),
    read_time_min:    Joi.number().integer().min(1).optional(),
    published_at:     Joi.date().iso().optional().allow(null),
  }),

  // Service
  service: Joi.object({
    title:           Joi.string().min(2).max(255).required(),
    slug:            Joi.string().optional(),
    short_desc:      Joi.string().max(1000).optional().allow('', null),
    full_desc:       Joi.string().optional().allow('', null),
    audience:        Joi.string().valid('individual', 'company', 'government', 'all').default('all'),
    icon_media_id:   Joi.string().uuid().optional().allow(null),
    cover_media_id:  Joi.string().uuid().optional().allow(null),
    status:          Joi.string().valid('draft', 'published', 'archived').default('published'),
    sort_order:      Joi.number().integer().default(0),
    features:        Joi.array().items(Joi.string()).optional(),
  }),

  // Project
  project: Joi.object({
    title:            Joi.string().min(2).max(255).required(),
    slug:             Joi.string().optional(),
    short_desc:       Joi.string().max(1000).optional().allow('', null),
    full_desc:        Joi.string().optional().allow('', null),
    category:         Joi.string().max(100).optional().allow('', null),
    audience:         Joi.string().valid('individual', 'company', 'government', 'all').default('all'),
    location:         Joi.string().max(255).optional().allow('', null),
    client_name:      Joi.string().max(255).optional().allow('', null),
    client_type:      Joi.string().valid('individual', 'company', 'government').optional().allow(null),
    status:           Joi.string().valid('planning', 'in_progress', 'completed', 'on_hold', 'cancelled').default('completed'),
    publish_status:   Joi.string().valid('draft', 'published', 'archived').default('published'),
    is_featured:      Joi.boolean().default(false),
    started_at:       Joi.date().iso().optional().allow(null),
    completed_at:     Joi.date().iso().optional().allow(null),
    duration_months:  Joi.number().integer().optional().allow(null),
    budget_low:       Joi.number().optional().allow(null),
    budget_high:      Joi.number().optional().allow(null),
    area_sqm:         Joi.number().optional().allow(null),
    floors:           Joi.number().integer().optional().allow(null),
    cover_media_id:   Joi.string().uuid().optional().allow(null),
    sort_order:       Joi.number().integer().default(0),
    tags:             Joi.array().items(Joi.string()).optional(),
    meta_description: Joi.string().max(500).optional().allow('', null),
  }),

  // AI chat message
  aiChat: Joi.object({
    message:      Joi.string().min(1).max(2000).required(),
    session_key:  Joi.string().max(255).required(),
    locale:       Joi.string().valid('en', 'sw', 'fr').default('en'),
  }),
};
