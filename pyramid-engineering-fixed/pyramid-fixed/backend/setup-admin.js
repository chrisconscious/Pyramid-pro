// setup-admin.js — Creates admin user in database
// Run: node setup-admin.js

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  host:     process.env.DB_HOST || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'pyramid_construction',
  user:     process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  ssl:      process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function setup() {
  const client = await pool.connect();
  try {
    const email    = process.env.ADMIN_EMAIL    || 'christianlema482@gmail.com';
    const password = process.env.ADMIN_PASSWORD || 'Lema16family';
    const name     = process.env.ADMIN_NAME     || 'Owner Admin';

    const hash = await bcrypt.hash(password, 12);

    // Check if user exists
    const existing = await client.query('SELECT id FROM users WHERE email = $1', [email]);

    if (existing.rows.length) {
      // Update existing
      await client.query(
        'UPDATE users SET password_hash=$1, role=$2, is_active=true, name=$3 WHERE email=$4',
        [hash, 'super_admin', name, email]
      );
      console.log(`✅ Admin updated: ${email}`);
    } else {
      // Insert new
      await client.query(
        `INSERT INTO users (name, email, password_hash, role, is_active)
         VALUES ($1, $2, $3, 'super_admin', true)`,
        [name, email, hash]
      );
      console.log(`✅ Admin created: ${email}`);
    }

    console.log('🎉 Admin setup complete!');
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
  } catch (err) {
    console.error('❌ Setup failed:', err.message);
    console.error('   Make sure the database is running and schema is applied.');
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

setup();
