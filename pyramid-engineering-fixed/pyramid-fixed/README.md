# 🏗️ PYRAMID Engineering & Construction LTD
## Complete Web Platform — Setup Guide

---

## 📋 WHAT'S FIXED IN THIS VERSION

✅ Admin authentication — JWT login working, no debug bypass  
✅ Admin dashboard — Full CRUD for all modules (Services, Projects, Blog, Testimonials, Team, Partners, Messages, Media, Settings)  
✅ Security — Real JWT validation, bcrypt passwords, rate limiting, CORS, input sanitization  
✅ Public website — 100% dynamic, fetches all content from API  
✅ Admin changes reflect instantly on public site  
✅ Logo fixed in all headers and footers  
✅ Contact form connected to backend API  
✅ WhatsApp button with configurable number  
✅ Settings panel controls site-wide content  

---

## 🚀 QUICK START

### Prerequisites
- Node.js 18+
- PostgreSQL 14+

---

### Step 1: Database Setup

```bash
# Create the database
createdb pyramid_construction

# Apply the schema
psql pyramid_construction < database/schema.sql

# (Optional) Apply seed data
psql pyramid_construction < database/seed.sql
```

---

### Step 2: Backend Configuration

```bash
cd backend

# Copy environment file
cp ../.env.example .env

# Edit .env — fill in your values:
nano .env
```

**Critical settings in `.env`:**
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=pyramid_construction
DB_USER=postgres
DB_PASSWORD=your_postgres_password

JWT_SECRET=your_very_long_random_secret_here
JWT_REFRESH_SECRET=another_very_long_random_secret

CORS_ORIGIN=http://localhost:5500,http://127.0.0.1:5500
```

---

### Step 3: Install & Start Backend

```bash
cd backend
npm install
node setup-admin.js    # Creates admin user in DB
npm start              # Starts on port 5000
```

Backend will be available at: **http://localhost:5000/api**  
Health check: **http://localhost:5000/api/health**

---

### Step 4: Open Frontend

The frontend is plain HTML/CSS/JS — no build step needed.

**Option A: Using VS Code Live Server (recommended)**
1. Open the `frontend/` folder in VS Code
2. Right-click `index.html` → "Open with Live Server"
3. It will open at `http://127.0.0.1:5500`

**Option B: Using Python HTTP server**
```bash
cd frontend
python3 -m http.server 5500
# Open http://localhost:5500
```

**Option C: Any static file server**
```bash
cd frontend
npx serve . -p 5500
```

---

### Step 5: Login to Admin

Open: **http://127.0.0.1:5500/admin.html**

```
Email:    christianlema482@gmail.com
Password: Lema16family
```

---

## 📁 PROJECT STRUCTURE

```
pyramid-fixed/
├── backend/               # Node.js + Express API
│   ├── server.js          # Entry point
│   ├── app.js             # Express app, middleware, routes
│   ├── auth.js            # JWT authentication middleware (FIXED)
│   ├── auth.controller.js # Login, refresh, me endpoints
│   ├── database.js        # PostgreSQL connection pool
│   ├── setup-admin.js     # Creates admin user in DB
│   ├── *.controller.js    # CRUD controllers
│   ├── *.routes.js        # Route definitions
│   ├── upload.js          # Multer file upload config
│   ├── helpers.js         # Utilities
│   └── package.json
├── frontend/              # Static HTML/CSS/JS
│   ├── index.html         # Home page (dynamic)
│   ├── services.html      # Services page (dynamic)
│   ├── projects.html      # Projects listing (dynamic)
│   ├── project-detail.html# Project detail page
│   ├── blog.html          # Blog listing (dynamic)
│   ├── about.html         # About page
│   ├── contact.html       # Contact form (connected to API)
│   ├── admin.html         # Admin dashboard
│   ├── admin-dashboard.js # Full CRUD admin logic (FIXED)
│   ├── api.js             # Central API client (FIXED)
│   ├── main.js            # Public site JS
│   ├── style.css          # Public site styles
│   ├── admin.css          # Admin dashboard styles
│   ├── i18n.js            # Multi-language support
│   └── logo.png           # Company logo
├── database/
│   ├── schema.sql         # Full database schema
│   └── seed.sql           # Sample data
├── uploads/               # Uploaded files (auto-created)
├── .env.example           # Environment variables template
└── README.md              # This file
```

