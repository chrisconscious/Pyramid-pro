// src/modules/media/media.routes.js

import { Router } from 'express';
import * as controller from './media.controller.js';
import { authenticate, authorize } from './auth.js';
import { uploadSingle, uploadMultiple } from './upload.js';

const router = Router();

// Public — get single media item
router.get('/:id', controller.getById);

// Protected — upload, list, update, delete
router.get('/',
  authenticate,
  controller.list
);

router.post('/upload',
  authenticate,
  uploadSingle('file'),
  controller.upload
);

router.post('/upload-multiple',
  authenticate,
  uploadMultiple('files', 20),
  controller.uploadMultiple
);

router.put('/:id',
  authenticate,
  controller.update
);

router.delete('/:id',
  authenticate,
  authorize('admin', 'super_admin'),
  controller.remove
);

export default router;
