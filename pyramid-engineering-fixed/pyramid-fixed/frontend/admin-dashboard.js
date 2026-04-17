// admin-dashboard.js — Pyramid Construction Admin (Complete CRUD)
'use strict';

const API_BASE = window.PYRAMID_API_URL || 'http://localhost:5000/api';
const TOKEN_STORAGE_KEY = 'pyramid_token';
const REFRESH_TOKEN_STORAGE_KEY = 'pyramid_refresh_token';
const USER_STORAGE_KEY = 'pyramid_user';
let authToken = null, refreshToken = null, currentUser = null, currentRoute = 'dashboard';
let loginInProgress = false;
let confirmCallback = null;
let currentEditId = null;
let currentEditType = null;

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  loadAuthState();
  setupListeners();
  checkAuth();
});

function loadAuthState() {
  authToken    = sessionStorage.getItem(TOKEN_STORAGE_KEY) || localStorage.getItem(TOKEN_STORAGE_KEY);
  refreshToken = sessionStorage.getItem(REFRESH_TOKEN_STORAGE_KEY) || localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
  const us     = sessionStorage.getItem(USER_STORAGE_KEY) || localStorage.getItem(USER_STORAGE_KEY);
  if (us) { try { currentUser = JSON.parse(us); } catch(e){} }
  const theme  = localStorage.getItem('pyramid_admin_theme') || 'light';
  document.documentElement.setAttribute('data-theme', theme);
}

function saveAuthState() {
  if (authToken) {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, authToken);
    localStorage.setItem(TOKEN_STORAGE_KEY, authToken);
  }
  if (refreshToken) {
    sessionStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, refreshToken);
    localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, refreshToken);
  }
  if (currentUser) {
    const payload = JSON.stringify(currentUser);
    sessionStorage.setItem(USER_STORAGE_KEY, payload);
    localStorage.setItem(USER_STORAGE_KEY, payload);
  }
}

function clearAuthState() {
  sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  sessionStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  sessionStorage.removeItem(USER_STORAGE_KEY);
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
  authToken = refreshToken = currentUser = null;
}

// ============================================================
// EVENT LISTENERS
// ============================================================
function setupListeners() {
  // Login form
  document.getElementById('login-form')?.addEventListener('submit', handleLogin);

  // Password visibility toggle
  document.getElementById('toggle-password')?.addEventListener('click', () => {
    const pw   = document.getElementById('password');
    const icon = document.getElementById('eye-icon');
    if (pw.type === 'password') { pw.type = 'text'; icon.className = 'fas fa-eye-slash'; }
    else { pw.type = 'password'; icon.className = 'fas fa-eye'; }
  });

  // Clear errors on input
  ['email','password'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', clearLoginError);
  });

  // Theme toggle
  document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);

  // Logout
  document.getElementById('logout-btn')?.addEventListener('click', handleLogout);

  // Sidebar nav items
  document.querySelectorAll('.nav-item[data-route]').forEach(item => {
    item.addEventListener('click', () => navigate(item.dataset.route));
  });

  // Mobile menu
  document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('open');
  });

  // Sidebar collapse
  document.getElementById('sidebar-collapse')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('collapsed');
    document.querySelector('.app')?.classList.toggle('sidebar-collapsed');
  });
}

// ============================================================
// AUTH
// ============================================================
function setLoginLoading(isLoading) {
  const btn      = document.getElementById('login-btn');
  const loginTxt = document.getElementById('login-text');
  const spinner  = document.getElementById('login-spinner');
  if (btn) btn.disabled = isLoading;
  if (loginTxt) loginTxt.style.display = isLoading ? 'none' : 'inline';
  if (spinner) spinner.style.display = isLoading ? 'inline' : 'none';
}

async function checkAuth() {
  if (!authToken) { showLogin(); return; }
  setLoginLoading(true);
  try {
    const r = await apiGet('/auth/me');
    currentUser = r?.data || r?.user || r;
    if (!currentUser?.id) throw new Error('Invalid user');
    saveAuthState();
    showApp();
    navigate('dashboard');
  } catch {
    clearAuthState();
    showLogin();
  } finally {
    setLoginLoading(false);
  }
}

