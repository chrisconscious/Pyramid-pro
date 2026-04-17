# Pyramid Engineering & Construction LTD
# Complete Full-Stack Platform — Setup Guide

## System Architecture

```
Frontend (HTML/CSS/JS)  →  Backend (Node.js/Express)  →  PostgreSQL Database
http://localhost:8000       http://localhost:5000/api      pyramid_construction DB
```

## Requirements
- Node.js 18+ 
- PostgreSQL 14+
- Python 3 (to serve frontend)

---

## STEP 1 — Database Setup

### 1a. Create the PostgreSQL database
```bash
psql -U postgres
CREATE DATABASE pyramid_construction;
\q
```

### 1b. Run the schema (creates all 22 tables)
```bash
psql -U postgres -d pyramid_construction -f database/schema.sql
```

### 1c. Run seed data (services, settings, testimonials, partners, team)
```bash
psql -U postgres -d pyramid_construction -f database/seed.sql
```

---

## STEP 2 — Backend Setup

### 2a. Install dependencies
```bash
cd backend
npm install
```

### 2b. Configure environment
```bash
cp .env.example .env
```

Open `.env` and set:
- `DB_PASSWORD` — your PostgreSQL password
- `JWT_SECRET` — any long random string (min 32 chars)
- `JWT_REFRESH_SECRET` — different long random string

### 2c. Create admin user (your login for the dashboard)
```bash
node setup-admin.js
```

This creates:
- Email: `christianlema482@gmail.com`
- Password: `Lema16family`

### 2d. Start the backend
```bash
npm run dev
```

Backend runs at: **http://localhost:5000**
Health check: http://localhost:5000/api/health

---

## STEP 3 — Frontend Setup

Open a NEW terminal window:

```bash
cd frontend
python -m http.server 8000
```

Then open: **http://localhost:8000/index.html**

### Admin Dashboard
Open: **http://localhost:8000/admin.html**

Login with:
- Email: `christianlema482@gmail.com`
- Password: `Lema16family`

---

## Complete API Reference

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/login | Login, receive JWT |
| POST | /api/auth/refresh | Refresh access token |
| GET  | /api/auth/me | Get current user |
| POST | /api/auth/change-password | Change password |

### Content (Public)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/services | List all services |
| GET | /api/projects | List projects (paginated) |
| GET | /api/projects/featured | Featured projects |
| GET | /api/projects/categories | Project categories |
| GET | /api/projects/slug/:slug | Project by slug |
| GET | /api/blogs | List blogs (paginated) |
| GET | /api/blogs/featured | Featured blog posts |
| GET | /api/blogs/categories | Blog categories |
| GET | /api/blogs/:slug | Blog post by slug |
| GET | /api/testimonials | Testimonials |
| GET | /api/team | Team members |
| GET | /api/partners | Partners/logos |
| GET | /api/settings | Site settings (public) |
| POST | /api/contact | Submit contact form |
| POST | /api/ai/chat | AI assistant |

### Admin (Requires JWT Bearer token)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/media/upload | Upload single file |
| POST | /api/media/upload-multiple | Upload multiple files |
| GET | /api/media | List all media |
| POST | /api/services | Create service |
| PUT | /api/services/:id | Update service |
| DELETE | /api/services/:id | Archive service |
| POST | /api/projects | Create project |
| PUT | /api/projects/:id | Update project |
| POST | /api/blogs | Create blog post |
| PUT | /api/blogs/:id | Update blog post |
| GET | /api/contact | List contact messages |
| PATCH | /api/contact/:id/status | Update message status |
| PUT | /api/settings | Bulk update settings |
| GET | /api/analytics/dashboard | Dashboard stats |
| GET | /api/users | List users (super_admin) |

---

## Data Flow (How it all connects)

```
Admin adds a blog post in admin.html
         ↓
POST /api/blogs (with JWT token)
         ↓
Backend validates, saves to PostgreSQL blogs table
         ↓
GET /api/blogs (public endpoint)
         ↓
blog.html fetches and renders it automatically
```

The same flow works for: Services, Projects, Testimonials, Partners, Team, Settings.

---

## File Structure

```
project/
│
├── frontend/           ← Serve with python -m http.server 8000
│   ├── index.html      ← Homepage (Hero, Services preview, Projects, Testimonials)
│   ├── services.html   ← All services with API data
│   ├── projects.html   ← Project portfolio with filters
│   ├── project-detail.html ← Single project page
│   ├── blog.html       ← Blog listing
│   ├── about.html      ← Company info
│   ├── contact.html    ← Contact form (submits to API)
│   ├── admin.html      ← Admin dashboard login
│   ├── api.js          ← API client (all fetch calls)
│   ├── main.js         ← UI logic (theme, nav, chat, forms)
│   ├── i18n.js         ← Language switcher (EN/SW/FR)
│   ├── admin.js        ← Admin dashboard logic
│   ├── style.css       ← Website styles
│   └── admin.css       ← Dashboard styles
│
├── backend/            ← Run with: npm run dev
│   ├── server.js       ← HTTP server entry point
│   ├── app.js          ← Express app, all routes registered
│   ├── database.js     ← PostgreSQL connection pool
│   ├── auth.js         ← JWT middleware
│   ├── upload.js       ← Multer file upload config
│   ├── *controller.js  ← Business logic per module
│   ├── *routes.js      ← Route definitions per module
│   ├── helpers.js      ← Utility functions
│   ├── response.js     ← Standardized API responses
│   ├── logger.js       ← Winston logger
│   ├── errorHandler.js ← Global error handling
│   ├── setup-admin.js  ← Creates admin user in DB
│   ├── .env            ← Your environment config
│   └── uploads/        ← Uploaded media files stored here
│
└── database/
    ├── schema.sql      ← All 22 tables (run first)
    └── seed.sql        ← Initial data (run second)
```

---

## Admin Dashboard Features

| Section | What you can do |
|---------|-----------------|
| Dashboard | Stats, charts, recent messages |
| Services | Add/Edit/Delete services, set icons & descriptions |
| Projects | Manage portfolio, upload gallery images |
| Blog | Write & publish posts, manage categories |
| Testimonials | Add/Edit client reviews with star ratings |
| Team | Manage team members and photos |
| Partners | Manage partner logos |
| Media Library | Upload/manage all images and videos |
| Messages | Read & reply to contact form submissions |
| Settings | Change WhatsApp, phone, email, social links |
| Users | Create editor accounts (super_admin only) |

---

## Troubleshooting

**Backend won't start:**
- Check `.env` — is `DB_PASSWORD` correct?
- Is PostgreSQL running? `pg_isready`
- Did you run `npm install`?

**Frontend shows no data:**
- Is backend running? Check http://localhost:5000/api/health
- Is CORS_ORIGIN in `.env` set to include `http://localhost:8000`?
- Open browser console (F12) — look for errors

**Admin login fails:**
- Run `node setup-admin.js` in the backend folder
- Use email: `christianlema482@gmail.com` / password: `Lema16family`
- Make sure the database is running and connected

**File uploads fail:**
- The `uploads/` folder must exist in backend/ (auto-created on start)
- Check `MAX_FILE_SIZE_MB` in `.env`

---

## Production Deployment Notes

1. Set `NODE_ENV=production` in `.env`
2. Change `JWT_SECRET` and `JWT_REFRESH_SECRET` to secure random strings
3. Set `DB_SSL=true` if using a cloud PostgreSQL (e.g. Railway, Supabase)
4. Serve frontend with Nginx or any static file server
5. Use PM2 to keep backend running: `pm2 start server.js`
6. Set `CORS_ORIGIN` to your actual domain
