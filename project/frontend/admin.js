// Admin Dashboard JavaScript - Pyramid Construction

// API Configuration
const API_BASE = 'http://localhost:5000/api';
const INACTIVITY_LIMIT = 30 * 60 * 1000; // 30 minutes

// Global State
let currentUser = null;
let currentRoute = 'dashboard';
let authToken = null;
let refreshToken = null;

// Initialize App on DOM Load
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
    try {
      currentUser = JSON.parse(userStr);
    } catch (e) {
      console.error('Failed to parse user data');
    }
  }
  const theme = localStorage.getItem('pyramid_admin_theme') || 'light';
  document.documentElement.setAttribute('data-theme', theme);
}

function saveAuthState() {
  if (!authToken || !currentUser) {
    console.error('Cannot save auth state; token or user missing');
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
  
  // Login Form
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
    console.log('✅ Login form listener attached');
  } else {
    console.error('❌ Login form not found');
  }

  // Input listeners to clear errors
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  if (emailInput) emailInput.addEventListener('input', clearLoginError);
  if (passwordInput) passwordInput.addEventListener('input', clearLoginError);
  if (emailInput && passwordInput) {
    console.log('✅ Email/Password input listeners attached');
  }

  // Theme toggle
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }

  // Logout
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }

  // Navigation items in sidebar
  document.querySelectorAll('.nav-item[data-route]').forEach(item => {
    item.addEventListener('click', (e) => {
      const route = item.dataset.route;
      if (route !== 'dashboard') {
        e.preventDefault();
      }
      navigate(route);
    });
  });
}

// Clear login error when user starts typing
function clearLoginError() {
  const errorDiv = document.getElementById('login-error');
  if (errorDiv) {
    errorDiv.textContent = '';
    errorDiv.classList.remove('show');
  }
}

// Show login error
function showLoginError(message) {
  const errorDiv = document.getElementById('login-error');
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.classList.add('show');
    console.log('⚠️ Error displayed:', message);
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
    currentUser = response?.user || response;

    if (!currentUser || !currentUser.id) {
      throw new Error('Invalid user profile');
    }

    saveAuthState();
    showApp();
    navigate('dashboard');
  } catch (error) {
    console.error('Auth check failed:', error);
    showLogin();
  }
}

// Handle Login
async function handleLogin(e) {
  e.preventDefault();
  
  console.log('🔐 Login form submitted');
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
    console.log(`🔐 Attempting login for: ${email}`);
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    console.log(`Response status: ${response.status}`);

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Login successful:', result);

      const payload = result && result.data ? result.data : result;
      authToken = payload?.accessToken || payload?.access_token;
      refreshToken = payload?.refreshToken || payload?.refresh_token;
      currentUser = payload?.user || payload;

      if (!authToken || !currentUser || !currentUser.id) {
        console.error('Login validation failed');
        showLoginError('Invalid login response. Please contact support.');
        return;
      }

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
      showLoginError(errorMsg);
    }
  } catch (error) {
    console.error('❌ Login error:', error);
    showLoginError('Network error. Please check your connection and try again.');
  }
}

// Logout
function handleLogout() {
  clearAuthState();
  showLogin();
}

// Routing
function navigate(route) {
  currentRoute = route;
  const pageTitle = document.getElementById('page-title');
  if (pageTitle) {
    pageTitle.textContent = route.charAt(0).toUpperCase() + route.slice(1);
  }
  updateNavUI(route);
}

function updateNavUI(route) {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
  });
  document.querySelectorAll(`[data-route="${route}"]`).forEach(item => {
    item.classList.add('active');
  });
}

// UI Functions
function showLogin() {
  const loginScreen = document.getElementById('login-screen');
  const app = document.getElementById('app');
  if (loginScreen) loginScreen.classList.remove('hidden');
  if (app) app.classList.add('hidden');
}

function showApp() {
  const loginScreen = document.getElementById('login-screen');
  const app = document.getElementById('app');
  if (loginScreen) loginScreen.classList.add('hidden');
  if (app) app.classList.remove('hidden');
  updateUserInfo();
}

function updateUserInfo() {
  if (currentUser) {
    const userNameEl = document.getElementById('user-name');
    const userRoleEl = document.getElementById('user-role');
    if (userNameEl) userNameEl.textContent = currentUser.name || 'Admin';
    if (userRoleEl) userRoleEl.textContent = currentUser.role || 'user';
  }
}

// API Functions
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
      showLogin();
    }
    return response;
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}

async function apiGet(endpoint) {
  const response = await apiRequest(endpoint);
  if (!response.ok) throw new Error('API request failed');
  return await response.json();
}

async function apiPost(endpoint, data) {
  const response = await apiRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify(data)
  });
  if (!response.ok) throw new Error('API request failed');
  return await response.json();
}

// Theme Toggle
function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('pyramid_admin_theme', newTheme);
  
  const themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) {
    const icon = themeBtn.querySelector('i');
    if (icon) {
      icon.className = newTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }
  }
}

// Toast Notifications
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// Sidebar Toggle (Mobile)
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar) {
    sidebar.classList.toggle('open');
  }
}

console.log('✅ admin.js loaded successfully');