async function handleLogin(e) {
  e.preventDefault();
  if (loginInProgress) return;
  loginInProgress = true;
  clearLoginError();

  const email    = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  if (!email)    { showLoginError('Email is required'); loginInProgress = false; return; }
  if (!password) { showLoginError('Password is required'); loginInProgress = false; return; }

  const btn      = document.getElementById('login-btn');
  const loginTxt = document.getElementById('login-text');
  const spinner  = document.getElementById('login-spinner');
  btn.disabled = true;
  loginTxt.style.display = 'none';
  spinner.style.display  = 'inline';

  try {
    const resp = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const result = await resp.json();

    if (resp.ok && result.success) {
      const payload   = result.data || result;
      authToken       = payload.accessToken  || payload.access_token;
      refreshToken    = payload.refreshToken || payload.refresh_token;
      currentUser     = payload.user;

      if (!authToken || !currentUser?.id) {
        showLoginError('Login response error. Please contact support.');
        return;
      }

      saveAuthState();
      showApp();
      navigate('dashboard');
    } else {
      showLoginError(result.message || 'Invalid email or password');
    }
  } catch (err) {
    showLoginError('Network error. Make sure the backend server is running.');
  } finally {
    loginInProgress = false;
    btn.disabled = false;
    loginTxt.style.display = 'inline';
    spinner.style.display  = 'none';
  }
}

function handleLogout() {
  clearAuthState();
  showLogin();
  showToast('Logged out successfully', 'info');
}

function showLogin() {
  document.getElementById('login-screen')?.classList.remove('hidden');
  document.getElementById('app')?.classList.add('hidden');
}

function showApp() {
  document.getElementById('login-screen')?.classList.add('hidden');
  document.getElementById('app')?.classList.remove('hidden');
  if (currentUser) {
    const el = document.getElementById('user-name');
    const re = document.getElementById('user-role');
    if (el) el.textContent = currentUser.name || 'Admin';
    if (re) re.textContent = currentUser.role || 'admin';
  }
}

function showLoginError(msg) {
  const el = document.getElementById('login-error');
  if (el) { el.textContent = msg; el.classList.add('show'); }
}

function clearLoginError() {
  const el = document.getElementById('login-error');
  if (el) { el.textContent = ''; el.classList.remove('show'); }
}

