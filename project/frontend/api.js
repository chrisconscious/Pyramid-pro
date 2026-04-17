/* ============================================================
   PYRAMID CONSTRUCTION — api.js
   Central API client. Works with file:// AND http://.
   Loaded via: <script src="api.js"></script>
   ============================================================ */
(function () {
  'use strict';

  var BASE = window.PYRAMID_API_URL || 'http://localhost:5000/api';

  /* ── token helpers ── */
  function token()  { return sessionStorage.getItem('pyramid_token')  || localStorage.getItem('pyramid_token'); }
  function locale() { return window.currentLang || localStorage.getItem('pyramid_lang') || 'en'; }

  /* ── core fetch ── */
  async function req(method, path, body, isUpload) {
    var url     = BASE + path;
    var headers = {};
    var tok     = token();
    if (tok) headers['Authorization'] = 'Bearer ' + tok;
    var opts    = { method: method, headers: headers };
    if (isUpload) {
      opts.body = body; // FormData — no Content-Type header
    } else if (body) {
      headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    try {
      var r = await fetch(url, opts);
      var d = await r.json();
      if (!r.ok) throw new Error(d.message || 'Request failed (' + r.status + ')');
      return d;
    } catch (e) {
      console.warn('[PyramidAPI] ' + method + ' ' + path + ' failed:', e.message);
      return null;
    }
  }

  /* ── safe array unwrap ── */
  function arr(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (raw.data) {
      if (Array.isArray(raw.data)) return raw.data;
      if (raw.data.rows) return raw.data.rows;
    }
    if (raw.rows) return raw.rows;
    return [];
  }

  /* ── safe object unwrap ── */
  function obj(raw) {
    if (!raw) return null;
    if (raw && raw.success !== undefined) return raw.data;
    return raw;
  }

  /* ── Settings cache ── */
  var _settingsCache = null;
  async function getSettings() {
    if (_settingsCache) return _settingsCache;
    var d = await req('GET', '/settings');
    _settingsCache = (d && d.data && d.data.map) ? d.data.map : {};
    return _settingsCache;
  }

  window.PyramidAPI = {
    /* Auth */
    login:  function(email, pw) { return req('POST', '/auth/login',  { email: email, password: pw }); },
    me:     function()          { return req('GET',  '/auth/me'); },
    refresh:function(rt)        { return req('POST', '/auth/refresh', { refreshToken: rt }); },

    /* Settings */
    getSettings:    getSettings,
    getSetting:     async function(key) {
      var s = await getSettings();
      return s && s[key] ? (s[key].value || s[key].media_url || null) : null;
    },
    saveSettings:   function(arr2) { return req('PUT', '/settings', { settings: arr2 }); },

    /* Services */
    getServices: async function(audience) {
      var q = audience && audience !== 'all' ? '?audience=' + audience : '';
      var d = await req('GET', '/services' + q);
      return arr(d);
    },
    getService:     function(id)   { return req('GET', '/services/' + id); },
    createService:  function(data) { return req('POST', '/services', data); },
    updateService:  function(id, data) { return req('PUT', '/services/' + id, data); },
    deleteService:  function(id)   { return req('DELETE', '/services/' + id); },
    reorderServices:function(items){ return req('POST', '/services/reorder', { items: items }); },

    /* Projects */
    getProjects: async function(params) {
      var q = params ? '?' + new URLSearchParams(Object.assign({ locale: locale() }, params)).toString() : '';
      var d = await req('GET', '/projects' + q);
      return Array.isArray(d) ? d : (d && d.data ? d : { data: arr(d), pagination: d && d.pagination });
    },
    getFeaturedProjects: async function() {
      var d = await req('GET', '/projects/featured');
      return arr(d);
    },
    getProjectCategories: async function() {
      var d = await req('GET', '/projects/categories');
      return arr(d);
    },
    getProject:     function(id)   { return req('GET', '/projects/' + id); },
    getProjectBySlug: function(s)  { return req('GET', '/projects/slug/' + s); },
    createProject:  function(data) { return req('POST', '/projects', data); },
    updateProject:  function(id, data) { return req('PUT', '/projects/' + id, data); },
    deleteProject:  function(id)   { return req('DELETE', '/projects/' + id); },
    addProjectMedia:function(id, body) { return req('POST', '/projects/' + id + '/media', body); },
    removeProjectMedia: function(pid, mid) { return req('DELETE', '/projects/' + pid + '/media/' + mid); },

    /* Blogs */
    getBlogs: async function(params) {
      var q = params ? '?' + new URLSearchParams(Object.assign({ locale: locale() }, params)).toString() : '';
      var d = await req('GET', '/blogs' + q);
      return Array.isArray(d) ? d : (d && d.data ? d : { data: arr(d), pagination: d && d.pagination });
    },
    getFeaturedBlogs: async function() {
      var d = await req('GET', '/blogs/featured');
      return arr(d);
    },
    getBlogCategories: async function() {
      var d = await req('GET', '/blogs/categories');
      return arr(d);
    },
    getBlog:         function(slug)  { return req('GET', '/blogs/' + slug); },
    getRelatedBlogs: function(slug)  { return req('GET', '/blogs/' + slug + '/related'); },
    createBlog:      function(data)  { return req('POST', '/blogs', data); },
    updateBlog:      function(id, d) { return req('PUT', '/blogs/' + id, d); },
    deleteBlog:      function(id)    { return req('DELETE', '/blogs/' + id); },
    createBlogCategory: function(name) { return req('POST', '/blogs/categories', { name: name }); },

    /* Testimonials */
    getTestimonials: async function(featured) {
      var q = featured ? '?featured=true' : '';
      var d = await req('GET', '/testimonials' + q);
      return arr(d);
    },
    createTestimonial: function(data) { return req('POST', '/testimonials', data); },
    updateTestimonial: function(id, d){ return req('PUT', '/testimonials/' + id, d); },
    deleteTestimonial: function(id)   { return req('DELETE', '/testimonials/' + id); },

    /* Team */
    getTeam: async function() {
      var d = await req('GET', '/team');
      return arr(d);
    },
    createTeamMember: function(data)   { return req('POST', '/team', data); },
    updateTeamMember: function(id, d)  { return req('PUT', '/team/' + id, d); },
    deleteTeamMember: function(id)     { return req('DELETE', '/team/' + id); },

    /* Partners */
    getPartners: async function() {
      var d = await req('GET', '/partners');
      return arr(d);
    },
    createPartner: function(data) { return req('POST', '/partners', data); },
    updatePartner: function(id, d){ return req('PUT', '/partners/' + id, d); },
    deletePartner: function(id)   { return req('DELETE', '/partners/' + id); },

    /* Contact */
    submitContact: function(data)  { return req('POST', '/contact', data); },
    getContacts:   function(params){ var q = params ? '?' + new URLSearchParams(params).toString() : ''; return req('GET', '/contact' + q); },
    getContact:    function(id)    { return req('GET', '/contact/' + id); },
    updateContactStatus: function(id, status, notes) { return req('PATCH', '/contact/' + id + '/status', { status: status, notes: notes }); },
    getContactStats: function()    { return req('GET', '/contact/stats'); },

    /* Media */
    getMedia: function(params) { var q = params ? '?' + new URLSearchParams(params).toString() : ''; return req('GET', '/media' + q); },
    uploadFile: function(formData) { return req('POST', '/media/upload', formData, true); },
    uploadMultiple: function(formData) { return req('POST', '/media/upload-multiple', formData, true); },
    updateMedia: function(id, data) { return req('PUT', '/media/' + id, data); },
    deleteMedia: function(id) { return req('DELETE', '/media/' + id); },

    /* Analytics */
    getDashboard:        function() { return req('GET', '/analytics/dashboard'); },
    getContactTrend:     function() { return req('GET', '/analytics/contacts/trend'); },
    getPopularBlogs:     function() { return req('GET', '/analytics/blogs/popular'); },
    getProjectsByCategory: function(){ return req('GET', '/analytics/projects/by-category'); },

    /* AI Chat */
    chat: function(message, sessionKey) {
      return req('POST', '/ai/chat', {
        message:     message,
        session_key: sessionKey,
        locale:      locale(),
      });
    },
    getChatSessionKey: function() {
      var k = sessionStorage.getItem('pyramid_chat_session');
      if (!k) {
        k = 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2);
        sessionStorage.setItem('pyramid_chat_session', k);
      }
      return k;
    },

    /* Users (admin only) */
    getUsers:      function() { return req('GET', '/users'); },
    createUser:    function(data) { return req('POST', '/users', data); },
    updateUser:    function(id, d){ return req('PUT', '/users/' + id, d); },
    deleteUser:    function(id)   { return req('DELETE', '/users/' + id); },
    resetPassword: function(id, pw){ return req('POST', '/users/' + id + '/reset-password', { newPassword: pw }); },

    /* Translations */
    getTranslations: function(type, id, lang) { return req('GET', '/translations/' + type + '/' + id + '?locale=' + (lang || locale())); },
    saveTranslations: function(type, id, lang, data) { return req('PUT', '/translations/' + type + '/' + id, { locale: lang, translations: data }); },

    /* Helpers */
    mediaUrl: function(filePath) {
      if (!filePath) return null;
      if (filePath.startsWith('http')) return filePath;
      return BASE.replace('/api', '') + '/' + filePath.replace(/^\//, '');
    },
    arr: arr,
    obj: obj,
  };

})();
