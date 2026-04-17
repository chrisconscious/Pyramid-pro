// setup-admin.js
// Run this ONCE to create the admin user in your database:
//   node setup-admin.js

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || 'pyramid_construction',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

async function setup() {
  const email    = 'christianlema482@gmail.com';
  const password = 'Lema16family';
  const name     = 'Christian Lema';
  const role     = 'super_admin';

  const hash = await bcrypt.hash(password, 12);

  await pool.query(`
    INSERT INTO users (name, email, password_hash, role, is_active)
    VALUES ($1, $2, $3, $4, true)
    ON CONFLICT (email) DO UPDATE SET
      name          = EXCLUDED.name,
      password_hash = EXCLUDED.password_hash,
      role          = EXCLUDED.role,
      is_active     = true
  `, [name, email, hash, role]);

  const r = await pool.query('SELECT id, name, email, role FROM users WHERE email = $1', [email]);
  console.log('✅ Admin user created/updated:');
  console.log(r.rows[0]);
  console.log('\nLogin with:');
  console.log('  Email:    ' + email);
  console.log('  Password: ' + password);
  await pool.end();
}

setup().catch(err => { console.error('❌ Error:', err.message); process.exit(1); });
