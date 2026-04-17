// src/modules/products/products.routes.js
// Product API routes

import { Router } from 'express';
import * as controller from './products.controller.js';
import { authenticate, authorize } from './auth.js';

const router = Router();

// Public routes — list and get products
router.get('/', controller.listProducts);
router.get('/:id', controller.getProduct);

// Protected routes — create, update, delete (admin only)
router.post('/',
  authenticate,
  authorize('admin', 'super_admin'),
  controller.createProduct
);

router.put('/:id',
  authenticate,
  authorize('admin', 'super_admin'),
  controller.updateProduct
);

router.delete('/:id',
  authenticate,
  authorize('admin', 'super_admin'),
  controller.deleteProduct
);

// Gallery management
router.post('/:id/gallery',
  authenticate,
  authorize('admin', 'super_admin'),
  controller.addToGallery
);

router.delete('/:id/gallery/:media_id',
  authenticate,
  authorize('admin', 'super_admin'),
  controller.removeFromGallery
);

export default router;
