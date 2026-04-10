// Admin Dashboard JavaScript

// API Configuration
const API_BASE = 'http://localhost:5000/api';
const INACTIVITY_LIMIT = 30 * 60 * 1000; // 30 minutes
let inactivityTimeout = null;

// Global State
let currentUser = null;
let currentRoute = 'dashboard';
let authToken = null;
let refreshToken = null;
let selectedMedia = [];
let mediaPickerCallback = null;
let isMultiSelect = false;

// DOM Elements
const app = document.getElementById('app');
const loginScreen = document.getElementById('login-screen');
const sidebar = document.getElementById('sidebar');
const mainContent = document.getElementById('main-content');
const pageTitle = document.getElementById('page-title');
const toastContainer = document.getElementById('toast-container');
const confirmModal = document.getElementById('confirm-modal');
const mediaPickerModal = document.getElementById('media-picker-modal');
const uploadModal = document.getElementById('upload-modal');
const rightDrawer = document.getElementById('right-drawer');
const fullScreenForm = document.getElementById('full-screen-form');
const bottomNav = document.getElementById('bottom-nav');

// Initialize App
document.addEventListener('DOMContentLoaded', initApp);

function initApp() {
  console.log('🚀 initApp() called - initializing admin dashboard');
  loadAuthState();
  setupEventListeners();
  checkAuth();
}

function loadAuthState() {
  authToken = sessionStorage.getItem('pyramid_token');
  refreshToken = sessionStorage.getItem('pyramid_refresh_token');
  const userStr = sessionStorage.getItem('pyramid_user');
  if (userStr) {
    currentUser = JSON.parse(userStr);
  }
  const theme = localStorage.getItem('pyramid_admin_theme') || 'light';
  document.documentElement.setAttribute('data-theme', theme);
}

function saveAuthState() {
  if (!authToken || !currentUser) {
    console.error('Cannot save auth state; token or user missing', { authToken, currentUser });
    return;
  }
  sessionStorage.setItem('pyramid_token', authToken);
  if (refreshToken) sessionStorage.setItem('pyramid_refresh_token', refreshToken);
  sessionStorage.setItem('pyramid_user', JSON.stringify(currentUser));
}

function clearAuthState() {
  sessionStorage.removeItem('pyramid_token');
  sessionStorage.removeItem('pyramid_refresh_token');
  sessionStorage.removeItem('pyramid_user');
  authToken = null;
  refreshToken = null;
  currentUser = null;
}

function setupEventListeners() {
  console.log('📋 setupEventListeners() - attaching event handlers');
  
  // Login
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
    console.log('✅ Login form listener attached');
  } else {
    console.error('❌ Login form not found');
  }

  // Password visibility toggle
  const passwordToggle = document.getElementById('password-toggle');
  if (passwordToggle) {
    passwordToggle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      togglePasswordVisibility();
    });
    console.log('✅ Password toggle listener attached');
  } else {
    console.error('❌ Password toggle not found');
  }

  // Clear error message when user starts typing
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  if (emailInput) emailInput.addEventListener('input', clearLoginError);
  if (passwordInput) passwordInput.addEventListener('input', clearLoginError);
  if (emailInput && passwordInput) {
    console.log('✅ Email/Password input listeners attached');
  }

  // Navigation
  document.querySelectorAll('.nav-item[data-route]').forEach(item => {
    item.addEventListener('click', () => navigate(item.dataset.route));
  });

  // Mobile navigation
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', toggleSidebar);
  
  const sidebarCollapse = document.getElementById('sidebar-collapse');
  if (sidebarCollapse) sidebarCollapse.addEventListener('click', toggleSidebar);
  
  document.querySelectorAll('.bottom-nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const route = item.dataset.route;
      if (route === 'content') {
        // Show content submenu
        showContentSubmenu();
      } else {
        navigate(route);
      }
    });
  });

  // Theme toggle
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) themeToggle.addEventListener('click', toggleTheme);

  // Logout
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

  // Modals
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', closeModal);
  });

  // Confirm modal
  const confirmCancel = document.getElementById('confirm-cancel');
  const confirmOk = document.getElementById('confirm-ok');
  if (confirmCancel) confirmCancel.addEventListener('click', () => hideModal(confirmModal));
  if (confirmOk) confirmOk.addEventListener('click', handleConfirm);

  // Media picker
  const mediaSearch = document.getElementById('media-search');
  if (mediaSearch) mediaSearch.addEventListener('input', debounce(searchMedia, 300));
  
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => filterMedia(btn.dataset.filter));
  });
  
  const uploadNewMedia = document.getElementById('upload-new-media');
  if (uploadNewMedia) uploadNewMedia.addEventListener('click', () => showModal(uploadModal));
  
  const mediaPickerCancel = document.getElementById('media-picker-cancel');
  if (mediaPickerCancel) mediaPickerCancel.addEventListener('click', () => hideModal(mediaPickerModal));
  
  const mediaPickerSelect = document.getElementById('media-picker-select');
  if (mediaPickerSelect) mediaPickerSelect.addEventListener('click', selectMedia);
  
  const loadMoreMedia = document.getElementById('load-more-media');
  if (loadMoreMedia) loadMoreMedia.addEventListener('click', loadMoreMedia);

  // Upload
  const uploadZone = document.getElementById('upload-zone');
  if (uploadZone) uploadZone.addEventListener('click', () => {
    const fileInput = document.getElementById('file-input');
    if (fileInput) fileInput.click();
  });
  
  const fileInput = document.getElementById('file-input');
  if (fileInput) fileInput.addEventListener('change', handleFileSelect);
  
  const uploadCancel = document.getElementById('upload-cancel');
  if (uploadCancel) uploadCancel.addEventListener('click', () => hideModal(uploadModal));
  
  const uploadStart = document.getElementById('upload-start');
  if (uploadStart) uploadStart.addEventListener('click', startUpload);

  // Full screen form
  const formBack = document.getElementById('form-back');
  if (formBack) formBack.addEventListener('click', closeFullScreenForm);

  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyboard);

  // Window events for auto-logout
  window.addEventListener('beforeunload', handleTabClose);
  window.addEventListener('focus', resetInactivityTimer);
  window.addEventListener('click', resetInactivityTimer);
  window.addEventListener('keypress', resetInactivityTimer);

  // Start inactivity timer
  resetInactivityTimer();
}

// Password Visibility Toggle
function togglePasswordVisibility() {
  const passwordInput = document.getElementById('password');
  const icon = document.querySelector('#password-toggle i');
  
  if (!passwordInput || !icon) {
    console.error('Password toggle elements not found');
    return;
  }
  
  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    icon.classList.remove('fa-eye');
    icon.classList.add('fa-eye-slash');
    console.log('Password visible');
  } else {
    passwordInput.type = 'password';
    icon.classList.remove('fa-eye-slash');
    icon.classList.add('fa-eye');
    console.log('Password hidden');
  }
}

// Clear login error when user starts typing
function clearLoginError() {
  const errorDiv = document.getElementById('login-error');
  if (errorDiv) {
    errorDiv.textContent = '';
    errorDiv.classList.remove('show');
  }
}

// Authentication
async function checkAuth() {
  if (!authToken) {
    showLogin();
    return;
  }

  try {
    const response = await apiGet('/auth/me');
    // auth/me returns user object; older formats may wrap user under .user
    currentUser = response?.user || response;

    if (!currentUser || !currentUser.id) {
      throw new Error('Invalid user profile from auth/me');
    }

    saveAuthState();
    showApp();
    navigate(currentRoute);
  } catch (error) {
    console.error('Auth check failed:', error);
    await refreshAuthToken();
  }
}

async function refreshAuthToken() {
  if (!refreshToken) {
    showLogin();
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });

    if (response.ok) {
      const data = await response.json();
      authToken = data.accessToken;
      refreshToken = data.refreshToken;
      saveAuthState();
      await checkAuth();
    } else {
      throw new Error('Refresh failed');
    }
  } catch (error) {
    console.error('Token refresh failed:', error);
    showLogin();
  }
}

async function handleLogin(e) {
  e.preventDefault();
  
  console.log('Login form submitted');
  
  // Clear previous error
  clearLoginError();
  
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  // Client-side validation
  if (!email) {
    showLoginError('Email is required');
    return;
  }
  if (!password) {
    showLoginError('Password is required');
    return;
  }

  try {
    console.log(`Attempting login for: ${email}`);
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    console.log(`Login response status: ${response.status}`);

    if (response.ok) {
      const result = await response.json();
      console.log('Login response data:', result);

      const payload = result && result.data ? result.data : result;
      authToken = payload?.accessToken || payload?.access_token;
      refreshToken = payload?.refreshToken || payload?.refresh_token;
      currentUser = payload?.user || payload;

      if (!authToken || !currentUser || !currentUser.id) {
        console.error('Login validation failed - payload incomplete', { payload });
        showLoginError('Invalid login response. Please contact support.');
        return;
      }

      console.log('Login successful, saving auth state');
      saveAuthState();
      showApp();
      navigate('dashboard');
    } else {
      let errorMsg = 'Invalid email or password';
      try {
        const error = await response.json();
        errorMsg = error.message || errorMsg;
      } catch (e) {
        console.log('Could not parse error response');
      }
      console.error('Login failed with status:', response.status, errorMsg);
      showLoginError(errorMsg);
    }
  } catch (error) {
    console.error('Login error:', error);
    showLoginError('Network error. Please check your connection and try again.');
  }
}

function handleLogout() {
  clearAuthState();
  showLogin();
}

function showLogin() {
  loginScreen.classList.remove('hidden');
  app.classList.add('hidden');
}

function showApp() {
  loginScreen.classList.add('hidden');
  app.classList.remove('hidden');
  updateUserInfo();
}

function showLoginError(message) {
  const errorDiv = document.getElementById('login-error');
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.classList.add('show');
    console.log('Error displayed:', message);
  } else {
    console.error('Error div not found');
  }
}

function updateUserInfo() {
  if (currentUser) {
    document.getElementById('user-name').textContent = currentUser.name;
    document.getElementById('user-role').textContent = currentUser.role;
  }
}

// API Client
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  };

  try {
    const response = await fetch(url, config);

    if (response.status === 401) {
      await refreshAuthToken();
      // Retry with new token
      config.headers.Authorization = `Bearer ${authToken}`;
      return fetch(url, config);
    }

    return response;
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}

async function parseApiResponse(response) {
  let json;
  try {
    json = await response.json();
  } catch (err) {
    throw new Error('Invalid JSON response from API');
  }

  if (!response.ok) {
    const message = json && json.message ? json.message : 'API request failed';
    throw new Error(message);
  }

  // Backend wraps everything in { success, data, message }
  // data can be null (e.g. DELETE returns null data)
  if (json && json.success === true) {
    return json.data !== undefined ? json.data : null;
  }

  // Fallback: if response has a data field, return it
  if (json && typeof json === 'object' && 'data' in json) {
    return json.data;
  }

  return json;
}

async function apiGet(endpoint) {
  const response = await apiRequest(endpoint);
  return parseApiResponse(response);
}

async function apiPost(endpoint, data) {
  const response = await apiRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify(data)
  });
  return parseApiResponse(response);
}

async function apiPut(endpoint, data) {
  const response = await apiRequest(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
  return parseApiResponse(response);
}

async function apiDelete(endpoint) {
  const response = await apiRequest(endpoint, { method: 'DELETE' });
  return parseApiResponse(response);
}

async function apiPatch(endpoint, data) {
  const response = await apiRequest(endpoint, {
    method: 'PATCH',
    body: JSON.stringify(data)
  });
  return parseApiResponse(response);
}

// Navigation
function navigate(route) {
  currentRoute = route;
  updateNavUI(route);
  loadPage(route);
  updatePageTitle(route);
  closeSidebar();
}

function updateNavUI(route) {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
  });
  document.querySelectorAll(`[data-route="${route}"]`).forEach(item => {
    item.classList.add('active');
  });

  // Update bottom nav
  document.querySelectorAll('.bottom-nav-item').forEach(item => {
    item.classList.remove('active');
  });
  const bottomItem = document.querySelector(`.bottom-nav-item[data-route="${route}"]`);
  if (bottomItem) {
    bottomItem.classList.add('active');
  }
}

