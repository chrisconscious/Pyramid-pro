# Database Setup

## 1. Create the database
psql -U postgres -c "CREATE DATABASE pyramid_construction;"

## 2. Run schema (creates all tables)
psql -U postgres -d pyramid_construction -f schema.sql

## 3. Run seed data (inserts services, settings, testimonials, etc.)
psql -U postgres -d pyramid_construction -f seed.sql

## 4. Create admin user
cd ../backend
node setup-admin.js
