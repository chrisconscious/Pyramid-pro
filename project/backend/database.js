// database.js
// PostgreSQL connection pool — uses pg library directly (no ORM overhead)

import pg from 'pg';
import logger from './logger.js';

const { Pool } = pg;

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || 'pyramid_construction',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '',
  ssl:      process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  min:      parseInt(process.env.DB_POOL_MIN) || 2,
  max:      parseInt(process.env.DB_POOL_MAX) || 10,
  idleTimeoutMillis:    30000,
  connectionTimeoutMillis: 5000,
});

// Log pool errors
pool.on('error', (err) => {
  logger.error('Unexpected database pool error', { error: err.message });
});

// Test connection on startup (non-blocking)
export async function connectDB() {
  try {
    const client = await pool.connect();
    try {
      await client.query('SELECT NOW()');
      logger.info('✅ PostgreSQL connected successfully');
    } finally {
      client.release();
    }
  } catch (err) {
    logger.warn('⚠️  PostgreSQL connection failed (demo mode enabled)', { error: err.message });
    logger.warn('   Update DB_PASSWORD in .env and restart to enable database features');
  }
}

// ---------------------------------------------------------------------------
//  query() — main query helper with automatic logging & error wrapping
// ---------------------------------------------------------------------------
export async function query(sql, params = []) {
  const start = Date.now();
  try {
    const result = await pool.query(sql, params);
    const duration = Date.now() - start;
    if (duration > 1000) {
      logger.warn('Slow query detected', { sql: sql.substring(0, 100), duration });
    }
    return result;
  } catch (err) {
    logger.error('Database query error', {
      sql:    sql.substring(0, 200),
      params: params,
      error:  err.message,
    });
    throw err;
  }
}

// ---------------------------------------------------------------------------
//  transaction() — run multiple queries in a transaction
//  Usage: await transaction(async (client) => { await client.query(...) })
// ---------------------------------------------------------------------------
export async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
//  paginate() — reusable pagination helper
//  Returns { rows, total, page, limit, totalPages, hasNext, hasPrev }
// ---------------------------------------------------------------------------
export async function paginate(sql, countSql, params = [], page = 1, limit = 12) {
  const offset = (page - 1) * limit;

  const [dataResult, countResult] = await Promise.all([
    pool.query(`${sql} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [
      ...params, limit, offset,
    ]),
    pool.query(countSql, params),
  ]);

  const total = parseInt(countResult.rows[0].count);

  return {
    rows:       dataResult.rows,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    hasNext:    page * limit < total,
    hasPrev:    page > 1,
  };
}

export default pool;
