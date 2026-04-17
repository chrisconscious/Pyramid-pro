// server.js
import 'dotenv/config';
import app from './app.js';
import { connectDB } from './database.js';
import logger from './logger.js';
import fs from 'fs';

const PORT = parseInt(process.env.PORT) || 5000;

const uploadDir = process.env.UPLOAD_DIR || 'uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

async function startServer() {
  await connectDB();

  const server = app.listen(PORT, () => {
    logger.info('🚀 Pyramid Construction API running');
    logger.info(`   Port:   ${PORT}`);
    logger.info(`   Env:    ${process.env.NODE_ENV || 'development'}`);
    logger.info(`   API:    http://localhost:${PORT}/api`);
    logger.info(`   Health: http://localhost:${PORT}/api/health`);
  });

  const shutdown = (signal) => {
    logger.info(`${signal} — shutting down gracefully`);
    server.close(async () => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
    setTimeout(() => { logger.error('Forced shutdown'); process.exit(1); }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
  process.on('unhandledRejection', (r) => logger.error('Unhandled Rejection', { reason: String(r) }));
  process.on('uncaughtException',  (e) => { logger.error('Uncaught Exception', { error: e.message }); process.exit(1); });
}

startServer().catch((err) => { logger.error('Failed to start', { error: err.message }); process.exit(1); });