// ============================================================
// API HELPERS
// ============================================================
async function apiRequest(endpoint, options = {}) {
  const url     = `${API_BASE}${endpoint}`;
  const headers = { 'Authorization': `Bearer ${authToken}`, ...options.headers };
  if (!options.body || !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const config  = { ...options, headers };
  const resp    = await fetch(url, config);
  if (resp.status === 401) { clearAuthState(); showLogin(); return null; }
  return resp;
}

async function apiGet(endpoint) {
  const r = await apiRequest(endpoint);
  if (!r) return null;
  const d = await r.json();
  if (!r.ok) throw new Error(d.message || 'Request failed');
  return d;
}

async function apiPost(endpoint, data, isUpload = false) {
  const r = await apiRequest(endpoint, {
    method: 'POST',
    body: isUpload ? data : JSON.stringify(data)
  });
  if (!r) return null;
  return await r.json();
}

async function apiPut(endpoint, data) {
  const r = await apiRequest(endpoint, { method: 'PUT', body: JSON.stringify(data) });
  if (!r) return null;
  return await r.json();
}

async function apiDelete(endpoint) {
  const r = await apiRequest(endpoint, { method: 'DELETE' });
  if (!r) return null;
  return await r.json();
}

function arr(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (raw.data) { if (Array.isArray(raw.data)) return raw.data; if (raw.data.rows) return raw.data.rows; }
  if (raw.rows) return raw.rows;
  return [];
}

// ============================================================
// NAVIGATION
// ============================================================
function navigate(route) {
  currentRoute = route;
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  document.querySelectorAll(`[data-route="${route}"]`).forEach(i => i.classList.add('active'));
  const titleEl = document.getElementById('page-title');
  const titles  = { dashboard:'Dashboard', services:'Services', projects:'Projects', blogs:'Blog', testimonials:'Testimonials', team:'Team', partners:'Partners', messages:'Contact Messages', media:'Media Library', settings:'Settings' };
  if (titleEl) titleEl.textContent = titles[route] || route;

  const main = document.getElementById('main-content');
  if (!main) return;

  const renderers = { dashboard, services, projects, blogs, testimonials, team, partners, messages, media, settings };
  if (renderers[route]) renderers[route](main);
  else main.innerHTML = `<div class="page-card"><p>Section "${route}" coming soon.</p></div>`;

  // Close mobile sidebar
  document.getElementById('sidebar')?.classList.remove('open');
}

// ============================================================
// DASHBOARD
// ============================================================
async function dashboard(main) {
  main.innerHTML = `<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>`;

  // Load stats
  const [svcR, projR, blogR, msgR] = await Promise.allSettled([
    apiGet('/services'), apiGet('/projects?limit=1'), apiGet('/blogs?limit=1'), apiGet('/contact')
  ]);

  const svcCount  = arr(svcR.value).length;
  const projTotal = projR.value?.pagination?.total || arr(projR.value).length;
  const blogTotal = blogR.value?.pagination?.total || arr(blogR.value).length;
  const msgTotal  = msgR.value?.pagination?.total  || arr(msgR.value).length;
  const newMsg    = arr(msgR.value).filter(m => m.status === 'new').length;

  // Update badge
  const badge = document.getElementById('messages-badge');
  if (badge) { badge.textContent = newMsg || ''; badge.style.display = newMsg ? '' : 'none'; }

  main.innerHTML = `
    <div class="dashboard-grid">
      <div class="stat-card" onclick="navigate('services')" style="cursor:pointer">
        <div class="stat-icon" style="background:#f59e0b20"><i class="fas fa-wrench" style="color:#f59e0b"></i></div>
        <div class="stat-info"><div class="stat-num">${svcCount}</div><div class="stat-label">Services</div></div>
      </div>
      <div class="stat-card" onclick="navigate('projects')" style="cursor:pointer">
        <div class="stat-icon" style="background:#3b82f620"><i class="fas fa-building" style="color:#3b82f6"></i></div>
        <div class="stat-info"><div class="stat-num">${projTotal}</div><div class="stat-label">Projects</div></div>
      </div>
      <div class="stat-card" onclick="navigate('blogs')" style="cursor:pointer">
        <div class="stat-icon" style="background:#10b98120"><i class="fas fa-newspaper" style="color:#10b981"></i></div>
        <div class="stat-info"><div class="stat-num">${blogTotal}</div><div class="stat-label">Blog Posts</div></div>
      </div>
      <div class="stat-card" onclick="navigate('messages')" style="cursor:pointer">
        <div class="stat-icon" style="background:#ef444420"><i class="fas fa-envelope" style="color:#ef4444"></i></div>
        <div class="stat-info"><div class="stat-num">${msgTotal}</div><div class="stat-label">Messages ${newMsg ? `<span class="badge-inline">${newMsg} new</span>` : ''}</div></div>
      </div>
    </div>
    <div class="dashboard-section-title">Quick Actions</div>
    <div class="quick-actions">
      <button class="btn btn-primary" onclick="navigate('services');setTimeout(()=>openCrudModal('service'),300)"><i class="fas fa-plus"></i> Add Service</button>
      <button class="btn btn-primary" onclick="navigate('projects');setTimeout(()=>openCrudModal('project'),300)"><i class="fas fa-plus"></i> Add Project</button>
      <button class="btn btn-primary" onclick="navigate('blogs');setTimeout(()=>openCrudModal('blog'),300)"><i class="fas fa-plus"></i> New Blog Post</button>
      <button class="btn btn-outline" onclick="navigate('messages')"><i class="fas fa-envelope"></i> View Messages</button>
    </div>
  `;
}

// ============================================================
// SERVICES
// ============================================================
async function services(main) {
  main.innerHTML = `<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>`;
  const data = await apiGet('/services?status=all');
  const rows = arr(data);

  main.innerHTML = `
    <div class="page-toolbar">
      <h2>Services <span class="count-badge">${rows.length}</span></h2>
      <button class="btn btn-primary" onclick="openCrudModal('service')"><i class="fas fa-plus"></i> Add Service</button>
    </div>
    <div class="table-wrapper">
      <table class="data-table">
        <thead><tr><th>Title</th><th>Audience</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          ${rows.length ? rows.map(s => `
            <tr>
              <td><strong>${esc(s.title)}</strong><br><small style="color:var(--text-muted)">${esc(s.short_desc||'')}</small></td>
              <td><span class="tag">${s.audience||'all'}</span></td>
              <td><span class="status-badge ${s.status}">${s.status||'published'}</span></td>
              <td class="actions">
                <button class="btn-icon" title="Edit" onclick="editService('${s.id}')"><i class="fas fa-edit"></i></button>
                <button class="btn-icon danger" title="Delete" onclick="deleteItem('/services/${s.id}','Service','services')"><i class="fas fa-trash"></i></button>
              </td>
            </tr>`).join('') : '<tr><td colspan="4" class="empty-row">No services yet. Add your first service!</td></tr>'}
        </tbody>
      </table>
    </div>`;
}

async function editService(id) {
  const data = await apiGet(`/services/${id}`);
  const svc  = data?.data || data;
  openCrudModal('service', svc);
}

// ============================================================
// PROJECTS
// ============================================================
async function projects(main) {
  main.innerHTML = `<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>`;
  const data = await apiGet('/projects?limit=50&status=all&publish_status=all');
  const rows = arr(data);

  main.innerHTML = `
    <div class="page-toolbar">
      <h2>Projects <span class="count-badge">${data?.pagination?.total || rows.length}</span></h2>
      <button class="btn btn-primary" onclick="openCrudModal('project')"><i class="fas fa-plus"></i> Add Project</button>
    </div>
    <div class="table-wrapper">
      <table class="data-table">
        <thead><tr><th>Title</th><th>Category</th><th>Location</th><th>Featured</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          ${rows.length ? rows.map(p => `
            <tr>
              <td><strong>${esc(p.title)}</strong></td>
              <td>${esc(p.category||'—')}</td>
              <td>${esc(p.location||'—')}</td>
              <td>${p.is_featured ? '<i class="fas fa-star" style="color:#f59e0b"></i>' : '—'}</td>
              <td><span class="status-badge ${p.publish_status||'published'}">${p.publish_status||'published'}</span></td>
              <td class="actions">
                <button class="btn-icon" onclick="editProject('${p.id}')"><i class="fas fa-edit"></i></button>
                <button class="btn-icon danger" onclick="deleteItem('/projects/${p.id}','Project','projects')"><i class="fas fa-trash"></i></button>
              </td>
            </tr>`).join('') : '<tr><td colspan="6" class="empty-row">No projects yet.</td></tr>'}
        </tbody>
      </table>
    </div>`;
}

async function editProject(id) {
  const data = await apiGet(`/projects/${id}`);
  const proj = data?.data || data;
  openCrudModal('project', proj);
}

// ============================================================
// BLOGS
// ============================================================
async function blogs(main) {
  main.innerHTML = `<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>`;
  const data = await apiGet('/blogs?limit=50&status=all');
  const rows = arr(data);

  main.innerHTML = `
    <div class="page-toolbar">
      <h2>Blog Posts <span class="count-badge">${data?.pagination?.total || rows.length}</span></h2>
      <button class="btn btn-primary" onclick="openCrudModal('blog')"><i class="fas fa-plus"></i> New Post</button>
    </div>
    <div class="table-wrapper">
      <table class="data-table">
        <thead><tr><th>Title</th><th>Author</th><th>Category</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          ${rows.length ? rows.map(b => `
            <tr>
              <td><strong>${esc(b.title)}</strong><br><small style="color:var(--text-muted)">${esc(b.excerpt||'').substring(0,80)}${(b.excerpt||'').length>80?'...':''}</small></td>
              <td>${esc(b.author_name||'—')}</td>
              <td>${esc(b.category||'—')}</td>
              <td><span class="status-badge ${b.status}">${b.status||'draft'}</span></td>
              <td class="actions">
                <button class="btn-icon" onclick="editBlog('${b.id}')"><i class="fas fa-edit"></i></button>
                <button class="btn-icon danger" onclick="deleteItem('/blogs/${b.id}','Blog post','blogs')"><i class="fas fa-trash"></i></button>
              </td>
            </tr>`).join('') : '<tr><td colspan="5" class="empty-row">No blog posts yet.</td></tr>'}
        </tbody>
      </table>
    </div>`;
}

async function editBlog(id) {
  const data = await apiGet(`/blogs/${id}`);
  const blog = data?.data || data;
  openCrudModal('blog', blog);
}

// ============================================================
// TESTIMONIALS
// ============================================================
async function testimonials(main) {
  main.innerHTML = `<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>`;
  const data = await apiGet('/testimonials');
  const rows = arr(data);

  main.innerHTML = `
    <div class="page-toolbar">
      <h2>Testimonials <span class="count-badge">${rows.length}</span></h2>
      <button class="btn btn-primary" onclick="openCrudModal('testimonial')"><i class="fas fa-plus"></i> Add Testimonial</button>
    </div>
    <div class="table-wrapper">
      <table class="data-table">
        <thead><tr><th>Client</th><th>Role</th><th>Rating</th><th>Featured</th><th>Actions</th></tr></thead>
        <tbody>
          ${rows.length ? rows.map(t => `
            <tr>
              <td><strong>${esc(t.client_name)}</strong></td>
              <td>${esc(t.client_role||'—')}</td>
              <td>${'★'.repeat(parseInt(t.rating)||5)}</td>
              <td>${t.is_featured ? '<i class="fas fa-check-circle" style="color:#10b981"></i>' : '—'}</td>
              <td class="actions">
                <button class="btn-icon" onclick="editTestimonial('${t.id}')"><i class="fas fa-edit"></i></button>
                <button class="btn-icon danger" onclick="deleteItem('/testimonials/${t.id}','Testimonial','testimonials')"><i class="fas fa-trash"></i></button>
              </td>
            </tr>`).join('') : '<tr><td colspan="5" class="empty-row">No testimonials yet.</td></tr>'}
        </tbody>
      </table>
    </div>`;
}

async function editTestimonial(id) {
  const data = await apiGet(`/testimonials/${id}`);
  const t    = data?.data || data;
  openCrudModal('testimonial', t);
}

// ============================================================
// TEAM
// ============================================================
async function team(main) {
  main.innerHTML = `<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>`;
  const data = await apiGet('/team');
  const rows = arr(data);

  main.innerHTML = `
    <div class="page-toolbar">
      <h2>Team Members <span class="count-badge">${rows.length}</span></h2>
      <button class="btn btn-primary" onclick="openCrudModal('team-member')"><i class="fas fa-plus"></i> Add Member</button>
    </div>
    <div class="table-wrapper">
      <table class="data-table">
        <thead><tr><th>Name</th><th>Role</th><th>Email</th><th>Visible</th><th>Actions</th></tr></thead>
        <tbody>
          ${rows.length ? rows.map(m => `
            <tr>
              <td><strong>${esc(m.name)}</strong></td>
              <td>${esc(m.role_title||'—')}</td>
              <td>${esc(m.email||'—')}</td>
              <td>${m.is_visible !== false ? '<i class="fas fa-eye" style="color:#10b981"></i>' : '<i class="fas fa-eye-slash" style="color:#999"></i>'}</td>
              <td class="actions">
                <button class="btn-icon" onclick="editTeamMember('${m.id}')"><i class="fas fa-edit"></i></button>
                <button class="btn-icon danger" onclick="deleteItem('/team/${m.id}','Team member','team')"><i class="fas fa-trash"></i></button>
              </td>
            </tr>`).join('') : '<tr><td colspan="5" class="empty-row">No team members yet.</td></tr>'}
        </tbody>
      </table>
    </div>`;
}

async function editTeamMember(id) {
  const data = await apiGet(`/team/${id}`);
  const m    = data?.data || data;
  openCrudModal('team-member', m);
}

// ============================================================
// PARTNERS
// ============================================================
async function partners(main) {
  main.innerHTML = `<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>`;
  const data = await apiGet('/partners');
  const rows = arr(data);

  main.innerHTML = `
    <div class="page-toolbar">
      <h2>Partners <span class="count-badge">${rows.length}</span></h2>
      <button class="btn btn-primary" onclick="openCrudModal('partner')"><i class="fas fa-plus"></i> Add Partner</button>
    </div>
    <div class="table-wrapper">
      <table class="data-table">
        <thead><tr><th>Name</th><th>Website</th><th>Actions</th></tr></thead>
        <tbody>
          ${rows.length ? rows.map(p => `
            <tr>
              <td><strong>${esc(p.name)}</strong></td>
              <td>${p.website ? `<a href="${esc(p.website)}" target="_blank">${esc(p.website)}</a>` : '—'}</td>
              <td class="actions">
                <button class="btn-icon" onclick="editPartner('${p.id}')"><i class="fas fa-edit"></i></button>
                <button class="btn-icon danger" onclick="deleteItem('/partners/${p.id}','Partner','partners')"><i class="fas fa-trash"></i></button>
              </td>
            </tr>`).join('') : '<tr><td colspan="3" class="empty-row">No partners yet.</td></tr>'}
        </tbody>
      </table>
    </div>`;
}

async function editPartner(id) {
  const data = await apiGet(`/partners/${id}`);
  const p    = data?.data || data;
  openCrudModal('partner', p);
}

// ============================================================
// MESSAGES
// ============================================================
async function messages(main) {
  main.innerHTML = `<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>`;
  const data = await apiGet('/contact?limit=50');
  const rows = arr(data);

  // Update badge
  const newCount = rows.filter(m => m.status === 'new').length;
  const badge    = document.getElementById('messages-badge');
  if (badge) { badge.textContent = newCount || ''; badge.style.display = newCount ? '' : 'none'; }

  main.innerHTML = `
    <div class="page-toolbar">
      <h2>Contact Messages <span class="count-badge">${data?.pagination?.total || rows.length}</span></h2>
    </div>
    <div class="table-wrapper">
      <table class="data-table">
        <thead><tr><th>Name</th><th>Email</th><th>Subject</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          ${rows.length ? rows.map(m => `
            <tr class="${m.status === 'new' ? 'row-new' : ''}">
              <td><strong>${esc(m.name)}</strong></td>
              <td><a href="mailto:${esc(m.email)}">${esc(m.email)}</a></td>
              <td>${esc(m.subject||'General Enquiry')}</td>
              <td>${new Date(m.created_at).toLocaleDateString()}</td>
              <td><span class="status-badge ${m.status||'new'}">${m.status||'new'}</span></td>
              <td class="actions">
                <button class="btn-icon" title="View" onclick="viewMessage(${JSON.stringify(m).replace(/"/g,'&quot;')})"><i class="fas fa-eye"></i></button>
                <button class="btn-icon danger" title="Delete" onclick="deleteItem('/contact/${m.id}','Message','messages')"><i class="fas fa-trash"></i></button>
              </td>
            </tr>`).join('') : '<tr><td colspan="6" class="empty-row">No messages yet.</td></tr>'}
        </tbody>
      </table>
    </div>`;
}