function updatePageTitle(route) {
  const titles = {
    dashboard: 'Dashboard',
    media: 'Media Library',
    services: 'Services',
    projects: 'Projects',
    blogs: 'Blog',
    testimonials: 'Testimonials',
    team: 'Team',
    partners: 'Partners',
    messages: 'Contact Messages',
    settings: 'Settings',
    users: 'Users',
    ai: 'AI Conversations'
  };
  pageTitle.textContent = titles[route] || 'Admin';
}

function toggleSidebar() {
  sidebar.classList.toggle('open');
  document.querySelector('.topbar').classList.toggle('collapsed');
  mainContent.classList.toggle('collapsed');
}

function closeSidebar() {
  sidebar.classList.remove('open');
  document.querySelector('.topbar').classList.remove('collapsed');
  mainContent.classList.remove('collapsed');
}

function showContentSubmenu() {
  // For mobile, show a submenu for content sections
  // This is a simplified implementation
  const submenu = document.createElement('div');
  submenu.innerHTML = `
    <div class="content-submenu">
      <button data-route="services">Services</button>
      <button data-route="projects">Projects</button>
      <button data-route="blogs">Blog</button>
      <button data-route="testimonials">Testimonials</button>
      <button data-route="team">Team</button>
      <button data-route="partners">Partners</button>
    </div>
  `;
  // Add to DOM and position
  // This would need more implementation for a full submenu
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('pyramid_admin_theme', newTheme);
  document.getElementById('theme-toggle').innerHTML = newTheme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
}

function handleResize() {
  if (window.innerWidth > 1024) {
    closeSidebar();
  }
}

// Auto-logout functionality
let inactivityTimer;

function handleTabClose() {
  // Clear session on tab close
  clearAuthState();
}

function resetInactivityTimer() {
  clearTimeout(inactivityTimer);
  // 30 minutes = 30 * 60 * 1000 = 1,800,000 milliseconds
  inactivityTimer = setTimeout(() => {
    showToast('Session expired due to inactivity', 'warning');
    handleLogout();
  }, 1800000);
}

function handleKeyboard(e) {
  if (e.key === 'Escape') {
    closeModal();
    closeFullScreenForm();
  }
  if (e.ctrlKey && e.key === 's') {
    e.preventDefault();
    // Save current form if open
  }
  if (e.ctrlKey && e.key === 'k') {
    e.preventDefault();
    document.getElementById('media-search').focus();
  }
}

