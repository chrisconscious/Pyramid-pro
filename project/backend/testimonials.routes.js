// src/modules/testimonials/testimonials.routes.js
import { Router } from 'express';
import * as c from './testimonials.controller.js';
import { authenticate, authorize } from './auth.js';

const router = Router();
router.get('/',     c.list);
router.post('/',    authenticate, authorize('admin','super_admin','editor'), c.create);
router.put('/:id',  authenticate, authorize('admin','super_admin','editor'), c.update);
router.delete('/:id', authenticate, authorize('admin','super_admin'), c.remove);
export default router;
