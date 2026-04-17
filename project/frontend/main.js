/* =====================================================
   PYRAMID ENGINEERING — main.js (Fully Fixed)
   Fixes: theme toggle, mobile menu, AI chat,
          language sync, scroll reveal, counters
   ===================================================== */

document.addEventListener('DOMContentLoaded', () => {

  /* ══════════════════════════════════════════
     1. DARK / LIGHT THEME TOGGLE  (FIXED)
     ══════════════════════════════════════════ */
  const html        = document.documentElement;
  const themeToggle = document.getElementById('themeToggle');
  const iconMoon    = document.getElementById('iconMoon');
  const iconSun     = document.getElementById('iconSun');

  // Apply saved preference immediately
  const savedTheme = localStorage.getItem('pyramid_theme') || 'light';
  html.setAttribute('data-theme', savedTheme);
  updateThemeIcons(savedTheme);

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const current = html.getAttribute('data-theme');
      const next    = current === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', next);
      localStorage.setItem('pyramid_theme', next);
      updateThemeIcons(next);
    });
  }

  function updateThemeIcons(theme) {
    if (!iconMoon || !iconSun) return;
    if (theme === 'dark') {
      iconMoon.style.display = 'none';
      iconSun.style.display  = 'inline-block';
    } else {
      iconMoon.style.display = 'inline-block';
      iconSun.style.display  = 'none';
    }
  }

  /* ══════════════════════════════════════════
     2. NAVBAR SCROLL
     ══════════════════════════════════════════ */
  const navbar  = document.getElementById('navbar');
  const backTop = document.getElementById('backTop');

  window.addEventListener('scroll', () => {
    if (navbar)  navbar.classList.toggle('scrolled', window.scrollY > 60);
    if (backTop) backTop.classList.toggle('visible',  window.scrollY > 300);
  }, { passive: true });

  /* ══════════════════════════════════════════
     3. MOBILE MENU TOGGLE  (ENHANCED)
     ══════════════════════════════════════════ */
  const menuToggle = document.getElementById('menuToggle');
  const navLinks   = document.getElementById('navLinks');
  const menuIcon   = document.getElementById('menuIcon');
  const mobileMenuBackdrop = document.getElementById('mobileMenuBackdrop');

  function closeMenu() {
    navLinks?.classList.remove('open');
    mobileMenuBackdrop?.classList.remove('open');
    if (menuIcon) menuIcon.className = 'fa-solid fa-bars';
  }

  function openMenu() {
    navLinks?.classList.add('open');
    mobileMenuBackdrop?.classList.add('open');
    if (menuIcon) menuIcon.className = 'fa-solid fa-xmark';
  }

  if (menuToggle && navLinks) {
    menuToggle.addEventListener('click', () => {
      const isOpen = navLinks.classList.contains('open');
      if (isOpen) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    // Close on nav link click
    navLinks.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        closeMenu();
      });
    });

    // Close menu when clicking backdrop
    if (mobileMenuBackdrop) {
      mobileMenuBackdrop.addEventListener('click', closeMenu);
    }

    // Close menu on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && navLinks.classList.contains('open')) {
        closeMenu();
      }
    });
  }

  /* ══════════════════════════════════════════
     4. ACTIVE NAV LINK
     ══════════════════════════════════════════ */
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link').forEach(link => {
    const href = (link.getAttribute('href') || '').split('?')[0];
    link.classList.toggle('active',
      href === currentPage || (currentPage === '' && href === 'index.html')
    );
  });

  /* ══════════════════════════════════════════
     5. BACK TO TOP
     ══════════════════════════════════════════ */
  if (backTop) {
    backTop.addEventListener('click', () =>
      window.scrollTo({ top: 0, behavior: 'smooth' })
    );
  }

  /* ══════════════════════════════════════════
     6. SCROLL REVEAL
     ══════════════════════════════════════════ */
  const revealObs = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => entry.target.classList.add('visible'), i * 80);
        revealObs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.reveal').forEach(el => revealObs.observe(el));

  // Auto-reveal cards
  const autoSel = '.audience-card, .service-card, .project-card, .testi-card, .process-step, .service-detail-card, .proj-full-card, .team-card, .blog-card';
  document.querySelectorAll(autoSel).forEach((el, i) => {
    el.classList.add('reveal');
    el.style.transitionDelay = `${(i % 4) * 0.10}s`;
    setTimeout(() => revealObs.observe(el), 50);
  });

  /* ══════════════════════════════════════════
     7. PROJECTS FILTER
     ══════════════════════════════════════════ */
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.getAttribute('data-filter');
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.proj-full-card').forEach(card => {
        const show = filter === 'all' || card.getAttribute('data-category') === filter;
        card.style.display = show ? '' : 'none';
      });
    });
  });

  /* ══════════════════════════════════════════
     8. SERVICES AUDIENCE TABS
     ══════════════════════════════════════════ */
  document.querySelectorAll('.aud-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-tab');
      document.querySelectorAll('.aud-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.aud-panel').forEach(p => {
        p.style.display = p.getAttribute('data-panel') === target ? '' : 'none';
      });
    });
  });

  /* ══════════════════════════════════════════
     9. AI CHAT ASSISTANT  (FIXED)
     ══════════════════════════════════════════ */
  const chatToggle   = document.getElementById('chatToggle');
  const chatPanel    = document.getElementById('chatPanel');
  const chatClose    = document.getElementById('chatClose');
  const chatInput    = document.getElementById('chatInput');
  const chatMessages = document.getElementById('chatMessages');

  // Response library — EN / SW / FR
  const responses = {
    services: {
      en: 'We offer 4 core services:\n\n• Building Construction — residential, commercial, industrial\n• Architecture Planning & Design\n• Consultation & Feasibility Studies\n• Renovation & Maintenance\n\nWould you like details on any specific service?',
      sw: 'Tunatoa huduma 4 kuu:\n\n• Ujenzi wa Majengo\n• Mipango na Usanifu\n• Ushauri wa Mradi\n• Ukarabati na Matengenezo\n\nUnahitaji maelezo kuhusu huduma maalum?',
      fr: 'Nous offrons 4 services:\n\n• Construction de Bâtiments\n• Planification & Conception\n• Consultation & Études\n• Rénovation & Maintenance\n\nDes détails sur un service spécifique?'
    },
    quote: {
      en: 'To get a detailed quote:\n\n• Fill our Contact Form → contact.html\n• Call/WhatsApp: 0757 744 555\n• Email: pyramid.constructor.ltd@gmail.com\n\nWe respond within 24 hours!',
      sw: 'Kupata bei ya kina:\n\n• Jaza fomu → contact.html\n• Simu/WhatsApp: 0757 744 555\n• Barua pepe: pyramid.constructor.ltd@gmail.com\n\nTunajibu ndani ya masaa 24!',
      fr: 'Pour un devis détaillé:\n\n• Formulaire → contact.html\n• Appelez/WhatsApp: 0757 744 555\n• Email: pyramid.constructor.ltd@gmail.com\n\nRéponse dans les 24 heures!'
    },
    contact: {
      en: 'Contact us:\n\n📧 pyramid.constructor.ltd@gmail.com\n📞 0757 744 555\n💬 wa.me/255757744555\n📍 Dar es Salaam, Tanzania\n\nOpen Mon–Sat, 8am–6pm',
      sw: 'Wasiliana nasi:\n\n📧 pyramid.constructor.ltd@gmail.com\n📞 0757 744 555\n📍 Dar es Salaam, Tanzania\n\nJumatatu–Jumamosi, 8am–6pm',
      fr: 'Contactez-nous:\n\n📧 pyramid.constructor.ltd@gmail.com\n📞 0757 744 555\n📍 Dar es Salaam, Tanzanie\n\nLun–Sam, 8h–18h'
    },
    projects: {
      en: 'We have completed 300+ projects across Tanzania:\n\n• Residential homes & villas\n• Commercial plazas & offices\n• Government buildings\n• Major infrastructure\n\nVisit our Projects page to see the full portfolio!',
      sw: 'Tumekamilisha miradi 300+ Tanzania:\n\n• Nyumba na villa\n• Majengo ya biashara\n• Majengo ya serikali\n\nTembelea ukurasa wetu wa Miradi!',
      fr: 'Nous avons complété 300+ projets:\n\n• Maisons & villas\n• Complexes commerciaux\n• Bâtiments gouvernementaux\n\nVisitez notre page Projets!'
    },
    default: {
      en: 'Thank you for reaching out!\n\nFor immediate assistance:\n📞 Call/WhatsApp: 0757 744 555\n📧 pyramid.constructor.ltd@gmail.com\n\nOur team is ready to help with your project!',
      sw: 'Asante kwa kuwasiliana!\n\nKwa msaada wa haraka:\n📞 Simu/WhatsApp: 0757 744 555\n📧 pyramid.constructor.ltd@gmail.com',
      fr: 'Merci de nous contacter!\n\nPour aide immédiate:\n📞 Appelez/WhatsApp: 0757 744 555\n📧 pyramid.constructor.ltd@gmail.com'
    }
  };

  function addMsg(text, isUser) {
    if (!chatMessages) return;
    const div = document.createElement('div');
    div.className = `chat-msg ${isUser ? 'user' : 'bot'}`;
    div.style.whiteSpace = 'pre-line';
    div.textContent = text;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function addTyping() {
    if (!chatMessages) return null;
    const div = document.createElement('div');
    div.className = 'chat-msg bot chat-typing';
    div.innerHTML = '<span></span><span></span><span></span>';
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return div;
  }

  function detectIntent(input) {
    const l = input.toLowerCase();
    if (/service|build|construct|architect|renovat|consult|huduma|ujenzi/i.test(l)) return 'services';
    if (/quote|price|cost|budget|bei|prix|devis/i.test(l))                          return 'quote';
    if (/contact|call|email|phone|whatsapp|mahali|location/i.test(l))               return 'contact';
    if (/project|portfolio|work|miradi|travaux|kazi/i.test(l))                      return 'projects';
    return 'default';
  }

  // Quick reply buttons
  window.chatQuick = function(type) {
    const labels = {
      services: { en: 'Our Services',  sw: 'Huduma Zetu', fr: 'Nos Services'     },
      quote:    { en: 'Get a Quote',   sw: 'Pata Bei',    fr: 'Obtenir un Devis' },
      contact:  { en: 'Contact Us',    sw: 'Wasiliana',   fr: 'Contactez-nous'   }
    };
    const lang  = window.currentLang || 'en';
    const label = labels[type]?.[lang] || labels[type]?.en || type;
    addMsg(label, true);
    const typing = addTyping();
    setTimeout(() => {
      typing?.remove();
      addMsg(responses[type]?.[lang] || responses[type]?.en || responses.default.en, false);
    }, 900);
  };

  // Send free-text message
  window.sendChat = function() {
    const val = chatInput?.value?.trim();
    if (!val) return;
    addMsg(val, true);
    chatInput.value = '';
    const typing = addTyping();
    setTimeout(() => {
      typing?.remove();
      const lang = window.currentLang || 'en';
      const key  = detectIntent(val);
      addMsg(responses[key]?.[lang] || responses[key]?.en || responses.default.en, false);
    }, 1000);
  };

  // Event listeners — chat
  if (chatInput)  chatInput.addEventListener('keydown', e => { if (e.key === 'Enter') window.sendChat(); });
  if (chatToggle) chatToggle.addEventListener('click',  () => chatPanel?.classList.toggle('open'));
  if (chatClose)  chatClose.addEventListener('click',   () => chatPanel?.classList.remove('open'));

  /* ══════════════════════════════════════════
     10. CONTACT FORM — EmailJS integration
         (replace YOUR_* with real EmailJS keys)
     ══════════════════════════════════════════ */
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const btn     = this.querySelector('[type="submit"]');
      const success = document.getElementById('formSuccess');
      const origTxt = btn.textContent;
      btn.textContent = 'Sending...';
      btn.disabled    = true;

      // ── Option A: EmailJS (uncomment after adding your keys) ──
      // emailjs.sendForm('YOUR_SERVICE_ID', 'YOUR_TEMPLATE_ID', this, 'YOUR_PUBLIC_KEY')
      //   .then(() => showSuccess())
      //   .catch(() => { btn.textContent = 'Error — try again'; btn.disabled = false; });

      // ── Option B: Formspree (change action attr to your endpoint) ──
      const data = new FormData(this);
      const action = this.getAttribute('action');
      if (action && action.includes('formspree')) {
        fetch(action, { method: 'POST', body: data, headers: { Accept: 'application/json' } })
          .then(r => r.ok ? showSuccess() : showError())
          .catch(showError);
      } else {
        // ── Fallback: simulate success (replace with real integration) ──
        setTimeout(showSuccess, 1200);
      }

      function showSuccess() {
        btn.textContent  = '✓ Message Sent!';
        btn.style.background   = '#22c55e';
        btn.style.borderColor  = '#22c55e';
        if (success) { success.classList.add('show'); setTimeout(() => success.classList.remove('show'), 5000); }
        contactForm.reset();
        setTimeout(() => {
          btn.textContent = origTxt;
          btn.style.background  = '';
          btn.style.borderColor = '';
          btn.disabled = false;
        }, 4000);
      }
      function showError() {
        btn.textContent = 'Error — please try again';
        btn.disabled = false;
      }
    });
  }

  /* ══════════════════════════════════════════
     11. COUNTER ANIMATION
     ══════════════════════════════════════════ */
  function animateCounter(el, target, suffix) {
    let start = null;
    const step = ts => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / 1800, 1);
      el.textContent = Math.floor((1 - Math.pow(1 - p, 3)) * target) + suffix;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  const cntObs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el  = entry.target;
        const num = parseInt(el.textContent.replace(/\D/g, ''));
        const sfx = el.textContent.replace(/[\d,]/g, '').trim();
        if (num > 0) animateCounter(el, num, sfx);
        cntObs.unobserve(el);
      }
    });
  }, { threshold: 0.5 });
  document.querySelectorAll('.stat-num, .stat-item strong').forEach(el => cntObs.observe(el));

  /* ══════════════════════════════════════════
     12. HERO PARALLAX (subtle)
     ══════════════════════════════════════════ */
  const heroContent = document.querySelector('.hero-content');
  if (heroContent) {
    window.addEventListener('scroll', () => {
      const s = window.scrollY;
      if (s < window.innerHeight) {
        heroContent.style.transform = `translateY(${s * 0.14}px)`;
        heroContent.style.opacity   = String(Math.max(0, 1 - s / 650));
      }
    }, { passive: true });
  }

  /* ══════════════════════════════════════════
     13. SMOOTH PAGE TRANSITIONS
     ══════════════════════════════════════════ */
  document.querySelectorAll('a[href]').forEach(link => {
    const href = link.getAttribute('href');
    if (href && href.endsWith('.html') && !href.startsWith('http')) {
      link.addEventListener('click', e => {
        e.preventDefault();
        document.body.style.opacity    = '0';
        document.body.style.transition = 'opacity 0.22s';
        setTimeout(() => { window.location.href = href; }, 220);
      });
    }
  });

  // Fade in on load
  document.body.style.opacity = '0';
  requestAnimationFrame(() => {
    document.body.style.transition = 'opacity 0.35s';
    document.body.style.opacity    = '1';
  });

});
