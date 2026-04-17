// src/modules/translations/translations.routes.js
import { Router } from 'express';
import * as c from './translations.controller.js';
import { authenticate, authorize } from './auth.js';

const router = Router();
router.get('/:entityType/:entityId/all', c.getAll);
router.get('/:entityType/:entityId',     c.get);
router.put('/:entityType/:entityId',     authenticate, authorize('admin','super_admin','editor'), c.upsert);
router.delete('/:entityType/:entityId',  authenticate, authorize('admin','super_admin'), c.remove);
export default router;