function viewMessage(m) {
  const modal = document.getElementById('crud-modal');
  document.getElementById('crud-modal-title').textContent = 'Message from ' + m.name;
  document.getElementById('crud-modal-body').innerHTML = `
    <div style="display:grid;gap:12px;">
      <div><strong>From:</strong> ${esc(m.name)} &lt;${esc(m.email)}&gt;</div>
      ${m.phone ? `<div><strong>Phone:</strong> ${esc(m.phone)}</div>` : ''}
      ${m.subject ? `<div><strong>Subject:</strong> ${esc(m.subject)}</div>` : ''}
      <div><strong>Date:</strong> ${new Date(m.created_at).toLocaleString()}</div>
      <div style="border-top:1px solid var(--border);padding-top:12px;"><strong>Message:</strong><p style="margin-top:8px;white-space:pre-wrap">${esc(m.message)}</p></div>
    </div>`;
  document.getElementById('crud-save-btn').style.display = 'none';
  modal.classList.remove('hidden');
}

// ============================================================
// MEDIA
// ============================================================
async function media(main) {
  main.innerHTML = `<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>`;
  const data = await apiGet('/media?limit=50');
  const rows = arr(data);

  main.innerHTML = `
    <div class="page-toolbar">
      <h2>Media Library <span class="count-badge">${rows.length}</span></h2>
      <label class="btn btn-primary" style="cursor:pointer">
        <i class="fas fa-upload"></i> Upload File
        <input type="file" id="media-upload-input" style="display:none" accept="image/*,video/*,application/pdf" multiple onchange="uploadMedia(this)">
      </label>
    </div>
    <div class="media-grid">
      ${rows.length ? rows.map(m => `
        <div class="media-item">
          ${m.media_type === 'image'
            ? `<img src="${API_BASE.replace('/api','')}/uploads/${m.file_path}" alt="${esc(m.alt_text||m.original_name||'')}" onerror="this.src='https://placehold.co/150x100?text=Image'">`
            : `<div class="media-icon"><i class="fas fa-${m.media_type === 'video' ? 'video' : 'file'}"></i></div>`}
          <div class="media-info">
            <span class="media-name">${esc(m.original_name||m.file_path||'')}</span>
            <button class="btn-icon danger" onclick="deleteItem('/media/${m.id}','File','media')"><i class="fas fa-trash"></i></button>
          </div>
        </div>`).join('') : '<div class="empty-media">No media uploaded yet. Upload your first file!</div>'}
    </div>`;
}