---

## 🔐 SECURITY FEATURES

| Feature | Implementation |
|---------|---------------|
| Authentication | JWT access + refresh tokens |
| Password storage | bcrypt (12 rounds) |
| Route protection | `authenticate` middleware on all admin routes |
| Rate limiting | 200 req/15min global, 5 req/15min for contact form |
| CORS | Whitelist-based, configurable |
| Input sanitization | XSS library on user content |
| Helmet | Security headers |
| File uploads | Type and size restricted (50MB max, images/video/PDF only) |
| Error handling | No sensitive info exposed to client |

---

## 🔗 API ENDPOINTS

### Public
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Admin login |
| GET  | `/api/services` | List services |
| GET  | `/api/projects` | List projects (paginated) |
| GET  | `/api/projects/featured` | Featured projects |
| GET  | `/api/blogs` | List blog posts |
| GET  | `/api/testimonials` | List testimonials |
| GET  | `/api/team` | Team members |
| GET  | `/api/partners` | Partners |
| GET  | `/api/settings` | Site settings |
| POST | `/api/contact` | Submit contact form |

### Admin (requires JWT)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | `/api/auth/me` | Current user profile |
| POST | `/api/services` | Create service |
| PUT  | `/api/services/:id` | Update service |
| DELETE | `/api/services/:id` | Delete service |
| POST | `/api/projects` | Create project |
| PUT  | `/api/projects/:id` | Update project |
| POST | `/api/blogs` | Create blog post |
| PUT  | `/api/blogs/:id` | Update blog post |
| POST | `/api/media/upload` | Upload file |
| GET  | `/api/contact` | View messages |
| PUT  | `/api/settings` | Update settings |

---

## ⚙️ ADMIN DASHBOARD FEATURES

### Login
- Email/password authentication with JWT
- Show/hide password toggle
- Clear validation errors
- Auto-redirect on success

### Dashboard
- Stats cards (Services, Projects, Blog Posts, Messages)
- Unread message badge
- Quick action buttons

### All Modules (Services, Projects, Blog, Testimonials, Team, Partners)
- ✅ List all items in searchable table
- ✅ Create new item via modal form
- ✅ Edit existing item (pre-filled form)
- ✅ Delete with confirmation
- ✅ Status badges (Published, Draft, Archived)

### Messages
- View all contact form submissions
- New message highlighting
- Click to expand full message
- Delete messages

### Media Library
- Upload images, videos, PDFs
- Grid view of all uploaded files
- Delete files

### Settings
- Site name, tagline
- Contact info (phone, email, address)
- WhatsApp number
- Social media links
- Stats (years experience, project count, satisfaction %)

---

## 🛠️ TROUBLESHOOTING

**Login not working?**
```bash
cd backend
node setup-admin.js    # Recreate admin user
npm restart
```

**CORS errors?**
Edit `.env`: `CORS_ORIGIN=http://localhost:5500,http://127.0.0.1:5500`  
Make sure the URL matches exactly where you're serving the frontend.

**Database connection error?**
Check `DB_PASSWORD` in `.env` — ensure PostgreSQL is running.

**"Cannot find module" errors?**
```bash
cd backend && npm install
```

**Frontend shows static content?**
Open browser console — check for API errors. The backend must be running on port 5000.

---

## 📞 SUPPORT

Admin Email: christianlema482@gmail.com  
WhatsApp: +255 757 744 555

---

*Built with Node.js + Express + PostgreSQL + Vanilla HTML/CSS/JS*
