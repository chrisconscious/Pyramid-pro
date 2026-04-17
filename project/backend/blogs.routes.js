// src/modules/blogs/blogs.routes.js

import { Router } from 'express';
import * as controller from './blogs.controller.js';
import { authenticate, authorize, optionalAuth } from './auth.js';
import { validate, schemas } from './validate.js';
import Joi from 'joi';

const router = Router();

// Public
router.get('/featured',              controller.featured);
router.get('/categories',            controller.getCategories);
router.get('/:slug/related',         controller.related);
router.get('/:slug',   optionalAuth, controller.getBySlug);
router.get('/',        optionalAuth, validate(schemas.pagination, 'query'), controller.list);

// Protected — categories
router.post('/categories',
  authenticate, authorize('admin','super_admin','editor'),
  validate(Joi.object({ name: Joi.string().min(2).max(120).required() })),
  controller.createCategory
);

// Protected — blog CRUD
router.post('/',
  authenticate, authorize('admin','super_admin','editor'),
  validate(schemas.blog),
  controller.create
);
router.put('/:id',
  authenticate, authorize('admin','super_admin','editor'),
  validate(schemas.blog),
  controller.update
);
router.delete('/:id',
  authenticate, authorize('admin','super_admin'),
  controller.remove
);

// Blog media
router.post('/:id/media',   authenticate, authorize('admin','super_admin','editor'), controller.addMedia);
router.delete('/:id/media/:mediaId', authenticate, authorize('admin','super_admin','editor'), controller.removeMedia);

export default router;