async function uploadMedia(input) {
  const files = input.files;
  if (!files.length) return;

  showToast(`Uploading ${files.length} file(s)...`, 'info');
  let uploaded = 0;

  for (const file of files) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('alt_text', file.name.replace(/\.[^.]+$/, '').replace(/-|_/g, ' '));
    const r = await apiPost('/media/upload', fd, true);
    if (r?.success) { uploaded++; }
  }

  showToast(`${uploaded} file(s) uploaded successfully`, 'success');
  navigate('media');
}

// ============================================================
// SETTINGS
// ============================================================
async function settings(main) {
  main.innerHTML = `<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>`;
  const data = await apiGet('/settings');
  const map  = (data?.data?.map || data?.data || {});

  const fields = [
    { key: 'site_name',        label: 'Site Name',           type: 'text' },
    { key: 'site_tagline',     label: 'Site Tagline',        type: 'text' },
    { key: 'contact_email',    label: 'Contact Email',       type: 'email' },
    { key: 'contact_phone',    label: 'Contact Phone',       type: 'text' },
    { key: 'contact_address',  label: 'Address',             type: 'text' },
    { key: 'whatsapp_number',  label: 'WhatsApp Number',     type: 'text' },
    { key: 'facebook_url',     label: 'Facebook URL',        type: 'url' },
    { key: 'instagram_url',    label: 'Instagram URL',       type: 'url' },
    { key: 'linkedin_url',     label: 'LinkedIn URL',        type: 'url' },
    { key: 'twitter_url',      label: 'Twitter / X URL',     type: 'url' },
    { key: 'years_experience', label: 'Years Experience',    type: 'number' },
    { key: 'projects_count',   label: 'Projects Count',      type: 'number' },
    { key: 'satisfaction_pct', label: 'Satisfaction %',      type: 'number' },
  ];

  const getValue = (key) => {
    if (map[key]) return map[key].value || '';
    return '';
  };

  main.innerHTML = `
    <div class="page-toolbar"><h2>Site Settings</h2></div>
    <div class="page-card">
      <form id="settings-form" style="display:grid;gap:20px;max-width:600px">
        ${fields.map(f => `
          <div class="form-group">
            <label>${f.label}</label>
            <input type="${f.type}" id="setting_${f.key}" value="${esc(getValue(f.key))}" placeholder="${f.label}">
          </div>`).join('')}
        <button type="submit" class="btn btn-primary">Save Settings</button>
      </form>
    </div>`;

  document.getElementById('settings-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const settings = fields.map(f => ({
      key: f.key,
      value: document.getElementById(`setting_${f.key}`).value
    }));
    const r = await apiPut('/settings', { settings });
    if (r?.success) showToast('Settings saved!', 'success');
    else showToast('Failed to save settings', 'error');
  });
}

