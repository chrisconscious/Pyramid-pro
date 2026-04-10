// src/modules/team/team.routes.js
import { Router } from 'express';
import * as c from './team.controller.js';
import { authenticate, authorize } from './auth.js';
const router = Router();
router.get('/',      c.list);
router.post('/',     authenticate, authorize('admin','super_admin'), c.create);
router.put('/:id',   authenticate, authorize('admin','super_admin'), c.update);
router.delete('/:id',authenticate, authorize('admin','super_admin'), c.remove);
export default router;