// Page Loaders
async function loadPage(route) {
  mainContent.innerHTML = '<div class="skeleton skeleton-card"></div>'.repeat(3);

  try {
    switch (route) {
      case 'dashboard':
        await loadDashboard();
        break;
      case 'media':
        await loadMedia();
        break;
      case 'services':
        await loadServices();
        break;
      case 'projects':
        await loadProjects();
        break;
      case 'blogs':
        await loadBlogs();
        break;
      case 'testimonials':
        await loadTestimonials();
        break;
      case 'team':
        await loadTeam();
        break;
      case 'partners':
        await loadPartners();
        break;
      case 'messages':
        await loadMessages();
        break;
      case 'settings':
        await loadSettings();
        break;
      case 'users':
        await loadUsers();
        break;
      case 'ai':
        await loadAI();
        break;
      default:
        mainContent.innerHTML = '<div class="card"><p>Page not found</p></div>';
    }
async function loadDashboard() {
  if (!authToken) {
    console.warn('No auth token for dashboard, redirecting to login');
    handleLogout();
    return;
  }

  const [analytics, _contactsRaw] = await Promise.all([
    apiGet('/analytics/dashboard'),
    apiGet('/contact?limit=5')
  ]);
  const contacts = Array.isArray(_contactsRaw) ? _contactsRaw : (_contactsRaw?.data || _contactsRaw?.rows || []);

  const projectsTotal = analytics?.projects?.total ?? 0;
  const blogsPublished = analytics?.blogs?.published ?? 0;
  const contactsNew = analytics?.contacts?.new_count ?? 0;
  const mediaTotal = analytics?.media?.total ?? 0;

  const html = `
    <div class="dashboard-stats">
      <div class="stat-card">
        <div class="stat-value">${projectsTotal}</div>
        <div class="stat-label">Total Projects</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${blogsPublished}</div>
        <div class="stat-label">Published Posts</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${contactsNew}</div>
        <div class="stat-label">New Messages</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${mediaTotal}</div>
        <div class="stat-label">Media Files</div>
      </div>
    </div>
    <div class="dashboard-charts">
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Contact Messages Trend</h3>
        </div>
        <canvas id="contacts-chart"></canvas>
      </div>
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Projects by Category</h3>
        </div>
        <canvas id="projects-chart"></canvas>
      </div>
    </div>
    <div class="dashboard-lists">
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Popular Blog Posts</h3>
        </div>
        <div id="popular-posts">
          <!-- Popular posts will be loaded here -->
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Recent Messages</h3>
        </div>
        <div id="recent-messages">
          ${contacts.map(msg => `
            <div class="message-item">
              <div class="message-info">
                <strong>${msg.name}</strong> - ${msg.subject}
                <span class="badge badge-${msg.status}">${msg.status}</span>
              </div>
              <div class="message-date">${new Date(msg.created_at).toLocaleDateString()}</div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
    <div class="dashboard-actions">
      <button class="btn btn-primary" onclick="navigate('projects')">+ New Project</button>
      <button class="btn btn-primary" onclick="navigate('blogs')">+ New Blog Post</button>
      <button class="btn btn-primary" onclick="navigate('media')">+ Upload Media</button>
      <button class="btn btn-primary" onclick="navigate('services')">+ New Service</button>
    </div>
  `;

  mainContent.innerHTML = html;

  // Load charts
  loadContactsChart();
  loadProjectsChart();
  loadPopularPosts();
}

async function loadContactsChart() {
  const data = (await apiGet('/analytics/contacts/trend')) || [];
  const ctxEl = document.getElementById('contacts-chart');
  if (!ctxEl) return;
  const ctx = ctxEl.getContext('2d');

  const data2 = Array.isArray(data) ? data : (data?.data || []);
  const labels = data2.map(d => d.week ? new Date(d.week).toLocaleDateString('en-GB', {day:'numeric',month:'short'}) : (d.date || ''));
  const values = data2.map(d => parseInt(d.count) || 0);

  new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Messages',
        data: values,
        borderColor: 'var(--orange)',
        backgroundColor: 'rgba(232, 98, 26, 0.1)',
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      }
    }
  });
}

async function loadProjectsChart() {
  const data = (await apiGet('/analytics/projects/by-category')) || [];
  const ctxEl = document.getElementById('projects-chart');
  if (!ctxEl) return;
  const ctx = ctxEl.getContext('2d');

  const labels = Array.isArray(data) ? data.map(d => d.category || 'Unknown') : [];
  const values = data2.map(d => parseInt(d.count) || 0);

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Projects',
        data: values,
        backgroundColor: 'var(--navy)',
        borderColor: 'var(--navy)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      }
    }
  });
}

async function loadPopularPosts() {
  const _popRaw = await apiGet('/analytics/blogs/popular');
  const posts = Array.isArray(_popRaw) ? _popRaw : (_popRaw?.data || []);
  const container = document.getElementById('popular-posts');
  if (!container) return;

  const safePosts = Array.isArray(posts) ? posts : [];
  container.innerHTML = safePosts.map(post => `
    <div class="popular-post">
      <div class="post-title">${post.title || 'Untitled'}</div>
      <div class="post-stats">${post.view_count ?? 0} views</div>
    </div>
  `).join('');
}

async function loadMedia() {
  const media = await apiGet('/media?limit=24');
  const html = `
    <div class="media-controls">
      <input type="text" id="media-search" placeholder="Search media...">
      <div class="media-filters">
        <button class="filter-btn active" data-filter="all">All</button>
        <button class="filter-btn" data-filter="image">Images</button>
        <button class="filter-btn" data-filter="video">Videos</button>
        <button class="filter-btn" data-filter="document">Documents</button>
      </div>
      <button class="btn btn-primary" id="upload-media-btn">Upload Files</button>
    </div>
    <div id="media-grid" class="media-grid">
      ${media.map(item => createMediaItemHTML(item)).join('')}
    </div>
    <button id="load-more-media" class="btn btn-secondary">Load More</button>
  `;

  mainContent.innerHTML = html;

  // Re-attach event listeners
  document.getElementById('media-search').addEventListener('input', debounce(searchMedia, 300));
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => filterMedia(btn.dataset.filter));
  });
  document.getElementById('upload-media-btn').addEventListener('click', () => showModal(uploadModal));
  document.getElementById('load-more-media').addEventListener('click', loadMoreMedia);
}

function createMediaItemHTML(item) {
  const isImage = item.type === 'image';
  const isVideo = item.type === 'video';
  return `
    <div class="media-item" data-id="${item.id}">
      ${isImage ? `<img src="${item.public_url}" alt="${item.alt_text || ''}">` : ''}
      ${isVideo ? `<video src="${item.public_url}"></video>` : ''}
      <div class="media-overlay">
        <button class="btn btn-sm" onclick="previewMedia('${item.id}')"><i class="fas fa-eye"></i></button>
        <button class="btn btn-sm" onclick="editMedia('${item.id}')"><i class="fas fa-edit"></i></button>
        <button class="btn btn-sm btn-danger" onclick="deleteMedia('${item.id}')"><i class="fas fa-trash"></i></button>
        <button class="btn btn-sm" onclick="copyMediaUrl('${item.public_url}')"><i class="fas fa-copy"></i></button>
      </div>
      <div class="media-info">
        <div class="media-name">${item.filename}</div>
        <div class="media-meta">${formatFileSize(item.size)} • ${new Date(item.created_at).toLocaleDateString()}</div>
      </div>
    </div>
  `;
}

async function loadServices() {
  const result = await apiGet('/services');
  const services = Array.isArray(result) ? result : (Array.isArray(result?.data) ? result.data : (result?.rows || result?.data || []));
  const html = `
    <div class="page-header">
      <h2>Services Manager</h2>
      <button class="btn btn-primary" id="add-service-btn">+ Add Service</button>
    </div>
    <div class="table-container">
      <table class="table">
        <thead>
          <tr>
            <th>Icon</th>
            <th>Title</th>
            <th>Audience</th>
            <th>Status</th>
            <th>Order</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${services.map(service => `
            <tr>
              <td><img src="${service.icon_media?.public_url || ''}" alt="" style="width: 40px; height: 40px; object-fit: cover; border-radius: 50%;"></td>
              <td>${service.title}</td>
              <td>${service.audience}</td>
              <td><span class="badge badge-${service.status}">${service.status}</span></td>
              <td>${service.sort_order}</td>
              <td>
                <button class="btn btn-sm" onclick="editService('${service.id}')"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-danger" onclick="deleteService('${service.id}')"><i class="fas fa-trash"></i></button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  mainContent.innerHTML = html;
  document.getElementById('add-service-btn').addEventListener('click', () => openServiceForm());
}

async function loadProjects() {
  const result = await apiGet('/projects?limit=20');
  const projects = Array.isArray(result) ? result : (Array.isArray(result?.data) ? result.data : (result?.rows || result?.data || []));
  const html = `
    <div class="page-header">
      <div class="page-controls">
        <input type="text" placeholder="Search projects..." id="project-search">
        <select id="project-category">
          <option value="">All Categories</option>
        </select>
        <select id="project-status">
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
        <label><input type="checkbox" id="project-featured"> Featured only</label>
      </div>
      <div class="view-toggle">
        <button class="btn btn-sm" id="table-view">Table</button>
        <button class="btn btn-sm" id="card-view">Cards</button>
      </div>
      <button class="btn btn-primary" id="add-project-btn">+ New Project</button>
    </div>
    <div id="projects-container">
      <!-- Projects will be loaded here -->
    </div>
  `;

  mainContent.innerHTML = html;

  // Load categories
  const categoriesResponse = await apiGet('/projects/categories');
  const categories = categoriesResponse && categoriesResponse.data ? categoriesResponse.data : categoriesResponse;
  const categorySelect = document.getElementById('project-category');
  categories.forEach(cat => {
    categorySelect.innerHTML += `<option value="${cat}">${cat}</option>`;
  });

  // Load projects
  renderProjects(projects);

  // Event listeners
  document.getElementById('add-project-btn').addEventListener('click', () => openProjectForm());
  document.getElementById('table-view').addEventListener('click', () => renderProjectsTable(projects));
  document.getElementById('card-view').addEventListener('click', () => renderProjectsCards(projects));
}

function renderProjects(projects) {
  renderProjectsTable(projects);
}

function renderProjectsTable(projects) {
  const html = `
    <table class="table">
      <thead>
        <tr>
          <th>Cover</th>
          <th>Title</th>
          <th>Category</th>
          <th>Location</th>
          <th>Status</th>
          <th>Featured</th>
          <th>Date</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${projects.map(project => `
          <tr>
            <td><img src="${project.cover_media?.public_url || ''}" alt="" style="width: 60px; height: 40px; object-fit: cover;"></td>
            <td>${project.title}</td>
            <td>${project.category}</td>
            <td>${project.location}</td>
            <td><span class="badge badge-${project.publish_status}">${project.publish_status}</span></td>
            <td>${project.is_featured ? 'Yes' : 'No'}</td>
            <td>${new Date(project.created_at).toLocaleDateString()}</td>
            <td>
              <button class="btn btn-sm" onclick="editProject('${project.id}')"><i class="fas fa-edit"></i></button>
              <button class="btn btn-sm btn-danger" onclick="deleteProject('${project.id}')"><i class="fas fa-trash"></i></button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  document.getElementById('projects-container').innerHTML = html;
}

function renderProjectsCards(projects) {
  const html = `
    <div class="projects-grid">
      ${projects.map(project => `
        <div class="project-card">
          <img src="${project.cover_media?.public_url || ''}" alt="">
          <div class="project-info">
            <h3>${project.title}</h3>
            <p>${project.location}</p>
            <div class="project-actions">
              <button class="btn btn-sm" onclick="editProject('${project.id}')">Edit</button>
              <button class="btn btn-sm btn-danger" onclick="deleteProject('${project.id}')">Delete</button>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
  document.getElementById('projects-container').innerHTML = html;
}

async function loadBlogs() {
  const [posts, categories] = await Promise.all([
    apiGet('/blogs?limit=20'),
    apiGet('/blogs/categories')
  ]);

  const html = `
    <div class="blog-tabs">
      <button class="tab-btn active" data-tab="posts">Posts</button>
      <button class="tab-btn" data-tab="categories">Categories</button>
    </div>
    <div id="blog-content">
      <!-- Blog content will be loaded here -->
    </div>
  `;

  mainContent.innerHTML = html;

  // Load posts tab by default
  renderBlogPosts(posts);

  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (btn.dataset.tab === 'posts') {
        renderBlogPosts(posts);
      } else {
        renderBlogCategories(categories);
      }
    });
  });
}

function renderBlogPosts(posts) {
  const html = `
    <div class="page-header">
      <h2>Blog Posts</h2>
      <button class="btn btn-primary" id="add-post-btn">+ New Post</button>
    </div>
    <table class="table">
      <thead>
        <tr>
          <th>Cover</th>
          <th>Title</th>
          <th>Category</th>
          <th>Status</th>
          <th>Views</th>
          <th>Date</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${posts.map(post => `
          <tr>
            <td><img src="${post.cover_media?.public_url || ''}" alt="" style="width: 60px; height: 40px; object-fit: cover;"></td>
            <td>${post.title}</td>
            <td>${post.category?.name || ''}</td>
            <td><span class="badge badge-${post.status}">${post.status}</span></td>
            <td>${post.view_count || 0}</td>
            <td>${new Date(post.created_at).toLocaleDateString()}</td>
            <td>
              <button class="btn btn-sm" onclick="editBlogPost('${post.id}')"><i class="fas fa-edit"></i></button>
              <button class="btn btn-sm btn-danger" onclick="deleteBlogPost('${post.id}')"><i class="fas fa-trash"></i></button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  document.getElementById('blog-content').innerHTML = html;
  document.getElementById('add-post-btn').addEventListener('click', () => openBlogForm());
}

function renderBlogCategories(categories) {
  const html = `
    <div class="page-header">
      <h2>Blog Categories</h2>
      <button class="btn btn-primary" id="add-category-btn">+ Add Category</button>
    </div>
    <div class="categories-list">
      ${categories.map(cat => `
        <div class="category-item">
          <span>${cat.name}</span>
          <button class="btn btn-sm btn-danger" onclick="deleteBlogCategory('${cat.id}')"><i class="fas fa-trash"></i></button>
        </div>
      `).join('')}
    </div>
  `;

  document.getElementById('blog-content').innerHTML = html;
  document.getElementById('add-category-btn').addEventListener('click', () => openCategoryForm());
}

async function loadTestimonials() {
  const _testiResult = await apiGet('/testimonials');
  const testimonials = Array.isArray(_testiResult) ? _testiResult : (Array.isArray(_testiResult?.data) ? _testiResult.data : (_testiResult?.rows || _testiResult?.data || []));
  const html = `
    <div class="page-header">
      <h2>Testimonials</h2>
      <button class="btn btn-primary" id="add-testimonial-btn">+ Add Testimonial</button>
    </div>
    <div class="testimonials-grid">
      ${testimonials.map(testimonial => `
        <div class="testimonial-card">
          <div class="testimonial-header">
            <img src="${testimonial.avatar?.public_url || ''}" alt="" class="testimonial-avatar">
            <div>
              <h4>${testimonial.client_name}</h4>
              <p>${testimonial.client_role}</p>
            </div>
          </div>
          <div class="testimonial-rating">
            ${'★'.repeat(testimonial.rating)}${'☆'.repeat(5 - testimonial.rating)}
          </div>
          <p class="testimonial-text">${testimonial.body}</p>
          <div class="testimonial-actions">
            <button class="btn btn-sm" onclick="editTestimonial('${testimonial.id}')">Edit</button>
            <button class="btn btn-sm btn-danger" onclick="deleteTestimonial('${testimonial.id}')">Delete</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  mainContent.innerHTML = html;
  document.getElementById('add-testimonial-btn').addEventListener('click', () => openTestimonialForm());
}

async function loadTeam() {
  const team = await apiGet('/team');
  const html = `
    <div class="page-header">
      <h2>Team Members</h2>
      <button class="btn btn-primary" id="add-member-btn">+ Add Member</button>
    </div>
    <div class="team-grid">
      ${team.map(member => `
        <div class="team-card">
          <img src="${member.photo?.public_url || ''}" alt="" class="team-photo">
          <h3>${member.name}</h3>
          <p>${member.role_title}</p>
          <p>${member.bio}</p>
          <div class="team-actions">
            <button class="btn btn-sm" onclick="editTeamMember('${member.id}')">Edit</button>
            <button class="btn btn-sm btn-danger" onclick="deleteTeamMember('${member.id}')">Delete</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  mainContent.innerHTML = html;
  document.getElementById('add-member-btn').addEventListener('click', () => openTeamForm());
}

async function loadPartners() {
  const _partResult = await apiGet('/partners');
  const partners = Array.isArray(_partResult) ? _partResult : (Array.isArray(_partResult?.data) ? _partResult.data : (_partResult?.rows || _partResult?.data || []));
  const html = `
    <div class="page-header">
      <h2>Partners</h2>
      <button class="btn btn-primary" id="add-partner-btn">+ Add Partner</button>
    </div>
    <div class="partners-list">
      ${partners.map(partner => `
        <div class="partner-item">
          <img src="${partner.logo?.public_url || ''}" alt="" class="partner-logo">
          <div class="partner-info">
            <h4>${partner.name}</h4>
            <a href="${partner.website_url}" target="_blank">${partner.website_url}</a>
          </div>
          <div class="partner-actions">
            <button class="btn btn-sm" onclick="editPartner('${partner.id}')">Edit</button>
            <button class="btn btn-sm btn-danger" onclick="deletePartner('${partner.id}')">Delete</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  mainContent.innerHTML = html;
  document.getElementById('add-partner-btn').addEventListener('click', () => openPartnerForm());
}

async function loadMessages() {
  const [stats, messages] = await Promise.all([
    apiGet('/contact/stats'),
    apiGet('/contact?limit=20')
  ]);

  const html = `
    <div class="messages-stats">
      <div class="stat-card">
        <div class="stat-value">${stats.new_count}</div>
        <div class="stat-label">New Messages</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.read_count}</div>
        <div class="stat-label">Read</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.replied_count}</div>
        <div class="stat-label">Replied</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.last_7_days}</div>
        <div class="stat-label">Last 7 Days</div>
      </div>
    </div>
    <div class="messages-filters">
      <button class="filter-btn active" data-status="all">All</button>
      <button class="filter-btn" data-status="new">New</button>
      <button class="filter-btn" data-status="read">Read</button>
      <button class="filter-btn" data-status="replied">Replied</button>
      <button class="filter-btn" data-status="archived">Archived</button>
    </div>
    <div class="messages-list">
      ${messages.map(msg => `
        <div class="message-item" onclick="openMessageDetail('${msg.id}')">
          <div class="message-header">
            <strong>${msg.name}</strong> <span class="message-email">${msg.email}</span>
            <span class="badge badge-${msg.status}">${msg.status}</span>
          </div>
          <div class="message-subject">${msg.subject}</div>
          <div class="message-date">${new Date(msg.created_at).toLocaleDateString()}</div>
        </div>
      `).join('')}
    </div>
  `;

  mainContent.innerHTML = html;

  // Filter event listeners
  document.querySelectorAll('.filter-btn[data-status]').forEach(btn => {
    btn.addEventListener('click', () => filterMessages(btn.dataset.status));
  });
}

async function loadSettings() {
  try {
    const result = await apiGet('/settings');
    const settingsData = result?.list || result?.data?.list || (Array.isArray(result) ? result : []);
    const settingsMap = result?.map || result?.data?.map || {};

    // Group by group_name
    const groups = {};
    settingsData.forEach(s => {
      const g = s.group_name || 'general';
      if (!groups[g]) groups[g] = [];
      groups[g].push(s);
    });

    const groupOrder = ['general', 'contact', 'social', 'appearance', 'seo', 'stats'];
    const allGroups = [...new Set([...groupOrder, ...Object.keys(groups)])].filter(g => groups[g]);

    const html = `
      <div class="page-header">
        <h2>Site Settings</h2>
        <button class="btn btn-primary" onclick="saveSettings()">💾 Save All Settings</button>
      </div>
      ${allGroups.map(groupName => `
        <div class="card" style="margin-bottom:1.5rem;">
          <div class="card-header">
            <h3 class="card-title" style="text-transform:capitalize;">${groupName} Settings</h3>
          </div>
          <div style="padding:1.5rem;display:grid;gap:1rem;">
            ${(groups[groupName] || []).map(s => `
              <div class="form-group">
                <label style="font-weight:700;font-size:12px;text-transform:uppercase;color:var(--text-muted);margin-bottom:6px;display:block;">${s.label || s.key}</label>
                <input
                  type="text"
                  class="form-control"
                  id="setting-${s.key}"
                  data-setting-key="${s.key}"
                  value="${(s.value || '').replace(/"/g, '&quot;')}"
                  style="width:100%;padding:10px 14px;border:2px solid var(--border);border-radius:6px;font-size:14px;box-sizing:border-box;">
              </div>
            `).join('')}
          </div>
          <div style="padding:0 1.5rem 1.5rem;">
            <button class="btn btn-primary" onclick="saveGroupSettings('${groupName}')">Save ${groupName.charAt(0).toUpperCase() + groupName.slice(1)}</button>
          </div>
        </div>
      `).join('')}
    `;

    mainContent.innerHTML = html;
  } catch (err) {
    console.error('Settings load error:', err);
    showToast('Failed to load settings: ' + err.message, 'error');
    mainContent.innerHTML = `<div class="card"><p style="color:var(--danger)">Failed to load settings: ${err.message}</p></div>`;
  }
}

async function saveGroupSettings(groupName) {
  try {
    const inputs = document.querySelectorAll(`[data-setting-key]`);
    const settings = Array.from(inputs)
      .filter(input => {
        // Only save inputs from this group if we know it
        return true; // save all for simplicity
      })
      .map(input => ({
        key: input.getAttribute('data-setting-key'),
        value: input.value,
        group_name: groupName
      }))
      .filter(s => s.key);

    await apiPut('/settings', { settings });
    showToast('Settings saved!', 'success');
  } catch (err) {
    showToast('Failed: ' + err.message, 'error');
  }
}


function renderSettingsGroup(group, settings) {
  const html = `
    <form id="settings-form" class="settings-form">
      ${settings.map(setting => `
        <div class="form-group">
          <label>${setting.label}</label>
          ${renderSettingField(setting)}
        </div>
      `).join('')}
      <button type="submit" class="btn btn-primary">Save Settings</button>
    </form>
  `;

  document.getElementById('settings-content').innerHTML = html;

  // Form submit
  document.getElementById('settings-form').addEventListener('submit', (e) => saveSettings(e, group, settings));
}

function renderSettingField(setting) {
  switch (setting.type) {
    case 'text':
      return `<input type="text" value="${setting.value || ''}" data-key="${setting.key}">`;
    case 'number':
      return `<input type="number" value="${setting.value || ''}" data-key="${setting.key}">`;
    case 'boolean':
      return `<label class="toggle-switch">
        <input type="checkbox" ${setting.value === 'true' ? 'checked' : ''} data-key="${setting.key}">
        <span class="toggle-slider"></span>
      </label>`;
    case 'media_ref':
      return `<div class="media-picker-field">
        <input type="text" value="${setting.media?.public_url || ''}" readonly data-key="${setting.key}">
        <button type="button" class="btn btn-sm" onclick="pickMediaForSetting('${setting.key}')">Choose Media</button>
      </div>`;
    default:
      return `<textarea data-key="${setting.key}">${setting.value || ''}</textarea>`;
  }
}

async function loadUsers() {
  if (currentUser.role !== 'super_admin') {
    mainContent.innerHTML = '<div class="card"><p>Access denied</p></div>';
    return;
  }

  const users = await apiGet('/users');
  const html = `
    <div class="page-header">
      <h2>Users</h2>
      <button class="btn btn-primary" id="add-user-btn">+ Invite User</button>
    </div>
    <table class="table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Email</th>
          <th>Role</th>
          <th>Status</th>
          <th>Last Login</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${users.map(user => `
          <tr>
            <td>${user.name}</td>
            <td>${user.email}</td>
            <td><span class="badge badge-${user.role}">${user.role}</span></td>
            <td>${user.is_active ? 'Active' : 'Inactive'}</td>
            <td>${user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}</td>
            <td>
              <button class="btn btn-sm" onclick="editUser('${user.id}')">Edit</button>
              <button class="btn btn-sm btn-danger" onclick="deleteUser('${user.id}')">Delete</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  mainContent.innerHTML = html;
  document.getElementById('add-user-btn').addEventListener('click', () => openUserForm());
}

async function loadAI() {
  const conversations = await apiGet('/ai/conversations');
  const html = `
    <div class="page-header">
      <h2>AI Conversations</h2>
    </div>
    <table class="table">
      <thead>
        <tr>
          <th>Session Key</th>
          <th>Locale</th>
          <th>Messages</th>
          <th>Started</th>
          <th>Last Active</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${conversations.map(conv => `
          <tr>
            <td>${conv.session_key}</td>
            <td>${conv.locale}</td>
            <td>${conv.message_count}</td>
            <td>${new Date(conv.created_at).toLocaleDateString()}</td>
            <td>${new Date(conv.updated_at).toLocaleDateString()}</td>
            <td>
              <button class="btn btn-sm" onclick="viewConversation('${conv.id}')">View</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  mainContent.innerHTML = html;
}

// Utility Functions
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
    <span class="toast-message">${message}</span>
    <button class="toast-close">
      <i class="fas fa-times"></i>
    </button>
  `;

  toastContainer.appendChild(toast);

  // Auto remove after 4 seconds
  setTimeout(() => {
    toast.remove();
  }, 4000);

  // Close button
  toast.querySelector('.toast-close').addEventListener('click', () => toast.remove());
}

function showModal(modal) {
  modal.classList.remove('hidden');
}

function hideModal(modal = null) {
  if (modal) {
    modal.classList.add('hidden');
  } else {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
  }
}

function closeModal() {
  hideModal();
}

function confirmDialog(message, title = 'Confirm Action') {
  return new Promise((resolve) => {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    showModal(confirmModal);

    const handleConfirm = () => {
      hideModal(confirmModal);
      document.getElementById('confirm-ok').removeEventListener('click', handleConfirm);
      document.getElementById('confirm-cancel').removeEventListener('click', handleCancel);
      resolve(true);
    };

    const handleCancel = () => {
      hideModal(confirmModal);
      document.getElementById('confirm-ok').removeEventListener('click', handleConfirm);
      document.getElementById('confirm-cancel').removeEventListener('click', handleCancel);
      resolve(false);
    };

    document.getElementById('confirm-ok').addEventListener('click', handleConfirm);
    document.getElementById('confirm-cancel').addEventListener('click', handleCancel);
  });
}

function openMediaPicker(callback, multiSelect = false) {
  mediaPickerCallback = callback;
  isMultiSelect = multiSelect;
  selectedMedia = [];
  loadMediaPicker();
  showModal(mediaPickerModal);
}

function loadMediaPicker() {
  // This would load media for picker - simplified
  document.getElementById('media-grid').innerHTML = '<div class="skeleton skeleton-card"></div>'.repeat(6);
  // In real implementation, load media from API
}

function selectMedia() {
  if (mediaPickerCallback) {
    mediaPickerCallback(selectedMedia);
  }
  hideModal(mediaPickerModal);
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Services CRUD
async function openServiceForm(service = null) {
  const isEdit = !!service;
  const title = isEdit ? 'Edit Service' : 'Add New Service';

  const html = `
    <div class="form-header">
      <h3>${title}</h3>
      <button class="btn-close" onclick="closeFullScreenForm()">&times;</button>
    </div>
    <form id="service-form" class="form-content">
      <div class="form-row">
        <div class="form-group">
          <label for="service-title">Title *</label>
          <input type="text" id="service-title" value="${service?.title || ''}" required>
        </div>
        <div class="form-group">
          <label for="service-slug">Slug</label>
          <input type="text" id="service-slug" value="${service?.slug || ''}" placeholder="auto-filled">
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="service-audience">Audience *</label>
          <select id="service-audience" required>
            <option value="">Select Audience</option>
            <option value="all" ${service?.audience === 'all' ? 'selected' : ''}>All</option>
            <option value="individual" ${service?.audience === 'individual' ? 'selected' : ''}>Individual</option>
            <option value="company" ${service?.audience === 'company' ? 'selected' : ''}>Company</option>
            <option value="government" ${service?.audience === 'government' ? 'selected' : ''}>Government</option>
          </select>
        </div>
      </div>

      <div class="form-group">
        <label for="service-short-desc">Short Description</label>
        <textarea id="service-short-desc" rows="2">${service?.short_desc || ''}</textarea>
      </div>

      <div class="form-group">
        <label for="service-full-desc">Full Description</label>
        <textarea id="service-full-desc" rows="6">${service?.full_desc || ''}</textarea>
      </div>

      <div class="form-group">
        <label for="service-features">Features</label>
        ${buildTagInput(service?.features || [], 'Add features...')}
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="service-icon">Icon</label>
          <div class="media-picker-field">
            <input type="text" id="service-icon-url" value="${service?.icon_media?.public_url || ''}" readonly>
            <button type="button" class="btn btn-sm" onclick="openMediaPicker((media) => {
              document.getElementById('service-icon-url').value = media[0]?.public_url || '';
              document.getElementById('service-icon-id').value = media[0]?.id || '';
            })">Choose Icon</button>
            <input type="hidden" id="service-icon-id" value="${service?.icon_media_id || ''}">
          </div>
        </div>
        <div class="form-group">
          <label for="service-sort-order">Sort Order</label>
          <input type="number" id="service-sort-order" value="${service?.sort_order || 0}" min="0">
        </div>
      </div>

      <div class="form-group">
        <label for="service-status">Status</label>
        <select id="service-status">
          <option value="published" ${service?.status === 'published' ? 'selected' : ''}>Published</option>
          <option value="draft" ${service?.status === 'draft' ? 'selected' : ''}>Draft</option>
        </select>
      </div>

      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="closeFullScreenForm()">Cancel</button>
        <button type="submit" class="btn btn-primary">${isEdit ? 'Update' : 'Create'} Service</button>
      </div>
    </form>
  `;

  fullScreenForm.innerHTML = html;
  fullScreenForm.classList.remove('hidden');

  // Auto-fill slug from title
  const titleInput = document.getElementById('service-title');
  titleInput.addEventListener('input', () => {
    const slugInput = document.getElementById('service-slug');
    if (slugInput) slugInput.value = toSlug(titleInput.value);
  });

  document.getElementById('service-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveService(isEdit ? service.id : null);
  });
}

async function saveService(serviceId = null) {
  try {
    const titleEl = document.getElementById('service-title');
    const slugEl = document.getElementById('service-slug');
    const shortDescEl = document.getElementById('service-short-desc');
    const fullDescEl = document.getElementById('service-full-desc');
    const audienceEl = document.getElementById('service-audience');
    const statusEl = document.getElementById('service-status');
    const sortOrderEl = document.getElementById('service-sort-order');
    
    if (!titleEl || !titleEl.value.trim()) {
      showToast('Title is required', 'error');
      return;
    }
    if (!audienceEl || !audienceEl.value) {
      showToast('Audience is required', 'error');
      return;
    }
    
    const features = Array.from(document.querySelectorAll('#service-features .tag')).map(tag => tag.textContent.replace('×', '').trim()) || [];
    
    const data = {
      title: titleEl.value.trim(),
      slug: (slugEl.value.trim() || toSlug(titleEl.value)).toLowerCase(),
      short_desc: shortDescEl ? shortDescEl.value.trim() : '',
      full_desc: fullDescEl ? fullDescEl.value.trim() : '',
      audience: audienceEl.value,
      status: statusEl ? statusEl.value : 'published',
      sort_order: sortOrderEl ? parseInt(sortOrderEl.value) || 0 : 0,
      features: features.filter(f => f.length > 0)
    };
    
    let response;
    if (serviceId) {
      response = await apiPut(`/services/${serviceId}`, data);
      showToast('✅ Service updated successfully!', 'success');
    } else {
      response = await apiPost('/services', data);
      showToast('✅ Service created successfully!', 'success');
    }
    
    setTimeout(() => {
      closeFullScreenForm();
      loadServices();
    }, 300);
  } catch (error) {
    console.error('Service save error:', error);
    showToast(`❌ Failed to save service: ${error.message || 'Unknown error'}`, 'error');
  }
}

// Projects CRUD
async function openProjectForm(project = null) {
  const isEdit = !!project;
  const title = isEdit ? 'Edit Project' : 'Add New Project';

  // Load categories for the dropdown
  let categories = [];
  try {
    categories = await apiGet('/projects/categories');
  } catch (error) {
    console.warn('Failed to load categories:', error);
  }

  const categoryOptions = categories.map(cat => `<option value="${cat}" ${project?.category === cat ? 'selected' : ''}>${cat}</option>`).join('');

  const html = `
    <div class="form-header">
      <h3>${title}</h3>
      <button class="btn-close" onclick="closeFullScreenForm()">&times;</button>
    </div>
    <form id="project-form" class="form-content">
      <div class="form-row">
        <div class="form-group">
          <label for="project-title">Title *</label>
          <input type="text" id="project-title" value="${project?.title || ''}" required>
        </div>
        <div class="form-group">
          <label for="project-category">Category *</label>
          <select id="project-category" required>
            <option value="">Select Category</option>
            ${categoryOptions}
          </select>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="project-location">Location *</label>
          <input type="text" id="project-location" value="${project?.location || ''}" required>
        </div>
        <div class="form-group">
          <label for="project-completion-date">Completion Date</label>
          <input type="date" id="project-completion-date" value="${project?.completion_date ? new Date(project.completion_date).toISOString().split('T')[0] : ''}">
        </div>
      </div>

      <div class="form-group">
        <label for="project-description">Description *</label>
        <textarea id="project-description" rows="4" required>${project?.description || ''}</textarea>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="project-cover">Cover Image</label>
          <div class="media-picker-field">
            <input type="text" id="project-cover-url" value="${project?.cover_media?.public_url || ''}" readonly>
            <button type="button" class="btn btn-sm" onclick="openMediaPicker((media) => {
              document.getElementById('project-cover-url').value = media[0]?.public_url || '';
              document.getElementById('project-cover-id').value = media[0]?.id || '';
            })">Choose Image</button>
            <input type="hidden" id="project-cover-id" value="${project?.cover_media_id || ''}">
          </div>
        </div>
        <div class="form-group">
          <label for="project-status">Status</label>
          <select id="project-status">
            <option value="draft" ${project?.publish_status === 'draft' ? 'selected' : ''}>Draft</option>
            <option value="published" ${project?.publish_status === 'published' ? 'selected' : ''}>Published</option>
            <option value="archived" ${project?.publish_status === 'archived' ? 'selected' : ''}>Archived</option>
          </select>
        </div>
      </div>

      <div class="form-group">
        <label class="checkbox-label">
          <input type="checkbox" id="project-featured" ${project?.is_featured ? 'checked' : ''}>
          Featured Project
        </label>
      </div>

      <div class="form-group">
        <label for="project-gallery">Gallery Images</label>
        <div id="project-gallery" class="gallery-preview">
          ${project?.gallery?.map(img => `
            <div class="gallery-item">
              <img src="${img.public_url}" alt="">
              <button type="button" onclick="removeGalleryImage(this, ${img.id})">&times;</button>
            </div>
          `).join('') || ''}
        </div>
        <button type="button" class="btn btn-sm" onclick="openMediaPicker((media) => addGalleryImages(media), true)">Add Images</button>
      </div>

      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="closeFullScreenForm()">Cancel</button>
        <button type="submit" class="btn btn-primary">${isEdit ? 'Update' : 'Create'} Project</button>
      </div>
    </form>
  `;

  fullScreenForm.innerHTML = html;
  fullScreenForm.classList.remove('hidden');

  document.getElementById('project-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveProject(isEdit ? project.id : null);
  });
}

async function saveProject(projectId = null) {
  const tags = Array.from(document.querySelectorAll('#project-tags .tag')).map(tag => tag.textContent.replace('×', '').trim());
  const galleryImages = Array.from(document.querySelectorAll('#project-gallery .gallery-item')).map(item => item.dataset.id);

  const data = {
    title: document.getElementById('project-title').value,
    slug: document.getElementById('project-slug').value || toSlug(document.getElementById('project-title').value),
    short_desc: document.getElementById('project-short-desc').value,
    full_desc: document.getElementById('project-full-desc').value,
    category: document.getElementById('project-category').value,
    audience: document.getElementById('project-audience').value,
    location: document.getElementById('project-location').value,
    client_name: document.getElementById('project-client-name').value,
    client_type: document.getElementById('project-client-type').value,
    status: document.getElementById('project-status').value,
    publish_status: document.getElementById('project-publish-status').value,
    is_featured: document.getElementById('project-featured').checked,
    started_at: document.getElementById('project-start-date').value || null,
    completed_at: document.getElementById('project-completion-date').value || null,
    duration_months: parseInt(document.getElementById('project-duration').value) || null,
    budget_low: parseFloat(document.getElementById('project-budget-low').value) || null,
    budget_high: parseFloat(document.getElementById('project-budget-high').value) || null,
    area_sqm: parseFloat(document.getElementById('project-area').value) || null,
    floors: parseInt(document.getElementById('project-floors').value) || null,
    cover_media_id: document.getElementById('project-cover-id').value || null,
    sort_order: parseInt(document.getElementById('project-sort').value) || 0,
    tags: tags,
    meta_description: document.getElementById('project-meta').value
  };

  try {
    if (projectId) {
      await apiPut(`/projects/${projectId}`, data);
      showToast('Project updated successfully', 'success');
    } else {
      await apiPost('/projects', data);
      showToast('Project created successfully', 'success');
    }
    closeFullScreenForm();
    await loadProjects();
  } catch (error) {
    showToast(`Failed to ${projectId ? 'update' : 'create'} project: ${error.message}`, 'error');
  }
}

function addGalleryImages(media) {
  const gallery = document.getElementById('project-gallery');
  media.forEach(item => {
    const div = document.createElement('div');
    div.className = 'gallery-item';
    div.dataset.id = item.id;
    div.innerHTML = `
      <img src="${item.public_url}" alt="">
      <button type="button" onclick="removeGalleryImage(this, ${item.id})">&times;</button>
    `;
    gallery.appendChild(div);
  });
}

function removeGalleryImage(button, id) {
  button.closest('.gallery-item').remove();
}

async function editProject(id) {
  try {
    const project = await apiGet(`/projects/${id}`);
    openProjectForm(project);
  } catch (error) {
    showToast('Failed to load project: ' + error.message, 'error');
  }
}

async function deleteProject(id) {
  const confirmed = await confirmDialog('Are you sure you want to delete this project?');
  if (!confirmed) return;

  try {
    await apiDelete(`/projects/${id}`);
    showToast('Project deleted successfully', 'success');
    await loadProjects();
  } catch (error) {
    showToast('Failed to delete project: ' + error.message, 'error');
  }
}

async function editService(id) {
  try {
    const service = await apiGet(`/services/${id}`);
    openServiceForm(service);
  } catch (error) {
    showToast('Failed to load service: ' + error.message, 'error');
  }
}

async function deleteService(id) {
  const confirmed = await confirmDialog('Are you sure you want to delete this service?');
  if (!confirmed) return;

  try {
    await apiDelete(`/services/${id}`);
    showToast('Service deleted successfully', 'success');
    await loadServices();
  } catch (error) {
    showToast('Failed to delete service: ' + error.message, 'error');
  }
}

// Shared Helper Functions
function toSlug(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildStarRating(rating, maxRating = 5, interactive = false) {
  const stars = [];
  for (let i = 1; i <= maxRating; i++) {
    const starClass = i <= rating ? 'fas fa-star' : 'far fa-star';
    if (interactive) {
      stars.push(`<i class="${starClass}" data-rating="${i}" onclick="setStarRating(this, ${i})"></i>`);
    } else {
      stars.push(`<i class="${starClass}"></i>`);
    }
  }
  return `<div class="star-rating">${stars.join('')}</div>`;
}

function buildTagInput(tags = [], placeholder = 'Add tags...') {
  const tagHtml = tags.map(tag => `
    <span class="tag">
      ${tag}
      <button type="button" onclick="removeTag(this, '${tag}')">&times;</button>
    </span>
  `).join('');

  return `
    <div class="tag-input-container">
      <div class="tags">${tagHtml}</div>
      <input type="text" class="tag-input" placeholder="${placeholder}" onkeydown="handleTagInput(event)">
    </div>
  `;
}

function setStarRating(element, rating) {
  const container = element.closest('.star-rating');
  const stars = container.querySelectorAll('i');
  stars.forEach((star, index) => {
    star.className = index < rating ? 'fas fa-star' : 'far fa-star';
  });
  // Update hidden input
  const hiddenInput = container.nextElementSibling;
  if (hiddenInput && hiddenInput.type === 'hidden') {
    hiddenInput.value = rating;
  }
}

function removeTag(button, tag) {
  button.closest('.tag').remove();
}

function handleTagInput(event) {
  if (event.key === 'Enter' || event.key === ',') {
    event.preventDefault();
    const input = event.target;
    const tag = input.value.trim();
    if (tag) {
      const tagsContainer = input.previousElementSibling;
      const tagElement = document.createElement('span');
      tagElement.className = 'tag';
      tagElement.innerHTML = `${tag}<button type="button" onclick="removeTag(this, '${tag.replace(/'/g, "\\'")}')">&times;</button>`;
      tagsContainer.appendChild(tagElement);
      input.value = '';
    }
  }
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Blog CRUD
async function openBlogForm(post = null) {
  const isEdit = !!post;
  const title = isEdit ? 'Edit Blog Post' : 'Add New Blog Post';

  // Load categories
  let categories = [];
  try {
    categories = await apiGet('/blogs/categories');
  } catch (error) {
    console.warn('Failed to load blog categories:', error);
  }

  const categoryOptions = categories.map(cat => `<option value="${cat.id}" ${post?.category?.id === cat.id ? 'selected' : ''}>${cat.name}</option>`).join('');

  const html = `
    <div class="form-header">
      <h3>${title}</h3>
      <button class="btn-close" onclick="closeFullScreenForm()">&times;</button>
    </div>
    <form id="blog-form" class="form-content">
      <div class="form-row">
        <div class="form-group">
          <label for="blog-title">Title *</label>
          <input type="text" id="blog-title" value="${post?.title || ''}" required>
        </div>
        <div class="form-group">
          <label for="blog-slug">Slug</label>
          <input type="text" id="blog-slug" value="${post?.slug || ''}" placeholder="auto-filled">
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="blog-category">Category
            <button type="button" class="btn btn-sm" id="add-category-btn" style="margin-left: 10px;">+ Add Category</button>
          </label>
          <select id="blog-category">
            <option value="">Select Category</option>
            ${categoryOptions}
          </select>
        </div>
        <div class="form-group">
          <label for="blog-read-time">Read Time (minutes)</label>
          <input type="number" id="blog-read-time" value="${post?.read_time_min || ''}" min="1">
        </div>
      </div>

      <div class="form-group">
        <label for="blog-excerpt">Excerpt</label>
        <textarea id="blog-excerpt" rows="3" placeholder="Brief summary of the post">${post?.excerpt || ''}</textarea>
      </div>

      <div class="form-group">
        <label for="blog-content">Content *</label>
        <div id="blog-editor" class="editor-container">
          <div id="toolbar">
            <button type="button" class="ql-bold">Bold</button>
            <button type="button" class="ql-italic">Italic</button>
            <button type="button" class="ql-underline">Underline</button>
            <button type="button" class="ql-list" value="ordered">Ordered List</button>
            <button type="button" class="ql-list" value="bullet">Bullet List</button>
            <button type="button" class="ql-link">Link</button>
            <button type="button" class="ql-image">Image</button>
          </div>
          <div id="editor">${post?.content || ''}</div>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="blog-cover">Cover Image</label>
          <div class="media-picker-field">
            <input type="text" id="blog-cover-url" value="${post?.cover_media?.public_url || ''}" readonly>
            <button type="button" class="btn btn-sm" onclick="openMediaPicker((media) => {
              document.getElementById('blog-cover-url').value = media[0]?.public_url || '';
              document.getElementById('blog-cover-id').value = media[0]?.id || '';
            })">Choose Image</button>
            <input type="hidden" id="blog-cover-id" value="${post?.cover_media_id || ''}">
          </div>
        </div>
        <div class="form-group">
          <label for="blog-status">Status</label>
          <select id="blog-status">
            <option value="draft" ${post?.status === 'draft' ? 'selected' : ''}>Draft</option>
            <option value="published" ${post?.status === 'published' ? 'selected' : ''}>Published</option>
            <option value="archived" ${post?.status === 'archived' ? 'selected' : ''}>Archived</option>
          </select>
        </div>
      </div>

      <div class="form-group">
        <label for="blog-tags">Tags</label>
        ${buildTagInput(post?.tags || [], 'Add tags...')}
      </div>

      <div class="form-group">
        <label for="blog-meta">Meta Description</label>
        <textarea id="blog-meta" rows="2" maxlength="160">${post?.meta_description || ''}</textarea>
        <small>Max 160 characters</small>
      </div>

      <div class="form-group">
        <label class="checkbox-label">
          <input type="checkbox" id="blog-featured" ${post?.is_featured ? 'checked' : ''}>
          Featured Post
        </label>
      </div>

      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="closeFullScreenForm()">Cancel</button>
        <button type="submit" class="btn btn-primary">${isEdit ? 'Update' : 'Create'} Post</button>
      </div>
    </form>
  `;

  fullScreenForm.innerHTML = html;
  fullScreenForm.classList.remove('hidden');

  // Initialize Quill editor
  const quill = new Quill('#editor', {
    theme: 'snow',
    modules: {
      toolbar: '#toolbar'
    }
  });

  // Auto-fill slug from title
  const blogTitleInput = document.getElementById('blog-title');
  const blogSlugInput = document.getElementById('blog-slug');
  blogTitleInput.addEventListener('input', () => {
    blogSlugInput.value = toSlug(blogTitleInput.value);
  });

  // Add category button
  document.getElementById('add-category-btn').addEventListener('click', async (e) => {
    e.preventDefault();
    const categoryName = prompt('Enter new category name:');
    if (categoryName) {
      try {
        await apiPost('/blogs/categories', { name: categoryName });
        showToast('Category added successfully', 'success');
        // Reload blog form to show new category
        closeFullScreenForm();
        await openBlogForm(post);
      } catch (error) {
        showToast('Failed to add category: ' + error.message, 'error');
      }
    }
  });

  document.getElementById('blog-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveBlogPost(isEdit ? post.id : null, quill);
  });
}

async function saveBlogPost(postId = null, quill) {
  try {
    const titleEl = document.getElementById('blog-title');
    const excerptEl = document.getElementById('blog-excerpt');
    const categoryEl = document.getElementById('blog-category');
    
    if (!titleEl || !titleEl.value.trim()) {
      showToast('Title is required', 'error');
      return;
    }
    if (!excerptEl || !excerptEl.value.trim()) {
      showToast('Excerpt is required', 'error');
      return;
    }
    if (!quill || !quill.root.innerHTML.trim()) {
      showToast('Blog body is required', 'error');
      return;
    }
    if (!categoryEl || !categoryEl.value) {
      showToast('Category is required', 'error');
      return;
    }
    
    const tags = Array.from(document.querySelectorAll('#blog-tags .tag')).map(tag => tag.textContent.replace('×', '').trim()).filter(t => t.length > 0) || [];
    
    const data = {
      title: titleEl.value.trim(),
      slug: (document.getElementById('blog-slug')?.value.trim() || toSlug(titleEl.value)).toLowerCase(),
      excerpt: excerptEl.value.trim(),
      body: quill.root.innerHTML,
      category_id: parseInt(categoryEl.value),
      cover_media_id: document.getElementById('blog-cover-id')?.value || null,
      status: document.getElementById('blog-status')?.value || 'draft',
      is_featured: !!document.getElementById('blog-featured')?.checked,
      tags: tags,
      read_time_min: parseInt(document.getElementById('blog-read-time')?.value) || 5,
      meta_description: document.getElementById('blog-meta')?.value.trim() || ''
    };
    
    let response;
    if (postId) {
      response = await apiPut(`/blogs/${postId}`, data);
      showToast('✅ Blog post updated successfully!', 'success');
    } else {
      response = await apiPost('/blogs', data);
      showToast('✅ Blog post created successfully!', 'success');
    }
    
    setTimeout(() => {
      closeFullScreenForm();
      loadBlogs();
    }, 300);
  } catch (error) {
    console.error('Blog save error:', error);
    showToast(`❌ Failed to save blog: ${error.message || 'Unknown error'}`, 'error');
  }
}

async function editBlogPost(id) {
  try {
    const post = await apiGet(`/blogs/${id}`);
    openBlogForm(post);
  } catch (error) {
    showToast('Failed to load blog post: ' + error.message, 'error');
  }
}

async function deleteBlogPost(id) {
  const confirmed = await confirmDialog('Are you sure you want to delete this blog post?');
  if (!confirmed) return;

  try {
    await apiDelete(`/blogs/${id}`);
    showToast('Blog post deleted successfully', 'success');
    await loadBlogs();
  } catch (error) {
    showToast('Failed to delete blog post: ' + error.message, 'error');
  }
}

async function openCategoryForm() {
  const html = `
    <div class="form-header">
      <h3>Add New Category</h3>
      <button class="btn-close" onclick="closeFullScreenForm()">&times;</button>
    </div>
    <form id="category-form" class="form-content">
      <div class="form-group">
        <label for="category-name">Category Name *</label>
        <input type="text" id="category-name" required>
      </div>
      <div class="form-group">
        <label for="category-description">Description</label>
        <textarea id="category-description" rows="3"></textarea>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="closeFullScreenForm()">Cancel</button>
        <button type="submit" class="btn btn-primary">Create Category</button>
      </div>
    </form>
  `;

  fullScreenForm.innerHTML = html;
  fullScreenForm.classList.remove('hidden');

  document.getElementById('category-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveBlogCategory();
  });
}

async function saveBlogCategory() {
  const data = {
    name: document.getElementById('category-name').value,
    description: document.getElementById('category-description').value
  };

  try {
    await apiPost('/blogs/categories', data);
    showToast('Category created successfully', 'success');
    closeFullScreenForm();
    await loadBlogs();
  } catch (error) {
    showToast('Failed to create category: ' + error.message, 'error');
  }
}

async function deleteBlogCategory(id) {
  const confirmed = await confirmDialog('Are you sure you want to delete this category?');
  if (!confirmed) return;

  try {
    await apiDelete(`/blogs/categories/${id}`);
    showToast('Category deleted successfully', 'success');
    await loadBlogs();
  } catch (error) {
    showToast('Failed to delete category: ' + error.message, 'error');
  }
}
// Testimonials CRUD
async function openTestimonialForm(testimonial = null) {
  const isEdit = !!testimonial;
  const title = isEdit ? 'Edit Testimonial' : 'Add New Testimonial';

  const html = `
    <div class="form-header">
      <h3>${title}</h3>
      <button class="btn-close" onclick="closeFullScreenForm()">&times;</button>
    </div>
    <form id="testimonial-form" class="form-content">
      <div class="form-row">
        <div class="form-group">
          <label for="testimonial-client-name">Client Name *</label>
          <input type="text" id="testimonial-client-name" value="${testimonial?.client_name || ''}" required>
        </div>
        <div class="form-group">
          <label for="testimonial-client-role">Client Role</label>
          <input type="text" id="testimonial-client-role" value="${testimonial?.client_role || ''}" placeholder="e.g. CEO, Project Manager">
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="testimonial-client-type">Client Type</label>
          <select id="testimonial-client-type">
            <option value="">Select Type</option>
            <option value="individual" ${testimonial?.client_type === 'individual' ? 'selected' : ''}>Individual</option>
            <option value="company" ${testimonial?.client_type === 'company' ? 'selected' : ''}>Company</option>
            <option value="government" ${testimonial?.client_type === 'government' ? 'selected' : ''}>Government</option>
          </select>
        </div>
        <div class="form-group">
          <label for="testimonial-sort">Sort Order</label>
          <input type="number" id="testimonial-sort" value="${testimonial?.sort_order || 0}" min="0">
        </div>
      </div>

      <div class="form-group">
        <label>Rating (1-5 stars) *</label>
        <div id="testimonial-rating-container" class="star-rating">
          ${Array(5).fill(0).map((_, i) => `<i class="fas fa-star" data-value="${i + 1}"></i>`).join('')}
        </div>
        <input type="hidden" id="testimonial-rating" value="${testimonial?.rating || 5}">
      </div>

      <div class="form-group">
        <label for="testimonial-body">Testimonial *</label>
        <textarea id="testimonial-body" rows="4" required placeholder="The testimonial text">${testimonial?.body || ''}</textarea>
      </div>

      <div class="form-group">
        <label for="testimonial-avatar">Client Avatar</label>
        <div class="media-picker-field">
          <input type="text" id="testimonial-avatar-url" value="${testimonial?.avatar?.public_url || ''}" readonly>
          <button type="button" class="btn btn-sm" onclick="openMediaPicker((media) => {
            document.getElementById('testimonial-avatar-url').value = media[0]?.public_url || '';
            document.getElementById('testimonial-avatar-id').value = media[0]?.id || '';
          })">Choose Avatar</button>
          <input type="hidden" id="testimonial-avatar-id" value="${testimonial?.avatar_media_id || ''}">
        </div>
      </div>

      <div class="form-group">
        <label class="checkbox-label">
          <input type="checkbox" id="testimonial-featured" ${testimonial?.is_featured ? 'checked' : ''}>
          Featured Testimonial
        </label>
      </div>

      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="closeFullScreenForm()">Cancel</button>
        <button type="submit" class="btn btn-primary">${isEdit ? 'Update' : 'Create'} Testimonial</button>
      </div>
    </form>
  `;

  fullScreenForm.innerHTML = html;
  fullScreenForm.classList.remove('hidden');

  // Initialize star rating
  const stars = document.querySelectorAll('#testimonial-rating-container i');
  const ratingInput = document.getElementById('testimonial-rating');
  const currentRating = parseInt(ratingInput.value) || 5;
  
  stars.forEach(star => {
    if (parseInt(star.dataset.value) <= currentRating) {
      star.style.color = '#E8621A';
    }
    star.addEventListener('click', () => {
      const value = parseInt(star.dataset.value);
      ratingInput.value = value;
      stars.forEach(s => {
        s.style.color = parseInt(s.dataset.value) <= value ? '#E8621A' : '#ccc';
      });
    });
  });

  document.getElementById('testimonial-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveTestimonial(isEdit ? testimonial.id : null);
  });
}

async function saveTestimonial(testimonialId = null) {
  try {
    const clientNameEl = document.getElementById('testimonial-client-name');
    const bodyEl = document.getElementById('testimonial-body');
    const ratingEl = document.getElementById('testimonial-rating');
    const clientTypeEl = document.getElementById('testimonial-client-type');
    
    if (!clientNameEl || !clientNameEl.value.trim()) {
      showToast('Client name is required', 'error');
      return;
    }
    if (!bodyEl || !bodyEl.value.trim()) {
      showToast('Testimonial text is required', 'error');
      return;
    }
    if (!ratingEl || !ratingEl.value) {
      showToast('Please select a rating', 'error');
      return;
    }
    
    const rating = parseInt(ratingEl.value);
    if (rating < 1 || rating > 5) {
      showToast('Rating must be between 1 and 5', 'error');
      return;
    }
    
    const data = {
      client_name: clientNameEl.value.trim(),
      client_role: document.getElementById('testimonial-client-role')?.value.trim() || '',
      client_type: clientTypeEl?.value || 'company',
      body: bodyEl.value.trim(),
      rating: rating,
      avatar_id: document.getElementById('testimonial-avatar-id')?.value || null,
      is_featured: !!document.getElementById('testimonial-featured')?.checked,
      sort_order: parseInt(document.getElementById('testimonial-sort')?.value) || 0
    };
    
    let response;
    if (testimonialId) {
      response = await apiPut(`/testimonials/${testimonialId}`, data);
      showToast('✅ Testimonial updated successfully!', 'success');
    } else {
      response = await apiPost('/testimonials', data);
      showToast('✅ Testimonial created successfully!', 'success');
    }
    
    setTimeout(() => {
      closeFullScreenForm();
      loadTestimonials();
    }, 300);
  } catch (error) {
    console.error('Testimonial save error:', error);
    showToast(`❌ Failed to save testimonial: ${error.message || 'Unknown error'}`, 'error');
  }
}

async function editTestimonial(id) {
  try {
    const testimonial = await apiGet(`/testimonials/${id}`);
    openTestimonialForm(testimonial);
  } catch (error) {
    showToast('Failed to load testimonial: ' + error.message, 'error');
  }
}

async function deleteTestimonial(id) {
  const confirmed = await confirmDialog('Are you sure you want to delete this testimonial?');
  if (!confirmed) return;

  try {
    await apiDelete(`/testimonials/${id}`);
    showToast('Testimonial deleted successfully', 'success');
    await loadTestimonials();
  } catch (error) {
    showToast('Failed to delete testimonial: ' + error.message, 'error');
  }
}
// Messages functionality
async function openMessageDetail(id) {
  try {
    const message = await apiGet(`/contact/${id}`);
    const html = `
      <div class="message-detail">
        <div class="message-detail-header">
          <h3>${message.subject}</h3>
          <button class="btn-close" onclick="closeFullScreenForm()">&times;</button>
        </div>
        <div class="message-detail-meta">
          <div class="meta-item">
            <strong>From:</strong> ${message.name} (${message.email})
          </div>
          <div class="meta-item">
            <strong>Date:</strong> ${new Date(message.created_at).toLocaleString()}
          </div>
          <div class="meta-item">
            <strong>Status:</strong>
            <select id="message-status" onchange="updateMessageStatus(${id}, this.value)">
              <option value="new" ${message.status === 'new' ? 'selected' : ''}>New</option>
              <option value="read" ${message.status === 'read' ? 'selected' : ''}>Read</option>
              <option value="replied" ${message.status === 'replied' ? 'selected' : ''}>Replied</option>
              <option value="archived" ${message.status === 'archived' ? 'selected' : ''}>Archived</option>
            </select>
          </div>
        </div>
        <div class="message-detail-content">
          <p>${message.message.replace(/\n/g, '<br>')}</p>
        </div>
        <div class="message-detail-actions">
          <button class="btn btn-primary" onclick="replyToMessage('${message.email}', '${message.subject}')">Reply via Email</button>
          <button class="btn btn-secondary" onclick="closeFullScreenForm()">Close</button>
        </div>
      </div>
    `;

    fullScreenForm.innerHTML = html;
    fullScreenForm.classList.remove('hidden');
  } catch (error) {
    showToast('Failed to load message: ' + error.message, 'error');
  }
}

async function updateMessageStatus(id, status) {
  try {
    await apiPatch(`/contact/${id}`, { status });
    showToast('Message status updated', 'success');
    await loadMessages();
  } catch (error) {
    showToast('Failed to update message status: ' + error.message, 'error');
  }
}

function replyToMessage(email, subject) {
  const replySubject = `Re: ${subject}`;
  const mailtoLink = `mailto:${email}?subject=${encodeURIComponent(replySubject)}`;
  window.open(mailtoLink);
}

async function filterMessages(status) {
  const messages = await apiGet(`/contact?status=${status}&limit=20`);
  const container = document.querySelector('.messages-list');

  const html = messages.map(msg => `
    <div class="message-item" onclick="openMessageDetail('${msg.id}')">
      <div class="message-header">
        <strong>${msg.name}</strong> <span class="message-email">${msg.email}</span>
        <span class="badge badge-${msg.status}">${msg.status}</span>
      </div>
      <div class="message-subject">${msg.subject}</div>
      <div class="message-date">${new Date(msg.created_at).toLocaleDateString()}</div>
    </div>
  `).join('');

  container.innerHTML = html;

  // Update active filter button
  document.querySelectorAll('.filter-btn[data-status]').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`[data-status="${status}"]`).classList.add('active');
}
async function saveSettings(e, group, settings) {
  e.preventDefault();

  const formData = new FormData(e.target);
  const updates = [];

  settings.forEach(setting => {
    const input = document.querySelector(`[data-key="${setting.key}"]`);
    if (input) {
      let value;
      if (input.type === 'checkbox') {
        value = input.checked.toString();
      } else {
        value = input.value;
      }

      if (value !== setting.value) {
        updates.push({
          key: setting.key,
          value: value,
          group: group
        });
      }
    }
  });

  if (updates.length === 0) {
    showToast('No changes to save', 'info');
    return;
  }

  try {
    await apiPost('/settings/batch', { settings: updates });
    showToast('Settings saved successfully', 'success');
    // Reload settings to reflect changes
    const updatedSettings = await apiGet(`/settings?group=${group}`);
    renderSettingsGroup(group, updatedSettings);
  } catch (error) {
    showToast('Failed to save settings: ' + error.message, 'error');
  }
}
function pickMediaForSetting(key) {
  openMediaPicker((media) => {
    const input = document.querySelector(`[data-key="${key}"]`);
    if (input) {
      input.value = media[0]?.public_url || '';
    }
  });
}
// Media functionality
async function searchMedia() {
  const query = document.getElementById('media-search').value;
  const media = await apiGet(`/media?search=${encodeURIComponent(query)}&limit=24`);
  const grid = document.getElementById('media-grid');
  grid.innerHTML = media.map(item => createMediaItemHTML(item)).join('');
}

async function filterMedia(type) {
  let endpoint = '/media?limit=24';
  if (type !== 'all') {
    endpoint += `&type=${type}`;
  }

  const media = await apiGet(endpoint);
  const grid = document.getElementById('media-grid');
  grid.innerHTML = media.map(item => createMediaItemHTML(item)).join('');

  // Update active filter
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`[data-filter="${type}"]`).classList.add('active');
}

async function loadMoreMedia() {
  const currentItems = document.querySelectorAll('.media-item').length;
  const media = await apiGet(`/media?offset=${currentItems}&limit=24`);
  const grid = document.getElementById('media-grid');
  grid.innerHTML += media.map(item => createMediaItemHTML(item)).join('');
}

async function previewMedia(id) {
  try {
    const media = await apiGet(`/media/${id}`);
    const html = `
      <div class="media-preview">
        <div class="preview-header">
          <h3>${media.filename}</h3>
          <button class="btn-close" onclick="hideModal(mediaPickerModal)">&times;</button>
        </div>
        <div class="preview-content">
          ${media.type === 'image' ? `<img src="${media.public_url}" alt="${media.alt_text || ''}">` :
            media.type === 'video' ? `<video controls src="${media.public_url}"></video>` :
            `<div class="file-preview"><i class="fas fa-file"></i><p>${media.filename}</p></div>`}
        </div>
        <div class="preview-meta">
          <p><strong>Size:</strong> ${formatFileSize(media.size)}</p>
          <p><strong>Uploaded:</strong> ${new Date(media.created_at).toLocaleString()}</p>
          ${media.alt_text ? `<p><strong>Alt Text:</strong> ${media.alt_text}</p>` : ''}
        </div>
      </div>
    `;

    // Show in a modal
    const previewModal = document.createElement('div');
    previewModal.className = 'modal-overlay';
    previewModal.innerHTML = `<div class="modal">${html}</div>`;
    document.body.appendChild(previewModal);
    previewModal.addEventListener('click', (e) => {
      if (e.target === previewModal) {
        previewModal.remove();
      }
    });
  } catch (error) {
    showToast('Failed to load media preview: ' + error.message, 'error');
  }
}

async function editMedia(id) {
  try {
    const media = await apiGet(`/media/${id}`);
    const html = `
      <div class="form-header">
        <h3>Edit Media</h3>
        <button class="btn-close" onclick="closeFullScreenForm()">&times;</button>
      </div>
      <form id="media-edit-form" class="form-content">
        <div class="form-group">
          <label for="media-alt-text">Alt Text</label>
          <input type="text" id="media-alt-text" value="${media.alt_text || ''}" placeholder="Describe the image for accessibility">
        </div>
        <div class="form-group">
          <label for="media-filename">Filename</label>
          <input type="text" id="media-filename" value="${media.filename}" readonly>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" onclick="closeFullScreenForm()">Cancel</button>
          <button type="submit" class="btn btn-primary">Update Media</button>
        </div>
      </form>
    `;

    fullScreenForm.innerHTML = html;
    fullScreenForm.classList.remove('hidden');

    document.getElementById('media-edit-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      await saveMediaEdit(id);
    });
  } catch (error) {
    showToast('Failed to load media: ' + error.message, 'error');
  }
}

async function saveMediaEdit(id) {
  const data = {
    alt_text: document.getElementById('media-alt-text').value
  };

  try {
    await apiPut(`/media/${id}`, data);
    showToast('Media updated successfully', 'success');
    closeFullScreenForm();
    await loadMedia();
  } catch (error) {
    showToast('Failed to update media: ' + error.message, 'error');
  }
}

async function deleteMedia(id) {
  const confirmed = await confirmDialog('Are you sure you want to delete this media file?');
  if (!confirmed) return;

  try {
    await apiDelete(`/media/${id}`);
    showToast('Media deleted successfully', 'success');
    await loadMedia();
  } catch (error) {
    showToast('Failed to delete media: ' + error.message, 'error');
  }
}

async function handleFileSelect() {
  const files = document.getElementById('file-input').files;
  if (files.length === 0) return;

  const fileList = document.getElementById('upload-file-list');
  fileList.innerHTML = '';

  Array.from(files).forEach(file => {
    const item = document.createElement('div');
    item.className = 'upload-item';
    item.innerHTML = `
      <div class="upload-info">
        <i class="fas fa-file"></i>
        <span>${file.name}</span>
        <span class="file-size">${formatFileSize(file.size)}</span>
      </div>
      <div class="upload-progress">
        <div class="progress-bar" style="width: 0%"></div>
      </div>
    `;
    fileList.appendChild(item);
  });

  document.getElementById('upload-start').disabled = false;
}

async function startUpload() {
  const files = document.getElementById('file-input').files;
  if (files.length === 0) return;

  const uploadItems = document.querySelectorAll('.upload-item');
  const startBtn = document.getElementById('upload-start');
  startBtn.disabled = true;
  startBtn.textContent = 'Uploading...';

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const item = uploadItems[i];
    const progressBar = item.querySelector('.progress-bar');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percent = (e.loaded / e.total) * 100;
          progressBar.style.width = percent + '%';
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status === 200 || xhr.status === 201) {
          progressBar.style.backgroundColor = 'var(--success)';
          item.querySelector('.upload-info').innerHTML += '<i class="fas fa-check" style="color: var(--success); margin-left: 10px;"></i>';
        } else {
          progressBar.style.backgroundColor = 'var(--danger)';
          item.querySelector('.upload-info').innerHTML += '<i class="fas fa-times" style="color: var(--danger); margin-left: 10px;"></i>';
        }
      });

      xhr.open('POST', `${API_BASE}/media/upload`);
      xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
      xhr.send(formData);

      // Wait for this upload to complete before starting the next
      await new Promise(resolve => {
        xhr.addEventListener('loadend', resolve);
      });

    } catch (error) {
      progressBar.style.backgroundColor = 'var(--danger)';
      console.error('Upload failed:', error);
    }
  }

  startBtn.textContent = 'Upload Complete';
  showToast('Upload completed', 'success');

  // Reload media after a short delay
  setTimeout(() => {
    hideModal(uploadModal);
    loadMedia();
  }, 1000);
}

// Team CRUD
async function openTeamForm(member = null) {
  const isEdit = !!member;
  const title = isEdit ? 'Edit Team Member' : 'Add Team Member';

  const html = `
    <div class="form-header">
      <h3>${title}</h3>
      <button class="btn-close" onclick="closeFullScreenForm()">&times;</button>
    </div>
    <form id="team-form" class="form-content">
      <div class="form-row">
        <div class="form-group">
          <label for="team-name">Name *</label>
          <input type="text" id="team-name" value="${member?.name || ''}" required>
        </div>
        <div class="form-group">
          <label for="team-role">Role Title *</label>
          <input type="text" id="team-role" value="${member?.role_title || ''}" required>
        </div>
      </div>

      <div class="form-group">
        <label for="team-bio">Bio</label>
        <textarea id="team-bio" rows="3">${member?.bio || ''}</textarea>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="team-photo">Photo</label>
          <div class="media-picker-field">
            <input type="text" id="team-photo-url" value="${member?.photo?.public_url || ''}" readonly>
            <button type="button" class="btn btn-sm" onclick="openMediaPicker((media) => {
              document.getElementById('team-photo-url').value = media[0]?.public_url || '';
              document.getElementById('team-photo-id').value = media[0]?.id || '';
            })">Choose Photo</button>
            <input type="hidden" id="team-photo-id" value="${member?.photo_media_id || ''}">
          </div>
        </div>
        <div class="form-group">
          <label for="team-order">Display Order</label>
          <input type="number" id="team-order" value="${member?.sort_order || 0}" min="0">
        </div>
      </div>

      <div class="form-group">
        <label for="team-status">Status</label>
        <select id="team-status">
          <option value="active" ${member?.status === 'active' ? 'selected' : ''}>Active</option>
          <option value="inactive" ${member?.status === 'inactive' ? 'selected' : ''}>Inactive</option>
        </select>
      </div>

      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="closeFullScreenForm()">Cancel</button>
        <button type="submit" class="btn btn-primary">${isEdit ? 'Update' : 'Create'} Member</button>
      </div>
    </form>
  `;

  fullScreenForm.innerHTML = html;
  fullScreenForm.classList.remove('hidden');

  document.getElementById('team-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveTeamMember(isEdit ? member.id : null);
  });
}

async function saveTeamMember(memberId = null) {
  const data = {
    name: document.getElementById('team-name').value,
    role_title: document.getElementById('team-role').value,
    bio: document.getElementById('team-bio').value,
    photo_media_id: document.getElementById('team-photo-id').value || null,
    sort_order: parseInt(document.getElementById('team-order').value) || 0,
    status: document.getElementById('team-status').value
  };

  try {
    if (memberId) {
      await apiPut(`/team/${memberId}`, data);
      showToast('Team member updated successfully', 'success');
    } else {
      await apiPost('/team', data);
      showToast('Team member created successfully', 'success');
    }
    closeFullScreenForm();
    await loadTeam();
  } catch (error) {
    showToast(`Failed to ${memberId ? 'update' : 'create'} team member: ${error.message}`, 'error');
  }
}

async function editTeamMember(id) {
  try {
    const member = await apiGet(`/team/${id}`);
    openTeamForm(member);
  } catch (error) {
    showToast('Failed to load team member: ' + error.message, 'error');
  }
}

async function deleteTeamMember(id) {
  const confirmed = await confirmDialog('Are you sure you want to delete this team member?');
  if (!confirmed) return;

  try {
    await apiDelete(`/team/${id}`);
    showToast('Team member deleted successfully', 'success');
    await loadTeam();
  } catch (error) {
    showToast('Failed to delete team member: ' + error.message, 'error');
  }
}

// Partners CRUD
async function openPartnerForm(partner = null) {
  const isEdit = !!partner;
  const title = isEdit ? 'Edit Partner' : 'Add Partner';

  const html = `
    <div class="form-header">
      <h3>${title}</h3>
      <button class="btn-close" onclick="closeFullScreenForm()">&times;</button>
    </div>
    <form id="partner-form" class="form-content">
      <div class="form-group">
        <label for="partner-name">Company Name *</label>
        <input type="text" id="partner-name" value="${partner?.name || ''}" required>
      </div>

      <div class="form-group">
        <label for="partner-website">Website URL</label>
        <input type="url" id="partner-website" value="${partner?.website_url || ''}" placeholder="https://example.com">
      </div>

      <div class="form-group">
        <label for="partner-logo">Logo</label>
        <div class="media-picker-field">
          <input type="text" id="partner-logo-url" value="${partner?.logo?.public_url || ''}" readonly>
          <button type="button" class="btn btn-sm" onclick="openMediaPicker((media) => {
            document.getElementById('partner-logo-url').value = media[0]?.public_url || '';
            document.getElementById('partner-logo-id').value = media[0]?.id || '';
          })">Choose Logo</button>
          <input type="hidden" id="partner-logo-id" value="${partner?.logo_media_id || ''}">
        </div>
      </div>

      <div class="form-group">
        <label for="partner-description">Description</label>
        <textarea id="partner-description" rows="3">${partner?.description || ''}</textarea>
      </div>

      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="closeFullScreenForm()">Cancel</button>
        <button type="submit" class="btn btn-primary">${isEdit ? 'Update' : 'Create'} Partner</button>
      </div>
    </form>
  `;

  fullScreenForm.innerHTML = html;
  fullScreenForm.classList.remove('hidden');

  document.getElementById('partner-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await savePartner(isEdit ? partner.id : null);
  });
}

async function savePartner(partnerId = null) {
  const data = {
    name: document.getElementById('partner-name').value,
    website_url: document.getElementById('partner-website').value,
    logo_media_id: document.getElementById('partner-logo-id').value || null,
    description: document.getElementById('partner-description').value
  };

  try {
    if (partnerId) {
      await apiPut(`/partners/${partnerId}`, data);
      showToast('Partner updated successfully', 'success');
    } else {
      await apiPost('/partners', data);
      showToast('Partner created successfully', 'success');
    }
    closeFullScreenForm();
    await loadPartners();
  } catch (error) {
    showToast(`Failed to ${partnerId ? 'update' : 'create'} partner: ${error.message}`, 'error');
  }
}

async function editPartner(id) {
  try {
    const partner = await apiGet(`/partners/${id}`);
    openPartnerForm(partner);
  } catch (error) {
    showToast('Failed to load partner: ' + error.message, 'error');
  }
}

async function deletePartner(id) {
  const confirmed = await confirmDialog('Are you sure you want to delete this partner?');
  if (!confirmed) return;

  try {
    await apiDelete(`/partners/${id}`);
    showToast('Partner deleted successfully', 'success');
    await loadPartners();
  } catch (error) {
    showToast('Failed to delete partner: ' + error.message, 'error');
  }
}

// Users CRUD
async function openUserForm(user = null) {
  const isEdit = !!user;
  const title = isEdit ? 'Edit User' : 'Invite User';

  const html = `
    <div class="form-header">
      <h3>${title}</h3>
      <button class="btn-close" onclick="closeFullScreenForm()">&times;</button>
    </div>
    <form id="user-form" class="form-content">
      <div class="form-row">
        <div class="form-group">
          <label for="user-name">Name *</label>
          <input type="text" id="user-name" value="${user?.name || ''}" required>
        </div>
        <div class="form-group">
          <label for="user-email">Email *</label>
          <input type="email" id="user-email" value="${user?.email || ''}" required ${isEdit ? 'readonly' : ''}>
        </div>
      </div>

      ${!isEdit ? `
      <div class="form-group">
        <label for="user-role">Role</label>
        <select id="user-role">
          <option value="editor">Editor</option>
          <option value="admin">Admin</option>
          <option value="super_admin">Super Admin</option>
        </select>
      </div>
      ` : ''}

      ${isEdit ? `
      <div class="form-group">
        <label for="user-status">Status</label>
        <select id="user-status">
          <option value="true" ${user?.is_active ? 'selected' : ''}>Active</option>
          <option value="false" ${!user?.is_active ? 'selected' : ''}>Inactive</option>
        </select>
      </div>
      ` : ''}

      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="closeFullScreenForm()">Cancel</button>
        <button type="submit" class="btn btn-primary">${isEdit ? 'Update' : 'Send Invite'}</button>
      </div>
    </form>
  `;

  fullScreenForm.innerHTML = html;
  fullScreenForm.classList.remove('hidden');

  document.getElementById('user-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveUser(isEdit ? user.id : null);
  });
}

async function saveUser(userId = null) {
  const data = {
    name: document.getElementById('user-name').value,
    email: document.getElementById('user-email').value
  };

  if (userId) {
    data.is_active = document.getElementById('user-status').value === 'true';
  } else {
    data.role = document.getElementById('user-role').value;
  }

  try {
    if (userId) {
      await apiPut(`/users/${userId}`, data);
      showToast('User updated successfully', 'success');
    } else {
      await apiPost('/users/invite', data);
      showToast('User invitation sent successfully', 'success');
    }
    closeFullScreenForm();
    await loadUsers();
  } catch (error) {
    showToast(`Failed to ${userId ? 'update' : 'invite'} user: ${error.message}`, 'error');
  }
}

async function editUser(id) {
  try {
    const user = await apiGet(`/users/${id}`);
    openUserForm(user);
  } catch (error) {
    showToast('Failed to load user: ' + error.message, 'error');
  }
}

async function deleteUser(id) {
  const confirmed = await confirmDialog('Are you sure you want to delete this user?');
  if (!confirmed) return;

  try {
    await apiDelete(`/users/${id}`);
    showToast('User deleted successfully', 'success');
    await loadUsers();
  } catch (error) {
    showToast('Failed to delete user: ' + error.message, 'error');
  }
}

// AI Conversations
async function viewConversation(id) {
  try {
    const conversation = await apiGet(`/ai/conversations/${id}`);
    let messagesHtml = 'No messages found';
    if (conversation.messages && conversation.messages.length > 0) {
      messagesHtml = conversation.messages.map(function(msg) {
        return '<div class="message ' + (msg.role === 'user' ? 'user-message' : 'ai-message') + '">' +
          '<strong>' + (msg.role === 'user' ? 'User' : 'AI') + ':</strong> ' + msg.content +
          '<small>' + new Date(msg.created_at).toLocaleString() + '</small>' +
          '</div>';
      }).join('');
    }

    const html = '<div class="conversation-detail">' +
      '<div class="conversation-header">' +
        '<h3>AI Conversation</h3>' +
        '<button class="btn-close" onclick="closeFullScreenForm()">&times;</button>' +
      '</div>' +
      '<div class="conversation-meta">' +
        '<p><strong>Session:</strong> ' + conversation.session_key + '</p>' +
        '<p><strong>Locale:</strong> ' + conversation.locale + '</p>' +
        '<p><strong>Started:</strong> ' + new Date(conversation.created_at).toLocaleString() + '</p>' +
        '<p><strong>Last Active:</strong> ' + new Date(conversation.updated_at).toLocaleString() + '</p>' +
      '</div>' +
      '<div class="conversation-messages">' +
        messagesHtml +
      '</div>' +
    '</div>';

    fullScreenForm.innerHTML = html;
    fullScreenForm.classList.remove('hidden');
  } catch (error) {
    showToast('Failed to load conversation: ' + error.message, 'error');
  }
}

function closeFullScreenForm() { fullScreenForm.classList.add('hidden'); }
