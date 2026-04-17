// src/modules/pages/pages.routes.js

import { Router } from 'express';
import * as controller from './pages.controller.js';
import { authenticate, authorize, optionalAuth } from './auth.js';

const router = Router();

// Public — get page by slug (with optional auth for admin preview)
router.get('/:slug', optionalAuth, controller.getBySlug);

// Protected — full CRUD
router.get('/',         authenticate, authorize('admin','super_admin','editor'), controller.list);
router.post('/',        authenticate, authorize('admin','super_admin'),          controller.create);
router.put('/:id',      authenticate, authorize('admin','super_admin','editor'), controller.update);
router.delete('/:id',   authenticate, authorize('admin','super_admin'),          controller.remove);

// Block management
router.post('/:pageId/blocks',
  authenticate, authorize('admin','super_admin','editor'),
  controller.createBlock
);
router.put('/:pageId/blocks/:blockId/content',
  authenticate, authorize('admin','super_admin','editor'),
  controller.upsertBlockContent
);
router.patch('/:pageId/blocks/reorder',
  authenticate, authorize('admin','super_admin','editor'),
  controller.reorderBlocks
);
router.post('/:pageId/blocks/:blockId/media',
  authenticate, authorize('admin','super_admin','editor'),
  controller.attachBlockMedia
);
router.delete('/:pageId/blocks/:blockId/media/:mediaId',
  authenticate, authorize('admin','super_admin','editor'),
  controller.detachBlockMedia
);

export default router;
