// src/modules/auth/auth.routes.js

import { Router } from 'express';
import * as controller from './auth.controller.js';
import { authenticate } from './auth.js';
import { validate, schemas } from './validate.js';
import Joi from 'joi';
import logger from './logger.js';

const router = Router();

// Add logging middleware to auth routes
router.use((req, res, next) => {
  logger.info('Auth route hit', { method: req.method, url: req.url, path: req.path, originalUrl: req.originalUrl });
  next();
});

router.post('/login',           controller.login);
router.post('/refresh',         controller.refresh);
router.get('/me',               authenticate,               controller.me);
router.post('/change-password', authenticate, validate(Joi.object({
  currentPassword: Joi.string().required(),
  newPassword:     Joi.string().min(8).required(),
})), controller.changePassword);

export default router;
