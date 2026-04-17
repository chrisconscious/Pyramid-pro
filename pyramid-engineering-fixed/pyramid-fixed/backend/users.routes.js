// src/modules/users/users.routes.js
import { Router } from 'express';
import * as c from './users.controller.js';
import { authenticate, authorize } from './auth.js';
import { validate } from './validate.js';
import Joi from 'joi';

const router = Router();
const adminOnly = [authenticate, authorize('super_admin')];

const createSchema = Joi.object({
  name:     Joi.string().min(2).max(120).required(),
  email:    Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  role:     Joi.string().valid('admin','editor','viewer').default('editor'),
});

router.get('/',    ...adminOnly, c.list);
router.get('/:id', ...adminOnly, c.getById);
router.post('/',   ...adminOnly, validate(createSchema), c.create);
router.put('/:id', ...adminOnly, c.update);
router.delete('/:id', ...adminOnly, c.remove);
router.post('/:id/reset-password', ...adminOnly, c.resetPassword);

export default router;
