// src/modules/settings/settings.routes.js

import { Router } from 'express';
import * as controller from './settings.controller.js';
import { authenticate, authorize, optionalAuth } from './auth.js';

const router = Router();

router.get('/',         optionalAuth, controller.list);
router.get('/:key',     optionalAuth, controller.getByKey);
router.put('/',         authenticate, authorize('admin','super_admin'), controller.bulkUpdate);
router.put('/:key',     authenticate, authorize('admin','super_admin'), controller.updateOne);

export default router;
