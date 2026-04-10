// app.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';

import { errorHandler, notFoundHandler } from './errorHandler.js';
import logger from './logger.js';

// Routes
import authRoutes         from './auth.routes.js';
import usersRoutes        from './users.routes.js';
import mediaRoutes        from './media.routes.js';
import productsRoutes     from './products.routes.js';
import pagesRoutes        from './pages.routes.js';
import servicesRoutes     from './services.routes.js';
import projectsRoutes     from './projects.routes.js';
import blogsRoutes        from './blogs.routes.js';
import settingsRoutes     from './settings.routes.js';
import contactRoutes      from './contact.routes.js';
import aiRoutes           from './ai.routes.js';
import testimonialsRoutes from './testimonials.routes.js';
import teamRoutes         from './team.routes.js';
import partnersRoutes     from './partners.routes.js';
import translationsRoutes from './translations.routes.js';
import analyticsRoutes    from './analytics.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Ensure uploads directory exists
import fs from 'fs';
const uploadsDir2 = path.join(process.cwd(), process.env.UPLOAD_DIR || 'uploads');
if (!fs.existsSync(uploadsDir2)) fs.mkdirSync(uploadsDir2, { recursive: true });


// Security
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: false }));

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:8000').split(',').map(o => o.trim());
app.use(cors({
  origin(origin, cb) {
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) return cb(null, true);
    cb(new Error(`CORS: Origin ${origin} not allowed`));
  },
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-Requested-With'],
  credentials: true,
  maxAge: 86400,
}));

app.use(rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
  max:      parseInt(process.env.RATE_LIMIT_MAX)        || 200,
  standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please slow down.' },
  skip: (req) => req.method === 'OPTIONS',
}));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('combined', {
  stream: { write: (msg) => logger.http(msg.trim()) },
  skip: (req) => req.path === '/api/health',
}));

// Add global request logging
app.use((req, res, next) => {
  logger.info('Request received', { method: req.method, url: req.url, path: req.path });
  next();
});

app.set('trust proxy', 1);

// Serve uploaded files
const uploadsDir = path.join(process.cwd(), process.env.UPLOAD_DIR || 'uploads');
app.use('/uploads', express.static(uploadsDir, {
  maxAge: '7d', etag: true, lastModified: true,
  setHeaders(res) {
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    res.setHeader('Access-Control-Allow-Origin', '*');
  },
}));

// Health check
app.get('/api/health', (req, res) => res.json({
  success: true, status: 'healthy',
  service: 'Pyramid Construction API', version: '1.0.0',
  timestamp: new Date().toISOString(), uptime: `${Math.floor(process.uptime())}s`,
}));

// Routes
const API = process.env.API_PREFIX || '/api';

app.use(`${API}/auth`,         authRoutes);
app.use(`${API}/users`,        usersRoutes);
app.use(`${API}/media`,        mediaRoutes);
app.use(`${API}/products`,     productsRoutes);
app.use(`${API}/pages`,        pagesRoutes);
app.use(`${API}/services`,     servicesRoutes);
app.use(`${API}/projects`,     projectsRoutes);
app.use(`${API}/blogs`,        blogsRoutes);
app.use(`${API}/settings`,     settingsRoutes);
app.use(`${API}/contact`,      contactRoutes);
app.use(`${API}/ai`,           aiRoutes);
app.use(`${API}/testimonials`, testimonialsRoutes);
app.use(`${API}/team`,         teamRoutes);
app.use(`${API}/partners`,     partnersRoutes);
app.use(`${API}/translations`, translationsRoutes);
app.use(`${API}/analytics`,    analyticsRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

export default app;
