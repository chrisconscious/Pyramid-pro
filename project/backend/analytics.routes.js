// src/modules/analytics/analytics.routes.js
import { Router } from 'express';
import * as c from './analytics.controller.js';
import { authenticate, authorize } from './auth.js';

const router = Router();
const admin = [authenticate, authorize('admin','super_admin')];
router.get('/dashboard',              ...admin, c.dashboard);
router.get('/contacts/trend',         ...admin, c.contactTrend);
router.get('/blogs/popular',          ...admin, c.popularBlogs);
router.get('/projects/by-category',   ...admin, c.projectsByCategory);
export default router;