// ============================================================
// CRUD MODAL
// ============================================================
const formDefs = {
  service: {
    title: 'Service',
    fields: [
      { name: 'title',       label: 'Title',        type: 'text',     required: true },
      { name: 'short_desc',  label: 'Short Description', type: 'text', required: true },
      { name: 'audience',    label: 'Audience',     type: 'select',   options: ['all','individual','corporate','government'] },
      { name: 'status',      label: 'Status',       type: 'select',   options: ['published','draft','archived'] },
      { name: 'full_desc',   label: 'Full Description', type: 'textarea' },
      { name: 'sort_order',  label: 'Sort Order',   type: 'number' },
    ],
    endpoint: '/services',
  },
  project: {
    title: 'Project',
    fields: [
      { name: 'title',         label: 'Title',        type: 'text',   required: true },
      { name: 'location',      label: 'Location',     type: 'text' },
      { name: 'category',      label: 'Category',     type: 'select', options: ['residential','commercial','government','infrastructure','renovation','other'] },
      { name: 'publish_status',label: 'Status',       type: 'select', options: ['published','draft','archived'] },
      { name: 'is_featured',   label: 'Featured',     type: 'checkbox' },
      { name: 'description',   label: 'Description',  type: 'textarea' },
      { name: 'client_name',   label: 'Client Name',  type: 'text' },
      { name: 'year_completed',label: 'Year Completed',type: 'number' },
      { name: 'sort_order',    label: 'Sort Order',   type: 'number' },
    ],
    endpoint: '/projects',
  },
  blog: {
    title: 'Blog Post',
    fields: [
      { name: 'title',       label: 'Title',        type: 'text',   required: true },
      { name: 'excerpt',     label: 'Excerpt',      type: 'textarea' },
      { name: 'category',    label: 'Category',     type: 'text' },
      { name: 'author_name', label: 'Author Name',  type: 'text' },
      { name: 'status',      label: 'Status',       type: 'select', options: ['published','draft'] },
      { name: 'content',     label: 'Content',      type: 'textarea' },
    ],
    endpoint: '/blogs',
  },
  testimonial: {
    title: 'Testimonial',
    fields: [
      { name: 'client_name', label: 'Client Name',  type: 'text',   required: true },
      { name: 'client_role', label: 'Role/Company',  type: 'text' },
      { name: 'client_type', label: 'Client Type',   type: 'select', options: ['individual','corporate','government'] },
      { name: 'body',        label: 'Testimonial',   type: 'textarea', required: true },
      { name: 'rating',      label: 'Rating (1-5)',  type: 'number' },
      { name: 'is_featured', label: 'Featured',      type: 'checkbox' },
    ],
    endpoint: '/testimonials',
  },
  'team-member': {
    title: 'Team Member',
    fields: [
      { name: 'name',         label: 'Full Name',    type: 'text',   required: true },
      { name: 'role_title',   label: 'Role/Title',   type: 'text',   required: true },
      { name: 'bio',          label: 'Biography',    type: 'textarea' },
      { name: 'email',        label: 'Email',        type: 'email' },
      { name: 'linkedin_url', label: 'LinkedIn URL', type: 'url' },
      { name: 'sort_order',   label: 'Sort Order',   type: 'number' },
      { name: 'is_visible',   label: 'Visible',      type: 'checkbox' },
    ],
    endpoint: '/team',
  },
  partner: {
    title: 'Partner',
    fields: [
      { name: 'name',    label: 'Partner Name', type: 'text', required: true },
      { name: 'website', label: 'Website URL',  type: 'url' },
    ],
    endpoint: '/partners',
  },
};

