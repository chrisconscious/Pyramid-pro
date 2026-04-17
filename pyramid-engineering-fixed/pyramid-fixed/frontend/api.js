/* ============================================================
   PYRAMID CONSTRUCTION — api.js  (Fixed & Complete)
   Central API client for the public website.
   ============================================================ */
(function () {
  'use strict';

  var BASE = window.PYRAMID_API_URL || 'http://localhost:5000/api';

  function token()  { return sessionStorage.getItem('pyramid_token') || localStorage.getItem('pyramid_token'); }
  function locale() { return window.currentLang || localStorage.getItem('pyramid_lang') || 'en'; }

  async function req(method, path, body, isUpload) {
    var url     = BASE + path;
    var headers = {};
    var tok     = token();
    if (tok) headers['Authorization'] = 'Bearer ' + tok;
    var opts = { method: method, headers: headers };
    if (isUpload) {
      opts.body = body;
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

  function arr(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (raw.data) { if (Array.isArray(raw.data)) return raw.data; if (raw.data.rows) return raw.data.rows; }
    if (raw.rows) return raw.rows;
    return [];
  }

  function obj(raw) {
    if (!raw) return null;
    if (raw && raw.success !== undefined) return raw.data;
    return raw;
  }

  var _settingsCache = null;
  async function getSettings() {
    if (_settingsCache) return _settingsCache;
    var d = await req('GET', '/settings');
    _settingsCache = (d && d.data) ? d.data : {};
    if (_settingsCache && _settingsCache.map) _settingsCache = _settingsCache.map;
    return _settingsCache;
  }

  window.PyramidAPI = {
    /* Auth */
    login:   function(email, pw) { return req('POST', '/auth/login', { email, password: pw }); },
    me:      function()          { return req('GET',  '/auth/me'); },
    refresh: function(rt)        { return req('POST', '/auth/refresh', { refreshToken: rt }); },

    /* Settings */
    getSettings: getSettings,
    getSetting: async function(key) {
      var s = await getSettings();
      if (!s) return null;
      var entry = s[key];
      if (!entry) return null;
      return entry.value || entry.media_url || null;
    },
    saveSettings: function(arr2) { return req('PUT', '/settings', { settings: arr2 }); },

    /* Services */
    getServices: async function(audience) {
      var q = audience && audience !== 'all' ? '?audience=' + audience : '';
      var d = await req('GET', '/services' + q);
      return arr(d);
    },
    getService:      function(id)      { return req('GET', '/services/' + id); },
    getServiceBySlug:function(slug)    { return req('GET', '/services/slug/' + slug); },
    createService:   function(data)    { return req('POST', '/services', data); },
    updateService:   function(id, data){ return req('PUT', '/services/' + id, data); },
    deleteService:   function(id)      { return req('DELETE', '/services/' + id); },

    /* Projects */
    getProjects: async function(params) {
      var q = params ? '?' + new URLSearchParams(params).toString() : '';
      var d = await req('GET', '/projects' + q);
      if (d && d.data) return d; // paginated
      return { data: arr(d), pagination: null };
    },
    getFeaturedProjects: async function() {
      var d = await req('GET', '/projects/featured');
      return arr(d);
    },
    getProject:      function(id)      { return req('GET', '/projects/' + id); },
    getProjectBySlug:function(slug)    { return req('GET', '/projects/slug/' + slug); },
    createProject:   function(data)    { return req('POST', '/projects', data); },
    updateProject:   function(id, data){ return req('PUT', '/projects/' + id, data); },
    deleteProject:   function(id)      { return req('DELETE', '/projects/' + id); },

    /* Blog */
    getBlogs: async function(params) {
      var q = params ? '?' + new URLSearchParams(params).toString() : '';
      var d = await req('GET', '/blogs' + q);
      if (d && d.data) return d;
      return { data: arr(d), pagination: null };
    },
    getBlog:         function(id)      { return req('GET', '/blogs/' + id); },
    getBlogBySlug:   function(slug)    { return req('GET', '/blogs/slug/' + slug); },
    createBlog:      function(data)    { return req('POST', '/blogs', data); },
    updateBlog:      function(id, data){ return req('PUT', '/blogs/' + id, data); },
    deleteBlog:      function(id)      { return req('DELETE', '/blogs/' + id); },

    /* Testimonials */
    getTestimonials: async function(featured) {
      var q = featured ? '?featured=true' : '';
      var d = await req('GET', '/testimonials' + q);
      return arr(d);
    },

    /* Team */
    getTeam: async function() {
      var d = await req('GET', '/team');
      return arr(d);
    },

    /* Partners */
    getPartners: async function() {
      var d = await req('GET', '/partners');
      return arr(d);
    },

    /* Contact */
    submitContact: function(data) { return req('POST', '/contact', data); },
    getContacts:   async function(params) {
      var q = params ? '?' + new URLSearchParams(params).toString() : '';
      var d = await req('GET', '/contact' + q);
      return d;
    },

    /* Media */
    getMedia:    async function(params) {
      var q = params ? '?' + new URLSearchParams(params).toString() : '';
      var d = await req('GET', '/media' + q);
      return arr(d);
    },
    uploadMedia: function(formData) { return req('POST', '/media/upload', formData, true); },
    deleteMedia: function(id)       { return req('DELETE', '/media/' + id); },

    /* AI Chat */
    chat: function(message, history) {
      return req('POST', '/ai/chat', { message, history: history || [] });
    },

    /* Helpers */
    arr: arr,
    obj: obj,
  };

  console.log('[PyramidAPI] Ready. Base:', BASE);
})();
