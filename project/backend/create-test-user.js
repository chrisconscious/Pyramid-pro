import bcrypt from 'bcryptjs';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'pyramid_construction',
  user: process.env.DB_USER || 'postgres',
  password: (process.env.DB_PASSWORD || 'yourpassword').toString(),
});

async function createTestUser() {
  try {
    const email = 'admin@pyramid.co.tz';
    const password = 'password123';
    const hashedPassword = bcrypt.hashSync(password, 10);

    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, is_active) 
       VALUES ($1, $2, $3, $4, $5) 
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
       RETURNING id, email, role`,
      ['Admin User', email, hashedPassword, 'super_admin', true]
    );

    console.log('✅ Test admin user created successfully!');
    console.log('');
    console.log('📧 Email:    admin@pyramid.co.tz');
    console.log('🔐 Password: password123');
    console.log('👤 Role:     super_admin');
    console.log('');
    console.log('Now go to: file:///C:/Users/2024/Desktop/Pyramid%205/Frontend%20files/admin-new.html');
    console.log('And log in with the credentials above!');
    
    await pool.end();
  } catch (err) {
    console.error('❌ Error creating user:', err.message);
    await pool.end();
    process.exit(1);
  }
}

createTestUser();
