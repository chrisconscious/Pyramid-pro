// src/modules/services/services.routes.js

import { Router } from 'express';
import * as controller from './services.controller.js';
import { authenticate, authorize, optionalAuth } from './auth.js';
import { validate, schemas } from './validate.js';

const router = Router();

router.get('/slug/:slug',   controller.getBySlug);
router.get('/:id',          controller.getById);
router.get('/',   optionalAuth, controller.list);

router.post('/reorder',
  authenticate, authorize('admin','super_admin','editor'),
  controller.reorder
);
router.post('/',
  authenticate, authorize('admin','super_admin','editor'),
  validate(schemas.service),
  controller.create
);
router.put('/:id',
  authenticate, authorize('admin','super_admin','editor'),
  validate(schemas.service),
  controller.update
);
router.delete('/:id',
  authenticate, authorize('admin','super_admin'),
  controller.remove
);

export default router;
