// src/modules/ai/ai.routes.js
import { Router } from 'express';
import * as c from './ai.controller.js';
import { authenticate, authorize } from './auth.js';
import { validate, schemas } from './validate.js';
import rateLimit from 'express-rate-limit';

const aiLimit = rateLimit({ windowMs: 60000, max: 20, message: { success: false, message: 'Too many requests' } });

const router = Router();
router.post('/chat', aiLimit, validate(schemas.aiChat), c.chat);
router.get('/conversations',     authenticate, authorize('admin','super_admin'), c.listConversations);
router.get('/conversations/:id', authenticate, authorize('admin','super_admin'), c.getConversation);
export default router;