function openCrudModal(type, existingData = null) {
  const def = formDefs[type];
  if (!def) return;

  currentEditType = type;
  currentEditId   = existingData?.id || null;

  document.getElementById('crud-modal-title').textContent = (existingData ? 'Edit' : 'Add') + ' ' + def.title;
  document.getElementById('crud-save-btn').style.display = '';

  const body = document.getElementById('crud-modal-body');
  body.innerHTML = def.fields.map(f => {
    const val = existingData ? (existingData[f.name] ?? '') : '';
    if (f.type === 'select') {
      return `<div class="form-group">
        <label>${f.label}${f.required ? ' *' : ''}</label>
        <select id="field_${f.name}">
          ${f.options.map(o => `<option value="${o}" ${val === o ? 'selected' : ''}>${o}</option>`).join('')}
        </select>
      </div>`;
    }
    if (f.type === 'textarea') {
      return `<div class="form-group">
        <label>${f.label}</label>
        <textarea id="field_${f.name}" rows="4">${esc(String(val))}</textarea>
      </div>`;
    }
    if (f.type === 'checkbox') {
      return `<div class="form-group" style="flex-direction:row;align-items:center;gap:10px">
        <input type="checkbox" id="field_${f.name}" ${val ? 'checked' : ''} style="width:auto">
        <label for="field_${f.name}" style="margin:0">${f.label}</label>
      </div>`;
    }
    return `<div class="form-group">
      <label>${f.label}${f.required ? ' *' : ''}</label>
      <input type="${f.type}" id="field_${f.name}" value="${esc(String(val))}" ${f.required ? 'required' : ''}>
    </div>`;
  }).join('');

  document.getElementById('crud-modal').classList.remove('hidden');
}

