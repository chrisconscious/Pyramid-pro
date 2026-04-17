// src/modules/projects/projects.routes.js

import { Router } from 'express';
import * as controller from './projects.controller.js';
import { authenticate, authorize } from './auth.js';
import { validate, schemas } from './validate.js';

const router = Router();

// Public
router.get('/featured',         controller.featured);
router.get('/categories',       controller.categories);
router.get('/slug/:slug',       controller.getBySlug);
router.get('/:id',              controller.getById);
router.get('/',  validate(schemas.pagination, 'query'), controller.list);

// Protected
router.post('/',
  authenticate, authorize('admin','super_admin','editor'),
  validate(schemas.project),
  controller.create
);
router.put('/:id',
  authenticate, authorize('admin','super_admin','editor'),
  validate(schemas.project),
  controller.update
);
router.delete('/:id',
  authenticate, authorize('admin','super_admin'),
  controller.remove
);

// Project media
router.post('/:id/media',
  authenticate, authorize('admin','super_admin','editor'),
  controller.addMedia
);
router.delete('/:id/media/:mediaId',
  authenticate, authorize('admin','super_admin','editor'),
  controller.removeMedia
);

export default router;
