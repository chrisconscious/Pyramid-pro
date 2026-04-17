// src/modules/contact/contact.routes.js

import { Router } from 'express';
import * as controller from './contact.controller.js';
import { authenticate, authorize } from './auth.js';
import { validate, schemas } from './validate.js';
import rateLimit from 'express-rate-limit';

// Strict rate limit for contact form — 5 submissions per 15 min per IP
const contactLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      5,
  message: { success: false, message: 'Too many submissions. Please wait before trying again.' },
});

const router = Router();

// Public — submit contact form
router.post('/', contactLimit, validate(schemas.contact), controller.submit);

// Admin — manage contacts
router.get('/stats',    authenticate, authorize('admin','super_admin'), controller.stats);
router.get('/',         authenticate, authorize('admin','super_admin','editor'), controller.list);
router.get('/:id',      authenticate, authorize('admin','super_admin','editor'), controller.getById);
router.patch('/:id/status', authenticate, authorize('admin','super_admin','editor'), controller.updateStatus);

export default router;