async function saveCrudItem() {
  const def = formDefs[currentEditType];
  if (!def) return;

  const data = {};
  for (const f of def.fields) {
    const el = document.getElementById(`field_${f.name}`);
    if (!el) continue;
    if (f.type === 'checkbox') data[f.name] = el.checked;
    else if (f.type === 'number') data[f.name] = el.value ? Number(el.value) : null;
    else data[f.name] = el.value.trim();
    if (f.required && !data[f.name]) {
      showToast(`${f.label} is required`, 'error');
      el.focus();
      return;
    }
  }

  const btn = document.getElementById('crud-save-btn');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    let r;
    if (currentEditId) {
      r = await apiPut(`${def.endpoint}/${currentEditId}`, data);
    } else {
      r = await apiPost(def.endpoint, data);
    }

    if (r?.success || r?.data) {
      showToast(`${def.title} ${currentEditId ? 'updated' : 'created'} successfully!`, 'success');
      closeCrudModal();
      navigate(currentRoute);
    } else {
      showToast(r?.message || 'Failed to save. Check database connection.', 'error');
    }
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save';
  }
}

function closeCrudModal() {
  document.getElementById('crud-modal').classList.add('hidden');
  currentEditId = currentEditType = null;
  document.getElementById('crud-save-btn').style.display = '';
}

// ============================================================
// DELETE
// ============================================================
function deleteItem(endpoint, label, reloadRoute) {
  showConfirm(`Delete this ${label}?`, `This action cannot be undone.`, async () => {
    const r = await apiDelete(endpoint);
    if (r?.success || r?.data !== undefined) {
      showToast(`${label} deleted`, 'success');
      navigate(reloadRoute || currentRoute);
    } else {
      showToast(r?.message || 'Delete failed', 'error');
    }
  });
}

// ============================================================
// CONFIRM MODAL
// ============================================================
function showConfirm(title, message, onConfirm) {
  document.getElementById('confirm-title').textContent  = title;
  document.getElementById('confirm-message').textContent = message;
  confirmCallback = onConfirm;
  document.getElementById('confirm-modal').classList.remove('hidden');
  document.getElementById('confirm-ok').onclick = () => {
    closeConfirmModal();
    if (confirmCallback) confirmCallback();
  };
}

function closeConfirmModal() {
  document.getElementById('confirm-modal').classList.add('hidden');
}

// ============================================================
// TOAST
// ============================================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { success: 'check-circle', error: 'exclamation-circle', info: 'info-circle', warning: 'exclamation-triangle' };
  toast.innerHTML = `<i class="fas fa-${icons[type]||'info-circle'}"></i><span>${esc(message)}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3500);
}

// ============================================================
// THEME
// ============================================================
function toggleTheme() {
  const cur    = document.documentElement.getAttribute('data-theme');
  const next   = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('pyramid_admin_theme', next);
  const icon   = document.querySelector('#theme-toggle i');
  if (icon) icon.className = next === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
}

// ============================================================
// UTILS
// ============================================================
function esc(str) {
  if (!str && str !== 0) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

console.log('✅ Pyramid Admin Dashboard loaded');
