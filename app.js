    import { createClient } from './vendor/supabase-js.mjs';
    import { translations, ensureLocale } from './i18n.js';
    import { loadGuide } from './guide.js';
    import {
      escape, reduceMotion as _reduceMotion, normalizePhone, telegramLink,
      nameHue, avatarBg, twoInitials, hexToRgba, downscaleImage,
      statusKey, normPlateKey, fmtDateTime, fmtRelative, mergeById, maxWatermark, overlapFrom, backupAgeHours,
      gateBurstAction, planDrawingOk
    } from './utils.js';
    import { haptic, confettiBurst, successCheck, auroraPulse } from './effects.js';
    // The venue plan drawn in plan.html. Same module the editor uses, so the
    // map the app shows and the plan somebody drew can never disagree.
    import { planSpots, planSvgDoc, inkOf, SPOT_W, SPOT_D } from './plan-render.js';

    const SUPABASE_URL = 'https://knphmxxokowwkruimdus.supabase.co';
    const SUPABASE_ANON = 'sb_publishable_9b7WSJF4UlfF1JIdCDjWqQ_dxOTpqSW';

    const supa = createClient(SUPABASE_URL, SUPABASE_ANON, {
      auth: { persistSession: true, autoRefreshToken: true }
    });

    // ---------- Crash reporting ----------
    // A JS error on an operator's phone at the gate is otherwise invisible to
    // everyone. Report uncaught errors so failures are diagnosable after the
    // fact. Best-effort and heavily throttled: reporting must never itself
    // break the app or spam the table from a render loop.
    const APP_VERSION = 'v149';
    let _errCount = 0, _lastErrAt = 0;
    const _errSeen = new Set();
    async function reportClientError(message, stack) {
      try {
        const msg = String(message || '').slice(0, 500);
        if (!msg) return;
        // Ignore noise we can't act on: offline blips and extension errors.
        if (/Failed to fetch|NetworkError|Load failed|ResizeObserver loop/i.test(msg)) return;
        const now = Date.now();
        if (_errCount >= 10) return;                 // cap per page load
        if (now - _lastErrAt < 2000) return;         // throttle bursts
        const key = msg.slice(0, 120);
        if (_errSeen.has(key)) return;               // one report per distinct error
        _errSeen.add(key); _lastErrAt = now; _errCount++;
        // Only signed-in users can insert (RLS); skip quietly otherwise.
        const { data: { user } = { user: null } } = await supa.auth.getUser().catch(() => ({ data: { user: null } }));
        if (!user) return;
        await supa.from('client_errors').insert({
          message: msg,
          stack: String(stack || '').slice(0, 4000) || null,
          url: String(location.pathname + location.search).slice(0, 300),
          user_agent: String(navigator.userAgent || '').slice(0, 300),
          user_email: user.email || null,
          app_version: APP_VERSION,
        });
      } catch (_) { /* never let reporting throw */ }
    }
    window.addEventListener('error', (e) => {
      reportClientError(e.message || (e.error && e.error.message), e.error && e.error.stack);
    });
    window.addEventListener('unhandledrejection', (e) => {
      const r = e.reason;
      reportClientError((r && r.message) || String(r), r && r.stack);
    });

    // ==============================================================
    // I18N SYSTEM
    // ==============================================================
    

    let currentLang = localStorage.getItem('kultura_lang') || 'ro';

    // Helper: get translated string with {param} interpolation
    function t(key, params) {
      const pack = translations[currentLang] || translations.ro;
      let val = pack[key];
      if (val == null) val = translations.ro[key];       // fallback to RO
      if (val == null) return key;                        // last resort — show the key
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          val = val.replace(new RegExp('\\{' + k + '\\}', 'g'), v);
        }
      }
      return val;
    }

    // Helper to translate statuses from DB
    function translateStatus(status, type) {
      if (!status) return '—';
      const s = status.toLowerCase();
      if (type === 'car') {
        if (s.includes('sosit')) return t('car.status.arrived');
        if (s.includes('plecat')) return t('car.status.left');
        if (s.includes('invitat')) return t('car.status.invited');
        if (s.includes('așteptare') || s.includes('asteptare') || s.includes('waiting')) return t('car.status.waiting');
      }
      if (type === 'task') {
        if (s === 'available' || s.includes('disponibil')) return t('task.status.available');
        if (s === 'in_progress' || s.includes('lucru') || s.includes('progres')) return t('task.status.in_progress');
        if (s === 'completed' || s.includes('finisat') || s.includes('finalizat')) return t('task.status.completed');
      }
      if (type === 'event') {
        if (s.includes('planificat')) return t('event.status.planned');
        if (s.includes('curând') || s.includes('curand')) return t('event.status.soon');
        if (s.includes('activ')) return t('event.status.active');
        if (s.includes('finalizat')) return t('event.status.finished');
        if (s.includes('anulat')) return t('event.status.cancelled');
      }
      return status;
    }

    // Async because non-Romanian packs are fetched on demand. Callers that
    // don't await it still get a correct UI: the Romanian fallback renders
    // first and this repaints every translated node the moment the pack lands.
    async function applyLanguage(lang) {
      await ensureLocale(lang);
      currentLang = lang;
      localStorage.setItem('kultura_lang', lang);

      // Text content — <h1 data-i18n="key">…</h1>
      document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        const txt = t(key);
        if (el.tagName === 'INPUT' && (el.type === 'submit' || el.type === 'button')) {
          el.value = txt;
        } else if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          // For inputs/textareas without data-i18n-placeholder, put translation in placeholder
          el.placeholder = txt;
        } else {
          el.textContent = txt;
        }
      });

      // Placeholder — <input data-i18n-placeholder="key">
      document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        el.placeholder = t(el.dataset.i18nPlaceholder);
      });

      // Title/tooltip — <button data-i18n-title="key">
      document.querySelectorAll('[data-i18n-title]').forEach(el => {
        el.title = t(el.dataset.i18nTitle);
      });

      // Aria-label — <button data-i18n-aria="key">
      document.querySelectorAll('[data-i18n-aria]').forEach(el => {
        el.setAttribute('aria-label', t(el.dataset.i18nAria));
      });

      // Update active state on language buttons. Styling lives in CSS (see
      // .lang-btn) — inline styles here used to fight the stylesheet and made
      // the active state fail contrast without anyone noticing.
      document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
      });

      // Toggle login/signup text via isSignUp flag if applicable
      if (typeof isSignUp !== 'undefined') {
        const titleEl = el('title'); const subtitleEl = el('subtitle');
        const btnTextEl = el('btnText'); const toggleTextEl = el('toggleText');
        const toggleLinkEl = el('toggleLink');
        if (titleEl)      titleEl.textContent      = t(isSignUp ? 'login.title_signup' : 'login.title');
        if (subtitleEl)   subtitleEl.textContent   = t(isSignUp ? 'login.subtitle_signup' : 'login.subtitle');
        if (btnTextEl)    btnTextEl.textContent    = t(isSignUp ? 'login.submit_signup' : 'login.submit');
        if (toggleTextEl) toggleTextEl.textContent = t(isSignUp ? 'login.hasAccount' : 'login.noAccount');
        if (toggleLinkEl) toggleLinkEl.textContent = t(isSignUp ? 'login.signIn' : 'login.signUp');
      }

      // Re-render dynamic lists to apply new language
      if (typeof currentUser !== 'undefined' && currentUser) {
        try {
          if (typeof renderTasks === 'function')       renderTasks();
          if (typeof renderCars === 'function')        renderCars();
          if (typeof renderEvents === 'function')      renderEvents();
          if (typeof renderTasksChips === 'function')  renderTasksChips();
          if (typeof renderCarsChips === 'function')   renderCarsChips();
          if (typeof renderEventsChips === 'function') renderEventsChips();
          if (typeof renderTeam === 'function')        renderTeam();
          if (typeof updatePushUI === 'function')      updatePushUI();
          if (typeof updateNotifUI === 'function')     updateNotifUI();
          if (typeof updatePushLang === 'function')    updatePushLang();
          if (typeof renderTasksDeptChips === 'function') renderTasksDeptChips();
          if (typeof populateDeptSelects === 'function') populateDeptSelects();
          if (typeof renderDeptSettings === 'function') renderDeptSettings();
          if (typeof renderTasksKanban === 'function') renderTasksKanban();
          if (typeof renderUpcoming === 'function')    renderUpcoming(state?.events || []);
          if (typeof renderTopTasks === 'function')    renderTopTasks(state?.tasks || []);
          if (typeof renderStats === 'function')       renderStats(state?.cars || [], state?.tasks || [], state?.events || []);
          if (typeof renderHero === 'function')        renderHero(state?.events || []);

          // Re-render open detail modals so their labels switch language too
          if (typeof openTaskDetailId !== 'undefined' && openTaskDetailId != null &&
              typeof showTaskDetail === 'function') {
            const m = document.getElementById('modal-task-detail');
            if (m && m.classList.contains('show')) showTaskDetail(openTaskDetailId);
          }
          if (typeof openCarDetailId !== 'undefined' && openCarDetailId != null &&
              typeof showCarDetail === 'function') {
            const m = document.getElementById('modal-car-detail');
            if (m && m.classList.contains('show')) showCarDetail(openCarDetailId);
          }
        } catch (_) {}
      }
    }

    document.addEventListener('click', (e) => {
      const langBtn = e.target.closest('.lang-btn');
      if (langBtn) {
        applyLanguage(langBtn.dataset.lang);
      }
      const themeBtn = e.target.closest('.theme-btn');
      if (themeBtn) {
        applyTheme(themeBtn.dataset.themeChoice);
      }
      const accentBtn = e.target.closest('.accent-swatch');
      if (accentBtn) {
        applyAccent(accentBtn.dataset.accent);
      }
    });

    // ----- ACCENT COLOR -----
    const ACCENTS = {
      blue:   ['#3b82f6', '#06b6d4', 'rgba(59,130,246,0.38)'],
      purple: ['#8b5cf6', '#ec4899', 'rgba(139,92,246,0.38)'],
      green:  ['#10b981', '#14b8a6', 'rgba(16,185,129,0.38)'],
      orange: ['#f59e0b', '#ef4444', 'rgba(245,158,11,0.38)'],
      pink:   ['#ec4899', '#8b5cf6', 'rgba(236,72,153,0.38)']
    };
    function currentAccent() { return localStorage.getItem('kultura_accent') || 'blue'; }
    function updateAccentButtons() {
      const a = currentAccent();
      document.querySelectorAll('.accent-swatch').forEach(b => {
        b.classList.toggle('active', b.dataset.accent === a);
      });
    }
    function applyAccent(name) {
      const a = ACCENTS[name] || ACCENTS.blue;
      const r = document.documentElement.style;
      r.setProperty('--accent', a[0]);
      r.setProperty('--accent-2', a[1]);
      r.setProperty('--accent-glow', a[2]);
      try { localStorage.setItem('kultura_accent', name); } catch (_) {}
      updateAccentButtons();
    }
    updateAccentButtons();

    // ----- THEME (light / dark) -----
    function currentTheme() {
      return document.documentElement.getAttribute('data-theme') || 'dark';
    }
    function updateThemeButtons() {
      const th = currentTheme();
      document.querySelectorAll('.theme-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.themeChoice === th);
      });
    }
    function applyTheme(theme) {
      const th = theme === 'light' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', th);
      try { localStorage.setItem('kultura_theme', th); } catch (_) {}
      // Keep the browser UI (status bar) in sync.
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', th === 'light' ? '#eef1f7' : '#07080d');
      updateThemeButtons();
    }
    updateThemeButtons();

    // Apply the persisted language as soon as the DOM is parsed
    document.addEventListener('DOMContentLoaded', () => applyLanguage(currentLang));
    // Also run immediately in case DOMContentLoaded already fired
    if (document.readyState !== 'loading') {
      queueMicrotask(() => applyLanguage(currentLang));
    }

    const el = (id) => document.getElementById(id);
    let isSignUp = false;
    let currentUser = null;
    let authState = { email: null };

    // ----- AUTH UI -----
    const currentUserEmail = () => currentUser?.email || authState.email || '—';
    const currentUserName = () => {
      const u = currentUser;
      if (!u) return authState.email || '—';
      return u.user_metadata?.full_name || u.email;
    };

    function showMsg(kind, text) {
      const m = el('msg');
      m.className = 'msg show ' + kind;
      el('msgIcon').innerHTML = kind === 'error'
        ? '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>'
        : '<polyline points="20 6 9 17 4 12"></polyline>';
      el('msgText').textContent = text;
    }
    function hideMsg() { el('msg').className = 'msg'; }

    el('toggleLink').addEventListener('click', (e) => {
      e.preventDefault();
      isSignUp = !isSignUp;
      el('title').textContent = t(isSignUp ? 'login.title_signup' : 'login.title');
      el('subtitle').textContent = t(isSignUp ? 'login.subtitle_signup' : 'login.subtitle');
      el('btnText').textContent = t(isSignUp ? 'login.submit_signup' : 'login.submit');
      el('toggleText').textContent = t(isSignUp ? 'login.hasAccount' : 'login.noAccount');
      el('toggleLink').textContent = t(isSignUp ? 'login.signIn' : 'login.signUp');
      el('password').autocomplete = isSignUp ? 'new-password' : 'current-password';
      el('signUpFields').style.display = isSignUp ? 'block' : 'none';

      // Toggle required attribute
      const requiredFields = ['firstName', 'lastName', 'phone'];
      requiredFields.forEach(id => {
        el(id).required = isSignUp;
      });

      hideMsg();
    });

    el('togglePwd').addEventListener('click', () => {
      const p = el('password');
      const isPwd = p.type === 'password';
      p.type = isPwd ? 'text' : 'password';
      el('eyeIcon').innerHTML = isPwd
        ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>'
        : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
    });

    el('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      hideMsg();
      const email = el('email').value.trim();
      const password = el('password').value;
      if (password.length < 6) return showMsg('error', 'Parola trebuie să aibă minim 6 caractere');
      const btn = el('submitBtn');
      btn.disabled = true;
      const originalText = el('btnText').textContent;
      el('btnText').innerHTML = '<span class="spinner"></span>';
      try {
        if (isSignUp) {
          const firstName = el('firstName').value.trim();
          const lastName = el('lastName').value.trim();
          const phone = el('phone').value.trim();

          const { data, error } = await supa.auth.signUp({
            email, password,
            options: {
              emailRedirectTo: 'https://zazochannel-art.github.io/Kultura/confirmed.html',
              data: {
                first_name: firstName,
                last_name: lastName,
                phone: phone,
                full_name: `${firstName} ${lastName}`
              }
            }
          });
          if (error) throw error;
          if (data.user && !data.session) {
            showMsg('success', 'Cont creat! Verifică emailul pentru confirmare.');
          } else if (data.session) {
            enterApp(data.session.user);
          }
        } else {
          const { data, error } = await supa.auth.signInWithPassword({ email, password });
          if (error) throw error;
          enterApp(data.user);
        }
      } catch (err) {
        showMsg('error', err.message || 'A apărut o eroare');
      } finally {
        btn.disabled = false;
        el('btnText').textContent = originalText;
      }
    });

    // ----- APP SHELL -----
    function enterApp(user) {
      currentUser = user;
      // A different account sees a different slice of the data under RLS, so
      // never carry a previous session's rows (or its watermark) across.
      resetDeltaSync();
      const email = user.email;
      el('loginView').style.display = 'none';
      el('appView').classList.add('show');

      const meta = user.user_metadata || {};
      el('greetingEmail').textContent = meta.full_name || email;
      el('settingsEmail').textContent = email;
      el('settingsFirstName').value = meta.first_name || '';
      el('settingsLastName').value = meta.last_name || '';
      el('settingsPhone').value = meta.phone || '';
      if (el('profileDeptSelect')) el('profileDeptSelect').value = meta.department || '';

      el('avatarBadge').textContent = (meta.first_name?.charAt(0) || email.charAt(0) || '?').toUpperCase();
      updateAvatarUI(); // upgrades to the photo if profiles are already in state

      // Ensure profile exists in public table for team visibility
      supa.from('profiles').upsert({
        email: email,
        full_name: meta.full_name || email.split('@')[0],
        department: meta.department || ''
      }, { onConflict: 'email' }).then(({error}) => {
        if (error) console.warn("Error auto-creating profile:", error);
        loadData();
      });

      // Paint instantly from the last session's cache, then loadData() refreshes
      // in the background. Falls back to skeletons only when there's no cache.
      const painted = hydrateFromCache();
      // Ensure cars exist for the offline gate even if the full cache is empty.
      if (!(state.cars || []).length) {
        const cached = loadCachedCars();
        if (cached.length) state.cars = cached;
      }
      if (painted) {
        try { populateEventPicker(); } catch (_) {}
        try { applyActiveEvent(); } catch (_) {}
      } else {
        try { showSkeletons(); } catch (_) {}
      }
      loadDepartments();
      loadZoneConfig();
      loadZoneSpots();
      startPolling();
    }
    function leaveApp() {
      stopPolling();
      resetDeltaSync();
      el('appView').classList.remove('show');
      el('loginView').style.display = 'grid';
      el('email').value = '';
      el('password').value = '';
      hideMsg();
    }

    // Tab navigation — sync top desktop tabs + bottom mobile tabs
    function selectSection(name) {
      if (!name) return;
      document.querySelectorAll('.tab, .mtab').forEach(el => {
        el.classList.toggle('active', el.dataset.section === name);
      });
      document.querySelectorAll('.section').forEach(s => {
        s.classList.toggle('active', s.id === 'section-' + name);
      });
      // Trigger the one-shot card stagger for the section we just opened, then
      // clear it so ordinary data refreshes don't re-animate the list.
      const activeSection = document.getElementById('section-' + name);
      if (activeSection) {
        activeSection.classList.add('just-switched');
        clearTimeout(selectSection._t);
        selectSection._t = setTimeout(() => activeSection.classList.remove('just-switched'), 650);
      }
      // Scroll top of content when switching sections on mobile
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (name === 'map') loadMap();
      if (name === 'settings') { try { loadSheetSyncUrl(); } catch (_) {} }
      if (name === 'sms') { try { renderSmsCenter(); } catch (_) {} }
    }
    document.querySelectorAll('.tab, .mtab').forEach(t => {
      t.addEventListener('click', () => selectSection(t.dataset.section));
    });

    // ----- Command palette (Ctrl/Cmd-K): jump to any car, event or task -----
    let _cmdkItems = [], _cmdkIdx = 0;
    function openCmdk() {
      const ov = el('cmdk'); if (!ov) return;
      ov.classList.add('show'); ov.setAttribute('aria-hidden', 'false');
      const inp = el('cmdkInput');
      if (inp) { inp.value = ''; setTimeout(() => inp.focus(), 30); }
      renderCmdk('');
    }
    function closeCmdk() {
      const ov = el('cmdk'); if (!ov) return;
      ov.classList.remove('show'); ov.setAttribute('aria-hidden', 'true');
    }
    function cmdkBuild(q) {
      const s = q.trim().toLowerCase();
      const items = [];
      const hit = (txt) => s && String(txt || '').toLowerCase().includes(s);
      // Cars.
      //
      // At the gate a car is looked up by whatever the person in front of you
      // said — the number on their windscreen, the plate, their name, the phone
      // they registered with. Searching only plate/owner/brand/model meant the
      // entry number, the one thing printed on every pass, found nothing. A
      // bare "247" matches the number itself, not any digits inside a plate.
      const digits = /^#?\d+$/.test(s) ? s.replace('#', '') : null;
      for (const c of (state.cars || [])) {
        const byNo = digits != null && String(c.entry_no) === digits;
        if (!s || byNo || hit(c.plate) || hit(c.owner) || hit(c.brand) || hit(c.model)
            || hit(c.phone) || hit(c.contact)) {
          const name = [c.brand, c.model].filter(Boolean).join(' ') || c.model || '—';
          // The spot rides along, because the answer to "where is #247" is a
          // zone and a number, not a screen to open next.
          const where = (c.spot_no != null && String(c.zone || '').trim())
            ? `${c.zone} · ${t('gate.go_spot')} ${c.spot_no}` : '';
          items.push({
            type: t('cmdk.car'),
            label: (c.entry_no != null ? '#' + c.entry_no + ' · ' : '') + (c.plate || name),
            sub: [name, c.owner, where].filter(Boolean).join(' · '),
            run: () => { selectSection('cars'); setTimeout(() => { try { showCarDetail(c.id); } catch (_) {} }, 60); },
          });
        }
        if (items.length > 40) break;
      }
      // Events
      for (const ev of (state.events || [])) {
        if (!s || hit(ev.title) || hit(ev.name) || hit(ev.location)) {
          items.push({ type: t('cmdk.event'), label: ev.title || ev.name || '—', sub: ev.location || '',
            run: () => { selectSection('events'); } });
        }
      }
      // Tasks
      for (const tk of (state.tasks || [])) {
        if (!s || hit(tk.title)) {
          items.push({ type: t('cmdk.task'), label: tk.title || '—', sub: tk.team || tk.category || '',
            run: () => { selectSection('tasks'); } });
        }
        if (items.length > 90) break;
      }
      return items.slice(0, 30);
    }
    function renderCmdk(q) {
      const box = el('cmdkResults'); if (!box) return;
      _cmdkItems = cmdkBuild(q); _cmdkIdx = 0;
      if (!_cmdkItems.length) { box.innerHTML = `<div class="cmdk-empty">${escape(t('cmdk.empty'))}</div>`; return; }
      box.innerHTML = _cmdkItems.map((it, i) => `
        <button class="cmdk-item${i === 0 ? ' active' : ''}" data-cmdk-i="${i}">
          <span class="cmdk-type">${escape(it.type)}</span>
          <span class="cmdk-label">${escape(it.label)}</span>
          ${it.sub ? `<span class="cmdk-sub">${escape(it.sub)}</span>` : ''}
        </button>`).join('');
    }
    function cmdkRun(i) {
      const it = _cmdkItems[i]; if (!it) return;
      closeCmdk();
      try { it.run(); } catch (_) {}
    }
    function cmdkMove(delta) {
      const box = el('cmdkResults'); if (!box || !_cmdkItems.length) return;
      _cmdkIdx = (_cmdkIdx + delta + _cmdkItems.length) % _cmdkItems.length;
      box.querySelectorAll('.cmdk-item').forEach((b, i) => b.classList.toggle('active', i === _cmdkIdx));
      const act = box.querySelector('.cmdk-item.active');
      if (act) act.scrollIntoView({ block: 'nearest' });
    }
    el('cmdkInput')?.addEventListener('input', (e) => renderCmdk(e.target.value));
    el('cmdkInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); cmdkMove(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); cmdkMove(-1); }
      else if (e.key === 'Enter') { e.preventDefault(); cmdkRun(_cmdkIdx); }
      else if (e.key === 'Escape') { e.preventDefault(); closeCmdk(); }
    });
    el('cmdkResults')?.addEventListener('click', (e) => {
      const b = e.target.closest('[data-cmdk-i]'); if (b) cmdkRun(parseInt(b.dataset.cmdkI, 10));
    });
    el('cmdk')?.addEventListener('click', (e) => { if (e.target === el('cmdk')) closeCmdk(); });
    el('cmdkOpenBtn')?.addEventListener('click', openCmdk);
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        const ov = el('cmdk');
        if (ov && ov.classList.contains('show')) closeCmdk(); else openCmdk();
        return;
      }
      // Escape must work even before the input takes focus, or if focus moved
      // elsewhere — otherwise the palette can only be dismissed by clicking out.
      if (e.key === 'Escape' && el('cmdk')?.classList.contains('show')) {
        e.preventDefault();
        closeCmdk();
      }
    });

    // ----- ZONE MAP -----
    let _mapUrl = null;
    // When the map is a drawn plan, this is the plan itself. It is rendered as
    // SVG in the page rather than as a picture: a raster has a resolution and
    // the gate zooms to 8x, which is where it turns to mush. A drawing has none.
    let _plan = null, _planUrl = null;

    // A plan is a drawing plus the bays laid out on it. It used to be one
    // drawing named by a constant in this file and one bay list in ui_settings,
    // which meant a venue had exactly one layout: preparing the next event
    // erased the one before it, and a new drawing needed a deploy. Now a plan
    // is a row, and an event is laid out on one of them.
    let ZONE_PLANS = [];        // the library, without the bays: id, name, where
    let _planId = null;         // the plan the active event is laid out on
    let _planName = '';

    // Record the choice on the event in memory as well as in the table. Looked
    // up again by id rather than through a reference taken earlier: a dialog and
    // a write are two awaits, and a refresh landing in between replaces every
    // row in `state.events`. Mutating the object we were holding would then
    // change something nothing renders from — the table right, the screen wrong
    // until the next reload.
    function setEventPlanLocally(eventId, planId) {
      const row = (state.events || []).find(e => String(e.id) === String(eventId));
      if (row) row.plan_id = planId;
    }
    function activeEventPlanId() {
      const ev = (state.events || []).find(e => String(e.id) === String(state.activeEventId));
      return ev && ev.plan_id != null ? ev.plan_id : null;
    }
    // Where a drawing may come from: our own plans bucket, or a file shipped
    // with the app. The rule itself lives in utils.js, where it is tested.
    const PLANS_PREFIX = SUPABASE_URL + '/storage/v1/object/public/plans/';

    // Bays as they come out of storage. Clamped on read as well as on write: a
    // bad row must not put a bay outside the drawing, where nobody can reach it.
    function normaliseSpots(raw) {
      let arr = raw;
      if (typeof arr === 'string') { try { arr = JSON.parse(arr); } catch (_) { arr = null; } }
      if (!Array.isArray(arr)) return [];
      return arr
        .filter(s => s && s.zone && Number.isFinite(+s.no))
        .map(s => {
          const sp = {
            zone: String(s.zone).trim(),
            no: Math.max(1, parseInt(s.no, 10) || 1),
            x: Math.min(100, Math.max(0, Number(s.x) || 0)),
            y: Math.min(100, Math.max(0, Number(s.y) || 0)),
          };
          // A bay that came from a drawing knows how big it is and which way it
          // faces. That is what lets the pin be a car parked in it rather than a
          // dot near it. One dropped on a photo has none of that, and stays a dot.
          if (Number.isFinite(+s.r)) sp.r = ((+s.r % 360) + 360) % 360;
          if (+s.w > 0 && +s.h > 0) {
            sp.w = Math.min(100, +s.w);
            sp.h = Math.min(100, +s.h);
          }
          // A colour goes into a style attribute, so it is checked rather than
          // trusted: the row is editable and this is markup.
          if (/^#[0-9a-f]{3,8}$/i.test(String(s.c || ''))) sp.c = String(s.c);
          // Held back on purpose — for a guest, a truck, a fire lane. Free, but
          // not free to hand out.
          if (s.res) sp.res = true;
          return sp;
        });
    }

    async function loadPlanLibrary() {
      try {
        const { data } = await supa.from('zone_plans')
          .select('id,name,plan_path,map_url,updated_at')
          .order('updated_at', { ascending: false });
        ZONE_PLANS = Array.isArray(data) ? data : [];
      } catch (_) { ZONE_PLANS = []; }
      try { renderPlanList(); } catch (_) {}
    }

    // The active event's plan: drawing and bays in one read, because they are
    // one thing. Bays without their drawing are numbers floating on nothing.
    async function loadActivePlan() {
      const id = activeEventPlanId();
      _planId = id;
      _planName = '';
      _mapUrl = null; _planUrl = null; _plan = null;
      ZONE_SPOTS = [];
      if (id != null) {
        try {
          const { data } = await supa.from('zone_plans')
            .select('id,name,plan_path,map_url,spots').eq('id', id).maybeSingle();
          if (data) {
            _planName = data.name || '';
            _mapUrl = data.map_url || null;
            _planUrl = data.plan_path || null;
            ZONE_SPOTS = normaliseSpots(data.spots);
          } else {
            _planId = null;   // the row is gone; the event points at nothing
          }
        } catch (_) { /* the empty map says so */ }
      }
      if (_planUrl) {
        try {
          if (!planDrawingOk(_planUrl, PLANS_PREFIX)) throw new Error('path');
          const r = await fetch(_planUrl, { cache: 'no-cache' });
          if (!r.ok) throw new Error(String(r.status));
          _plan = await r.json();
        } catch (_) {
          _plan = null;   // the picture, if there is one, is the fallback
        }
      }
      // A different drawing is a different size: what the last one was laid out
      // at says nothing about this one, and a stale scale draws it at the wrong
      // one — cars included, since they are drawn against the same view.
      _shownZoom = -1;
      _planScale = 0;
      renderMap();
      try { renderMapSpots(); } catch (_) {}
      try { renderPlanList(); } catch (_) {}
      // Home counts the bays, and the plan arrives after Home has drawn itself.
      // Without this the strip says "0 spots on the plan" until something else
      // happens to repaint it.
      try { renderParkStrip(); } catch (_) {}
    }
    async function loadMap() {
      await loadPlanLibrary();
      await loadActivePlan();
    }
    function renderMap() {
      const staff = roleAtLeast('staff');
      const actions = el('mapActions');
      if (actions) actions.style.display = staff ? 'flex' : 'none';
      const delBtn = el('mapDeleteBtn');
      if (delBtn) delBtn.style.display = (staff && (_plan || _mapUrl)) ? 'inline-flex' : 'none';
      const editBtn = el('mapEditBtn');
      if (editBtn) editBtn.style.display = (staff && (_plan || _mapUrl)) ? 'inline-flex' : 'none';
      // A map that is gone cannot be edited, and a mode left on over an empty
      // frame is a crosshair cursor with nothing under it.
      if (_spotEdit && !(_plan || _mapUrl)) { _spotEdit = false; _spotRow = false; _rowFrom = null; _spotAdd = false; _spotPick = null; }

      const container = el('mapContainer');
      if (!container) return;
      if (_plan || _mapUrl) {
        // The spot layer sits inside the same wrapper as the image so both scale
        // together — percentages only mean anything against the rendered photo.
        // The viewport clips; the wrapper inside it is what zooms and pans, so
        // the image and its spots move as one piece.
        container.innerHTML = `<div class="map-viewport" id="mapViewport">`
          + `<div class="map-image-wrap" id="mapImageWrap">`
          + (_plan
            ? `<div class="map-plan" id="mapPlan" role="img" aria-label="${escape(t('map.title'))}"></div>`
              + `<svg class="map-cars" id="mapCars" aria-hidden="true" preserveAspectRatio="xMidYMid meet"></svg>`
            : `<img src="${escape(_mapUrl)}" alt="${escape(t('map.title'))}" id="mapImage" draggable="false">`)
          + `<div class="map-spot-layer" id="mapSpotLayer"></div>`
          + `</div>`
          + `<div class="map-zoom">`
          + `<button type="button" id="mapZoomOut" aria-label="${escape(t('map.zoom_out'))}" title="${escape(t('map.zoom_out'))}">&minus;</button>`
          + `<span class="map-zoom-val" id="mapZoomVal">100%</span>`
          + `<button type="button" id="mapZoomIn" aria-label="${escape(t('map.zoom_in'))}" title="${escape(t('map.zoom_in'))}">+</button>`
          + `<button type="button" id="mapZoomReset" aria-label="${escape(t('map.zoom_reset'))}" title="${escape(t('map.zoom_reset'))}">100%</button>`
          + `</div>`
          + `</div>`;
        // A rebuilt map brings new elements: what the old ones were showing
        // says nothing about them, and the size the last wrapper was laid out
        // at says nothing about this one.
        _shownZoom = -1;
        _mapLaidAt = 0;
        _mapFrame = null;
        // After the plan is drawn: the frame's proportions are the drawing's,
        // and until it is rendered nothing knows what those are.
        if (_plan) renderPlanVector();
        setMapFrameRatio();
        applyMapTransform();
        // Opening the lightbox would swallow every tap meant for a spot, so it
        // moves to its own control while spots are being placed or read.
        // A photo only knows its shape once it has arrived.
        if (el('mapImage')) el('mapImage').onload = setMapFrameRatio;
        if (el('mapImage')) el('mapImage').onclick = (e) => {
          if (_spotEdit || ZONE_SPOTS.length || _mapZoom > 1.01 || _mapPanMoved) return;
          e.preventDefault(); openLightbox(_mapUrl);
        };
        try { renderMapSpots(); } catch (_) {}
      } else {
        const others = ZONE_PLANS.length;
        container.innerHTML = `
          <div class="map-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
            <p>${escape(others ? t('plans.none_for_event') : t('map.empty'))}</p>
            <p class="map-empty-hint">${escape(others && staff ? t('plans.pick_hint', { n: others }) : t('map.empty_hint'))}</p>
          </div>`;
      }
      renderZoneCfg();
      renderZones();
    }

    // ----- ZONE CAPACITY (admin-configurable, real-time occupancy) -----
    let ZONE_CONFIG = []; // [{ name, capacity }]
    function zoneCapacityOf(name) {
      const key = (name || '').trim().toLowerCase();
      const z = ZONE_CONFIG.find(x => x.name.trim().toLowerCase() === key);
      return (z && z.capacity > 0) ? z.capacity : null;
    }
    async function loadZoneConfig() {
      try {
        const { data } = await supa.from('ui_settings').select('value').eq('key', 'zone_config').maybeSingle();
        let arr = null;
        if (data && data.value) { try { arr = typeof data.value === 'string' ? JSON.parse(data.value) : data.value; } catch (_) {} }
        if (Array.isArray(arr)) {
          ZONE_CONFIG = arr.filter(z => z && z.name).map(z => ({ name: String(z.name).trim(), capacity: Math.max(1, parseInt(z.capacity, 10) || 0) }));
        }
      } catch (_) {}
      renderZoneCfg();
      try { renderZones(); } catch (_) {}
    }
    async function saveZoneConfig(next) {
      ZONE_CONFIG = next;
      const { error } = await supa.from('ui_settings').upsert(
        { key: 'zone_config', value: JSON.stringify(next), updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );
      if (error) { uiAlert(t('common.error') + ': ' + error.message); return false; }
      renderZoneCfg();
      try { renderZones(); } catch (_) {}
      showToast(t('zonecap.saved'));
      return true;
    }
    function renderZoneCfg() {
      const block = el('zoneCfgBlock');
      if (block) block.style.display = isAdmin() ? 'block' : 'none';
      const list = el('zoneCfgList');
      if (!list) return;
      list.innerHTML = ZONE_CONFIG.length
        ? ZONE_CONFIG.map((z, i) => `
          <div class="zonecfg-item">
            <span class="zonecfg-name">${escape(z.name)}</span>
            <span class="zonecfg-cap">${z.capacity} ${escape(t('zonecap.spots'))}</span>
            <button type="button" class="dept-item-del" data-zonecfg-del="${i}" aria-label="${escape(t('common.delete'))}">&times;</button>
          </div>`).join('')
        : `<p class="dept-empty">${escape(t('zonecap.none'))}</p>`;
    }
    // Live occupancy per zone (respects the active-event filter).
    function zoneOccupancy() {
      const counts = new Map();
      activeCars().forEach(c => {
        const z = (c.zone || '').trim();
        if (!z) return;
        const k = z.toLowerCase();
        if (!counts.has(k)) counts.set(k, { name: z, assigned: 0, arrived: 0 });
        const o = counts.get(k);
        o.assigned++;
        if (statusKey(c.status) === 'sosit') o.arrived++;
      });
      ZONE_CONFIG.forEach(z => {
        const k = z.name.trim().toLowerCase();
        if (!counts.has(k)) counts.set(k, { name: z.name.trim(), assigned: 0, arrived: 0 });
      });
      return [...counts.values()].map(o => {
        const cap = zoneCapacityOf(o.name);
        return { ...o, capacity: cap, free: cap != null ? Math.max(0, cap - o.assigned) : null };
      });
    }

    // ----- NUMBERED PARKING SPOTS ON THE MAP -----
    //
    // The zone answers "roughly where". With 52 cars in one field that stopped
    // being enough to send a driver anywhere, so a zone can now be given
    // numbered spots placed on the venue photo, and a car sits on one of them.
    //
    // Positions are percentages of the image, never pixels: the same plan has to
    // survive a phone, a laptop and a projector without drifting off the tarmac.
    //
    // The spot list is layout — it belongs with the map, in ui_settings. Which
    // car is on which spot is data about the car, so it lives on `cars.spot_no`,
    // guarded by a unique index: two drivers must never be sent to one square.
    let ZONE_SPOTS = [];            // [{ zone, no, x, y }]
    let _spotEdit = false;          // placing/moving spots
    let _spotEditZone = '';         // which zone new spots belong to
    let _spotRow = false;           // laying a whole row instead of one spot
    let _rowFrom = null;            // first end of the row being laid
    let _spotAdd = false;           // armed to drop the next tap as a spot
    let _spotPick = null;           // the bay picked up for turning or deleting
    let _spotDragged = false;       // a drag just ended; its click is not a tap

    const spotKey = (zone, no) => (zone || '').trim().toLowerCase() + '#' + no;
    // The ink a zone's bays are drawn in, taken from the bays it already has.
    // It arrived with the plan; a bay added by hand afterwards has to inherit
    // it, or a car parked on it comes out the fallback blue in a yellow zone.
    function zoneInk(zone) {
      const mine = spotsOfZone(zone).find(sp => sp.c);
      return mine ? mine.c : '';
    }

    // The bay of the same zone nearest a point on the plan. Bays in a rank all
    // point the same way, so a new one dropped beside them takes its heading
    // from its neighbour — added on its own it would sit square to the page in
    // a row drawn on the diagonal. Distance is measured on the drawing, not on
    // the percentages: one percent across and one down are not the same length.
    function neighbourSpot(zone, at) {
      const v = _planView;
      const ax = v ? v.w : 1, ay = v ? v.h : 1;
      let best = null, bestD = Infinity;
      for (const sp of spotsOfZone(zone)) {
        const dx = (sp.x - at.x) * ax, dy = (sp.y - at.y) * ay;
        const d = dx * dx + dy * dy;
        if (d < bestD) { bestD = d; best = sp; }
      }
      return best;
    }

    function spotsOfZone(zone) {
      const k = (zone || '').trim().toLowerCase();
      return ZONE_SPOTS.filter(s => s.zone.trim().toLowerCase() === k)
        .sort((a, b) => a.no - b.no);
    }
    // Car currently on a spot, within the active event.
    function carOnSpot(zone, no) {
      const k = (zone || '').trim().toLowerCase();
      return activeCars().find(c =>
        c.spot_no === no && (c.zone || '').trim().toLowerCase() === k) || null;
    }
    // Hand out `count` spot numbers for a zone, filling gaps before extending
    // the range: deleting spot 3 and adding one again gives you 3 back instead
    // of an ever-growing set of numbers.
    function allocSpotNumbers(zone, count) {
      const used = new Set(spotsOfZone(zone).map(sp => sp.no));
      const out = [];
      for (let n = 1; out.length < count; n++) { if (!used.has(n)) out.push(n); }
      return out;
    }
    // Lowest free number in a zone, or null when the zone is full or has none.
    function nextFreeSpot(zone) {
      for (const s of spotsOfZone(zone)) {
        if (!carOnSpot(zone, s.no)) return s.no;
      }
      return null;
    }

    // The bays are part of the plan, so loading them is loading it.
    async function loadZoneSpots() { await loadActivePlan(); }

    async function saveZoneSpots(next) {
      // Bays belong to a plan. Without one there is nothing to write them to,
      // and silently dropping the edit would look like the app forgetting.
      if (_planId == null) { showToast(t('plans.none_for_event'), 'error'); return false; }
      ZONE_SPOTS = next;
      const { error } = await supa.from('zone_plans')
        .update({ spots: next, updated_at: new Date().toISOString() })
        .eq('id', _planId);
      if (error) { uiAlert(t('common.error') + ': ' + error.message); return false; }
      renderMapSpots();
      return true;
    }

    // A car seen from above, drawn inside its bay: the local box is one bay —
    // 2.5 by 5 metres — and the car in it is the 2 by 4.4 that actually fits
    // there, which is why a parked car never touches the lines it stands
    // between.
    //
    // Every car is drawn on one shared SVG under the pins rather than one SVG
    // inside each pin. Two hundred and thirty-eight little documents cost the
    // compositor twice the work of the same shapes on a single one — 314ms of
    // Layerize per pan against 167ms, measured on a throttled phone — and every
    // one of them was hit-tested on the way to the button wrapping it.
    //
    // The caption is drawn in the same box, so it is the size of the car it
    // names. Held at a fixed size on screen instead, it came out wider than the
    // whole bay: a number twice the length of the car it belonged to, over a
    // plan that draws two hundred more. It sits on the boot rather than across
    // the middle, because a number over the cabin takes away the one detail
    // that makes the shape read as a car at all, and it is set to the width of
    // the car: a plate is longer than an entry number, and left to itself it
    // hangs out over both neighbours — half the width of the bay, which also
    // keeps it clear of the tail lights at either corner. It carries the
    // counter-rotation because the bay is turned, and a number read sideways is
    // not read.
    // ===== THE CAR, TRACED FROM THE REFERENCE DRAWING =====
    // Not drawn by hand. Four hand-drawn passes each got closer and none got
    // there, so the reference picture is vectorised instead: its line work,
    // its shaded pillars and its red lamps come out as closed contours, and
    // the silhouette is taken from the drawing itself rather than drawn
    // again — the two would drift apart at the first edit.
    //
    // `scripts/trace-car.py` regenerates these from `docs/car-top.jpg`. They
    // are generated output: edit the script or the picture, never the numbers.
    //
    // The car is laid out nose-up in a 50 by 100 box — one bay, 2.5 by 5 m —
    // with its length filling 88 of the 100 and its width following at the
    // same scale, so nothing is stretched.
    const CAR_SILH = 'M47.42 37.87L47.05 36.77L46.18 35.90L44.20 34.87L43.24 34.65L43.17 22.85L42.95 18.31L42.59 15.'
      + '75L41.85 13.62L40.61 11.42L39.07 9.74L37.97 8.93L35.18 7.54L31.67 6.66L25.66 6.07L20.53 6.22L1'
      + '6.50 6.81L13.35 7.76L10.49 9.44L8.51 11.57L7.05 14.43L6.32 18.02L5.95 24.61L5.88 35.09L3.60 36'
      + '.26L2.80 37.07L2.43 37.87L2.36 38.75L2.58 39.19L2.95 39.27L5.80 38.31L5.51 50.62L5.22 51.14L5.'
      + '14 51.87L5.14 53.33L5.44 54.21L5.36 62.93L5.58 69.38L5.29 70.77L5.29 72.82L5.58 73.70L5.73 81.'
      + '47L6.24 85.72L6.76 87.55L7.85 89.75L9.54 91.36L12.54 92.83L16.13 93.71L21.70 94.15L28.96 94.07'
      + 'L32.77 93.71L36.28 92.90L39.51 91.36L40.24 90.85L41.41 89.60L42.66 86.89L43.24 84.03L43.54 79.'
      + '71L43.54 73.85L43.90 72.82L43.90 70.77L43.61 70.11L43.61 68.65L43.76 65.28L43.68 54.29L43.98 5'
      + '3.48L43.98 51.43L43.61 50.48L43.39 37.80L46.47 38.83L47.13 38.83L47.42 38.31Z';
    const CAR_GREY = 'M41.56 58.10L39.65 58.68L37.60 59.05L37.46 59.27L40.75 58.54L41.56 58.24ZM40.90 71.51L37.31 72'
      + '.09L37.16 72.38L39.73 72.02L40.83 71.73ZM39.87 30.55L39.14 29.89L37.46 29.15L33.21 27.91L29.10'
      + ' 27.25L22.95 27.03L18.26 27.47L14.08 28.35L11.66 29.15L9.61 30.11L9.32 30.33L9.32 30.91L11.37 '
      + '29.74L14.67 28.64L18.70 27.84L22.66 27.47L27.49 27.54L31.23 27.98L35.92 29.08L37.75 29.74L39.4'
      + '3 30.62L39.80 30.99ZM39.73 31.43L39.65 31.13L39.14 30.69L37.53 29.89L32.55 28.42L29.98 27.98L2'
      + '6.69 27.69L22.22 27.69L18.48 28.05L13.79 29.08L11.52 29.89L10.05 30.62L9.39 31.21L9.39 31.94L1'
      + '0.05 31.43L11.74 30.62L15.11 29.52L19.43 28.71L23.02 28.42L27.12 28.49L31.30 29.01L34.82 29.81'
      + 'L37.24 30.62L39.00 31.43L39.65 32.08ZM37.90 87.19L37.46 85.72L36.50 83.82L36.14 83.52L37.16 85'
      + '.43L37.60 86.97L37.75 86.97L37.68 87.26ZM37.09 44.54L33.50 43.81L28.30 43.22L28.30 43.52L33.21'
      + ' 44.03L36.94 44.91ZM37.09 88.50L35.77 89.24L35.62 89.16L35.70 89.31L35.40 89.24L32.11 90.04L32'
      + '.47 90.19L35.04 89.60L36.58 89.02ZM33.72 8.86L29.84 8.05L26.03 7.76L30.28 8.20ZM28.15 43.44L27'
      + '.71 42.27L27.78 43.08L27.56 43.30L26.25 43.15L21.41 43.22L21.19 42.64L21.04 43.22L21.04 43.44Z'
      + 'M27.64 42.86L27.49 42.27L27.05 42.12L21.78 42.12L21.41 42.49L21.41 43.00L25.59 42.93L27.56 43.'
      + '08ZM20.97 43.15L15.84 43.74L11.88 44.54L11.96 44.83L12.18 44.83L16.50 43.88L20.82 43.52ZM17.09'
      + ' 90.34L16.72 90.19L16.79 90.04L14.82 89.75L12.91 89.09L14.08 89.75ZM11.88 72.16L8.15 71.43L8.2'
      + '2 71.73L9.76 72.09L11.52 72.38L11.88 72.38ZM11.59 59.12L7.56 58.10L7.63 58.32L9.17 58.76L11.52'
      + ' 59.27ZM11.52 57.07L7.49 55.46L7.49 55.61L8.88 56.26L11.30 57.14Z';
    const CAR_LAMP = 'M41.49 85.57L40.17 86.31L39.36 88.06L38.19 89.38L36.94 90.12L35.99 90.41L35.99 90.85L37.97 90.'
      + '26L40.02 88.87L40.90 87.63ZM41.19 86.01L40.31 88.21L39.51 88.94L39.14 88.87L38.92 89.02L38.63 '
      + '89.31L38.78 89.38L38.63 89.60L37.97 89.82L39.51 88.28L40.39 86.45ZM40.90 86.53L40.75 86.45L40.'
      + '39 86.75L40.39 87.11L39.95 87.55L39.65 88.50L40.46 87.70ZM35.84 90.92L35.77 90.63L35.55 90.56L'
      + '33.43 91.07L32.99 91.29L32.99 91.51ZM15.77 91.51L15.18 91.07L12.84 90.48L13.06 91.00ZM12.76 90'
      + '.78L12.62 90.34L11.37 89.75L10.27 88.80L8.88 86.38L8.73 86.38L8.81 86.67L9.25 87.19L9.25 87.41'
      + 'L9.10 87.41L9.17 87.55L9.32 87.41L10.27 89.16L11.37 89.97L10.64 89.68L9.83 89.02L9.54 88.50L9.'
      + '03 88.43L8.81 88.21L7.93 86.31L7.93 86.09L8.07 86.09L8.66 86.60L8.59 86.16L7.63 85.50L8.07 87.'
      + '26L8.95 88.72L10.27 89.90L12.47 90.85ZM9.25 88.06L8.95 87.19L8.22 86.53L8.73 87.85L9.10 88.21Z';
    const CAR_INK = 'M47.35 37.65L47.05 36.85L46.32 36.04L44.78 35.16L43.24 34.65L43.10 21.53L42.88 18.02L42.44 15.'
      + '31L41.93 13.84L40.61 11.50L39.00 9.74L38.12 9.08L35.99 7.91L34.45 7.32L30.94 6.59L24.63 6.07L2'
      + '0.24 6.29L16.28 6.88L13.28 7.83L11.74 8.64L10.20 9.74L8.37 11.86L7.19 14.13L6.76 15.53L6.39 17'
      + '.72L6.02 23.44L5.95 35.09L4.63 35.68L3.02 36.85L2.51 37.80L2.43 38.83L2.65 39.19L3.16 39.19L5.'
      + '80 38.31L5.58 50.55L5.22 51.43L5.22 53.63L5.51 54.21L5.44 65.35L5.58 68.43L5.58 70.19L5.29 71.'
      + '07L5.29 72.31L5.66 73.92L5.80 82.06L6.17 85.06L6.83 87.63L7.85 89.68L9.39 91.22L12.25 92.68L14'
      + '.74 93.41L16.50 93.71L22.88 94.15L29.32 94.00L33.43 93.56L36.72 92.68L39.87 91.07L41.56 89.31L'
      + '42.73 86.53L43.17 84.25L43.46 81.03L43.54 73.78L43.76 73.48L43.90 72.16L43.83 70.55L43.61 70.1'
      + '9L43.54 69.38L43.68 66.67L43.68 54.21L43.90 53.77L43.98 51.94L43.90 51.14L43.61 50.55L43.32 37'
      + '.73L46.10 38.68L47.05 38.83L47.35 38.46ZM47.13 37.73L47.13 38.31L46.91 38.31L42.88 36.92L42.44'
      + ' 35.31L42.95 34.87L43.32 34.87L45.30 35.68L46.54 36.55ZM46.76 38.46L46.18 38.46L42.88 37.36L42'
      + '.73 37.14ZM43.54 51.36L43.54 53.63L43.39 54.14L43.17 54.29L43.02 53.55L43.24 53.48L43.39 53.11'
      + 'L43.39 51.72L42.95 51.06L43.10 50.55L43.24 50.55ZM43.46 54.51L43.46 55.53L43.32 55.75L42.51 56'
      + '.56L41.85 56.70L42.07 46.74L41.93 36.33L42.15 36.41L42.15 36.92L42.37 37.29L42.59 47.40L42.51 '
      + '37.43L43.10 37.65L43.39 50.33L43.10 50.18L42.81 50.70L42.66 52.75L42.88 54.14L43.17 54.58ZM43.'
      + '46 55.75L43.39 69.82L42.88 69.82L42.66 70.77L42.66 72.97L42.95 74.00L43.32 74.07L43.32 74.80L4'
      + '1.93 76.85L42.59 67.70L42.59 60.59L42.44 68.21L41.78 76.93L41.12 77.81L40.02 78.03L40.90 73.70'
      + 'L41.56 67.11L41.85 56.85L42.66 56.63L42.73 57.51L42.73 56.56ZM43.46 70.77L43.46 72.97L43.10 73'
      + '.78L42.95 73.04L43.17 72.97L43.32 72.60L43.32 71.07L42.95 70.70L42.95 70.26L43.17 70.04ZM43.32'
      + ' 75.17L43.10 82.86L42.73 85.50L42.00 87.92L41.12 89.53L40.17 90.56L38.48 91.66L36.06 92.68L32.'
      + '25 93.49L26.17 93.93L20.82 93.85L15.11 93.27L11.96 92.31L9.39 90.92L8.15 89.68L7.12 87.77L6.54'
      + ' 85.72L6.10 82.79L5.88 78.54L5.95 75.10L7.34 77.51L7.63 80.88L8.29 85.06L8.37 83.89L7.93 81.98'
      + 'L7.41 77.51L8.37 78.17L9.17 78.17L10.64 77.29L11.66 76.27L11.88 79.57L12.32 82.64L11.08 84.99L'
      + '10.42 87.04L8.73 86.01L8.44 85.35L8.44 85.72L8.29 85.72L7.63 85.13L7.27 85.13L7.27 85.28L8.07 '
      + '87.77L9.10 89.24L10.35 90.19L11.59 90.78L12.76 91.07L13.28 91.95L14.01 92.53L15.55 93.05L16.87'
      + ' 93.12L14.45 92.61L13.64 92.09L13.06 91.22L15.33 91.73L16.28 91.66L18.55 92.02L24.05 92.39L30.'
      + '06 92.02L32.40 91.66L33.35 91.73L35.84 91.22L34.82 92.39L34.01 92.75L32.33 93.05L32.77 93.12L3'
      + '4.16 92.83L35.18 92.31L35.92 91.51L36.06 91.07L37.97 90.48L39.95 89.24L41.05 87.77L41.78 85.57'
      + 'L41.71 85.13L40.75 85.72L40.61 85.50L40.53 85.87L39.80 86.45L38.78 87.04L38.63 86.97L37.90 84.'
      + '91L36.65 82.64L37.38 76.27L38.48 77.37L39.87 78.17L40.97 78.10L41.71 77.51L41.19 81.91L40.46 8'
      + '4.55L40.53 84.84L40.97 83.60L40.75 85.50L41.27 82.64L41.85 77.22L42.81 75.98L43.17 75.17ZM43.2'
      + '4 51.80L43.24 53.04L43.17 53.33L42.95 53.41L42.88 51.50L43.02 51.36ZM43.17 71.14L43.17 72.53L4'
      + '3.10 72.82L42.88 72.90L42.81 71.29L42.88 70.92L43.10 70.92ZM43.02 28.35L42.95 31.87L42.37 32.2'
      + '3L42.07 26.22L41.34 18.46L41.49 16.99L42.00 14.94L42.44 16.48L42.73 19.12ZM43.02 33.48L43.02 3'
      + '4.65L42.73 34.72L42.44 34.43L42.37 32.45L42.81 32.08L42.95 32.08ZM42.73 36.77L42.73 36.99L42.4'
      + '4 36.99L42.37 35.60ZM42.51 34.80L42.15 35.16L41.63 34.65L41.63 34.14ZM42.29 33.40L42.22 34.28L'
      + '42.07 34.14L42.00 32.82L42.22 32.67ZM42.22 31.06L42.22 32.45L41.71 32.96L41.56 32.96L41.05 31.'
      + '87L40.39 31.50L40.53 28.27L40.46 23.29L39.80 16.26L39.73 16.92L40.31 23.29L40.39 28.27L40.31 2'
      + '9.74L39.51 28.93L39.00 28.05L38.70 27.03L36.65 17.80L34.45 9.96L36.06 11.28L38.34 13.62L39.43 '
      + '14.87L39.58 15.60L39.58 15.16L39.73 15.16L40.09 15.60L40.83 15.89L41.63 23.00ZM41.85 14.50L41.'
      + '85 15.31L41.19 17.80L40.90 15.97L41.19 15.23L41.19 13.99L40.75 13.03ZM41.85 42.27L41.63 55.17L'
      + '39.00 56.34L37.53 56.78L37.90 51.28L38.48 46.23L40.31 37.95L41.71 36.77ZM41.63 36.33L40.53 37.'
      + '43L40.90 36.04L41.12 36.55ZM41.63 55.46L40.39 56.19L37.53 57.22L37.68 57.00L39.73 56.34ZM41.63'
      + ' 58.54L41.56 63.67L40.97 71.14L38.92 71.65L37.09 71.87L37.38 59.49L38.92 59.27ZM41.56 58.02L41'
      + '.56 58.24L40.75 58.54L37.46 59.27L37.60 59.05L39.65 58.68ZM41.49 13.55L38.92 11.06L35.99 9.22L'
      + '33.87 8.42L33.87 8.05L34.23 7.83L35.55 7.98L38.63 9.74L40.09 11.20ZM41.49 33.11L40.61 35.90L39'
      + '.07 42.05L37.90 49.01L37.38 55.31L36.94 65.06L36.87 72.68L36.94 74.95L37.24 76.12L36.80 80.66L'
      + '36.43 82.28L35.99 81.76L35.18 81.47L35.70 65.35L36.43 54.51L37.53 45.71L39.29 38.09L40.31 31.8'
      + '7L40.53 31.65L41.05 32.08ZM41.49 85.50L40.90 87.63L40.02 88.87L37.97 90.26L35.99 90.85L35.99 9'
      + '0.41L36.94 90.12L38.19 89.38L39.36 88.06L40.17 86.31ZM41.19 86.09L41.05 86.01L40.39 86.45L39.2'
      + '9 88.58L38.70 89.02L38.41 89.53L37.68 89.97L38.63 89.60L38.78 89.46L38.63 89.31L38.92 89.02L39'
      + '.43 88.72L39.21 89.16L40.31 88.21ZM40.97 14.06L40.83 15.38L40.31 13.69L39.43 12.52L37.02 10.62'
      + 'L34.60 9.30L37.31 10.98L39.73 13.03L40.39 14.21L40.75 15.53L40.53 15.60L40.17 15.38L38.12 13.0'
      + '3L34.16 9.30L33.94 8.64L36.06 9.52L38.63 11.13L40.17 12.52ZM40.90 71.43L40.90 71.65L40.61 71.8'
      + '0L37.16 72.38L37.31 72.09ZM40.90 72.02L40.39 75.76L39.87 77.73L39.65 77.88L38.12 76.78L37.38 7'
      + '5.90L37.16 75.17L37.09 72.68ZM40.90 86.45L40.46 87.70L39.65 88.50L39.95 87.55L40.39 87.11L40.3'
      + '9 86.75ZM40.83 56.85L40.61 56.92L40.83 57.07L40.46 57.14L40.31 56.92L40.31 56.78L40.46 56.92L4'
      + '0.46 56.70L40.24 56.48L40.68 56.41L40.53 56.85ZM40.24 29.89L40.17 30.55L39.65 29.89L37.46 28.8'
      + '6L34.97 28.05L31.15 27.25L26.76 26.81L22.22 26.81L18.41 27.18L14.16 28.05L10.27 29.45L9.47 29.'
      + '89L8.81 30.55L8.81 29.67L8.95 29.59L8.73 29.45L8.73 25.42L9.03 19.56L9.39 16.62L9.25 16.48L8.6'
      + '6 23.81L8.73 31.50L8.22 31.87L7.56 33.11L6.90 32.45L6.98 29.67L7.56 22.12L8.29 15.82L9.03 15.6'
      + '0L9.47 15.16L9.39 16.33L9.69 14.87L11.30 13.03L14.74 9.81L14.08 11.50L12.91 15.67L10.13 27.98L'
      + '9.69 28.86L8.95 29.59L9.76 28.93L11.81 27.98L15.99 26.81L22.36 26.00L26.61 26.00L31.01 26.44L3'
      + '5.55 27.40L37.38 27.98L39.29 28.86L39.95 29.37ZM39.95 57.29L39.43 57.51L39.36 56.78L39.80 56.6'
      + '3L39.65 57.00ZM39.87 30.47L39.80 30.99L39.43 30.62L37.75 29.74L35.92 29.08L31.23 27.98L27.49 2'
      + '7.54L22.66 27.47L18.70 27.84L14.67 28.64L11.37 29.74L9.32 30.91L9.32 30.33L9.61 30.11L11.66 29'
      + '.15L14.08 28.35L18.26 27.47L22.95 27.03L29.10 27.25L33.21 27.91L37.46 29.15L39.14 29.89ZM39.73'
      + ' 31.35L39.65 32.08L39.00 31.43L37.24 30.62L34.82 29.81L31.30 29.01L27.12 28.49L23.02 28.42L19.'
      + '43 28.71L15.11 29.52L11.74 30.62L10.05 31.43L9.39 31.94L9.39 31.21L10.05 30.62L11.52 29.89L13.'
      + '79 29.08L18.48 28.05L22.22 27.69L26.69 27.69L29.98 27.98L32.55 28.42L37.53 29.89L39.14 30.69ZM'
      + '39.73 86.67L38.92 88.36L37.82 89.38L36.14 90.19L33.21 90.92L32.47 91.58L28.52 92.02L25.66 92.0'
      + '9L25.81 91.73L25.51 91.36L24.78 91.14L23.90 91.14L23.02 91.51L22.95 91.88L23.09 92.09L20.09 92'
      + '.02L16.28 91.58L15.40 90.92L12.62 90.12L12.62 89.53L12.84 89.53L13.86 89.97L16.06 90.48L18.77 '
      + '90.85L22.51 91.07L26.17 91.07L30.86 90.70L34.16 90.12L36.14 89.46L36.36 89.97L36.36 89.38L37.8'
      + '2 88.65L38.48 87.92L38.63 87.26ZM39.58 32.45L38.19 39.85L37.24 44.03L37.02 44.32L33.72 43.59L2'
      + '8.44 43.00L27.71 41.83L26.98 41.68L21.85 41.68L21.04 42.05L20.60 43.00L16.43 43.37L12.32 44.25'
      + 'L11.88 44.10L9.54 33.04L9.54 32.30L9.76 31.94L11.52 30.99L14.74 29.89L18.63 29.08L22.36 28.71L'
      + '26.61 28.71L31.01 29.23L35.40 30.25L39.00 31.72ZM39.29 28.64L39.14 28.71L38.48 28.27L36.58 27.'
      + '54L33.50 26.74L29.91 26.15L25.81 25.86L20.53 26.00L16.79 26.52L12.62 27.54L9.98 28.64L10.42 27'
      + '.40L13.35 14.57L14.38 11.06L15.11 9.22L18.11 8.49L22.44 8.05L22.95 8.05L23.31 8.42L23.90 8.64L'
      + '24.85 8.64L25.73 8.27L25.88 8.05L26.32 8.05L30.13 8.42L33.87 9.15L34.23 9.74L35.11 12.45L37.09'
      + ' 20.29L38.70 27.62ZM38.34 86.75L38.34 86.89L38.19 86.67L37.97 86.75L37.97 86.38L37.38 85.21L37'
      + '.60 85.28L37.46 84.91ZM38.04 87.63L38.04 87.99L37.53 88.43L37.68 87.48L37.97 87.41ZM37.90 87.1'
      + '1L37.68 87.26L37.75 86.97L37.60 86.97L37.16 85.43L36.14 83.52L36.50 83.82L37.46 85.72ZM37.68 4'
      + '3.88L37.46 44.98L37.31 44.98L37.46 44.10ZM37.38 45.27L36.43 52.31L35.77 59.42L34.97 81.40L28.9'
      + '6 81.10L19.36 81.10L13.94 81.40L13.64 68.57L13.20 58.83L12.40 50.48L11.66 45.20L14.60 44.47L17'
      + '.38 44.03L21.48 43.66L25.07 43.59L31.96 44.10L35.62 44.76ZM37.24 87.33L37.09 88.06L36.72 88.43'
      + 'L34.75 89.24L31.52 89.90L26.39 90.34L20.46 90.26L16.06 89.75L13.06 88.94L12.40 88.58L11.81 87.'
      + '77L12.10 86.31L13.28 84.03L14.30 84.55L15.55 84.84L21.78 85.50L26.98 85.50L30.57 85.21L33.87 8'
      + '4.69L35.62 84.03L36.72 85.79ZM37.16 84.11L36.87 84.18L36.58 83.67L36.72 83.60L36.58 83.23L36.8'
      + '0 83.38L36.72 83.52L36.87 83.45L36.87 83.89L37.02 83.82ZM37.09 44.47L36.94 44.91L33.21 44.03L2'
      + '8.30 43.52L28.30 43.22L32.47 43.66L36.65 44.54ZM37.02 88.50L36.14 89.24L31.67 90.34L27.64 90.7'
      + '8L25.00 90.85L24.71 90.63L29.10 90.41L32.62 89.97L35.18 89.38ZM36.36 82.42L36.21 83.01L35.62 8'
      + '3.67L34.38 84.25L35.04 82.79L35.18 81.62L35.92 81.91ZM35.84 90.85L34.97 91.22L32.99 91.51L32.9'
      + '9 91.29L33.43 91.07L35.55 90.56ZM34.89 81.62L34.67 83.08L34.31 83.52L33.50 83.96L31.37 84.33L2'
      + '6.91 84.69L21.63 84.69L15.47 84.03L14.38 83.30L13.94 81.91L13.94 81.62L14.30 81.54L21.48 81.25'
      + 'L30.28 81.32ZM34.60 83.60L34.01 84.40L33.35 84.55L29.84 85.06L26.39 85.28L22.29 85.28L18.92 85'
      + '.06L16.13 84.69L14.74 84.03L14.82 83.89L15.77 84.33L18.55 84.69L24.93 84.99L29.32 84.77L32.55 '
      + '84.40L33.57 84.18ZM34.45 7.61L33.87 7.76L33.65 8.34L33.50 8.34L29.98 7.61L26.10 7.32L25.66 6.7'
      + '3L24.78 6.44L23.97 6.44L23.17 6.73L22.73 7.32L19.21 7.54L15.62 8.27L15.40 8.20L15.18 7.76L14.5'
      + '2 7.69L14.89 7.47L17.97 6.81L22.14 6.37L28.37 6.51L32.55 7.10ZM33.72 8.78L33.43 8.86L30.28 8.2'
      + '0L26.03 7.76L29.84 8.05ZM28.15 43.37L28.15 43.52L26.32 43.37L21.04 43.44L21.04 43.22L21.26 42.'
      + '42L21.19 42.93L21.41 43.22L26.25 43.15L27.56 43.30L27.78 43.08L27.71 42.27ZM27.64 42.78L27.56 '
      + '43.08L25.59 42.93L21.41 43.00L21.41 42.49L21.78 42.12L25.66 42.05L27.42 42.20ZM25.81 7.32L25.8'
      + '1 7.69L25.44 8.05L24.85 8.27L23.46 8.12L22.95 7.54L23.02 7.25L23.53 6.88L23.17 7.25L23.17 7.61'
      + 'L23.31 7.61L23.83 6.95L23.61 6.81L23.90 6.73L24.19 6.73L24.05 6.88L24.34 7.17L24.71 6.73L25.22'
      + ' 6.81ZM25.66 7.47L25.51 7.10L24.93 6.88L25.51 7.69ZM25.44 91.66L23.90 91.58L23.24 91.73L23.90 '
      + '91.36L25.07 91.44ZM25.37 7.83L24.85 7.10L24.49 7.39L23.90 7.10L23.39 7.76L23.46 7.98L23.83 8.0'
      + '5L24.19 7.47L24.56 7.47L24.93 8.05ZM24.71 8.05L24.34 7.61L24.05 8.20L24.71 8.20ZM24.05 90.63L2'
      + '3.97 90.78L22.07 90.85L17.67 90.48L14.08 89.75L12.91 89.09L14.52 89.68L16.79 90.12L20.24 90.48'
      + 'ZM20.97 43.08L20.82 43.52L16.50 43.88L12.18 44.83L11.96 44.83L11.88 44.54L15.84 43.74L20.46 43'
      + '.30ZM15.77 91.44L15.33 91.51L13.06 91.00L12.84 90.48L15.18 91.07ZM15.25 8.12L15.25 8.34L14.74 '
      + '8.42L13.20 9.15L10.71 10.69L9.61 11.57L7.78 13.62L8.81 11.64L9.91 10.32L10.86 9.52L12.47 8.49L'
      + '13.94 7.83L14.82 7.83ZM15.18 8.56L14.89 9.30L11.74 12.23L8.95 15.38L8.37 15.60L9.25 13.18L11.7'
      + '4 10.98L14.30 9.44L14.23 9.30L13.13 9.88L10.20 12.01L9.03 13.25L8.29 15.38L8.15 14.28L8.88 12.'
      + '67L9.98 11.57L11.88 10.18L14.60 8.71ZM15.11 84.40L14.38 84.33L13.79 84.03L12.91 83.23L12.62 82'
      + '.42L13.06 81.91L13.72 81.69L14.08 83.60L14.30 83.52L14.52 83.96ZM13.72 80.08L13.72 81.47L13.06'
      + ' 81.69L12.47 82.28L12.10 80.00L11.81 75.98L12.10 74.95L12.18 67.84L11.59 53.77L11.00 47.40L10.'
      + '49 44.03L8.95 37.36L7.71 33.40L8.07 32.30L8.66 31.65L9.25 35.16L11.52 45.64L12.47 53.33L13.20 '
      + '63.23ZM12.76 90.70L12.76 90.85L12.47 90.85L10.27 89.90L8.95 88.72L8.07 87.26L7.63 85.50L8.59 8'
      + '6.16L8.66 86.60L8.07 86.09L7.93 86.09L7.93 86.31L8.81 88.21L9.03 88.43L9.54 88.50L10.27 89.38L'
      + '11.37 89.97L10.27 89.16L9.25 87.19L8.81 86.67L8.73 86.38L8.88 86.38L10.27 88.80L11.37 89.75L12'
      + '.62 90.34ZM12.54 83.08L12.40 83.60L12.03 83.74L12.25 83.16ZM12.54 89.46L12.54 90.04L12.32 90.0'
      + '4L10.93 89.16L10.05 88.14L9.39 86.67L10.35 87.11L10.64 88.06L11.15 88.65ZM11.96 67.77L11.96 71'
      + '.87L8.07 71.14L7.56 64.03L7.49 58.46L10.20 59.27L11.66 59.49ZM11.96 72.68L11.88 75.02L11.59 76'
      + '.05L10.35 77.29L9.32 77.88L8.66 75.90L8.15 72.02ZM11.96 84.77L11.15 87.11L11.44 85.72ZM11.88 7'
      + '2.09L11.88 72.38L10.57 72.24L8.22 71.73L8.15 71.43L10.79 72.02ZM11.59 59.05L11.52 59.27L10.05 '
      + '58.98L7.63 58.32L7.56 58.10L9.47 58.68ZM11.52 55.90L11.44 56.78L7.41 55.09L7.27 48.72L7.41 36.'
      + '85L8.81 37.87L9.83 41.98L10.86 47.99ZM11.52 57.00L11.52 57.14L11.30 57.14L9.61 56.56L7.49 55.6'
      + '1L7.49 55.46L9.83 56.48ZM11.37 57.88L11.37 58.02L10.71 57.88L10.71 57.58L11.00 57.44L11.08 57.'
      + '73L10.86 57.80ZM9.25 87.99L9.25 88.21L8.88 88.06L8.22 86.53L8.81 86.97ZM9.10 77.81L9.03 78.03L'
      + '8.29 77.95L7.41 77.22L6.83 70.19L6.54 60.22L6.61 67.84L7.27 76.93L5.88 74.80L5.88 74.00L6.24 7'
      + '4.00L6.39 73.70L6.61 71.87L6.39 70.11L6.17 69.75L5.80 69.82L5.73 68.72L5.66 55.83L6.39 56.48L6'
      + '.39 57.44L6.54 57.36L6.54 56.63L7.19 56.85L7.27 57.29L7.34 63.23L7.93 71.87L8.44 75.61L8.73 77'
      + '.00ZM8.59 37.29L7.71 36.63L7.78 36.41L8.22 36.48L8.29 36.33L8.44 37.21ZM8.22 13.33L7.93 14.21L'
      + '8.15 16.33L7.85 17.72L7.34 14.57ZM8.15 56.12L7.85 56.12L8.00 56.26L7.85 56.26L7.78 56.85L7.49 '
      + '56.78L7.63 56.70L7.56 55.97ZM7.71 17.36L7.71 19.56L7.05 26.22L6.68 32.23L6.17 31.79L6.39 20.29'
      + 'L6.76 16.70L7.19 14.87ZM7.27 54.36L7.19 56.78L6.54 56.48L5.66 55.46L5.73 54.51L6.02 54.58L6.17'
      + ' 54.43L6.46 52.97L6.32 50.62L6.02 50.18L5.73 50.26L6.02 38.17L6.61 38.02L6.54 46.23L6.76 37.87'
      + 'L7.12 37.58L7.05 46.59ZM7.19 32.89L7.12 34.65L6.83 34.87L6.90 32.67ZM7.19 36.55L7.05 37.29L6.7'
      + '6 37.21L2.65 38.75L2.73 37.87L3.09 37.14L3.68 36.55L5.29 35.60L6.10 35.24L6.54 35.24L7.12 35.8'
      + '2L6.83 37.14L7.05 36.55ZM6.76 32.45L6.68 35.02L6.17 35.02L6.24 32.08ZM6.61 37.51L6.61 37.73L6.'
      + '10 37.95L2.80 38.97ZM6.39 71.14L6.39 72.75L6.24 72.90L6.02 72.60L6.02 71.07L6.32 70.85ZM6.32 5'
      + '1.80L6.24 53.41L6.02 53.41L5.88 52.89L5.95 51.58L6.24 51.36ZM6.24 70.41L5.80 71.29L5.88 72.75L'
      + '6.24 73.04L6.02 73.78L5.73 72.97L5.73 70.77L6.02 70.04ZM6.17 50.92L6.17 51.21L5.88 51.36L5.73 '
      + '51.72L5.73 53.19L6.17 53.63L6.02 54.29L5.88 54.29L5.58 53.41L5.58 51.80L5.88 50.62L6.02 50.55Z';

    const r3 = (v) => Math.round(v * 1000) / 1000;

    function carTransform(sp) {
      const v = _planView;
      const cx = v.x + (sp.x / 100) * v.w, cy = v.y + (sp.y / 100) * v.h;
      const k = Math.min((sp.w / 100) * v.w / 50, (sp.h / 100) * v.h / 100);
      return 'translate(' + r3(cx) + ' ' + r3(cy) + ') rotate(' + r3(sp.r || 0)
        + ') scale(' + k.toFixed(5) + ') translate(-25 -50)';
    }
    // The artwork is defined once and instanced. Written out per car it is
    // seventeen kilobytes times two hundred and thirty-eight — four megabytes
    // of markup for the same drawing. As one `<defs>` entry it is seventeen
    // kilobytes flat, and the deck comes out smaller than the hand-drawn one
    // it replaces.
    //
    // Styling has to cross the `<use>` boundary, and a descendant selector
    // does not: `.taken .cp-body` never matches inside the shadow tree. Custom
    // properties do inherit through it, so the paint is a `--paint` pair set on
    // the car's own group and read by an inline style in the definition.
    const CAR_DEFS = '<defs><g id="carart">'
      + '<path fill-rule="evenodd" style="fill:var(--paint,#ffffff);'
      + 'fill-opacity:var(--paint-op,0.55)" d="' + CAR_SILH + '"/>'
      + '<path fill-rule="evenodd" style="fill:#64748b;fill-opacity:0.5" d="' + CAR_GREY + '"/>'
      + '<path fill-rule="evenodd" style="fill:#d33a2c;fill-opacity:0.9" d="' + CAR_LAMP + '"/>'
      + '<path fill-rule="evenodd" style="fill:#1e293b;fill-opacity:0.9" d="' + CAR_INK + '"/>'
      + '</g></defs>';

    function carSvg(sp, i, kind, label) {
      const r = sp.r || 0;
      // An empty bay is the drawing and nothing else. A taken one is painted in
      // its zone's own colour — the colour the zone is drawn in underneath —
      // at half strength while it is expected and at full once it has arrived.
      // In placing mode nothing carries paint: the free bays are the subject
      // there, and `.map-cars.is-editing` greys the lot from one rule.
      const taken = kind !== 'free' && sp.c && !_spotEdit;
      const paint = taken
        ? ' style="--paint:' + escape(sp.c) + ';--paint-op:'
          + (/\bhere\b/.test(kind) ? '1' : '0.55') + '"'
        : '';
      return '<g class="cp ' + kind + '" data-i="' + i + '"' + paint
        + ' transform="' + carTransform(sp) + '">'
        + '<use href="#carart"/>'
        + (label
          ? '<text class="cp-no" x="25" y="88" text-anchor="middle" textLength="25"'
            + ' lengthAdjust="spacingAndGlyphs" transform="rotate(' + r3(-r) + ' 25 82)">'
            + escape(label) + '</text>'
          : '')
        + '</g>';
    }

    // Draw the spots over the map photo. Occupied ones carry the car so the plan
    // can be read at a glance — which is the whole point of putting it on the
    // picture instead of in a list.
    function renderMapSpots() {
      const layer = el('mapSpotLayer');
      if (!layer) return;
      if (!_plan && !_mapUrl) { layer.innerHTML = ''; return; }
      layer.classList.toggle('is-editing', _spotEdit);
      const deck = el('mapCars');
      const pins = [], cars = [];
      ZONE_SPOTS.forEach((sp, i) => {
        const car = carOnSpot(sp.zone, sp.no);
        // A bay is a spot that came off a drawing: it knows its size and which
        // way it faces, which is what it takes to draw a car standing in it.
        const bay = !!(_planView && sp.w > 0 && sp.h > 0);
        const here = !!car && statusKey(car.status) === 'sosit';
        const cls = ['map-spot'];
        if (bay) cls.push('is-car');
        if (_spotEdit && _spotPick === spotKey(sp.zone, sp.no)) cls.push('picked');
        if (car) { cls.push('taken'); if (here) cls.push('here'); }
        else if (sp.res) cls.push('reserved');
        const label = car
          ? (car.entry_no ? '#' + car.entry_no : (car.plate || '•'))
          : String(sp.no);
        // The title carries the full story for a pointer; the pin itself stays
        // small enough that a full zone still fits on the photo.
        const who = car
          ? [car.entry_no ? '#' + car.entry_no : '', [car.brand, car.model].filter(Boolean).join(' '), car.plate, car.owner]
              .filter(Boolean).join(' · ')
          : (sp.res ? t('spots.reserved') : t('spots.free'));
        // A pin on a bay is the bay: same size, same heading, so what you tap is
        // the place the car stands and not a circle floating near it. The car
        // itself is drawn on the deck below, at the same size and angle.
        const box = bay
          ? `left:${sp.x}%; top:${sp.y}%; width:${sp.w}%; height:${sp.h}%; --r:${sp.r || 0}deg`
          : `left:${sp.x}%; top:${sp.y}%`;
        pins.push(`<button type="button" class="${cls.join(' ')}"
          style="${box}"
          data-spot-zone="${escape(sp.zone)}" data-spot-no="${sp.no}" data-spot-i="${i}"
          title="${escape(sp.zone + ' · ' + t('spots.spot_n', { n: sp.no }) + ' — ' + who)}">
          ${bay ? '' : `<span class="ms-lab"><span class="ms-no">${escape(String(sp.no))}</span>`
            + `<span class="ms-car">${escape(label)}</span></span>`}
        </button>`);
        // A car pin says who is in it and nothing else: the bay's own number is
        // already drawn on the plan underneath, in the right place and at the
        // right size, and an empty bay has nothing to say at all.
        if (bay) {
          // `here` is a kind of `taken`, never an alternative to it: written as
          // one or the other, an arrived car came out painted like an empty bay.
          cars.push(carSvg(sp, i, car ? (here ? 'taken here' : 'taken') : 'free',
            car ? label : ''));
        }
      });
      layer.innerHTML = pins.join('');
      if (deck) {
        const v = _planView;
        deck.setAttribute('viewBox', `${r3(v.x)} ${r3(v.y)} ${r3(v.w)} ${r3(v.h)}`);
        deck.classList.toggle('is-editing', _spotEdit);
        deck.innerHTML = CAR_DEFS + cars.join('');
      }
      // The first end of a row being laid, so you can see what you are aiming at.
      if (_spotEdit && _spotRow && _rowFrom) {
        layer.insertAdjacentHTML('beforeend',
          `<span class="map-spot ghost" style="left:${_rowFrom.x}%; top:${_rowFrom.y}%" aria-hidden="true">`
          + `<span class="ms-no">${escape(t('spots.row_a'))}</span></span>`);
      }
      // The ring around the picked bay: grab it anywhere and drag to turn the
      // bay. It is sized in the bay's own percentages, so it hugs the car at
      // every zoom instead of being a fixed circle that swallows it at one end
      // and disappears inside it at the other.
      if (_spotEdit && _spotPick) {
        const pi = ZONE_SPOTS.findIndex(sp => spotKey(sp.zone, sp.no) === _spotPick);
        const ps = pi >= 0 ? ZONE_SPOTS[pi] : null;
        if (ps && ps.w > 0 && ps.h > 0) {
          layer.insertAdjacentHTML('beforeend',
            `<div class="map-rot" data-rot-i="${pi}" title="${escape(t('spots.rotate'))}"`
            + ` style="left:${ps.x}%; top:${ps.y}%; width:${ps.w * 1.75}%;`
            + ` height:${ps.h * 1.3}%; --r:${ps.r || 0}deg">`
            + `<span class="mr-h mr-a">\u21bb</span><span class="mr-h mr-b">\u21bb</span></div>`);
        }
      }
      renderSpotDensity();
      const bar = el('mapSpotBar');
      if (bar) bar.hidden = !(roleAtLeast('staff') && (_plan || _mapUrl));
      const edit = el('mapEditBtn');
      if (edit) {
        edit.classList.toggle('active', _spotEdit);
        const lab = edit.querySelector('span');
        if (lab) lab.textContent = t(_spotEdit ? 'spots.place_done' : 'map.edit_spots');
      }
      // The zone picker and the row tools belong to editing: outside it they are
      // controls with nothing to act on.
      for (const id of ['spotAddBtn', 'spotRowBtn', 'spotResBtn', 'spotClearBtn', 'spotZone']) {
        const b = el(id); if (b) b.hidden = !_spotEdit;
      }
      // Reserving acts on the bay in hand, so it says which way it will go and
      // is dead until one is picked — like deleting.
      const res = el('spotResBtn');
      if (res) {
        const picked = _spotPick && ZONE_SPOTS.find(x => spotKey(x.zone, x.no) === _spotPick);
        res.disabled = !picked;
        res.textContent = t(picked && picked.res ? 'spots.unreserve' : 'spots.reserve');
      }
      const addBtn = el('spotAddBtn');
      if (addBtn) {
        addBtn.classList.toggle('active', _spotAdd);
        addBtn.textContent = t(_spotAdd ? 'spots.add_cancel' : 'spots.add');
      }
      // Deleting lives at the top with the other map actions, and is dead until
      // a bay is picked: a button that can only mean one thing, or nothing.
      const del = el('spotDelBtn');
      if (del) {
        del.style.display = _spotEdit && roleAtLeast('staff') ? 'inline-flex' : 'none';
        del.disabled = !_spotPick;
      }
      const zoneSel = el('spotZone');
      if (zoneSel) {
        // Rebuilt when the list itself changes, not on every render — and the
        // list now moves, because switching the event's plan brings other zone
        // names with it. Counting options would miss a rename.
        const zones = allZones();
        const sig = zones.join('|');
        if (zoneSel.dataset.zoneSig !== sig) {
          const keep = zoneSel.value;
          zoneSel.innerHTML = `<option value="">${escape(t('spots.pick_zone'))}</option>`
            + zones.map(z => `<option value="${escape(z)}">${escape(z)}</option>`).join('');
          zoneSel.dataset.zoneSig = sig;
          if (keep) zoneSel.value = keep;
        }
      }
      const info = el('mapSpotInfo');
      if (info) {
        const total = ZONE_SPOTS.length;
        const taken = ZONE_SPOTS.filter(sp => carOnSpot(sp.zone, sp.no)).length;
        info.textContent = total ? t('spots.summary', { taken, total }) : t('spots.none_yet');
      }
      // The one line that says a bay can be tapped at all.
      const hint = el('mapSpotHint');
      if (hint) {
        hint.hidden = !_spotEdit && !ZONE_SPOTS.length;
        const pk = _spotPick && ZONE_SPOTS.find(sp => spotKey(sp.zone, sp.no) === _spotPick);
        hint.textContent = _spotEdit
          ? (_spotAdd ? t('spots.add_where', { zone: _spotEditZone })
            : pk ? t('spots.picked', { zone: pk.zone, n: pk.no, deg: Math.round(pk.r || 0) })
              : t('spots.edit_hint'))
          : t('spots.tap_hint');
      }
    }

    /**
     * Draw the plan into the map, as SVG.
     *
     * The markup is regenerated whenever the zoom changes band, and that is not
     * wasteful: line widths in the drawing are given in metres and rendered as
     * screen pixels, so the only way a kerb stays a kerb at 8x — instead of a
     * black slab or nothing at all — is to compute them for the scale actually
     * on screen. The view box never changes, so the spot percentages laid over
     * it keep meaning the same thing at every zoom.
     */
    let _planScale = 0;
    function renderPlanVector() {
      const host = el('mapPlan');
      if (!host || !_plan) return;
      // The width the drawing has at fit, not the host's: the host is laid out
      // at the zoomed width now, and taking it would count the zoom twice.
      const css = mapContentSize().w || el('mapViewport')?.clientWidth || 360;
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      // Banded, because regenerating a few thousand shapes on every zoom step
      // would cost more than the sharpness is worth.
      const band = Math.min(8, Math.pow(2, Math.round(Math.log2(Math.max(1, _mapZoom)))));
      if (_planScale === band && host.firstChild) return;
      _planScale = band;
      const doc = planSvgDoc(_plan, { width: Math.round(css * dpr * band), chrome: false, metric: true });
      host.innerHTML = doc.svg;
      const svg = host.firstElementChild;
      if (svg) {
        svg.removeAttribute('width');
        svg.removeAttribute('height');
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      }
      _planView = doc.view;
    }
    let _planView = null;

    // A parking bay as a share of the drawing. A percent of the width and a
    // percent of the height are the same number of metres here, because the
    // plan is drawn at the aspect ratio of its own view box — so a bay written
    // this way keeps its proportions at every zoom and on every screen.
    function bayPct(sw, sd) {
      if (!_planView) return null;
      const r = (v) => Math.round(v * 1000) / 1000;
      return { w: r(sw / _planView.w * 100), h: r(sd / _planView.h * 100) };
    }

    // Where a pointer landed, as a percentage of the photo. Clamped, because a
    // drag that leaves the image must stop at the edge rather than park a spot
    // somewhere unreachable.
    function mapPointPct(ev) {
      const wrap = el('mapImageWrap');
      if (!wrap) return null;
      const r = wrap.getBoundingClientRect();
      if (!r.width || !r.height) return null;
      const px = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
      const py = (ev.touches ? ev.touches[0].clientY : ev.clientY) - r.top;
      return {
        x: Math.min(100, Math.max(0, (px / r.width) * 100)),
        y: Math.min(100, Math.max(0, (py / r.height) * 100)),
      };
    }

    // ----- ZOOM & PAN ------------------------------------------------------
    // A real venue plan is rows of forty slots. Scaled to fit a phone, one slot
    // is a few pixels wide: the map can be looked at but not used. Zoom is what
    // makes the interactive half reachable, so it ships with the plan, not after.
    let _mapZoom = 1, _mapPanX = 0, _mapPanY = 0, _mapPanMoved = false;
    const MAP_ZOOM_MAX = 8;

    // The frame's proportions, from whatever the map turns out to be. Without
    // them it would have none: the wrapper inside it is out of flow.
    function setMapFrameRatio() {
      const vp = el('mapViewport');
      if (!vp) return;
      const img = el('mapImage');
      const r = _planView ? [_planView.w, _planView.h]
        : (img && img.naturalWidth ? [img.naturalWidth, img.naturalHeight] : null);
      if (!r) return;
      _mapAspect = r[0] / r[1];
      vp.style.aspectRatio = r[0] + ' / ' + r[1];
      // The frame is wider than the drawing, so it is given the drawing's own
      // paper: otherwise the plan floats as a pale island in a dark box, and
      // the bands beside it read as something failing to load. The wrapper gets
      // the same, or the join between the two shows as a seam.
      const paper = _plan ? inkOf(_plan).bg : '';
      vp.style.background = paper;
      const wrap = el('mapImageWrap');
      if (wrap) wrap.style.background = paper;
      // The frame's width cap is the height cap times this, so the frame ends
      // up the shape of the drawing instead of a wide box with it in the middle.
      vp.style.setProperty('--map-ar', _mapAspect.toFixed(4));
      // The frame's shape decided the fit, so both have to be worked out again.
      _mapFrame = null;
      _mapLaidAt = 0;
    }

    // A window that changes shape changes the fit. Everything downstream of the
    // frame's size is cached, so all of it is dropped here — including the
    // drawing, whose hairline floor belongs to the width it is drawn for.
    addEventListener('resize', () => {
      if (!el('mapImageWrap')) return;
      _mapFrame = null; _mapLaidAt = 0; _planScale = 0; _shownZoom = -1;
      if (_plan) renderPlanVector();
      applyMapTransform();
    });

    /**
     * Zoom is a size, not a transform.
     *
     * `transform: scale()` on the wrapper was cheap and looked right in
     * Chromium, which re-rasterises the drawing at the scale it ends up shown
     * at. WebKit does not: a promoted layer keeps the bitmap it was first
     * painted with and stretches it. On an iPhone the plan therefore turned to
     * mush at exactly the zoom the gate reads it at — vector source, blurred
     * output. Laying the wrapper out at its zoomed width instead paints the
     * SVG at that width in every engine, because nothing is being scaled.
     *
     * A pinch is the exception. Re-laying out a few thousand shapes per frame
     * is not a gesture, it is a slideshow — so while the fingers are down the
     * transform takes the difference and the size is committed when they lift.
     * `_mapLaidAt` is the zoom the layout is currently built for; the residual
     * is what the transform still has to make up, and at rest it is exactly 1.
     */
    let _mapLaidAt = 0;
    function layoutMapZoom(wrap) {
      if (Math.abs(_mapLaidAt - _mapZoom) < 1e-4) return;
      const base = mapContentSize();
      if (!base.w) return;          // the frame has no size yet; nothing to lay out
      _mapLaidAt = _mapZoom;
      wrap.style.width = Math.round(base.w * _mapZoom) + 'px';
    }

    // The frame's own size, and the shape of what it shows. Both are read
    // rarely and cached: `clampMapPan` runs on every pointer move of a pan, and
    // a layout read per move is a layout per move.
    let _mapFrame = null, _mapAspect = 0;
    function mapFrameSize() {
      const vp = el('mapViewport');
      if (!vp) return { w: 0, h: 0 };
      if (!_mapFrame) _mapFrame = { w: vp.clientWidth, h: vp.clientHeight };
      return _mapFrame;
    }
    // The plan at fit: the largest it can be while fitting inside the frame
    // whole. Computed rather than measured — the wrapper is laid out at the
    // zoomed size now, so measuring it would fold the zoom back in.
    //
    // It fits rather than filling the width, because the frame is allowed to be
    // shorter than the drawing is tall. On a laptop a plan as tall as it is
    // wide filled the window and then some; capped, the whole of it is on one
    // screen, which is the only view that answers "where is everything".
    function mapContentSize() {
      const f = mapFrameSize();
      if (!_mapAspect || !f.w || !f.h) return { w: 0, h: 0 };
      const w = Math.min(f.w, f.h * _mapAspect);
      return { w, h: w / _mapAspect };
    }
    function clampMapPan() {
      const f = mapFrameSize();
      const size = mapContentSize();
      if (!size.w) return;
      const cw = size.w * _mapZoom, ch = size.h * _mapZoom;
      // Smaller than the frame on an axis: centred there. Pinned to zero
      // instead, the plan sat against one edge with a band of empty frame
      // beside it, which reads as the map having slid away.
      _mapPanX = cw <= f.w ? (f.w - cw) / 2 : Math.min(0, Math.max(f.w - cw, _mapPanX));
      _mapPanY = ch <= f.h ? (f.h - ch) / 2 : Math.min(0, Math.max(f.h - ch, _mapPanY));
    }
    // Pins keep their size on screen while the plan grows underneath them, so
    // zooming spreads them apart instead of inflating them into each other.
    function renderSpotDensity() {
      const layer = el('mapSpotLayer');
      if (!layer) return;
      // Not a straight counter-scale: the pin grows with the zoom, only far
      // slower than the plan does. Across the whole range the plan grows eight
      // times and the pin about a quarter — enough to feel like it followed you
      // in, little enough that a bay is still wider than the pin sitting on it.
      // The plan is laid out at its zoomed size, so a pin measured in pixels is
      // already the same size on screen at every zoom. This is the little bit
      // of growth on top: eight times the plan, about a quarter more pin.
      layer.style.setProperty('--pin-s', String(Math.pow(_mapZoom, 0.12)));
      // Until a number has room it is a dot, and how much zoom that takes
      // depends on how many spots share the plan: forty pins on a photo and two
      // hundred and thirty on a venue plan are not the same picture.
      const roomAt = Math.min(6, 1.8 * Math.sqrt(ZONE_SPOTS.length / 26));
      const dense = ZONE_SPOTS.length > 24 && _mapZoom < roomAt;
      layer.classList.toggle('dense', dense);
      // The cars are drawn on their own layer, and their captions answer to the
      // same question: is there room to read one yet.
      el('mapCars')?.classList.toggle('dense', dense);
    }
    // Committing the size a beat after the zoom settles rather than on every
    // step. Leaning on the + button is a burst of taps and a pinch is a burst of
    // frames; each committed size re-lays out a few thousand shapes, which is
    // about a fifth of a second on a slow phone. The transform shows the change
    // at once and the size follows when the burst stops — so it responds
    // immediately and is sharp wherever you land.
    let _zoomSettle = 0, _mapPointers = 0;
    function settleMapZoom() {
      clearTimeout(_zoomSettle);
      _zoomSettle = setTimeout(() => {
        // Never while a finger is still on the glass. Committing the size
        // re-lays out the whole drawing, and doing that in the middle of a
        // touch is both a stutter and a good way to lose the gesture.
        if (_mapPointers) { settleMapZoom(); return; }
        _zoomSettle = 0;
        applyMapTransform();
      }, 140);
    }

    let _shownZoom = -1;
    // `live` keeps the layout where it is and lets the transform carry the
    // change. Everything else commits the size, which is what keeps it sharp.
    function applyMapTransform(live) {
      const wrap = el('mapImageWrap');
      if (!wrap) return;
      if (!live) layoutMapZoom(wrap);
      clampMapPan();
      const k = _mapZoom / (_mapLaidAt || 1);
      wrap.style.transform = `translate(${_mapPanX}px, ${_mapPanY}px)`
        + (Math.abs(k - 1) < 1e-4 ? '' : ` scale(${k})`);
      // Rebuilding the drawing rides with the committed size, never with the
      // gesture. It is the one expensive thing here — a few thousand shapes
      // written out again because the hairline floor belongs to the scale being
      // drawn for — and on the tap itself it was the whole delay: 124ms of the
      // 146 a zoom step took on a slow phone, against 4 when the band held.
      if (!live && _plan) renderPlanVector();
      // Everything below depends on the zoom and nothing else, while this runs
      // on every pointer move of a pan. Rewriting the label and re-deciding the
      // pin size there is a style invalidation per move for a value that did
      // not change — and with a few hundred pins in the layer that is not free.
      if (_shownZoom === _mapZoom) return;
      _shownZoom = _mapZoom;
      const val = el('mapZoomVal');
      if (val) val.textContent = Math.round(_mapZoom * 100) + '%';
      el('mapViewport')?.classList.toggle('is-zoomed', _mapZoom > 1.01);
      renderSpotDensity();
    }
    function setMapZoom(next, cx, cy) {
      const vp = el('mapViewport');
      if (!vp) return;
      const z0 = _mapZoom;
      const z1 = Math.min(MAP_ZOOM_MAX, Math.max(1, next));
      if (Math.abs(z1 - z0) < 1e-4) return;
      const r = vp.getBoundingClientRect();
      // Anchor on the point under the pointer, otherwise zooming walks away
      // from whatever you were leaning in to look at.
      const ax = (cx == null ? r.width / 2 : cx - r.left);
      const ay = (cy == null ? r.height / 2 : cy - r.top);
      _mapPanX = ax - (ax - _mapPanX) * (z1 / z0);
      _mapPanY = ay - (ay - _mapPanY) * (z1 / z0);
      _mapZoom = z1;
      applyMapTransform(true);
      settleMapZoom();
    }
    function resetMapZoom() {
      clearTimeout(_zoomSettle); _zoomSettle = 0;
      _mapZoom = 1; _mapPanX = 0; _mapPanY = 0;
      applyMapTransform();
    }

    el('mapContainer')?.addEventListener('click', (e) => {
      const b = e.target.closest?.('.map-zoom button');
      if (!b) return;
      e.stopPropagation();
      if (b.id === 'mapZoomIn') setMapZoom(_mapZoom * 1.5);
      else if (b.id === 'mapZoomOut') setMapZoom(_mapZoom / 1.5);
      else resetMapZoom();
    });
    el('mapContainer')?.addEventListener('wheel', (e) => {
      if (!el('mapViewport')?.contains(e.target)) return;
      e.preventDefault();
      setMapZoom(_mapZoom * (e.deltaY < 0 ? 1.2 : 1 / 1.2), e.clientX, e.clientY);
    }, { passive: false });

    // Drag to pan, two fingers to pinch. Pointer events cover mouse and touch
    // in one path, the same way spot dragging does.
    (function mapPan() {
      const pts = new Map();
      let pinch = null, pan = null;
      const two = () => [...pts.values()];
      const down = (e) => {
        const vp = el('mapViewport');
        if (!vp || !vp.contains(e.target) || e.target.closest('.map-zoom')) return;
        // Cleared on every touch, not only when a pan starts: otherwise the
        // last drag before zooming back out keeps swallowing the next tap.
        _mapPanMoved = false;
        // A primary pointer going down is a new gesture, so nothing from the
        // last one is still on the glass. Without this, a single `pointerup`
        // that never arrives — which a touch screen does not promise — leaves a
        // ghost finger in the set, and every later drag is read as half a pinch
        // and pans nothing at all.
        if (e.isPrimary) pts.clear();
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        _mapPointers = pts.size;
        if (pts.size === 2) {
          const [a, b] = two();
          pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: _mapZoom };
          pan = null;
          return;
        }
        if (pts.size !== 1) return;
        // Nothing to pan at fit-width, and claiming the gesture there would
        // swallow the tap that places a spot.
        if (_mapZoom <= 1.01) return;
        // Those are the pin's drag and the ring's turn, not a pan of the plan.
        if (_spotEdit && e.target.closest('.map-spot, .map-rot')) return;
        pan = { x: e.clientX, y: e.clientY, px: _mapPanX, py: _mapPanY };
      };
      const move = (e) => {
        if (!pts.has(e.pointerId)) return;
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pts.size === 2 && pinch && pinch.d > 0) {
          const [a, b] = two();
          _mapPanMoved = true;
          setMapZoom(pinch.z * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.d),
            (a.x + b.x) / 2, (a.y + b.y) / 2);
          e.preventDefault();
          return;
        }
        if (!pan) return;
        const dx = e.clientX - pan.x, dy = e.clientY - pan.y;
        // A tap is not a pan: below the threshold the click still gets through.
        if (!_mapPanMoved && Math.hypot(dx, dy) < 6) return;
        _mapPanMoved = true;
        _mapPanX = pan.px + dx; _mapPanY = pan.py + dy;
        applyMapTransform(true);
        e.preventDefault();
      };
      const up = (e) => {
        pts.delete(e.pointerId);
        const wasPinch = pts.size < 2 && pinch;
        if (pts.size < 2) pinch = null;
        if (!pts.size) pan = null;
        _mapPointers = pts.size;
        // The pinch left the size where it started and the difference in the
        // transform. Commit it now rather than waiting out the settle: the
        // fingers are off the glass, which is when the picture is looked at.
        if (wasPinch) { clearTimeout(_zoomSettle); _zoomSettle = 0; applyMapTransform(); }
      };
      document.addEventListener('pointerdown', down);
      document.addEventListener('pointermove', move, { passive: false });
      document.addEventListener('pointerup', up);
      document.addEventListener('pointercancel', up);
    })();

    // ----- A WHOLE ROW AT ONCE ---------------------------------------------
    // Plans are drawn in rows: forty slots along one line. Tapping each of them
    // is not planning, it is data entry — so a row is described by its two ends
    // and how many slots sit between, and the app spaces them out.
    function setRowMode(on) {
      _spotRow = on;
      if (on) _spotAdd = false;   // only one of them can hold the next tap
      if (!on) _rowFrom = null;
      const b = el('spotRowBtn');
      if (b) { b.classList.toggle('active', on); b.textContent = t(on ? 'spots.row_cancel' : 'spots.row'); }
      if (on) showToast(t('spots.row_hint_start'));
      renderMapSpots();
    }

    async function placeSpotRow(a, b) {
      const zone = _spotEditZone;
      const raw = await uiPrompt(t('spots.row_count_q', { zone }), { value: '10' });
      if (raw == null) return;
      const n = parseInt(String(raw).trim(), 10);
      if (!Number.isFinite(n) || n < 2 || n > 120) { showToast(t('spots.row_count_bad'), 'error'); return; }
      const nums = allocSpotNumbers(zone, n);
      const bay = bayPct(SPOT_W, SPOT_D);
      const ink = zoneInk(zone);
      // The row's heading, taken on the drawing rather than on the percentages:
      // one percent across and one percent down are the same distance in metres
      // but not the same number, and an angle read off the numbers would lean.
      const r = bay
        ? Math.atan2((b.y - a.y) * _planView.h, (b.x - a.x) * _planView.w) * 180 / Math.PI
        : 0;
      const add = [];
      for (let i = 0; i < n; i++) {
        const k = i / (n - 1);
        add.push({
          zone, no: nums[i],
          x: Math.min(100, Math.max(0, a.x + (b.x - a.x) * k)),
          y: Math.min(100, Math.max(0, a.y + (b.y - a.y) * k)),
          ...(bay ? { r: Math.round(r * 100) / 100, ...bay } : {}),
          ...(ink ? { c: ink } : {}),
        });
      }
      if (await saveZoneSpots(ZONE_SPOTS.concat(add))) showToast(t('spots.row_done', { n, zone }));
    }

    el('spotRowBtn')?.addEventListener('click', () => {
      if (!roleAtLeast('staff')) return;
      if (!_spotRow && !_spotEditZone) { showToast(t('spots.pick_zone_first'), 'error'); return; }
      setRowMode(!_spotRow);
    });

    // Clearing a zone. Laying forty spots in one gesture needs an undo of the
    // same size, or the first mistake costs forty taps to walk back.
    el('spotClearBtn')?.addEventListener('click', async () => {
      if (!roleAtLeast('staff')) return;
      const zone = _spotEditZone;
      if (!zone) { showToast(t('spots.pick_zone_first'), 'error'); return; }
      const mine = spotsOfZone(zone);
      if (!mine.length) { showToast(t('spots.none_yet'), 'error'); return; }
      const onThem = mine.map(sp => carOnSpot(zone, sp.no)).filter(Boolean);
      if (!await uiConfirm(t('spots.clear_confirm', { n: mine.length, zone, cars: onThem.length }))) return;
      // Free the cars first: a spot number pointing at a spot that no longer
      // exists would keep showing on the car's card as a place to go.
      if (onThem.length) {
        if (!requireOnline(t('spots.what'))) return;
        const { error } = await supa.from('cars').update({ spot_no: null }).in('id', onThem.map(c => c.id));
        if (error) { uiAlert(t('common.error') + ': ' + error.message); return; }
        for (const c of onThem) {
          const row = (state.cars || []).find(x => String(x.id) === String(c.id));
          if (row) row.spot_no = null;
        }
      }
      const k = zone.trim().toLowerCase();
      if (await saveZoneSpots(ZONE_SPOTS.filter(sp => sp.zone.trim().toLowerCase() !== k))) {
        renderCars();
        showToast(t('spots.cleared', { n: mine.length, zone }));
      }
    });

    // Editing the spots is a mode, entered from the top of the section where
    // the map's other actions are. One place holds the state; the button's
    // label and the tools under it are both drawn from it in `renderMapSpots`.
    function setSpotEdit(on) {
      _spotEdit = !!on;
      if (!_spotEdit) { setRowMode(false); _spotAdd = false; }
      _spotPick = null;
      if (_spotEdit) showToast(t('spots.place_hint'));
      renderMapSpots();
    }
    el('mapEditBtn')?.addEventListener('click', () => setSpotEdit(!_spotEdit));

    el('spotZone')?.addEventListener('change', (e) => { _spotEditZone = e.target.value || ''; });

    // ----- ADDING ONE SPOT --------------------------------------------------
    // Adding used to be a bare tap with a zone set on a dropdown: two things
    // nobody saw, and a stray tap while dragging the plan left a bay behind.
    // The button is the thing you look for and the arm at the same time, and it
    // stays armed — a plan is drawn a handful of bays at a time, and re-arming
    // between each one would be the same tax the dropdown was.
    async function startAddingSpots() {
      if (!roleAtLeast('staff')) return;
      if (_spotAdd) { _spotAdd = false; renderMapSpots(); return; }
      // The zone is asked once, not on every re-arm: the dropdown beside the
      // button is there to change it.
      let zone = _spotEditZone;
      if (!zone) {
        zone = await uiChoose(t('spots.add_zone_q'), allZones().map(z => ({
          value: z, label: z, sub: t('spots.summary_zone', { n: spotsOfZone(z).length }), search: z,
        })), { placeholder: t('spots.pick_zone') });
        if (!zone) return;
        _spotEditZone = zone;
        // The dropdown still drives the row and clear tools, so it has to agree.
        const sel = el('spotZone');
        if (sel) sel.value = zone;
      }
      setRowMode(false);
      _spotAdd = true;
      renderMapSpots();
      showToast(t('spots.add_where', { zone }));
    }
    el('spotAddBtn')?.addEventListener('click', startAddingSpots);

    // ----- DELETING, AND TURNING ------------------------------------------
    // Both act on the bay that is picked, so both are one deliberate thing you
    // do to a chosen target rather than something a stray tap can trigger.
    // Holding a bay back. A reserved bay is still drawn and still countable —
    // it is simply not one to hand out without meaning to.
    el('spotResBtn')?.addEventListener('click', async () => {
      if (!_spotEdit || !roleAtLeast('staff')) return;
      const key = _spotPick;
      if (!key) { showToast(t('spots.pick_first'), 'error'); return; }
      const sp = ZONE_SPOTS.find(x => spotKey(x.zone, x.no) === key);
      if (!sp) { _spotPick = null; renderMapSpots(); return; }
      const next = ZONE_SPOTS.map(x => (spotKey(x.zone, x.no) === key
        ? Object.assign({}, x, sp.res ? { res: undefined } : { res: true })
        : x));
      if (await saveZoneSpots(normaliseSpots(next))) {
        renderMapSpots();
        showToast(t(sp.res ? 'spots.unreserved_ok' : 'spots.reserved_ok', { zone: sp.zone, n: sp.no }));
      }
    });

    el('spotDelBtn')?.addEventListener('click', async () => {
      if (!_spotEdit || !roleAtLeast('staff')) return;
      const key = _spotPick;
      if (!key) { showToast(t('spots.pick_first'), 'error'); return; }
      const sp = ZONE_SPOTS.find(x => spotKey(x.zone, x.no) === key);
      if (!sp) { _spotPick = null; renderMapSpots(); return; }
      const car = carOnSpot(sp.zone, sp.no);
      // Only the consequential half asks. Deleting an empty bay is a drawing
      // correction; deleting one with somebody on it takes their place away,
      // and that is not something to discover afterwards.
      if (car && !await uiConfirm(t('spots.remove_car_confirm',
        { zone: sp.zone, n: sp.no, car: carChoice(car).label }))) return;
      if (car) {
        // Free the car first: a spot number pointing at a bay that no longer
        // exists keeps showing on the car's card as a place to go.
        if (!requireOnline(t('spots.what'))) return;
        const { error } = await supa.from('cars').update({ spot_no: null }).eq('id', car.id);
        if (error) { uiAlert(writeErrorText(error)); return; }
        const row = (state.cars || []).find(c => String(c.id) === String(car.id));
        if (row) row.spot_no = null;
      }
      _spotPick = null;
      if (await saveZoneSpots(ZONE_SPOTS.filter(x => spotKey(x.zone, x.no) !== key))) {
        if (car) renderCars();
        showToast(t('spots.removed', { zone: sp.zone, n: sp.no }));
      } else renderMapSpots();
    });

    // Turning a bay by its ring. The angle is taken as a delta from where the
    // ring was grabbed, not as "point at my finger": the whole ring is the
    // handle, so an absolute angle would snap the bay round on first contact.
    (function spotTurn() {
      let turning = null;
      const angleAt = (e, cx, cy) =>
        Math.atan2(e.clientX - cx, -(e.clientY - cy)) * 180 / Math.PI;
      const start = (e) => {
        if (!_spotEdit || !roleAtLeast('staff')) return;
        const ring = e.target.closest?.('.map-rot');
        if (!ring) return;
        const i = Number(ring.dataset.rotI);
        const sp = ZONE_SPOTS[i];
        if (!sp) return;
        const box = ring.getBoundingClientRect();
        const cx = box.left + box.width / 2, cy = box.top + box.height / 2;
        const r0 = sp.r || 0;
        turning = { sp, ring, cx, cy, from: angleAt(e, cx, cy), r0, r: r0,
          pin: el('mapSpotLayer')?.querySelector(`.map-spot[data-spot-i="${i}"]`) || null,
          car: el('mapCars')?.querySelector(`[data-i="${i}"]`) || null };
        ring.setPointerCapture?.(e.pointerId);
        e.preventDefault();
      };
      const move = (e) => {
        if (!turning) return;
        const d = angleAt(e, turning.cx, turning.cy) - turning.from;
        const r = ((Math.round(turning.r0 + d) % 360) + 360) % 360;
        turning.r = r;
        _spotDragged = true;
        turning.ring.style.setProperty('--r', r + 'deg');
        if (turning.pin) turning.pin.style.setProperty('--r', r + 'deg');
        if (turning.car) turning.car.setAttribute('transform', carTransform({ ...turning.sp, r }));
        const hint = el('mapSpotHint');
        if (hint) {
          hint.textContent = t('spots.picked',
            { zone: turning.sp.zone, n: turning.sp.no, deg: r });
        }
      };
      const end = async () => {
        const d = turning; turning = null;
        if (!d || d.r === d.r0) return;
        const key = spotKey(d.sp.zone, d.sp.no);
        await saveZoneSpots(ZONE_SPOTS.map(sp =>
          spotKey(sp.zone, sp.no) === key ? { ...sp, r: d.r } : sp));
      };
      document.addEventListener('pointerdown', start);
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', end);
      document.addEventListener('pointercancel', end);
    })();

    // A drag ends with a click. Left alone, letting go after moving or turning a
    // bay counted as a tap on the plan and put the bay straight back down — and
    // before that, it opened the delete confirm on the bay you had just moved.
    // Capture phase on the container, so neither tap handler below ever runs.
    el('mapContainer')?.addEventListener('click', (e) => {
      if (!_spotDragged) return;
      _spotDragged = false;
      e.stopPropagation();
      e.preventDefault();
    }, true);

    // Placing: a tap on the photo drops the next number of the chosen zone.
    el('mapContainer')?.addEventListener('click', async (e) => {
      if (!_spotEdit || !roleAtLeast('staff')) return;
      if (!el('mapImageWrap')?.contains(e.target)) return;
      if (_mapPanMoved) return;                       // that was a pan, not a tap
      // In row mode a pin is just scenery: both ends of the row are points on
      // the photo, and a dense zone leaves nowhere else to aim.
      if (!_spotRow && e.target.closest('.map-spot')) return;   // handled below
      // Without an arm a stray tap while dragging the plan around dropped a
      // bay; now nothing lands on the map unless a tool asked for it.
      if (!_spotRow && !_spotAdd) {
        // Nothing armed: the tap landed on the plan, away from any bay, which
        // is how you put down the one you were holding.
        if (_spotPick) { _spotPick = null; renderMapSpots(); }
        return;
      }
      if (!_spotEditZone) { showToast(t('spots.pick_zone_first'), 'error'); return; }
      const at = mapPointPct(e);
      if (!at) return;
      if (_spotRow) {
        if (!_rowFrom) { _rowFrom = at; renderMapSpots(); showToast(t('spots.row_hint_end')); return; }
        const from = _rowFrom;
        setRowMode(false);
        await placeSpotRow(from, at);
        return;
      }
      const no = allocSpotNumbers(_spotEditZone, 1)[0];
      const near = neighbourSpot(_spotEditZone, at);
      const ink = zoneInk(_spotEditZone);
      if (await saveZoneSpots(ZONE_SPOTS.concat([
        { zone: _spotEditZone, no, x: at.x, y: at.y,
          ...(bayPct(SPOT_W, SPOT_D) || {}),
          ...(near && Number.isFinite(+near.r) ? { r: +near.r } : {}),
          ...(ink ? { c: ink } : {}) },
      ]))) showToast(t('spots.added', { zone: _spotEditZone, n: no }));
    });

    // The nearest pin to a point, within reach.
    //
    // At fit-width a bay is four pixels across on a laptop and under three on a
    // phone: drawn exactly right, and impossible to hit. Aiming near one is the
    // same intent as landing on it — and the nearest centre is an unambiguous
    // answer, where "whichever element is on top" is not.
    const TAP_REACH = 22;
    function pinNear(x, y) {
      const layer = el('mapSpotLayer');
      if (!layer) return null;
      let best = null, bestD = TAP_REACH * TAP_REACH;
      for (const pin of layer.children) {
        const r = pin.getBoundingClientRect();
        if (!r.width) continue;
        const dx = x - (r.left + r.width / 2), dy = y - (r.top + r.height / 2);
        const d = dx * dx + dy * dy;
        if (d < bestD) { bestD = d; best = pin; }
      }
      return best;
    }

    // A spot: while editing it is a handle, otherwise it is the car on it.
    el('mapContainer')?.addEventListener('click', async (e) => {
      // Not while placing: there a tap on the plan puts a spot down, and
      // snapping it to the nearest existing one would take that away.
      const pin = e.target.closest('.map-spot')
        || (!_spotEdit && !_spotRow && el('mapImageWrap')?.contains(e.target)
          ? pinNear(e.clientX, e.clientY) : null);
      if (!pin || _spotRow) return;
      // A pan that happens to end over a pin is still a pan: without this,
      // dragging across a full zone opens whichever car you let go on.
      if (_mapPanMoved) return;
      e.stopPropagation();
      const zone = pin.dataset.spotZone, no = Number(pin.dataset.spotNo);
      if (_spotEdit) {
        if (!roleAtLeast('staff')) return;
        // A tap picks the bay up; it does not destroy it. Deleting is the
        // button at the top, and turning is the ring this puts around it.
        const k = spotKey(zone, no);
        _spotPick = _spotPick === k ? null : k;
        renderMapSpots();
        return;
      }
      const car = carOnSpot(zone, no);
      if (car) { showCarDetail(car.id); return; }
      if (roleAtLeast('staff')) await assignCarToSpot(zone, no);
    });

    // Dragging a placed spot. Pointer events cover mouse and touch in one path.
    (function spotDrag() {
      let dragging = null;
      const start = (e) => {
        if (!_spotEdit || _spotRow || !roleAtLeast('staff')) return;
        const pin = e.target.closest('.map-spot');
        if (!pin) return;
        dragging = { zone: pin.dataset.spotZone, no: Number(pin.dataset.spotNo), pin, moved: false,
                     car: el('mapCars')?.querySelector(`[data-i="${Number(pin.dataset.spotI)}"]`) || null,
                     spot: ZONE_SPOTS[Number(pin.dataset.spotI)] || null };
        pin.setPointerCapture?.(e.pointerId);
      };
      const move = (e) => {
        if (!dragging) return;
        const at = mapPointPct(e);
        if (!at) return;
        dragging.moved = true;
        _spotDragged = true;
        dragging.pin.style.left = at.x + '%';
        dragging.pin.style.top = at.y + '%';
        // The pin is the handle; the car is what you are actually looking at.
        // Leaving it behind until the drop makes the drag look like it failed.
        if (dragging.car && dragging.spot) {
          dragging.car.setAttribute('transform', carTransform({ ...dragging.spot, x: at.x, y: at.y }));
        }
        dragging.at = at;
      };
      const end = async () => {
        const d = dragging; dragging = null;
        // A tap is not a drag: without this every placement click would also
        // write a no-op move, and the delete confirm would never be reached.
        if (!d || !d.moved || !d.at) return;
        await saveZoneSpots(ZONE_SPOTS.map(sp =>
          spotKey(sp.zone, sp.no) === spotKey(d.zone, d.no) ? { ...sp, x: d.at.x, y: d.at.y } : sp));
      };
      document.addEventListener('pointerdown', start);
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', end);
      document.addEventListener('pointercancel', end);
    })();

    // Put a car on a spot. The unique index is the real guard; this is the
    // friendly half of it.
    async function setCarSpot(carId, zone, no) {
      if (!requireOnline(t('spots.what'))) return false;
      const { error } = await supa.from('cars')
        .update({ zone: zone || '', spot_no: no })
        .eq('id', carId);
      if (error) {
        // 23505 is the one-car-per-spot index. Somebody else got there first,
        // which is exactly what it exists to prevent.
        showToast(/duplicate key|23505/i.test(error.message || '')
          ? t('spots.taken_race') : t('common.error') + ': ' + error.message, 'error');
        return false;
      }
      const row = (state.cars || []).find(c => String(c.id) === String(carId));
      if (row) { row.zone = zone || ''; row.spot_no = no; }
      renderMapSpots(); renderZones(); renderCars();
      return true;
    }

    // Every car still waiting for a place, the ones from `zone` first: that is
    // usually the answer, and the point of the map is to place the unplaced.
    function unplacedCars(zone) {
      const cars = activeCars().filter(c => c.spot_no == null);
      if (!zone) return cars;
      const k = zone.trim().toLowerCase();
      const inZone = cars.filter(c => (c.zone || '').trim().toLowerCase() === k);
      return inZone.concat(cars.filter(c => !inZone.includes(c)));
    }
    // A car as the picker shows it: what you see on the tarmac on top, how you
    // check it is the right one underneath, and the plate searchable without
    // being on screen — fastest to type, slowest to read off a list.
    const carChoice = (c) => ({
      value: String(c.id),
      label: [c.entry_no ? '#' + c.entry_no : '',
        [c.brand, c.model].filter(Boolean).join(' ') || c.plate || '—'].filter(Boolean).join(' · '),
      sub: [c.owner, c.plate, c.zone].filter(Boolean).join(' · '),
      search: [c.entry_no, c.brand, c.model, c.plate, c.owner, c.zone].filter(Boolean).join(' '),
    });

    async function assignCarToSpot(zone, no) {
      // A reservation is not a lock — it is a note from whoever made it, and
      // the person at the map may well be the one it was made for. It has to be
      // said out loud, once, rather than silently refused or silently ignored.
      const sp = ZONE_SPOTS.find(x => spotKey(x.zone, x.no) === spotKey(zone, no));
      if (sp && sp.res && !await uiConfirm(t('spots.reserved_confirm', { zone, n: no }))) return;
      const pool = unplacedCars(zone);
      if (!pool.length) { showToast(t('spots.nobody_free'), 'error'); return; }
      const pick = await uiChoose(
        t('spots.assign_title', { zone, n: no }),
        pool.map(carChoice), { placeholder: t('spots.assign_search') });
      if (!pick) return;
      if (await setCarSpot(pick, zone, no)) showToast(t('spots.assigned', { zone, n: no }));
    }


    // Interactive zone breakdown, derived live from car data (respects the
    // active-event filter). Each card shows real-time occupancy vs capacity.
    function renderZones() {
      const panel = el('zonePanel');
      if (!panel) return;
      const byZone = new Map();
      activeCars().forEach(c => {
        const z = (c.zone || '').trim();
        if (!z) return;
        if (!byZone.has(z)) byZone.set(z, []);
        byZone.get(z).push(c);
      });
      // Include configured zones even when still empty, so staff sees capacity.
      ZONE_CONFIG.forEach(z => {
        const name = z.name.trim();
        if (![...byZone.keys()].some(k => k.toLowerCase() === name.toLowerCase())) byZone.set(name, []);
      });
      if (!byZone.size) {
        panel.innerHTML = `<div class="card">${emptyState(t('map.zones.empty'))}</div>`;
        return;
      }
      const zones = [...byZone.keys()].sort((a, b) => a.localeCompare(b, 'ro'));
      panel.innerHTML = '<div class="zone-grid">' + zones.map(z => {
        const cars = byZone.get(z);
        const arrived = cars.filter(c => statusKey(c.status) === 'sosit').length;
        const cap = zoneCapacityOf(z);
        const assigned = cars.length;
        const pct = cap ? Math.min(100, Math.round((assigned / cap) * 100)) : 0;
        const full = cap != null && assigned >= cap;
        const near = cap != null && !full && assigned >= cap * 0.8;
        const capHtml = cap != null ? `
          <div class="zone-cap ${full ? 'full' : near ? 'near' : ''}">
            <div class="zone-cap-bar"><span style="width:${pct}%"></span></div>
            <div class="zone-cap-label">${assigned}/${cap}${full ? ' · ' + escape(t('zonecap.full')) : (cap - assigned) + ' ' + escape(t('zonecap.free'))}</div>
          </div>` : '';
        const rows = cars.map(c => {
          const color = CAR_STATUS_OPTIONS.find(o => o.key === statusKey(c.status))?.color || '#3B82F6';
          const name = [c.brand, c.model].filter(Boolean).join(' ') || c.model || '—';
          return `<div class="zone-car-row" data-zone-car="${c.id}">
            <span class="z-status" style="background:${color}"></span>
            <span class="z-name">${escape(name)}${c.plate ? ' · ' + escape(c.plate) : ''}</span>
          </div>`;
        }).join('') || `<div class="zone-empty-row">${escape(t('zonecap.empty_zone'))}</div>`;
        return `<div class="zone-card ${full ? 'is-full' : ''}" data-zone="${escape(z)}">
          <div class="zone-name"><span class="zone-dot"></span>${escape(z)}</div>
          <div class="zone-count">${assigned}</div>
          <div class="zone-stats"><span>${arrived} ${escape(t('map.zones.arrived'))}</span></div>
          ${capHtml}
          <div class="zone-cars">${rows}</div>
        </div>`;
      }).join('') + '</div>';
      if (_mapArrange) { try { renderZoneBoard(); } catch (_) {} }
    }
    // Zone card: toggle expand; inner car row: open the car detail.
    el('zonePanel').addEventListener('click', (e) => {
      const carRow = e.target.closest('[data-zone-car]');
      if (carRow) { e.stopPropagation(); showCarDetail(carRow.dataset.zoneCar); return; }
      const card = e.target.closest('.zone-card');
      if (card) card.classList.toggle('open');
    });

    // ===== Interactive parking board (#3): drag cars between zones =====
    let _mapArrange = false;
    const NO_ZONE = '__none__';
    function renderZoneBoard() {
      const board = el('zoneBoard');
      if (!board) return;
      const cars = activeCars();
      // Columns: "no zone" + configured zones + any extra zones cars already use.
      const cfg = (ZONE_CONFIG || []).map(z => z.name.trim()).filter(Boolean);
      const extra = [];
      cars.forEach(c => {
        const z = (c.zone || '').trim();
        if (z && !cfg.some(k => k.toLowerCase() === z.toLowerCase()) && !extra.some(k => k.toLowerCase() === z.toLowerCase())) extra.push(z);
      });
      const zones = [{ key: NO_ZONE, name: t('map.no_zone') }, ...cfg.concat(extra).map(z => ({ key: z, name: z }))];
      const carsIn = (zoneKey) => cars.filter(c => {
        const z = (c.zone || '').trim();
        return zoneKey === NO_ZONE ? !z : z.toLowerCase() === zoneKey.toLowerCase();
      });
      board.innerHTML = zones.map(z => {
        const list = carsIn(z.key);
        const cap = z.key === NO_ZONE ? null : (zoneCapacityOf(z.key) || null);
        return `<div class="zb-col" data-zone-key="${escape(z.key)}">
          <div class="zb-col-head">
            <span class="zb-col-name">${escape(z.name)}</span>
            <span class="zb-col-count">${list.length}${cap ? '/' + cap : ''}</span>
          </div>
          <div class="zb-col-body">
            ${list.map(c => {
              const nm = [c.brand, c.model].filter(Boolean).join(' ') || c.model || '—';
              const active = statusKey(c.status) || 'invitat';
              return `<div class="zb-chip stripe-${active}" data-zb-car="${c.id}">
                <span class="zb-chip-name">${escape(nm)}</span>
                ${c.plate ? `<span class="zb-chip-plate">${escape(c.plate)}</span>` : ''}
              </div>`;
            }).join('') || `<div class="zb-empty">${escape(t('map.drop_here'))}</div>`}
          </div>
        </div>`;
      }).join('');
    }
    async function assignCarZone(carId, zoneKey) {
      const zone = zoneKey === NO_ZONE ? null : zoneKey;
      const car = (state.cars || []).find(c => String(c.id) === String(carId));
      const prev = car ? car.zone : undefined;
      if (car) car.zone = zone; // optimistic
      renderZoneBoard();
      const { error } = await supa.from('cars').update({ zone }).eq('id', carId);
      if (error) {
        if (car) car.zone = prev; // revert
        renderZoneBoard();
        uiAlert(t('common.error') + ': ' + error.message);
        return;
      }
      try { applyLocalCarPatch(carId, { zone }); } catch (_) {}
      showToast(t('map.moved'));
    }
    el('zoneArrangeBtn')?.addEventListener('click', () => {
      _mapArrange = !_mapArrange;
      const board = el('zoneBoard'), panel = el('zonePanel'), btn = el('zoneArrangeBtn');
      if (board) board.hidden = !_mapArrange;
      if (panel) panel.style.display = _mapArrange ? 'none' : '';
      if (btn) btn.textContent = _mapArrange ? t('map.arrange_done') : t('map.arrange');
      if (_mapArrange) renderZoneBoard();
    });

    // Pointer drag & drop for the parking board.
    (function initZoneBoardDnD() {
      let chip = null, ghost = null, carId = null, startX = 0, startY = 0, active = false;
      const THRESH = 8;
      const board = () => el('zoneBoard');
      function onDown(e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        const b = board(); if (!b || b.hidden) return;
        const c = e.target.closest('.zb-chip');
        if (!c || !b.contains(c)) return;
        chip = c; carId = c.dataset.zbCar; startX = e.clientX; startY = e.clientY; active = false;
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
      }
      function onMove(e) {
        if (!chip) return;
        const dx = e.clientX - startX, dy = e.clientY - startY;
        if (!active) {
          if (Math.hypot(dx, dy) < THRESH) return;
          active = true;
          ghost = chip.cloneNode(true);
          ghost.classList.add('zb-ghost');
          const r = chip.getBoundingClientRect();
          ghost.style.width = r.width + 'px';
          document.body.appendChild(ghost);
          chip.classList.add('zb-dragging');
        }
        ghost.style.left = e.clientX + 'px';
        ghost.style.top = e.clientY + 'px';
        const col = colUnder(e.clientX, e.clientY);
        board().querySelectorAll('.zb-col').forEach(c => c.classList.toggle('zb-over', c === col));
      }
      function onUp(e) {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        const wasActive = active, cid = carId;
        if (ghost) { ghost.remove(); ghost = null; }
        if (chip) chip.classList.remove('zb-dragging');
        if (wasActive) {
          const col = colUnder(e.clientX, e.clientY);
          board().querySelectorAll('.zb-col').forEach(c => c.classList.remove('zb-over'));
          if (col && cid) {
            const zoneKey = col.dataset.zoneKey;
            const car = (state.cars || []).find(c => String(c.id) === String(cid));
            const curr = car ? (car.zone || '').trim() : '';
            const same = (zoneKey === NO_ZONE && !curr) || (zoneKey !== NO_ZONE && curr.toLowerCase() === zoneKey.toLowerCase());
            if (!same) assignCarZone(cid, zoneKey);
          }
        }
        chip = null; carId = null; active = false;
      }
      function colUnder(x, y) {
        const el2 = document.elementFromPoint(x, y);
        return el2 ? el2.closest('.zb-col') : null;
      }
      const b = el('zoneBoard');
      if (b) b.addEventListener('pointerdown', onDown);
    })();

    // ----- THE PLAN LIBRARY -----
    // A plan is picked for the event being looked at, not for the app: that is
    // what lets two events on the same field keep two different layouts.
    function renderPlanList() {
      const list = el('plansList');
      if (!list) return;
      const usedBy = new Map();
      for (const ev of (state.events || [])) {
        if (ev.plan_id == null) continue;
        if (!usedBy.has(ev.plan_id)) usedBy.set(ev.plan_id, []);
        usedBy.get(ev.plan_id).push(ev.title || ('#' + ev.id));
      }
      if (!ZONE_PLANS.length) {
        list.innerHTML = `<p class="dept-empty">${escape(t('plans.empty'))}</p>`;
        return;
      }
      list.innerHTML = ZONE_PLANS.map(pl => {
        const here = String(pl.id) === String(_planId);
        const on = usedBy.get(pl.id) || [];
        return `<div class="plan-row${here ? ' is-here' : ''}">
          <div class="plan-main">
            <span class="plan-name">${escape(pl.name || '—')}</span>
            ${on.length ? `<span class="plan-where">${escape(t('plans.used_by', { list: on.join(', ') }))}</span>` : ''}
          </div>
          <div class="plan-btns">
            ${here
              ? `<span class="plan-badge">${escape(t('plans.in_use'))}</span>`
              : `<button type="button" class="btn ghost small" data-plan-use="${pl.id}">${escape(t('plans.use'))}</button>`}
            <button type="button" class="btn ghost small" data-plan-copy="${pl.id}">${escape(t('plans.copy'))}</button>
            <button type="button" class="btn ghost small" data-plan-rename="${pl.id}">${escape(t('common.rename'))}</button>
            <button type="button" class="btn ghost small danger" data-plan-del="${pl.id}">${escape(t('common.delete'))}</button>
          </div>
        </div>`;
      }).join('');
    }

    el('mapPlansBtn')?.addEventListener('click', async () => {
      if (!roleAtLeast('staff')) return;
      await loadPlanLibrary();
      renderPlanList();
      openModal('plans');
    });
    el('plansCloseBtn')?.addEventListener('click', () => closeModal(el('modal-plans')));
    el('planImportBtn')?.addEventListener('click', () => el('planFileInput')?.click());
    el('planFileInput')?.addEventListener('change', async (e) => {
      const f = e.target.files && e.target.files[0];
      e.target.value = '';           // the same file twice must still be a change
      await importPlanFile(f);
    });
    el('planBundledBtn')?.addEventListener('click', importBundledPlan);

    // Giving the event a different plan moves every car off the bays of the old
    // one that the new one does not have. Said before it happens.
    async function usePlanForEvent(id) {
      if (!roleAtLeast('staff') || !requireOnline(t('map.plan_what'))) return;
      const ev = (state.events || []).find(e => String(e.id) === String(state.activeEventId));
      if (!ev) { showToast(t('plans.no_event'), 'error'); return; }
      const pl = ZONE_PLANS.find(x => String(x.id) === String(id));
      if (!pl) return;
      const parked = activeCars().filter(c => c.spot_no != null).length;
      if (!await uiConfirm(t('plans.use_confirm', {
        name: pl.name || '?', event: ev.title || ('#' + ev.id), cars: parked,
      }))) return;
      const { error } = await supa.from('events').update({ plan_id: pl.id }).eq('id', ev.id);
      if (error) { uiAlert(t('common.error') + ': ' + error.message); return; }
      setEventPlanLocally(ev.id, pl.id);
      await loadActivePlan();
      await freeOrphanSpots(ZONE_SPOTS);
      renderPlanList();
      showToast(t('plans.now_using', { name: pl.name || '?' }));
    }

    // A copy is a variant: same drawing, same bays, its own name. Editing it
    // leaves the original alone, which is the point of having one.
    async function duplicatePlan(id) {
      if (!roleAtLeast('staff') || !requireOnline(t('map.plan_what'))) return;
      const pl = ZONE_PLANS.find(x => String(x.id) === String(id));
      if (!pl) return;
      const name = (await uiPrompt(t('plans.copy_q'), {
        value: t('plans.copy_name', { name: pl.name || 'Plan' }),
      }) || '').trim();
      if (!name) return;
      // The bays are fetched rather than kept in the library: the list is loaded
      // without them so opening it does not pull a copy of every layout.
      const { data, error } = await supa.from('zone_plans').select('spots').eq('id', pl.id).maybeSingle();
      if (error || !data) { uiAlert(t('common.error') + ': ' + (error ? error.message : '?')); return; }
      const { error: insErr } = await supa.from('zone_plans').insert({
        name, plan_path: pl.plan_path, map_url: pl.map_url, spots: data.spots || [],
      });
      if (insErr) { uiAlert(t('common.error') + ': ' + insErr.message); return; }
      await loadPlanLibrary();
      renderPlanList();
      showToast(t('plans.copied', { name }));
    }

    async function renamePlan(id) {
      if (!roleAtLeast('staff') || !requireOnline(t('map.plan_what'))) return;
      const pl = ZONE_PLANS.find(x => String(x.id) === String(id));
      if (!pl) return;
      const name = (await uiPrompt(t('plans.name_q'), { value: pl.name || '' }) || '').trim();
      if (!name || name === pl.name) return;
      const { error } = await supa.from('zone_plans')
        .update({ name, updated_at: new Date().toISOString() }).eq('id', pl.id);
      if (error) { uiAlert(t('common.error') + ': ' + error.message); return; }
      pl.name = name;
      if (String(pl.id) === String(_planId)) _planName = name;
      renderPlanList();
    }

    async function deletePlan(id) {
      if (!roleAtLeast('staff') || !requireOnline(t('map.plan_what'))) return;
      const pl = ZONE_PLANS.find(x => String(x.id) === String(id));
      if (!pl) return;
      const on = (state.events || []).filter(e => String(e.plan_id) === String(pl.id));
      if (!await uiConfirm(t('plans.del_confirm', {
        name: pl.name || '?', events: on.length,
      }))) return;
      const { error } = await supa.from('zone_plans').delete().eq('id', pl.id);
      if (error) { uiAlert(t('common.error') + ': ' + error.message); return; }
      // The events that used it lose their layout — the column drops to null on
      // its own — so their rows here have to follow, or the app keeps drawing a
      // plan that is not there.
      for (const e of on) setEventPlanLocally(e.id, null);
      // A drawing of ours that no plan points at any more is a file nobody can
      // reach; the app's own bundled plan is not ours to remove.
      const path = String(pl.plan_path || '');
      if (path.startsWith(PLANS_PREFIX)) {
        const rest = path.slice(PLANS_PREFIX.length);
        const stillUsed = ZONE_PLANS.some(x => String(x.id) !== String(pl.id) && x.plan_path === path);
        if (rest && !stillUsed) supa.storage.from('plans').remove([decodeURIComponent(rest)]);
      }
      await loadPlanLibrary();
      if (String(pl.id) === String(_planId)) await loadActivePlan();
      renderPlanList();
      showToast(t('plans.deleted', { name: pl.name || '?' }));
    }

    el('plansList')?.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-plan-use], button[data-plan-copy], button[data-plan-rename], button[data-plan-del]');
      if (!b) return;
      if (b.dataset.planUse) usePlanForEvent(b.dataset.planUse);
      else if (b.dataset.planCopy) duplicatePlan(b.dataset.planCopy);
      else if (b.dataset.planRename) renamePlan(b.dataset.planRename);
      else if (b.dataset.planDel) deletePlan(b.dataset.planDel);
    });
    // Lazy-load the vendored QR generator only when a car pass is displayed.
    let _qrLoading = null;
    function ensureQrLib() {
      if (window.qrcode) return Promise.resolve(window.qrcode);
      if (_qrLoading) return _qrLoading;
      _qrLoading = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'vendor/qrcode.js';
        s.onload = () => window.qrcode ? resolve(window.qrcode) : reject(new Error('QR lib missing'));
        s.onerror = () => { _qrLoading = null; reject(new Error('Nu s-a putut încărca generatorul QR.')); };
        document.head.appendChild(s);
      });
      return _qrLoading;
    }

    // Show a printable QR "pass" for a car (used for QR check-in at the gate).
    async function showCarQr(carId) {
      const src = (state.cars && state.cars.length) ? state.cars : loadCachedCars();
      const car = src.find(c => String(c.id) === String(carId));
      if (!car) return;
      const box = el('carQrBox'), cap = el('carQrCaption');
      if (!box) return;
      setCarQrHead(t('car.qr.title'), t('car.qr.sub'));
      box.innerHTML = `<div class="qr-loading"></div>`;
      if (cap) {
        cap.innerHTML = `<div class="qr-plate">${escape(car.plate || '—')}</div>
          <div class="qr-sub">${escape([car.brand, car.model].filter(Boolean).join(' '))}${car.owner ? ' · ' + escape(car.owner) : ''}</div>`;
      }
      openModal('car-qr');
      try {
        const qrlib = await ensureQrLib();
        const qr = qrlib(0, 'M');
        qr.addData(carQrPayload(car));
        qr.make();
        box.innerHTML = qr.createSvgTag({ scalable: true, margin: 1 });
      } catch (e) {
        box.innerHTML = `<div class="qr-err">${escape(t('common.error'))}</div>`;
      }
    }
    // Two different codes come out of this modal now — the car's own pass and a
    // driver's Telegram invite — so it says which one is on screen.
    function setCarQrHead(title, sub) {
      const h = el('carQrTitle'), p = el('carQrSub');
      if (h) h.textContent = title;
      if (p) p.textContent = sub;
    }

    // Whether a Telegram invite can be minted and would lead anywhere. Minting
    // is a round trip, and a bot with no live webhook takes the driver to a
    // chat that never answers — worse than no button at all.
    function tgLinkable() {
      return navigator.onLine
        && !!(_health && _health.telegram && _health.telegram.configured && _health.telegram.webhook_live);
    }

    // The driver's invite as a code on the screen.
    //
    // Sending the link needs a channel, and the channel is exactly what is
    // missing: 51 of 54 drivers at the last event could not be reached at all,
    // and the confirmation nobody received got zero answers. At the gate that
    // problem disappears — the person is standing in front of you with their
    // phone in their hand. They point it at the screen and they are linked.
    async function showInviteQr(carId) {
      const car = (state.cars || []).find(c => String(c.id) === String(carId));
      const box = el('carQrBox'), cap = el('carQrCaption');
      if (!box) return;
      setCarQrHead(t('tg.qr_title'), t('tg.qr_sub'));
      box.innerHTML = `<div class="qr-loading"></div>`;
      if (cap) {
        cap.innerHTML = `<div class="qr-plate">${escape(car && car.plate ? car.plate : '—')}</div>
          <div class="qr-sub">${escape(car ? [car.brand, car.model].filter(Boolean).join(' ') : '')}${
            car && car.owner ? ' · ' + escape(car.owner) : ''}</div>`;
      }
      openModal('car-qr');
      try {
        const rows = await tgInviteFor([carId]);
        const link = rows[0] && rows[0].link;
        if (!link) throw new Error(t('tg.no_token_yet'));
        const qrlib = await ensureQrLib();
        // The invite link is longer than a car pass URL, so the version is left
        // to the library (0) rather than pinned, and correction stays at M: a
        // phone screen is not a printed card that gets creased.
        const qr = qrlib(0, 'M');
        qr.addData(link);
        qr.make();
        box.innerHTML = qr.createSvgTag({ scalable: true, margin: 1 });
      } catch (e) {
        box.innerHTML = `<div class="qr-err">${escape(t('common.error') + ': ' + (e.message || e))}</div>`;
      }
    }

    el('carQrPrintBtn')?.addEventListener('click', () => { try { window.print(); } catch (_) {} });

    // Bulk QR passes: build an A6-card sheet for the currently filtered cars and
    // send it straight to the printer (one QR pass per car).
    let _passBusy = false;
    async function printAllPasses() {
      if (_passBusy) return;
      const sheet = el('passSheet'); if (!sheet) return;
      const cars = (typeof filterCars === 'function' ? filterCars() : activeCars());
      if (!cars.length) { showToast(t('pass.none'), 'error'); return; }
      if (!frozenEvent() && cars.some(c => c.entry_no)) {
        // Once these are on windscreens, a delete-and-reimport that renumbers
        // the list makes every printed card wrong.
        if (!await uiConfirm(t('pass.freeze_prompt'), { okLabel: t('pass.print_anyway') })) return;
      }
      _passBusy = true;
      showToast(t('pass.building', { n: cars.length }));
      try {
        const qrlib = await ensureQrLib();
        const ev = (state.events || []).find(e => String(e.id) === String(state.activeEventId));
        const evName = ev ? (ev.title || ev.name || '') : '';
        sheet.innerHTML = cars.map(car => {
          const qr = qrlib(0, 'M');
          qr.addData(carQrPayload(car));
          qr.make();
          const svg = qr.createSvgTag({ scalable: true, margin: 1 });
          const name = [car.brand, car.model].filter(Boolean).join(' ') || car.model || '';
          // The entry number is the biggest thing on the card on purpose: it
          // goes on the windscreen and is what spectators and judges read the
          // car by. Class sits next to it, the way a dash card is laid out.
          return `<div class="pass-card">
              ${car.entry_no ? `<div class="pass-no">${escape(String(car.entry_no))}</div>` : ''}
              <div class="pass-qr">${svg}</div>
              <div class="pass-plate">${escape(car.plate || '—')}</div>
              <div class="pass-name">${escape(name)}</div>
              ${car.owner ? `<div class="pass-owner">${escape(car.owner)}</div>` : ''}
              ${car.category ? `<div class="pass-class">${escape(localizeDept(car.category))}</div>` : ''}
              ${evName ? `<div class="pass-event">${escape(evName)}</div>` : ''}
            </div>`;
        }).join('');
        document.body.classList.add('printing-passes');
        // Let the layout settle before invoking the print dialog.
        await new Promise(r => setTimeout(r, 120));
        window.print();
      } catch (e) {
        showToast(t('common.error') + ': ' + (e.message || e), 'error');
      } finally {
        document.body.classList.remove('printing-passes');
        _passBusy = false;
      }
    }
    el('passPrintBtn')?.addEventListener('click', printAllPasses);
    window.addEventListener('afterprint', () => { document.body.classList.remove('printing-passes'); });

    // ----- THE DRAWN PLAN AS THE MAP -----
    //
    // Two ways of saying where a car goes meet here. The plan (plan.html) is a
    // drawing in metres; the map is an image with pins placed in percentages of
    // it. Rendering the plan once and converting its spots in the same breath
    // is what keeps the pins on the bays: both come from the same view box.
    const PLAN_URL = 'plans/plan-06.json';
    // The drawing carries the venue's own zone names. Where one means a zone the
    // app already knows, the app's spelling wins — otherwise a car parked in
    // "Modern" would never match a spot labelled "MODERN CARS".
    const PLAN_ZONE_ALIASES = { 'modern cars': 'Modern', 'super cars': 'Super Cars' };
    function appZoneName(name) {
      const k = String(name || '').trim().toLowerCase();
      if (!k) return '';
      const exact = PARKING_ZONES.find(z => z.toLowerCase() === k);
      if (exact) return exact;
      const alias = PLAN_ZONE_ALIASES[k];
      return alias && PARKING_ZONES.includes(alias) ? alias : String(name).trim();
    }


    // Turn a drawing into a plan of this venue: read the bays out of it, write
    // them down with the drawing they came from, and give the result to the
    // event being looked at. `source` is where the drawing lives — a file in
    // our plans bucket, or one shipped with the app.
    async function adoptPlan(plan, source, name) {
      if (!roleAtLeast('staff')) return false;
      const status = el('mapStatus');
      const spots = planSpots(plan);
      if (!spots.length) { showToast(t('map.plan_empty'), 'error'); return false; }
      const ev = (state.events || []).find(e => String(e.id) === String(state.activeEventId));
      if (!ev) { showToast(t('plans.no_event'), 'error'); return false; }
      // The colour a zone is drawn in, by name: a car standing in it is painted
      // the same colour, so the map answers "which class is parked where"
      // without a legend.
      const zoneInk = new Map(plan.items
        .filter(it => it.t === 'zone' && it.name && it.color)
        .map(it => [it.name.trim().toLowerCase(), it.color]));

      // Giving the event a new plan takes every car off the old one. Say how
      // many before doing it, not after.
      const parked = activeCars().filter(c => c.spot_no != null).length;
      if (!await uiConfirm(t('map.plan_confirm', {
        name: name || plan.name || 'plan', n: spots.length, cars: parked,
      }))) return false;

      // No picture is made of it. The plan is drawn in the page as SVG, which
      // is sharp at any zoom and costs a fetch of the JSON instead of three
      // megabytes of raster — so what gets saved is where the drawing lives.
      const doc = planSvgDoc(plan, { chrome: false });
      status.style.display = 'block';
      status.style.color = 'var(--text-dim)';
      status.textContent = t('map.plan_rendering');

      const pct = (v, a, len) => Math.min(100, Math.max(0, ((v - a) / len) * 100));
      const next = spots.map(sp => ({
        zone: appZoneName(sp.zone),
        no: sp.no,
        x: Math.round(pct(sp.x, doc.view.x, doc.view.w) * 100) / 100,
        y: Math.round(pct(sp.y, doc.view.y, doc.view.h) * 100) / 100,
        // The bay, not only its middle. Without its size and its heading a pin
        // can only be a dot; with them it is a car parked between the lines the
        // drawing already put there.
        r: Math.round((((sp.rot % 360) + 360) % 360) * 100) / 100,
        w: Math.round(sp.sw / doc.view.w * 1e5) / 1e3,
        h: Math.round(sp.sd / doc.view.h * 1e5) / 1e3,
        c: zoneInk.get(String(sp.zone || '').trim().toLowerCase()) || '',
      })).filter(sp => sp.zone);
      // A bay the drawing gives no zone to cannot be used here: a car carries a
      // zone, and a bay with none could never be filled. They stay visible in
      // the drawing itself, and the count below says how many they were.
      const zoneless = spots.length - next.length;

      // The plan is a row of its own, and the event is pointed at it. Written in
      // that order: an event pointing at a plan that failed to save would show
      // an empty map with no way back to the one it had.
      const { data: row, error: insErr } = await supa.from('zone_plans')
        .insert({ name: name || plan.name || 'Plan', plan_path: source, spots: next })
        .select('id').single();
      status.style.display = 'none';
      if (insErr || !row) { uiAlert(t('common.error') + ': ' + (insErr ? insErr.message : '?')); return false; }
      const { error: evErr } = await supa.from('events').update({ plan_id: row.id }).eq('id', ev.id);
      if (evErr) { uiAlert(t('common.error') + ': ' + evErr.message); return false; }
      setEventPlanLocally(ev.id, row.id);

      await freeOrphanSpots(next);

      await loadPlanLibrary();
      await loadActivePlan();

      // Zones the drawing brings that are not one of the app's own classes.
      // They are pickable now — `allZones` reads them off the plan — so this is
      // no longer a dead end but a list worth reading once: a typo in the
      // drawing arrives here as a new zone nobody meant to create.
      const unknown = [...new Set(next.map(sp => sp.zone)
        .filter(z => !PARKING_ZONES.some(pz => pz.toLowerCase() === z.toLowerCase())))];
      showToast(t('map.plan_done', { n: next.length }));
      const notes = [
        zoneless ? t('map.plan_no_zone', { n: zoneless }) : '',
        unknown.length ? t('map.plan_unknown_zones', { list: unknown.join(', ') }) : '',
      ].filter(Boolean);
      if (notes.length) {
        status.style.display = 'block';
        status.style.color = 'var(--text-dim)';
        status.textContent = notes.join(' ');
      }
      return true;
    }

    // A car pointing at a bay that is not on the plan any more would keep
    // showing a place to go that no longer exists.
    async function freeOrphanSpots(spots) {
      const live = new Set(spots.map(sp => sp.zone.trim().toLowerCase() + '#' + sp.no));
      const orphans = activeCars().filter(c =>
        c.spot_no != null && !live.has((c.zone || '').trim().toLowerCase() + '#' + c.spot_no));
      if (!orphans.length) return 0;
      const { error } = await supa.from('cars').update({ spot_no: null }).in('id', orphans.map(c => c.id));
      if (error) { uiAlert(t('common.error') + ': ' + error.message); return 0; }
      for (const c of orphans) {
        const row = (state.cars || []).find(x => String(x.id) === String(c.id));
        if (row) row.spot_no = null;
      }
      renderCars();
      showToast(t('map.plan_freed', { n: orphans.length }));
      return orphans.length;
    }

    // The drawing that ships with the app, kept as a way in for a venue that
    // has not had a plan drawn for it yet.
    async function importBundledPlan() {
      if (!requireOnline(t('map.plan_what'))) return;
      let plan;
      try {
        const res = await fetch(PLAN_URL, { cache: 'no-cache' });
        if (!res.ok) throw new Error(String(res.status));
        plan = await res.json();
      } catch (_) {
        showToast(t('map.plan_missing'), 'error');
        return;
      }
      if (await adoptPlan(plan, PLAN_URL, plan.name || t('plans.bundled'))) closeModal(el('modal-plans'));
    }

    // A plan drawn in the editor arrives here as the JSON it exported. It is
    // read in this browser first: an unreadable file must fail before anything
    // is uploaded, not after.
    async function importPlanFile(file) {
      if (!roleAtLeast('staff')) return;
      if (!requireOnline(t('map.plan_what'))) return;
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) { showToast(t('plans.too_big'), 'error'); return; }
      let plan;
      try {
        plan = JSON.parse(await file.text());
      } catch (_) { showToast(t('plans.bad_file'), 'error'); return; }
      if (!plan || !Array.isArray(plan.items)) { showToast(t('plans.bad_file'), 'error'); return; }

      const status = el('mapStatus');
      status.style.display = 'block';
      status.style.color = 'var(--text-dim)';
      status.textContent = t('plans.uploading');
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`;
      const { error: upErr } = await supa.storage.from('plans')
        .upload(path, new Blob([JSON.stringify(plan)], { type: 'application/json' }),
          { contentType: 'application/json' });
      status.style.display = 'none';
      if (upErr) { uiAlert(t('common.error') + ': ' + upErr.message); return; }
      const url = supa.storage.from('plans').getPublicUrl(path).data.publicUrl;

      const name = (await uiPrompt(t('plans.name_q'), {
        value: plan.name || file.name.replace(/\.json$/i, ''),
      }) || '').trim();
      if (!name) { supa.storage.from('plans').remove([path]); return; }
      // A drawing whose plan was never adopted is a file nobody can reach.
      if (!await adoptPlan(plan, url, name)) supa.storage.from('plans').remove([path]);
      else closeModal(el('modal-plans'));
    }

    // Taking the map off this event, not out of the app: the plan stays in the
    // library with its bays, ready to be given back or given to another event.
    // Throwing one away for good is a separate act, and it lives with the list.
    el('mapDeleteBtn').addEventListener('click', async () => {
      if (!_planId || !(await uiConfirm(t('plans.detach_confirm', { name: _planName || '?' })))) return;
      if (!requireOnline(t('map.plan_what'))) return;
      const ev = (state.events || []).find(e => String(e.id) === String(state.activeEventId));
      if (!ev) return;
      const { error } = await supa.from('events').update({ plan_id: null }).eq('id', ev.id);
      if (error) return uiAlert('Eroare: ' + error.message);
      setEventPlanLocally(ev.id, null);
      _planScale = 0;
      await loadActivePlan();
      showToast(t('plans.detached'));
    });

    document.querySelectorAll('#logoutBtn, #headerLogoutBtn, #gateLogoutBtn').forEach(btn => {
      btn.addEventListener('click', async () => {
        await supa.auth.signOut();
        document.body.classList.remove('gate-locked');
        leaveApp();
      });
    });

    // Tapping the profile photo opens the Account modal (profile + password);
    // the rest of the preferences stay on the Settings page.
    function openAccount() { openModal('account'); }
    el('avatarBadge').addEventListener('click', openAccount);
    el('openAccountBtn')?.addEventListener('click', openAccount);

    // Scope the whole app to one event. The pick is remembered per device.
    el('activeEventSelect')?.addEventListener('change', (e) => {
      setActiveEvent(e.target.value || '');
    });

    // Tasks assignee filter.
    el('tasksAssigneeSelect').addEventListener('change', (e) => {
      state.tasksAssignee = e.target.value || 'all';
      renderTasks();
    });
    // Tasks sort (priority / deadline / recent). The initial value is applied
    // in applyTasksView() (after `state` is initialized), not here.
    el('tasksSortSelect')?.addEventListener('change', (e) => {
      state.tasksSort = e.target.value || 'priority';
      localStorage.setItem('kultura_tasks_sort', state.tasksSort);
      renderTasks();
    });
    // Tasks view toggle (List / Kanban).
    document.addEventListener('click', (e) => {
      const vb = e.target.closest('[data-tasks-view]');
      if (!vb) return;
      state.tasksView = vb.dataset.tasksView;
      localStorage.setItem('kultura_tasks_view', state.tasksView);
      renderTasks();
    });
    // ----- "WHAT'S NEW" PANEL -----
    // Bump this string whenever the changelog below gains a new entry; users
    // who haven't opened that version see a dot on the Settings tab.
    const WHATSNEW_VERSION = '2026-07-19b';
    const WN_ICONS = {
      grid:   '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
      kanban: '<rect x="3" y="3" width="6" height="18" rx="1"/><rect x="9" y="3" width="6" height="12" rx="1"/><rect x="15" y="3" width="6" height="9" rx="1"/>',
      undo:   '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><polyline points="3 3 3 8 8 8"/>',
      bell:   '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
      user:   '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
      check:  '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'
    };
    const CHANGELOG = [
      { icon: 'grid',
        ro: { t: 'Scanare plăcuță + hartă interactivă', d: 'La Poartă poți scana plăcuța cu camera — o citește automat și găsește mașina. În Hartă, staff-ul poate „Aranja" mașinile pe zone trăgându-le (drag & drop).' },
        en: { t: 'Plate scan + interactive map', d: 'At the Gate you can scan a plate with the camera — it reads it and finds the car. On the Map, staff can "Arrange" cars into zones by dragging them.' },
        ru: { t: 'Скан номера + интерактивная карта', d: 'На Воротах можно отсканировать номер камерой — он распознаётся и находит машину. На Карте staff может «Расставить» машины по зонам перетаскиванием.' } },
      { icon: 'bell',
        ro: { t: 'Cronometru, mențiuni, anunțuri', d: 'Cronometru live până la eveniment pe Acasă; menționezi colegi cu @ în comentariile de la taskuri (primesc notificare); staff/admin pot trimite un anunț către toată echipa (push + banner pe Acasă).' },
        en: { t: 'Countdown, mentions, announcements', d: 'A live countdown to the event on Home; mention teammates with @ in task comments (they get notified); staff/admins can send a team-wide announcement (push + Home banner).' },
        ru: { t: 'Таймер, упоминания, объявления', d: 'Живой отсчёт до события на Главной; упоминайте коллег через @ в комментариях к задачам (им придёт уведомление); staff/админы могут отправить объявление всей команде (push + баннер на Главной).' } },
      { icon: 'grid',
        ro: { t: 'Design înnoit', d: 'Fiecare eveniment poate avea o copertă foto care devine fundalul de pe Acasă, navigația de jos preia culoarea evenimentului, iar în detaliul mașinii vezi parcursul ei: Invitat → Sosit → Plecat.' },
        en: { t: 'Refreshed design', d: 'Each event can have a cover photo that becomes the Home backdrop, the bottom navigation adopts the event color, and a car’s detail shows its journey: Invited → Arrived → Left.' },
        ru: { t: 'Обновлённый дизайн', d: 'У события может быть обложка, которая становится фоном на Главной, нижняя навигация берёт цвет события, а в карточке машины виден её путь: Приглашён → Прибыл → Уехал.' } },
      { icon: 'grid',
        ro: { t: 'Departamente configurabile', d: 'Administratorii pot adăuga sau șterge departamente direct din Setări. Se actualizează peste tot: taskuri, profiluri și filtre.' },
        en: { t: 'Configurable departments', d: 'Admins can add or remove departments right from Settings. They update everywhere: tasks, profiles and filters.' },
        ru: { t: 'Настраиваемые отделы', d: 'Администраторы могут добавлять и удалять отделы прямо в Настройках. Они обновляются везде: задачи, профили и фильтры.' } },
      { icon: 'kanban',
        ro: { t: 'Tablă Kanban pentru taskuri', d: 'Pe pagina Taskuri poți comuta între Listă și Kanban. Trage cardurile între coloane (Disponibil / În lucru / Finisat) pentru a schimba statusul.' },
        en: { t: 'Kanban board for tasks', d: 'On the Tasks page switch between List and Kanban. Drag cards between columns (Available / In progress / Done) to change their status.' },
        ru: { t: 'Канбан-доска для задач', d: 'На странице Задачи переключайтесь между Списком и Канбаном. Перетаскивайте карточки между колонками (Доступно / В работе / Готово), чтобы менять статус.' } },
      { icon: 'undo',
        ro: { t: 'Anulare ștergere', d: 'Ai șters din greșeală o mașină sau un task? Un buton „Anulează" apare câteva secunde și îl readuce la loc.' },
        en: { t: 'Undo delete', d: 'Deleted a car or task by mistake? An “Undo” button appears for a few seconds and brings it back.' },
        ru: { t: 'Отмена удаления', d: 'Случайно удалили машину или задачу? На несколько секунд появляется кнопка «Отменить», которая всё возвращает.' } },
      { icon: 'user',
        ro: { t: 'Taskurile mele + responsabil', d: 'Card nou pe Acasă cu taskurile tale și un filtru după responsabil pe pagina Taskuri.' },
        en: { t: 'My tasks + assignee', d: 'A new Home card with your tasks and an assignee filter on the Tasks page.' },
        ru: { t: 'Мои задачи + ответственный', d: 'Новая карточка на Главной с вашими задачами и фильтр по ответственному на странице Задачи.' } },
      { icon: 'bell',
        ro: { t: 'Memento pentru termene', d: 'Notificare automată când se apropie termenul taskului tău, plus notificare la comentarii pe taskurile de care ești responsabil.' },
        en: { t: 'Deadline reminders', d: 'Automatic notification when your task deadline is near, plus notifications for comments on tasks you own.' },
        ru: { t: 'Напоминания о сроках', d: 'Автоматическое уведомление при приближении срока задачи и уведомления о комментариях к вашим задачам.' } },
      { icon: 'user',
        ro: { t: 'Atribuie taskuri + notificare', d: 'Staff/admin pot atribui un task altei persoane direct din detaliu — cel ales primește imediat o notificare.' },
        en: { t: 'Assign tasks + notify', d: 'Staff/admins can assign a task to someone right from its details — the chosen person gets a notification immediately.' },
        ru: { t: 'Назначение задач + уведомление', d: 'Staff/админы могут назначить задачу другому прямо из деталей — выбранный сразу получает уведомление.' } },
      { icon: 'kanban',
        ro: { t: 'Mai rapid și mai fluid', d: 'Aplicația se deschide instant din memorie și se împrospătează în fundal, listele lungi randează doar ce e pe ecran, căutarea nu mai are lag, tragi în jos ca să reîmprospătezi, ferestrele urcă de jos pe telefon, iar pozele au galerie cu glisare.' },
        en: { t: 'Faster & smoother', d: 'The app opens instantly from cache and refreshes in the background, long lists render only what is on screen, search has no lag, pull down to refresh, sheets slide up from the bottom on phones, and photos open in a swipeable gallery.' },
        ru: { t: 'Быстрее и плавнее', d: 'Приложение открывается мгновенно из кэша и обновляется в фоне, длинные списки рисуют только видимое, поиск без лагов, потяните вниз для обновления, окна выезжают снизу на телефоне, а фото открываются в галерее со свайпом.' } },
      { icon: 'grid',
        ro: { t: 'Aspect mai viu', d: 'Grafic de progres pe Acasă, numărătoare inversă care pulsează când se apropie evenimentul, tranziții și ripple la atingere, carduri VIP cu margine aurie animată și glisare pe o mașină pentru check-in rapid.' },
        en: { t: 'Livelier look', d: 'A progress donut on Home, a countdown that pulses as the event nears, page transitions and tap ripples, VIP cards with an animated gold border, and swipe a car to check it in.' },
        ru: { t: 'Живее визуал', d: 'Кольцо прогресса на Главной, пульсирующий обратный отсчёт, переходы и ripple при нажатии, VIP-карточки с анимированной золотой рамкой и свайп машины для быстрого прибытия.' } },
      { icon: 'check',
        ro: { t: 'Vederi rapide la taskuri', d: 'Butoane noi sus pe pagina Taskuri: Ale mele, Urgente, Urgente ale mele, Întârziate — filtrezi dintr-o atingere.' },
        en: { t: 'Quick task views', d: 'New buttons atop the Tasks page: Mine, Urgent, My urgent, Overdue — filter in one tap.' },
        ru: { t: 'Быстрые виды задач', d: 'Новые кнопки вверху страницы Задачи: Мои, Срочные, Мои срочные, Просроченные — фильтр в одно касание.' } },
      { icon: 'bell',
        ro: { t: 'Telegram la participanți', d: 'Poți salva un username Telegram pentru fiecare mașină, iar butonul Telegram deschide direct conversația.' },
        en: { t: 'Telegram for participants', d: 'You can save a Telegram username per car, and the Telegram button opens the chat directly.' },
        ru: { t: 'Telegram для участников', d: 'Можно сохранить Telegram-username для каждой машины, и кнопка Telegram сразу открывает чат.' } }
    ];
    function renderWhatsNew() {
      const body = el('whatsNewBody');
      if (!body) return;
      const lang = ['ro', 'en', 'ru'].includes(currentLang) ? currentLang : 'ro';
      body.innerHTML = CHANGELOG.map(item => {
        const c = item[lang] || item.ro;
        return `<div class="wn-item">
          <div class="wn-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${WN_ICONS[item.icon] || ''}</svg></div>
          <div class="wn-text"><strong>${escape(c.t)}</strong><span>${escape(c.d)}</span></div>
        </div>`;
      }).join('');
    }
    function whatsNewUnseen() {
      return localStorage.getItem('kultura_whatsnew_seen') !== WHATSNEW_VERSION;
    }
    function updateWhatsNewDot() {
      const unseen = whatsNewUnseen();
      const btn = el('whatsNewBtn');
      if (btn) btn.classList.toggle('has-dot', unseen);
      document.querySelectorAll('.tab[data-section="settings"], .mtab[data-section="settings"]').forEach(tb => {
        tb.classList.toggle('has-dot', unseen);
      });
    }
    function openWhatsNew() {
      renderWhatsNew();
      localStorage.setItem('kultura_whatsnew_seen', WHATSNEW_VERSION);
      updateWhatsNewDot();
      openModal('whatsnew');
    }
    el('whatsNewBtn')?.addEventListener('click', openWhatsNew);
    updateWhatsNewDot();

    // ----- HOW-IT-WORKS GUIDE -----
    // The walkthrough a new operator reads once. Its text is bulky and almost
    // nobody opens it twice, so the pack is fetched the first time the modal is
    // opened rather than shipped with the app shell.
    function guideStepHtml(step, n) {
      const role = step.role
        ? `<span class="guide-role">${escape(t('guide.role_only', { role: step.role }))}</span>` : '';
      const where = step.where
        ? `<div class="guide-where"><span>${escape(t('guide.step_where'))}</span><code>${escape(step.where)}</code></div>` : '';
      const tip = step.tip ? `<p class="guide-tip">${escape(step.tip)}</p>` : '';
      return `<li class="guide-step">
        <div class="guide-num" aria-hidden="true">${n}</div>
        <div class="guide-step-body">
          <h4>${escape(step.title)}${role}</h4>
          ${where}
          <p>${escape(step.body)}</p>
          ${tip}
        </div>
      </li>`;
    }

    function guideHtml(g) {
      let n = 0;
      const phases = g.phases.map(ph => `
        <section class="guide-phase">
          <div class="guide-phase-head">
            <h3>${escape(ph.title)}</h3>
            <p>${escape(ph.sub)}</p>
          </div>
          <ol class="guide-steps">${ph.steps.map(s => guideStepHtml(s, ++n)).join('')}</ol>
        </section>`).join('');

      return `
        <p class="guide-intro">${escape(g.intro)}</p>

        <section class="guide-phase">
          <div class="guide-phase-head"><h3>${escape(g.navTitle)}</h3></div>
          <ul class="guide-defs">
            ${g.nav.map(x => `<li><strong>${escape(x.name)}</strong><span>${escape(x.what)}</span></li>`).join('')}
          </ul>
          <p class="guide-tip">${escape(g.navTip)}</p>
        </section>

        <section class="guide-phase">
          <div class="guide-phase-head">
            <h3>${escape(g.rolesTitle)}</h3>
            <p>${escape(g.rolesNote)}</p>
          </div>
          <ul class="guide-defs">
            ${g.roles.map(r => `<li><strong>${escape(r.name)}</strong><span>${escape(r.can)}</span></li>`).join('')}
          </ul>
        </section>

        ${phases}

        <section class="guide-phase">
          <div class="guide-phase-head">
            <h3>${escape(g.autoTitle)}</h3>
            <p>${escape(g.autoNote)}</p>
          </div>
          <ul class="guide-auto">${g.auto.map(x => `<li>${escape(x)}</li>`).join('')}</ul>
        </section>

        <section class="guide-phase">
          <div class="guide-phase-head"><h3>${escape(g.troubleTitle)}</h3></div>
          <ul class="guide-defs guide-trouble">
            ${g.trouble.map(x => `<li><strong>${escape(x.p)}</strong><span>${escape(x.f)}</span></li>`).join('')}
          </ul>
        </section>`;
    }

    async function openGuide() {
      const body = el('guideBody');
      if (!body) return;
      openModal('guide');
      body.innerHTML = `<p class="guide-intro">${escape(t('guide.loading'))}</p>`;
      const g = await loadGuide(currentLang);
      // The pack can only be missing if we're offline before the service worker
      // has cached it — say so instead of leaving an empty sheet.
      if (!g) { body.innerHTML = `<p class="guide-intro">${escape(t('guide.error'))}</p>`; return; }
      body.innerHTML = guideHtml(g);
      body.scrollTop = 0;
    }
    el('guideBtn')?.addEventListener('click', openGuide);
    // Print just the guide, not the app behind it (see the print rules in CSS).
    el('guidePrintBtn')?.addEventListener('click', () => {
      document.body.classList.add('printing-guide');
      try { window.print(); } finally { document.body.classList.remove('printing-guide'); }
    });

    // Open a task from the "My tasks" home card.
    el('myTasksList').addEventListener('click', (e) => {
      const row = e.target.closest('[data-open-task]');
      if (row) showTaskDetail(row.dataset.openTask);
    });
    // Populate the assignee dropdown with team members (kept in sync).
    function populateTaskAssignees() {
      const sel = el('tasksAssigneeSelect');
      if (!sel) return;
      const prev = state.tasksAssignee;
      while (sel.options.length > 2) sel.remove(2); // keep "all" + "me"
      const seen = new Set();
      (state.profiles || []).forEach(p => {
        if (!p.email || seen.has(p.email)) return;
        seen.add(p.email);
        const opt = document.createElement('option');
        opt.value = p.email;
        opt.textContent = p.full_name || p.email.split('@')[0];
        sel.appendChild(opt);
      });
      sel.value = [...sel.options].some(o => o.value === prev) ? prev : 'all';
    }

    el('form-edit-profile').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button[type="submit"]');
      const originalText = btn.textContent;
      btn.disabled = true;
      btn.textContent = '...';

      const dept = el('profileDeptSelect').value;
      try {
        const admin = isAdmin();
        const isMe = userBeingEdited === currentUser?.email;

        if (!admin && !isMe) throw new Error("Nu ai permisiunea de a modifica acest profil.");

        // 1. Dacă edităm propriul profil, actualizăm și Auth Metadata
        if (isMe) {
          await supa.auth.updateUser({ data: { department: dept } });
        }

        // 2. Salvăm în tabela publică 'profiles'
        const row = {
          email: userBeingEdited,
          department: dept,
          full_name: isMe ? (currentUser.user_metadata?.full_name || userBeingEdited.split('@')[0]) : undefined
        };
        // Only admins may change roles, and never demote themselves by accident.
        if (admin && el('profileRoleField').style.display !== 'none') {
          row.role = el('profileRoleSelect').value;
        }
        const { error } = await supa.from('profiles').upsert(row, { onConflict: 'email' });

        if (error) throw error;

        showToast(t('toast.saved'));
        closeModal(el('modal-edit-profile'));
        loadData();
      } catch (err) {
        uiAlert(err.message);
      } finally {
        btn.disabled = false;
        btn.textContent = originalText;
      }
    });

    el('deleteProfileBtn').addEventListener('click', async () => {
      if (!await uiConfirm(`Ești sigur că vrei să ștergi DEFINITIV utilizatorul ${userBeingEdited}?\n\nAceastă acțiune va șterge:\n1. Contul de login (Auth)\n2. Datele de profil (Tabelă)\n\nAcțiunea este ireversibilă!`)) return;

      const btn = el('deleteProfileBtn');
      btn.disabled = true;
      const originalText = btn.textContent;
      btn.textContent = "Se șterge...";

      try {
        // Call the admin-delete-user Edge Function — it verifies the caller's
        // is_admin flag server-side and does both the Auth delete and the
        // profile row cleanup with the service role key (which never leaves
        // Supabase). Fetching /api/admin/* only worked with the local dev
        // server and 404'd on GitHub Pages.
        const invokeRes = await supa.functions.invoke('admin-delete-user', {
          body: { email: userBeingEdited }
        });

        if (invokeRes.error) {
          // Try to surface the JSON error the function returned
          let msg = invokeRes.error.message || 'Edge function call failed.';
          try {
            const ctx = invokeRes.error.context;
            if (ctx) {
              const txt = typeof ctx.text === 'function' ? await ctx.text() : null;
              if (txt) {
                try { const p = JSON.parse(txt); msg = p.error || txt; }
                catch { msg = txt; }
              }
            }
          } catch (_) {}
          // "User not found" is not fatal — profile row cleanup below still runs.
          if (!/not found/i.test(msg)) throw new Error(msg);
        }

        // Best-effort profile row cleanup in case the function couldn't reach the DB.
        // (The function already does this; a second delete is idempotent.)
        await supa.from('profiles').delete().eq('email', userBeingEdited);

        showToast("Utilizator eliminat complet.");
        closeModal(el('modal-edit-profile'));
        await loadData();
      } catch (err) {
        uiAlert("Eroare: " + err.message);
      } finally {
        btn.disabled = false;
        btn.textContent = originalText;
      }
    });

    // ----- PROFILE PHOTO -----
    const myProfile = () => (state.profiles || [])
      .find(p => (p.email || '').toLowerCase() === (currentUser?.email || '').toLowerCase());

    // Sync every avatar spot (header badge + settings preview) with the
    // profile row; falls back to the initial letter when no photo is set.
    function updateAvatarUI() {
      const url = myProfile()?.avatar_url;
      const initial = (currentUser?.user_metadata?.first_name?.charAt(0)
        || currentUser?.email?.charAt(0) || '?').toUpperCase();
      [['avatarBadge', initial], ['settingsAvatarPreview', initial]].forEach(([id, fb]) => {
        const node = el(id);
        if (!node) return;
        if (url) node.innerHTML = `<img src="${escape(url)}" alt="">`;
        else node.textContent = fb;
      });
    }

    // Center-crop to a square and resize — avatars always render in circles.
    async function squareAvatar(file, size = 256, quality = 0.85) {
      const bmp = await createImageBitmap(file);
      const side = Math.min(bmp.width, bmp.height);
      const sx = (bmp.width - side) / 2, sy = (bmp.height - side) / 2;
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      canvas.getContext('2d').drawImage(bmp, sx, sy, side, side, 0, 0, size, size);
      if (bmp.close) bmp.close();
      const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality));
      if (!blob) throw new Error('Formatul imaginii nu este suportat.');
      return blob;
    }

    el('avatarChangeBtn').addEventListener('click', () => el('avatarFileInput').click());
    el('avatarFileInput').addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!file || !currentUser) return;
      const btn = el('avatarChangeBtn');
      const originalText = btn.textContent;
      btn.disabled = true;
      btn.textContent = t('settings.profile.photo_uploading');
      try {
        const blob = await squareAvatar(file);
        // New filename every time → no stale CDN/browser cache to fight.
        const path = `${currentUser.id}/avatar-${Date.now()}.jpg`;
        const { error: upErr } = await supa.storage.from('avatars')
          .upload(path, blob, { contentType: 'image/jpeg' });
        if (upErr) throw upErr;
        const url = supa.storage.from('avatars').getPublicUrl(path).data.publicUrl;

        const prev = myProfile()?.avatar_url;
        const { error: dbErr } = await supa.from('profiles')
          .update({ avatar_url: url }).eq('email', currentUser.email);
        if (dbErr) throw dbErr;

        // Best-effort cleanup of the replaced file.
        const prevPath = (prev || '').split('/avatars/')[1];
        if (prevPath) supa.storage.from('avatars').remove([decodeURIComponent(prevPath)]);

        await loadData();
        updateAvatarUI();
        showToast(t('settings.profile.photo_saved'));
      } catch (err) {
        uiAlert(t('settings.profile.photo_error') + ': ' + (err.message || err));
      } finally {
        btn.disabled = false;
        btn.textContent = originalText;
      }
    });

    el('profileForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = el('saveProfileBtn');
      const originalText = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Se salvează...';

      const first_name = el('settingsFirstName').value.trim();
      const last_name = el('settingsLastName').value.trim();
      const phone = el('settingsPhone').value.trim();

      try {
        const { data, error } = await supa.auth.updateUser({
          data: {
            first_name,
            last_name,
            phone,
            full_name: `${first_name} ${last_name}`.trim()
          }
        });
        if (error) throw error;
        currentUser = data.user;

        // Sync with profiles table
        await supa.from('profiles').upsert({
          email: currentUser.email,
          full_name: currentUser.user_metadata.full_name,
          department: currentUser.user_metadata.department || ''
        }, { onConflict: 'email' });

        showToast('Profil actualizat cu succes!');
        el('greetingEmail').textContent = currentUser.user_metadata.full_name || currentUser.email;
        updateAvatarUI();
      } catch (err) {
        uiAlert('Eroare la actualizare: ' + err.message);
      } finally {
        btn.disabled = false;
        btn.textContent = originalText;
      }
    });

    // Change password (Supabase auth).
    el('form-change-password')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = el('pwdMsg'), btn = el('changePwdBtn');
      const setMsg = (txt, ok) => { if (msg) { msg.className = 'modal-msg show'; msg.style.color = ok ? 'var(--green)' : 'var(--red)'; msg.textContent = txt; } };
      const p1 = el('pwdNew')?.value || '', p2 = el('pwdConfirm')?.value || '';
      if (p1.length < 6) { setMsg(t('settings.password.too_short'), false); return; }
      if (p1 !== p2) { setMsg(t('settings.password.mismatch'), false); return; }
      if (btn) btn.disabled = true;
      try {
        const { error } = await supa.auth.updateUser({ password: p1 });
        if (error) throw error;
        setMsg(t('settings.password.done'), true);
        el('pwdNew').value = ''; el('pwdConfirm').value = '';
      } catch (err) {
        setMsg(t('common.error') + ': ' + (err.message || err), false);
      } finally { if (btn) btn.disabled = false; }
    });

    el('manualRefreshBtn').addEventListener('click', async () => {
      const btn = el('manualRefreshBtn');
      btn.disabled = true;
      btn.classList.add('loading');
      btn.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;"></span>';
      try {
        await loadDataFull();
      } finally {
        btn.disabled = false;
        btn.classList.remove('loading');
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>';
      }
    });

    // Export the currently filtered car list as .xlsx (CSV fallback if the
    // local SheetJS bundle can't load).
    el('exportCarsBtn').addEventListener('click', async () => {
      const btn = el('exportCarsBtn');
      const list = filterCars();
      if (!list.length) return showToast(t('common.nothing_found'), 'error');
      btn.disabled = true;
      try {
        const evTitle = (id) => {
          const ev = (state.events || []).find(e => String(e.id) === String(id));
          return ev ? (ev.title || '') : '';
        };
        // The list fetch is lean; pull the heavy export-only columns for the
        // filtered rows so Email/Note aren't blank.
        const extra = {};
        if (navigator.onLine) {
          try {
            const ids = list.map(c => c.id);
            const { data } = await supa.from('cars').select('id, email, additional_notes').in('id', ids);
            (data || []).forEach(r => { extra[r.id] = r; });
          } catch (_) {}
        }
        const rows = list.map(c => ({
          'Brand': c.brand || '', 'Model': c.model || '', 'An': c.year || '',
          'Proprietar': c.owner || '', 'Placă': c.plate || '',
          'Telefon': c.phone || c.contact || '', 'Email': (extra[c.id]?.email) || c.email || '',
          'Oraș': c.city || '', 'Zonă': c.zone || '',
          'Status': c.status || '', 'VIP': c.is_vip ? 'DA' : '',
          'Eveniment': evTitle(c.event_id), 'Note': (extra[c.id]?.additional_notes) || c.additional_notes || ''
        }));
        const stamp = new Date().toISOString().slice(0, 10);
        try {
          const XLSX = await ensureXLSX();
          const ws = XLSX.utils.json_to_sheet(rows);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, 'Masini');
          XLSX.writeFile(wb, `kultura-masini-${stamp}.xlsx`);
        } catch (_) {
          const headers = Object.keys(rows[0]);
          const csv = [headers.join(','),
            ...rows.map(r => headers.map(h => `"${String(r[h]).replace(/"/g, '""')}"`).join(','))
          ].join('\r\n');
          const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `kultura-masini-${stamp}.csv`;
          a.click();
          URL.revokeObjectURL(a.href);
        }
        showToast('Export gata.');
      } finally {
        btn.disabled = false;
      }
    });

    // Printable catalog (with photos) → the browser's "Save as PDF" gives a
    // photo catalog of the filtered cars, no extra library needed.
    el('catalogBtn')?.addEventListener('click', async () => {
      const btn = el('catalogBtn');
      const list = filterCars();
      if (!list.length) return showToast(t('common.nothing_found'), 'error');
      btn.disabled = true;
      try {
        const photoMap = {};
        if (navigator.onLine) {
          try {
            const ids = list.map(c => c.id);
            const { data } = await supa.from('cars').select('id, photos').in('id', ids);
            (data || []).forEach(r => { const p = Array.isArray(r.photos) ? r.photos : []; if (p.length) photoMap[r.id] = p[0]; });
          } catch (_) {}
        }
        const evTitle = (id) => { const ev = (state.events || []).find(e => String(e.id) === String(id)); return ev ? (ev.title || '') : ''; };
        const esc = (s) => escape(String(s == null ? '' : s));
        const cards = list.map(c => {
          const name = [c.brand, c.model].filter(Boolean).join(' ') || c.model || '—';
          const photo = photoMap[c.id];
          const media = photo ? `<div class="ph" style="background-image:url('${esc(photo)}')"></div>` : `<div class="ph noph">—</div>`;
          const meta = [c.owner && ('<b>' + esc(c.owner) + '</b>'), c.plate && esc(c.plate), c.category && esc(c.category), c.zone && ('Zonă: ' + esc(c.zone)), (c.phone || c.contact) && esc(c.phone || c.contact)].filter(Boolean).join(' · ');
          return `<div class="cat-card">${media}<div class="cat-b"><div class="cat-n">${esc(name)}</div><div class="cat-s">${meta}</div></div></div>`;
        }).join('');
        const title = 'KULTURA — ' + t('cars.catalog') + (state.activeEventId ? ' · ' + esc(evTitle(state.activeEventId)) : '');
        const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>
          *{box-sizing:border-box;font-family:-apple-system,Segoe UI,Roboto,sans-serif;}
          body{margin:0;padding:20px;background:#fff;color:#111;}
          h1{font-size:20px;margin:0 0 16px;}
          .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;}
          .cat-card{border:1px solid #ddd;border-radius:10px;overflow:hidden;break-inside:avoid;}
          .ph{width:100%;aspect-ratio:16/10;background-size:cover;background-position:center;background:#eee;}
          .ph.noph{display:flex;align-items:center;justify-content:center;color:#bbb;font-size:24px;}
          .cat-b{padding:8px 10px;} .cat-n{font-weight:800;font-size:14px;} .cat-s{font-size:11px;color:#555;margin-top:3px;}
        </style></head><body><h1>${title} — ${list.length}</h1><div class="grid">${cards}</div>
        <script>window.onload=function(){setTimeout(function(){window.print();},500);};<\/script></body></html>`;
        const w = window.open('', '_blank');
        if (!w) { showToast(t('common.error'), 'error'); return; }
        w.document.open(); w.document.write(html); w.document.close();
      } finally { btn.disabled = false; }
    });

    // ----- Event summary report (printable / save-as-PDF) -----
    // ============================================================
    //  JUDGING — the panel score, separate from the public Best Car vote.
    //  One score 1–10 per judge per car; several judges average out. Results
    //  group by the car's `category`, which is already how the field is
    //  organised (Performance, JDM, Drift, …) — no parallel "class" concept.
    // ============================================================
    let _judgeScores = [];        // this judge's own scores, for the buttons
    let _judgeAll = [];           // every judge's scores, for the results view
    let _judgeFilter = 'all';     // 'all' | 'todo' | a category

    async function loadJudgeScores() {
      const ev = activeEventIdOrNull();
      let q = supa.from('judge_scores').select('car_id, judge_email, score');
      if (ev) q = q.eq('event_id', ev);
      const { data, error } = await q;
      if (error) { _judgeAll = []; _judgeScores = []; return; }
      _judgeAll = data || [];
      const me = (currentUserEmail() || '').toLowerCase();
      _judgeScores = _judgeAll.filter(s => (s.judge_email || '').toLowerCase() === me);
    }

    const myScoreFor = (carId) =>
      _judgeScores.find(s => String(s.car_id) === String(carId))?.score ?? null;

    async function setJudgeScore(carId, score) {
      const email = currentUserEmail();
      if (!email) return;
      // Optimistic: the judge is standing in front of the car and wants the
      // button to light up now, not after a round trip.
      const prev = _judgeScores.find(s => String(s.car_id) === String(carId));
      if (prev) prev.score = score;
      else _judgeScores.push({ car_id: carId, judge_email: email, score });
      renderJudge();
      const { error } = await supa.from('judge_scores').upsert({
        event_id: activeEventIdOrNull(), car_id: carId, judge_email: email, score,
      }, { onConflict: 'car_id,judge_email' });
      if (error) {
        showToast(t('common.error') + ': ' + error.message, 'error');
        await loadJudgeScores();
        renderJudge();
        return;
      }
      haptic(30);
      await loadJudgeScores();
      renderJudge();
    }

    function judgeCars() {
      const q = (state.judgeSearch || '').trim().toLowerCase();
      const asNo = /^#?\d+$/.test(q) ? q.replace('#', '') : null;
      return activeCars().filter(c => {
        if (_judgeFilter === 'todo' && myScoreFor(c.id) !== null) return false;
        if (_judgeFilter !== 'all' && _judgeFilter !== 'todo'
            && (c.category || '') !== _judgeFilter) return false;
        if (!q) return true;
        if (asNo) return String(c.entry_no || '') === asNo;
        return (c.model || '').toLowerCase().includes(q)
            || (c.brand || '').toLowerCase().includes(q)
            || (c.owner || '').toLowerCase().includes(q);
      }).sort((a, b) => Number(a.entry_no || 1e9) - Number(b.entry_no || 1e9));
    }

    function renderJudge() {
      const box = el('judgeResults');
      if (!box) return;
      const all = activeCars();
      const done = all.filter(c => myScoreFor(c.id) !== null).length;
      const prog = el('judgeProgress');
      if (prog) prog.textContent = t('judge.progress', { done, total: all.length });

      const cats = [...new Set(all.map(c => (c.category || '').trim()).filter(Boolean))].sort();
      const chip = (key, label, n) =>
        `<button type="button" class="chip${_judgeFilter === key ? ' active' : ''}" data-judge-filter="${escape(key)}">${escape(label)}<span class="count"> · ${n}</span></button>`;
      const chips = el('judgeChips');
      if (chips) {
        chips.innerHTML =
          chip('all', t('tasks.filter_all'), all.length) +
          chip('todo', t('judge.todo'), all.length - done) +
          cats.map(c => chip(c, localizeDept(c), all.filter(x => (x.category || '') === c).length)).join('');
      }

      const list = judgeCars();
      if (!list.length) { box.innerHTML = `<div class="gate-empty">${escape(t('common.nothing_found'))}</div>`; return; }
      box.innerHTML = list.slice(0, 80).map(c => {
        const mine = myScoreFor(c.id);
        const name = [c.brand, c.model].filter(Boolean).join(' ') || c.model || '—';
        const buttons = Array.from({ length: 10 }, (_, i) => i + 1).map(n =>
          `<button type="button" class="judge-score${mine === n ? ' is-set' : ''}" data-judge-car="${c.id}" data-judge-score="${n}">${n}</button>`).join('');
        return `<div class="judge-car${mine !== null ? ' is-scored' : ''}">
            <div class="judge-car-head">
              ${c.entry_no ? `<span class="entry-no">#${escape(String(c.entry_no))}</span>` : ''}
              <div class="judge-car-txt">
                <strong>${escape(name)}</strong>
                <span>${escape(c.owner || '')}${c.category ? ' · ' + escape(localizeDept(c.category)) : ''}</span>
              </div>
            </div>
            <div class="judge-scale">${buttons}</div>
          </div>`;
      }).join('') + (list.length > 80 ? `<div class="gate-more">${escape(t('gate.more', { n: list.length - 80 }))}</div>` : '');
    }

    // Averages per car, then the winner of each class. Ties are shown as ties
    // rather than silently resolved — the panel decides, not the sort order.
    function judgeResultsHtml() {
      const byCar = new Map();
      for (const s of _judgeAll) {
        const k = String(s.car_id);
        if (!byCar.has(k)) byCar.set(k, []);
        byCar.get(k).push(Number(s.score));
      }
      const rows = activeCars().map(c => {
        const arr = byCar.get(String(c.id)) || [];
        const avg = arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
        return { c, avg, n: arr.length };
      }).filter(r => r.avg !== null);
      if (!rows.length) return `<div class="block-empty">${escape(t('judge.no_scores'))}</div>`;

      const classes = [...new Set(rows.map(r => (r.c.category || '').trim() || '—'))].sort();
      return classes.map(cl => {
        const inCl = rows.filter(r => ((r.c.category || '').trim() || '—') === cl)
          .sort((a, b) => b.avg - a.avg);
        const best = inCl[0].avg;
        return `<div class="judge-class">
          <div class="judge-class-t">${escape(localizeDept(cl))}</div>
          ${inCl.map((r, i) => `
            <div class="judge-res${r.avg === best ? ' is-win' : ''}">
              <span class="judge-res-pos">${r.avg === best ? '🏆' : (i + 1) + '.'}</span>
              ${r.c.entry_no ? `<span class="entry-no">#${escape(String(r.c.entry_no))}</span>` : ''}
              <span class="judge-res-name">${escape([r.c.brand, r.c.model].filter(Boolean).join(' ') || '—')}</span>
              <span class="judge-res-avg">${r.avg.toFixed(1)}<small> (${r.n})</small></span>
            </div>`).join('')}
        </div>`;
      }).join('');
    }

    async function openJudge() {
      if (!roleAtLeast('staff')) return;
      const ov = el('judgeOverlay');
      if (!ov) return;
      ov.classList.add('show');
      ov.setAttribute('aria-hidden', 'false');
      el('judgeResults').innerHTML = `<div class="gate-empty">${escape(t('common.loading'))}</div>`;
      await loadJudgeScores();
      renderJudge();
    }
    function closeJudge() {
      const ov = el('judgeOverlay');
      if (!ov) return;
      ov.classList.remove('show');
      ov.setAttribute('aria-hidden', 'true');
    }
    el('judgeBtn')?.addEventListener('click', openJudge);
    el('judgeCloseBtn')?.addEventListener('click', closeJudge);
    el('judgeSearch')?.addEventListener('input', (e) => {
      state.judgeSearch = e.target.value; renderJudge();
    });
    el('judgeChips')?.addEventListener('click', (e) => {
      const b = e.target.closest('[data-judge-filter]');
      if (!b) return;
      _judgeFilter = b.dataset.judgeFilter;
      renderJudge();
    });
    el('judgeResults')?.addEventListener('click', (e) => {
      const b = e.target.closest('[data-judge-score]');
      if (!b) return;
      setJudgeScore(b.dataset.judgeCar, Number(b.dataset.judgeScore));
    });
    // Results live in the same surface, toggled — a modal on top of a
    // full-screen overlay is a trap on a phone.
    let _judgeShowResults = false;
    el('judgeResultsBtn')?.addEventListener('click', async () => {
      _judgeShowResults = !_judgeShowResults;
      const btn = el('judgeResultsBtn');
      if (btn) btn.textContent = t(_judgeShowResults ? 'judge.back' : 'judge.results');
      el('judgeChips').style.display = _judgeShowResults ? 'none' : '';
      document.querySelector('#judgeOverlay .gate-search').style.display = _judgeShowResults ? 'none' : '';
      if (!_judgeShowResults) { renderJudge(); return; }
      await loadJudgeScores();
      el('judgeResults').innerHTML = `<div class="judge-results-wrap">${judgeResultsHtml()}</div>`;
    });

    // ---------------------------------------------------------------
    // Trash, frozen start lists, RSVP and Telegram.
    //
    // These four hang together. Deleting is reversible so a bad import is one
    // undo; the trash also holds a car's entry number, which is what lets a
    // frozen start list survive a delete-and-reimport. RSVP frees a spot when
    // someone drops out, and Telegram is what actually carries the question.
    // ---------------------------------------------------------------

    const frozenEvent = () =>
      (state.events || []).find(e => String(e.id) === String(state.activeEventId) && e.entries_frozen) || null;

    // ----- Channel health, event readiness, sandbox (G19–G21) -----
    //
    // These three answer the same question from different angles: what is
    // quietly not set up? Every gap below has actually happened here — SMS with
    // no provider for months, a bot with zero linked chats, an event with no
    // agenda and 49 of 51 cars unassigned to a zone.

    let _health = null;

    // Whether a channel can actually deliver is decided server-side. Fetching is
    // separate from rendering because the SMS Center needs the answer without
    // the settings panel ever having been opened.
    async function fetchHealth() {
      try {
        const { data, error } = await supa.functions.invoke('health', { body: {} });
        if (error || data?.error) throw new Error(data?.error || error.message);
        _health = data;
      } catch (_) {
        _health = null;
      }
      return _health;
    }
    async function ensureHealth() {
      return _health || await fetchHealth();
    }
    async function loadChannelHealth() {
      const box = el('channelHealth');
      if (!box) return;
      if (!await fetchHealth()) { box.hidden = true; return; }
      const tg = _health.telegram || {};
      const sms = _health.sms || {};
      const pill = (state, label) =>
        `<span class="chan-pill is-${state}"><span class="chan-dot"></span>${escape(label)}</span>`;

      const tgState = !tg.configured ? 'bad' : (!tg.webhook_live ? 'bad' : (tg.linked ? 'ok' : 'warn'));
      const tgLabel = !tg.configured ? t('chan.tg_off')
        : !tg.webhook_live ? t('chan.tg_no_hook')
          : t('chan.tg_linked', { n: tg.linked, total: tg.total });

      box.innerHTML =
        pill(tgState, tgLabel) +
        pill(sms.configured ? 'ok' : 'warn', sms.configured ? t('chan.sms_on') : t('chan.sms_off')) +
        pill(_health.public_base_url ? 'ok' : 'bad',
          _health.public_base_url ? t('chan.base_ok') : t('chan.base_missing'));
      box.hidden = false;
    }

    // How many whole days from today to that date, read off the calendar in the
    // viewer's own timezone. Hours divided by 24 would call an event starting
    // in three hours "tomorrow" whenever it is late enough in the evening.
    function calendarDaysUntil(iso) {
      const then = new Date(iso);
      if (Number.isNaN(then.getTime())) return null;
      const now = new Date();
      const a = new Date(then.getFullYear(), then.getMonth(), then.getDate());
      const b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return Math.round((a - b) / 86400000);
    }

    // What is still missing for the event in hand. Only shows rows that are
    // actually unfinished, so it disappears entirely once you are ready.
    function renderReadyList() {
      const box = el('readyList');
      if (!box) return;
      const ev = (state.events || []).find(e => String(e.id) === String(state.activeEventId));
      if (!ev || !roleAtLeast('staff') || String(ev.status || '').toLowerCase().includes('finalizat')) {
        box.hidden = true; return;
      }
      const cars = activeCars();
      const agenda = (state.agenda || []).filter(a => String(a.event_id) === String(ev.id));
      const noZone = cars.filter(c => !String(c.zone || '').trim()).length;

      const items = [];

      // An event whose real date has passed but still reads "Activ". The app
      // keeps counting down to it and the readiness list keeps nagging about
      // preparation nobody needs any more. `date` is free text ("8 august
      // 2026"), so only `starts_at` can answer this.
      const endsAt = ev.ends_at ? Date.parse(ev.ends_at) : (ev.starts_at ? Date.parse(ev.starts_at) : NaN);
      if (!Number.isNaN(endsAt) && endsAt < Date.now()) {
        const days = Math.floor((Date.now() - endsAt) / 86400000);
        items.push({ k: 'over', txt: t('ready.event_over', { n: days }), go: 'events' });
      }

      // Two date fields, and the one that means anything can be empty: `date`
      // is free text for humans, `starts_at` is what reminders, the countdown
      // and the confirmation window all read. Without it they skip the event
      // in silence, which looks exactly like "nothing was due".
      if (!ev.starts_at) items.push({ k: 'nodate', txt: t('ready.no_start'), go: 'events' });

      if (!agenda.length) items.push({ k: 'agenda', txt: t('ready.agenda'), go: 'home' });
      if (cars.length && noZone) items.push({ k: 'zones', txt: t('ready.zones', { n: noZone, total: cars.length }), go: 'cars' });
      if (!ev.reg_capacity) items.push({ k: 'cap', txt: t('ready.capacity'), go: 'events' });
      // A field with cars on it and no drawing: the map is an empty frame and
      // nobody can be told where to stand.
      if (cars.length && ev.plan_id == null) items.push({ k: 'plan', txt: t('ready.no_plan'), go: 'map' });
      if (!ev.entries_frozen && cars.some(c => c.entry_no)) items.push({ k: 'freeze', txt: t('ready.freeze'), go: 'events' });
      if (_health) {
        const tg = _health.telegram || {};
        if (tg.configured && !tg.linked) items.push({ k: 'tg', txt: t('ready.telegram', { total: tg.total }), go: 'settings' });
        if (!_health.public_base_url) items.push({ k: 'base', txt: t('ready.base_url'), go: 'settings' });
      }
      // Only once the backup banner has actually looked. Undefined means
      // nobody has opened Settings yet, and guessing would be worse than
      // staying quiet.
      if (_backupAgeHours === null || (typeof _backupAgeHours === 'number' && _backupAgeHours > 26)) {
        items.push({ k: 'backup', txt: t('ready.backup'), go: 'settings' });
      }

      // Everything above asks about the event in hand — and that is exactly how
      // the next one stays invisible. Both events created last week sat two
      // days out with no cars, no plan and no capacity while Home said nothing:
      // they were simply not the event being looked at.
      for (const e2 of (state.events || [])) {
        if (String(e2.id) === String(ev.id) || e2.archived || e2.is_sandbox || !e2.starts_at) continue;
        const days = calendarDaysUntil(e2.starts_at);
        if (days == null || days < 0 || days > 7) continue;
        const n = (state.cars || []).filter(c => !c.deleted_at && String(c.event_id) === String(e2.id)).length;
        const gaps = [];
        if (!n) gaps.push(t('ready.soon_cars'));
        if (e2.plan_id == null) gaps.push(t('ready.soon_plan'));
        if (!e2.reg_capacity) gaps.push(t('ready.soon_cap'));
        if (!gaps.length) continue;
        const when = days === 0 ? t('ready.when_today')
          : days === 1 ? t('ready.when_tomorrow')
            : t('ready.when_days', { n: days });
        items.push({
          k: 'soon' + e2.id,
          txt: t('ready.soon', { name: e2.title || ('#' + e2.id), when, list: gaps.join(', ') }),
          go: 'events',
        });
      }

      if (!items.length) { box.hidden = true; return; }
      box.innerHTML =
        `<div class="ready-head">${escape(t('ready.title', { n: items.length }))}</div>` +
        items.map(i => `<button type="button" class="ready-row" data-ready-go="${escape(i.go)}">
            <span class="ready-dot"></span><span>${escape(i.txt)}</span>
            <span class="ready-arrow">›</span>
          </button>`).join('');
      box.hidden = false;
    }

    el('readyList')?.addEventListener('click', (e) => {
      const b = e.target.closest('[data-ready-go]');
      if (!b) return;
      document.querySelector(`.mtab[data-section="${b.dataset.readyGo}"], .tab[data-section="${b.dataset.readyGo}"]`)?.click();
    });

    // A sandbox event is a place to try things. Public pages skip it entirely
    // (see `submit` and `event-info`), so nothing real can land in it.
    function activeEventIsSandbox() {
      const ev = (state.events || []).find(e => String(e.id) === String(state.activeEventId));
      return !!(ev && ev.is_sandbox);
    }

    el('sandboxWipeBtn')?.addEventListener('click', async () => {
      const ev = (state.events || []).find(e => String(e.id) === String(state.activeEventId));
      if (!ev || !ev.is_sandbox) { showToast(t('sandbox.not_sandbox'), 'error'); return; }
      if (!await uiConfirm(t('sandbox.confirm_wipe', { name: ev.title || ('#' + ev.id) }), { okLabel: t('common.delete') })) return;
      const { data, error } = await supa.rpc('wipe_sandbox_event', { p_event_id: Number(ev.id) });
      if (error) { showToast(t('common.error') + ': ' + error.message, 'error'); return; }
      showToast(t('sandbox.wiped', { n: data ?? 0 }));
      await loadDataFull();
    });

    // ----- Offline beyond the gate (G22) -----
    //
    // The queue itself already existed for check-ins; what was missing was
    // telling anyone about it outside the gate screen, and routing the other
    // day-of writes through it. Some actions deliberately stay online-only —
    // see `requireOnline` — because replaying them later would be wrong, not
    // just late.
    function renderOfflineBar() {
      const bar = el('offlineBar');
      if (!bar) return;
      const pending = pendingCount();
      const online = navigator.onLine;
      if (online && !pending) { bar.hidden = true; return; }
      bar.className = 'offline-bar' + (online ? ' is-syncing' : ' is-offline');
      bar.textContent = online
        ? t('offline.pending', { n: pending })
        : (pending ? t('offline.bar_pending', { n: pending }) : t('offline.bar'));
      bar.hidden = false;
    }

    // Actions that cannot honestly be queued. Approving a registration makes a
    // car, and the entry number is assigned by the database — replaying that
    // later would hand out a number that is already on someone's windscreen.
    function requireOnline(what) {
      if (navigator.onLine) return true;
      showToast(t('offline.needs_connection', { what }), 'error');
      return false;
    }

    // ----- Trash -----
    async function fetchTrash() {
      const { data, error } = await supa.from('cars')
        .select('id, entry_no, brand, model, plate, owner, deleted_at, deleted_by, event_id')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false }).limit(200);
      return error ? { error, rows: [] } : { error: null, rows: data || [] };
    }

    async function renderTrash() {
      const box = el('trashList');
      if (!box) return;
      box.innerHTML = `<div class="block-empty">${escape(t('common.loading'))}</div>`;
      const { error, rows } = await fetchTrash();
      if (error) { box.innerHTML = `<div class="block-empty">${escape(error.message)}</div>`; return; }
      if (!rows.length) { box.innerHTML = `<div class="block-empty">${escape(t('trash.empty_state'))}</div>`; return; }
      box.innerHTML = rows.map(c => {
        const name = [c.brand, c.model].filter(Boolean).join(' ') || c.plate || '—';
        return `<div class="backup-row">
          <div class="backup-meta">
            <strong>${c.entry_no ? `<span class="entry-no">#${escape(String(c.entry_no))}</span> ` : ''}${escape(name)}</strong>
            <span>${escape(c.plate || '')}${c.owner ? ' · ' + escape(c.owner) : ''} · ${escape(fmtRelative(c.deleted_at))}</span>
          </div>
          <button type="button" class="btn small ghost" data-trash-restore="${c.id}">${escape(t('trash.restore'))}</button>
        </div>`;
      }).join('');
    }

    el('trashRefreshBtn')?.addEventListener('click', () => renderTrash());

    el('trashList')?.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-trash-restore]');
      if (!btn) return;
      btn.disabled = true;
      const res = await untrashCar(btn.dataset.trashRestore);
      if (res.error) { showToast(t('common.error') + ': ' + res.error.message, 'error'); btn.disabled = false; return; }
      showToast(res.renumbered ? t('trash.restored_renumbered', { n: res.entry_no }) : t('undo.restored'));
      await loadDataFull();
      renderTrash();
    });

    el('trashEmptyBtn')?.addEventListener('click', async () => {
      const { rows } = await fetchTrash();
      if (!rows.length) { showToast(t('trash.empty_state')); return; }
      if (!await uiConfirm(t('trash.confirm_empty', { n: rows.length }), { okLabel: t('common.delete') })) return;
      // This one really is final — it is the only hard delete left for cars.
      const { error } = await supa.from('cars').delete().not('deleted_at', 'is', null);
      if (error) { showToast(t('common.error') + ': ' + error.message, 'error'); return; }
      showToast(t('trash.emptied', { n: rows.length }));
      renderTrash();
    });

    // ----- Recent imports, and undoing one -----
    async function renderImports() {
      const box = el('importList');
      if (!box) return;
      const { data, error } = await supa.from('import_log')
        .select('id, source, inserted, skipped, total, note, batch, undone_at, created_at')
        .order('id', { ascending: false }).limit(10);
      if (error) { box.innerHTML = `<div class="block-empty">${escape(error.message)}</div>`; return; }
      if (!data || !data.length) { box.innerHTML = `<div class="block-empty">${escape(t('trash.no_imports'))}</div>`; return; }
      box.innerHTML = data.map(r => {
        const canUndo = r.batch && !r.undone_at && r.inserted > 0;
        return `<div class="backup-row">
          <div class="backup-meta">
            <strong>${escape(t('trash.import_line', { n: r.inserted ?? 0, total: r.total ?? 0 }))}</strong>
            <span>${escape(fmtRelative(r.created_at))}${r.note ? ' · ' + escape(r.note) : ''}${r.undone_at ? ' · ' + escape(t('trash.import_undone')) : ''}</span>
          </div>
          ${canUndo ? `<button type="button" class="btn small ghost" data-import-undo="${escape(r.batch)}">${escape(t('trash.undo_import'))}</button>` : ''}
        </div>`;
      }).join('');
    }

    el('importList')?.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-import-undo]');
      if (!btn) return;
      const batch = btn.dataset.importUndo;
      const { count } = await supa.from('cars')
        .select('id', { count: 'exact', head: true }).eq('import_batch', batch).is('deleted_at', null);
      if (!count) { showToast(t('trash.import_nothing')); renderImports(); return; }
      if (!await uiConfirm(t('trash.confirm_undo_import', { n: count }))) return;
      btn.disabled = true;
      // Trashed, not destroyed — undoing an undo is a restore away.
      const { error } = await supa.from('cars')
        .update({ deleted_at: new Date().toISOString(), deleted_by: currentUserEmail() || null })
        .eq('import_batch', batch).is('deleted_at', null);
      if (error) { showToast(t('common.error') + ': ' + error.message, 'error'); btn.disabled = false; return; }
      await supa.from('import_log').update({ undone_at: new Date().toISOString() }).eq('batch', batch);
      showToast(t('trash.import_undone_n', { n: count }));
      await loadDataFull();
      renderImports(); renderTrash();
    });

    // ----- Telegram -----
    // `app_config` has RLS on with no policies — deliberately, because it holds
    // secrets. So the bot token is never read or written from here: Settings
    // posts it to the `telegram` function, which stores it with the service
    // role and reports back only whether one exists. Everything non-secret
    // (the toggle, the public address) lives in `ui_settings`, which staff can
    // write.
    let _tgUsername = '';

    async function tgCall(action, extra) {
      const { data, error } = await supa.functions.invoke('telegram', { body: { action, ...(extra || {}) } });
      if (error) {
        let b = null; try { b = await error.context.json(); } catch (_) {}
        throw new Error(b?.detail || b?.error || error.message);
      }
      if (data?.error) throw new Error(data.detail || data.error);
      return data || {};
    }

    async function loadTelegramSettings() {
      const { data: ui } = await supa.from('ui_settings')
        .select('key,value').in('key', ['notify_prefer_telegram', 'public_base_url']);
      const u = {}; for (const r of ui || []) u[r.key] = r.value || '';
      const pref = el('tgPrefer');
      if (pref) pref.checked = String(u.notify_prefer_telegram ?? '1') === '1';
      const base = el('publicBaseUrl');
      if (base) { base.value = u.public_base_url || ''; base.placeholder = location.origin; }

      const tok = el('tgToken');
      if (tok) tok.value = '';
      const msg = el('tgMsg');
      try {
        const st = await tgCall('status');
        _tgUsername = st.username || '';
        // Never echo the token back — say that one is stored, not what it is.
        if (tok) tok.placeholder = st.has_token ? '••••••••  (salvat)' : '123456:ABC-DEF...';
        if (msg) {
          if (!st.has_token) { msg.style.color = ''; msg.textContent = t('tg.no_token_yet'); }
          else if (st.webhook) { msg.style.color = 'var(--green)'; msg.textContent = t('tg.status_ok', { name: '@' + _tgUsername, n: st.linked ?? 0 }); }
          else { msg.style.color = 'var(--red)'; msg.textContent = t('tg.status_no_hook'); }
        }
      } catch (e) {
        if (msg) { msg.style.color = 'var(--red)'; msg.textContent = t('common.error') + ': ' + (e.message || e); }
      }
    }

    // Invite links are minted server-side: they are signed with `link_secret`,
    // which lives in app_config and is unreachable from the browser.
    async function tgInviteFor(carIds) {
      const data = await tgCall('invite', { car_ids: [].concat(carIds).map(Number) });
      return data.cars || [];
    }

    // Hand one driver their connect link. Lives in one place because the
    // ordering below is easy to get wrong and there are now two callers.
    //
    // The driver is by definition NOT on Telegram yet — that is what the link
    // is for — so the bot cannot deliver it, and there has never been an SMS
    // provider. WhatsApp is the channel that actually works.
    async function sendInviteToDriver(carId) {
      const car = (state.cars || []).find(x => String(x.id) === String(carId));
      const phone = car ? normalizePhone(car.phone || car.contact) : '';
      // Opened inside the click, before the await: minting the link is a round
      // trip, and a window opened after it is treated as a popup and blocked —
      // silently, on mobile Safari.
      const win = phone ? window.open('', '_blank') : null;
      try {
        const rows = await tgInviteFor([carId]);
        const link = rows[0]?.link;
        if (!link) throw new Error(t('tg.no_token_yet'));
        if (phone && win) {
          win.location = `https://wa.me/${phone}?text=${encodeURIComponent(
            // The space lives in the value, not the template: an empty owner
            // must not leave "Bună !" behind.
            t('tg.invite_msg', { name: car && car.owner ? ' ' + car.owner : '', link }))}`;
          showToast(t('tg.invite_sent'));
        } else {
          // No phone, or the browser refused the window: the link is still
          // worth having, so fall back to the clipboard rather than fail.
          if (win) win.close();
          await navigator.clipboard.writeText(link);
          showToast(t('tg.invite_one_copied'));
        }
        return true;
      } catch (e) {
        if (win) win.close();
        showToast(t('common.error') + ': ' + (e.message || e), 'error');
        return false;
      }
    }

    el('tgConnectBtn')?.addEventListener('click', async () => {
      const msg = el('tgMsg'); const tok = el('tgToken');
      const value = (tok?.value || '').trim();
      const btn = el('tgConnectBtn');
      if (msg) { msg.style.color = ''; msg.textContent = t('common.loading'); }
      if (btn) btn.disabled = true;
      try {
        const data = await tgCall('setup', value ? { token: value } : {});
        if (!data.has_token) throw new Error(t('tg.no_token_yet'));
        _tgUsername = data.username || '';
        if (tok) tok.value = '';
        if (msg) { msg.style.color = 'var(--green)'; msg.textContent = t('tg.connected_as', { name: '@' + _tgUsername }); }
      } catch (e) {
        if (msg) { msg.style.color = 'var(--red)'; msg.textContent = t('common.error') + ': ' + (e.message || e); }
      } finally {
        if (btn) btn.disabled = false;
      }
    });

    // Who can actually be reached, and one tap per person to fix it. The count
    // alone (1 of 52) has been visible in the health pill for a while and moved
    // nothing, because there was nowhere to go from it.
    function renderTgFunnel() {
      const box = el('tgFunnel');
      if (!box) return;
      if (!roleAtLeast('staff')) { box.hidden = true; return; }
      const cars = activeCars();
      if (!cars.length) { box.hidden = true; return; }
      const missing = cars.filter(c => !c.telegram_chat_id);
      const linked = cars.length - missing.length;
      if (!missing.length) {
        box.innerHTML = `<div class="tg-funnel-head is-done">${escape(t('tg.funnel_all', { n: cars.length }))}</div>`;
        box.hidden = false;
        return;
      }
      // Long lists are the normal case here (51 of 52), so cap the rows and say
      // how many are not shown rather than rendering a wall.
      const SHOWN = 12;
      const rows = missing.slice(0, SHOWN).map(c => {
        const name = [c.brand, c.model].filter(Boolean).join(' ') || c.plate || '—';
        const who = [c.owner, c.plate].filter(Boolean).join(' · ');
        const can = !!normalizePhone(c.phone || c.contact);
        return `<div class="tg-funnel-row">
          <span class="tg-funnel-no">${c.entry_no ? '#' + escape(String(c.entry_no)) : ''}</span>
          <span class="tg-funnel-name"><strong>${escape(name)}</strong><small>${escape(who)}</small></span>
          <button type="button" class="btn small ghost" data-tg-invite="${c.id}">${
            escape(can ? t('tg.invite_send') : t('tg.invite_one'))}</button>
        </div>`;
      }).join('');
      const more = missing.length - Math.min(SHOWN, missing.length);
      box.innerHTML =
        `<div class="tg-funnel-head">${escape(t('tg.funnel_head', { linked, total: cars.length }))}</div>`
        + rows
        + (more ? `<div class="tg-funnel-more">${escape(t('tg.funnel_more', { n: more }))}</div>` : '');
      box.hidden = false;
    }

    el('tgFunnel')?.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-tg-invite]');
      if (!b) return;
      b.disabled = true;
      await sendInviteToDriver(b.dataset.tgInvite);
      b.disabled = false;
    });

    el('tgStatusBtn')?.addEventListener('click', async () => {
      const msg = el('tgMsg');
      if (msg) { msg.style.color = ''; msg.textContent = t('common.loading'); }
      await loadTelegramSettings();
    });

    // Nobody is reachable until they open their own link, so getting the links
    // out is the whole job. This copies one per car for the event in hand.
    el('tgInviteAllBtn')?.addEventListener('click', async () => {
      const msg = el('tgMsg');
      const cars = activeCars();
      if (!cars.length) { showToast(t('tg.invite_none')); return; }
      if (msg) { msg.style.color = ''; msg.textContent = t('common.loading'); }
      try {
        const rows = await tgInviteFor(cars.map(c => c.id));
        const text = rows.map(r =>
          [r.entry_no ? '#' + r.entry_no : '', r.name, r.owner, r.link].filter(Boolean).join(' — ')
        ).join('\n');
        await navigator.clipboard.writeText(text);
        const left = rows.filter(r => !r.linked).length;
        if (msg) { msg.style.color = 'var(--green)'; msg.textContent = t('tg.invite_copied', { n: rows.length, left }); }
      } catch (e) {
        if (msg) { msg.style.color = 'var(--red)'; msg.textContent = t('common.error') + ': ' + (e.message || e); }
      }
    });

    el('tgPrefer')?.addEventListener('change', async (e) => {
      await supa.from('ui_settings').upsert({ key: 'notify_prefer_telegram', value: e.target.checked ? '1' : '0' });
      showToast(t('common.saved'));
    });

    el('publicBaseHereBtn')?.addEventListener('click', () => {
      const inp = el('publicBaseUrl'); if (inp) inp.value = location.origin;
    });

    el('publicBaseSaveBtn')?.addEventListener('click', async () => {
      const inp = el('publicBaseUrl'); const msg = el('publicBaseMsg');
      const value = (inp?.value || '').trim().replace(/\/+$/, '');
      if (value && !/^https?:\/\//i.test(value)) {
        if (msg) { msg.style.color = 'var(--red)'; msg.textContent = t('tg.base_bad'); }
        return;
      }
      const { error } = await supa.from('ui_settings').upsert({ key: 'public_base_url', value });
      if (msg) {
        msg.style.color = error ? 'var(--red)' : 'var(--green)';
        msg.textContent = error ? (t('common.error') + ': ' + error.message) : t('common.saved');
      }
    });

    el('reportBtn')?.addEventListener('click', async () => {
      const btn = el('reportBtn');
      btn.disabled = true;
      try {
        const esc = (s) => escape(String(s == null ? '' : s));
        const cars = activeCars();
        const ev = (state.events || []).find(e => String(e.id) === String(state.activeEventId));
        const evName = ev ? (ev.title || ev.name || '') : t('report.all_events');
        const evMeta = ev ? [ev.date, ev.location].filter(Boolean).join(' · ') : '';
        const isArr = (c) => statusKey(c.status) === 'sosit';
        const arrived = cars.filter(isArr).length;
        const everArrived = cars.filter(c => isArr(c) || c.arrived_at).length;
        // Arrivals per hour.
        const byHour = {};
        cars.forEach(c => { if (c.arrived_at) { const h = new Date(c.arrived_at).getHours(); byHour[h] = (byHour[h] || 0) + 1; } });
        const hours = Object.keys(byHour).map(Number).sort((a, b) => a - b);
        const maxH = Math.max(1, ...hours.map(h => byHour[h]));
        const hoursBars = hours.length ? hours.map(h => `<div style="display:inline-block;text-align:center;width:34px;vertical-align:bottom;">
            <div style="background:#3b82f6;width:20px;margin:0 auto;height:${Math.round(byHour[h] / maxH * 90) + 4}px;border-radius:4px 4px 0 0;"></div>
            <div style="font-size:10px;color:#666;margin-top:3px;">${String(h).padStart(2, '0')}</div>
            <div style="font-size:10px;color:#111;font-weight:700;">${byHour[h]}</div></div>`).join('') : '<span style="color:#999;">—</span>';
        // Top-N tally helper.
        const topBy = (keyFn) => {
          const g = {}; cars.forEach(c => { const k = (keyFn(c) || '').trim(); if (k) g[k] = (g[k] || 0) + 1; });
          return Object.entries(g).sort((a, b) => b[1] - a[1]).slice(0, 8);
        };
        const tableRows = (rows) => rows.length ? rows.map(([k, n]) => `<tr><td>${esc(k)}</td><td style="text-align:right;font-weight:700;">${n}</td></tr>`).join('') : '<tr><td colspan="2" style="color:#999;">—</td></tr>';
        // Optional: feedback average + votes for the active event.
        let extra = '', feedbackSection = '';
        if (ev && navigator.onLine) {
          try {
            const [{ data: fb }, { data: vt }] = await Promise.all([
              supa.from('event_feedback').select('rating, comment').eq('event_id', ev.id),
              supa.from('car_votes').select('id').eq('event_id', ev.id),
            ]);
            const fbRows = fb || [];
            const avg = fbRows.length ? (fbRows.reduce((s, r) => s + (r.rating || 0), 0) / fbRows.length).toFixed(1) : null;
            const bits = [];
            if (avg) bits.push(`${t('report.feedback')}: <b>${avg} ★</b> (${fbRows.length})`);
            if (vt && vt.length) bits.push(`${t('report.votes')}: <b>${vt.length}</b>`);
            if (bits.length) extra = `<p style="margin:6px 0 0;color:#333;">${bits.join(' &nbsp;·&nbsp; ')}</p>`;
            // Star distribution + the comments people actually wrote — the part
            // an organiser wants to read, not just the average.
            if (fbRows.length) {
              const dist = [5, 4, 3, 2, 1].map(star => {
                const n = fbRows.filter(r => r.rating === star).length;
                const pct = Math.round(n / fbRows.length * 100);
                return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;font-size:12px;">
                    <span style="width:36px;">${star} ★</span>
                    <span style="flex:1;height:8px;background:#eee;border-radius:99px;overflow:hidden;">
                      <span style="display:block;height:100%;width:${pct}%;background:#f5c542;"></span></span>
                    <span style="width:52px;text-align:right;">${n} (${pct}%)</span>
                  </div>`;
              }).join('');
              const comments = fbRows.filter(r => (r.comment || '').trim()).slice(0, 20);
              const list = comments.length
                ? `<div style="margin-top:10px;">${comments.map(r =>
                    `<div style="border-left:3px solid #f5c542;padding:3px 0 3px 9px;margin-bottom:7px;font-size:12px;">
                       <b>${'★'.repeat(r.rating || 0)}</b> ${esc(r.comment)}</div>`).join('')}</div>`
                : '';
              feedbackSection = `<h2>${esc(t('report.feedback'))}</h2><div>${dist}</div>${list}`;
            }
          } catch (_) {}
        }
        const stat = (n, label) => `<div class="stat"><div class="n">${n}</div><div class="l">${esc(label)}</div></div>`;
        const now = new Date().toLocaleString('ro-RO');
        const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(t('report.title'))} — ${esc(evName)}</title><style>
          *{box-sizing:border-box;font-family:-apple-system,Segoe UI,Roboto,sans-serif;}
          body{margin:0;padding:28px;background:#fff;color:#111;}
          h1{font-size:22px;margin:0;} .meta{color:#666;font-size:13px;margin:2px 0 18px;}
          .stats{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:22px;}
          .stat{border:1px solid #e2e2e2;border-radius:12px;padding:12px 16px;min-width:110px;}
          .stat .n{font-size:26px;font-weight:800;} .stat .l{font-size:11px;color:#666;text-transform:uppercase;letter-spacing:.04em;}
          h2{font-size:14px;margin:20px 0 8px;text-transform:uppercase;letter-spacing:.04em;color:#444;}
          .bars{border:1px solid #eee;border-radius:10px;padding:14px;min-height:120px;}
          table{width:100%;border-collapse:collapse;} td{padding:5px 8px;border-bottom:1px solid #eee;font-size:13px;}
          .cols{display:flex;gap:18px;flex-wrap:wrap;} .cols>div{flex:1;min-width:200px;}
          .foot{margin-top:24px;color:#999;font-size:11px;}
        </style></head><body>
          <h1>🏁 ${esc(t('report.title'))} — ${esc(evName)}</h1>
          <div class="meta">${esc(evMeta)}</div>
          <div class="stats">
            ${stat(cars.length, t('report.total_cars'))}
            ${stat(arrived, t('aflux.present_now'))}
            ${stat(everArrived, t('aflux.arrived_total'))}
          </div>
          ${extra}
          <h2>${esc(t('aflux.by_hour'))}</h2>
          <div class="bars">${hoursBars}</div>
          <div class="cols">
            <div><h2>${esc(t('aflux.by_zone'))}</h2><table>${tableRows(topBy(c => c.zone))}</table></div>
            <div><h2>${esc(t('aflux.by_brand'))}</h2><table>${tableRows(topBy(c => c.brand))}</table></div>
            <div><h2>${esc(t('aflux.by_city'))}</h2><table>${tableRows(topBy(c => c.city))}</table></div>
          </div>
          ${feedbackSection}
          <div class="foot">Kultura · ${esc(now)}</div>
          <script>window.onload=function(){setTimeout(function(){window.print();},400);};<\/script>
        </body></html>`;
        const w = window.open('', '_blank');
        if (!w) { showToast(t('common.error'), 'error'); return; }
        w.document.open(); w.document.write(html); w.document.close();
      } finally { btn.disabled = false; }
    });

    el('deleteAllCarsBtn').addEventListener('click', async () => {
      // Scoped to what is on screen: wiping cars belonging to another event
      // from here would be a surprise. Reversible for 30 days.
      const victims = activeCars().map(c => c.id);
      if (!victims.length) { uiAlert(t('trash.nothing_to_delete')); return; }
      if (!await uiConfirm(t('settings.confirm_delete_all_cars', { n: victims.length }))) return;
      try {
        const { error } = await trashCars(victims);
        if (error) { uiAlert(t('common.error') + ': ' + error.message); return; }
        await loadData();
        showUndoToast(t('trash.moved_n', { n: victims.length }), async () => {
          for (const id of victims) await untrashCar(id);
          await loadDataFull();
          showToast(t('undo.restored'));
        });
      } catch (err) {
        uiAlert(t('common.error') + ': ' + err.message);
      }
    });

    // ----- Google Sheets auto-sync (admin) -----
    // The saved CSV link lives in ui_settings; a pg_cron job pulls it every few
    // minutes. This just lets an admin set the link and trigger a sync on demand.
    async function loadSheetSyncUrl() {
      const inp = el('sheetSyncUrl');
      if (!inp) return;
      try {
        const { data } = await supa.from('ui_settings').select('value').eq('key', 'cars_sheet_csv_url').maybeSingle();
        if (document.activeElement !== inp) inp.value = data?.value || '';
      } catch (_) {}
    }
    el('sheetSyncSaveBtn')?.addEventListener('click', async () => {
      const inp = el('sheetSyncUrl'), msg = el('sheetSyncMsg');
      const url = (inp?.value || '').trim();
      const { error } = await supa.from('ui_settings').upsert(
        { key: 'cars_sheet_csv_url', value: url, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );
      if (msg) {
        msg.className = 'modal-msg show';
        msg.style.color = error ? 'var(--red)' : 'var(--green)';
        msg.textContent = error ? (t('common.error') + ': ' + error.message) : t('sheetsync.saved');
      }
    });
    el('sheetSyncNowBtn')?.addEventListener('click', async () => {
      const msg = el('sheetSyncMsg'), btn = el('sheetSyncNowBtn');
      if (btn) btn.disabled = true;
      if (msg) { msg.className = 'modal-msg show'; msg.style.color = 'var(--text-dim)'; msg.textContent = t('sheetsync.running'); }
      try {
        // Private method: an Apps Script Web App URL. We can't read its response
        // from the browser (CORS/redirect), so fire it and reload after a moment.
        const cfgUrl = (el('sheetSyncUrl')?.value || '').trim();
        if (/script\.google\.com/.test(cfgUrl)) {
          try { await fetch(cfgUrl, { method: 'GET', mode: 'no-cors' }); } catch (_) {}
          if (msg) { msg.style.color = 'var(--text-dim)'; msg.textContent = t('sheetsync.started'); }
          setTimeout(async () => {
            try { await loadData(); } catch (_) {}
            if (msg) { msg.style.color = 'var(--green)'; msg.textContent = t('sheetsync.started_done'); }
            if (btn) btn.disabled = false;
          }, 6000);
          return;
        }
        // Public CSV method: the edge function pulls it and reports counts.
        const { data, error } = await supa.functions.invoke('import-participants', { body: {} });
        if (error) {
          // A non-2xx response carries the real reason in error.context (a Response).
          let body = null;
          try { body = await error.context.json(); } catch (_) {}
          throw new Error(body?.note || body?.error || error.message || 'invoke failed');
        }
        if (data && data.error) throw new Error(data.note || data.error);
        if (msg) { msg.style.color = 'var(--green)'; msg.textContent = t('sheetsync.done', { n: data?.inserted ?? 0, u: data?.updated ?? 0, s: data?.skipped ?? 0 }); }
        await loadData();
        if (btn) btn.disabled = false;
      } catch (e) {
        if (msg) { msg.style.color = 'var(--red)'; msg.textContent = t('common.error') + ': ' + (e.message || e); }
        if (btn) btn.disabled = false;
      }
    });

    // ---- Public registration link (admin) ----
    // register.html lets participants sign their own car up; entries land in the
    // approval queue on Home. Here we just hand admins the shareable link + QR.
    function registrationUrl() {
      return new URL('register.html', location.href).href;
    }
    // Link + QR for any of the public pages handed out at the event. One picker
    // instead of four near-identical blocks.
    function publicPageUrl() {
      const sel = el('pubPageSel');
      const u = new URL((sel && sel.value) || 'register.html', location.href);
      // Pin the link to one event when the operator picked one. Left empty,
      // the pages resolve the current event themselves — which is what you
      // want for a permanent QR on a windscreen, while a poster printed for a
      // single event wants the id baked in.
      const ev = el('pubEventSel')?.value;
      if (ev) u.searchParams.set('event', ev);
      return u.href;
    }

    // Keep the event list in the public-pages picker in step with the events,
    // defaulting to whatever the app is scoped to right now.
    function populatePublicEventPicker() {
      const sel = el('pubEventSel');
      if (!sel) return;
      const prev = sel.value;
      while (sel.options.length > 1) sel.remove(1);
      [...(state.events || [])]
        .sort((a, b) => (a.archived ? 1 : 0) - (b.archived ? 1 : 0) || Number(b.id) - Number(a.id))
        .forEach(ev => {
          const o = document.createElement('option');
          o.value = String(ev.id);
          o.textContent = ev.title || ('#' + ev.id);
          sel.appendChild(o);
        });
      const want = prev || String(state.activeEventId || '');
      sel.value = [...sel.options].some(o => o.value === want) ? want : '';
      // The link is built at init, before events have loaded and this picker
      // has a value — refresh it, or the shown link silently omits ?event=
      // while the dropdown claims an event is selected.
      const inp = el('regLink');
      if (inp) inp.value = publicPageUrl();
    }

    (function initRegShare() {
      const inp = el('regLink');
      const syncLink = () => {
        if (inp) inp.value = publicPageUrl();
        const box = el('regQrBox');
        if (box) { box.style.display = 'none'; box.innerHTML = ''; } // stale QR
      };
      syncLink();
      el('pubPageSel')?.addEventListener('change', syncLink);
      el('pubEventSel')?.addEventListener('change', () => {
        syncLink();
        // Also pin it for pages opened without ?event= (an old QR, a bare
        // link), so „the public pages show this event” is true either way.
        const v = el('pubEventSel').value;
        supa.from('ui_settings')
          .upsert({ key: 'public_event_id', value: v, updated_at: new Date().toISOString() },
                  { onConflict: 'key' })
          .then(({ error }) => {
            const msg = el('regMsg');
            if (!msg) return;
            msg.style.color = error ? 'var(--red)' : 'var(--green)';
            msg.textContent = error ? t('common.error') + ': ' + error.message : t('pub.event_saved');
            setTimeout(() => { msg.textContent = ''; }, 2500);
          });
      });
      el('regCopyBtn')?.addEventListener('click', async () => {
        const url = publicPageUrl();
        try { await navigator.clipboard.writeText(url); }
        catch (_) { if (inp) { inp.select(); document.execCommand && document.execCommand('copy'); } }
        const msg = el('regMsg'); if (msg) { msg.style.color = 'var(--green)'; msg.textContent = t('reg.share_copied'); setTimeout(() => { msg.textContent = ''; }, 2500); }
      });
      el('regOpenBtn')?.addEventListener('click', () => { window.open(publicPageUrl(), '_blank'); });
      el('regQrBtn')?.addEventListener('click', async () => {
        const box = el('regQrBox'); if (!box) return;
        if (box.style.display !== 'none' && box.innerHTML) { box.style.display = 'none'; return; }
        box.style.display = 'block';
        box.innerHTML = `<div class="qr-loading"></div>`;
        try {
          const qrlib = await ensureQrLib();
          const qr = qrlib(0, 'M'); qr.addData(publicPageUrl()); qr.make();
          // Printable: the QR is what actually goes on a poster or a flyer.
          box.innerHTML = qr.createSvgTag({ scalable: true, margin: 1 }) +
            `<div style="text-align:center;margin-top:8px;">
               <button type="button" class="btn small ghost" id="pubQrPrintBtn">${escape(t('car.qr.print'))}</button>
             </div>`;
          el('pubQrPrintBtn')?.addEventListener('click', () => {
            const w = window.open('', '_blank');
            if (!w) return;
            const label = el('pubPageSel')?.selectedOptions[0]?.textContent || '';
            w.document.open();
            w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>QR</title><style>
              body{margin:0;padding:40px;font-family:-apple-system,Segoe UI,Roboto,sans-serif;text-align:center;background:#fff;color:#111;}
              .q{width:12cm;height:12cm;margin:0 auto;} .q svg{width:100%;height:100%;}
              h1{font-size:22px;margin:0 0 6px;} p{color:#666;font-size:13px;word-break:break-all;}
            </style></head><body>
              <h1>${escape(label)}</h1>
              <div class="q">${qr.createSvgTag({ scalable: true, margin: 1 })}</div>
              <p>${escape(publicPageUrl())}</p>
              <script>window.onload=function(){setTimeout(function(){window.print();},300);};<\/script>
            </body></html>`);
            w.document.close();
          });
        } catch (e) {
          box.innerHTML = `<div class="qr-err">${escape(t('common.error'))}</div>`;
        }
      });
    })();

    // ================= SMS CENTER (admin) =================
    // Recipients come from the cars of the event in hand.
    // Sending goes through the send-sms edge function; live progress is polled
    // from the sms_history row it updates.
    const SMS_VAR_KEYS = ['prenume', 'nume', 'marca', 'model', 'numar', 'categoria', 'qr_code'];
    let _smsHistory = [];
    let _smsSending = false;
    let _smsPoll = null;

    function smsPhoneOk(p) { return !!normalizePhone(p); }
    function smsSelectedAud() {
      return Array.from(document.querySelectorAll('#smsAudience input[type=checkbox]:checked'))
        .map(c => c.dataset.smsAud);
    }

    // Build the de-duplicated recipient list from the current selection + filters.
    function smsRecipients() {
      const aud = new Set(smsSelectedAud());
      const fb = (el('smsFilterBrand')?.value || '').trim();
      const fc = (el('smsFilterCategory')?.value || '').trim();
      const fcity = (el('smsFilterCity')?.value || '').trim();
      // Keyed by car. It used to be keyed by phone alone, which quietly dropped
      // anyone reachable only on Telegram — and without a car id the sender
      // could never find their chat, so a campaign could not use the bot.
      const byKey = new Map();
      const add = (phone, vars, carId, chatId) => {
        const n = normalizePhone(phone);
        if (!n && !chatId) return;             // no way to reach this person
        const key = carId != null ? 'c' + carId : 'p' + n;
        if (!byKey.has(key)) byKey.set(key, { phone: phone || '', car_id: carId ?? null, _chat: !!chatId, vars });
      };
      // Participants (cars)
      const wantAll = aud.has('all'), wantConf = aud.has('confirmed'), wantUnconf = aud.has('unconfirmed');
      if (wantAll || wantConf || wantUnconf) {
        for (const c of activeCars()) {
          if (fb && (c.brand || '') !== fb) continue;
          if (fc && (c.category || '') !== fc) continue;
          if (fcity && (c.city || '') !== fcity) continue;
          // "Confirmed" means the driver answered the confirmation, not that
          // they turned up. Reading the status instead made the two audiences
          // useless in both directions: before the day nobody has arrived, so
          // "confirmed" was always empty, and during the day "unconfirmed"
          // dropped everyone who came without ever answering.
          const confirmed = String(c.rsvp || '').toLowerCase() === 'yes';
          if (!(wantAll || (wantConf && confirmed) || (wantUnconf && !confirmed))) continue;
          const parts = (c.owner || '').trim().split(/\s+/);
          add(c.phone, {
            prenume: parts.shift() || '', nume: parts.join(' '),
            marca: c.brand || '', model: c.model || '', numar: c.plate || '',
            categoria: c.category || '', qr_code: ticketUrl(c)
          }, c.id, c.telegram_chat_id);
        }
      }
      return Array.from(byKey.values());
    }

    function smsSegments(txt) {
      const len = (txt || '').length;
      if (!len) return 0;
      const unicode = [...txt].some(ch => ch.charCodeAt(0) > 127); // diacritice/chirilice -> segmente de 70
      const single = unicode ? 70 : 160, multi = unicode ? 67 : 153;
      return len <= single ? 1 : Math.ceil(len / multi);
    }
    function smsSubstitute(msg, vars) {
      return String(msg || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (vars && vars[k] != null ? vars[k] : ''));
    }

    function updateSmsCount() {
      const list = smsRecipients();
      const n = list.length;
      const viaTg = list.filter(r => r._chat).length;
      const box = el('smsRecipientCount');
      if (!box) return;
      box.textContent = t('sms.will_receive', { n })
        + (n ? ' · ' + t('sms.split_channels', { tg: viaTg, sms: n - viaTg }) : '');
    }
    function updateSmsMeta() {
      const txt = el('smsMessage')?.value || '';
      const seg = smsSegments(txt);
      const cc = el('smsCharCount');
      if (cc) cc.textContent = t('sms.char_meta', { c: txt.length, n: seg });
    }
    function renderSmsFilters() {
      const cars = activeCars();
      const fill = (id, values, cur) => {
        const sel = el(id); if (!sel) return;
        const keep = cur != null ? cur : sel.value;
        const opts = ['<option value="">' + escape(t('sms.f_any')) + '</option>']
          .concat(values.map(v => `<option value="${escape(v)}">${escape(v)}</option>`));
        sel.innerHTML = opts.join('');
        sel.value = keep;
      };
      const uniq = (arr) => Array.from(new Set(arr.filter(x => x && String(x).trim()))).sort((a, b) => a.localeCompare(b, 'ro'));
      fill('smsFilterBrand', uniq(cars.map(c => c.brand)));
      fill('smsFilterCategory', uniq(cars.map(c => c.category)));
      fill('smsFilterCity', uniq(cars.map(c => c.city)));
    }
    function renderSmsStats() {
      const cars = activeCars();
      const people = cars.length;
      const valid = cars.filter(c => smsPhoneOk(c.phone) || c.telegram_chat_id).length;
      const today = new Date().toISOString().slice(0, 10);
      const sentToday = _smsHistory
        .filter(h => (h.created_at || '').slice(0, 10) === today)
        .reduce((s, h) => s + (h.sent_count || 0), 0);
      const set = (id, val) => { const n = el(id); if (n) n.textContent = val; };
      set('smsStatTotal', people); set('smsStatValid', valid); set('smsStatToday', sentToday);
    }
    function smsStatusBadge(s) {
      const map = { sent: 'green', partial: 'orange', sending: 'blue', scheduled: 'blue', pending: 'blue', cancelling: 'orange', cancelled: 'orange', error: 'red' };
      return map[s] || 'blue';
    }
    async function loadSmsHistory() {
      const { data } = await supa.from('sms_history').select('*').order('created_at', { ascending: false }).limit(50);
      _smsHistory = data || [];
      renderSmsHistory(); renderSmsStats();
    }
    function renderSmsHistory() {
      const body = el('smsHistoryBody');
      if (!body) return;
      if (!_smsHistory.length) { body.innerHTML = `<tr><td colspan="8" class="sms-empty">${escape(t('sms.no_history'))}</td></tr>`; return; }
      body.innerHTML = _smsHistory.map(h => `
        <tr>
          <td>${escape(fmtDateTime(h.created_at))}</td>
          <td>${h.recipient_count || 0}</td>
          <td class="sms-msg-cell">${escape((h.message || '').slice(0, 60))}${(h.message || '').length > 60 ? '…' : ''}</td>
          <td>${h.sent_count || 0}</td>
          <td>${h.delivered_count || 0}</td>
          <td>${h.failed_count || 0}</td>
          <td><span class="badge ${smsStatusBadge(h.status)}">${escape(t('sms.status_' + h.status) || h.status)}</span></td>
          <td class="sms-actions-cell">
            <button class="btn ghost small" data-sms-detail="${h.id}">${escape(t('sms.details'))}</button>
            <button class="btn ghost small" data-sms-resend="${h.id}">${escape(t('sms.resend'))}</button>
          </td>
        </tr>`).join('');
    }
    async function loadSmsAutomations() {
      try {
        const { data } = await supa.from('ui_settings').select('key,value')
          .in('key', ['sms_welcome_enabled', 'sms_welcome_template', 'sms_reminder_enabled', 'sms_reminder_template', 'sms_approved_enabled', 'sms_approved_template']);
        const m = {}; (data || []).forEach(r => { m[r.key] = r.value; });
        if (el('smsWelcomeEnabled')) el('smsWelcomeEnabled').checked = m.sms_welcome_enabled === '1';
        if (el('smsReminderEnabled')) el('smsReminderEnabled').checked = m.sms_reminder_enabled === '1';
        if (el('smsApprovedEnabled')) el('smsApprovedEnabled').checked = m.sms_approved_enabled === '1';
        if (el('smsWelcomeTemplate') && document.activeElement !== el('smsWelcomeTemplate')) el('smsWelcomeTemplate').value = m.sms_welcome_template || '';
        if (el('smsReminderTemplate') && document.activeElement !== el('smsReminderTemplate')) el('smsReminderTemplate').value = m.sms_reminder_template || '';
        if (el('smsApprovedTemplate') && document.activeElement !== el('smsApprovedTemplate')) el('smsApprovedTemplate').value = m.sms_approved_template || '';
      } catch (_) {}
    }
    el('smsAutomSaveBtn')?.addEventListener('click', async () => {
      const msg = el('smsAutomMsg');
      const rows = [
        { key: 'sms_welcome_enabled', value: el('smsWelcomeEnabled')?.checked ? '1' : '' },
        { key: 'sms_welcome_template', value: (el('smsWelcomeTemplate')?.value || '').trim() },
        { key: 'sms_reminder_enabled', value: el('smsReminderEnabled')?.checked ? '1' : '' },
        { key: 'sms_reminder_template', value: (el('smsReminderTemplate')?.value || '').trim() },
        { key: 'sms_approved_enabled', value: el('smsApprovedEnabled')?.checked ? '1' : '' },
        { key: 'sms_approved_template', value: (el('smsApprovedTemplate')?.value || '').trim() },
      ].map(r => ({ ...r, updated_at: new Date().toISOString() }));
      const { error } = await supa.from('ui_settings').upsert(rows, { onConflict: 'key' });
      if (msg) { msg.className = 'modal-msg show'; msg.style.color = error ? 'var(--red)' : 'var(--green)'; msg.textContent = error ? (t('common.error') + ': ' + error.message) : t('sms.autom_saved'); }
    });

    function renderSmsCenter() {
      renderSmsFilters(); updateSmsCount(); updateSmsMeta();
      loadSmsHistory(); loadSmsAutomations();
      // Show a hint if the provider isn't configured yet (best-effort probe).
      const note = el('smsProviderNote');
      if (note && !note.dataset.checked) {
        note.dataset.checked = '1';
      }
    }

    // Live progress: poll the history row while the campaign is sending.
    function startSmsProgress(historyId, total) {
      const wrap = el('smsProgressWrap'); if (wrap) wrap.style.display = 'block';
      clearInterval(_smsPoll);
      const tick = async () => {
        const { data: h } = await supa.from('sms_history').select('sent_count,failed_count,status').eq('id', historyId).maybeSingle();
        if (!h) return;
        const done = (h.sent_count || 0) + (h.failed_count || 0);
        const pct = total ? Math.round(done * 100 / total) : 0;
        const fill = el('smsProgressFill'); if (fill) fill.style.width = pct + '%';
        const txt = el('smsProgressText'); if (txt) txt.textContent = pct + '% (' + done + '/' + total + ')';
        if (['sent', 'cancelled', 'error'].includes(h.status)) { clearInterval(_smsPoll); _smsPoll = null; }
      };
      _smsPoll = setInterval(tick, 1000); tick();
    }

    async function sendSmsCampaign() {
      if (_smsSending) return;
      const message = (el('smsMessage')?.value || '').trim();
      const msgEl = el('smsSendMsg');
      const setMsg = (txt, ok) => { if (msgEl) { msgEl.className = 'modal-msg show'; msgEl.style.color = ok ? 'var(--green)' : 'var(--red)'; msgEl.textContent = txt; } };
      if (!message) { setMsg(t('sms.err_empty'), false); return; }
      const recips = smsRecipients();
      if (!recips.length) { setMsg(t('sms.err_no_recipients'), false); return; }
      const when = document.querySelector('input[name="smsWhen"]:checked')?.value || 'now';
      const filters = { audiences: smsSelectedAud(), brand: el('smsFilterBrand')?.value || '', category: el('smsFilterCategory')?.value || '', city: el('smsFilterCity')?.value || '' };

      // Scheduled: store a row, a server job would pick it up at scheduled_at.
      if (when === 'scheduled') {
        const d = el('smsDate')?.value, tm = el('smsTime')?.value;
        if (!d || !tm) { setMsg(t('sms.err_schedule'), false); return; }
        const at = new Date(d + 'T' + tm).toISOString();
        const { error } = await supa.from('sms_history').insert({ message, recipient_count: recips.length, status: 'scheduled', scheduled_at: at, filters, created_by: currentUserName() });
        if (error) { setMsg(t('common.error') + ': ' + error.message, false); return; }
        setMsg(t('sms.scheduled_ok', { n: recips.length }), true);
        loadSmsHistory();
        return;
      }

      // Say who can actually receive this before it is sent, not after.
      //
      // The last campaign reported 52 recipients and status "sent" while 51 of
      // them failed with no_provider: they had no Telegram chat, and no SMS
      // provider has ever been configured here. A phone number in the list is
      // not a channel.
      const health = await ensureHealth();
      const smsWorks = !!(health && health.sms && health.sms.configured);
      const reach = recips.filter(r => r._chat || smsWorks).length;
      const unreachable = recips.length - reach;
      if (!reach) { setMsg(t('sms.err_nobody_reachable', { n: recips.length }), false); return; }
      const ask = unreachable
        ? t('sms.confirm_send_partial', { reach, left: unreachable })
        : t('sms.confirm_send', { n: recips.length });
      if (!await uiConfirm(ask)) return;
      _smsSending = true;
      const btn = el('smsSendBtn'); if (btn) btn.disabled = true;
      setMsg(t('sms.sending'), true);
      // Create the campaign row, then hand the recipient list to the edge function.
      const { data: hist, error } = await supa.from('sms_history')
        .insert({ message, recipient_count: recips.length, status: 'sending', filters, created_by: currentUserName() })
        .select().single();
      if (error) { setMsg(t('common.error') + ': ' + error.message, false); _smsSending = false; if (btn) btn.disabled = false; return; }
      el('smsProgressWrap').dataset.historyId = hist.id;
      startSmsProgress(hist.id, recips.length);
      try {
        const { data, error: fnErr } = await supa.functions.invoke('send-sms', { body: { history_id: hist.id, message, recipients: recips } });
        if (fnErr) {
          let b = null; try { b = await fnErr.context.json(); } catch (_) {}
          throw new Error(b?.note || b?.error || fnErr.message);
        }
        if (data?.error) throw new Error(data.note || data.error);
        const sent = data?.sent ?? 0, failed = data?.failed ?? 0;
        // Green only when everything landed. Anything else is reported as what
        // it is, with the way out of it.
        setMsg(failed
          ? t('sms.done_partial', { sent, failed })
          : t('sms.done', { sent, failed }), !failed);
      } catch (e) {
        setMsg(t('common.error') + ': ' + (e.message || e), false);
      } finally {
        _smsSending = false; if (btn) btn.disabled = false;
        clearInterval(_smsPoll); _smsPoll = null;
        loadSmsHistory();
      }
    }

    // Send a single SMS to one participant, straight from the car detail.
    async function sendSingleSms(carId) {
      const c = (state.cars || []).find(x => String(x.id) === String(carId));
      if (!c) return;
      const phone = normalizePhone(c.phone || c.contact);
      if (!phone) { showToast(t('sms.no_phone'), 'error'); return; }
      const msg = await uiPrompt(t('sms.single_prompt', { name: c.owner || c.plate || '' }), { placeholder: t('sms.msg_ph'), okLabel: t('sms.send') });
      if (msg == null || msg === false || !String(msg).trim()) return;
      const parts = (c.owner || '').trim().split(/\s+/);
      const vars = { prenume: parts.shift() || '', nume: parts.join(' '), marca: c.brand || '', model: c.model || '', numar: c.plate || '', categoria: c.category || '', qr_code: ticketUrl(c) };
      const { data: hist } = await supa.from('sms_history')
        .insert({ message: String(msg), recipient_count: 1, status: 'sending', filters: { single: c.id }, created_by: currentUserName() })
        .select().single();
      try {
        const { data, error } = await supa.functions.invoke('send-sms', { body: { history_id: hist?.id, message: String(msg), recipients: [{ phone: c.phone || c.contact, car_id: c.id, vars }] } });
        if (error) { let b = null; try { b = await error.context.json(); } catch (_) {} throw new Error(b?.note || b?.error || error.message); }
        if (data?.error) throw new Error(data.note || data.error);
        showToast(t('sms.single_sent'));
      } catch (e) {
        showToast(t('common.error') + ': ' + (e.message || e), 'error');
      }
    }

    // Wiring
    el('smsAudience')?.addEventListener('change', updateSmsCount);
    ['smsFilterBrand', 'smsFilterCategory', 'smsFilterCity'].forEach(id => el(id)?.addEventListener('change', updateSmsCount));
    el('smsMessage')?.addEventListener('input', updateSmsMeta);
    el('smsVars')?.addEventListener('click', (e) => {
      const b = e.target.closest('[data-sms-var]'); if (!b) return;
      const ta = el('smsMessage'); if (!ta) return;
      const token = '{{' + b.dataset.smsVar + '}}';
      const s = ta.selectionStart ?? ta.value.length, en = ta.selectionEnd ?? ta.value.length;
      ta.value = ta.value.slice(0, s) + token + ta.value.slice(en);
      ta.focus(); ta.selectionStart = ta.selectionEnd = s + token.length;
      updateSmsMeta();
    });
    el('smsPreviewBtn')?.addEventListener('click', () => {
      const box = el('smsPreviewBox'); if (!box) return;
      const sample = smsRecipients()[0]?.vars || { prenume: 'Andrei', nume: 'Popescu', marca: 'BMW', model: 'M3', numar: 'CE 007', categoria: 'Participant', qr_code: 'KULTURA:1:CE 007' };
      box.style.display = 'block';
      box.textContent = smsSubstitute(el('smsMessage')?.value || '', sample) || t('sms.preview_empty');
    });
    document.querySelectorAll('input[name="smsWhen"]').forEach(r => r.addEventListener('change', () => {
      const f = el('smsSchedFields'); if (f) f.style.display = (document.querySelector('input[name="smsWhen"]:checked')?.value === 'scheduled') ? 'grid' : 'none';
    }));
    el('smsSendBtn')?.addEventListener('click', sendSmsCampaign);
    el('smsCancelBtn')?.addEventListener('click', async () => {
      const id = el('smsProgressWrap')?.dataset.historyId;
      if (id) await supa.from('sms_history').update({ status: 'cancelling' }).eq('id', id);
    });
    el('smsHistoryBody')?.addEventListener('click', (e) => {
      const d = e.target.closest('[data-sms-detail]');
      if (d) {
        const h = _smsHistory.find(x => String(x.id) === d.dataset.smsDetail);
        if (h) {
          const rep = h.delivery_report && h.delivery_report.errors ? h.delivery_report.errors.length : 0;
          uiAlert(`${t('sms.h_sent')}: ${h.sent_count || 0}\n${t('sms.h_delivered')}: ${h.delivered_count || 0}\n${t('sms.h_failed')}: ${h.failed_count || 0}\n\n${escape(h.message || '')}`);
        }
        return;
      }
      const r = e.target.closest('[data-sms-resend]');
      if (r) {
        const h = _smsHistory.find(x => String(x.id) === r.dataset.smsResend);
        if (h) { const ta = el('smsMessage'); if (ta) { ta.value = h.message || ''; updateSmsMeta(); } showToast(t('sms.loaded_for_resend')); window.scrollTo({ top: 0, behavior: 'smooth' }); }
      }
    });

    // ----- TASK ACTIONS CORE -----
    async function apiTaskTake(taskId) {
      if (!currentUser) { uiAlert('Trebuie să fii autentificat.'); return false; }

      const { data: currentTask, error: fetchError } = await supa.from('tasks').select('status, assigned_user_id').eq('id', taskId).single();
      if (fetchError) { uiAlert('Eroare la verificarea statusului: ' + fetchError.message); return false; }

      if (currentTask && taskStatusKey(currentTask.status) !== 'available') {
        uiAlert('Acest task a fost deja preluat de alt utilizator.');
        await loadData();
        return false;
      }

      // Atomic guard: only claim the task if it's still unassigned, so two
      // users clicking simultaneously can't both take it. The row count tells
      // us whether WE won the race.
      const { data: claimed, error } = await supa.from('tasks').update({
        status: 'in_progress',
        status_color: '#F59E0B',
        assigned_user_id: currentUser.id,
        assigned_user_name: currentUserName(),
        started_at: new Date().toISOString()
      }).eq('id', taskId).is('assigned_user_id', null).select('id');

      if (error) { uiAlert('Eroare: ' + error.message); return false; }
      if (!claimed || claimed.length === 0) {
        uiAlert('Acest task a fost deja preluat de alt utilizator.');
        await loadData();
        return false;
      }
      showToast('Ai preluat taskul.');
      return true;
    }

    async function apiTaskComplete(taskId) {
      if (!currentUser) {
        uiAlert(t('common.error') + ': ' + 'Nu ești autentificat. Reautentifică-te.');
        return false;
      }
      const payload = {
        status: 'completed',
        status_color: '#10B981',
        is_completed: true,
        completed_at: new Date().toISOString(),
        completed_by_user_id: currentUser.id,
        completed_by_user_name: currentUserName()
      };
      const { error } = await supa.from('tasks').update(payload).eq('id', taskId);
      if (error) {
        // If the DB rejects because of unknown columns (older schema), retry
        // with just the status flip so the button still works.
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('column') || msg.includes('does not exist')) {
          const retry = await supa.from('tasks').update({
            status: 'completed', status_color: '#10B981', is_completed: true
          }).eq('id', taskId);
          if (retry.error) { uiAlert(t('common.error') + ': ' + retry.error.message); return false; }
        } else {
          uiAlert(t('common.error') + ': ' + error.message);
          return false;
        }
      }
      haptic(40);
      try { successCheck(); confettiBurst(); } catch (_) {}
      showToast(t('task.detail.toast_finished'));
      return true;
    }

    async function apiTaskReopen(taskId) {
      const { error } = await supa.from('tasks').update({
        is_completed: false,
        completed_by_user_id: null,
        completed_by_user_name: null,
        completed_at: null,
        assigned_user_id: null,
        assigned_user_name: null,
        started_at: null,
        status: 'available',
        status_color: '#3B82F6'
      }).eq('id', taskId);

      if (error) { uiAlert('Eroare: ' + error.message); return false; }
      showToast('Task redeschis.');
      return true;
    }

    async function apiTaskDelete(taskId, label) {
      if (!await uiConfirm(`Șterge "${label || 'taskul'}"?`, { okLabel: t('common.delete') })) return false;
      // Snapshot the full row before deleting so it can be restored via Undo.
      const snapshot = (state.tasks || []).find(x => String(x.id) === String(taskId)) || null;
      const { error } = await supa.from('tasks').delete().eq('id', taskId);
      if (error) { uiAlert('Eroare: ' + error.message); return false; }
      if (snapshot) showUndoToast(t('undo.task_deleted'), () => restoreRow('tasks', snapshot));
      else showToast('Task șters.');
      return true;
    }

    // ---- Undo / trash: restore a full row (keeps its original id) ----
    async function restoreRow(table, row) {
      if (!row) return;
      const { error } = await supa.from(table).insert(row);
      if (error) { uiAlert(t('common.error') + ': ' + error.message); return; }
      showToast(t('undo.restored'));
      await loadData();
    }

    // Deleting a car moves it to the trash instead of destroying it. The rows
    // stay for 30 days (a nightly job clears older ones), which is what makes
    // "I imported the wrong sheet" a mistake you undo rather than one you
    // repair from a backup. It also keeps the entry number reserved, so a car
    // that comes back keeps the number printed on its pass.
    async function trashCars(ids) {
      const list = [].concat(ids).filter(Boolean).map(String);
      if (!list.length) return { error: null, n: 0 };
      const { error } = await supa.from('cars')
        .update({ deleted_at: new Date().toISOString(), deleted_by: currentUserEmail() || null })
        .in('id', list);
      if (!error) state.cars = (state.cars || []).filter(c => !list.includes(String(c.id)));
      return { error, n: list.length };
    }

    // Bringing one back. The database decides the number: it returns the old
    // one, or the next free one if somebody claimed it while the car was gone.
    async function untrashCar(id) {
      if (!requireOnline(t('offline.what_restore'))) return { error: new Error(t('offline.bar')) };
      const { data, error } = await supa.rpc('restore_car', { p_id: Number(id) });
      if (error) return { error };
      const row = Array.isArray(data) ? data[0] : data;
      return { error: null, renumbered: !!row?.renumbered, entry_no: row?.entry_no ?? null };
    }

    // Offered right after a car is trashed: one tap takes it back, before the
    // toast fades. After that it is still in Settings → Trash for 30 days.
    function offerUndoRestore(id, label) {
      showUndoToast(label ? `${t('undo.car_deleted')} — ${label}` : t('undo.car_deleted'), async () => {
        const res = await untrashCar(id);
        if (res.error) { uiAlert(t('common.error') + ': ' + res.error.message); return; }
        showToast(res.renumbered ? t('trash.restored_renumbered', { n: res.entry_no }) : t('undo.restored'));
        await loadDataFull();
      });
    }

    // A toast with an "Undo" action. Auto-dismisses after ~7s.
    let _undoTimer = null;
    function showUndoToast(message, onUndo) {
      let box = el('undoToast');
      if (!box) {
        box = document.createElement('div');
        box.id = 'undoToast';
        box.className = 'undo-toast';
        document.body.appendChild(box);
      }
      box.innerHTML = `<span class="undo-msg"></span><button type="button" class="undo-btn"></button>`;
      box.querySelector('.undo-msg').textContent = message;
      const btn = box.querySelector('.undo-btn');
      btn.textContent = t('undo.action');
      const dismiss = () => { box.classList.remove('show'); };
      btn.onclick = async () => {
        clearTimeout(_undoTimer);
        dismiss();
        try { await onUndo(); } catch (_) {}
      };
      requestAnimationFrame(() => box.classList.add('show'));
      clearTimeout(_undoTimer);
      _undoTimer = setTimeout(dismiss, 7000);
    }

    // ----- DATA -----
    function statusToBadge(s) {
      if (!s) return 'blue';
      const k = s.toLowerCase();
      if (k.includes('confirmat') || k.includes('finalizat') || k.includes('aprobat') || k.includes('completed')) return 'green';
      if (k.includes('așteptare') || k.includes('planificat') || k.includes('curând') || k.includes('progres') || k.includes('available')) return 'blue';
      if (k.includes('urgent') || k.includes('respins')) return 'red';
      if (k.includes('in_progress')) return 'orange';
      return 'orange';
    }

    // ----- STATE for filters / search -----
    const state = {
      cars: [], tasks: [], events: [], profiles: [], notifications: [], team: [], announcements: [], agenda: [], registrations: [],
      authUsers: null,
      carsFilter: 'all', carsSearch: '',
      tasksFilter: 'all', tasksSearch: '', tasksDept: 'all', tasksAssignee: 'all',
      tasksSort: localStorage.getItem('kultura_tasks_sort') || 'priority',
      tasksView: localStorage.getItem('kultura_tasks_view') || 'list',
      tasksPreset: localStorage.getItem('kultura_tasks_preset') || 'all',
      eventsFilter: 'all', eventsSearch: '',
      teamSearch: '', judgeSearch: '',
      // Which event the app is scoped to. '' = all events. Resolved properly
      // once events have loaded — see resolveActiveEvent().
      activeEventId: ''
    };

    // ----- ACTIVE EVENT FILTER -----
    // Everything the app shows is scoped to one event: the lists, the stats,
    // the gate, the map. New records are stamped with it on creation, so an
    // operator never has to think about it.
    //
    // The default is whichever event is marked „Activ”. Mark it „Finalizat”
    // and its data leaves the default view — which is the point — but it is
    // never unreachable: pick that event in the header, or „Toate
    // evenimentele”, and it is all still there. Nothing is ever hidden
    // permanently and nothing is deleted.
    const EVENT_PICK_KEY = 'kultura_active_event';

    // What the app scopes to when the operator hasn't picked anything, in
    // order of preference:
    //   1. the event marked „Activ”                      — the one being run
    //   2. the newest event that isn't finished/archived  — the one being prepared
    //   3. everything                                     — nothing else to show
    //
    // Step 2 is what makes „mark it Finalizat and its data goes away” true:
    // focus moves to the next event, which starts empty. Nothing is lost —
    // the finished event is still in the picker with all its data.
    function defaultEventId() {
      const live = (state.events || []).filter(e => !e.archived);
      const byNewest = (a, b) => Number(b.id) - Number(a.id);
      const active = live.filter(e => eventStatusKey(e.status) === 'activ').sort(byNewest);
      if (active.length) return String(active[0].id);
      const upcoming = live.filter(e => eventStatusKey(e.status) !== 'finalizat').sort(byNewest);
      if (upcoming.length) return String(upcoming[0].id);
      return '';
    }

    // Decide what to scope to, in order: an explicit pick the operator made
    // that still exists → the „Activ” event → everything.
    // An explicit pick of "all" ('') is honoured and must not be overridden.
    function resolveActiveEvent() {
      let stored = null;
      try { stored = localStorage.getItem(EVENT_PICK_KEY); } catch (_) {}
      if (stored !== null) {
        if (stored === '') { state.activeEventId = ''; return; }
        if ((state.events || []).some(e => String(e.id) === stored)) { state.activeEventId = stored; return; }
        // The picked event was deleted — fall through to the default.
        try { localStorage.removeItem(EVENT_PICK_KEY); } catch (_) {}
      }
      state.activeEventId = defaultEventId();
    }

    // The event to stamp on anything created right now, as a number for the DB.
    // null when scoped to "all events" — better an unassigned row (which stays
    // visible everywhere) than one silently attached to the wrong event.
    function activeEventIdOrNull() {
      return state.activeEventId ? Number(state.activeEventId) : null;
    }

    function setActiveEvent(id) {
      state.activeEventId = id || '';
      try { localStorage.setItem(EVENT_PICK_KEY, state.activeEventId); } catch (_) {}
      applyActiveEvent();
    }

    // True when a row belongs to the event in focus. '' (all events) matches
    // everything. Rows with no event_id stay visible under any event: they
    // predate this scoping, and silently swallowing them would look exactly
    // like data loss.
    function matchesActiveEvent(row) {
      if (!state.activeEventId) return true;
      const id = row && row.event_id;
      if (id === null || id === undefined || id === '') return true;
      return String(id) === String(state.activeEventId);
    }
    function activeCars()  { return (state.cars  || []).filter(matchesActiveEvent); }
    function activeTasks() { return (state.tasks || []).filter(matchesActiveEvent); }

    function populateEventPicker() {
      const sel = el('activeEventSelect');
      const before = state.activeEventId;
      resolveActiveEvent();
      // Marking an event finished (or deleting the one in focus) moves the
      // scope on its own — repaint so the lists follow instead of showing the
      // previous event's data until the next interaction.
      if (state.activeEventId !== before) {
        try { applyActiveEvent(); } catch (_) {}
      }
      try { populatePublicEventPicker(); } catch (_) {}
      if (!sel) return;
      // Rebuild options (keep the "all" placeholder = first option).
      while (sel.options.length > 1) sel.remove(1);
      // Archived events stay selectable — that is how you look back at one —
      // but they sort last so the current work is at the top.
      const evs = [...(state.events || [])].sort((a, b) =>
        (a.archived ? 1 : 0) - (b.archived ? 1 : 0) || Number(b.id) - Number(a.id));
      evs.forEach(ev => {
        const opt = document.createElement('option');
        opt.value = String(ev.id);
        // Spell out the state in the option so it is obvious why a finished
        // event shows less than you expected.
        const st = eventStatusKey(ev.status);
        const tag = ev.archived ? t('event.archived')
          : (st && st !== 'activ' ? translateStatus(ev.status, 'event') : '');
        opt.textContent = (ev.title || ('#' + ev.id)) + (tag ? ` · ${tag}` : '');
        sel.appendChild(opt);
      });
      sel.value = state.activeEventId;
    }

    function applyActiveEvent() {
      try { applyEventAccent(); } catch (_) {}
      try { renderStats(state.cars, state.tasks, state.events); } catch (_) {}
      try { renderHero(state.events); } catch (_) {}
      try { renderUpcoming(state.events); } catch (_) {}
      try { renderTopTasks(state.tasks); } catch (_) {}
      try { renderCarsChips(); } catch (_) {}
      try { renderCars(); } catch (_) {}
      try { renderTasksChips(); } catch (_) {}
      try { renderTasks(); } catch (_) {}
      try { renderMyTasks(); } catch (_) {}
      try { renderZones(); } catch (_) {}
      // The plan belongs to the event, so moving between events moves the map.
      try { loadActivePlan(); } catch (_) {}
      try { renderTeam(); } catch (_) {}
      try { renderAgenda(); } catch (_) {}
      try { renderRegQueue(); } catch (_) {}
    }

    // Live badge flash on successful fetch
    let flashTimer = null;
    function flashLive() {
      const b = el('liveBadge');
      if (!b) return;
      b.classList.add('flash');
      clearTimeout(flashTimer);
      flashTimer = setTimeout(() => b.classList.remove('flash'), 700);
    }

    // Admin flag now lives in profiles.is_admin (backfilled via migration).
    // Reads from state.profiles — returns false until profiles are loaded,
    // which is the safe default (non-admin UI). Never trusts a hardcoded email.
    // ----- ROLES: member < staff < admin -----
    const ROLE_RANK = { gate: 0, member: 0, staff: 1, admin: 2 };
    function currentProfile() {
      if (!currentUser || !currentUser.email) return null;
      const email = currentUser.email.toLowerCase();
      return (state.profiles || []).find(x => (x.email || '').toLowerCase() === email) || null;
    }
    function currentRole() {
      const p = currentProfile();
      if (!p) return 'member';
      if (p.role && ROLE_RANK[p.role] != null) return p.role;
      return p.is_admin ? 'admin' : 'member';
    }
    // True if the current user's role is at least `level`.
    function roleAtLeast(level) {
      return (ROLE_RANK[currentRole()] ?? 0) >= (ROLE_RANK[level] ?? 0);
    }
    function isAdmin() { return currentRole() === 'admin'; }

    // Show/hide UI by role. DB policies enforce the destructive ones
    // server-side; this keeps the buttons honest for everyone else.
    function applyAdminUI() {
      const admin = isAdmin();
      const staff = roleAtLeast('staff');
      const dz = el('dangerZoneBlock');
      if (dz) dz.style.display = admin ? 'block' : 'none';
      const deptBlock = el('deptSettingsBlock');
      if (deptBlock) deptBlock.style.display = admin ? 'block' : 'none';
      const sheetBlock = el('sheetSyncBlock');
      if (sheetBlock) sheetBlock.style.display = admin ? 'block' : 'none';
      const regBlock = el('regBlock');
      if (regBlock) regBlock.style.display = admin ? 'block' : 'none';
      const blockBlk = el('blocklistBlock');
      if (blockBlk) blockBlk.style.display = staff ? 'block' : 'none';
      const judgeB = el('judgeBtn');
      if (judgeB) judgeB.style.display = staff ? 'inline-flex' : 'none';
      const backupBlk = el('backupBlock');
      if (backupBlk) { backupBlk.style.display = admin ? 'block' : 'none'; if (admin) { try { renderBackupList(); } catch (_) {} } }
      const gdprBlk = el('gdprBlock');
      if (gdprBlk) gdprBlk.style.display = admin ? 'block' : 'none';
      const trashBlk = el('trashBlock');
      if (trashBlk) {
        trashBlk.style.display = admin ? 'block' : 'none';
        if (admin) { try { renderTrash(); renderImports(); } catch (_) {} }
      }
      const tgBlk = el('telegramBlock');
      if (tgBlk) {
        tgBlk.style.display = admin ? 'block' : 'none';
        if (admin) { try { loadTelegramSettings(); renderTgFunnel(); loadChannelHealth().then(renderReadyList); } catch (_) {} }
      }
      const wipeRow = el('sandboxWipeRow');
      if (wipeRow) wipeRow.style.display = (admin && activeEventIsSandbox()) ? 'flex' : 'none';
      const actBlk = el('activityBlock');
      if (actBlk) { actBlk.style.display = admin ? 'block' : 'none'; if (admin) { try { renderActivityLog(); } catch (_) {} } }
      const votingBlk = el('votingBlock');
      if (votingBlk) { votingBlk.style.display = admin ? 'block' : 'none'; if (admin) { try { renderVotingAdmin(); } catch (_) {} } }
      const fbBlk = el('feedbackBlock');
      if (fbBlk) { fbBlk.style.display = staff ? 'block' : 'none'; if (staff) { try { renderFeedback(); } catch (_) {} } }
      const errBlk = el('errorsBlock');
      if (errBlk) {
        errBlk.style.display = staff ? 'block' : 'none';
        if (staff) { try { renderErrorLog(); } catch (_) {} try { renderRateLimitStats(); } catch (_) {} }
      }
      // SMS Center is admin-only (both desktop and mobile nav entries).
      document.querySelectorAll('.admin-only-tab').forEach(b => { b.style.display = admin ? '' : 'none'; });
      const annBlock = el('announceBlock');
      if (annBlock) annBlock.style.display = staff ? 'block' : 'none';
      const arrBtn = el('zoneArrangeBtn');
      if (arrBtn) arrBtn.style.display = staff ? '' : 'none';
      const gateBtn = el('gateOpenBtn');
      if (gateBtn) gateBtn.style.display = staff ? '' : 'none';
      // Add / import buttons (cars/events/tasks) are for staff and admins only.
      document.querySelectorAll('.add-btn[data-modal], #aiImportBtn').forEach(b => {
        b.style.display = staff ? '' : 'none';
      });
      try { renderRegQueue(); } catch (_) {}
      try { applyGateLock(); } catch (_) {}
    }

    // ------------ INVISIBLE POLLING PIPELINE ------------
    // Goal: refresh data every 1s in the background WITHOUT touching the DOM
    // when nothing changed. When something DID change, re-render only the
    // affected slice(s) and preserve scroll + input focus across the re-render.
    // No spinners, no flicker, no dropped inputs, no dropped modals.

    // Fingerprint helper — stable, cheap digest over the fields that actually
    // affect what the user sees. If two fetches yield the same fingerprint,
    // the corresponding renderer is skipped entirely.
    // Lean column sets for the list/poll fetches — heavy free-text/array columns
    // (notes, modifications, photos, checklist, detailed_description, …) are only
    // needed in the detail view, which hydrates them on demand. `updated_at` is
    // included so any edit still bumps the fingerprint.
    const CAR_LIST_COLS  = 'id,entry_no,model,owner,plate,zone,status,status_color,is_vip,event_id,created_at,contact,brand,year,color,phone,telegram,city,category,updated_at,arrived_at,checked_in_by,spot_no,deleted_at,deleted_by,rsvp,rsvp_at,telegram_chat_id,import_batch';
    const TASK_LIST_COLS = 'id,title,event,date,status,status_color,is_completed,event_id,due_at,created_at,assigned_user_id,assigned_user_name,started_at,completed_at,completed_by_user_id,completed_by_user_name,priority,category,due_date,created_by,assigned_to,assigned_at,completed_by,team,updated_at,reminder_sent';

    // Canonical parking zones (car categories). Single source of truth for the
    // zone dropdowns in the add-car form, the car detail editor and the gate.
    const PARKING_ZONES = ['Stance', 'Super Cars', 'Modern', 'Autosport', 'JDM', 'Retro', 'Euro', 'America', 'Bike'];

    // Which zones a car can actually be put in.
    //
    // The nine above are the app's own classes. The venue's drawing carries its
    // own names as well — EXPO ZONE, GREEN ZONE, VIP ZONE — and cars really do
    // stand in them: 8 of the 54 at the last event. Built from the constant
    // alone, every picker in the app was unable to say where those 8 cars were,
    // and a bay could not even be drawn in such a zone. So the plan in use is
    // the other half of the answer. Order matters: the app's own classes first,
    // in their own order, then whatever the drawing adds.
    function allZones() {
      const out = [], seen = new Set();
      const add = (z) => {
        const s = String(z || '').trim();
        if (!s) return;
        const k = s.toLowerCase();
        if (seen.has(k)) return;
        seen.add(k);
        out.push(s);
      };
      PARKING_ZONES.forEach(add);
      (ZONE_SPOTS || []).forEach(sp => add(sp && sp.zone));
      return out;
    }
    // Build <option> markup for a zone <select>. Keeps an existing custom value
    // (an older free-text zone not in the list) selectable so nothing is lost.
    function zoneOptionsHTML(current) {
      const cur = (current || '').trim();
      const zones = allZones();
      const inList = zones.some(z => z.toLowerCase() === cur.toLowerCase());
      let html = `<option value="">${escape(t('car.zone_choose'))}</option>`;
      html += zones.map(z =>
        `<option value="${escape(z)}"${cur.toLowerCase() === z.toLowerCase() ? ' selected' : ''}>${escape(z)}</option>`).join('');
      if (cur && !inList) html += `<option value="${escape(cur)}" selected>${escape(cur)}</option>`;
      return html;
    }

    const CAR_FP_FIELDS   = ['id','entry_no','status','status_color','zone','plate','phone','telegram','contact','owner','model','brand','is_vip','category','year','color','city','event_id','updated_at','spot_no','rsvp','telegram_chat_id'];
    const AGENDA_FP_FIELDS = ['id','event_id','title','at_time','notes','updated_at'];
    const REG_FP_FIELDS   = ['id','brand','model','plate','owner','phone','telegram','email','city','category','year','color','social_links','transport_info','modifications','photos','status','created_at'];
    const TASK_FP_FIELDS  = ['id','status','status_color','priority','category','team','title','assigned_user_id','assigned_user_name','assigned_to','completed_by_user_id','completed_by_user_name','completed_at','started_at','is_completed','date','due_date','due_at','event','event_id','created_by','created_at','updated_at'];
    const EVENT_FP_FIELDS = ['id','status','status_color','title','name','date','location','description','cover_url','starts_at','days_left','archived','plan_id'];
    const PROF_FP_FIELDS  = ['id','email','full_name','role','department','avatar_url','phone','created_at'];

    function makeFp(list, fields) {
      if (!Array.isArray(list) || list.length === 0) return '0';
      let out = String(list.length) + '|';
      for (const item of list) {
        for (const f of fields) {
          const v = item[f];
          out += (v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)) + ',';
        }
        out += '~';
      }
      return out;
    }

    // Track last-rendered fingerprint per slice
    const _fp = { cars: '', tasks: '', events: '', profiles: '', stats: '' };

    // Wrapper that preserves scroll position + input focus around a re-render.
    // Falls back gracefully if the focused element can't be found afterwards.
    function withPreservedUI(fn) {
      const scrollY = window.scrollY, scrollX = window.scrollX;
      const active = document.activeElement;
      const focusSnap = (active && active !== document.body) ? {
        tag: active.tagName,
        id: active.id || null,
        selStart: (active.selectionStart != null) ? active.selectionStart : null,
        selEnd: (active.selectionEnd != null) ? active.selectionEnd : null,
        val: active.value != null ? active.value : null,
        // Stable identifiers for buttons/inputs inside cards
        taskId: active.dataset ? (active.dataset.taskId || active.dataset.rowId) : null,
        carId:  active.dataset ? (active.dataset.carId  || active.dataset.rowId) : null,
        eventId:active.dataset ? (active.dataset.eventId|| active.dataset.rowId) : null,
        action: active.dataset ? (active.dataset.action || active.dataset.detailAction) : null,
        name: active.getAttribute ? active.getAttribute('name') : null
      } : null;

      fn();

      // Restore scroll (window scroll is preserved by innerHTML on children,
      // but restore explicitly for safety when many rows are re-rendered).
      if (window.scrollY !== scrollY || window.scrollX !== scrollX) {
        window.scrollTo({ left: scrollX, top: scrollY, behavior: 'instant' });
      }

      // Best-effort focus restore
      if (!focusSnap) return;
      let target = null;
      if (focusSnap.id) target = document.getElementById(focusSnap.id);
      if (!target && focusSnap.name) target = document.querySelector(`[name="${focusSnap.name}"]`);
      if (!target && (focusSnap.taskId || focusSnap.carId || focusSnap.eventId) && focusSnap.action) {
        const idSel = focusSnap.taskId  ? `[data-task-id="${focusSnap.taskId}"]`
                    : focusSnap.carId   ? `[data-car-id="${focusSnap.carId}"]`
                    :                     `[data-event-id="${focusSnap.eventId}"]`;
        target = document.querySelector(`${idSel}[data-action="${focusSnap.action}"], ${idSel}[data-detail-action="${focusSnap.action}"]`);
      }
      if (target && typeof target.focus === 'function') {
        try { target.focus({ preventScroll: true }); } catch (_) {}
        if (target.setSelectionRange && focusSnap.selStart != null) {
          try { target.setSelectionRange(focusSnap.selStart, focusSnap.selEnd); } catch (_) {}
        }
      }
    }

    // Silent error backoff — if consecutive fetches fail, skip a few cycles
    // instead of hammering. Never bubble errors into the UI as toasts.
    let _consecutiveErrors = 0;
    let _lastErrorAt = 0;

    // Coalesce bursts of refetch requests (e.g. Realtime firing once per changed
    // row during an import or a batch of gate check-ins) into a single load.
    let _loadDebounce = null;
    function scheduleLoadData(delay = 350) {
      if (_loadDebounce) clearTimeout(_loadDebounce);
      _loadDebounce = setTimeout(() => { _loadDebounce = null; loadData().catch(() => {}); }, delay);
    }

    // ----- INCREMENTAL SYNC (cars / tasks) -----
    // These two tables grow with every event and are re-fetched on every poll
    // (every 25s with realtime up, every 3s while it's down). Pulling every
    // column of every row that often is the one thing that does not scale —
    // on a gate tablet it is also the one thing burning mobile data.
    //
    // So after the first full fetch we only ask for rows touched since the last
    // sync (`updated_at > watermark`, stamped server-side by a BEFORE UPDATE
    // trigger) and merge them in by id. Idle polls come back empty.
    //
    // Deletions can't show up in a delta — a deleted row simply isn't returned.
    // Realtime handles them instantly when it's connected; as a safety net for
    // when it isn't, we periodically pull the bare id list (cheap: a few bytes
    // per row) and drop anything that has disappeared server-side.
    // `soft` marks a table where deleting only sets `deleted_at`. Such a row
    // must still arrive in the delta — that update *is* how the client learns
    // it was thrown away — and gets filtered out after the merge instead.
    const DELTA_TABLES = {
      cars:  { cols: CAR_LIST_COLS,  slice: 'cars',  soft: true  },
      tasks: { cols: TASK_LIST_COLS, slice: 'tasks', soft: false }
    };
    const isTrashed = (r) => !!(r && r.deleted_at);
    const RECONCILE_EVERY_MS = 60000;
    // `updated_at` is the transaction's start time, but a row only becomes
    // visible when that transaction commits. A slow write that started before
    // our last poll can therefore land *after* it, carrying a timestamp the
    // watermark has already passed — and would never be seen again. Asking for
    // a few seconds more than we strictly need closes that window; the overlap
    // costs a handful of rows we already have, and the merge is idempotent.
    const DELTA_OVERLAP_MS = 15000;
    let _delta = { cars: null, tasks: null };   // null = next fetch must be full
    let _lastReconcileAt = 0;

    // Force the next poll to re-fetch everything. Used whenever the local copy
    // may have drifted: reconnects, sign-in, manual refresh.
    function resetDeltaSync() {
      _delta = { cars: null, tasks: null };
      // The full fetch this forces is authoritative about which rows exist, so
      // the deletion sweep starts its clock from here rather than firing on the
      // very next poll.
      _lastReconcileAt = Date.now();
    }

    // What an explicit refresh gesture should do. Someone who pulls to refresh
    // is telling us they don't trust what's on screen — answer with the whole
    // truth, not a delta.
    function loadDataFull() {
      resetDeltaSync();
      return loadData();
    }

    // Build the query for one delta-synced table: full list on a cold start,
    // otherwise only what changed. Ordering only matters for the full fetch —
    // merged results are re-sorted client-side.
    function deltaQuery(table) {
      const { cols, soft } = DELTA_TABLES[table];
      const since = _delta[table];
      const q = supa.from(table).select(cols);
      // A cold fetch skips the trash outright — there is no reason to pull rows
      // the operator threw away. A delta must not skip them, or the row that
      // just moved to the trash would never reach the client.
      if (!since) return (soft ? q.is('deleted_at', null) : q).order('id', { ascending: false });
      return q.gt('updated_at', overlapFrom(since, DELTA_OVERLAP_MS));
    }

    // Advance the watermark to the newest `updated_at` we actually received.
    // Re-fetching a boundary row once is harmless because the merge is
    // idempotent. A cold fetch of an empty table leaves us with no timestamp
    // to anchor on; stay in full-fetch mode rather than invent one.
    function advanceWatermark(table, rows) {
      const max = maxWatermark(_delta[table], rows);
      if (max) _delta[table] = max;
    }

    // Drop rows deleted server-side while we were only asking for deltas.
    async function reconcileDeletions() {
      const out = {};
      await Promise.all(Object.keys(DELTA_TABLES).map(async (table) => {
        const base = supa.from(table).select('id');
        const { data, error } = await (DELTA_TABLES[table].soft ? base.is('deleted_at', null) : base);
        if (error || !Array.isArray(data)) return;      // leave the list alone
        const alive = new Set(data.map(r => String(r.id)));
        const slice = DELTA_TABLES[table].slice;
        const before = state[slice] || [];
        const after = before.filter(r => alive.has(String(r.id)));
        if (after.length !== before.length) out[slice] = after;
      }));
      return out;
    }

    let inFlightLoad = null;
    async function loadData() {
      if (inFlightLoad) return inFlightLoad; // dedupe concurrent calls
      inFlightLoad = (async () => {
        try {
          const wasFullCars  = !_delta.cars;
          const wasFullTasks = !_delta.tasks;
          // Fetch all data in parallel
          const results = await Promise.allSettled([
            deltaQuery('cars'),
            deltaQuery('tasks'),
            supa.from('events').select('*').order('id', { ascending: false }),
            supa.from('profiles').select('*'),
            supa.from('announcements').select('*').order('id', { ascending: false }).limit(20),
            supa.from('event_agenda').select('*').order('at_time', { ascending: true }),
            // 'waitlist' belongs here too: the queue renders a tab for it and the
            // detail modal can move a registration onto it. Fetching only the
            // other two meant a waitlisted entry vanished on the next load.
            supa.from('car_registrations').select('*').in('status', ['pending', 'hold', 'waitlist']).order('id', { ascending: false }),
            supa.from('plate_blocklist').select('plate, plate_norm, reason').order('id', { ascending: false })
          ]);

          // Only overwrite each slice if the fetch succeeded; otherwise keep
          // the previous data on screen (requirement: no wipe on transient error).
          // cars/tasks arrive either as a full list (cold start) or as a delta
          // to merge on top of what we already hold.
          const carRows      = results[0].status === 'fulfilled' && !results[0].value.error ? (results[0].value.data || []) : null;
          const taskRows     = results[1].status === 'fulfilled' && !results[1].value.error ? (results[1].value.data || []) : null;
          if (carRows  !== null) advanceWatermark('cars',  carRows);
          if (taskRows !== null) advanceWatermark('tasks', taskRows);
          // An empty delta means "nothing changed" — keep the current list as
          // is rather than replacing it with nothing.
          // The merge keeps whatever the delta carried, including a car whose
          // only change was landing in the trash — so strip those right after,
          // or a deleted car stays on screen until the next reconcile sweep.
          const nextCars  = carRows  === null ? null
            : (wasFullCars  ? carRows
              : (carRows.length ? mergeById(state.cars, carRows).filter(c => !isTrashed(c)) : null));
          const nextTasks = taskRows === null ? null
            : (wasFullTasks ? taskRows : (taskRows.length ? mergeById(state.tasks, taskRows) : null));
          const nextEvents   = results[2].status === 'fulfilled' && !results[2].value.error ? (results[2].value.data || []) : null;
          const nextProfiles = results[3].status === 'fulfilled' && !results[3].value.error ? (results[3].value.data || []) : null;
          const nextAnnounce = results[4] && results[4].status === 'fulfilled' && !results[4].value.error ? (results[4].value.data || []) : null;
          const nextAgenda   = results[5] && results[5].status === 'fulfilled' && !results[5].value.error ? (results[5].value.data || []) : null;
          const nextRegs     = results[6] && results[6].status === 'fulfilled' && !results[6].value.error ? (results[6].value.data || []) : null;
          const nextBlock    = results[7] && results[7].status === 'fulfilled' && !results[7].value.error ? (results[7].value.data || []) : null;

          if (nextCars     !== null) state.cars     = nextCars;
          if (nextTasks    !== null) state.tasks    = nextTasks;
          if (nextEvents   !== null) state.events   = nextEvents;
          if (nextProfiles !== null) state.profiles = nextProfiles;
          if (nextAnnounce !== null) { state.announcements = nextAnnounce; try { renderHomeAnnounce(); renderAnnounceRecent(); } catch (_) {} }
          if (nextAgenda   !== null) state.agenda   = nextAgenda;
          if (nextRegs     !== null) state.registrations = nextRegs;
          if (nextBlock    !== null) { state.blocklist = nextBlock; rebuildBlockSet(); try { renderBlocklist(); } catch (_) {} }

          // After every slice, not after `cars`: both of these read the active
          // event out of state.events and the role out of state.profiles. Run
          // earlier they answer from the previous load — on a cold start, from
          // nothing at all.
          try { renderReadyList(); } catch (_) {}
          try { renderTgFunnel(); } catch (_) {}
          try { renderMapSpots(); } catch (_) {}

          // Deltas can add and change rows but never reveal a deletion, so
          // sweep for vanished ids on a slow cadence. A full fetch is already
          // authoritative, so only bother once we're running on deltas.
          let carsPruned = false, tasksPruned = false;
          const onDeltas = !wasFullCars || !wasFullTasks;
          if (onDeltas && Date.now() - _lastReconcileAt > RECONCILE_EVERY_MS) {
            _lastReconcileAt = Date.now();
            try {
              const pruned = await reconcileDeletions();
              if (pruned.cars)  { state.cars  = pruned.cars;  carsPruned = true; }
              if (pruned.tasks) { state.tasks = pruned.tasks; tasksPruned = true; }
            } catch (_) { /* non-critical — next sweep retries */ }
          }

          // Persist the car list so the offline gate check-in can look cars up
          // with no connection (the PWA shell is cached; the data is not).
          if (nextCars !== null || carsPruned) cacheCarsOffline(state.cars);
          try { cacheAppData(); } catch (_) {}
          // Opportunistically drain any queued gate check-ins.
          flushOutbox();
          updateGateSyncUI();

          // Admins can fetch the full list of auth users via the edge function.
          // The edge function re-verifies is_admin server-side, so we can only
          // call it after profiles have loaded (isAdmin() reads from state.profiles).
          if (isAdmin()) {
            try {
              const { data, error } = await supa.functions.invoke('admin-list-users');
              if (!error && data && Array.isArray(data.users)) {
                state.authUsers = data.users;
              }
            } catch (_) {
              // silent — non-critical
            }
          }

          // Log errors ONCE per condition, not every second
          const anyErr = results.some((res, i) =>
            res.status === 'rejected' || (res.value && res.value.error)
          );
          if (anyErr) {
            _consecutiveErrors++;
            const now = Date.now();
            if (now - _lastErrorAt > 30000) {   // throttle console noise
              console.warn('Data load: some slices failed', results);
              _lastErrorAt = now;
            }
            // Surface a "reconnecting" banner only after repeated failures, so a
            // single blip doesn't flash it.
            if (_consecutiveErrors >= 2) try { setConnError(true); } catch (_) {}
          } else {
            _consecutiveErrors = 0;
            try { setConnError(false); } catch (_) {}
          }

          // Compute new fingerprints — this is the "diff" step. Only when the
          // fingerprint of a slice changes do we touch the DOM for that slice.
          const newFp = {
            cars:     makeFp(state.cars,     CAR_FP_FIELDS),
            tasks:    makeFp(state.tasks,    TASK_FP_FIELDS),
            events:   makeFp(state.events,   EVENT_FP_FIELDS),
            profiles: makeFp(state.profiles, PROF_FP_FIELDS),
            agenda:   makeFp(state.agenda,   AGENDA_FP_FIELDS),
            regs:     makeFp(state.registrations, REG_FP_FIELDS)
          };
          const carsChanged   = newFp.cars     !== _fp.cars;
          const tasksChanged  = newFp.tasks    !== _fp.tasks;
          const eventsChanged = newFp.events   !== _fp.events;
          const profsChanged  = newFp.profiles !== _fp.profiles;
          const agendaChanged = newFp.agenda   !== _fp.agenda;
          const regsChanged   = newFp.regs     !== _fp.regs;
          const anyChanged    = carsChanged || tasksChanged || eventsChanged || profsChanged || agendaChanged || regsChanged;

          // Persist new fingerprints upfront so we don't accidentally re-render
          // the same state twice if a renderer synchronously triggers another poll.
          _fp.cars     = newFp.cars;
          _fp.tasks    = newFp.tasks;
          _fp.events   = newFp.events;
          _fp.profiles = newFp.profiles;
          _fp.agenda   = newFp.agenda;
          _fp.regs     = newFp.regs;

          // Enforce the gate-only role lock on every load — profiles may already
          // match the cached fingerprint (profsChanged=false), so this can't live
          // only inside applyAdminUI/the profsChanged branch.
          try { applyGateLock(); } catch (_) {}

          // If NOTHING changed, exit immediately. No DOM touched at all → zero
          // flicker, zero focus loss, zero scroll reset. This is the hot path
          // for every idle second where the DB is unchanged.
          if (!anyChanged) return;

          // Wrap all conditional renders in a single focus/scroll snapshot so
          // even a data-driven update doesn't drop the user's caret or scroll.
          withPreservedUI(() => {
            // Stats reflect all three data types
            const statsFp = newFp.cars + '|' + newFp.tasks + '|' + newFp.events;
            if (statsFp !== _fp.stats) {
              _fp.stats = statsFp;
              try { renderStats(state.cars, state.tasks, state.events); } catch (_) {}
            }
            if (eventsChanged) {
              try { populateEventPicker(); } catch (_) {}
              try { applyEventAccent(); } catch (_) {}
              try { renderHero(state.events); } catch (_) {}
              try { renderUpcoming(state.events); } catch (_) {}
              try { renderEventsChips(); } catch (_) {}
              try { renderEvents(); } catch (_) {}
            }
            if (tasksChanged) {
              try { renderTopTasks(state.tasks); } catch (_) {}
              try { renderMyTasks(); } catch (_) {}
              try { renderTasksChips(); } catch (_) {}
              try { renderTasksDeptChips(); } catch (_) {}
              try { renderTasks(); } catch (_) {}
              try { renderTeam(); } catch (_) {}   // workload depends on tasks
            }
            if (carsChanged) {
              try { renderCarsChips(); } catch (_) {}
              try { renderCars(); } catch (_) {}
              try { renderZones(); } catch (_) {}   // zone panel depends on cars
              // Keep the gate's live free-spots strip / list fresh if it's open.
              if (el('gateOverlay')?.classList.contains('show')) {
                try { renderGateZones(); } catch (_) {}
                try { renderGate(); } catch (_) {}
              }
            }
            if (profsChanged) {
              try { renderTeam(); } catch (_) {}
              // Admin flag lives in profiles — refresh the admin-gated UI
              // (danger zone, event delete buttons) once we know who we are.
              try { applyAdminUI(); } catch (_) {}
              try { renderEvents(); } catch (_) {}
              try { updateAvatarUI(); } catch (_) {}
              try { populateTaskAssignees(); } catch (_) {}
            }
            if (agendaChanged || eventsChanged) {
              try { renderAgenda(); } catch (_) {}
            }
            if (regsChanged) {
              try { renderRegQueue(); } catch (_) {}
            }

            // Live-refresh OPEN detail modals only if the underlying data
            // actually changed AND the user isn't typing inside them.
            const isTyping = (root) => {
              const a = document.activeElement;
              return a && root?.contains(a) && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT');
            };
            if (carsChanged && openCarDetailId != null) {
              const modal = document.getElementById('modal-car-detail');
              if (modal && modal.classList.contains('show') && !isTyping(modal)) {
                try { showCarDetail(openCarDetailId); } catch (_) {}
              }
            }
            if (tasksChanged && openTaskDetailId != null) {
              const modal = document.getElementById('modal-task-detail');
              if (modal && modal.classList.contains('show') && !isTyping(modal)) {
                try { showTaskDetail(openTaskDetailId); } catch (_) {}
              }
            }
          });

          flashLive();
        } catch (err) {
          _consecutiveErrors++;
          _lastErrorAt = Date.now();
          if (_consecutiveErrors >= 2) try { setConnError(true); } catch (_) {}
          if (_consecutiveErrors <= 1) console.error('Critical data load error:', err);
        } finally {
          inFlightLoad = null;
        }
      })();
      return inFlightLoad;
    }

    // ----- POLLING -----
    // Realtime (the kultura-live channel below) is the primary refresh trigger.
    // Poll interval set to 1s for near-instant refresh even if realtime lags.
    // Recursive setTimeout so a slow fetch cannot pile up follow-up ticks;
    // ticks are skipped while the tab is hidden, a save runs, or the user types.
    let pollTimer = null;
    let _pollBooted = false;
    let _realtimeOk = false;
    function shouldSkipPoll() {
      if (document.hidden) return true; // tab in background → pause polling
      if (document.querySelector('.action-btn.loading')) return true; // save in progress
      if (inFlightLoad) return true;    // requirement #9 — never overlap
      // Only skip when the user is CURRENTLY typing inside an open modal.
      // Detail modals in read mode are diffed and only refreshed when data changed.
      const focused = document.activeElement;
      if (focused && (focused.tagName === 'INPUT' || focused.tagName === 'TEXTAREA' || focused.tagName === 'SELECT')) {
        const inModal = focused.closest('.modal-backdrop.show');
        if (inModal) return true;
      }
      return false;
    }
    function _scheduleNextPoll() {
      if (!_pollBooted) return; // stopped
      // Realtime is the primary refresh path, so poll is only a fallback:
      // 25s when the realtime socket is live, 3s while it's down. Back off on
      // repeated errors (2s → 4s → 8s … cap 2min) so a broken link doesn't hammer.
      const delay = _consecutiveErrors === 0
        ? (_realtimeOk ? 25000 : 3000)
        : Math.min(120000, 2000 * Math.pow(2, _consecutiveErrors - 1));
      pollTimer = setTimeout(async () => {
        if (!_pollBooted) return;
        if (!shouldSkipPoll()) {
          try { await loadData(); }
          catch (_) { /* swallowed — loadData handles its own logging */ }
        }
        _scheduleNextPoll();
      }, delay);
    }
    function startPolling() {
      if (_pollBooted) return;
      _pollBooted = true;
      _scheduleNextPoll();
    }
    function stopPolling() {
      _pollBooted = false;
      if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
    }
    // Cleanup on page unmount (requirement #10 — no memory leaks / dangling timers)
    window.addEventListener('beforeunload', stopPolling);
    window.addEventListener('pagehide', stopPolling);

    // Pause when hidden, resume immediately when the user returns.
    // Requirement #8: refetchIntervalInBackground=false + refetchOnWindowFocus=true.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) return; // already paused via shouldSkipPoll()
      if (el('appView') && el('appView').classList.contains('show') && !shouldSkipPoll()) {
        loadData().catch(() => {});
      }
    });
    window.addEventListener('focus', () => {
      if (!document.hidden && el('appView') && el('appView').classList.contains('show') && !shouldSkipPoll()) {
        loadData().catch(() => {});
      }
    });

    // ============================================================
    //  OFFLINE GATE QUEUE — check cars in at the gate with no signal.
    //  Cars are cached locally for lookup; check-in actions go into a
    //  persisted outbox and sync automatically when the network returns.
    // ============================================================
    const GATE_CACHE_KEY = 'kultura_cache_cars';
    const GATE_OUTBOX_KEY = 'kultura_outbox';

    function cacheCarsOffline(cars) {
      try {
        // Store a lean copy — enough for gate lookup + optimistic display.
        const lean = (cars || []).map(c => ({
          id: c.id, plate: c.plate, brand: c.brand, model: c.model,
          owner: c.owner, zone: c.zone, status: c.status, status_color: c.status_color,
          is_vip: c.is_vip, phone: c.phone, event_id: c.event_id
        }));
        localStorage.setItem(GATE_CACHE_KEY, JSON.stringify(lean));
      } catch (_) {}
    }
    function loadCachedCars() {
      try { return JSON.parse(localStorage.getItem(GATE_CACHE_KEY) || '[]'); }
      catch (_) { return []; }
    }

    // Full list cache (cars/tasks/events/profiles) so the app paints instantly
    // from the last session, then refreshes in the background. Separate from the
    // lean gate cache above (which stays minimal for offline check-in).
    const APP_CACHE_KEY = 'kultura_cache_v1';
    function cacheAppData() {
      try {
        localStorage.setItem(APP_CACHE_KEY, JSON.stringify({
          cars: state.cars || [], tasks: state.tasks || [], events: state.events || [],
          profiles: (state.profiles || []).map(p => ({
            email: p.email, full_name: p.full_name, avatar_url: p.avatar_url,
            role: p.role, department: p.department, is_admin: p.is_admin
          })),
          // The gate is both the place that most needs the blocklist and the
          // place most likely to have no signal. Without this the warning is
          // online-only, which is backwards.
          blocklist: state.blocklist || [],
          ts: Date.now()
        }));
      } catch (_) {}
    }
    function hydrateFromCache() {
      try {
        const c = JSON.parse(localStorage.getItem(APP_CACHE_KEY) || 'null');
        if (!c) return false;
        if (Array.isArray(c.cars)     && !(state.cars || []).length)     state.cars = c.cars;
        if (Array.isArray(c.tasks)    && !(state.tasks || []).length)    state.tasks = c.tasks;
        if (Array.isArray(c.events)   && !(state.events || []).length)   state.events = c.events;
        if (Array.isArray(c.profiles) && !(state.profiles || []).length) state.profiles = c.profiles;
        if (Array.isArray(c.blocklist) && !(state.blocklist || []).length) {
          state.blocklist = c.blocklist;
          rebuildBlockSet();
        }
        return !!((state.cars || []).length || (state.tasks || []).length || (state.events || []).length);
      } catch (_) { return false; }
    }
    function getOutbox() {
      try { return JSON.parse(localStorage.getItem(GATE_OUTBOX_KEY) || '[]'); }
      catch (_) { return []; }
    }
    function saveOutbox(box) {
      try { localStorage.setItem(GATE_OUTBOX_KEY, JSON.stringify(box)); } catch (_) {}
    }
    // Queue a car mutation. Multiple pending updates for the same car merge into
    // one, so a plate zone edit + arrival collapse to a single sync.
    function enqueueAction(action) {
      const box = getOutbox();
      // Coalesce repeated edits to the same row so a flaky connection doesn't
      // build up a queue of superseded patches.
      const sameRow = (a) =>
        (a.type === 'car-update' && action.type === 'car-update' && String(a.carId) === String(action.carId)) ||
        (a.type === 'row-update' && action.type === 'row-update' &&
         a.table === action.table && String(a.rowId) === String(action.rowId));
      const existing = box.find(sameRow);
      if (existing) {
        existing.patch = { ...existing.patch, ...action.patch };
        existing.ts = Date.now();
      } else {
        box.push({ id: 'a' + Date.now() + Math.random().toString(36).slice(2, 6), tries: 0, ts: Date.now(), ...action });
      }
      saveOutbox(box);
    }

    // Apply a patch to the in-memory + cached car so every surface reflects it
    // immediately, even with no network.
    function applyLocalCarPatch(carId, patch) {
      const car = (state.cars || []).find(c => String(c.id) === String(carId));
      if (car) Object.assign(car, patch);
      const cached = loadCachedCars();
      const cc = cached.find(c => String(c.id) === String(carId));
      if (cc) { Object.assign(cc, patch); try { localStorage.setItem(GATE_CACHE_KEY, JSON.stringify(cached)); } catch (_) {} }
      else cacheCarsOffline(state.cars);
      try { renderCars(); renderCarsChips(); renderZones(); renderStats(state.cars, state.tasks, state.events); } catch (_) {}
    }

    let _flushing = false;
    async function flushOutbox() {
      if (_flushing || !navigator.onLine) return;
      const box = getOutbox();
      if (!box.length) return;
      _flushing = true; updateGateSyncUI();
      let flushedAny = false;
      for (const action of box.slice()) {
        try {
          if (action.type === 'car-update') {
            const { error } = await supa.from('cars').update(action.patch).eq('id', action.carId);
            if (error) throw error;
          } else if (action.type === 'row-update') {
            // Generic queued write for tables other than `cars`, so field
            // actions survive a dead connection too.
            const { error } = await supa.from(action.table).update(action.patch).eq('id', action.rowId);
            if (error) throw error;
          }
          // Success (or the row is gone) — drop it from the queue.
          const cur = getOutbox().filter(a => a.id !== action.id);
          saveOutbox(cur);
          flushedAny = true;
        } catch (e) {
          const cur = getOutbox();
          const a = cur.find(x => x.id === action.id);
          if (a) { a.tries = (a.tries || 0) + 1; saveOutbox(cur); }
          break; // likely offline again — stop and retry on the next trigger
        }
      }
      _flushing = false;
      updateGateSyncUI();
      if (flushedAny && navigator.onLine) loadData().catch(() => {});
    }

    function pendingCount() { return getOutbox().length; }

    function updateGateSyncUI() {
      try { renderOfflineBar(); } catch (_) {}
      const pill = el('gateSync');
      const online = navigator.onLine;
      const pending = pendingCount();
      if (pill) {
        const mode = _flushing ? 'syncing' : (online ? 'online' : 'offline');
        let label;
        if (_flushing) label = t('gate.syncing');
        else if (!online) label = t('gate.offline') + (pending ? ' · ' + pending : '');
        else if (pending) label = t('gate.pending', { n: pending });
        else label = t('gate.online');
        pill.className = 'gate-sync ' + mode + (pending ? ' has-pending' : '');
        pill.innerHTML = `<span class="gate-sync-dot"></span>${escape(label)}`;
      }
      const btn = el('gateSyncBtn');
      if (btn) {
        btn.classList.toggle('spinning', _flushing);
        btn.style.display = pending ? 'flex' : 'none';
      }
    }

    // Perform a gate check-in (mark arrived) — optimistic + queued.
    //
    // There is one entrance. A per-device gate name used to be stamped on every
    // arrival so parallel gates could be told apart, but it was never once set:
    // `checked_in_gate` is empty on all 18 arrivals the app has recorded. Who
    // checked a car in is still stamped (`checked_in_by`), which is the part
    // anybody ever asked about.
    function gateCheckIn(carId, opts) {
      const quiet = !!(opts && opts.quiet);
      const patch = { status: 'Sosit', status_color: '#10B981' };
      applyLocalCarPatch(carId, patch);
      enqueueAction({ type: 'car-update', carId, patch });
      renderGate(); updateGateSyncUI();
      flushOutbox();
      if (quiet) return;
      haptic(40);
      try { confettiBurst(); auroraPulse(); } catch (_) {}
      showToast(t('gate.checked_in'));
    }
    function gateSetZone(carId, zone) {
      const z = (zone || '').trim();
      // Warn (soft) if the target zone is already at capacity.
      if (z) {
        const cap = zoneCapacityOf(z);
        if (cap != null) {
          const already = activeCars().some(c => String(c.id) === String(carId) && (c.zone || '').trim().toLowerCase() === z.toLowerCase());
          const occ = activeCars().filter(c => (c.zone || '').trim().toLowerCase() === z.toLowerCase()).length;
          if (!already && occ >= cap) showToast(t('zonecap.full_warn', { zone: z }), 'error');
        }
      }
      applyLocalCarPatch(carId, { zone: z || null });
      enqueueAction({ type: 'car-update', carId, patch: { zone: z || null } });
      renderGateZones();
      updateGateSyncUI();
      flushOutbox();
    }

    // Compact free-spots strip shown at the top of the gate.
    function renderGateZones() {
      const strip = el('gateZones');
      if (!strip) return;
      const occ = zoneOccupancy().filter(o => o.capacity != null);
      if (!occ.length) { strip.innerHTML = ''; strip.style.display = 'none'; return; }
      strip.style.display = 'flex';
      occ.sort((a, b) => a.name.localeCompare(b.name, 'ro'));
      strip.innerHTML = occ.map(o => {
        const full = o.free <= 0;
        return `<span class="gate-zchip ${full ? 'full' : (o.free <= Math.max(1, o.capacity * 0.2) ? 'near' : '')}">
          <b>${escape(o.name)}</b> ${full ? escape(t('zonecap.full')) : o.free + '/' + o.capacity}
        </span>`;
      }).join('');
    }

    // ----- Gate overlay UI -----
    function openGate() {
      // Make sure the gate has data even if we opened offline.
      if (!(state.cars || []).length) {
        const cached = loadCachedCars();
        if (cached.length) state.cars = cached;
      }
      const ov = el('gateOverlay');
      if (!ov) return;
      ov.classList.add('show');
      ov.setAttribute('aria-hidden', 'false');
      state.gateSearch = '';
      const inp = el('gateSearch');
      if (inp) inp.value = '';
      renderGate();
      // Whether the bot can take an invite decides whether the gate offers one,
      // and staff never open the settings panel that fetches this.
      ensureHealth().then(() => { try { renderGate(); } catch (_) {} }).catch(() => {});
      renderGateZones();
      renderKioskBtn();
      updateGateSyncUI();
      flushOutbox();
      pushGateHistory();
      setTimeout(() => inp && inp.focus(), 60);
    }

    // Hardware/browser Back closes the gate instead of leaving the app. Tablets
    // and phones have no Escape key, so this is the primary way back out.
    let _gatePushed = false;
    function pushGateHistory() {
      if (_gatePushed) return;
      try { history.pushState({ kulturaGate: 1 }, ''); _gatePushed = true; } catch (_) {}
    }
    window.addEventListener('popstate', () => {
      const shown = el('gateOverlay')?.classList.contains('show');
      _gatePushed = false;
      if (!shown) return;
      // Locked terminals stay put: re-arm the trap instead of exiting.
      if (isGateRole() || kioskOn()) { pushGateHistory(); return; }
      closeGate();
    });
    function closeGate() {
      const ov = el('gateOverlay');
      if (!ov) return;
      if (isGateRole() || kioskOn()) { stopGateScanner(); return; } // stays locked in kiosk / gate accounts
      stopGateScanner();
      ov.classList.remove('show');
      ov.setAttribute('aria-hidden', 'true');
      // Drop the history entry added on open so Back doesn't need two presses.
      if (_gatePushed) {
        _gatePushed = false;
        try { if (history.state && history.state.kulturaGate) history.back(); } catch (_) {}
      }
    }

    // ----- Kiosk mode: turn this device into a locked gate terminal -----
    function kioskOn() { try { return localStorage.getItem('kultura_kiosk') === '1'; } catch (_) { return false; } }
    let _wakeLock = null;
    async function requestWakeLock() {
      try { if ('wakeLock' in navigator) _wakeLock = await navigator.wakeLock.request('screen'); } catch (_) {}
    }
    function releaseWakeLock() { try { _wakeLock && _wakeLock.release && _wakeLock.release(); } catch (_) {} _wakeLock = null; }
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && kioskOn()) requestWakeLock();
    });
    // Reflect kiosk state on the toggle so the way out is always visible.
    function renderKioskBtn() {
      const b = el('gateKioskBtn');
      if (!b) return;
      const on = kioskOn();
      b.classList.toggle('is-on', on);
      b.title = t(on ? 'kiosk.exit' : 'kiosk.enable');
      b.setAttribute('aria-label', b.title);
    }
    function setKiosk(on) {
      try { on ? localStorage.setItem('kultura_kiosk', '1') : localStorage.removeItem('kultura_kiosk'); } catch (_) {}
      document.body.classList.toggle('kiosk', on);
      try { applyGateLock(); } catch (_) {}
      renderKioskBtn();
      if (on) { openGate(); requestWakeLock(); showToast(t('kiosk.on')); }
      else { releaseWakeLock(); closeGate(); showToast(t('kiosk.off')); }
    }
    el('gateKioskBtn')?.addEventListener('click', async () => {
      if (!kioskOn()) { setKiosk(true); return; }
      if (await uiConfirm(t('kiosk.exit_confirm'))) setKiosk(false);
    });
    // Exit kiosk via a long-press on the gate title (hidden from ordinary taps).
    (function () {
      const title = document.querySelector('#gateOverlay .gate-title h2');
      if (!title) return;
      let timer = null;
      const start = () => { timer = setTimeout(async () => { if (kioskOn() && await uiConfirm(t('kiosk.exit_confirm'))) setKiosk(false); }, 1500); };
      const cancel = () => { clearTimeout(timer); };
      title.addEventListener('pointerdown', start);
      title.addEventListener('pointerup', cancel);
      title.addEventListener('pointerleave', cancel);
    })();
    function renderGate() {
      const box = el('gateResults');
      if (!box) return;
      const q = (state.gateSearch || '').trim().toLowerCase();
      const src = ((state.cars && state.cars.length) ? state.cars : loadCachedCars()).filter(matchesActiveEvent);
      let list = src;
      if (q) {
        const asNo = /^#?\d+$/.test(q) ? q.replace('#', '') : null;
        list = src.filter(c =>
          (asNo && String(c.entry_no || '') === asNo) ||
          (c.plate || '').toLowerCase().includes(q) ||
          (c.model || '').toLowerCase().includes(q) ||
          (c.brand || '').toLowerCase().includes(q) ||
          (c.owner || '').toLowerCase().includes(q)
        );
      }
      // Arrived cars sink to the bottom; within a group keep plate order.
      list = list.slice().sort((a, b) => {
        const aa = statusKey(a.status) === 'sosit' ? 1 : 0;
        const bb = statusKey(b.status) === 'sosit' ? 1 : 0;
        if (aa !== bb) return aa - bb;
        return (a.plate || '').localeCompare(b.plate || '', 'ro');
      });
      if (!list.length) {
        box.innerHTML = `<div class="gate-empty">${escape(t(q ? 'gate.no_match' : 'gate.no_cars'))}</div>`;
        return;
      }
      box.innerHTML = list.slice(0, 60).map(c => {
        const sk = statusKey(c.status);
        const arrived = sk === 'sosit';
        const name = [c.brand, c.model].filter(Boolean).join(' ') || c.model || '—';
        const blocked = plateBlocked(c.plate) !== null;
        // Arriving is the only thing the gate does. Once in, the row is done.
        const actionBtn = arrived
          ? `<button class="gate-arrive is-in" disabled>${escape(t('car.status.arrived'))}</button>`
          : `<button class="gate-arrive" data-gate-arrive="${c.id}">${escape(t('gate.arrive'))}</button>`;
        // A driver who is already in, and whom nothing can reach afterwards.
        // This is the one second in the whole event when linking them costs
        // nobody anything: they are here, holding the phone.
        const tgBtn = (arrived && !c.telegram_chat_id && tgLinkable())
          ? `<button class="gate-tg" data-gate-tg="${c.id}" title="${escape(t('tg.qr_title'))}">${escape(t('tg.qr_short'))}</button>`
          : '';
        return `
          <div class="gate-car ${arrived ? 'arrived' : ''}${blocked ? ' blocked' : ''}" data-car-id="${c.id}">
            <div class="gate-car-info">
              <div class="gate-plate">${c.entry_no ? `<span class="entry-no">#${escape(String(c.entry_no))}</span> ` : ''}${escape(c.plate || '—')}${c.is_vip ? ' <span class="gate-vip">VIP</span>' : ''}${blocked ? ' <span class="gate-blocked">⛔</span>' : ''}</div>
              <div class="gate-car-sub">${escape(name)}${c.owner ? ' · ' + escape(c.owner) : ''}</div>
            </div>
            <select class="gate-zone" data-gate-zone="${c.id}" title="${escape(t('gate.zone_ph'))}">${zoneOptionsHTML(c.zone)}</select>
            ${actionBtn}${tgBtn}
          </div>`;
      }).join('') + (list.length > 60 ? `<div class="gate-more">${escape(t('gate.more', { n: list.length - 60 }))}</div>` : '');
    }

    // Gate wiring
    el('gateOpenBtn')?.addEventListener('click', openGate);

    // ---- Arrivals wall: a live, full-screen display of who just checked in. ----
    let _wallPhotos = {};
    let _wallAutoScroll = false, _wallScrollTimer = null, _wallLastCount = -1;
    function wallBeep() {
      try {
        const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
        const a = new AC(), o = a.createOscillator(), g = a.createGain();
        o.connect(g); g.connect(a.destination); o.type = 'sine'; o.frequency.value = 880;
        g.gain.setValueAtTime(0.0001, a.currentTime);
        g.gain.exponentialRampToValueAtTime(0.18, a.currentTime + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.4);
        o.start(); o.stop(a.currentTime + 0.42);
      } catch (_) {}
    }
    async function openArrivalsWall() {
      const ov = el('arrivalsWall'); if (!ov) return;
      ov.classList.add('show'); ov.setAttribute('aria-hidden', 'false');
      _wallLastCount = -1; // avoid a chime on the first render
      try {
        const { data } = await supa.from('cars').select('id, photos').not('photos', 'is', null);
        _wallPhotos = {};
        (data || []).forEach(r => { const p = Array.isArray(r.photos) ? r.photos : []; if (p.length) _wallPhotos[r.id] = p[0]; });
      } catch (_) {}
      renderArrivalsWall();
      try { renderWallPodium(); } catch (_) {}
      clearInterval(_podiumTimer);
      _podiumTimer = setInterval(() => { try { renderWallPodium(); } catch (_) {} }, 15000);
    }
    function closeArrivalsWall() {
      const ov = el('arrivalsWall'); if (!ov) return;
      ov.classList.remove('show'); ov.setAttribute('aria-hidden', 'true');
      _wallAutoScroll = false; stopWallAutoScroll();
      clearInterval(_podiumTimer); _podiumTimer = null;
      el('wallPresentBtn')?.classList.remove('active');
      try { if (document.fullscreenElement) document.exitFullscreen(); } catch (_) {}
    }
    function startWallAutoScroll() {
      stopWallAutoScroll();
      const grid = el('wallGrid'); if (!grid) return;
      _wallScrollTimer = setInterval(() => {
        if (!el('arrivalsWall')?.classList.contains('show')) return;
        if (grid.scrollTop + grid.clientHeight >= grid.scrollHeight - 2) grid.scrollTo({ top: 0, behavior: 'smooth' });
        else grid.scrollBy({ top: 1 });
      }, 45);
    }
    function stopWallAutoScroll() { if (_wallScrollTimer) { clearInterval(_wallScrollTimer); _wallScrollTimer = null; } }
    function toggleWallPresent() {
      const ov = el('arrivalsWall'); if (!ov) return;
      _wallAutoScroll = !_wallAutoScroll;
      el('wallPresentBtn')?.classList.toggle('active', _wallAutoScroll);
      if (_wallAutoScroll) {
        try { if (ov.requestFullscreen) ov.requestFullscreen(); } catch (_) {}
        startWallAutoScroll();
      } else {
        stopWallAutoScroll();
        try { if (document.fullscreenElement) document.exitFullscreen(); } catch (_) {}
      }
    }
    el('wallPresentBtn')?.addEventListener('click', toggleWallPresent);
    function renderArrivalsWall() {
      const ov = el('arrivalsWall'); if (!ov || !ov.classList.contains('show')) return;
      const grid = el('wallGrid'), empty = el('wallEmpty'), count = el('wallCount');
      const arrived = ((state.cars && state.cars.length) ? state.cars : loadCachedCars())
        .filter(c => matchesActiveEvent(c) && statusKey(c.status) === 'sosit')
        .sort((a, b) => new Date(b.arrived_at || 0) - new Date(a.arrived_at || 0));
      if (count) count.textContent = arrived.length;
      if (empty) empty.hidden = arrived.length > 0;
      // Chime when a new arrival shows up (not on the first render).
      if (_wallLastCount >= 0 && arrived.length > _wallLastCount) wallBeep();
      _wallLastCount = arrived.length;
      if (!grid) return;
      grid.innerHTML = arrived.slice(0, 48).map(c => {
        const name = [c.brand, c.model].filter(Boolean).join(' ') || c.model || '—';
        const photo = _wallPhotos[c.id];
        const media = photo
          ? `<div class="wall-photo" style="background-image:url('${escape(photo)}')"></div>`
          : `<div class="wall-photo wall-ph" style="${avatarBg(c.owner || name)}">${escape(twoInitials(c.owner || name))}</div>`;
        return `<div class="wall-card">
            ${media}
            <div class="wall-info">
              <div class="wall-name">${escape(name)}</div>
              ${c.owner ? `<div class="wall-owner">${escape(c.owner)}</div>` : ''}
              <div class="wall-meta">${c.plate ? `<span class="wall-plate">${escape(c.plate)}</span>` : ''}${c.arrived_at ? `<span class="wall-time">${escape(fmtRelative(c.arrived_at))}</span>` : ''}</div>
            </div>
          </div>`;
      }).join('');
    }

    // Live "Best Car" podium on the projected wall — a natural closing moment
    // for the event. Only shown while voting is open and votes exist.
    let _podiumTimer = null;
    async function renderWallPodium() {
      const box = el('wallPodium'); if (!box) return;
      try {
        const { data: cfg } = await supa.from('ui_settings').select('value').eq('key', 'voting_event_id').maybeSingle();
        const evId = cfg && cfg.value ? Number(cfg.value) : NaN;
        if (!Number.isFinite(evId)) { box.hidden = true; return; }
        const { data: votes } = await supa.from('car_votes').select('car_id').eq('event_id', evId);
        if (!votes || !votes.length) { box.hidden = true; return; }
        const tally = {};
        votes.forEach(v => { tally[v.car_id] = (tally[v.car_id] || 0) + 1; });
        const top = Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 3);
        const src = (state.cars && state.cars.length) ? state.cars : loadCachedCars();
        const medals = ['🥇', '🥈', '🥉'];
        box.hidden = false;
        box.innerHTML = `<div class="wall-podium-t">🏆 ${escape(t('wall.podium'))}</div>` +
          `<div class="wall-podium-row">${top.map(([cid, n], i) => {
            const c = src.find(x => String(x.id) === String(cid));
            const name = c ? ([c.brand, c.model].filter(Boolean).join(' ') || c.plate || ('#' + cid)) : ('#' + cid);
            const photo = c ? _wallPhotos[c.id] : null;
            const media = photo
              ? `<div class="wp-photo" style="background-image:url('${escape(photo)}')"></div>`
              : `<div class="wp-photo wp-ph">${medals[i]}</div>`;
            return `<div class="wp-item wp-${i + 1}">
                <div class="wp-medal">${medals[i]}</div>
                ${media}
                <div class="wp-name">${escape(name)}</div>
                <div class="wp-votes">${n} ⭐</div>
              </div>`;
          }).join('')}</div>`;
      } catch (_) { box.hidden = true; }
    }
    el('wallOpenBtn')?.addEventListener('click', openArrivalsWall);
    el('wallCloseBtn')?.addEventListener('click', closeArrivalsWall);
    el('gateCloseBtn')?.addEventListener('click', closeGate);
    el('gateSyncBtn')?.addEventListener('click', flushOutbox);
    el('gateSearch')?.addEventListener('input', (e) => { state.gateSearch = e.target.value; renderGate(); });
    el('gateResults')?.addEventListener('click', (e) => {
      const arr = e.target.closest('[data-gate-arrive]');
      if (arr && !arr.disabled) { gateCheckIn(arr.dataset.gateArrive); return; }
      const tg = e.target.closest('[data-gate-tg]');
      if (tg) { showInviteQr(tg.dataset.gateTg); return; }
    });
    el('gateResults')?.addEventListener('change', (e) => {
      const zi = e.target.closest('[data-gate-zone]');
      if (zi) gateSetZone(zi.dataset.gateZone, zi.value);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && el('gateOverlay')?.classList.contains('show')) {
        if (el('gateScanner') && !el('gateScanner').hidden) stopGateScanner();
        else closeGate();
      }
    });

    // ----- QR check-in: encode a car pass, decode with the camera -----
    // The QR payload is compact and offline-friendly: "KULTURA:<id>:<plate>".
    function carQrPayload(car) {
      return 'KULTURA:' + car.id + ':' + (car.plate || '');
    }
    // Public "My ticket" link for a participant (works without login).
    function ticketUrl(car) {
      try { return new URL('ticket.html?c=' + car.id + '&k=' + encodeURIComponent(car.plate || ''), location.href).href; }
      catch (_) { return 'ticket.html?c=' + car.id; }
    }
    function findCarByQr(text) {
      if (!text) return null;
      const raw = String(text).trim();
      const src = (state.cars && state.cars.length) ? state.cars : loadCachedCars();
      let m = raw.match(/^KULTURA:(\d+)(?::(.*))?$/i);
      if (m) {
        const id = m[1];
        return src.find(c => String(c.id) === id) || null;
      }
      // Fallbacks: a bare id, or a plate string.
      if (/^\d+$/.test(raw)) {
        const byId = src.find(c => String(c.id) === raw);
        if (byId) return byId;
      }
      const norm = raw.toLowerCase().replace(/\s+/g, '');
      return src.find(c => (c.plate || '').toLowerCase().replace(/\s+/g, '') === norm) || null;
    }

    // ----- PLATE BLOCKLIST (plăci interzise) -----
    let _blockSet = new Map(); // normalized plate -> reason
    function rebuildBlockSet() {
      _blockSet = new Map();
      (state.blocklist || []).forEach(b => { const k = b.plate_norm || normPlateKey(b.plate); if (k) _blockSet.set(k, b.reason || ''); });
    }
    // Returns the block reason (string, possibly empty) if the plate is blocked, else null.
    function plateBlocked(plate) {
      const k = normPlateKey(plate);
      if (k.length < 2) return null;
      return _blockSet.has(k) ? (_blockSet.get(k) || '') : null;
    }
    function renderBlocklist() {
      const box = el('blocklistList'); if (!box) return;
      const list = state.blocklist || [];
      box.innerHTML = list.length
        ? list.map(b => `<div class="block-item">
            <div class="block-item-txt"><strong>${escape(b.plate || b.plate_norm || '—')}</strong>${b.reason ? `<span>${escape(b.reason)}</span>` : ''}</div>
            <button class="block-del" data-block-del="${escape(b.plate_norm || normPlateKey(b.plate))}" aria-label="${escape(t('common.delete'))}">&times;</button>
          </div>`).join('')
        : `<div class="block-empty">${escape(t('block.empty'))}</div>`;
    }
    el('blockAddBtn')?.addEventListener('click', async () => {
      const pi = el('blockPlateInput'), ri = el('blockReasonInput'), msg = el('blockMsg');
      const plate = (pi?.value || '').trim();
      const norm = normPlateKey(plate);
      if (norm.length < 2) { if (msg) { msg.style.color = 'var(--red)'; msg.textContent = t('block.invalid'); } return; }
      const { error } = await supa.from('plate_blocklist').insert({ plate, plate_norm: norm, reason: (ri?.value || '').trim() || null, created_by: currentUserEmail() });
      if (error) { if (msg) { msg.style.color = 'var(--red)'; msg.textContent = t('common.error') + ': ' + error.message; } return; }
      if (pi) pi.value = ''; if (ri) ri.value = '';
      if (msg) { msg.style.color = 'var(--green)'; msg.textContent = t('block.added'); setTimeout(() => { msg.textContent = ''; }, 2000); }
      await loadData();
    });
    el('blocklistList')?.addEventListener('click', async (e) => {
      const d = e.target.closest('[data-block-del]'); if (!d) return;
      const { error } = await supa.from('plate_blocklist').delete().eq('plate_norm', d.dataset.blockDel);
      if (error) { showToast(t('common.error') + ': ' + error.message, 'error'); return; }
      await loadData();
    });

    // ----- Backups (admin) — list, download, run-now. -----
    let _backupBusy = false;
    // ----- Activity log (admin): who did what -----
    const ACT_ICON = { status: '🚦', created: '➕', deleted: '🗑️', delete: '🗑️', update: '✏️', gdpr: '🧹' };
    function actEntityLabel(entity) {
      if (entity === 'car') return t('cmdk.car');
      if (entity === 'gdpr') return 'GDPR';
      return entity || '—';
    }
    async function renderActivityLog() {
      const box = el('activityList'); if (!box) return;
      box.innerHTML = `<div class="block-empty">…</div>`;
      const { data, error } = await supa.from('activity_log')
        .select('entity, action, old_value, new_value, user_email, created_at')
        .order('created_at', { ascending: false }).limit(60);
      if (error) { box.innerHTML = `<div class="block-empty">${escape(error.message)}</div>`; return; }
      if (!data || !data.length) { box.innerHTML = `<div class="block-empty">${escape(t('activity.empty'))}</div>`; return; }
      box.innerHTML = data.map(r => {
        const icon = ACT_ICON[r.action] || '•';
        const who = (r.user_email || '').split('@')[0] || '—';
        let change = '';
        if (r.old_value && r.new_value) change = `${escape(r.old_value)} → ${escape(r.new_value)}`;
        else if (r.new_value) change = escape(r.new_value);
        else if (r.old_value) change = escape(r.old_value);
        const when = r.created_at ? fmtRelative(r.created_at) : '';
        return `<div class="activity-item">
            <span class="activity-ic">${icon}</span>
            <div class="activity-txt">
              <div class="activity-top"><strong>${escape(actEntityLabel(r.entity))}</strong> · ${escape(r.action || '')}${change ? ' · ' + change : ''}</div>
              <div class="activity-meta">${escape(who)}${when ? ' · ' + escape(when) : ''}</div>
            </div>
          </div>`;
      }).join('');
    }
    el('activityRefreshBtn')?.addEventListener('click', () => { try { renderActivityLog(); } catch (_) {} });
    // Export the activity log as a CSV file (opens in Excel).
    function toCsv(rows, cols) {
      const q = (v) => { const s = String(v == null ? '' : v); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
      const head = cols.map(c => q(c.label)).join(',');
      const body = rows.map(r => cols.map(c => q(c.get(r))).join(',')).join('\n');
      return head + '\n' + body;
    }
    function downloadFile(name, text, type) {
      const blob = new Blob(['﻿' + text], { type: (type || 'text/csv') + ';charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = name; document.body.appendChild(a); a.click();
      setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 500);
    }
    el('activityCsvBtn')?.addEventListener('click', async () => {
      const btn = el('activityCsvBtn'); btn.disabled = true;
      try {
        const { data, error } = await supa.from('activity_log')
          .select('created_at, entity, entity_id, action, old_value, new_value, user_email')
          .order('created_at', { ascending: false }).limit(5000);
        if (error) { showToast(t('common.error') + ': ' + error.message, 'error'); return; }
        const cols = [
          { label: 'Data', get: r => r.created_at ? new Date(r.created_at).toLocaleString('ro-RO') : '' },
          { label: 'Entitate', get: r => r.entity }, { label: 'ID', get: r => r.entity_id },
          { label: 'Actiune', get: r => r.action }, { label: 'Vechi', get: r => r.old_value },
          { label: 'Nou', get: r => r.new_value }, { label: 'Utilizator', get: r => r.user_email },
        ];
        const stamp = new Date().toISOString().slice(0, 10);
        downloadFile(`kultura-activity-${stamp}.csv`, toCsv(data || [], cols));
        showToast(t('activity.exported', { n: (data || []).length }));
      } finally { btn.disabled = false; }
    });

    // ----- Best Car voting (admin control + leaderboard) -----
    let _votingEventId = '';
    async function loadVotingSetting() {
      try {
        const { data } = await supa.from('ui_settings').select('value').eq('key', 'voting_event_id').maybeSingle();
        _votingEventId = data && data.value ? String(data.value) : '';
      } catch (_) { _votingEventId = ''; }
    }
    async function renderVotingAdmin() {
      const sel = el('votingEventSel'); if (!sel) return;
      await loadVotingSetting();
      const evs = (state.events || []).slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
      sel.innerHTML = evs.map(e => `<option value="${e.id}"${String(e.id) === _votingEventId ? ' selected' : ''}>${escape(e.title || e.name || ('#' + e.id))}</option>`).join('');
      const msg = el('votingMsg');
      const link = el('votingLink');
      if (_votingEventId) {
        if (msg) { msg.style.color = 'var(--green)'; msg.textContent = t('voting.is_open'); }
        if (link) { link.style.display = 'inline-block'; link.textContent = '🔗 vote.html'; }
      } else {
        if (msg) { msg.style.color = 'var(--text-dim)'; msg.textContent = t('voting.is_closed'); }
        if (link) link.style.display = 'none';
      }
      renderVotingBoard();
    }
    async function setVotingEvent(id) {
      const { error } = await supa.from('ui_settings').upsert(
        { key: 'voting_event_id', value: id ? String(id) : '', updated_at: new Date().toISOString() }, { onConflict: 'key' });
      if (error) { const m = el('votingMsg'); if (m) { m.style.color = 'var(--red)'; m.textContent = t('common.error') + ': ' + error.message; } return; }
      _votingEventId = id ? String(id) : '';
      renderVotingAdmin();
    }
    async function renderVotingBoard() {
      const box = el('votingBoard'); if (!box) return;
      const evId = _votingEventId || (el('votingEventSel') && el('votingEventSel').value);
      if (!evId) { box.innerHTML = ''; return; }
      const { data, error } = await supa.from('car_votes').select('car_id').eq('event_id', Number(evId));
      if (error) { box.innerHTML = `<div class="block-empty">${escape(error.message)}</div>`; return; }
      const tally = {};
      (data || []).forEach(v => { tally[v.car_id] = (tally[v.car_id] || 0) + 1; });
      const rows = Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 15);
      if (!rows.length) { box.innerHTML = `<div class="block-empty">${escape(t('voting.no_votes'))}</div>`; return; }
      const carById = (id) => (state.cars || []).find(c => String(c.id) === String(id));
      box.innerHTML = rows.map(([cid, n], i) => {
        const c = carById(cid);
        const name = c ? ([c.brand, c.model].filter(Boolean).join(' ') || c.plate || ('#' + cid)) : ('#' + cid);
        return `<div class="voting-row"><span class="voting-rank">${i + 1}</span><span class="voting-name">${escape(name)}</span><span class="voting-n">${n} ⭐</span></div>`;
      }).join('');
    }
    // ----- Post-event feedback (staff view) -----
    async function renderFeedback() {
      const list = el('fbList'), sum = el('fbSummary'); if (!list) return;
      const { data, error } = await supa.from('event_feedback')
        .select('rating, comment, contact, created_at').order('created_at', { ascending: false }).limit(80);
      if (error) { list.innerHTML = `<div class="block-empty">${escape(error.message)}</div>`; if (sum) sum.textContent = ''; return; }
      const rows = data || [];
      if (sum) {
        if (rows.length) {
          const avg = rows.reduce((s, r) => s + (r.rating || 0), 0) / rows.length;
          sum.innerHTML = `<span class="fb-avg">${avg.toFixed(1)} ★</span> <span class="fb-count">· ${rows.length} ${escape(t('fb.responses'))}</span>`;
        } else sum.textContent = '';
      }
      if (!rows.length) { list.innerHTML = `<div class="block-empty">${escape(t('fb.empty'))}</div>`; return; }
      list.innerHTML = rows.map(r => {
        const stars = '★'.repeat(r.rating || 0) + '☆'.repeat(Math.max(0, 5 - (r.rating || 0)));
        return `<div class="fb-item">
            <div class="fb-top"><span class="fb-stars">${stars}</span>${r.contact ? `<span class="fb-contact">${escape(r.contact)}</span>` : ''}</div>
            ${r.comment ? `<div class="fb-comment">${escape(r.comment)}</div>` : ''}
            <div class="fb-when">${r.created_at ? escape(fmtRelative(r.created_at)) : ''}</div>
          </div>`;
      }).join('');
    }
    el('fbRefreshBtn')?.addEventListener('click', () => { try { renderFeedback(); } catch (_) {} });
    // Share the feedback page from the card itself. The generic "public pages"
    // block is admin-only and easy to miss, so staff had no way to get this link.
    const feedbackUrl = () => new URL('feedback.html', location.href).href;
    el('fbShareBtn')?.addEventListener('click', async () => {
      const url = feedbackUrl();
      try { await navigator.clipboard.writeText(url); showToast(t('reg.share_copied')); }
      catch (_) { showToast(url); }
    });
    el('fbOpenBtn')?.addEventListener('click', () => { window.open(feedbackUrl(), '_blank', 'noopener'); });

    // ----- Reported client errors (staff view) -----
    async function renderErrorLog() {
      const box = el('errList'); if (!box) return;
      const { data, error } = await supa.from('client_errors')
        .select('message, url, user_email, app_version, created_at, user_agent')
        .order('created_at', { ascending: false }).limit(50);
      if (error) { box.innerHTML = `<div class="block-empty">${escape(error.message)}</div>`; return; }
      if (!data || !data.length) { box.innerHTML = `<div class="block-empty">${escape(t('errlog.empty'))}</div>`; return; }
      // Collapse repeats of the same message into one row with a count.
      const groups = new Map();
      for (const r of data) {
        const k = r.message;
        const g = groups.get(k) || { ...r, n: 0 };
        g.n++; groups.set(k, g);
      }
      box.innerHTML = [...groups.values()].map(r => {
        const who = (r.user_email || '').split('@')[0];
        const dev = /android/i.test(r.user_agent || '') ? 'Android'
          : /iphone|ipad/i.test(r.user_agent || '') ? 'iOS' : 'Desktop';
        const meta = [who, dev, r.url, r.app_version, r.created_at ? fmtRelative(r.created_at) : '']
          .filter(Boolean).map(escape).join(' · ');
        return `<div class="activity-item">
            <span class="activity-ic">⚠️</span>
            <div class="activity-txt">
              <div class="activity-top">${escape(r.message)}${r.n > 1 ? ` <b>×${r.n}</b>` : ''}</div>
              <div class="activity-meta">${meta}</div>
            </div>
          </div>`;
      }).join('');
    }
    // Rate-limit health: are the public limits stopping abuse, or turning away
    // real people? A whole car club behind one venue NAT shares an IP, so a
    // high rejection rate is a signal the thresholds need raising, not a win.
    async function renderRateLimitStats() {
      const box = el('rateLimitStats'); if (!box) return;
      if (!isAdmin()) { box.innerHTML = ''; return; }
      const { data, error } = await supa.rpc('rate_limit_stats', { p_hours: 24 });
      if (error || !data || !data.length) { box.innerHTML = ''; return; }
      const label = { register: t('pub.page_register'), feedback: t('pub.page_feedback'), vote: t('pub.page_vote') };
      box.innerHTML = `<div class="rl-title">${escape(t('rl.title'))}</div>` + data.map(r => {
        const total = (r.accepted || 0) + (r.rejected || 0);
        const pct = total ? Math.round(r.rejected / total * 100) : 0;
        const warn = pct >= 20; // a fifth turned away is worth a second look
        return `<div class="rl-row${warn ? ' warn' : ''}">
            <span class="rl-b">${escape(label[r.bucket] || r.bucket)}</span>
            <span class="rl-n">${r.accepted} ✓${r.rejected ? ` · ${r.rejected} ⛔ (${pct}%)` : ''}</span>
          </div>`;
      }).join('') +
      (data.some(r => ((r.accepted || 0) + (r.rejected || 0)) && r.rejected / ((r.accepted || 0) + (r.rejected || 0)) >= 0.2)
        ? `<div class="rl-hint">${escape(t('rl.hint'))}</div>` : '');
    }
    el('errRefreshBtn')?.addEventListener('click', () => {
      try { renderErrorLog(); } catch (_) {}
      try { renderRateLimitStats(); } catch (_) {}
    });

    el('votingOpenBtn')?.addEventListener('click', () => { const s = el('votingEventSel'); if (s && s.value) setVotingEvent(s.value); });
    el('votingCloseBtn')?.addEventListener('click', () => setVotingEvent(''));
    el('votingEventSel')?.addEventListener('change', renderVotingBoard);

    // Say out loud whether the automatic backup is actually still happening.
    // run_backup() posts to the edge function and never reads the reply, so a
    // failing backup still leaves cron reporting "succeeded" — a recent file is
    // the only real evidence, and silence used to look identical to success.
    let _backupAgeHours;   // undefined = not looked up yet, null = no backup at all
    function renderBackupHealth(files) {
      const box = el('backupHealth');
      if (!box) return;
      const age = backupAgeHours(files);
      // The readiness list echoes this rather than fetching the bucket again;
      // the banner stays the authority on backup freshness.
      _backupAgeHours = age;
      let cls, txt;
      if (age === null) { cls = 'is-bad'; txt = t('backup.health_none'); }
      else if (age > 26)  { cls = 'is-bad';  txt = t('backup.health_stale', { n: Math.floor(age / 24) || 1 }); }
      else                { cls = 'is-ok';   txt = t('backup.health_ok'); }
      box.hidden = false;
      box.className = 'backup-health ' + cls;
      box.textContent = txt;
    }

    async function renderBackupList() {
      const box = el('backupList'); if (!box) return;
      const { data, error } = await supa.storage.from('backups').list('', {
        limit: 100, sortBy: { column: 'name', order: 'desc' },
      });
      if (error) { box.innerHTML = `<div class="block-empty">${escape(error.message)}</div>`; return; }
      const files = (data || []).filter(f => f.name && f.name.endsWith('.json'));
      renderBackupHealth(files);
      if (!files.length) { box.innerHTML = `<div class="block-empty">${escape(t('backup.empty'))}</div>`; return; }
      box.innerHTML = files.map(f => {
        const bytes = f.metadata && f.metadata.size ? Math.max(1, Math.round(f.metadata.size / 1024)) + ' KB' : '';
        // Human date pulled from the ISO stamp embedded in the filename.
        const m = f.name.match(/(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})/);
        const when = m ? `${m[1]} ${m[2]}:${m[3]}` : f.name;
        return `<div class="backup-item">
            <div class="backup-item-txt"><strong>${escape(when)}</strong>${bytes ? `<span>${escape(bytes)}</span>` : ''}</div>
            <div class="backup-acts">
              <button class="btn small ghost" data-backup-dl="${escape(f.name)}">${escape(t('backup.download'))}</button>
              <button class="btn small ghost" data-backup-restore="${escape(f.name)}">${escape(t('restore.btn'))}</button>
            </div>
          </div>`;
      }).join('');
    }
    el('backupRunBtn')?.addEventListener('click', async () => {
      if (_backupBusy) return;
      const msg = el('backupMsg');
      _backupBusy = true;
      if (msg) { msg.style.color = 'var(--text-dim)'; msg.textContent = t('backup.running'); }
      const { error } = await supa.rpc('run_backup');
      if (error) { if (msg) { msg.style.color = 'var(--red)'; msg.textContent = t('common.error') + ': ' + error.message; } _backupBusy = false; return; }
      // The upload happens asynchronously server-side; refresh the list shortly.
      setTimeout(async () => {
        try { await renderBackupList(); } catch (_) {}
        if (msg) { msg.style.color = 'var(--green)'; msg.textContent = t('backup.done'); setTimeout(() => { msg.textContent = ''; }, 2500); }
        _backupBusy = false;
      }, 2500);
    });
    // Orphaned-photo sweep: dry run first, then delete on explicit confirmation.
    el('photoSweepBtn')?.addEventListener('click', async () => {
      const btn = el('photoSweepBtn'), msg = el('backupMsg');
      const say = (txt, color) => { if (msg) { msg.style.color = color || 'var(--text-dim)'; msg.textContent = txt; } };
      btn.disabled = true;
      try {
        say(t('sweep.checking'));
        const { data: pre, error: preErr } = await supa.functions.invoke('photo-sweep', { body: { dry_run: true } });
        if (preErr || !pre || pre.error) { say(t('common.error') + ': ' + (preErr?.message || pre?.error || ''), 'var(--red)'); return; }
        const rows = Object.entries(pre.report || {});
        const orphans = rows.reduce((s, [, v]) => s + v.orphans, 0);
        const kb = rows.reduce((s, [, v]) => s + v.freed_kb, 0);
        if (!orphans) { say(t('sweep.none'), 'var(--green)'); return; }
        const detail = rows.filter(([, v]) => v.orphans)
          .map(([b, v]) => `• ${b}: ${v.orphans} / ${v.total}`).join('\n');
        say('');
        if (!(await uiConfirm(t('sweep.confirm', { n: orphans, kb }) + '\n\n' + detail, { danger: true }))) return;
        say(t('sweep.running'));
        const { data, error } = await supa.functions.invoke('photo-sweep', { body: { dry_run: false } });
        if (error || !data || data.error) { say(t('common.error') + ': ' + (error?.message || data?.error || ''), 'var(--red)'); return; }
        const del = Object.values(data.report || {}).reduce((s, v) => s + v.deleted, 0);
        const freed = Object.values(data.report || {}).reduce((s, v) => s + v.freed_kb, 0);
        say(t('sweep.done', { n: del, kb: freed }), 'var(--green)');
      } finally { btn.disabled = false; }
    });

    el('backupList')?.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-backup-dl]');
      if (b) {
        const name = b.dataset.backupDl;
        const { data, error } = await supa.storage.from('backups').createSignedUrl(name, 120, { download: name });
        if (error || !data) { showToast(t('common.error') + (error ? ': ' + error.message : ''), 'error'); return; }
        window.open(data.signedUrl, '_blank');
        return;
      }
      const r = e.target.closest('[data-backup-restore]');
      if (r) restoreBackup(r.dataset.backupRestore);
    });

    // Restore is two-step: a dry run shows exactly what would come back, and
    // only an explicit confirmation performs the (additive) restore.
    async function restoreBackup(path) {
      const msg = el('backupMsg');
      const say = (txt, color) => { if (msg) { msg.style.color = color || 'var(--text-dim)'; msg.textContent = txt; } };
      say(t('restore.checking'));
      const { data: pre, error: preErr } = await supa.functions.invoke('restore', { body: { path, dry_run: true } });
      if (preErr || !pre || pre.error) { say(t('common.error') + ': ' + (preErr?.message || pre?.error || ''), 'var(--red)'); return; }
      const lines = Object.entries(pre.report || {})
        .filter(([, v]) => v.backup > 0)
        .map(([tbl, v]) => `• ${tbl}: ${v.backup} (${t('restore.now')}: ${v.current})`);
      if (!lines.length) { say(t('restore.empty'), 'var(--red)'); return; }
      say('');
      const ok = await uiConfirm(
        t('restore.confirm', { path }) + '\n\n' + lines.join('\n') + '\n\n' + t('restore.note'),
        { danger: true }
      );
      if (!ok) return;
      say(t('restore.running'));
      const { data, error } = await supa.functions.invoke('restore', { body: { path, dry_run: false } });
      if (error || !data || data.error) { say(t('common.error') + ': ' + (error?.message || data?.error || ''), 'var(--red)'); return; }
      const total = Object.values(data.restored || {}).reduce((s, n) => s + n, 0);
      const failedKeys = Object.keys(data.failed || {});
      if (failedKeys.length) {
        say(t('restore.partial', { n: total, tables: failedKeys.join(', ') }), 'var(--orange)');
      } else {
        say(t('restore.done', { n: total }), 'var(--green)');
      }
      try { await loadData(); } catch (_) {}
      try { renderBackupList(); } catch (_) {}
    }

    // ----- GDPR data deletion (admin) — search (dry-run) then confirm-delete. -----
    let _gdprLast = '';
    function renderGdprResults(res) {
      const box = el('gdprResults'); if (!box) return;
      const matches = (res && res.matches) || [];
      if (!matches.length) { box.innerHTML = `<div class="block-empty">${escape(t('gdpr.none'))}</div>`; return; }
      box.innerHTML =
        matches.map(m => `<div class="gdpr-item">
            <div class="gdpr-item-txt">
              <strong>${escape(m.plate || m.owner || '—')}</strong>
              <span>${escape([m.owner, m.phone, m.email].filter(Boolean).join(' · '))}</span>
              <span class="gdpr-src">${escape(m.source === 'cars' ? t('gdpr.src_car') : t('gdpr.src_reg'))}${m.photos ? ' · 📷 ' + m.photos : ''}</span>
            </div>
          </div>`).join('') +
        `<button type="button" class="btn danger small" id="gdprDeleteBtn" style="margin-top:8px;">${escape(t('gdpr.delete', { n: matches.length }))}</button>`;
    }
    async function gdprInvoke(dryRun) {
      const q = (el('gdprQuery')?.value || '').trim();
      if (q.length < 3) { const msg = el('gdprMsg'); if (msg) { msg.style.color = 'var(--red)'; msg.textContent = t('gdpr.too_short'); } return null; }
      _gdprLast = q;
      const { data, error } = await supa.functions.invoke('gdpr-delete', { body: { query: q, dry_run: dryRun } });
      if (error) {
        const msg = el('gdprMsg'); if (msg) { msg.style.color = 'var(--red)'; msg.textContent = t('common.error') + ': ' + error.message; }
        return null;
      }
      return data;
    }
    el('gdprSearchBtn')?.addEventListener('click', async () => {
      const msg = el('gdprMsg'); if (msg) { msg.style.color = 'var(--text-dim)'; msg.textContent = t('gdpr.searching'); }
      const res = await gdprInvoke(true);
      if (!res) return;
      if (msg) msg.textContent = t('gdpr.found', { n: res.count || 0 });
      renderGdprResults(res);
    });
    el('gdprResults')?.addEventListener('click', async (e) => {
      if (!e.target.closest('#gdprDeleteBtn')) return;
      if (!(await uiConfirm(t('gdpr.confirm', { q: _gdprLast }), { danger: true }))) return;
      const msg = el('gdprMsg'); if (msg) { msg.style.color = 'var(--text-dim)'; msg.textContent = t('gdpr.deleting'); }
      const res = await gdprInvoke(false);
      if (!res) return;
      if (msg) { msg.style.color = 'var(--green)'; msg.textContent = t('gdpr.deleted', { n: res.deleted || 0 }); }
      el('gdprResults').innerHTML = '';
      if (el('gdprQuery')) el('gdprQuery').value = '';
      try { await loadData(); } catch (_) {}
    });

    let _scanStream = null, _scanRAF = null, _scanDetector = null, _scanBusy = false, _lastScanAt = 0, _scanCanvas = null, _jsqrLoading = null, _scanPaused = false;
    // Lazy-load the vendored pure-JS QR decoder (fallback for browsers without
    // BarcodeDetector — notably iPhone/Safari).
    function ensureJsQr() {
      if (window.jsQR) return Promise.resolve(window.jsQR);
      if (_jsqrLoading) return _jsqrLoading;
      _jsqrLoading = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'vendor/jsqr.js';
        s.onload = () => window.jsQR ? resolve(window.jsQR) : reject(new Error('jsQR missing'));
        s.onerror = () => { _jsqrLoading = null; reject(new Error('jsQR load failed')); };
        document.head.appendChild(s);
      });
      return _jsqrLoading;
    }
    async function startGateScanner() {
      const panel = el('gateScanner'), video = el('gateVideo'), hint = el('gateScanHint');
      if (!panel || !video) return;
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showToast(t('gate.scan_unsupported'), 'error');
        return;
      }
      panel.hidden = false;
      // Burst is a per-device habit, so it survives closing the scanner.
      const bt = el('gateBurst');
      if (bt) {
        try { bt.checked = localStorage.getItem('kultura_gate_burst') === '1'; } catch (_) {}
      }
      _burstCount = 0;
      const bc = el('gateBurstCount');
      if (bc) bc.textContent = '';
      if (hint) hint.textContent = t(burstOn() ? 'gate.burst_hint' : 'gate.scan_hint');
      try {
        // Native BarcodeDetector (Android/Chrome) when available; otherwise the
        // jsQR fallback so iPhone/Safari can scan too.
        if ('BarcodeDetector' in window) {
          _scanDetector = new window.BarcodeDetector({ formats: ['qr_code'] });
        } else {
          _scanDetector = null;
          await ensureJsQr();
        }
        _scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        video.srcObject = _scanStream;
        video.setAttribute('playsinline', 'true'); // iOS: keep the preview inline
        await video.play();
        _scanLoop();
      } catch (err) {
        stopGateScanner();
        showToast(t('gate.scan_denied'), 'error');
      }
    }
    // Return the decoded QR text from the current video frame, via whichever
    // engine is active.
    async function _decodeGateFrame(video) {
      if (_scanDetector) {
        const codes = await _scanDetector.detect(video);
        return (codes && codes.length) ? codes[0].rawValue : null;
      }
      const w = video.videoWidth, h = video.videoHeight;
      if (!w || !h || !window.jsQR) return null;
      if (!_scanCanvas) _scanCanvas = document.createElement('canvas');
      const scale = Math.min(1, 640 / Math.max(w, h));
      const cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale));
      _scanCanvas.width = cw; _scanCanvas.height = ch;
      const ctx = _scanCanvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(video, 0, 0, cw, ch);
      const img = ctx.getImageData(0, 0, cw, ch);
      const res = window.jsQR(img.data, cw, ch, { inversionAttempts: 'dontInvert' });
      return res ? res.data : null;
    }
    function _scanLoop() {
      const video = el('gateVideo');
      const tick = async () => {
        if (!_scanStream || !video) return;
        if (_scanPaused) { _scanRAF = requestAnimationFrame(tick); return; }
        if (!_scanBusy && Date.now() - _lastScanAt > 700) {
          _scanBusy = true;
          try {
            const val = await _decodeGateFrame(video);
            if (val) {
              const car = findCarByQr(val);
              _lastScanAt = Date.now();
              if (car) {
                if (burstOn() && handleBurstScan(car)) {
                  // stayed live: no pause, no card
                } else {
                  try { navigator.vibrate && navigator.vibrate(80); } catch (_) {}
                  showGateScanResult(car);
                }
              } else {
                showToast(t('gate.scan_notfound'), 'error');
              }
            }
          } catch (_) {}
          _scanBusy = false;
        }
        _scanRAF = requestAnimationFrame(tick);
      };
      _scanRAF = requestAnimationFrame(tick);
    }
    // ---- Burst mode -------------------------------------------------------
    //
    // The measured shape of a real gate: 10 check-ins inside one minute, then 5
    // more over the next nine, every one of them from the same account and the
    // same phone. In that stretch the confirmation card costs a tap per car and
    // stops the camera each time.
    //
    // With burst on, a scan checks the car in immediately — the feedback is a
    // vibration and a colour flash instead of a dialog, and the camera never
    // stops. Two cases deliberately still stop and ask, because getting them
    // wrong is expensive: a blocklisted plate, and a car already inside.
    let _burstCount = 0;
    function burstOn() {
      const b = el('gateBurst');
      return !!(b && b.checked);
    }
    function burstFlash(kind) {
      const f = el('gateBurstFlash');
      if (!f) return;
      f.className = 'gate-burst-flash is-' + kind;
      // Restart the animation even when two scans land back to back.
      void f.offsetWidth;
      f.classList.add('show');
      setTimeout(() => f.classList.remove('show'), 420);
    }
    function burstBump() {
      _burstCount++;
      const c = el('gateBurstCount');
      if (c) c.textContent = String(_burstCount);
    }
    el('gateBurst')?.addEventListener('change', () => {
      _burstCount = 0;
      const c = el('gateBurstCount');
      if (c) c.textContent = '';
      try {
        if (burstOn()) localStorage.setItem('kultura_gate_burst', '1');
        else localStorage.removeItem('kultura_gate_burst');
      } catch (_) {}
      const hint = el('gateScanHint');
      if (hint) hint.textContent = t(burstOn() ? 'gate.burst_hint' : 'gate.scan_hint');
    });

    // Returns true when the scan was fully handled without stopping the camera.
    // Returning false hands the car to the normal confirmation card.
    function handleBurstScan(car) {
      const what = gateBurstAction(statusKey(car.status), plateBlocked(car.plate) !== null);
      if (what === 'card') return false;
      if (what === 'dup') {
        try { navigator.vibrate && navigator.vibrate([40, 60, 40]); } catch (_) {}
        burstFlash('dup');
        return true;
      }
      // Quiet check-in: no confetti, no toast — at ten a minute the animations
      // are the slow part and the toasts stack into a wall.
      gateCheckIn(car.id, { quiet: true });
      try { navigator.vibrate && navigator.vibrate(120); } catch (_) {}
      burstFlash('ok');
      burstBump();
      return true;
    }

    // On a successful scan, pause and show a confirmation card with the car so
    // the operator taps „Sosit" (instead of auto-marking arrival).
    function showGateScanResult(car) {
      const res = el('gateScanResult'); if (!res) return;
      _scanPaused = true;
      const name = [car.brand, car.model].filter(Boolean).join(' ') || car.model || '—';
      el('gsrName').textContent = name;
      el('gsrSub').textContent = [car.color, car.owner, car.plate].filter(Boolean).join(' · ');
      const blockReason = plateBlocked(car.plate);
      el('gsrStatus').innerHTML = `<span class="badge ${statusToBadge(car.status)}">${escape(translateStatus(car.status, 'car'))}</span>`
        + (blockReason !== null ? `<div class="gsr-blocked">⛔ ${escape(t('block.gate_warn'))}${blockReason ? ' — ' + escape(blockReason) : ''}</div>` : '');
      const card = document.querySelector('#gateScanResult .gsr-card');
      if (card) card.classList.toggle('is-blocked', blockReason !== null);
      // Where the driver has to go, in the size it has to be read at from a
      // phone held at arm's length in daylight. The scan already knew this and
      // said nothing: the card gave the car's name and status, and the operator
      // then had to go looking for the spot in another screen.
      const where = el('gsrWhere');
      const spotBtn = el('gsrSpot'), mapBtn = el('gsrMap');
      const hasSpot = car.spot_no != null && String(car.zone || '').trim() !== '';
      if (where) {
        where.hidden = false;
        where.className = 'gsr-where' + (hasSpot ? '' : ' is-missing');
        where.innerHTML = hasSpot
          ? `<div class="gsr-no">${car.entry_no != null ? '#' + escape(String(car.entry_no)) : ''}</div>`
            + `<div class="gsr-zone">${escape(t('gate.go_zone'))} <b>${escape(car.zone)}</b></div>`
            + `<div class="gsr-spot">${escape(t('gate.go_spot'))} <b>${escape(String(car.spot_no))}</b></div>`
          : `<div class="gsr-no">${car.entry_no != null ? '#' + escape(String(car.entry_no)) : ''}</div>`
            + `<div class="gsr-nospot">⚠️ ${escape(t('gate.no_spot_yet'))}</div>`;
      }
      // Two different next steps, and only ever one of them on screen.
      if (spotBtn) { spotBtn.hidden = hasSpot || !roleAtLeast('staff'); spotBtn.dataset.carId = car.id; }
      if (mapBtn) {
        mapBtn.hidden = !hasSpot;
        mapBtn.dataset.spotZone = car.zone || '';
        mapBtn.dataset.spotNo = car.spot_no != null ? String(car.spot_no) : '';
      }

      const arrived = statusKey(car.status) === 'sosit';
      const btn = el('gsrArrive');
      if (btn) { btn.dataset.carId = car.id; btn.disabled = arrived; btn.textContent = arrived ? t('gate.scan_already_short') : t('car.status.arrived'); }
      const ph = el('gsrPhoto');
      if (ph) { ph.textContent = twoInitials(car.owner || name); ph.setAttribute('style', avatarBg(car.owner || name)); }
      // Fetch the photo lazily (lean list omits it).
      supa.from('cars').select('photos').eq('id', car.id).single().then(({ data }) => {
        const p = data && Array.isArray(data.photos) ? data.photos : [];
        if (p.length && ph && !res.hidden) { ph.textContent = ''; ph.setAttribute('style', `background-image:url('${p[0]}');background-size:cover;background-position:center;`); }
      }).catch(() => {});
      res.hidden = false;
    }
    function hideGateScanResult() {
      const res = el('gateScanResult'); if (res) res.hidden = true;
      _scanPaused = false;
      _lastScanAt = Date.now(); // debounce so the same code isn't re-read instantly
    }
    // Light the bay up on the map. Reading a zone and a number off a card is
    // not the same as seeing where to point: the plan is 266 bays.
    function showSpotOnMap(zone, no) {
      hideGateScanResult();
      closeGate();
      selectSection('map');
      setTimeout(() => {
        const pin = [...document.querySelectorAll('.map-spot')].find(p =>
          p.dataset.spotNo === String(no)
          && (p.dataset.spotZone || '').toLowerCase() === String(zone || '').toLowerCase());
        if (!pin) return;
        // Not scrolled to: the frame pans by transform, and moving it would
        // leave the operator somewhere they did not ask to be. The plan is
        // fitted to the screen anyway, so lighting the pin is enough.
        pin.classList.add('is-found');
        setTimeout(() => pin.classList.remove('is-found'), 6000);
      }, 600);
    }

    el('gsrMap')?.addEventListener('click', (e) => {
      const b = e.currentTarget;
      showSpotOnMap(b.dataset.spotZone, b.dataset.spotNo);
    });
    // No spot yet. This is navigation, not a mode: the map is where a bay is
    // tapped and a car chosen, exactly as it is for every other car.
    el('gsrSpot')?.addEventListener('click', () => {
      hideGateScanResult();
      closeGate();
      selectSection('map');
      showToast(t('gate.assign_hint'));
    });

    el('gsrCancel')?.addEventListener('click', hideGateScanResult);
    el('gsrArrive')?.addEventListener('click', () => {
      const id = el('gsrArrive')?.dataset.carId; if (!id) return;
      gateCheckIn(id);
      try { navigator.vibrate && navigator.vibrate(120); } catch (_) {}
      hideGateScanResult();
    });
    function stopGateScanner() {
      const panel = el('gateScanner'), video = el('gateVideo'), cap = el('gatePlateCapture');
      if (_scanRAF) { cancelAnimationFrame(_scanRAF); _scanRAF = null; }
      if (_scanStream) { try { _scanStream.getTracks().forEach(tr => tr.stop()); } catch (_) {} _scanStream = null; }
      if (video) { try { video.pause(); video.srcObject = null; } catch (_) {} }
      _scanBusy = false;
      _scanPaused = false;
      const res = el('gateScanResult'); if (res) res.hidden = true;
      if (cap) cap.hidden = true;
      if (panel) panel.hidden = true;
    }
    el('gateScanBtn')?.addEventListener('click', () => {
      const panel = el('gateScanner');
      if (panel && panel.hidden) startGateScanner(); else stopGateScanner();
    });
    el('gateScanClose')?.addEventListener('click', stopGateScanner);

    // ----- Plate scan via camera + AI vision (#1) -----
    let _plateBusy = false;
    async function startPlateScanner() {
      const panel = el('gateScanner'), video = el('gateVideo'), hint = el('gateScanHint'), cap = el('gatePlateCapture');
      if (!panel || !video) return;
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { showToast(t('gate.scan_unsupported'), 'error'); return; }
      panel.hidden = false;
      if (hint) hint.textContent = t('gate.plate_hint');
      if (cap) cap.hidden = false;
      try {
        _scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        video.srcObject = _scanStream;
        await video.play();
      } catch (err) { stopGateScanner(); showToast(t('gate.scan_denied'), 'error'); }
    }
    async function capturePlate() {
      const video = el('gateVideo'), hint = el('gateScanHint'), cap = el('gatePlateCapture');
      if (!video || !_scanStream || _plateBusy) return;
      if (!navigator.onLine) { showToast(t('gate.plate_offline'), 'error'); return; }
      _plateBusy = true;
      if (cap) cap.disabled = true;
      if (hint) hint.textContent = t('gate.plate_reading');
      const norm = s => (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      try {
        const w = video.videoWidth || 1280, h = video.videoHeight || 720;
        const scale = Math.min(1, 1280 / Math.max(w, h));
        const cw = Math.round(w * scale), ch = Math.round(h * scale);
        const canvas = document.createElement('canvas'); canvas.width = cw; canvas.height = ch;
        canvas.getContext('2d').drawImage(video, 0, 0, cw, ch);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        const { data, error } = await supa.functions.invoke('read-plate', { body: { image: dataUrl } });
        if (error || !data) throw new Error((error && error.message) || 'read-plate');
        const plate = norm(data.plate);
        if (!plate) { if (hint) hint.textContent = t('gate.plate_none'); return; }
        const car = (state.cars || []).find(c => norm(c.plate) === plate);
        if (!car) { if (hint) hint.textContent = t('gate.plate_notfound') + ': ' + plate; return; }
        haptic(120);
        if (statusKey(car.status) === 'sosit') showToast(t('gate.scan_already', { plate: car.plate || car.id }));
        else gateCheckIn(car.id);
        stopGateScanner();
      } catch (e) {
        if (hint) hint.textContent = t('gate.plate_error');
        showToast(t('common.error') + ': ' + (e.message || e), 'error');
      } finally {
        _plateBusy = false; if (cap) cap.disabled = false;
      }
    }
    el('gatePlateBtn')?.addEventListener('click', () => {
      const panel = el('gateScanner');
      if (panel && panel.hidden) startPlateScanner(); else stopGateScanner();
    });
    el('gatePlateCapture')?.addEventListener('click', capturePlate);

    // Connectivity → drain the queue and refresh the indicator.
    // Coming back from an offline stretch, the delta watermark is stale by
    // however long we were away — and rows may have been deleted meanwhile.
    // Re-sync from scratch instead of trusting it.
    window.addEventListener('online',  () => { resetDeltaSync(); updateGateSyncUI(); flushOutbox(); updateConnBanner(); });
    window.addEventListener('offline', () => { updateGateSyncUI(); updateConnBanner(); });
    updateGateSyncUI();

    // ----- Connection banner (offline / reconnecting) -----
    let _connError = false;
    function setConnError(v) { if (_connError !== v) { _connError = v; updateConnBanner(); } }
    function updateConnBanner() {
      const b = el('connBanner');
      if (!b) return;
      if (!navigator.onLine) {
        b.textContent = t('conn.offline');
        b.className = 'conn-banner show offline';
      } else if (_connError) {
        b.textContent = t('conn.reconnecting');
        b.className = 'conn-banner show warn';
      } else {
        b.className = 'conn-banner';
      }
    }
    updateConnBanner();

    // ----- Haptic feedback (no-op where unsupported) -----


    // ----- Count-up number animation (stats) -----
    let _statsAnimated = false;
    function countUp(node, to, dur = 750, from = 0) {
      to = Number(to) || 0;
      from = Number(from) || 0;
      if (_reduceMotion() || from === to) { node.textContent = to; return; }
      const t0 = performance.now();
      (function tick(now) {
        const p = Math.min(1, (now - t0) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        node.textContent = Math.round(from + (to - from) * eased);
        if (p < 1) requestAnimationFrame(tick);
      })(t0);
    }

    // ----- Confetti burst (success moments) -----
    // ----- Spotlight glow following the pointer on stat tiles (desktop) -----
    if (window.matchMedia && window.matchMedia('(hover: hover)').matches) {
      document.addEventListener('pointermove', (e) => {
        const tile = e.target.closest && e.target.closest('.stat');
        if (!tile) return;
        const r = tile.getBoundingClientRect();
        tile.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
        tile.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
        tile.classList.add('spot');
      });
      document.addEventListener('pointerout', (e) => {
        const tile = e.target.closest && e.target.closest('.stat');
        if (tile) tile.classList.remove('spot');
      });
    }

    // ----- Accent auto per active event (#accent) -----
    // While a single event is active and has a color, tint the app accent with
    // it; otherwise fall back to the user's saved accent choice.
    function applyEventAccent() {
      const r = document.documentElement.style;
      let ev = null;
      if (state.activeEventId) ev = (state.events || []).find(e => String(e.id) === String(state.activeEventId));
      const col = ev && ev.status_color;
      if (col && /^#([0-9a-f]{6})$/i.test(col)) {
        r.setProperty('--accent', col);
        r.setProperty('--accent-2', col);
        r.setProperty('--accent-glow', hexToRgba(col, 0.38));
      } else {
        try { applyAccent(currentAccent()); } catch (_) {}
      }
    }

    // ----- Task-progress donut on Home (completed vs total) -----
    const DONUT_C = 2 * Math.PI * 34; // r=34
    function renderTaskDonut() {
      const fill = el('taskDonutFill');
      if (!fill) return;
      const tasks = activeTasks();
      const total = tasks.length;
      const done = tasks.filter(tk => tk.is_completed).length;
      const pct = total ? Math.round(done / total * 100) : 0;
      fill.style.strokeDasharray = String(DONUT_C);
      fill.style.strokeDashoffset = String(DONUT_C * (1 - pct / 100));
      const p = el('taskDonutPct'); if (p) p.textContent = pct + '%';
      const m = el('taskDonutMeta'); if (m) m.textContent = `${done}/${total}`;
    }

    // ----- Tap ripple on buttons / chips / tabs -----
    document.addEventListener('pointerdown', (e) => {
      if (_reduceMotion()) return;
      const target = e.target.closest('.btn, .chip, .tab, .mtab, .action-btn, .add-btn, .view-btn');
      if (!target || target.disabled) return;
      const r = target.getBoundingClientRect();
      const size = Math.max(r.width, r.height) * 1.2;
      const ink = document.createElement('span');
      ink.className = 'ripple-ink';
      ink.style.width = ink.style.height = size + 'px';
      ink.style.left = (e.clientX - r.left) + 'px';
      ink.style.top = (e.clientY - r.top) + 'px';
      const prevPos = getComputedStyle(target).position;
      if (prevPos === 'static') target.style.position = 'relative';
      if (getComputedStyle(target).overflow === 'visible') target.style.overflow = 'hidden';
      target.appendChild(ink);
      setTimeout(() => ink.remove(), 600);
    }, { passive: true });

    // ----- Swipe-left on a car row to quick check-in (mark "Sosit") -----
    (function initCarSwipe() {
      let row = null, id = null, x0 = 0, y0 = 0, dx = 0, active = false, decided = false, horiz = false;
      const THRESH = 70;
      const list = () => el('carsList');
      document.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        const r = e.target.closest('.car-row');
        if (!r || !list() || !list().contains(r)) return;
        if (e.target.closest('.action-btn, button, a, input, select')) return;
        row = r; id = r.dataset.rowId; x0 = e.clientX; y0 = e.clientY;
        dx = 0; active = true; decided = false; horiz = false;
      });
      document.addEventListener('pointermove', (e) => {
        if (!active || !row) return;
        dx = e.clientX - x0;
        const dy = e.clientY - y0;
        if (!decided && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
          decided = true; horiz = Math.abs(dx) > Math.abs(dy);
        }
        if (!horiz) return;
        const t = Math.max(-120, Math.min(0, dx)); // left only
        row.style.transform = `translateX(${t}px)`;
        row.style.transition = 'none';
        row.classList.toggle('swipe-hot', t <= -THRESH);
      });
      const end = () => {
        if (!active || !row) { active = false; return; }
        const r = row, rid = id, fire = horiz && dx <= -THRESH;
        r.style.transition = 'transform 0.25s ease';
        r.style.transform = '';
        r.classList.remove('swipe-hot');
        active = false; row = null; id = null;
        if (fire) {
          r.dataset.swipeFired = '1';
          setTimeout(() => { delete r.dataset.swipeFired; }, 400);
          const opt = (CAR_STATUS_OPTIONS || []).find(o => o.key === 'sosit');
          haptic(30);
          (async () => {
            const { error } = await supa.from('cars').update({
              status: opt ? opt.label : 'Sosit', status_color: opt ? opt.color : '#10B981'
            }).eq('id', rid);
            if (error) uiAlert(t('common.error') + ': ' + error.message);
            else showToast(t('car.swipe.checked_in'));
          })();
        }
      };
      document.addEventListener('pointerup', end);
      document.addEventListener('pointercancel', end);
      // Swallow the click that follows a fired swipe so the detail doesn't open.
      document.addEventListener('click', (e) => {
        const r = e.target.closest('.car-row');
        if (r && r.dataset.swipeFired) { e.stopPropagation(); e.preventDefault(); }
      }, true);
    })();

    // ----- Skeleton placeholders shown until the first data arrives -----
    function skeletonCards(n, kind) {
      let out = '';
      for (let i = 0; i < n; i++) {
        out += `<div class="skel-card ${kind || ''}"><div class="skel-line w60"></div><div class="skel-line w40"></div><div class="skel-line w80"></div></div>`;
      }
      return `<div class="skel-wrap">${out}</div>`;
    }
    function showSkeletons() {
      const map = { carsList: 4, tasksList: 4, eventsList: 3 };
      Object.entries(map).forEach(([id, n]) => {
        const c = el(id);
        if (c && !c.children.length) c.innerHTML = skeletonCards(n);
      });
    }

    // ----- Focus trap + Escape close for open modals -----
    function _openModalEls() { return [...document.querySelectorAll('.modal-backdrop.show')]; }
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const top = _openModalEls().pop();
        if (top) { e.preventDefault(); closeModal(top); return; }
      }
      if (e.key !== 'Tab') return;
      const top = _openModalEls().pop();
      if (!top) return;
      const items = [...top.querySelectorAll('a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')]
        .filter(x => x.offsetParent !== null);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    // Live arrivals dashboard (staff): counters, arrivals-per-hour, per-zone /
    // per-category arrival rate, and check-ins per operator.
    function renderAflux() {
      const block = el('afluxBlock');
      if (!block) return;
      if (!roleAtLeast('staff')) { block.hidden = true; return; }
      const cars = activeCars();
      const isArr = (c) => (c.status || '').toLowerCase().includes('sosit');
      const arrived = cars.filter(isArr);
      const everArrived = cars.filter(c => isArr(c) || c.arrived_at);
      block.hidden = false;
      const sum = el('afluxSummary');
      if (sum) sum.textContent = t('aflux.summary', { a: arrived.length, n: cars.length });

      // Headline counters: present now, left, ever-arrived, and check-ins in
      // the last 15 minutes (live pace).
      const cnt = el('afluxCounters');
      if (cnt) {
        const now = Date.now();
        const recent = everArrived.filter(c => c.arrived_at && (now - new Date(c.arrived_at).getTime()) <= 15 * 60000).length;
        const tile = (n, label, cls) => `<div class="aflux-tile ${cls}"><b>${n}</b><span>${escape(label)}</span></div>`;
        cnt.innerHTML =
          tile(arrived.length, t('aflux.present_now'), 'ok') +
          tile(everArrived.length, t('aflux.arrived_total'), '') +
          tile(recent, t('aflux.last15'), 'hot');
      }

      // Arrivals per hour (from arrived_at). Only hours with data.
      const byHour = {};
      arrived.forEach(c => { if (c.arrived_at) { const h = new Date(c.arrived_at).getHours(); byHour[h] = (byHour[h] || 0) + 1; } });
      const hours = Object.keys(byHour).map(Number).sort((a, b) => a - b);
      const maxH = Math.max(1, ...hours.map(h => byHour[h]));
      const hoursBox = el('afluxHours');
      if (hoursBox) {
        hoursBox.innerHTML = hours.length
          ? hours.map(h => `<div class="aflux-hbar" title="${h}:00 — ${byHour[h]}">
              <div class="aflux-hbar-fill" style="height:${Math.round(byHour[h] / maxH * 100)}%"></div>
              <div class="aflux-hbar-lbl">${String(h).padStart(2, '0')}</div></div>`).join('')
          : `<div class="aflux-empty">${escape(t('aflux.no_arrivals'))}</div>`;
      }

      // Grouped arrival rate (arrived / total) for a key.
      const groupRate = (keyFn) => {
        const g = {};
        cars.forEach(c => { const k = (keyFn(c) || '').trim(); if (!k) return; g[k] = g[k] || { a: 0, n: 0 }; g[k].n++; if (isArr(c)) g[k].a++; });
        return Object.entries(g).sort((a, b) => b[1].n - a[1].n).slice(0, 12);
      };
      const renderRates = (id, rows) => {
        const box = el(id); if (!box) return;
        box.innerHTML = rows.length ? rows.map(([k, v]) => {
          const pct = v.n ? Math.round(v.a / v.n * 100) : 0;
          return `<div class="aflux-row"><div class="aflux-row-top"><span>${escape(k)}</span><span>${v.a}/${v.n}</span></div>
            <div class="aflux-track"><div class="aflux-track-fill" style="width:${pct}%"></div></div></div>`;
        }).join('') : `<div class="aflux-empty">—</div>`;
      };
      renderRates('afluxZones', groupRate(c => c.zone));
      renderRates('afluxCats', groupRate(c => c.category));
      renderRates('afluxBrands', groupRate(c => c.brand));
      renderRates('afluxCities', groupRate(c => c.city));

      // Simple count list (label → n), reused for operators and gates.
      const countList = (id, map, emptyKey) => {
        const rows = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 12);
        const box = el(id); if (!box) return;
        box.innerHTML = rows.length
          ? rows.map(([o, n]) => `<div class="aflux-op"><span>${escape(o.split('@')[0])}</span><span class="aflux-op-n">${n}</span></div>`).join('')
          : `<div class="aflux-empty">${escape(t(emptyKey))}</div>`;
      };
      // Check-ins per operator.
      const ops = {};
      arrived.forEach(c => { const o = (c.checked_in_by || '').trim(); if (o) ops[o] = (ops[o] || 0) + 1; });
      countList('afluxOps', ops, 'aflux.no_operators');
    }

    function renderRegStats() {
      const block = el('regStatsBlock'); if (!block) return;
      if (!roleAtLeast('staff')) { block.hidden = true; return; }
      block.hidden = false;
      const regs = (state.registrations || []).filter(r => r.status === 'pending' || r.status === 'hold');
      const pending = regs.filter(r => r.status === 'pending').length;
      const hold = regs.filter(r => r.status === 'hold').length;
      const cars = activeCars();
      const sum = el('regStatsSummary');
      if (sum) sum.textContent = t('regstats.summary', { p: pending, h: hold, a: cars.length });
      // Approved-per-day over the last 7 days (cars.created_at).
      const days = []; const now = new Date();
      for (let i = 6; i >= 0; i--) { const d = new Date(now); d.setDate(now.getDate() - i); days.push(d); }
      const dayKey = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      const counts = {}; days.forEach(d => counts[dayKey(d)] = 0);
      cars.forEach(c => { if (c.created_at) { const k = dayKey(new Date(c.created_at)); if (k in counts) counts[k]++; } });
      const maxD = Math.max(1, ...Object.values(counts));
      const box = el('regStatsDays');
      if (box) box.innerHTML = days.map(d => {
        const k = dayKey(d); const n = counts[k];
        const lbl = d.toLocaleDateString(currentLang || 'ro', { weekday: 'short' }).slice(0, 2);
        return `<div class="aflux-hbar" title="${k} — ${n}"><div class="aflux-hbar-fill" style="height:${Math.round(n / maxD * 100)}%"></div><div class="aflux-hbar-lbl">${escape(lbl)}</div></div>`;
      }).join('');
      const top = (keyFn) => { const g = {}; cars.forEach(c => { const k = (keyFn(c) || '').trim(); if (!k) return; g[k] = (g[k] || 0) + 1; }); return Object.entries(g).sort((a, b) => b[1] - a[1]).slice(0, 8); };
      const renderList = (id, rows) => {
        const b = el(id); if (!b) return; const max = Math.max(1, ...rows.map(r => r[1]));
        b.innerHTML = rows.length ? rows.map(([k, v]) => `<div class="aflux-row"><div class="aflux-row-top"><span>${escape(k)}</span><span>${v}</span></div><div class="aflux-track"><div class="aflux-track-fill" style="width:${Math.round(v / max * 100)}%"></div></div></div>`).join('') : `<div class="aflux-empty">—</div>`;
      };
      renderList('regStatsCities', top(c => c.city));
      renderList('regStatsCats', top(c => c.category));
    }

    // Compare participation across events (uses all loaded cars, grouped by event).
    function renderCompare() {
      const block = el('compareBlock'); if (!block) return;
      if (!roleAtLeast('staff')) { block.hidden = true; return; }
      const evs = (state.events || []);
      if (evs.length < 2) { block.hidden = true; return; }
      const isArr = (c) => statusKey(c.status) === 'sosit' || !!c.arrived_at;
      const byEvent = {};
      (state.cars || []).forEach(c => {
        const k = c.event_id == null ? '' : String(c.event_id);
        if (!byEvent[k]) byEvent[k] = { total: 0, arr: 0 };
        byEvent[k].total++; if (isArr(c)) byEvent[k].arr++;
      });
      const rows = evs.map(e => ({ e, s: byEvent[String(e.id)] || { total: 0, arr: 0 } }))
        .filter(r => r.s.total > 0)
        .sort((a, b) => String(b.e.date || b.e.starts_at || '').localeCompare(String(a.e.date || a.e.starts_at || '')))
        .slice(0, 10);
      if (!rows.length) { block.hidden = true; return; }
      block.hidden = false;
      const max = Math.max(1, ...rows.map(r => r.s.total));
      const box = el('compareList');
      if (box) box.innerHTML = rows.map(r => {
        const name = r.e.title || r.e.name || ('#' + r.e.id);
        const pct = r.s.total ? Math.round(r.s.arr / r.s.total * 100) : 0;
        const w = Math.round(r.s.total / max * 100);
        return `<div class="cmp-row">
            <div class="cmp-top"><span class="cmp-name">${escape(name)}</span><span class="cmp-val">${r.s.total} 🚗 · ${r.s.arr} ✓ (${pct}%)</span></div>
            <div class="cmp-track"><div class="cmp-fill" style="width:${w}%"></div></div>
          </div>`;
      }).join('');
    }

    function renderStats(cars, tasks, events) {
      try { renderAflux(); } catch (_) {}
      try { renderCompare(); } catch (_) {}
      try { renderRegStats(); } catch (_) {}
      // Cars/tasks respect the active-event filter; events count stays global.
      const scopedCars = activeCars();
      const scopedTasks = activeTasks();
      const arrived = scopedCars.filter(c => (c.status || '').toLowerCase().includes('sosit')).length;
      const openTasks = scopedTasks.filter(tk => !tk.is_completed).length;
      // Count-up on first render; on later renders animate from the previous
      // value to the new one only when it actually changed (no re-anim on polls).
      const setStat = (id, val) => {
        const n = el(id); if (!n) return;
        val = Number(val) || 0;
        const prev = n.dataset.val != null ? (parseInt(n.dataset.val, 10) || 0) : 0;
        n.dataset.val = String(val);
        if (!_statsAnimated) { countUp(n, val, 750, 0); return; }
        if (prev !== val) countUp(n, val, 500, prev); else n.textContent = val;
      };
      try { renderParkStrip(); } catch (_) {}
      setStat('statCars', scopedCars.length);
      setStat('statEvents', (events || state.events || []).length);
      setStat('statCarsConfirmed', arrived);
      setStat('statTasks', openTasks);
      _statsAnimated = true;
      try { renderTaskDonut(); } catch (_) {}

      // Meters: arrival rate (of all cars) and task-completion rate.
      const mArrived = el('meterArrived');
      if (mArrived) mArrived.style.width = (scopedCars.length ? Math.round(arrived / scopedCars.length * 100) : 0) + '%';
      const mTasks = el('meterTasks');
      if (mTasks) {
        const done = scopedTasks.length - openTasks;
        mTasks.style.width = (scopedTasks.length ? Math.round(done / scopedTasks.length * 100) : 0) + '%';
      }

      // Update labels in stats grid
      const statsGrid = document.querySelector('.stats-grid');
      if (statsGrid) {
        const labels = statsGrid.querySelectorAll('.stat-label');
        if (labels.length >= 4) {
          labels[0].textContent = t("home.cars_registered");
          labels[1].textContent = t("home.events_planned");
          labels[2].textContent = t("home.cars_arrived");
          labels[3].textContent = t("home.tasks_open");
        }
      }
    }

    // Parking, as four numbers on the home screen.
    //
    // The map has always known all of this and it lived only inside the map:
    // how many bays the plan has, how many are taken, and — the one that
    // actually decides whether the gate will work — how many cars are coming
    // with nowhere to stand. A number nobody opens a screen to read is a number
    // nobody acts on.
    function renderParkStrip() {
      const box = el('parkStrip');
      if (!box) return;
      const cars = activeCars();
      const total = (ZONE_SPOTS || []).length;
      if (!roleAtLeast('staff') || (!total && !cars.length)) { box.hidden = true; return; }
      const placed = cars.filter(c => c.spot_no != null && String(c.zone || '').trim() !== '').length;
      const free = Math.max(0, total - placed);
      const waiting = cars.length - placed;
      const cell = (n, label, kind) =>
        `<div class="park-cell${kind ? ' is-' + kind : ''}"><b>${n}</b><span>${escape(label)}</span></div>`;
      box.innerHTML =
        cell(total, t('park.total')) +
        cell(placed, t('park.taken')) +
        cell(free, t('park.free'), free ? 'ok' : 'warn') +
        cell(waiting, t('park.waiting'), waiting ? 'warn' : 'ok');
      box.hidden = false;
    }

    // The active event's cover photo, shown blurred + darkened behind the hero.
    function setHeroCover(url) {
      const cov = el('heroCover');
      if (!cov) return;
      const hero = cov.closest('.hero');
      if (url) { cov.style.backgroundImage = `url("${url}")`; if (hero) hero.classList.add('has-cover'); }
      else { cov.style.backgroundImage = ''; if (hero) hero.classList.remove('has-cover'); }
    }

    function renderHero(events) {
      let list = events || [];
      // If an event is selected in the header, feature it as the hero.
      if (state.activeEventId) {
        const sel = list.filter(e => String(e.id) === String(state.activeEventId));
        if (sel.length) list = sel;
      }
      const heroBadge = document.querySelector('.hero-badge');
      if (heroBadge) heroBadge.innerHTML = `<span class="dot"></span>${t("home.next_event")}`;
      const heroMetaLabel = document.querySelector('.hero-meta .l');
      if (heroMetaLabel) heroMetaLabel.textContent = t("home.days_left");

      const setRing = (daysLeft) => {
        const ring = el('heroRing');
        if (!ring) return;
        if (daysLeft == null || isNaN(daysLeft)) { ring.style.strokeDashoffset = '100'; return; }
        // Fills as the event approaches (30-day horizon): far = empty, day-of = full.
        const progress = Math.max(0, Math.min(1, (30 - Number(daysLeft)) / 30));
        ring.style.strokeDashoffset = String(Math.round((1 - progress) * 100));
      };

      if (!list.length) {
        el('heroTitle').textContent = t("common.nothing_found");
        el('heroSub').textContent = t("home.loading");
        el('heroDate').textContent = '';
        el('heroLocation').textContent = '';
        el('heroDays').textContent = '—';
        setRing(null);
        setHeroCover(null);
        startEventCountdown(null);
        return;
      }
      const e = list[0];
      setHeroCover(e.cover_url);
      const dl = eventDaysLeft(e);
      el('heroTitle').textContent = e.title || '—';
      el('heroSub').textContent = e.subtitle || '';
      el('heroDate').innerHTML = calendarIcon() + (e.date || '');
      el('heroLocation').innerHTML = pinIcon() + (e.location || '');
      el('heroDays').textContent = dl ?? '—';
      const hd = el('heroDays');
      if (hd) {
        hd.classList.remove('dl-soon', 'dl-urgent');
        if (dl != null && !isNaN(dl)) {
          if (dl <= 3) hd.classList.add('dl-urgent');
          else if (dl <= 7) hd.classList.add('dl-soon');
        }
      }
      setRing(dl);
      startEventCountdown(e);
    }

    // ----- Live countdown to the active event (#4) -----
    let _countdownTimer = null;
    function startEventCountdown(ev) {
      const box = el('heroCountdown');
      if (!box) return;
      if (_countdownTimer) { clearInterval(_countdownTimer); _countdownTimer = null; }
      const start = ev && ev.starts_at ? new Date(ev.starts_at) : null;
      if (!start || isNaN(start)) { box.hidden = true; box.innerHTML = ''; return; }
      const tick = () => {
        const ms = start.getTime() - Date.now();
        if (ms <= 0) {
          box.innerHTML = `<span class="cd-live"><span class="cd-dot"></span>${escape(t('countdown.live'))}</span>`;
          box.hidden = false;
          if (_countdownTimer) { clearInterval(_countdownTimer); _countdownTimer = null; }
          return;
        }
        const s = Math.floor(ms / 1000);
        const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600),
              m = Math.floor((s % 3600) / 60), sec = s % 60;
        const pad = (n) => String(n).padStart(2, '0');
        const seg = (v, lab) => `<span class="cd-seg"><b>${pad(v)}</b><i>${escape(lab)}</i></span>`;
        box.innerHTML =
          `<span class="cd-label">${escape(t('countdown.starts_in'))}</span>` +
          (d > 0 ? seg(d, t('countdown.d')) : '') +
          seg(h, t('countdown.h')) + seg(m, t('countdown.m')) + seg(sec, t('countdown.s'));
        box.hidden = false;
      };
      tick();
      _countdownTimer = setInterval(tick, 1000);
    }

    // ----- Team announcements (#7) -----
    const ANNOUNCE_DISMISS_KEY = 'kultura_announce_dismissed';
    function announceDismissed() {
      try { return JSON.parse(localStorage.getItem(ANNOUNCE_DISMISS_KEY) || '[]'); } catch (_) { return []; }
    }
    const megaphoneSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>';
    function renderHomeAnnounce() {
      const box = el('homeAnnounce');
      if (!box) return;
      const dismissed = announceDismissed();
      const a = (state.announcements || []).find(x => !dismissed.includes(x.id));
      if (!a) { box.innerHTML = ''; return; }
      box.innerHTML = `
        <div class="announce-banner">
          <div class="announce-ic">${megaphoneSvg}</div>
          <div class="announce-txt">
            <div class="announce-t">${escape(a.title)}</div>
            ${a.body ? `<div class="announce-b">${escape(a.body)}</div>` : ''}
          </div>
          <button class="announce-x" data-announce-dismiss="${a.id}" aria-label="×">&times;</button>
        </div>`;
    }
    function renderAnnounceRecent() {
      const box = el('announceRecent');
      if (!box) return;
      const list = (state.announcements || []).slice(0, 5);
      const admin = isAdmin();
      box.innerHTML = list.length ? list.map(a => `
        <div class="announce-item">
          <div class="announce-item-txt"><b>${escape(a.title)}</b>${a.body ? ' — ' + escape(a.body) : ''}
            <span class="announce-item-meta">${escape(fmtRelative(a.created_at))}</span></div>
          ${admin ? `<button class="announce-item-del" data-announce-del="${a.id}" aria-label="${escape(t('common.delete'))}">&times;</button>` : ''}
        </div>`).join('') : `<div style="padding:8px 0;color:var(--text-mute);font-size:12px;">${escape(t('announce.none'))}</div>`;
    }
    async function sendAnnouncement() {
      const tI = el('announceTitle'), bI = el('announceBody');
      if (!tI) return;
      const title = (tI.value || '').trim();
      if (!title) return;
      const body = (bI.value || '').trim() || null;
      const btn = el('announceSendBtn'); if (btn) btn.disabled = true;
      const { error } = await supa.from('announcements').insert({ title, body, created_by: currentUserEmail() });
      if (btn) btn.disabled = false;
      if (error) { uiAlert(t('common.error') + ': ' + error.message); return; }
      tI.value = ''; if (bI) bI.value = '';
      showToast(t('announce.sent'));
      await loadData();
    }
    el('announceSendBtn')?.addEventListener('click', sendAnnouncement);
    document.addEventListener('click', async (e) => {
      const dis = e.target.closest('[data-announce-dismiss]');
      if (dis) {
        const id = parseInt(dis.dataset.announceDismiss, 10);
        const d = announceDismissed(); if (!d.includes(id)) d.push(id);
        try { localStorage.setItem(ANNOUNCE_DISMISS_KEY, JSON.stringify(d.slice(-100))); } catch (_) {}
        renderHomeAnnounce();
        return;
      }
      const del = e.target.closest('[data-announce-del]');
      if (del) {
        const id = parseInt(del.dataset.announceDel, 10);
        if (!(await uiConfirm(t('announce.confirm_delete')))) return;
        const { error } = await supa.from('announcements').delete().eq('id', id);
        if (error) { uiAlert(t('common.error') + ': ' + error.message); return; }
        await loadData();
      }
    });

    // Days remaining until an event — computed live from starts_at (updates
    // every day on its own). Falls back to a stored days_left for old events.
    function eventDaysLeft(ev) {
      if (ev && ev.starts_at) {
        const start = new Date(ev.starts_at);
        if (!isNaN(start)) {
          const today = new Date(); today.setHours(0, 0, 0, 0);
          const d0 = new Date(start); d0.setHours(0, 0, 0, 0);
          return Math.max(0, Math.round((d0 - today) / 86400000));
        }
      }
      return (ev && ev.days_left != null) ? ev.days_left : null;
    }

    function calendarIcon() {
      return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> ';
    }
    function pinIcon() {
      return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> ';
    }

    function renderUpcoming(events) {
      let src = events || [];
      if (state.activeEventId) src = src.filter(e => String(e.id) === String(state.activeEventId));
      const list = src.slice(0, 4);
      const card = el('upcomingEventsCard');
      if (card) {
        const h3 = card.querySelector('h3');
        if (h3) h3.textContent = t("home.upcoming_events");
        const p = card.querySelector('p');
        if (p) p.textContent = t("home.upcoming_sub");
      }
      const c = el('upcomingEventsList');
      if (!list.length) return c.innerHTML = emptyState(t("common.nothing_found"));
      c.innerHTML = list.map(e => `
        <div class="row">
          <div class="row-icon blue">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
          <div class="row-body">
            <div class="row-title">${escape(e.title)}</div>
            <div class="row-sub">${escape(e.date || '')}${e.location ? '<span class="sep"></span>' + escape(e.location) : ''}</div>
          </div>
          <div class="badge ${statusToBadge(e.status)}">${escape(translateStatus(e.status, 'event'))}</div>
        </div>
      `).join('');
    }

    function renderTopTasks(tasks) {
      const list = activeTasks().filter(tk => !tk.is_completed).slice(0, 4);
      const card = el('topTasksCard');
      if (card) {
        const h3 = card.querySelector('h3');
        if (h3) h3.textContent = t("home.priority_tasks");
        const p = card.querySelector('p');
        if (p) p.textContent = t("home.priority_sub");
      }
      const c = el('topTasksList');
      if (!list.length) return c.innerHTML = emptyState(t("common.nothing_found"));
      c.innerHTML = list.map(tk => `
        <div class="row">
          <div class="row-icon ${statusToBadge(tk.status) === 'red' ? 'red' : statusToBadge(tk.status) === 'green' ? 'green' : 'orange'}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          </div>
          <div class="row-body">
            <div class="row-title">${escape(tk.title)}</div>
            <div class="row-sub">${escape(tk.event || tk.date || '')}</div>
          </div>
          <div class="badge ${statusToBadge(tk.status)}">${escape(translateStatus(tk.status, 'task'))}</div>
        </div>
      `).join('');
    }

    // Is a task assigned to me? (pre-assigned by email, or taken by uid/name)
    function isMyTask(tk) {
      if (!currentUser) return false;
      const myEmail = (currentUser.email || '').toLowerCase();
      const myName = currentUserName();
      return (tk.assigned_to && tk.assigned_to.toLowerCase() === myEmail)
        || (tk.assigned_user_id && String(tk.assigned_user_id) === String(currentUser.id))
        || (tk.assigned_user_name && tk.assigned_user_name === myName);
    }
    // Overdue = has a real deadline in the past and not completed.
    function isOverdue(tk) {
      return tk.due_at && !tk.is_completed && new Date(tk.due_at).getTime() < Date.now();
    }

    function renderMyTasks() {
      const c = el('myTasksList');
      if (!c) return;
      const list = activeTasks().filter(tk => !tk.is_completed && isMyTask(tk))
        .sort((a, b) => (a.due_at ? new Date(a.due_at) : Infinity) - (b.due_at ? new Date(b.due_at) : Infinity))
        .slice(0, 5);
      const card = el('myTasksCard');
      if (card) {
        const h3 = card.querySelector('h3'); if (h3) h3.textContent = t('home.my_tasks');
        const p = card.querySelector('p'); if (p) p.textContent = t('home.my_tasks_sub');
      }
      if (!list.length) return c.innerHTML = emptyState(t('home.my_tasks_empty'));
      c.innerHTML = list.map(tk => `
        <div class="row" data-open-task="${tk.id}" style="cursor:pointer;">
          <div class="row-icon ${isOverdue(tk) ? 'red' : 'orange'}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          </div>
          <div class="row-body">
            <div class="row-title">${escape(tk.title)}</div>
            <div class="row-sub">${escape(tk.date || tk.event || '')}</div>
          </div>
          ${isOverdue(tk) ? `<div class="badge red">${escape(t('task.overdue'))}</div>` : `<div class="badge ${statusToBadge(tk.status)}">${escape(translateStatus(tk.status, 'task'))}</div>`}
        </div>
      `).join('');
    }

    const EVENT_STATUS_OPTIONS = [
      { key: 'planificat', label: 'Planificat', color: '#10B981' },
      { key: 'curand',     label: 'În curând',  color: '#3B82F6' },
      { key: 'activ',      label: 'Activ',      color: '#8B5CF6' },
      { key: 'finalizat',  label: 'Finalizat',  color: '#64748B' }
    ];
    function eventStatusKey(status) {
      const s = (status || '').toLowerCase();
      if (s.includes('curând') || s.includes('curand')) return 'curand';
      if (s.includes('activ')) return 'activ';
      if (s.includes('finalizat')) return 'finalizat';
      if (s.includes('planificat')) return 'planificat';
      return null;
    }

    function filterEvents() {
      const q = state.eventsSearch.toLowerCase();
      return state.events.filter(e => {
        const status = eventStatusKey(e.status);
        // Archived events stay out of every list unless explicitly asked for —
        // that is the whole point of archiving.
        if (state.eventsFilter === 'archived') { if (!e.archived) return false; }
        else if (e.archived) return false;
        if (state.eventsFilter !== 'all' && state.eventsFilter !== 'archived' && state.eventsFilter !== status) return false;
        if (!q) return true;
        return (e.title || '').toLowerCase().includes(q) ||
               (e.subtitle || '').toLowerCase().includes(q) ||
               (e.location || '').toLowerCase().includes(q);
      });
    }

    function renderEventsChips() {
      const c = el('eventsChips');
      const live = state.events.filter(e => !e.archived);
      const nArchived = state.events.length - live.length;
      const counts = { all: live.length, archived: nArchived };
      EVENT_STATUS_OPTIONS.forEach(o => {
        counts[o.key] = live.filter(e => eventStatusKey(e.status) === o.key).length;
      });
      const chips = [
        { key: 'all', label: t('tasks.filter_all') },
        ...EVENT_STATUS_OPTIONS.map(o => ({ key: o.key, label: translateStatus(o.label, 'event') })),
        // Only offer the archive tab once something is actually in it.
        ...(nArchived ? [{ key: 'archived', label: t('event.archived') }] : []),
      ];
      c.innerHTML = chips.map(chip => `
        <button class="chip ${state.eventsFilter === chip.key ? 'active' : ''}"
                data-events-filter="${chip.key}">
          ${escape(chip.label)}
          <span class="count">· ${counts[chip.key] || 0}</span>
        </button>
      `).join('');
    }

    function renderEvents() {
      el('eventsCount').textContent = state.events.length;
      const list = filterEvents();
      const c = el('eventsList');
      if (!list.length) return c.innerHTML = '<div class="card">' + emptyState(t("common.nothing_found")) + '</div>';
      c.innerHTML = '<div class="page-grid-2">' + list.map(e => {
        const active = eventStatusKey(e.status);
        const buttons = EVENT_STATUS_OPTIONS.map(opt => `
          <button class="action-btn ${active === opt.key ? 'active-' + opt.key : ''}"
                  data-action="event-status"
                  data-event-id="${e.id}"
                  data-label="${escape(opt.label)}"
                  data-color="${opt.color}">${escape(translateStatus(opt.label, 'event'))}</button>
        `).join('');
        return `
          <div class="card">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
              <div style="flex:1;">
                <div style="font-size:18px;font-weight:900;letter-spacing:-0.3px;">${escape(e.title)}</div>
                ${e.subtitle ? `<div style="color:var(--text-dim);font-size:13px;margin-top:4px;">${escape(e.subtitle)}</div>` : ''}
                <div style="display:flex;gap:14px;margin-top:12px;font-size:12px;color:var(--text-dim);flex-wrap:wrap;">
                  <span style="display:inline-flex;align-items:center;gap:6px;">${calendarIcon()}${escape(e.date || '—')}</span>
                  ${e.location ? `<span style="display:inline-flex;align-items:center;gap:6px;">${pinIcon()}${escape(e.location)}</span>` : ''}
                </div>
              </div>
              <div style="text-align:right;">
                <div class="badge ${statusToBadge(e.status)}">${escape(translateStatus(e.status, 'event'))}</div>
                ${(() => { const d = eventDaysLeft(e); return d != null ? `<div style="margin-top:10px;color:var(--text-dim);font-size:11px;">${d} ${t("common.days")}</div>` : ''; })()}
              </div>
            </div>
            <div class="event-actions">
              ${buttons}
              ${roleAtLeast('staff') ? `
              <button class="action-btn" data-action="event-edit" data-event-id="${e.id}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                ${t("common.edit")}
              </button>` : ''}
              ${isAdmin() ? `
              <button class="action-btn" data-action="event-archive" data-event-id="${e.id}" data-archived="${e.archived ? '1' : ''}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="5" rx="1"/><path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9"/><line x1="10" y1="13" x2="14" y2="13"/></svg>
                ${escape(t(e.archived ? 'event.unarchive' : 'event.archive'))}
              </button>` : ''}
              ${isAdmin() ? `
              <button class="action-btn delete" data-action="event-delete" data-event-id="${e.id}" data-event-label="${escape(e.title)}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                ${t("common.delete")}
              </button>` : ''}
            </div>
          </div>
        `;
      }).join('') + '</div>';
    }
    // Add CSS entries for event status colors dynamically (uses same var pattern)
    (function addEventColors() {
      const style = document.createElement('style');
      style.textContent = `
        .action-btn.active-planificat { color: var(--green); border-color: rgba(16,185,129,0.4); background: rgba(16,185,129,0.12); }
        .action-btn.active-curand { color: var(--blue); border-color: rgba(59,130,246,0.4); background: rgba(59,130,246,0.12); }
        .action-btn.active-activ { color: var(--purple); border-color: rgba(139,92,246,0.4); background: rgba(139,92,246,0.12); }
        .action-btn.active-finalizat { color: var(--text-dim); border-color: rgba(148,163,184,0.4); background: rgba(148,163,184,0.12); }
        .action-btn.active-urgent { color: var(--red); border-color: rgba(239,68,68,0.4); background: rgba(239,68,68,0.12); }
        .action-btn.active-progres { color: var(--orange); border-color: rgba(245,158,11,0.4); background: rgba(245,158,11,0.12); }
      `;
      document.head.appendChild(style);
    })();

    // No 'plecat': in the whole life of the app not one car was ever checked
    // out — `left_at` is null on every row that has ever existed. The button
    // was a third state at the gate that nobody used and everybody had to read
    // past. `statusKey` still maps the word, so a restored backup or a
    // hand-edited row renders instead of falling over.
    const CAR_STATUS_OPTIONS = [
      { key: 'invitat', label: 'Invitat', color: '#3B82F6' },
      { key: 'sosit',   label: 'Sosit',   color: '#10B981' }
    ];

    function filterCars() {
      const q = state.carsSearch.toLowerCase();
      return activeCars().filter(car => {
        if (state.carsFilter === 'vip' && !car.is_vip) return false;
        if (state.carsFilter !== 'all' && state.carsFilter !== 'vip') {
          if (statusKey(car.status) !== state.carsFilter) return false;
        }
        if (!q) return true;
        // A bare number matches the entry number exactly — typing "47" should
        // find car #47, not every car with a 47 anywhere in its plate.
        if (/^#?\d+$/.test(q) && String(car.entry_no || '') === q.replace('#', '')) return true;
        return (car.model || '').toLowerCase().includes(q) ||
               (car.owner || '').toLowerCase().includes(q) ||
               (car.plate || '').toLowerCase().includes(q) ||
               (car.zone || '').toLowerCase().includes(q);
      });
    }

    function renderCarsChips() {
      // Counts must match the list underneath them — activeCars(), not the raw
      // table, or the chips advertise cars from other events that the list
      // then refuses to show.
      const scoped = activeCars();
      const total = scoped.length;
      const counts = {
        all: total,
        vip: scoped.filter(c => c.is_vip).length
      };
      CAR_STATUS_OPTIONS.forEach(o => {
        counts[o.key] = scoped.filter(c => statusKey(c.status) === o.key).length;
      });
      const chips = [
        { key: 'all', label: t('tasks.filter_all') },
        ...CAR_STATUS_OPTIONS.map(o => ({ key: o.key, label: translateStatus(o.label, 'car') })),
        { key: 'vip', label: 'VIP' }
      ];
      el('carsChips').innerHTML = chips.map(chip => `
        <button class="chip ${state.carsFilter === chip.key ? 'active' : ''}" data-cars-filter="${chip.key}">
          ${escape(chip.label)}
          <span class="count">· ${counts[chip.key] || 0}</span>
        </button>
      `).join('');
    }

    // Markup for one car row (also used by the chunked/windowed renderer).
    function carRowHtml(car) {
      const active = statusKey(car.status);
      const actionButtons = CAR_STATUS_OPTIONS.map(opt => {
        let label = opt.label;
        if (opt.key === 'invitat') label = t("car.status.invited");
        if (opt.key === 'sosit')   label = t("car.status.arrived");
        return `
            <button class="action-btn ${active === opt.key ? 'active-' + opt.key : ''}"
                    data-action="status"
                    data-car-id="${car.id}"
                    data-label="${escape(opt.label)}"
                    data-color="${opt.color}">
              ${escape(label)}
            </button>
          `;
      }).join('');
      const carName = [car.brand, car.model].filter(Boolean).join(' ') || car.model;
      const isNewToday = car.created_at && new Date(car.created_at).toDateString() === new Date().toDateString();
      const photo = _carPhotos && _carPhotos[car.id];
      // A blocked plate has to be obvious on the car itself, not only in the
      // registration queue it came through — by the time it is an approved car
      // nobody re-opens that queue.
      const blockReason = plateBlocked(car.plate);
      return `
          <div class="card car-row card-stripe stripe-${active || 'invitat'}${car.is_vip ? ' card-vip' : ''}${photo ? ' has-photo' : ''}${blockReason !== null ? ' is-blocked' : ''}" data-row-id="${car.id}" style="cursor:pointer; padding: 16px; margin-bottom: 0;${photo ? `--car-bg:url('${escape(photo)}');` : ''}">
            <div style="display:flex; align-items:flex-start; gap:12px;">
              <div class="row-icon blue" style="flex-shrink:0;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H5.24a2 2 0 0 0-1.8 1.1l-.8 1.63A6 6 0 0 0 2 12.42V16h2"/><circle cx="6.5" cy="16.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/></svg>
              </div>
              <div style="flex:1; min-width:0;">
                <div class="row-title" style="display:flex; align-items:center; flex-wrap:wrap; gap:6px;">
                  ${car.entry_no ? `<span class="entry-no" title="${escape(t('car.entry_no'))}">#${escape(String(car.entry_no))}</span>` : ''}
                  <span>${escape(carName)}</span>
                  ${car.is_vip ? '<span class="badge purple" style="font-size:8px; padding:2px 6px;">VIP</span>' : ''}
                  ${isNewToday ? `<span class="badge new-today">${escape(t('car.new_today'))}</span>` : ''}
                  ${blockReason !== null ? `<span class="block-badge" title="${escape(blockReason || '')}">⛔ ${escape(t('block.badge'))}</span>` : ''}
                  ${car.rsvp === 'no' ? `<span class="rsvp-badge is-no" title="${escape(t('car.rsvp_no'))}">${escape(t('car.rsvp_no_short'))}</span>` : ''}
                  ${car.rsvp === 'yes' ? `<span class="rsvp-badge is-yes" title="${escape(t('car.rsvp_yes'))}">✓</span>` : ''}
                </div>
                <div class="row-sub" style="margin-top:2px;">
                  <span style="color: var(--blue); font-weight: 700;">${escape(car.owner || '—')}</span>
                  ${car.plate ? '<span class="sep"></span><span>' + escape(car.plate) + '</span>' : ''}
                  <span class="sep"></span>
                  <span style="color: ${car.zone ? 'var(--purple)' : 'var(--text-mute)'}; opacity: ${car.zone ? '0.9' : '0.7'}; font-style: ${car.zone ? 'normal' : 'italic'};">
                    ${car.zone ? escape(car.zone) : 'Zona'}
                  </span>
                </div>
              </div>
              <div class="badge ${statusToBadge(car.status)}">${escape(translateStatus(car.status, 'car'))}</div>
            </div>
            <div class="car-actions" style="border-top: 1px solid rgba(255,255,255,0.05); padding-top: 10px; margin-top: 12px; display:flex; flex-wrap:wrap; gap:6px;">
              ${actionButtons}
            </div>
          </div>
        `;
    }

    // Render the car list in chunks: paint the first CARS_CHUNK rows immediately,
    // then append the rest as a sentinel scrolls into view. Keeps very long
    // lists cheap without recycling DOM (so swipe + detail keep working).
    const CARS_CHUNK = 60;
    let _carsIO = null;
    // Cache of car id → first photo (the list fetch is lean and omits photos),
    // used for a subtle background on car rows. Fetched once, refreshed when a
    // photo is added; invalidate by setting _carPhotos = null.
    let _carPhotos = null, _carPhotosLoading = false;
    function ensureCarPhotos() {
      if (_carPhotos || _carPhotosLoading || !navigator.onLine) return;
      _carPhotosLoading = true;
      supa.from('cars').select('id, photos').not('photos', 'is', null).then(({ data }) => {
        _carPhotos = {};
        (data || []).forEach(r => { const p = Array.isArray(r.photos) ? r.photos : []; if (p.length) _carPhotos[r.id] = p[0]; });
        _carPhotosLoading = false;
        try { renderCars(); } catch (_) {}
      }).catch(() => { _carPhotosLoading = false; });
    }
    function renderCars() {
      try { renderArrivalsWall(); } catch (_) {}
      ensureCarPhotos();
      el('carsCount').textContent = activeCars().length;
      const list = filterCars();
      const c = el('carsList');
      if (_carsIO) { _carsIO.disconnect(); _carsIO = null; }
      if (!list.length) return c.innerHTML = '<div class="card">' + emptyState(t("common.nothing_found")) + '</div>';
      c.innerHTML = '<div class="page-grid-2 content-in" id="carsInner"></div>';
      const inner = el('carsInner');
      const hasMore = list.length > CARS_CHUNK;
      inner.innerHTML = list.slice(0, CARS_CHUNK).map(carRowHtml).join('')
        + (hasMore ? '<div id="carsSentinel" style="grid-column:1/-1;height:1px;"></div>' : '');
      if (hasMore) {
        let idx = CARS_CHUNK;
        const sentinel = el('carsSentinel');
        _carsIO = new IntersectionObserver((entries) => {
          if (!entries[0].isIntersecting) return;
          const next = list.slice(idx, idx + CARS_CHUNK);
          sentinel.insertAdjacentHTML('beforebegin', next.map(carRowHtml).join(''));
          idx += CARS_CHUNK;
          if (idx >= list.length) { _carsIO.disconnect(); _carsIO = null; sentinel.remove(); }
        }, { rootMargin: '600px' });
        _carsIO.observe(sentinel);
      }
      try { renderDupBanner(); } catch (_) {}
    }

    // ----- Duplicate detector (staff) -----
    // Groups cars that share a normalized plate, or (plate-less) the same
    // owner name + phone. Lets an admin review and delete the extra copies.
    function findDuplicateCars() {
      const norm = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9А-ЯЁ]/gi, '');
      const digits = (s) => String(s || '').replace(/\D/g, '');
      const groups = new Map();
      for (const c of (state.cars || [])) {
        const p = norm(c.plate);
        let key = null;
        if (p.length >= 3) key = 'p:' + p;
        else {
          const o = (c.owner || '').trim().toLowerCase();
          if (o) key = 'n:' + o + '|' + digits(c.phone);
        }
        if (!key) continue;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(c);
      }
      return Array.from(groups.values()).filter(g => g.length > 1);
    }
    // Does a pending registration's plate already exist as a car (or another
    // registration)? Returns a short label describing the clash, or null.
    function regDuplicate(reg) {
      const norm = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9А-ЯЁ]/gi, '');
      const p = norm(reg && reg.plate);
      if (p.length < 3) return null;
      const car = (state.cars || []).find(c => norm(c.plate) === p);
      if (car) return t('regdup.in_cars', { name: (car.owner || [car.brand, car.model].filter(Boolean).join(' ') || car.plate || '') });
      const other = (state.registrations || []).find(x => String(x.id) !== String(reg.id) && norm(x.plate) === p);
      if (other) return t('regdup.in_regs');
      return null;
    }
    function renderDupBanner() {
      const b = el('dupBanner');
      if (!b) return;
      const groups = roleAtLeast('staff') ? findDuplicateCars() : [];
      if (!groups.length) { b.hidden = true; b.innerHTML = ''; return; }
      const extras = groups.reduce((s, g) => s + (g.length - 1), 0);
      b.hidden = false;
      b.innerHTML = `<span>⚠️ ${escape(t('dup.found', { n: extras }))}</span>
        <button class="btn small" id="dupOpenBtn" type="button">${escape(t('dup.review'))}</button>`;
    }
    function showDuplicates() {
      const box = el('dupList');
      if (!box) return;
      const groups = findDuplicateCars();
      if (!groups.length) { box.innerHTML = `<div class="dup-empty">${escape(t('dup.none'))}</div>`; return; }
      box.innerHTML = groups.map(g => {
        const rows = g.map((c, i) => {
          const name = (c.owner || '').trim() || [c.brand, c.model].filter(Boolean).join(' ') || '—';
          const sub = [c.plate, c.phone, [c.brand, c.model].filter(Boolean).join(' ')].filter(Boolean).join(' · ');
          return `<div class="dup-item">
            <div class="dup-item-txt"><strong>${escape(name)}</strong><span>${escape(sub)}</span></div>
            ${i === 0 ? `<span class="dup-keep">${escape(t('dup.keep'))}</span>`
                      : `<div class="dup-acts">
                           <button class="btn small" data-dup-merge="${c.id}" data-dup-into="${g[0].id}" type="button">${escape(t('dup.merge'))}</button>
                           <button class="btn danger small" data-dup-del="${c.id}" type="button">${escape(t('common.delete'))}</button>
                         </div>`}
          </div>`;
        }).join('');
        return `<div class="dup-group">${rows}</div>`;
      }).join('');
    }
    el('dupBanner')?.addEventListener('click', (e) => {
      if (e.target.closest('#dupOpenBtn')) { showDuplicates(); openModal('duplicates'); }
    });
    // Merge a duplicate into the primary (kept) row: fill the primary's empty
    // fields from the duplicate, union photos, then delete the duplicate.
    el('dupList')?.addEventListener('click', async (e) => {
      const m = e.target.closest('[data-dup-merge]');
      if (!m) return;
      const dupId = m.dataset.dupMerge, keepId = m.dataset.dupInto;
      if (!await uiConfirm(t('dup.confirm_merge'))) return;
      try {
        const { data: rows, error: fe } = await supa.from('cars').select('*').in('id', [keepId, dupId]);
        if (fe) throw fe;
        const keep = (rows || []).find(r => String(r.id) === String(keepId));
        const dup = (rows || []).find(r => String(r.id) === String(dupId));
        if (!keep || !dup) { showToast(t('common.error'), 'error'); return; }
        const patch = {};
        const isEmpty = (v) => v == null || (typeof v === 'string' && v.trim() === '');
        for (const k of Object.keys(dup)) {
          if (k === 'id' || k === 'created_at' || k === 'updated_at') continue;
          if (k === 'photos') continue;
          if (isEmpty(keep[k]) && !isEmpty(dup[k])) patch[k] = dup[k];
        }
        const kp = Array.isArray(keep.photos) ? keep.photos : [];
        const dp = Array.isArray(dup.photos) ? dup.photos : [];
        const merged = [...kp]; dp.forEach(u => { if (!merged.includes(u)) merged.push(u); });
        if (merged.length !== kp.length) patch.photos = merged;
        if (Object.keys(patch).length) {
          const { error: ue } = await supa.from('cars').update(patch).eq('id', keepId);
          if (ue) throw ue;
        }
        const { error: de } = await trashCars(dupId);
        if (de) throw de;
        await loadData();
        showDuplicates();
        try { renderCars(); } catch (_) {}
        showToast(t('dup.merged'));
      } catch (err) { showToast(t('common.error') + ': ' + (err.message || err), 'error'); }
    });
    el('dupList')?.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-dup-del]');
      if (!btn) return;
      const id = btn.dataset.dupDel;
      if (!await uiConfirm(t('dup.confirm_del'))) return;
      const { error } = await trashCars(id);
      if (error) { showToast(t('common.error') + ': ' + error.message, 'error'); return; }
      showDuplicates();
      try { renderCars(); } catch (_) {}
      showUndoToast(t('undo.car_deleted'), async () => {
        const res = await untrashCar(id);
        if (res.error) { showToast(t('common.error') + ': ' + res.error.message, 'error'); return; }
        await loadDataFull();
        showToast(t('undo.restored'));
      });
    });

    function renderTeam() {
      const q = (state.teamSearch || '').toLowerCase();
      const membersMap = new Map();

      if (currentUser) {
        const name = currentUserName();
        const meta = currentUser.user_metadata || {};
        membersMap.set(currentUser.email, {
          name: name === currentUser.email ? name.split('@')[0] : name,
          email: currentUser.email,
          role: meta.department ? localizeDept(meta.department) : 'Member'
        });
      }

      (state.profiles || []).forEach(p => {
        if (!p.email) return;
        const fallbackName = p.email.split('@')[0];
        const name = p.full_name || fallbackName;
        membersMap.set(p.email, {
          name: name,
          email: p.email,
          role: p.department ? localizeDept(p.department) : 'Member',
          sysRole: (p.role && ['admin','staff','member','gate'].includes(p.role)) ? p.role : (p.is_admin ? 'admin' : 'member'),
          avatar: p.avatar_url || null
        });
      });

      // Add users from Supabase Auth (if available)
      if (state.authUsers) {
        state.authUsers.forEach(u => {
          if (!u.email || membersMap.has(u.email)) return;
          const meta = u.user_metadata || {};
          const name = meta.full_name || u.email.split('@')[0];
          membersMap.set(u.email, {
            name: name,
            email: u.email,
            role: meta.department ? localizeDept(meta.department) : 'Member'
          });
        });
      }

      const members = Array.from(membersMap.values()).filter(m =>
        m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
      );

      const target = el('teamList');
      if (!target) return;
      el('teamCount').textContent = members.length;

      if (!members.length) {
        target.innerHTML = '<div class="card">' + emptyState(t("common.nothing_found")) + '</div>';
        return;
      }

      target.innerHTML = '<div class="team-grid">' + members.map(m => {
        const initials = m.name.substring(0, 2).toUpperCase();
        const isMe = currentUser && m.email === currentUser.email;
        const admin = isAdmin();

        const canInteract = admin;
        const attrs = canInteract ? `data-modal="edit-profile" data-edit-email="${escape(m.email)}" data-edit-name="${escape(m.name)}" style="cursor:pointer;"` : '';

        const roleBadge = m.sysRole === 'admin'
          ? `<span class="role-badge admin">${escape(t('role.admin'))}</span>`
          : m.sysRole === 'staff'
            ? `<span class="role-badge staff">${escape(t('role.staff'))}</span>`
            : m.sysRole === 'gate'
              ? `<span class="role-badge gate">${escape(t('role.gate'))}</span>`
              : '';
        return `
          <div class="team-card" ${attrs}>
            <div class="team-avatar"${m.avatar ? '' : ` style="${avatarBg(m.name)}"`}>${m.avatar ? `<img src="${escape(m.avatar)}" alt="" loading="lazy">` : escape(twoInitials(m.name))}</div>
            <div class="team-info">
              <div class="team-name">${escape(m.name)} ${isMe ? '<span style="font-size:10px; opacity:0.6; font-weight:normal;">(Tu)</span>' : ''} ${roleBadge}</div>
              <div class="team-role">${escape(m.role)} • ${escape(m.email)}</div>
            </div>
          </div>
        `;
      }).join('') + '</div>';

      renderWorkload(membersMap);
    }

    // Per-member task workload: in-progress (assigned) + completed, with a
    // completion-rate bar. Respects the active-event filter.
    function renderWorkload(membersMap) {
      const panel = el('workloadPanel');
      if (!panel) return;
      const tasks = activeTasks();
      const stat = new Map(); // name → { inProgress, done, avatar }
      const bump = (name, key) => {
        if (!name) return;
        if (!stat.has(name)) stat.set(name, { inProgress: 0, done: 0, avatar: null });
        stat.get(name)[key]++;
      };
      tasks.forEach(tk => {
        if (tk.is_completed) bump(tk.completed_by_user_name, 'done');
        else if (tk.assigned_user_name) bump(tk.assigned_user_name, 'inProgress');
      });
      // Attach avatars where we can match by display name.
      if (membersMap) {
        for (const m of membersMap.values()) {
          if (stat.has(m.name) && m.avatar) stat.get(m.name).avatar = m.avatar;
        }
      }
      const rows = [...stat.entries()]
        .map(([name, s]) => ({ name, ...s, total: s.inProgress + s.done }))
        .filter(r => r.total > 0)
        .sort((a, b) => b.total - a.total);
      if (!rows.length) {
        panel.innerHTML = `<div class="card">${emptyState(t('team.workload.empty'))}</div>`;
        return;
      }
      panel.innerHTML = '<div class="workload-list">' + rows.map(r => {
        const rate = r.total ? Math.round((r.done / r.total) * 100) : 0;
        const initials = r.name.substring(0, 2).toUpperCase();
        return `<div class="workload-row">
          <div class="workload-avatar"${r.avatar ? '' : ` style="${avatarBg(r.name)}"`}>${r.avatar ? `<img src="${escape(r.avatar)}" alt="" loading="lazy">` : escape(twoInitials(r.name))}</div>
          <div class="workload-info">
            <div class="workload-name">${escape(r.name)}</div>
            <div class="workload-bar"><span style="width:${rate}%"></span></div>
            <div class="workload-stats">
              <span>${r.inProgress} ${escape(t('team.workload.inprogress'))}</span>
              <span>${r.done} ${escape(t('team.workload.done'))}</span>
              <span>${rate}%</span>
            </div>
          </div>
          <div class="workload-badge"><div class="num">${r.total}</div><div class="lbl">total</div></div>
        </div>`;
      }).join('') + '</div>';
    }

    // Delegate clicks — cars/tasks/events actions
    document.addEventListener('click', async (ev) => {
      const btn = ev.target.closest('.action-btn, .tk-btn[data-action]');
      if (!btn || btn.classList.contains('loading')) return;
      // Stop propagation immediately so parent card row doesn't open detail
      ev.stopPropagation();
      const action = btn.dataset.action;

      const withSpinner = async (fn) => {
        const row = btn.closest('.tk-card, .car-row, .task-row, .card');
        row?.querySelectorAll('.action-btn, .tk-btn').forEach(b => b.disabled = true);
        btn.classList.add('loading');
        const old = btn.innerHTML;
        btn.innerHTML = '<span class="mini-spin"></span>';
        try { return await fn(); }
        finally {
          btn.classList.remove('loading');
          btn.innerHTML = old;
          row?.querySelectorAll('.action-btn, .tk-btn').forEach(b => b.disabled = false);
        }
      };

      // --- CARS ---
      if (action === 'status') {
        const id = btn.dataset.carId, label = btn.dataset.label, color = btn.dataset.color;
        const patch = { status: label, status_color: color };
        if (!navigator.onLine) {
          // Same treatment the gate has had for a while: show it now, send it
          // when there is signal.
          enqueueAction({ type: 'car-update', carId: id, patch });
          applyLocalCarPatch(id, patch);
          renderOfflineBar();
          showToast(t('offline.queued'));
          return;
        }
        const { error } = await withSpinner(() => supa.from('cars').update(patch).eq('id', id));
        if (error) return uiAlert('Eroare: ' + error.message);
        await loadData();
      } else if (action === 'delete') {
        const id = btn.dataset.carId, label = btn.dataset.carLabel || 'mașina';
        if (!await uiConfirm(`Șterge "${label}"?`, { okLabel: t('common.delete') })) return;
        const { error } = await withSpinner(() => trashCars(id).then(r => ({ error: r.error })));
        if (error) return uiAlert(t('common.error') + ': ' + error.message);
        await loadData();
        offerUndoRestore(id, label);

      // --- TASKS ---
      } else if (action === 'task-take') {
        await withSpinner(() => apiTaskTake(btn.dataset.taskId));
        await loadData();

      } else if (action === 'task-finish') {
        if (await uiConfirm(t('task.detail.confirm_finish'))) {
          await withSpinner(() => apiTaskComplete(btn.dataset.taskId));
          await loadData();
        }

      } else if (action === 'task-reopen') {
        await withSpinner(() => apiTaskReopen(btn.dataset.taskId));
        await loadData();

      } else if (action === 'task-release') {
        if (await uiConfirm('Vrei să eliberezi acest task? Statusul va reveni la "Disponibil".')) {
          await withSpinner(() => apiTaskReopen(btn.dataset.taskId));
          await loadData();
        }

      } else if (action === 'task-delete') {
        if (await withSpinner(() => apiTaskDelete(btn.dataset.taskId, btn.dataset.taskLabel))) {
          await loadData();
        }

      // --- EVENTS ---
      } else if (action === 'event-status') {
        const id = btn.dataset.eventId, label = btn.dataset.label, color = btn.dataset.color;
        const { error } = await withSpinner(() => supa.from('events').update({ status: label, status_color: color }).eq('id', id));
        if (error) return uiAlert('Eroare: ' + error.message);
        await loadData();
      } else if (action === 'event-archive') {
        // Archiving is reversible and touches nothing else — the event's cars,
        // stats and reports stay exactly as they are, just out of the way.
        const id = btn.dataset.eventId;
        const nowArchived = !btn.dataset.archived;
        const { error } = await withSpinner(() => supa.from('events').update({ archived: nowArchived }).eq('id', id));
        if (error) return uiAlert(writeErrorText(error));
        await loadData();
        showToast(t(nowArchived ? 'event.archived_toast' : 'event.unarchived_toast'));
      } else if (action === 'event-delete') {
        const id = btn.dataset.eventId, label = btn.dataset.eventLabel || 'evenimentul';
        if (!await uiConfirm(`Șterge "${label}"?\nAcțiune ireversibilă.`)) return;
        const { error } = await withSpinner(() => supa.from('events').delete().eq('id', id));
        if (error) return uiAlert('Eroare: ' + error.message);
        await loadData();
      } else if (action === 'event-edit') {
        const id = btn.dataset.eventId;
        const ev = (state.events || []).find(x => String(x.id) === String(id));
        if (!ev) return;
        editingEventId = ev.id;
        const f = el('form-add-event');
        f.title.value = ev.title || '';
        f.subtitle.value = ev.subtitle || '';
        f.location.value = ev.location || '';
        f.date.value = ev.date || '';
        f.status.value = ev.status || 'Planificat';
        if (f.reg_capacity) f.reg_capacity.value = ev.reg_capacity || '';
        if (f.waiver_text) f.waiver_text.value = ev.waiver_text || '';
        if (f.entries_frozen) f.entries_frozen.checked = !!ev.entries_frozen;
        if (f.is_sandbox) f.is_sandbox.checked = !!ev.is_sandbox;
        if (ev.starts_at) {
          const d = new Date(ev.starts_at);
          f.starts_at.value = isNaN(d) ? '' : new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
        } else { f.starts_at.value = ''; f.starts_at.required = false; }
        try { setEventCover(ev.cover_url || ''); } catch (_) {}
        const h = el('addEventTitle'); if (h) h.textContent = t('events.edit_title');
        openModal('add-event');
      }
    });

    // Chips filter — cars/tasks/events
    document.addEventListener('click', (ev) => {
      const cc = ev.target.closest('[data-cars-filter]');
      if (cc) { state.carsFilter = cc.dataset.carsFilter; renderCarsChips(); renderCars(); return; }
      const tc = ev.target.closest('[data-tasks-filter]');
      if (tc) { state.tasksFilter = tc.dataset.tasksFilter; renderTasksChips(); renderTasks(); return; }
      const tp = ev.target.closest('[data-tasks-preset]');
      if (tp) {
        state.tasksPreset = tp.dataset.tasksPreset || 'all';
        try { localStorage.setItem('kultura_tasks_preset', state.tasksPreset); } catch (_) {}
        renderTasksViewChips(); renderTasks(); return;
      }
      const td = ev.target.closest('[data-tasks-dept]');
      if (td) { state.tasksDept = td.dataset.tasksDept; renderTasksDeptChips(); renderTasks(); return; }
      const ec = ev.target.closest('[data-events-filter]');
      if (ec) { state.eventsFilter = ec.dataset.eventsFilter; renderEventsChips(); renderEvents(); return; }
      // Department editor (Settings, admin) — delete one.
      const dd = ev.target.closest('[data-dept-del]');
      if (dd) {
        const idx = parseInt(dd.dataset.deptDel, 10);
        const next = DEPARTMENTS.slice();
        next.splice(idx, 1);
        saveDepartments(next);
        return;
      }
      // Zone capacity editor (Map, admin) — delete one.
      const zd = ev.target.closest('[data-zonecfg-del]');
      if (zd) {
        const idx = parseInt(zd.dataset.zonecfgDel, 10);
        const next = ZONE_CONFIG.slice();
        next.splice(idx, 1);
        saveZoneConfig(next);
        return;
      }
    });

    // Zone capacity editor — add a zone.
    (function wireZoneCfgEditor() {
      const nameI = el('zoneCfgName'), capI = el('zoneCfgCap'), btn = el('zoneCfgAddBtn');
      if (!btn) return;
      const add = () => {
        const name = (nameI.value || '').trim();
        const cap = Math.max(1, parseInt(capI.value, 10) || 0);
        if (!name || !cap) return;
        const next = ZONE_CONFIG.filter(z => z.name.trim().toLowerCase() !== name.toLowerCase());
        next.push({ name, capacity: cap });
        next.sort((a, b) => a.name.localeCompare(b.name, 'ro'));
        nameI.value = ''; capI.value = '';
        saveZoneConfig(next);
      };
      btn.addEventListener('click', add);
      capI.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
    })();

    // Department editor — add a new department from the input.
    (function wireDeptEditor() {
      const input = el('deptAddInput');
      const btn = el('deptAddBtn');
      if (!input || !btn) return;
      const add = () => {
        const name = input.value.trim();
        if (!name) return;
        if (DEPARTMENTS.some(d => d.toLowerCase() === name.toLowerCase())) {
          showToast(t('dept.exists'), 'error');
          return;
        }
        input.value = '';
        saveDepartments([...DEPARTMENTS, name]);
      };
      btn.addEventListener('click', add);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
    })();

    // Search inputs — debounced so filtering runs ~150ms after typing stops
    // (no per-keystroke re-render lag on large lists).
    const _searchTimers = {};
    ['cars', 'tasks', 'events', 'team'].forEach(k => {
      const input = el(k + 'Search');
      if (!input) return;
      const render = { cars: renderCars, tasks: renderTasks, events: renderEvents, team: renderTeam }[k];
      input.addEventListener('input', (e) => {
        state[k + 'Search'] = e.target.value;
        clearTimeout(_searchTimers[k]);
        _searchTimers[k] = setTimeout(render, 150);
      });
    });

    // ----- Pull-to-refresh (mobile) -----
    (function initPullRefresh() {
      let startY = 0, pulling = false, dist = 0, ind = null;
      const TRIGGER = 80;
      function indicator() {
        if (ind) return ind;
        ind = document.createElement('div');
        ind.className = 'ptr-ind';
        ind.innerHTML = '<div class="ptr-spinner"></div>';
        document.body.appendChild(ind);
        return ind;
      }
      document.addEventListener('touchstart', (e) => {
        if (window.scrollY > 0) return;
        if (!el('appView') || !el('appView').classList.contains('show')) return;
        if (e.target.closest('.modal-backdrop, .photo-lightbox, .kanban-board')) return;
        startY = e.touches[0].clientY; pulling = true; dist = 0;
      }, { passive: true });
      document.addEventListener('touchmove', (e) => {
        if (!pulling) return;
        dist = e.touches[0].clientY - startY;
        if (dist <= 0 || window.scrollY > 0) { pulling = false; if (ind) ind.style.transform = ''; return; }
        const d = Math.min(100, dist * 0.5);
        const i = indicator();
        i.style.transform = `translateX(-50%) translateY(${d}px)`;
        i.classList.toggle('ready', dist >= TRIGGER);
      }, { passive: true });
      document.addEventListener('touchend', () => {
        if (!pulling) return; pulling = false;
        if (!ind) return;
        if (dist >= TRIGGER) {
          ind.classList.remove('ready');
          ind.classList.add('spinning');
          ind.style.transform = 'translateX(-50%) translateY(56px)';
          try { haptic(20); } catch (_) {}
          Promise.resolve(loadDataFull()).catch(() => {}).finally(() => {
            setTimeout(() => { ind.classList.remove('spinning'); ind.style.transform = ''; }, 500);
          });
        } else {
          ind.style.transform = ''; ind.classList.remove('ready');
        }
      }, { passive: true });
    })();

    // ----- Bottom-sheet modals: swipe down to dismiss (mobile, non-detail) -----
    (function initSheetDismiss() {
      let m = null, y0 = 0, dy = 0, active = false;
      document.addEventListener('touchstart', (e) => {
        if (!window.matchMedia('(max-width: 700px)').matches) return;
        const modal = e.target.closest('.modal');
        if (!modal || modal.classList.contains('detail')) return;
        const bd = modal.closest('.modal-backdrop');
        if (!bd || !bd.classList.contains('show')) return;
        if (modal.scrollTop > 0) return;
        if (e.target.closest('input, textarea, select, button, a, .action-btn')) return;
        m = modal; y0 = e.touches[0].clientY; dy = 0; active = true;
      }, { passive: true });
      document.addEventListener('touchmove', (e) => {
        if (!active || !m) return;
        dy = e.touches[0].clientY - y0;
        if (dy <= 0) { m.style.transform = ''; return; }
        m.style.transform = `translateY(${dy}px)`;
        m.style.transition = 'none';
      }, { passive: true });
      document.addEventListener('touchend', () => {
        if (!active || !m) return;
        const modal = m, d = dy; active = false; m = null;
        modal.style.transition = 'transform 0.25s ease';
        if (d > 120) {
          modal.style.transform = 'translateY(100%)';
          const bd = modal.closest('.modal-backdrop');
          setTimeout(() => { modal.style.transform = ''; modal.style.transition = ''; if (bd) closeModal(bd); }, 220);
        } else {
          modal.style.transform = '';
        }
      }, { passive: true });
    })();

    // Modal open/close
    function openModal(name) {
      const m = document.getElementById('modal-' + name);
      if (!m) return;
      // Populate any [data-populate="events"] selects inside this modal with
      // the current events list, preserving the "no event" placeholder option.
      m.querySelectorAll('select[data-populate="events"]').forEach(sel => {
        const currentVal = sel.value;
        // Drop everything except the first (placeholder) option
        while (sel.options.length > 1) sel.remove(1);
        (state.events || []).forEach(ev => {
          const opt = document.createElement('option');
          opt.value = ev.id;
          opt.textContent = ev.title || ('#' + ev.id);
          sel.appendChild(opt);
        });
        // Preselect the event in focus so anything created here lands on it
        // without the operator having to remember. Still a visible dropdown,
        // so it can be changed — the default is a convenience, not a lock.
        // An existing value (editing) always wins.
        if (currentVal) sel.value = currentVal;
        else if (state.activeEventId
                 && [...sel.options].some(o => o.value === String(state.activeEventId))) {
          sel.value = String(state.activeEventId);
        }
      });
      // Populate [data-populate="members"] selects with the team (by email).
      m.querySelectorAll('select[data-populate="members"]').forEach(sel => {
        const currentVal = sel.value;
        while (sel.options.length > 1) sel.remove(1);
        const seen = new Set();
        (state.profiles || []).forEach(p => {
          if (!p.email || seen.has(p.email)) return;
          seen.add(p.email);
          const opt = document.createElement('option');
          opt.value = p.email;
          opt.textContent = p.full_name || p.email.split('@')[0];
          sel.appendChild(opt);
        });
        if (currentVal) sel.value = currentVal;
      });
      // Populate [data-populate="departments"] selects with the current list.
      m.querySelectorAll('select[data-populate="departments"]').forEach(sel => {
        const currentVal = sel.value;
        while (sel.options.length > 1) sel.remove(1);
        DEPARTMENTS.forEach(d => {
          const opt = document.createElement('option');
          opt.value = d;
          opt.textContent = localizeDept(d);
          sel.appendChild(opt);
        });
        if (currentVal) sel.value = currentVal;
      });
      m.classList.add('show');
      // Accessibility: remember what was focused, then focus the first control.
      _lastFocusedBeforeModal = document.activeElement;
      const firstField = m.querySelector('input:not([type=hidden]):not([disabled]), textarea, select, button:not([data-close])');
      if (firstField) setTimeout(() => { try { firstField.focus(); } catch (_) {} }, 40);
    }
    function closeModal(m) {
      m.classList.remove('show');
      const form = m.querySelector('form');
      if (form) form.reset();
      const msg = m.querySelector('.modal-msg');
      if (msg) msg.classList.remove('show');
      // Restore focus to whatever opened the modal.
      if (_lastFocusedBeforeModal && document.contains(_lastFocusedBeforeModal)) {
        try { _lastFocusedBeforeModal.focus(); } catch (_) {}
      }
      _lastFocusedBeforeModal = null;
    }
    let _lastFocusedBeforeModal = null;
    let userBeingEdited = null;
    let editingEventId = null;
    // Primary admin — role is locked (also enforced by a DB trigger).
    const PRIMARY_ADMIN_EMAIL = 'igor.gratii.99@mail.ru';

    document.addEventListener('click', (ev) => {
      const opener = ev.target.closest('[data-modal]');
      if (opener) {
        const modalName = opener.dataset.modal;
        // Opening the event modal via the "Add" button = fresh insert.
        if (modalName === 'add-event') {
          editingEventId = null;
          const f = el('form-add-event'); if (f) { f.reset(); f.starts_at.required = true; }
          try { setEventCover(''); } catch (_) {}
          const h = el('addEventTitle'); if (h) h.textContent = t('events.add_title');
        }
        if (modalName === 'edit-profile') {
          userBeingEdited = opener.dataset.editEmail || currentUser?.email;
          const userName = opener.dataset.editName || 'Profilul meu';
          const titleEl = document.querySelector('#modal-edit-profile h2');
          if (titleEl) titleEl.textContent = userBeingEdited === currentUser?.email ? t('modal.profile.title') : userName;

          // Restricted logic: Show delete button and allow editing ONLY if it's "Me" or "Admin"
          const isMe = userBeingEdited === currentUser?.email;
          // Admin check now backed by profiles.is_admin (no more hardcoded email).
          const admin = isAdmin();

          const deleteBtn = el('deleteProfileBtn');
          if (deleteBtn) {
            // Show delete button only if you are Admin and editing SOMEONE ELSE
            deleteBtn.style.display = (admin && !isMe) ? 'block' : 'none';
          }

          // Role selector: visible only to admins; preselect the target's role.
          const roleField = el('profileRoleField');
          if (roleField) {
            roleField.style.display = admin ? 'block' : 'none';
            if (admin) {
              const tp = (state.profiles || []).find(p => (p.email || '').toLowerCase() === (userBeingEdited || '').toLowerCase());
              el('profileRoleSelect').value = (tp && tp.role) ? tp.role : (tp && tp.is_admin ? 'admin' : 'member');
            }
          }

          // Disable form if not allowed to edit
          const form = el('form-edit-profile');
          if (form) {
            const canEdit = isMe || admin;
            form.querySelectorAll('input, select, button[type="submit"]').forEach(ctrl => {
              ctrl.disabled = !canEdit;
            });
          }

          // The primary admin's role is locked: disable the selector and hide
          // the delete button, no matter who is viewing. (DB enforces it too.)
          const isPrimary = (userBeingEdited || '').toLowerCase() === PRIMARY_ADMIN_EMAIL;
          if (isPrimary) {
            el('profileRoleSelect').disabled = true;
            if (deleteBtn) deleteBtn.style.display = 'none';
          }

          // Preselect the target's department (openModal rebuilds the options
          // but preserves the value we set here).
          const targetProf = (state.profiles || []).find(p => (p.email || '').toLowerCase() === (userBeingEdited || '').toLowerCase());
          const deptSel = el('profileDeptSelect');
          if (deptSel) deptSel.value = isMe ? ((currentUser?.user_metadata || {}).department || (targetProf?.department || '')) : (targetProf?.department || '');
        }
        openModal(modalName);
        return;
      }
      if (ev.target.matches('.modal-backdrop')) { closeModal(ev.target); return; }
      const closeBtn = ev.target.closest('[data-close]');
      if (closeBtn) { closeModal(closeBtn.closest('.modal-backdrop')); return; }
    });

    // Lazy loader for the vendored SheetJS bundle — only pulled in when the
    // user actually imports/exports Excel, keeping first paint light.
    let _xlsxLoading = null;
    function ensureXLSX() {
      if (window.XLSX) return Promise.resolve(window.XLSX);
      if (_xlsxLoading) return _xlsxLoading;
      _xlsxLoading = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'vendor/xlsx.full.min.js';
        s.onload = () => resolve(window.XLSX);
        s.onerror = () => { _xlsxLoading = null; reject(new Error('Nu s-a putut încărca biblioteca Excel.')); };
        document.head.appendChild(s);
      });
      return _xlsxLoading;
    }

    // AI Import button handler
    el('aiImportBtn').addEventListener('click', () => {
      openModal('ai-import');
      el('aiImportStatus').textContent = 'Așteptare fișier...';
      el('aiImportStatus').style.color = 'var(--text-dim)';
      el('aiImportPreview').innerHTML = '';
      el('aiImportFile').value = '';
      el('aiImportFileSection').style.display = 'block';
      el('aiImportPreviewSection').style.display = 'none';
      el('aiImportProcessBtn').style.display = 'inline-block';
      el('aiImportProcessBtn').textContent = 'Selectează Fișier';
      el('aiImportProcessBtn').disabled = false;
      el('aiImportConfirmBtn').style.display = 'none';
      window.pendingCars = [];
    });

    // Auto-process when file is selected
    el('aiImportFile').addEventListener('change', () => {
      if (el('aiImportFile').files.length > 0) {
        el('aiImportProcessBtn').click();
      }
    });

    // AI Import process - select and parse file
    el('aiImportProcessBtn').addEventListener('click', async () => {
      const fileInput = el('aiImportFile');
      const statusDiv = el('aiImportStatus');
      const file = fileInput.files[0];

      if (!file) {
        statusDiv.textContent = 'Te rog selectează un fișier.';
        statusDiv.style.color = 'var(--red)';
        return;
      }

      statusDiv.textContent = 'Se citește fișierul...';
      statusDiv.style.color = 'var(--text-dim)';
      el('aiImportProcessBtn').disabled = true;

      try {
        let text = '';
        if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
          const XLSX = await ensureXLSX();
          const data = await file.arrayBuffer();
          const workbook = XLSX.read(data);
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          text = XLSX.utils.sheet_to_csv(sheet);
        } else {
          text = await file.text();
        }

        statusDiv.textContent = 'AI analizează datele...';
        el('aiProgressBarContainer').style.display = 'block';
        el('aiProgressBar').style.width = '0%';

        const lines = text.split('\n').filter(l => l.trim().length > 3);
        const chunkSize = 25; // Process 25 rows at a time
        const totalChunks = Math.ceil(lines.length / chunkSize);
        let allExtractedCars = [];

        for (let i = 0; i < totalChunks; i++) {
          const progress = Math.round((i / totalChunks) * 100);
          statusDiv.textContent = `AI analizează datele: ${progress}% (Lot ${i+1}/${totalChunks})...`;
          el('aiProgressBar').style.width = `${progress}%`;

          const start = i * chunkSize;
          const chunk = lines.slice(start, start + chunkSize).join('\n');

          const prompt = `
            Extract car details from the following text and return a JSON object with a "cars" key containing an array of car objects.
            Fields for each car object:
            - model (string)
            - owner (string - full name of the person)
            - plate (string - VEHICLE LICENSE PLATE / NUMĂR DE ÎNMATRICULARE)
            - zone (string - parking zone if mentioned)
            - status (string: "Invitat", "Sosit", or "În așteptare")
            - status_color (string: HEX, e.g., #3B82F6 for Invitat, #10B981 for Sosit)
            - is_vip (boolean - true if mentioned as VIP or special guest)
            - phone (string - PERSONAL PHONE NUMBER / NUMĂR DE TELEFON)
            - email (string)
            - brand (string - manufacturer, e.g. "BMW", "Audi", "Toyota")
            - city (string)
            - year (number - manufacturing year, e.g. 2005, 2018; digits only)
            - category (string - car category/class, e.g. "Stance", "JDM", "Retro", "Super Cars", "Modern")
            - telegram (string - Telegram username/handle, may start with "@")
            - modifications (string - technical details / modifications / tuning)
            - responsible_person (string - organizer or person in charge)
            - transport_info (string - transport / trailer / platform info)
            - social_links (string - social media links or handles: Instagram, Facebook, TikTok)
            - event (string - event name if mentioned)

            COLUMN / LABEL HINTS — recognize these headers in the source. Headers may be in Romanian, English OR RUSSIAN (Cyrillic). Match case-insensitively and ignore punctuation.
            - Plate column labels: "placă", "placa", "placuță", "placuta", "nr. înmatriculare", "nr inmatriculare", "număr de înmatriculare", "matriculă", "matricula", "plate", "license plate", "reg. no", | RUSSIAN: "номерной знак", "номерной", "гос номер", "гос. номер", "госномер", "номер авто", "номер машины", "рег номер", "рег. номер", "номер" (a Russian plate header like "номерной знак" ALWAYS maps to plate, never to phone)
            - Phone column labels: "telefon", "nr. telefon", "număr de telefon", "contact", "phone", "mobile", "gsm", | RUSSIAN: "телефон", "номер телефона", "тел", "тел.", "моб", "мобильный", "контакт"
            - Owner (person name) labels: "proprietar", "nume", "prenume", "nume complet", "owner", "name", "participant", | RUSSIAN: "имя", "фамилия", "фио", "имя фамилия", "участник", "владелец", "водитель", "пилот", "полное имя"
            - Brand labels: "marcă", "marca", "brand", "make", | RUSSIAN: "марка", "производитель"
            - Model labels: "model", "modelul", | RUSSIAN: "модель", "машина", "авто"
            - City labels: "oraș", "oras", "localitate", "city", | RUSSIAN: "город", "нас пункт", "населённый пункт"
            - Zone labels: "zonă", "zona", "parcare", "zone", | RUSSIAN: "зона", "парковка", "сектор"
            - Year column labels: "an", "an fabricație", "an fabricatie", "anul", "year", | RUSSIAN: "год", "год выпуска"
            - Category column labels: "categorie", "categoria", "clasă", "clasa", "category", "class", | RUSSIAN: "класс", "категория"
            - Telegram column labels: "telegram", "тг", "@username", | RUSSIAN: "телеграм", "телеграмм"
            - Modifications column labels: "modificări", "modificari", "detalii tehnice", "tuning", "modifications", | RUSSIAN: "модификации", "тюнинг", "доработки"
            - Responsible person labels: "responsabil", "persoană responsabilă", "persoana responsabila", "organizare", "organizator", "responsible", "organizer", | RUSSIAN: "ответственный", "организатор"
            - Transport labels: "transport", "platformă", "platforma", "remorcă", "remorca", "trailer", "platform", | RUSSIAN: "транспорт", "платформа", "прицеп", "эвакуатор"
            - Social links labels: "rețele sociale", "retele sociale", "social", "instagram", "facebook", "tiktok", | RUSSIAN: "соцсети", "социальные сети"
            - Email column labels: "email", "e-mail", "mail", | RUSSIAN: "почта", "электронная почта"
            - If the source has TABULAR data (Excel/CSV rows), match values to columns by header. Do NOT mix a phone column into the plate field.

            PLATE FORMATS to look for (short alphanumeric, mixing letters + digits, usually 5-9 chars):
            - Moldova: "CE 007", "MD IE 442", "CE PT 442", "IE MD 123", "AB CD 123"
            - Romania: "B 123 ABC", "CJ 05 XYZ", "MM 12 ABC", "IF 01 AAA"
            - Generic Europe: "AA 123 BB", "1234 ABC"

            PHONE FORMATS to look for (7+ digits, may have +, spaces, dashes):
            - "+373 79 123 456", "079 123 456", "079-123-456", "0712345678", "+40 712 345 678"

            CRITICAL FIELD SEPARATION — do NOT swap these two:
            - "plate" MUST be a vehicle license plate. It contains letters AND digits (or is 5-9 alphanumeric chars). NEVER put a phone number in "plate".
            - "phone" MUST be a phone number. It has 7+ digits and may start with "+" or "0". NEVER put a license plate in "phone".
            - Test: if a value has 7+ pure digits (only digits, +, -, spaces) → it's a phone → "phone" field.
            - Test: if a value is short and mixes letters with digits (like "CE 007", "B 123 ABC") → it's a plate → "plate" field.
            - "owner" is the person's name (not the car brand, not a plate, not a phone).
            - "telegram" MUST be a Telegram @username or t.me link. NEVER put a license plate or phone number in "telegram". If there is no Telegram value, leave it empty.
            - A license plate value (like "номерной знак" / "CE 007" / "B 123 ABC") ALWAYS goes to "plate" — never to "telegram", "phone" or "owner". Apply this to EVERY row, including the first one.
            - If a field is genuinely not present in the source, set it to empty string "". Do NOT copy another field's value to fill a blank.
            - It is REQUIRED that if the source has both a plate and a phone, BOTH are extracted into their correct fields.

            Data to process:
            ${chunk}
          `;

          // Call the Supabase Edge Function `ai-import` — the OpenAI key stays
          // server-side (set as a Vault secret) so it never leaves Supabase.
          // JWT auth is enforced: only signed-in users can invoke.
          const invokeRes = await supa.functions.invoke('ai-import', {
            body: { prompt }
          });

          if (invokeRes.error) {
            // Try to extract a useful message from Supabase FunctionsHttpError
            let msg = invokeRes.error.message || 'Apel către Edge Function eșuat.';
            try {
              const ctx = invokeRes.error.context;
              if (ctx) {
                const errText = typeof ctx.text === 'function' ? await ctx.text() : null;
                if (errText) {
                  try {
                    const parsed = JSON.parse(errText);
                    msg = parsed.error?.message || parsed.error || errText;
                  } catch { msg = errText; }
                }
              }
            } catch {}
            throw new Error(`Lotul ${i+1}: ${msg}`);
          }

          const resultJson = invokeRes.data;
          if (!resultJson || !resultJson.choices || !resultJson.choices[0] || !resultJson.choices[0].message) {
             throw new Error("Răspuns AI invalid.");
          }

          const rawContent = resultJson.choices[0].message.content;
          const parsedData = JSON.parse(rawContent);
          if (parsedData.cars) {
            allExtractedCars = allExtractedCars.concat(parsedData.cars);
          }
        }

        // Client-side sanitizer: even with a strict prompt, the AI sometimes puts
        // the phone in `plate` (and leaves `phone` empty) or vice versa. Detect
        // and move each value to the correct field based on format.
        const looksLikePhone = (s) => {
          if (!s) return false;
          const digits = String(s).replace(/\D/g, '');
          // A phone is 7+ digits and >=60% of the string is digits/+/-/space/()
          if (digits.length < 7) return false;
          const cleanChars = String(s).replace(/[\d+\-\s().]/g, '');
          return cleanChars.length === 0;
        };
        const looksLikePlate = (s) => {
          if (!s) return false;
          const str = String(s).trim();
          if (str.length < 3 || str.length > 12) return false;
          // Plates mix letters and digits; must contain at least one letter.
          const hasLetter = /[A-Za-z]/.test(str);
          const hasDigit = /\d/.test(str);
          const digits = str.replace(/\D/g, '');
          // Reject if it's effectively a phone number (too many digits, no letters)
          if (!hasLetter) return false;
          if (digits.length >= 7 && !hasLetter) return false;
          return hasLetter && hasDigit;
        };
        for (const car of allExtractedCars) {
          const p = car.plate, ph = car.phone;
          // Case 1: plate holds a phone number and phone is empty → swap
          if (looksLikePhone(p) && !looksLikePlate(p)) {
            if (!ph || !looksLikePhone(ph)) {
              car.phone = p;
              car.plate = looksLikePlate(ph) ? ph : '';
            }
          }
          // Case 2: phone holds a plate and plate is empty → swap
          else if (looksLikePlate(ph) && !looksLikePhone(ph) && !p) {
            car.plate = ph;
            car.phone = '';
          }
          // Case 3: the plate ended up in the telegram field (and plate is
          // empty) → move it back to plate. Telegram is a @handle, not a plate.
          if (!car.plate && looksLikePlate(car.telegram) && !looksLikePhone(car.telegram)) {
            car.plate = car.telegram;
            car.telegram = '';
          }
        }

        const cars = allExtractedCars;
        el('aiProgressBar').style.width = '100%';

        if (cars.length === 0) {
          statusDiv.textContent = 'Nu am reușit să extrag date din fișier.';
          statusDiv.style.color = 'var(--red)';
          el('aiImportProcessBtn').disabled = false;
          return;
        }

        // Duplicate detection: flag rows whose plate already exists in the DB
        // or appears twice in the file. Flagged rows are shown in the preview
        // but skipped at import.
        const normPlate = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        const existingPlates = new Set(
          (state.cars || []).map(x => normPlate(x.plate)).filter(p => p.length >= 3)
        );
        const seenInFile = new Set();
        let dupCount = 0;
        for (const car of cars) {
          const p = normPlate(car.plate);
          car._dup = p.length >= 3 && (existingPlates.has(p) || seenInFile.has(p));
          if (p.length >= 3) seenInFile.add(p);
          if (car._dup) dupCount++;
        }

        statusDiv.textContent = `Analiză completă! Am găsit ${cars.length} mașini` +
          (dupCount ? ` (${dupCount} existente — vor fi actualizate).` : '.');
        statusDiv.style.color = 'var(--green)';
        setTimeout(() => { el('aiProgressBarContainer').style.display = 'none'; }, 1000);

        // Show preview — display plate and phone in separate labeled slots so
        // the user can verify the AI put each value in the correct field.
        el('aiImportCount').textContent = cars.length;
        el('aiImportPreview').innerHTML = cars.map(car => {
          const plateChip = car.plate
            ? `<span style="background: rgba(59,130,246,0.15); color: var(--blue); padding: 2px 6px; border-radius: 4px; font-family: monospace;">Placă: ${escape(car.plate)}</span>`
            : `<span style="background: rgba(255,255,255,0.05); color: var(--text-mute); padding: 2px 6px; border-radius: 4px; font-style: italic;">Placă lipsă</span>`;
          const phoneChip = car.phone
            ? `<span style="background: rgba(16,185,129,0.15); color: var(--green); padding: 2px 6px; border-radius: 4px; font-family: monospace;">Tel: ${escape(car.phone)}</span>`
            : `<span style="background: rgba(255,255,255,0.05); color: var(--text-mute); padding: 2px 6px; border-radius: 4px; font-style: italic;">Tel lipsă</span>`;
          const dupChip = car._dup
            ? `<span style="background: rgba(245,158,11,0.18); color: var(--orange); padding: 2px 6px; border-radius: 4px; font-weight: 700;">EXISTĂ — se actualizează</span>`
            : '';
          // Extra fields detected, shown so the user can confirm they came through.
          const extras = [];
          if (car.year) extras.push('An: ' + escape(String(car.year)));
          if (car.category) extras.push('Cat: ' + escape(car.category));
          if (car.telegram) extras.push('TG: ' + escape(car.telegram));
          if (car.modifications) extras.push('Modif.');
          if (car.responsible_person) extras.push('Resp: ' + escape(car.responsible_person));
          if (car.transport_info) extras.push('Transport');
          if (car.social_links) extras.push('Social');
          const extrasLine = extras.length
            ? `<div style="color: var(--text-mute); font-size: 10px; margin-top: 3px;">${extras.join(' · ')}</div>`
            : '';
          return `
            <div style="padding: 10px; border-bottom: 1px solid rgba(59,130,246,0.2); font-size: 12px; display: flex; align-items: center; gap: 8px; ${car._dup ? 'opacity: 0.55;' : ''}">
              <div style="width: 6px; height: 6px; border-radius: 50%; background: ${car._dup ? 'var(--orange)' : 'var(--blue)'}; flex-shrink: 0;"></div>
              <div style="flex: 1; min-width: 0;">
                <div style="font-weight: bold; color: var(--text);">${escape(car.model || '—')}</div>
                <div style="color: var(--text-dim); font-size: 11px; margin-top: 2px;">${escape(car.owner || '—')}</div>
                <div style="display: flex; gap: 6px; margin-top: 4px; flex-wrap: wrap; font-size: 10px;">
                  ${plateChip}
                  ${phoneChip}
                  ${dupChip}
                </div>
                ${extrasLine}
              </div>
            </div>
          `;
        }).join('');

        // Switch to preview mode
        el('aiImportFileSection').style.display = 'none';
        el('aiImportPreviewSection').style.display = 'block';
        el('aiImportProcessBtn').style.display = 'none';
        el('aiImportConfirmBtn').style.display = 'inline-block';
        el('aiImportConfirmBtn').disabled = false;

        // Store cars for import
        window.pendingCars = cars;
      } catch (err) {
        console.error('Import Error:', err);
        statusDiv.textContent = 'Eroare: ' + err.message;
        statusDiv.style.color = 'var(--red)';
        el('aiImportProcessBtn').disabled = false;
      }
    });

    // AI Import confirm - actually import to Supabase
    el('aiImportConfirmBtn').addEventListener('click', async () => {
      const statusDiv = el('aiImportStatus');
      const cars = window.pendingCars || [];

      if (cars.length === 0) return;

      statusDiv.textContent = 'Se importă mașinile...';
      statusDiv.style.color = 'var(--text-dim)';
      el('aiImportConfirmBtn').disabled = true;

      try {
        // Rows flagged as duplicates in the preview are merged into the existing
        // car (new/changed fields only); the rest are inserted.
        const fresh = cars.filter(c => !c._dup);
        const dups = cars.filter(c => c._dup);
        // Map AI output onto uniform, whitelisted rows: a stray key invented
        // by the model would otherwise reject a whole batch ("column not
        // found"), and NOT NULL columns need string fallbacks.
        // Resolve an event name from the file to an event_id; fall back to the
        // currently-selected active event so imported cars land in the right one.
        const resolveEventId = (name) => {
          const n = String(name || '').trim().toLowerCase();
          if (n) {
            const m = (state.events || []).find(e =>
              String(e.title || e.name || '').trim().toLowerCase() === n);
            if (m) return m.id;
          }
          return state.activeEventId ? Number(state.activeEventId) : null;
        };
        const toYear = (v) => { const y = parseInt(String(v).replace(/\D/g, ''), 10); return Number.isFinite(y) && y > 1800 && y < 2200 ? y : null; };
        const rows = fresh.map(c => ({
          model: c.model || '',
          owner: c.owner || '',
          plate: c.plate || '',
          zone: c.zone || '',
          status: 'Invitat', // importul nu marchează sosirea — se face doar la poartă
          status_color: '#3B82F6',
          is_vip: false, // importul nu marchează mașini ca VIP
          phone: c.phone || c.contact || null,
          email: c.email || null,
          brand: c.brand || null,
          city: c.city || null,
          year: toYear(c.year),
          category: (c.category || '').trim() || null,
          telegram: (c.telegram || '').trim() || null,
          modifications: (c.modifications || '').trim() || null,
          responsible_person: (c.responsible_person || '').trim() || null,
          transport_info: (c.transport_info || '').trim() || null,
          social_links: (c.social_links || '').trim() || null,
          event_id: resolveEventId(c.event),
          contact: c.contact || c.phone || null
        }));
        // Bulk insert in batches instead of one request per row — far fewer
        // round-trips, and a failed batch actually surfaces its error.
        const BATCH = 100;
        for (let i = 0; i < rows.length; i += BATCH) {
          const { error } = await supa.from('cars').insert(rows.slice(i, i + BATCH));
          if (error) throw new Error(`Lotul ${Math.floor(i / BATCH) + 1}: ${error.message}`);
        }

        // Smart merge: for each duplicate row, refresh the matching existing car
        // with new/changed fields only. Gate/arrival/VIP state is never touched.
        const normPl = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        const byPlate = new Map();
        (state.cars || []).forEach(x => { const p = normPl(x.plate); if (p.length >= 3 && !byPlate.has(p)) byPlate.set(p, x); });
        const MERGE_FIELDS = ['model', 'owner', 'zone', 'phone', 'email', 'brand', 'city', 'category', 'telegram', 'modifications', 'responsible_person', 'transport_info', 'social_links'];
        let updated = 0, skipped = 0;
        for (const c of dups) {
          const ex = byPlate.get(normPl(c.plate));
          if (!ex) { skipped++; continue; }
          const patch = {};
          for (const f of MERGE_FIELDS) {
            const nv = String((f === 'phone' ? (c.phone || c.contact) : c[f]) || '').trim();
            if (nv && String(ex[f] || '').trim() !== nv) patch[f] = nv;
          }
          if (patch.phone && String(ex.contact || '').trim() !== patch.phone) patch.contact = patch.phone;
          const ny = toYear(c.year);
          if (ny != null && ex.year !== ny) patch.year = ny;
          if (!Object.keys(patch).length) { skipped++; continue; }
          const { error } = await supa.from('cars').update(patch).eq('id', ex.id);
          if (!error) updated++; else skipped++;
        }

        statusDiv.textContent = `Import finalizat: ${rows.length} adăugate` +
          (updated ? `, ${updated} actualizate` : '') + (skipped ? `, ${skipped} sărite` : '') + '.';
        statusDiv.style.color = 'var(--green)';
        await loadData();

        setTimeout(() => {
          closeModal(document.getElementById('modal-ai-import'));
        }, 1500);
      } catch (err) {
        statusDiv.textContent = 'Eroare la import: ' + err.message;
        statusDiv.style.color = 'var(--red)';
        el('aiImportConfirmBtn').disabled = false;
      }
    });

    // Populate the add-car zone dropdown from the canonical list.
    { const _acz = el('addCarZone'); if (_acz) _acz.innerHTML = zoneOptionsHTML(''); }

    // Add Car
    el('form-add-car').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button[type="submit"]');
      const originalText = btn.textContent;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;"></span>';

      const fd = new FormData(e.target);
      const status = fd.get('status') || 'Invitat';
      const statusColor = CAR_STATUS_OPTIONS.find(o => o.label === status)?.color || '#3B82F6';
      const msg = el('modal-add-car-msg');
      msg.classList.remove('show');

      try {
        const yearRaw = fd.get('year');
        const eventIdRaw = fd.get('event_id');
        const { error } = await supa.from('cars').insert({
          brand: (fd.get('brand') || '').trim() || null,
          model: fd.get('model').trim(),
          year: yearRaw ? parseInt(yearRaw, 10) : null,
          category: (fd.get('category') || '').trim() || null,
          owner: (fd.get('owner') || '').trim(),
          plate: (fd.get('plate') || '').trim(),
          phone: (fd.get('phone') || '').trim() || null,
          telegram: (fd.get('telegram') || '').trim() || null,
          email: (fd.get('email') || '').trim() || null,
          city: (fd.get('city') || '').trim() || null,
          zone: (fd.get('zone') || '').trim(),
          modifications: (fd.get('modifications') || '').trim() || null,
          responsible_person: (fd.get('responsible_person') || '').trim() || null,
          additional_notes: (fd.get('additional_notes') || '').trim() || null,
          contact: (fd.get('phone') || '').trim() || null,
          event_id: eventIdRaw ? parseInt(eventIdRaw, 10) : null,
          status, status_color: statusColor,
          is_vip: fd.get('is_vip') === 'on'
        });
        if (error) throw error;
        closeModal(document.getElementById('modal-add-car'));
        await loadData();
      } catch (err) {
        msg.textContent = err.message;
        msg.classList.add('show');
      } finally {
        btn.disabled = false;
        btn.textContent = originalText;
      }
    });

    // Add Event
    el('form-add-event').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button[type="submit"]');
      const originalText = btn.textContent;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;"></span>';

      const fd = new FormData(e.target);
      const status = fd.get('status') || 'Planificat';
      const statusColor = EVENT_STATUS_OPTIONS.find(o => o.label === status)?.color || '#10B981';
      const msg = el('modal-add-event-msg');
      msg.classList.remove('show');
      // Real date drives the auto-computed "days left". The free-text label is
      // optional — if left blank, format it from the picked date.
      const startsVal = fd.get('starts_at');
      const startsAt = startsVal ? new Date(startsVal + 'T00:00:00').toISOString() : null;
      let displayDate = (fd.get('date') || '').trim();
      if (!displayDate && startsVal) {
        try { displayDate = new Date(startsVal + 'T00:00:00').toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (_) { displayDate = startsVal; }
      }

      // Stamp the freeze time only on the transition, so re-saving an already
      // frozen event doesn't keep moving the date it was locked.
      const frozen = !!fd.get('entries_frozen');
      const wasFrozen = !!(state.events || []).find(e => String(e.id) === String(editingEventId))?.entries_frozen;

      const payload = {
        title: fd.get('title').trim(),
        subtitle: (fd.get('subtitle') || '').trim() || null,
        date: displayDate || null,
        starts_at: startsAt,
        location: (fd.get('location') || '').trim() || null,
        cover_url: (fd.get('cover_url') || '').trim() || null,
        status, status_color: statusColor,
        // Empty means unlimited, not zero — a 0 here would refuse every
        // registration, which is never what leaving a field blank means.
        // (frozen/wasFrozen are computed just above the payload.)
        reg_capacity: (() => {
          const n = parseInt(String(fd.get('reg_capacity') || '').trim(), 10);
          return Number.isFinite(n) && n > 0 ? n : null;
        })(),
        waiver_text: (fd.get('waiver_text') || '').trim() || null,
        // Freezing is what makes a printed pass trustworthy: from here on the
        // database refuses to change any entry number for this event.
        entries_frozen: frozen,
        is_sandbox: !!fd.get('is_sandbox'),
        ...(frozen && !wasFrozen ? { entries_frozen_at: new Date().toISOString() } : {}),
        ...(frozen ? {} : { entries_frozen_at: null }),
        days_left: null   // computed live from starts_at
      };
      try {
        const { error } = editingEventId
          ? await supa.from('events').update(payload).eq('id', editingEventId)
          : await supa.from('events').insert(payload);
        if (error) throw error;
        editingEventId = null;
        closeModal(document.getElementById('modal-add-event'));
        await loadData();
      } catch (err) {
        msg.textContent = err.message;
        msg.classList.add('show');
      } finally {
        btn.disabled = false;
        btn.textContent = originalText;
      }
    });

    // ----- EVENT COVER UPLOAD (#hero) -----
    function setEventCover(url) {
      const hidden = el('eventCoverUrl'), prev = el('eventCoverPreview'), clear = el('eventCoverClear');
      if (hidden) hidden.value = url || '';
      if (prev) { prev.style.backgroundImage = url ? `url("${url}")` : ''; prev.classList.toggle('has-img', !!url); }
      if (clear) clear.style.display = url ? '' : 'none';
    }
    (function initEventCover() {
      const btn = el('eventCoverBtn'), input = el('eventCoverInput'), clear = el('eventCoverClear');
      if (!btn || !input) return;
      btn.addEventListener('click', () => input.click());
      if (clear) clear.addEventListener('click', () => setEventCover(''));
      input.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const status = el('eventCoverStatus');
        if (status) status.textContent = t('car.photos.uploading');
        btn.disabled = true;
        try {
          const blob = await downscaleImage(file, 1600, 0.82);
          const path = `event-covers/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
          const { error } = await supa.storage.from('event-covers').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
          if (error) throw error;
          const url = supa.storage.from('event-covers').getPublicUrl(path).data.publicUrl;
          setEventCover(url);
          if (status) status.textContent = '';
        } catch (err) {
          if (status) status.textContent = (t('car.photos.upload_error') || 'Eroare') + ': ' + (err.message || err);
        } finally {
          btn.disabled = false; input.value = '';
        }
      });
    })();

    // ----- ADD-TASK CHECKLIST BUILDER -----
    window._newTaskChecklist = [];
    function renderNewTaskChecklist() {
      const box = el('addTaskChecklist');
      if (!box) return;
      box.innerHTML = (window._newTaskChecklist || []).map((item, i) => `
        <div class="checklist-edit-row">
          <span>${escape(item)}</span>
          <button type="button" class="checklist-del" data-cl-del="${i}" aria-label="Șterge">&times;</button>
        </div>`).join('');
    }
    function addNewTaskChecklistItem() {
      const input = el('addTaskChecklistInput');
      const v = (input.value || '').trim();
      if (!v) return;
      window._newTaskChecklist.push(v);
      input.value = '';
      input.focus();
      renderNewTaskChecklist();
    }
    el('addTaskChecklistBtn').addEventListener('click', addNewTaskChecklistItem);
    el('addTaskChecklistInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); addNewTaskChecklistItem(); }
    });
    el('addTaskChecklist').addEventListener('click', (e) => {
      const del = e.target.closest('[data-cl-del]');
      if (!del) return;
      window._newTaskChecklist.splice(parseInt(del.dataset.clDel, 10), 1);
      renderNewTaskChecklist();
    });

    // Add Task
    el('form-add-task').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button[type="submit"]');
      const originalText = btn.textContent;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;"></span>';

      const fd = new FormData(e.target);
      const status = fd.get('status') || 'available';
      const map = { 'available': '#3B82F6', 'in_progress': '#F59E0B', 'completed': '#10B981' };
      const msg = el('modal-add-task-msg');
      msg.classList.remove('show');

      try {
        const me = currentUserEmail();
        const myName = currentUserName();
        const eventIdRaw = fd.get('event_id');
        // Chosen assignee (email) → the task is earmarked for that person and
        // only they get the push notification (targeted by the DB trigger).
        const assigneeEmail = (fd.get('assigned_to') || '').trim() || null;
        const assigneeName = assigneeEmail
          ? ((state.profiles || []).find(p => (p.email || '').toLowerCase() === assigneeEmail.toLowerCase())?.full_name
             || assigneeEmail.split('@')[0])
          : null;
        // Structured deadline drives reminders; keep a human string for display.
        const dueRaw = (fd.get('due_at') || '').trim();
        const dueAt = dueRaw ? new Date(dueRaw).toISOString() : null;
        const dueText = dueRaw ? new Date(dueRaw).toLocaleString('ro-RO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
        const { error } = await supa.from('tasks').insert({
          title: fd.get('title').trim(),
          event: (fd.get('event') || '').trim(),
          date: dueText,
          due_at: dueAt,
          category: (fd.get('category') || '').trim() || null,
          team: (fd.get('team') || '').trim() || null,
          priority: fd.get('priority') || 'Normală',
          detailed_description: (fd.get('detailed_description') || '').trim() || null,
          created_by: myName,
          event_id: eventIdRaw ? parseInt(eventIdRaw, 10) : null,
          assigned_to: assigneeEmail,
          assigned_user_name: assigneeName,
          checklist: (window._newTaskChecklist || []).map(x => ({ text: x, done: false })),
          status,
          status_color: map[status] || '#3B82F6',
          is_completed: status === 'completed',
          ...(status === 'completed' ? {
              completed_by_user_id: currentUser.id,
              completed_by_user_name: myName,
              completed_at: new Date().toISOString()
          } : {})
        });
        if (error) throw error;
        window._newTaskChecklist = [];
        renderNewTaskChecklist();
        closeModal(document.getElementById('modal-add-task'));
        await loadData();
      } catch (err) {
        msg.textContent = err.message;
        msg.classList.add('show');
      } finally {
        btn.disabled = false;
        btn.textContent = originalText;
      }
    });

    // Don't clobber a detail modal the user is actively editing.
    function _isTypingIn(root) {
      const a = document.activeElement;
      return a && root?.contains(a) && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT');
    }

    // Local-first Realtime: patch the changed row straight into state and
    // re-render only the affected slices — no full 4-table refetch. The
    // Realtime payload carries the full row, so open detail views stay fresh.
    function applyRealtimeCar(payload) {
      if (!state.cars) state.cars = [];
      const { eventType, new: nu, old: ou } = payload;
      if (eventType === 'DELETE') {
        state.cars = state.cars.filter(c => String(c.id) !== String(ou?.id));
      } else if (nu) {
        const i = state.cars.findIndex(c => String(c.id) === String(nu.id));
        if (i >= 0) state.cars[i] = { ...state.cars[i], ...nu };
        else state.cars.unshift(nu);
      }
      cacheCarsOffline(state.cars);
      _fp.cars = makeFp(state.cars, CAR_FP_FIELDS);
      _fp.stats = _fp.cars + '|' + _fp.tasks + '|' + _fp.events;
      withPreservedUI(() => {
        try { renderStats(state.cars, state.tasks, state.events); } catch (_) {}
        try { renderCarsChips(); } catch (_) {}
        try { renderCars(); } catch (_) {}
        try { renderZones(); } catch (_) {}
        if (el('gateOverlay')?.classList.contains('show')) {
          try { renderGateZones(); } catch (_) {}
          try { renderGate(); } catch (_) {}
        }
        const cm = document.getElementById('modal-car-detail');
        if (openCarDetailId != null && cm?.classList.contains('show') && !_isTypingIn(cm)) {
          try { showCarDetail(openCarDetailId); } catch (_) {}
        }
      });
    }
    function applyRealtimeTask(payload) {
      if (!state.tasks) state.tasks = [];
      const { eventType, new: nu, old: ou } = payload;
      if (eventType === 'DELETE') {
        state.tasks = state.tasks.filter(x => String(x.id) !== String(ou?.id));
      } else if (nu) {
        const i = state.tasks.findIndex(x => String(x.id) === String(nu.id));
        if (i >= 0) state.tasks[i] = { ...state.tasks[i], ...nu };
        else state.tasks.unshift(nu);
      }
      _fp.tasks = makeFp(state.tasks, TASK_FP_FIELDS);
      _fp.stats = _fp.cars + '|' + _fp.tasks + '|' + _fp.events;
      withPreservedUI(() => {
        try { renderStats(state.cars, state.tasks, state.events); } catch (_) {}
        try { renderTopTasks(state.tasks); } catch (_) {}
        try { renderMyTasks(); } catch (_) {}
        try { renderTasksChips(); } catch (_) {}
        try { renderTasksDeptChips(); } catch (_) {}
        try { renderTasks(); } catch (_) {}
        try { renderTeam(); } catch (_) {}
        const tm = document.getElementById('modal-task-detail');
        if (openTaskDetailId != null && tm?.classList.contains('show') && !_isTypingIn(tm)) {
          try { showTaskDetail(openTaskDetailId); } catch (_) {}
        }
      });
    }

    // ================= EVENT AGENDA (program) =================
    let _agendaAdding = false;
    const _agendaNotified = new Set();
    function nowHHMM() {
      const d = new Date();
      return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    }
    function activeAgenda() {
      return (state.agenda || []).filter(matchesActiveEvent)
        .slice().sort((a, b) => String(a.at_time || '').localeCompare(String(b.at_time || '')));
    }
    function renderAgenda() {
      const block = el('agendaBlock'); if (!block) return;
      const list = el('agendaList'); if (!list) return;
      const staff = roleAtLeast('staff');
      const addBtn = el('agendaAddBtn'); if (addBtn) addBtn.hidden = !staff;
      const items = activeAgenda();
      block.hidden = !items.length && !staff && !_agendaAdding;
      const now = nowHHMM();
      let currentIdx = -1;
      items.forEach((a, i) => { if ((a.at_time || '') <= now) currentIdx = i; });
      let html = items.map((a, i) => {
        const past = (a.at_time || '') < now;
        const cls = i === currentIdx ? 'current' : (past ? 'past' : 'upcoming');
        return `<div class="agenda-item ${cls}" data-agenda-id="${a.id}">
            <div class="agenda-time">${escape(a.at_time || '—')}</div>
            <div class="agenda-dot"></div>
            <div class="agenda-body"><div class="agenda-t">${escape(a.title)}</div>${a.notes ? `<div class="agenda-n">${escape(a.notes)}</div>` : ''}</div>
            ${staff ? `<button class="agenda-del" data-agenda-del="${a.id}" type="button" aria-label="${escape(t('common.delete'))}">&times;</button>` : ''}
          </div>`;
      }).join('');
      if (_agendaAdding && staff) {
        html += `<div class="agenda-add-row">
            <input type="time" id="agendaTime" class="agenda-time-input">
            <input type="text" id="agendaTitle" class="agenda-title-input" placeholder="${escape(t('agenda.title_ph'))}">
            <button class="btn small" id="agendaSaveBtn" type="button">${escape(t('common.save'))}</button>
            <button class="btn small ghost" id="agendaCancelBtn" type="button">${escape(t('common.cancel'))}</button>
          </div>`;
      }
      if (!html) html = `<div class="agenda-empty">${escape(t('agenda.empty'))}</div>`;
      list.innerHTML = html;
      if (_agendaAdding && staff) { const ti = el('agendaTime'); if (ti) ti.focus(); }
    }
    async function addAgendaItem(time, title) {
      title = (title || '').trim();
      if (!title) { const inp = el('agendaTitle'); if (inp) inp.focus(); return; }
      const ev = state.activeEventId ? Number(state.activeEventId) : null;
      const { error } = await supa.from('event_agenda').insert({ event_id: ev, at_time: time || '', title });
      if (error) { showToast(t('common.error') + ': ' + error.message, 'error'); return; }
      _agendaAdding = false;
      await loadData();
      renderAgenda();
    }
    async function deleteAgendaItem(id) {
      const ok = await uiConfirm(t('agenda.del_confirm'));
      if (!ok) return;
      const { error } = await supa.from('event_agenda').delete().eq('id', id);
      if (error) { showToast(t('common.error') + ': ' + error.message, 'error'); return; }
      await loadData();
      renderAgenda();
    }
    el('agendaAddBtn')?.addEventListener('click', () => { _agendaAdding = true; renderAgenda(); });
    el('agendaList')?.addEventListener('click', (e) => {
      const del = e.target.closest('[data-agenda-del]');
      if (del) { deleteAgendaItem(del.dataset.agendaDel); return; }
      if (e.target.closest('#agendaSaveBtn')) { addAgendaItem(el('agendaTime')?.value, el('agendaTitle')?.value); return; }
      if (e.target.closest('#agendaCancelBtn')) { _agendaAdding = false; renderAgenda(); return; }
    });
    el('agendaList')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.id === 'agendaTitle') { e.preventDefault(); addAgendaItem(el('agendaTime')?.value, el('agendaTitle')?.value); }
    });
    // Fire an in-app notification when an agenda stage begins (while app is open).
    function checkAgendaNotifications() {
      const now = nowHHMM();
      activeAgenda().forEach(a => {
        if ((a.at_time || '') === now && !_agendaNotified.has(a.id)) {
          _agendaNotified.add(a.id);
          try { sendAppNotification(t('agenda.now'), a.title); } catch (_) {}
        }
      });
    }
    setInterval(() => { try { checkAgendaNotifications(); } catch (_) {} }, 30000);
    // Re-render each minute so past/current highlighting stays accurate.
    setInterval(() => { if (!_agendaAdding) { try { renderAgenda(); } catch (_) {} } }, 60000);
    function applyRealtimeAgenda(payload) {
      if (!state.agenda) state.agenda = [];
      const { eventType, new: nu, old: ou } = payload;
      if (eventType === 'DELETE') state.agenda = state.agenda.filter(a => String(a.id) !== String(ou?.id));
      else if (nu) { const i = state.agenda.findIndex(a => String(a.id) === String(nu.id)); if (i >= 0) state.agenda[i] = nu; else state.agenda.push(nu); }
      _fp.agenda = makeFp(state.agenda, AGENDA_FP_FIELDS);
      if (!_agendaAdding) { try { renderAgenda(); } catch (_) {} }
    }

    // ============ PUBLIC REGISTRATION APPROVAL QUEUE (#2) ============
    let _regFilter = 'pending'; // 'pending' = Înscrise, 'hold' = În așteptare
    function renderRegQueue() {
      const box = el('regQueue'); if (!box) return;
      const staff = roleAtLeast('staff');
      // Scoped like every other list: a registration for last month's event has
      // no business sitting in this event's approval queue.
      const all = (state.registrations || [])
        .filter(matchesActiveEvent)
        .filter(r => r.status === 'pending' || r.status === 'hold' || r.status === 'waitlist');
      const split = el('carsSplit');
      if (!staff || !all.length) { box.hidden = true; box.innerHTML = ''; if (split) split.classList.remove('has-reg'); return; }
      box.hidden = false;
      if (split) split.classList.add('has-reg');
      const nNew = all.filter(r => r.status === 'pending').length;
      const nHold = all.filter(r => r.status === 'hold').length;
      const nWait = all.filter(r => r.status === 'waitlist').length;
      // Fall back to a tab that actually has items so the list is never blank.
      const counts = { pending: nNew, hold: nHold, waitlist: nWait };
      if (!counts[_regFilter]) {
        _regFilter = ['pending', 'hold', 'waitlist'].find(k => counts[k]) || 'pending';
      }
      const regs = all.filter(r => r.status === _regFilter);
      const tab = (key, label, n) =>
        `<button type="button" class="chip${_regFilter === key ? ' active' : ''}" data-reg-filter="${key}">${escape(label)} <span class="count">· ${n}</span></button>`;
      // Card built to read like the approved-car rows next to it: same shell,
      // same icon, same owner · plate · city line. It used to be a bare title
      // strip, which made the two columns look like different apps and left
      // the reviewer with nothing to triage on without opening each one.
      const chev = '<svg class="reg-card-chev" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';
      const carIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H5.24a2 2 0 0 0-1.8 1.1l-.8 1.63A6 6 0 0 0 2 12.42V16h2"/><circle cx="6.5" cy="16.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/></svg>';
      box.innerHTML =
        `<div class="chips reg-chips">${tab('pending', t('reg.tab_new'), nNew)}${tab('hold', t('reg.tab_hold'), nHold)}${nWait ? tab('waitlist', t('reg.tab_waitlist'), nWait) : ''}</div>` +
        (regs.length ? '' : `<div class="reg-empty">${escape(t('reg.tab_empty'))}</div>`) +
        regs.map(r => {
          const name = [r.brand, r.model].filter(Boolean).join(' ') || r.owner || '—';
          const hold = r.status === 'hold' ? `<span class="reg-hold-badge">${escape(t('reg.hold'))}</span>` : '';
          const wait = r.status === 'waitlist' ? `<span class="reg-wait-badge">${escape(t('reg.waitlist'))}</span>` : '';
          const blockReason = plateBlocked(r.plate);
          const blockBadge = blockReason !== null ? `<span class="block-badge" title="${escape(blockReason || '')}">⛔ ${escape(t('block.badge'))}</span>` : '';
          const dup = regDuplicate(r);
          const dupBadge = dup ? `<span class="reg-dup-badge" title="${escape(dup)}">⧉ ${escape(t('regdup.badge'))}</span>` : '';
          const wv = el('regDetailWaiver');
      if (wv) {
        // Proof that this person accepted the terms, with the name they typed
        // and when. Absent for registrations made before a waiver was set.
        if (r.waiver_name && r.waiver_at) {
          wv.hidden = false;
          wv.innerHTML = `<strong>✓ ${escape(t('reg.waiver_signed'))}</strong>`
            + `<span>${escape(r.waiver_name)} · ${escape(fmtDateTime(r.waiver_at))}</span>`;
        } else { wv.hidden = true; wv.innerHTML = ''; }
      }
      const pics = Array.isArray(r.photos) ? r.photos : [];
          const shown = pics.slice(0, 4);
          const extra = pics.length - shown.length;
          const thumbs = pics.length
            ? `<div class="reg-card-thumbs">${shown.map(u => `<img src="${escape(u)}" alt="" loading="lazy" decoding="async">`).join('')}${extra > 0 ? `<div class="reg-card-more">+${extra}</div>` : ''}</div>`
            : '';
          // owner · plate · city — the three things you actually decide on.
          // Missing values are dropped rather than shown as dashes, so a sparse
          // registration doesn't render as a row of placeholders.
          const facts = [
            r.owner ? `<span class="reg-owner">${escape(r.owner)}</span>` : '',
            r.plate ? `<span>${escape(r.plate)}</span>` : '',
            r.city ? `<span class="reg-city">${escape(r.city)}</span>` : '',
          ].filter(Boolean).join('<span class="sep"></span>');
          // How long this one has been waiting — the reviewer's queue order.
          const waited = r.created_at ? `<span class="reg-age">${escape(fmtRelative(r.created_at))}</span>` : '';
          const badges = [hold, wait, blockBadge, dupBadge].filter(Boolean).join('');
          return `<div class="card reg-card card-stripe${r.status === 'hold' ? ' is-hold' : ''}${r.status === 'waitlist' ? ' is-waitlist' : ''}${blockReason !== null ? ' is-blocked' : ''}" data-reg-open="${r.id}" role="button" tabindex="0">
              <div class="reg-card-main">
                <div class="row-icon orange reg-card-icon">${carIcon}</div>
                <div class="reg-card-text">
                  <div class="reg-card-brand">${escape(name)}${badges}</div>
                  <div class="reg-card-facts">${facts}</div>
                  ${waited}
                </div>
                ${chev}
              </div>
              ${thumbs}
            </div>`;
        }).join('');
    }

    // Full detail of a pending registration: editable fields, zone assignment,
    // confirmation channel and actions.
    let _regDetailId = null;
    let _regChannel = 'none';
    const REG_EDIT_FIELDS = ['brand', 'model', 'plate', 'year', 'color', 'owner', 'phone', 'telegram', 'email', 'city', 'social_links', 'transport_info', 'modifications', 'note'];
    function readRegForm() {
      const f = document.getElementById('regDetailForm'); const o = {};
      if (!f) return o;
      REG_EDIT_FIELDS.forEach(n => { const inp = f.elements[n]; o[n] = inp ? String(inp.value || '').trim() : ''; });
      const y = parseInt(String(o.year).replace(/\D/g, ''), 10);
      o.year = Number.isFinite(y) && y > 1800 && y < 2200 ? y : null;
      return o;
    }
    function showRegDetail(id) {
      const r = (state.registrations || []).find(x => String(x.id) === String(id));
      if (!r) return;
      _regDetailId = id;
      el('regDetailTitle').textContent = [r.brand, r.model].filter(Boolean).join(' ') || r.owner || '—';
      const sub = el('regDetailSub'); if (sub) sub.textContent = r.plate || '';
      const warn = el('regDetailBlock');
      if (warn) {
        const reason = plateBlocked(r.plate);
        const dup = regDuplicate(r);
        let html = '';
        if (reason !== null) html += `<div class="block-warn"><strong>⛔ ${escape(t('block.warn'))}</strong>` + (reason ? `<span>${escape(reason)}</span>` : '') + `</div>`;
        if (dup) html += `<div class="reg-warn-dup"><strong>⧉ ${escape(t('regdup.warn'))}</strong><span>${escape(dup)}</span></div>`;
        warn.hidden = !html;
        warn.innerHTML = html;
      }
      const pics = Array.isArray(r.photos) ? r.photos : [];
      el('regDetailPhotos').innerHTML = pics.map(u =>
        `<img src="${escape(u)}" alt="" loading="lazy" data-reg-photo="${escape(u)}">`).join('');
      const f = document.getElementById('regDetailForm');
      if (f) REG_EDIT_FIELDS.forEach(n => { const inp = f.elements[n]; if (inp) inp.value = r[n] == null ? '' : String(r[n]); });
      const zoneSel = el('regDetailZone');
      if (zoneSel) { zoneSel.innerHTML = zoneOptionsHTML(''); zoneSel.classList.remove('is-missing'); }
      const zoneWarn = el('regZoneWarn'); if (zoneWarn) zoneWarn.hidden = true;
      _regChannel = 'none';
      document.querySelectorAll('#regDetailChannel .chip').forEach(c => c.classList.toggle('active', c.dataset.regChannel === 'none'));
      openModal('reg-detail');
    }
    el('regDetailChannel')?.addEventListener('click', (e) => {
      const b = e.target.closest('[data-reg-channel]'); if (!b) return;
      _regChannel = b.dataset.regChannel;
      el('regDetailChannel').querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c === b));
    });
    el('regDetailSave')?.addEventListener('click', async () => {
      const id = _regDetailId; if (!id) return;
      const e = readRegForm();
      const patch = {
        brand: e.brand || null, model: e.model || null, plate: e.plate || null, year: e.year,
        color: e.color || null,
        owner: e.owner || null, phone: e.phone || null, telegram: e.telegram || null, email: e.email || null,
        city: e.city || null, social_links: e.social_links || null, transport_info: e.transport_info || null,
        modifications: e.modifications || null, note: e.note || null
      };
      const { error } = await supa.from('car_registrations').update(patch).eq('id', id);
      if (error) { showToast(t('common.error') + ': ' + error.message, 'error'); return; }
      const r = (state.registrations || []).find(x => String(x.id) === String(id)); if (r) Object.assign(r, patch);
      _fp.regs = makeFp(state.registrations, REG_FP_FIELDS);
      renderRegQueue();
      showToast(t('reg.saved'));
    });
    el('regDetailApprove')?.addEventListener('click', () => {
      const id = _regDetailId; if (!id) return;
      const zone = (el('regDetailZone')?.value || '').trim();
      // 47 of 52 approved cars had no zone, and the zone was set by hand 17
      // times in the life of the app — because nothing ever asked for it at the
      // one moment somebody is already looking at the car. Ask here.
      if (!zone) {
        const sel = el('regDetailZone');
        if (sel) { sel.classList.add('is-missing'); sel.focus(); }
        const warn = el('regZoneWarn');
        if (warn) { warn.textContent = t('reg.zone_required'); warn.hidden = false; }
        return;
      }
      const edits = readRegForm();
      const channel = _regChannel;
      closeModal(document.getElementById('modal-reg-detail'));
      approveRegistration(id, zone, edits, channel);
    });
    // Clear the complaint as soon as they answer it.
    el('regDetailZone')?.addEventListener('change', () => {
      el('regDetailZone')?.classList.remove('is-missing');
      const warn = el('regZoneWarn'); if (warn) warn.hidden = true;
    });
    el('regDetailHold')?.addEventListener('click', () => {
      const id = _regDetailId; if (!id) return;
      closeModal(document.getElementById('modal-reg-detail'));
      holdRegistration(id);
    });
    el('regDetailWaitlist')?.addEventListener('click', () => {
      const id = _regDetailId; if (!id) return;
      closeModal(document.getElementById('modal-reg-detail'));
      setRegStatus(id, 'waitlist', t('reg.waitlisted'));
    });
    el('regDetailReject')?.addEventListener('click', async () => {
      const id = _regDetailId; if (!id) return;
      if (!(await uiConfirm(t('reg.reject_confirm')))) return;
      closeModal(document.getElementById('modal-reg-detail'));
      rejectRegistration(id, true);
    });
    el('regDetailPhotos')?.addEventListener('click', (e) => {
      const ph = e.target.closest('[data-reg-photo]'); if (ph) window.open(ph.dataset.regPhoto, '_blank', 'noopener');
    });
    // Send the participant a confirmation (with their ticket link) on the chosen channel.
    function sendRegConfirmation(channel, data, car) {
      const ev = (state.events || []).find(e => String(e.id) === String(car.event_id || data.event_id));
      const carName = [data.brand, data.model].filter(Boolean).join(' ');
      const ticket = ticketUrl(car);
      const msg = [
        `Salut${data.owner ? ' ' + data.owner : ''}!`,
        `Mașina ta${carName ? ' ' + carName : ''} este confirmată${ev?.title ? ' pentru ' + ev.title : ''}.`,
        `Biletul tău: ${ticket}`
      ].join(' ');
      const phone = normalizePhone(data.phone);
      if (channel === 'whatsapp') {
        if (!phone) { showToast(t('reg.no_phone'), 'error'); return; }
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
      } else if (channel === 'telegram') {
        const tg = telegramLink(data.telegram) || (phone ? `https://t.me/+${phone}` : '');
        if (!tg) { showToast(t('reg.no_tg'), 'error'); return; }
        try { if (navigator.clipboard) navigator.clipboard.writeText(msg); showToast(t('car.contact.tg_copied')); } catch (_) {}
        window.open(tg, '_blank', 'noopener');
      } else if (channel === 'sms') {
        if (!phone) { showToast(t('reg.no_phone'), 'error'); return; }
        window.open(`sms:${phone}?body=${encodeURIComponent(msg)}`, '_blank');
      }
    }
    async function approveRegistration(id, zone, edits, channel) {
      const r = (state.registrations || []).find(x => String(x.id) === String(id));
      if (!r) return;
      const m = Object.assign({}, r, edits || {});
      const car = {
        brand: m.brand || null, model: m.model || '', plate: m.plate || null, owner: m.owner || null,
        phone: m.phone || null, contact: m.phone || null, telegram: m.telegram || null,
        email: m.email || null, city: m.city || null, category: r.category || null,
        zone: (zone || '').trim() || '',
        year: m.year || null, color: m.color || null, social_links: m.social_links || null,
        transport_info: m.transport_info || null,
        modifications: m.modifications || null,
        photos: Array.isArray(r.photos) ? r.photos : [],
        additional_notes: m.note || null, status: 'Invitat', status_color: '#3B82F6',
        event_id: r.event_id || (state.activeEventId ? Number(state.activeEventId) : null)
      };
      const { data: ins, error } = await supa.from('cars').insert(car).select('id, plate').single();
      if (error) { showToast(t('common.error') + ': ' + error.message, 'error'); return; }
      await supa.from('car_registrations').delete().eq('id', id);
      state.registrations = (state.registrations || []).filter(x => String(x.id) !== String(id));
      await loadData();
      renderRegQueue();
      showToast(t('reg.approved', { name: [m.brand, m.model].filter(Boolean).join(' ') || m.owner || '' }));
      // Automatic approval SMS (server-side, no-op unless enabled in settings).
      if (ins) { try { supa.rpc('send_approval_sms', { p_car_id: ins.id }); } catch (_) {} }
      if (channel && channel !== 'none' && ins) {
        try { sendRegConfirmation(channel, Object.assign({}, m, { event_id: car.event_id }), ins); } catch (_) {}
      }
    }
    // Move a registration between queue states. Approving is a different path
    // (it creates a car); this only ever changes where it sits in the queue.
    async function setRegStatus(id, status, toast) {
      // Approving turns a registration into a car, and the database assigns its
      // entry number. Replaying that from a queue would hand out a number that
      // is already printed on somebody's pass.
      if (!requireOnline(t('offline.what_registration'))) return;
      const { error } = await supa.from('car_registrations').update({ status }).eq('id', id);
      if (error) { showToast(t('common.error') + ': ' + error.message, 'error'); return; }
      const r = (state.registrations || []).find(x => String(x.id) === String(id));
      if (r) r.status = status;
      _fp.regs = makeFp(state.registrations, REG_FP_FIELDS);
      renderRegQueue();
      showToast(toast);
    }
    async function holdRegistration(id) {
      return setRegStatus(id, 'hold', t('reg.held'));
    }
    async function rejectRegistration(id, skipConfirm) {
      if (!skipConfirm && !(await uiConfirm(t('reg.reject_confirm')))) return;
      const { error } = await supa.from('car_registrations').delete().eq('id', id);
      if (error) { showToast(t('common.error') + ': ' + error.message, 'error'); return; }
      state.registrations = (state.registrations || []).filter(x => String(x.id) !== String(id));
      renderRegQueue();
    }
    el('regQueue')?.addEventListener('click', (e) => {
      const fil = e.target.closest('[data-reg-filter]');
      if (fil) { _regFilter = fil.dataset.regFilter; renderRegQueue(); return; }
      const open = e.target.closest('[data-reg-open]'); if (open) { showRegDetail(open.dataset.regOpen); }
    });
    el('regQueue')?.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const open = e.target.closest('[data-reg-open]'); if (open) { e.preventDefault(); showRegDetail(open.dataset.regOpen); }
    });
    function applyRealtimeReg(payload) {
      if (!state.registrations) state.registrations = [];
      const { eventType, new: nu, old: ou } = payload;
      if (eventType === 'DELETE') {
        state.registrations = state.registrations.filter(r => String(r.id) !== String(ou?.id));
      } else if (nu) {
        if (nu.status !== 'pending' && nu.status !== 'hold' && nu.status !== 'waitlist') {
          state.registrations = state.registrations.filter(r => String(r.id) !== String(nu.id));
        } else {
          const i = state.registrations.findIndex(r => String(r.id) === String(nu.id));
          if (i >= 0) state.registrations[i] = nu; else state.registrations.unshift(nu);
          if (eventType === 'INSERT') {
            // In-app alert only for the Participanți department (+ admins);
            // offline members get a Web Push via the DB trigger.
            const myDept = (currentUser?.user_metadata || {}).department || '';
            if (isAdmin() || myDept === 'Participanți') {
              try { sendAppNotification(t('reg.new'), [nu.brand, nu.model].filter(Boolean).join(' ')); } catch (_) {}
            }
          }
        }
      }
      _fp.regs = makeFp(state.registrations, REG_FP_FIELDS);
      try { renderRegQueue(); } catch (_) {}
    }

    // ============ GATE-ONLY ROLE (#7) ============
    // A 'gate' account is locked to the door check-in screen (a volunteer scanner).
    function isGateRole() { return currentRole() === 'gate'; }
    function applyGateLock() {
      const locked = isGateRole() || kioskOn();
      document.body.classList.toggle('gate-locked', locked);
      document.body.classList.toggle('kiosk', kioskOn());
      if (locked && !el('gateOverlay')?.classList.contains('show')) {
        try { openGate(); } catch (_) {}
      }
      try { renderKioskBtn(); } catch (_) {}
      if (kioskOn()) requestWakeLock();
    }

    // Realtime — reload when anyone changes the tables
    supa.channel('kultura-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cars' }, (payload) => {
        if (payload.eventType === 'UPDATE' && payload.new.status !== payload.old.status) {
          sendAppNotification("Actualizare Mașină", `${payload.new.brand || ''} ${payload.new.model} este acum: ${payload.new.status}`);
          const now = (payload.new.status || '').toLowerCase(), was = (payload.old.status || '').toLowerCase();
          if (now.includes('sosit') && !was.includes('sosit')) { try { auroraPulse(); } catch (_) {} }
        } else if (payload.eventType === 'INSERT') {
          sendAppNotification("Mașină Nouă", `A fost adăugat un nou vehicul: ${payload.new.model}`);
        }
        applyRealtimeCar(payload);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          if (payload.new.is_completed && !payload.old.is_completed) {
            sendAppNotification("Task Finalizat", `"${payload.new.title}" a fost terminat de ${payload.new.completed_by_user_name || 'cineva'}`);
          } else if (payload.new.assigned_user_id !== payload.old.assigned_user_id && payload.new.assigned_user_id) {
            sendAppNotification("Task Preluat", `${payload.new.assigned_user_name} a început lucrul la: ${payload.new.title}`);
          }
        }
        applyRealtimeTask(payload);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => scheduleLoadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_updates' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          sendAppNotification("Comentariu nou", `Cineva a lăsat o observație la un task.`);
        }
        if (openTaskDetailId != null) refreshTaskUpdates(openTaskDetailId);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload) => {
        // Local-first: patch state.profiles so Team page updates without a full reload
        if (!state.profiles) state.profiles = [];
        const { eventType, new: nu, old: ou } = payload;
        if (eventType === 'INSERT') {
          state.profiles.push(nu);
          sendAppNotification("Utilizator nou", `${nu.full_name || nu.email} s-a alăturat echipei.`);
        } else if (eventType === 'UPDATE') {
          const idx = state.profiles.findIndex(p => p.email === nu.email);
          if (idx >= 0) state.profiles[idx] = nu; else state.profiles.push(nu);
        } else if (eventType === 'DELETE') {
          state.profiles = state.profiles.filter(p => p.email !== (ou?.email));
        }
        if (typeof renderTeam === 'function') renderTeam();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, (payload) => {
        // Team announcements broadcast live to everyone (no 20s poll wait).
        if (!state.announcements) state.announcements = [];
        const { eventType, new: nu, old: ou } = payload;
        if (eventType === 'DELETE') {
          state.announcements = state.announcements.filter(a => String(a.id) !== String(ou?.id));
        } else if (nu) {
          const i = state.announcements.findIndex(a => String(a.id) === String(nu.id));
          if (i >= 0) state.announcements[i] = nu; else state.announcements.unshift(nu);
          if (eventType === 'INSERT') sendAppNotification(nu.title || 'Anunț nou', nu.body || '');
        }
        try { renderHomeAnnounce(); } catch (_) {}
        try { renderAnnounceRecent(); } catch (_) {}
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ui_settings' }, () => {
        // Shared config (parking map, zone capacities, departments) refreshes
        // live for everyone when an admin changes it.
        try { loadMap(); } catch (_) {}
        try { loadZoneConfig(); } catch (_) {}
        try { loadZoneSpots(); } catch (_) {}
        try { loadDepartments(); } catch (_) {}
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_agenda' }, (payload) => {
        applyRealtimeAgenda(payload);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'car_registrations' }, (payload) => {
        applyRealtimeReg(payload);
      })
      .subscribe((status) => {
        // Track realtime health so polling can back off when it's live and
        // speed up when it drops.
        _realtimeOk = status === 'SUBSCRIBED';
        // On every (re)connect pull a fresh snapshot — changes that happened
        // while the socket was down would otherwise wait for the next poll.
        if (status === 'SUBSCRIBED') loadData().catch(() => {});
      });

    // ==============================================================
    // NOTIFICATIONS SYSTEM
    // ==============================================================
    async function requestNotificationPermission() {
      if (!("Notification" in window)) {
        uiAlert("Acest browser nu suportă notificări.");
        return;
      }

      const permission = await Notification.requestPermission();
      updateNotifUI();

      if (permission === "granted") {
        new Notification("Kultura", {
          body: "Notificările au fost activate cu succes!",
          icon: "logo.png"
        });
      }
    }

    function updateNotifUI() {
      const btn = el('enableNotifBtn');
      const status = el('notifStatus');
      if (!btn || !status) return;
      if (!("Notification" in window)) {
        status.textContent = "Nesuportat";
        status.style.color = "var(--text-mute)";
        btn.style.display = "none";
        return;
      }

      if (Notification.permission === "granted") {
        status.textContent = "Activate";
        status.style.color = "var(--green)";
        btn.style.display = "none";
      } else if (Notification.permission === "denied") {
        status.textContent = "Blocate din browser";
        status.style.color = "var(--red)";
        btn.textContent = "Cum deblochez?";
      }
    }

    function sendAppNotification(title, body) {
      console.log(`🔔 Notificare primită: ${title} - ${body}`);

      // Adăugăm în lista locală
      const now = new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
      state.notifications.unshift({ title, body, time: now });
      if (state.notifications.length > 30) state.notifications.pop(); // Limităm la 30

      // Aprindem bulina roșie de la clopoțel
      const bell = el('notifPanelBtn');
      if (bell) bell.classList.add('has-unread');

      // 1. Browser Push (Forțăm apariția pentru test, chiar dacă tab-ul e vizibil)
      if ("Notification" in window && Notification.permission === "granted") {
        try {
          new Notification(title, {
            body,
            icon: "logo.png",
            tag: "kultura-alert" // Evită dublurile
          });
        } catch (e) {
          console.warn("Eroare la afișarea notificării browser:", e);
        }
      }
      // 2. In-app Toast
      showToast(`${title}: ${body}`);
    }

    // Call this on app start too
    setTimeout(updateNotifUI, 1000);

    el('enableNotifBtn').addEventListener('click', requestNotificationPermission);

    // ----- WEB PUSH (notifications while the app is closed) -----
    // Public VAPID key — safe to embed; the matching private key lives only
    // in the send-push Edge Function secrets.
    const VAPID_PUBLIC_KEY = 'BDxoYrWZYVICRD_0BtDEI5yGlWBL7_RLB1aU2hpMnjKBk6NbojHoJ8Zu5xB7DixaQe_uPI5xkw9ek5PtgW7Dxpk';
    const pushSupported = () =>
      'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

    function urlBase64ToUint8Array(base64) {
      const padding = '='.repeat((4 - (base64.length % 4)) % 4);
      const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
      const raw = atob(b64);
      return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
    }

    async function updatePushUI() {
      const btn = el('pushToggleBtn');
      const status = el('pushStatus');
      if (!btn || !status) return;
      if (!pushSupported()) {
        status.textContent = t('settings.push.unsupported');
        status.style.color = 'var(--text-mute)';
        btn.style.display = 'none';
        return;
      }
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub && Notification.permission === 'granted') {
        status.textContent = t('settings.push.status_on');
        status.style.color = 'var(--green)';
        btn.textContent = t('settings.push.disable');
        btn.dataset.state = 'on';
      } else {
        status.textContent = t('settings.push.status_off');
        status.style.color = 'var(--text-mute)';
        btn.textContent = t('settings.push.enable');
        btn.dataset.state = 'off';
      }
    }

    async function enablePush() {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') throw new Error(t('settings.notifs.status_off'));
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }
      const json = sub.toJSON();
      const { error } = await supa.from('push_subscriptions').upsert({
        endpoint: sub.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        user_email: currentUser?.email || null,
        lang: currentLang,   // deliver notifications in the chosen language
      }, { onConflict: 'endpoint' });
      if (error) throw error;
    }

    // Keep the stored subscription language in sync when the user switches
    // language, so future push notifications arrive translated.
    async function updatePushLang() {
      try {
        if (!pushSupported() || !currentUser) return;
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        if (!sub) return;
        await supa.from('push_subscriptions').update({ lang: currentLang }).eq('endpoint', sub.endpoint);
      } catch (_) { /* best-effort */ }
    }

    async function disablePush() {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await supa.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        await sub.unsubscribe();
      }
    }

    el('pushToggleBtn').addEventListener('click', async () => {
      const btn = el('pushToggleBtn');
      const turningOn = btn.dataset.state !== 'on';
      btn.disabled = true;
      try {
        if (turningOn) { await enablePush(); showToast(t('settings.push.enabled_toast')); }
        else { await disablePush(); showToast(t('settings.push.disabled_toast')); }
      } catch (err) {
        uiAlert(t('settings.push.error') + ': ' + (err.message || err));
      } finally {
        btn.disabled = false;
        updatePushUI();
      }
    });

    setTimeout(updatePushUI, 1200);
    // Align an existing subscription's language with the current UI on open.
    setTimeout(updatePushLang, 2500);

    function renderNotifications() {
      const list = el('notifsList');
      if (!list) return;
      if (state.notifications.length === 0) {
        list.innerHTML = `<div class="empty" style="padding:20px 0;"><p>Nicio notificare nouă.</p></div>`;
        return;
      }
      list.innerHTML = state.notifications.map(n => `
        <div class="notif-item">
          <div class="t">${escape(n.title)}</div>
          <div class="b">${escape(n.body)}</div>
          <div class="m">${n.time}</div>
        </div>
      `).join('');
    }

    el('notifPanelBtn').addEventListener('click', () => {
      el('notifPanelBtn').classList.remove('has-unread');
      renderNotifications();
      openModal('notifs');
    });

    el('clearNotifsBtn').addEventListener('click', () => {
      state.notifications = [];
      renderNotifications();
    });

    // ==============================================================
    // DETAIL MODALS (Task / Car)
    // ==============================================================
    supa.auth.getUser().then(({ data }) => { if (data?.user?.email) authState.email = data.user.email; });

    let openTaskDetailId = null;
    let openCarDetailId  = null;

    // ----- CUSTOM DIALOGS (in-app replacement for native alert/confirm) -----
    // Native dialogs look jarring inside the Android WebView; these reuse the
    // app's design language. uiAlert resolves when dismissed; uiConfirm
    // resolves true/false.
    let _dialogResolve = null;
    function _dialogClose(result) {
      const back = el('uiDialog');
      back.classList.remove('show');
      const r = _dialogResolve; _dialogResolve = null;
      if (r) r(result);
    }
    let _dialogInput = false;
    let _dialogSelect = false;
    function uiDialog({ title = '', message = '', okLabel = 'OK', cancelLabel = null, danger = false, input = false, inputValue = '', inputPlaceholder = '', choices = null, pickPlaceholder = '' }) {
      return new Promise((resolve) => {
        // A dialog opened over another one settles the previous as cancelled.
        if (_dialogResolve) _dialogClose(input ? null : false);
        _dialogResolve = resolve;
        _dialogInput = !!input;
        _dialogSelect = !!choices;
        el('uiDialogTitle').textContent = title;
        el('uiDialogTitle').style.display = title ? 'block' : 'none';
        el('uiDialogMessage').textContent = message;
        const inp = el('uiDialogInput');
        if (inp) {
          inp.style.display = input ? 'block' : 'none';
          if (input) { inp.value = inputValue || ''; inp.placeholder = inputPlaceholder || ''; }
        }
        const pick = el('uiDialogPick');
        if (pick) {
          pick.style.display = choices ? 'block' : 'none';
          if (choices) buildPick(choices, pickPlaceholder);
        }
        const ok = el('uiDialogOk');
        const cancel = el('uiDialogCancel');
        ok.textContent = okLabel;
        ok.className = 'ui-dialog-btn ' + (danger ? 'danger' : 'primary');
        // Picking a row is the answer, so there is nothing left to confirm.
        ok.style.display = choices ? 'none' : 'inline-block';
        cancel.style.display = cancelLabel ? 'inline-block' : 'none';
        if (cancelLabel) cancel.textContent = cancelLabel;
        el('uiDialog').classList.add('show');
        if (input && inp) inp.focus();
        // Not the search box: on a phone, focusing it throws the keyboard up
        // over the list you came here to read. It is one tap away when the list
        // is too long to scan, which is the only time it is wanted.
        else if (!choices) ok.focus();
      });
    }
    // Text-input dialog: resolves the entered string, or null on cancel.
    function uiPrompt(message, opts = {}) {
      return uiDialog({
        title: opts.title || '', message,
        okLabel: opts.okLabel || t('common.confirm'),
        cancelLabel: opts.cancelLabel || t('common.cancel'),
        input: true, inputValue: opts.value || '', inputPlaceholder: opts.placeholder || '',
      });
    }
    el('uiDialogOk').addEventListener('click', () => _dialogClose(
      _dialogInput ? (el('uiDialogInput')?.value ?? '') : true));
    el('uiDialogCancel').addEventListener('click', () => _dialogClose(false));
    el('uiDialog').addEventListener('click', (e) => { if (e.target === el('uiDialog')) _dialogClose(false); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && el('uiDialog').classList.contains('show')) _dialogClose(false);
    });
    function uiAlert(message, title = '') {
      return uiDialog({ title, message, okLabel: 'OK' });
    }
    function uiConfirm(message, opts = {}) {
      return uiDialog({
        title: opts.title || '',
        message,
        okLabel: opts.okLabel || t('common.confirm'),
        cancelLabel: opts.cancelLabel || t('common.cancel'),
        danger: opts.danger !== false
      });
    }

    // Pick-one dialog: resolves the chosen value, or false on cancel.
    /**
     * The searchable list inside the dialog.
     *
     * A choice is `{ value, label, sub, search }`: `label` is the line you read,
     * `sub` the quieter one under it, `search` everything worth typing at it —
     * a plate is not on screen but it is the fastest thing to type when a car
     * is standing in front of you.
     *
     * Only the first `PICK_ROWS` matches are put in the DOM. Four hundred rows
     * is a slow dialog and an unreadable one; the note underneath says how many
     * more there are, which is also the nudge to type another letter.
     */
    const PICK_ROWS = 40;
    let _pickChoices = [];
    function pickRows(q) {
      const k = q.trim().toLowerCase();
      const hit = k
        ? _pickChoices.filter((c) => (c.search || c.label || '').toLowerCase().includes(k))
        : _pickChoices;
      const list = el('uiDialogPickList'), note = el('uiDialogPickNote');
      if (!list) return;
      list.innerHTML = hit.slice(0, PICK_ROWS).map((c, i) =>
        `<button type="button" class="ui-pick-row${i ? '' : ' on'}" role="option"`
        + ` data-pick="${escape(String(c.value))}">`
        + `<span class="ui-pick-main">${escape(c.label)}</span>`
        + (c.sub ? `<span class="ui-pick-sub">${escape(c.sub)}</span>` : '')
        + `</button>`).join('');
      if (note) {
        note.textContent = !hit.length ? t('pick.none')
          : hit.length > PICK_ROWS ? t('pick.more', { n: hit.length - PICK_ROWS }) : '';
      }
    }
    function buildPick(choices, placeholder) {
      _pickChoices = choices;
      const box = el('uiDialogPickSearch');
      if (box) { box.value = ''; box.placeholder = placeholder || t('pick.search'); }
      pickRows('');
      el('uiDialogPickList')?.scrollTo?.(0, 0);
    }
    // Tapping a row is the answer. Typing narrows the list; Enter takes the
    // first row still standing, which is what a search box is for.
    el('uiDialogPickList')?.addEventListener('click', (e) => {
      const row = e.target.closest?.('.ui-pick-row');
      if (row) _dialogClose(row.dataset.pick);
    });
    el('uiDialogPickSearch')?.addEventListener('input', (e) => pickRows(e.target.value));
    el('uiDialogPickSearch')?.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const first = el('uiDialogPickList')?.querySelector('.ui-pick-row');
      if (first) _dialogClose(first.dataset.pick);
    });

    function uiChoose(message, choices, opts = {}) {
      if (!choices || !choices.length) return Promise.resolve(false);
      return uiDialog({
        title: opts.title || '', message,
        okLabel: opts.okLabel || t('common.confirm'),
        cancelLabel: opts.cancelLabel || t('common.cancel'),
        danger: false, choices, pickPlaceholder: opts.placeholder || '',
      });
    }

    // Turn a failed write into a message the user can act on. Offline is by far
    // the most common cause in the field, and "Failed to fetch" tells nobody
    // that the edit simply needs retrying once there's signal.
    function writeErrorText(error) {
      const raw = (error && error.message) || String(error || '');
      if (!navigator.onLine || /Failed to fetch|NetworkError|Load failed/i.test(raw)) {
        return t('offline.write_failed');
      }
      return t('common.error') + ': ' + raw;
    }

    function showToast(msg, kind = 'ok') {
      const t = el('modalToast');
      if (!t) return;
      t.textContent = msg;
      t.className = 'modal-toast' + (kind === 'error' ? ' error' : '');
      void t.offsetWidth; // reflow so the draining progress bar restarts
      t.className = 'modal-toast show' + (kind === 'error' ? ' error' : '');
      clearTimeout(t._timer);
      t._timer = setTimeout(() => t.classList.remove('show'), 2600);
    }

    // NOTE: both fmt helpers return PLAIN text — callers are responsible for
    // escaping (they all pass the result through escape()).
    function fieldRow(k, v, opts = {}) {
      const isEmpty = v == null || v === '' || v === undefined;
      const val = isEmpty ? '—' : String(v);
      const dim = isEmpty ? 'dim' : '';
      const wide = opts.wide ? 'wide' : '';
      return `
        <div class="detail-field ${wide}">
          <div class="k">${escape(k)}</div>
          <div class="v ${dim}">${escape(val)}</div>
        </div>`;
    }

    function priorityBadge(p) {
      const map = { 'urgenta': 'red', 'ridicata': 'orange', 'normala': 'blue', 'scazuta': 'green' };
      const key = (p || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const label = typeof localizePriority === 'function' ? localizePriority(p) : (p || 'Normală');
      return `<div class="badge ${map[key] || 'blue'}">${escape(label)}</div>`;
    }

    // Render + wire the checklist inside an open task detail. Read mode shows
    // toggle-only items; pressing "Modifică" reveals add/delete controls.
    // Edit state persists across re-mounts, reset when a task detail opens.
    let _clEdit = false;
    function mountTaskChecklist(task) {
      const box = el('taskChecklistSection');
      if (!box) return;
      const cl = (Array.isArray(task.checklist) ? task.checklist : []).map(x => ({ ...x }));
      const done = cl.filter(x => x && x.done).length;
      const editBtn = `<button class="detail-edit-btn" id="taskChecklistEditBtn">
          ${_clEdit
            ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> ${escape(t('common.save'))}`
            : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> ${escape(t('common.edit'))}`}
        </button>`;
      box.innerHTML = `
        <div class="detail-section-title" style="display:flex;align-items:center;">
          ${escape(t('task.detail.checklist'))}${cl.length ? ` · ${done}/${cl.length}` : ''}
          ${editBtn}
        </div>
        <div class="checklist-view">
          ${cl.length ? cl.map((it, i) => `
            <div class="checklist-item ${it && it.done ? 'done' : ''}">
              <input type="checkbox" data-check-idx="${i}" ${it && it.done ? 'checked' : ''}>
              <span>${escape(it ? it.text : '')}</span>
              ${_clEdit ? `<button type="button" class="checklist-del" data-check-del="${i}" aria-label="Șterge">&times;</button>` : ''}
            </div>`).join('')
            : `<div class="detail-text empty">${escape(t('task.detail.checklist_empty'))}</div>`}
        </div>
        ${_clEdit ? `
        <div class="checklist-add-row" style="margin-top:8px;">
          <input type="text" id="taskChecklistInput" placeholder="${escape(t('modal.add_task.checklist_ph'))}">
          <button type="button" class="btn ghost small" id="taskChecklistAddBtn">+</button>
        </div>` : ''}`;

      const save = async (next) => {
        const { error } = await supa.from('tasks').update({ checklist: next }).eq('id', task.id);
        if (error) { showToast('Eroare: ' + error.message, 'error'); return false; }
        task.checklist = next;
        mountTaskChecklist(task);
        return true;
      };
      el('taskChecklistEditBtn').addEventListener('click', () => {
        _clEdit = !_clEdit;
        mountTaskChecklist(task);
      });
      box.querySelectorAll('input[data-check-idx]').forEach(cb => {
        cb.addEventListener('change', () => {
          const idx = parseInt(cb.dataset.checkIdx, 10);
          const next = cl.map(x => ({ ...x }));
          if (!next[idx]) return;
          next[idx].done = cb.checked;
          save(next);
        });
      });
      if (_clEdit) {
        box.querySelectorAll('[data-check-del]').forEach(btn => {
          btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.checkDel, 10);
            save(cl.filter((_, i) => i !== idx));
          });
        });
        const addItem = () => {
          const input = el('taskChecklistInput');
          const v = (input.value || '').trim();
          if (!v) return;
          save([...cl, { text: v, done: false }]);
        };
        el('taskChecklistAddBtn').addEventListener('click', addItem);
        el('taskChecklistInput').addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { e.preventDefault(); addItem(); }
        });
      }
    }

    // Staff/admin reassignment control inside the task detail. Setting a new
    // assignee updates assigned_to (email) + name/uid, which fires the
    // notify_task_assigned DB trigger → push to the new assignee.
    function mountTaskReassign(task) {
      const box = el('taskReassignRow');
      if (!box) return;
      if (!roleAtLeast('staff')) { box.innerHTML = ''; return; }
      const cur = (task.assigned_to || '').toLowerCase();
      const seen = new Set();
      const opts = [`<option value="">${escape(t('task.reassign.unassigned'))}</option>`];
      (state.profiles || []).forEach(p => {
        if (!p.email || seen.has(p.email.toLowerCase())) return;
        seen.add(p.email.toLowerCase());
        const sel = p.email.toLowerCase() === cur ? ' selected' : '';
        opts.push(`<option value="${escape(p.email)}"${sel}>${escape(p.full_name || p.email.split('@')[0])}</option>`);
      });
      box.innerHTML = `
        <label class="detail-reassign-label" for="taskReassignSelect">${escape(t('task.reassign.label'))}</label>
        <div class="event-picker" style="max-width:100%;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <select id="taskReassignSelect" aria-label="${escape(t('task.reassign.label'))}">${opts.join('')}</select>
        </div>`;
      el('taskReassignSelect').addEventListener('change', async (e) => {
        const email = (e.target.value || '').trim();
        const prof = (state.profiles || []).find(p => (p.email || '').toLowerCase() === email.toLowerCase());
        const patch = email
          ? { assigned_to: email, assigned_user_name: (prof && prof.full_name) || email.split('@')[0], assigned_at: new Date().toISOString() }
          : { assigned_to: null, assigned_user_name: null, assigned_user_id: null, assigned_at: null };
        e.target.disabled = true;
        const { error } = await supa.from('tasks').update(patch).eq('id', task.id);
        e.target.disabled = false;
        if (error) { uiAlert(t('common.error') + ': ' + error.message); return; }
        Object.assign(task, patch);
        showToast(email ? t('task.reassign.done') : t('task.reassign.cleared'));
      });
    }

    // ----- TASK DETAIL -----
    async function showTaskDetail(taskId) {
      const task = state.tasks.find(x => String(x.id) === String(taskId));
      if (!task) return;
      openTaskDetailId = task.id;
      // Hydrate the heavy columns (detailed_description, checklist) the lean
      // list fetch skips — only the first time this row is opened.
      if (!('checklist' in task) && navigator.onLine) {
        try {
          const { data } = await supa.from('tasks').select('*').eq('id', taskId).single();
          if (data) Object.assign(task, data);
        } catch (_) {}
        if (openTaskDetailId !== task.id) return;
      }

      el('taskDetailTitle').textContent = task.title || '—';
      const badges = [
        `<div class="badge ${statusToBadge(task.status)}">${escape(task.status ? localizeTaskStatus(task.status) : '—')}</div>`,
        priorityBadge(task.priority),
        task.category ? `<div class="badge purple">${escape(localizeDept(task.category))}</div>` : ''
      ].join(' ');
      el('taskDetailBadges').innerHTML = badges;

      el('taskDetailBody').innerHTML = `
        <div class="detail-section">
          <div class="detail-section-title">${escape(t('task.detail.section_overview'))}</div>
          <div class="detail-grid">
            ${fieldRow(t('task.detail.due_date'), task.date || task.due_date)}
            ${fieldRow(t('task.detail.priority'), task.priority ? localizePriority(task.priority) : t('task.priority_normal'))}
            ${fieldRow(t('task.detail.category'), task.category ? localizeDept(task.category) : task.category)}
            ${fieldRow(t('task.detail.team'), task.team ? localizeDept(task.team) : task.team)}
            ${fieldRow(t('car.detail.event'), (() => {
              if (!task.event_id) return task.event || null;
              const ev = (state.events || []).find(e => String(e.id) === String(task.event_id));
              return ev ? ev.title : (task.event || '#' + task.event_id);
            })())}
            ${fieldRow(t('task.detail.short_desc'), task.event, { wide: true })}
          </div>
        </div>

        <div class="detail-section">
          <div class="detail-section-title" style="display:flex;align-items:center;">
            ${escape(t('task.detail.section_todo'))}
            <button class="detail-edit-btn" id="taskEditInstructionsBtn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              ${escape(t('common.edit'))}
            </button>
          </div>
          <div id="taskInstructionsView">
            ${task.detailed_description
              ? `<div class="detail-text">${escape(task.detailed_description)}</div>`
              : `<div class="detail-text empty">${escape(t('task.detail.no_instructions'))}</div>`}
          </div>
        </div>

        <div class="detail-section" id="taskChecklistSection"></div>

        <div class="detail-section">
          <div class="detail-section-title">${escape(t('task.detail.section_trace'))}</div>
          <div class="detail-grid">
            ${fieldRow(t('task.detail.created_by'), task.created_by)}
            ${fieldRow(t('task.detail.created_at'), fmtDateTime(task.created_at))}
            ${fieldRow(t('task.detail.assigned_user'), task.assigned_user_name)}
            ${fieldRow(t('task.detail.started_at'), fmtDateTime(task.started_at))}
            ${fieldRow(t('task.detail.completed_by'), task.completed_by_user_name)}
            ${fieldRow(t('task.detail.completed_at'), fmtDateTime(task.completed_at))}
          </div>
          <div id="taskReassignRow" style="margin-top:10px;"></div>
        </div>

        <div class="detail-section">
          <div class="detail-section-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            ${escape(t('task.detail.updates_section'))}
          </div>
          <div id="taskUpdatesList"><div class="empty" style="padding:12px 0;color:var(--text-mute);font-size:13px;">${escape(t('task.detail.updates_loading'))}</div></div>
          <div class="update-composer">
            <textarea id="taskUpdateInput" rows="2" placeholder="${escape(t('task.detail.update_placeholder'))}"></textarea>
            <div class="mention-chips" id="taskMentionChips"></div>
          </div>
          <div style="display:flex;justify-content:flex-end;margin-top:8px;">
            <button class="btn small" id="taskUpdateSubmit">${escape(t('task.detail.add_update'))}</button>
          </div>
        </div>

        <div class="detail-section">
          <div class="detail-section-title">${escape(t('history.title'))}</div>
          <div id="taskHistoryList" class="history-list">
            <div class="empty" style="color:var(--text-mute);font-size:12px;">${escape(t('history.loading'))}</div>
          </div>
        </div>
      `;

      loadActivityLog('task', task.id, 'taskHistoryList');
      mountTaskReassign(task);

      // Checklist starts in read (toggle-only) mode; "Modifică" reveals editing.
      _clEdit = false;
      mountTaskChecklist(task);

      // Actions — contextual buttons based on task state
      const isDone = !!task.is_completed;
      const sk = taskStatusKey(task.status);
      const isAssignedToMe = currentUser && String(task.assigned_user_id) === String(currentUser.id);
      const admin = isAdmin();
      // Only staff/admin may delete tasks (DB enforces it too).
      const delBtn = roleAtLeast('staff')
        ? `<button class="btn danger" data-detail-action="task-delete" data-task-id="${task.id}" data-task-label="${escape(task.title)}">${escape(t('task.action.delete'))}</button>`
        : '';

      let actionsHtml = '';
      if (isDone) {
        actionsHtml = `
          <button class="btn ghost" data-detail-action="task-reopen" data-task-id="${task.id}">${escape(t('task.action.reopen'))}</button>
          ${delBtn}
        `;
      } else if (sk === 'in_progress') {
        // Butonul "Finisat" apare doar pentru cel responsabil sau admin
        if (isAssignedToMe || admin) {
          actionsHtml += `
            <button class="btn" data-detail-action="task-finish" data-task-id="${task.id}">${escape(t('task.action.finish'))}</button>
          `;
        }
        actionsHtml += delBtn;
      } else {
        actionsHtml = `
          <button class="btn" data-detail-action="task-take" data-task-id="${task.id}">${escape(t('task.action.take'))}</button>
          ${delBtn}
        `;
      }
      el('taskDetailActions').innerHTML = actionsHtml;

      // Wire edit button + submit
      el('taskEditInstructionsBtn').onclick = () => enterEditTaskInstructions(task);
      el('taskUpdateSubmit').onclick = () => submitTaskUpdate(task.id);
      el('taskUpdateInput').addEventListener('keydown', (ev) => {
        if ((ev.metaKey || ev.ctrlKey) && ev.key === 'Enter') { ev.preventDefault(); submitTaskUpdate(task.id); }
      });
      renderMentionChips();

      openModal('task-detail');
      refreshTaskUpdates(task.id);
    }

    function enterEditTaskInstructions(task) {
      const view = el('taskInstructionsView');
      const current = task.detailed_description || '';
      view.innerHTML = `
        <textarea class="detail-textarea" id="taskInstructionsInput" rows="6"
          placeholder="${escape(t('task.detail.instructions_placeholder'))}">${escape(current)}</textarea>
        <div class="detail-inline-actions">
          <button class="btn ghost small" id="taskInstructionsCancel">${escape(t('common.cancel'))}</button>
          <button class="btn small" id="taskInstructionsSave">${escape(t('common.save'))}</button>
        </div>`;
      el('taskEditInstructionsBtn').style.display = 'none';
      el('taskInstructionsCancel').onclick = () => showTaskDetail(task.id); // rerender = cancel
      el('taskInstructionsSave').onclick = async () => {
        const btn = el('taskInstructionsSave');
        btn.disabled = true;
        const newVal = el('taskInstructionsInput').value.trim();
        const { error } = await supa.from('tasks').update({ detailed_description: newVal || null }).eq('id', task.id);
        if (error) { showToast('Eroare: ' + error.message, 'error'); btn.disabled = false; return; }
        showToast(t('toast.saved'));
        task.detailed_description = newVal;
        await loadData();
        showTaskDetail(task.id);
      };
      el('taskInstructionsInput').focus();
    }

    // #4 — a car's journey as a vertical stepper: Invitat → Sosit → Plecat.
    // Reached state comes from the current status; timestamps are enriched from
    // the activity log (first time each state was reached).
    async function loadCarTimeline(car, containerId) {
      const box = el(containerId);
      if (!box) return;
      const order = ['invitat', 'sosit'];
      const reached = Math.max(0, order.indexOf(statusKey(car.status) || 'invitat'));
      const times = { invitat: car.created_at || null, sosit: null };
      try {
        const { data } = await supa.from('activity_log')
          .select('new_value,created_at').eq('entity', 'car').eq('entity_id', car.id)
          .eq('action', 'status').order('id', { ascending: true });
        (data || []).forEach(r => {
          const k = statusKey(r.new_value);
          if (k && times[k] == null) times[k] = r.created_at;
        });
      } catch (_) {}
      if (!el(containerId)) return; // modal switched entities
      const steps = [
        { key: 'invitat', label: t('car.timeline.invited') },
        { key: 'sosit',   label: t('car.timeline.arrived') },
      ];
      box.innerHTML = steps.map((s, i) => {
        const done = i <= reached, current = i === reached;
        const time = times[s.key] ? fmtDateTime(times[s.key]) : '';
        return `<div class="tl-step ${done ? 'done' : ''}${current ? ' current' : ''}">
          <div class="tl-marker"></div>
          <div class="tl-body">
            <div class="tl-label">${escape(s.label)}</div>
            ${time ? `<div class="tl-time">${escape(time)}</div>` : `<div class="tl-time muted">${escape(t('car.timeline.pending'))}</div>`}
          </div>
        </div>`;
      }).join('');
    }

    // Render the audit trail for one entity into a container. Rows are
    // populated server-side by DB triggers (read-only for the client).
    async function loadActivityLog(entity, entityId, containerId) {
      const c = el(containerId);
      if (!c) return;
      const { data, error } = await supa.from('activity_log')
        .select('*').eq('entity', entity).eq('entity_id', entityId)
        .order('id', { ascending: false }).limit(50);
      if (!el(containerId)) return; // modal may have switched entities
      if (error) {
        c.innerHTML = `<div class="empty" style="color:var(--red);font-size:12px;">${escape(error.message)}</div>`;
        return;
      }
      if (!data.length) {
        c.innerHTML = `<div class="empty" style="color:var(--text-mute);font-size:12px;">${escape(t('history.empty'))}</div>`;
        return;
      }
      const who = (e) => escape((e || '').split('@')[0] || t('history.nobody'));
      const dash = (v) => (v && v.trim()) ? escape(v) : '—';
      c.innerHTML = data.map(row => {
        let line;
        switch (row.action) {
          case 'created':  line = `<strong>${who(row.user_email)}</strong> ${escape(t('history.created'))}`; break;
          case 'deleted':  line = `<strong>${who(row.user_email)}</strong> ${escape(t('history.deleted'))}`; break;
          case 'status':   line = `<strong>${who(row.user_email)}</strong> ${escape(t('history.status'))}: ${dash(row.old_value)} → ${dash(row.new_value)}`; break;
          case 'zone':     line = `<strong>${who(row.user_email)}</strong> ${escape(t('history.zone'))}: ${dash(row.old_value)} → ${dash(row.new_value)}`; break;
          case 'assigned': line = `<strong>${who(row.user_email)}</strong> ${escape(t('history.assigned'))}: ${dash(row.old_value)} → ${dash(row.new_value)}`; break;
          default:         line = `<strong>${who(row.user_email)}</strong> ${escape(row.action)}`;
        }
        return `<div class="history-item">
          <div class="history-dot"></div>
          <div class="history-body"><div class="history-line">${line}</div>
          <div class="history-time">${escape(fmtRelative(row.created_at))}</div></div>
        </div>`;
      }).join('');
    }

    // ----- @mentions in comments (#6) -----
    function mentionHandle(email) { return (email || '').split('@')[0]; }
    function renderMentionChips() {
      const box = el('taskMentionChips');
      if (!box) return;
      const me = (currentUserEmail() || '').toLowerCase();
      const seen = new Set();
      const members = (state.profiles || []).filter(p => {
        if (!p.email) return false;
        const k = p.email.toLowerCase();
        if (k === me || seen.has(k)) return false;
        seen.add(k); return true;
      });
      if (!members.length) { box.innerHTML = ''; return; }
      box.innerHTML = `<span class="mention-hint">${escape(t('mention.hint'))}</span>` +
        members.slice(0, 8).map(p => {
          const handle = mentionHandle(p.email);
          const name = p.full_name || handle;
          return `<button type="button" class="mention-chip" data-mention="${escape(handle)}">@${escape(name)}</button>`;
        }).join('');
    }
    // Style @handles that match a team member in displayed comment text.
    function renderCommentText(text) {
      return escape(text).replace(/@([A-Za-z0-9._-]+)/g, (m, h) => {
        const prof = (state.profiles || []).find(p => (p.email || '').split('@')[0].toLowerCase() === h.toLowerCase());
        if (!prof) return m;
        return `<span class="mention">@${escape(prof.full_name || h)}</span>`;
      });
    }
    // Insert an @handle into the comment box when a mention chip is tapped.
    document.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-mention]');
      if (!chip) return;
      const input = el('taskUpdateInput');
      if (!input) return;
      const h = chip.dataset.mention;
      const pos = (input.selectionStart != null) ? input.selectionStart : input.value.length;
      const before = input.value.slice(0, pos), after = input.value.slice(pos);
      const sep = (before && !before.endsWith(' ')) ? ' ' : '';
      const insert = sep + '@' + h + ' ';
      input.value = before + insert + after;
      input.focus();
      const np = (before + insert).length;
      try { input.setSelectionRange(np, np); } catch (_) {}
    });

    async function refreshTaskUpdates(taskId) {
      const { data, error } = await supa.from('task_updates')
        .select('*').eq('task_id', taskId).order('created_at', { ascending: false });
      const c = el('taskUpdatesList');
      if (!c) return;
      if (error) { c.innerHTML = `<div class="empty" style="color:var(--red);">${escape(error.message)}</div>`; return; }
      if (!data.length) {
        c.innerHTML = `<div class="empty" style="padding:14px 0;color:var(--text-mute);font-size:13px;">${escape(t('task.detail.no_updates'))}</div>`;
        return;
      }
      const me = currentUserEmail();
      c.innerHTML = data.map(u => `
        <div class="update">
          <div class="update-avatar">${escape(((u.user_name || u.user_email || '?').charAt(0) || '?').toUpperCase())}</div>
          <div class="update-body">
            <div class="update-head">
              <span class="update-name">${escape(u.user_name || u.user_email || 'Anonim')}</span>
              <span class="update-time" title="${escape(fmtDateTime(u.created_at))}">${escape(fmtRelative(u.created_at))}</span>
              ${u.user_email === me ? `<button class="update-delete" data-update-delete="${u.id}" title="Șterge">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
              </button>` : ''}
            </div>
            <div class="update-msg">${renderCommentText(u.message)}</div>
          </div>
        </div>
      `).join('');
    }

    async function submitTaskUpdate(taskId) {
      const input = el('taskUpdateInput');
      const msg = (input.value || '').trim();
      if (!msg) return;
      const btn = el('taskUpdateSubmit');
      btn.disabled = true;
      const { error } = await supa.from('task_updates').insert({
        task_id: taskId,
        user_email: currentUserEmail(),
        user_name: currentUserName(),
        message: msg
      });
      btn.disabled = false;
      if (error) { showToast('Eroare: ' + error.message, 'error'); return; }
      input.value = '';
      refreshTaskUpdates(taskId);
    }

    // Normalize a phone to international digits (Moldova default: +373).
    // Local numbers like 0XXXXXXXX or 6XXXXXXX get the 373 country code.
    // WhatsApp + Call + Telegram buttons for a car's owner, with a pre-filled message.
    function contactButtons(c) {
      const phone = normalizePhone(c.phone || c.contact);
      // Prefer an explicit Telegram username; fall back to the phone number.
      const tg = telegramLink(c.telegram) || (phone ? `https://t.me/+${phone}` : '');
      if (!phone && !tg) return '';
      const ev = (state.events || []).find(e => String(e.id) === String(c.event_id));
      const carName = [c.brand, c.model].filter(Boolean).join(' ') || c.model || '';
      const parts = [`Bună${c.owner ? ' ' + c.owner : ''}!`];
      if (ev?.title) parts.push(`Vă contactăm în legătură cu evenimentul ${ev.title}.`);
      if (carName) parts.push(`Mașină: ${carName}${c.plate ? ' (' + c.plate + ')' : ''}.`);
      if (c.zone) parts.push(`Zona dvs. de parcare: ${c.zone}.`);
      // Attach the participant's personal ticket (QR) link so it's ready to send.
      const ticket = ticketUrl(c);
      parts.push(`Biletul dvs.: ${ticket}`);
      const message = parts.join(' ');
      const msg = encodeURIComponent(message);
      const wa = phone ? `https://wa.me/${phone}?text=${msg}` : '';
      const tel = phone ? `tel:+${phone}` : '';
      const waBtn = wa ? `
        <a class="btn ghost contact-wa" href="${wa}" target="_blank" rel="noopener">
          <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm5.8 14.01c-.24.68-1.42 1.31-1.96 1.35-.5.05-.96.23-3.23-.67-2.73-1.08-4.45-3.88-4.58-4.06-.13-.18-1.1-1.46-1.1-2.79 0-1.33.7-1.98.94-2.25.24-.27.53-.34.7-.34.18 0 .35 0 .5.01.16.01.38-.06.59.45.24.58.81 2 .88 2.14.07.14.12.31.02.49-.09.18-.14.29-.28.45-.14.16-.29.36-.42.48-.14.14-.28.29-.12.56.16.27.71 1.17 1.53 1.9 1.05.94 1.94 1.23 2.21 1.37.27.14.43.12.59-.07.16-.18.68-.79.86-1.07.18-.27.36-.22.6-.13.24.09 1.55.73 1.81.86.27.14.44.2.5.31.07.11.07.63-.17 1.31z"/></svg>
          WhatsApp
        </a>` : '';
      const tgBtn = tg ? `
        <a class="btn ghost contact-tg" href="${tg}" target="_blank" rel="noopener" data-tg-msg="${escape(message)}">
          <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M21.94 4.58 18.9 19.2c-.23 1.02-.83 1.27-1.68.79l-4.64-3.42-2.24 2.16c-.25.25-.46.46-.94.46l.33-4.73 8.6-7.77c.37-.33-.08-.52-.58-.19L7.25 13.1l-4.58-1.43c-1-.31-1.02-1 .21-1.48L20.65 3.2c.83-.31 1.56.19 1.29 1.38z"/></svg>
          Telegram
        </a>` : '';
      const telBtn = tel ? `
        <a class="btn ghost" href="${tel}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          ${escape(t('car.contact.call'))}
        </a>` : '';
      return waBtn + tgBtn + telBtn;
    }

    // Telegram can't pre-fill a direct chat via URL, so when the Telegram
    // contact button is tapped we copy the message (with the ticket link) to
    // the clipboard — the sender just pastes it into the chat that opens.
    document.addEventListener('click', (e) => {
      const tgLink = e.target.closest && e.target.closest('.contact-tg');
      if (!tgLink) return;
      const text = tgLink.getAttribute('data-tg-msg') || '';
      if (!text) return;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(
            () => { try { showToast(t('car.contact.tg_copied')); } catch (_) {} },
            () => {}
          );
        }
      } catch (_) {}
    });

    // ----- CAR DETAIL -----
    async function showCarDetail(carId) {
      const c = state.cars.find(x => String(x.id) === String(carId));
      if (!c) return;
      openCarDetailId = c.id;
      // Hydrate the heavy columns (photos, notes, modifications, …) the lean
      // list fetch skips — only the first time this row is opened.
      if (!('photos' in c) && navigator.onLine) {
        try {
          const { data } = await supa.from('cars').select('*').eq('id', carId).single();
          if (data) Object.assign(c, data);
        } catch (_) {}
        if (openCarDetailId !== c.id) return; // detail closed/switched while fetching
      }

      const title = [c.brand, c.model].filter(Boolean).join(' ') || c.model || '—';
      el('carDetailTitle').textContent = title;
      const carBlockReason = plateBlocked(c.plate);
      const badges = [
        `<div class="badge ${statusToBadge(c.status)}">${escape(c.status ? localizeCarStatus(c.status) : '—')}</div>`,
        c.is_vip ? `<div class="badge purple">VIP</div>` : '',
        c.category ? `<div class="badge blue">${escape(localizeDept(c.category))}</div>` : '',
        carBlockReason !== null ? `<div class="badge red">⛔ ${escape(t('block.badge'))}</div>` : ''
      ].filter(Boolean).join(' ');
      el('carDetailBadges').innerHTML = badges;
      // Spelled out in full at the top of the body too: the badge says *that*
      // it is blocked, this says *why*.
      const blockWarnHtml = carBlockReason !== null
        ? `<div class="block-warn"><strong>⛔ ${escape(t('block.warn'))}</strong>`
          + (carBlockReason ? `<span>${escape(carBlockReason)}</span>` : '') + `</div>`
        : '';

      const photos = Array.isArray(c.photos) ? c.photos : [];
      const photosHtml = `
        <div class="detail-photos" id="carPhotosGrid">
          ${photos.map((p, i) => `
            <div class="detail-photo-wrap">
              <img src="${escape(p)}" alt="" class="detail-photo img-blur" loading="lazy" decoding="async" data-photo-view="${escape(p)}" onload="this.classList.add('loaded')">
              <button type="button" class="detail-photo-del" data-photo-del="${i}" title="${escape(t('common.delete'))}">&times;</button>
            </div>`).join('')}
          <button type="button" class="detail-photo-add" id="carPhotoAddBtn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span>${escape(t('car.photos.add'))}</span>
          </button>
        </div>
        <input type="file" id="carPhotoInput" accept="image/*" multiple style="display:none">
        <div class="detail-photo-status" id="carPhotoStatus"></div>`;

      el('carDetailBody').innerHTML = `
        ${blockWarnHtml}
        <div class="detail-section">
          <div class="detail-section-title">${escape(t('car.detail.section_photos'))}</div>
          ${photosHtml}
        </div>

        <div class="detail-section">
          <div class="detail-section-title">${escape(t('car.timeline.title'))}</div>
          <div class="car-timeline" id="carTimeline"></div>
        </div>

        <div class="detail-section">
          <div class="detail-section-title">${escape(t('car.detail.section_zone'))}</div>
          <div id="carZoneView">
            <select class="detail-select" id="carZoneInput" aria-label="${escape(t('car.detail.section_zone'))}">${zoneOptionsHTML(c.zone)}</select>
          </div>
        </div>

        <div class="detail-section">
          <div class="detail-section-title">${escape(t('car.detail.section_car'))}</div>
          <div class="detail-grid">
            ${fieldRow(t('car.entry_no'), c.entry_no ? '#' + c.entry_no : null)}
            ${fieldRow(t('car.rsvp'), c.rsvp
              ? (c.rsvp === 'yes' ? t('car.rsvp_yes') : t('car.rsvp_no'))
                + (c.rsvp_at ? ' · ' + fmtDateTime(c.rsvp_at) : '')
              : null)}
            ${fieldRow('Telegram', c.telegram_chat_id ? t('tg.linked') : t('tg.not_linked'))}
            ${fieldRow(t('car.detail.spot'), c.spot_no ? (c.zone ? c.zone + ' · ' : '') + t('spots.spot_n', { n: c.spot_no }) : null)}
            ${fieldRow(t('car.detail.brand'), c.brand)}
            ${fieldRow(t('car.detail.model'), c.model)}
            ${fieldRow(t('car.detail.year'), c.year)}
            ${fieldRow(t('car.detail.color'), c.color)}
            ${fieldRow(t('car.detail.category'), c.category ? localizeDept(c.category) : c.category)}
            ${fieldRow(t('car.detail.plate'), c.plate)}
            ${fieldRow(t('car.detail.event'), (() => {
              if (!c.event_id) return null;
              const ev = (state.events || []).find(e => String(e.id) === String(c.event_id));
              return ev ? ev.title : ('#' + c.event_id);
            })())}
          </div>
        </div>

        <div class="detail-section">
          <div class="detail-section-title">${escape(t('car.detail.section_owner'))}</div>
          <div class="detail-grid">
            ${fieldRow(t('car.detail.name'), c.owner)}
            ${fieldRow(t('car.detail.phone'), c.phone || c.contact)}
            ${fieldRow(t('car.detail.telegram'), c.telegram)}
            ${fieldRow(t('car.detail.email'), c.email)}
            ${fieldRow(t('car.detail.city_country'), c.city)}
          </div>
        </div>

        <div class="detail-section">
          <div class="detail-section-title">${escape(t('car.detail.section_tech'))}</div>
          <div class="detail-grid">
            <div class="detail-field wide">
              <div class="k">${escape(t('car.detail.mods'))}</div>
              <div class="v ${c.modifications ? '' : 'dim'}">${escape(c.modifications || '—')}</div>
            </div>
          </div>
        </div>

        <div class="detail-section">
          <div class="detail-section-title">${escape(t('car.detail.section_org'))}</div>
          <div class="detail-grid">
            ${fieldRow(t('car.detail.registered_at'), fmtDateTime(c.created_at))}
            ${fieldRow(t('car.detail.transport'), c.transport_info, { wide: true })}
            ${fieldRow(t('car.detail.social'), c.social_links, { wide: true })}
          </div>
        </div>

        <div class="detail-section">
          <div class="detail-section-title" style="display:flex;align-items:center;">
            ${escape(t('car.detail.section_notes'))}
            <button class="detail-edit-btn" id="carEditNotesBtn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              ${escape(t('common.edit'))}
            </button>
          </div>
          <div id="carNotesView">
            ${c.additional_notes
              ? `<div class="detail-text">${escape(c.additional_notes)}</div>`
              : `<div class="detail-text empty">${escape(t('car.detail.notes_empty'))}</div>`}
          </div>
        </div>

        <div class="detail-section">
          <div class="detail-section-title">${escape(t('history.title'))}</div>
          <div id="carHistoryList" class="history-list">
            <div class="empty" style="color:var(--text-mute);font-size:12px;">${escape(t('history.loading'))}</div>
          </div>
        </div>
      `;

      loadActivityLog('car', c.id, 'carHistoryList');
      loadCarTimeline(c, 'carTimeline');

      const canDelete = roleAtLeast('staff');
      el('carDetailActions').innerHTML = `
        ${contactButtons(c)}
        <button class="btn ghost" data-detail-action="car-qr" data-car-id="${c.id}">${escape(t('car.detail.qr'))}</button>
        <button class="btn ghost" data-detail-action="car-ticket" data-car-id="${c.id}">${escape(t('car.detail.ticket'))}</button>
        ${roleAtLeast('staff') && (c.phone || c.contact) ? `<button class="btn ghost" data-detail-action="car-sms" data-car-id="${c.id}">${escape(t('car.detail.sms'))}</button>` : ''}
        ${roleAtLeast('staff') && !c.telegram_chat_id
          ? `<button class="btn ghost" data-detail-action="car-invite-tg" data-car-id="${c.id}">${
            escape(normalizePhone(c.phone || c.contact) ? t('tg.invite_send') : t('tg.invite_one'))}</button>`
          + `<button class="btn ghost" data-detail-action="car-invite-qr" data-car-id="${c.id}">${escape(t('tg.qr_short'))}</button>`
          : ''}
        ${canDelete ? `<button class="btn danger" data-detail-action="car-delete" data-car-id="${c.id}" data-car-label="${escape(title)}">${escape(t('car.action.delete'))}</button>` : ''}
      `;

      el('carEditNotesBtn').onclick = () => {
        const view = el('carNotesView');
        view.innerHTML = `
          <textarea class="detail-textarea" id="carNotesInput" rows="5"
            placeholder="${escape(t('car.detail.notes_placeholder'))}">${escape(c.additional_notes || '')}</textarea>
          <div class="detail-inline-actions">
            <button class="btn ghost small" id="carNotesCancel">${escape(t('common.cancel'))}</button>
            <button class="btn small" id="carNotesSave">${escape(t('common.save'))}</button>
          </div>`;
        el('carEditNotesBtn').style.display = 'none';
        el('carNotesCancel').onclick = () => showCarDetail(c.id);
        el('carNotesSave').onclick = async () => {
          const btn = el('carNotesSave'); btn.disabled = true;
          const newVal = el('carNotesInput').value.trim();
          const { error } = await supa.from('cars').update({ additional_notes: newVal || null }).eq('id', c.id);
          if (error) { showToast('Eroare: ' + error.message, 'error'); btn.disabled = false; return; }
          showToast(t('car.detail.notes_saved'));
          c.additional_notes = newVal;
          await loadData();
          showCarDetail(c.id);
        };
        el('carNotesInput').focus();
      };

      // Zone: the select is the field, so picking a zone is the save. Keep the
      // previous value around to put back if the write fails — otherwise the
      // dropdown would keep showing a zone the car is not actually in.
      const zoneSel = el('carZoneInput');
      if (zoneSel) zoneSel.onchange = async () => {
        const prev = c.zone || '';
        const newVal = zoneSel.value.trim();
        if (newVal === prev) return;
        zoneSel.disabled = true;
        // A spot number belongs to a zone, so it cannot survive the move: kept,
        // it would either point at a spot that does not exist in the new zone or
        // collide with the car already standing there — and the unique index
        // would refuse the whole change with a raw duplicate-key error.
        const hadSpot = c.spot_no != null;
        // `zone` is NOT NULL with an empty-string default: clearing it means '',
        // not null, or the database refuses the write outright.
        const patch = { zone: newVal };
        if (hadSpot) patch.spot_no = null;
        const { error } = await supa.from('cars').update(patch).eq('id', c.id);
        zoneSel.disabled = false;
        if (error) {
          showToast(t('common.error') + ': ' + error.message, 'error');
          zoneSel.value = prev;
          return;
        }
        showToast(hadSpot ? t('car.detail.zone_saved_spot_freed') : t('car.detail.zone_saved'));
        c.zone = newVal;
        if (hadSpot) c.spot_no = null;
        const row = (state.cars || []).find(x => String(x.id) === String(c.id));
        if (row) { row.zone = newVal; if (hadSpot) row.spot_no = null; }
        renderCars(); renderZoneBoard();
        try { renderMapSpots(); } catch (_) {}
        if (hadSpot) showCarDetail(c.id);
      };

      // ----- Photos: upload / view / delete -----
      el('carPhotoAddBtn').onclick = () => el('carPhotoInput').click();
      el('carPhotoInput').onchange = async (e) => {
        const files = [...(e.target.files || [])];
        if (!files.length) return;
        const status = el('carPhotoStatus');
        status.textContent = t('car.photos.uploading');
        el('carPhotoAddBtn').disabled = true;
        try {
          const urls = [];
          for (const f of files) {
            const blob = await downscaleImage(f);
            const path = `${c.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
            const { error } = await supa.storage.from('car-photos')
              .upload(path, blob, { contentType: 'image/jpeg' });
            if (error) throw error;
            urls.push(supa.storage.from('car-photos').getPublicUrl(path).data.publicUrl);
          }
          const { error: upErr } = await supa.from('cars')
            .update({ photos: [...photos, ...urls] }).eq('id', c.id);
          if (upErr) throw upErr;
          _carPhotos = null; // refresh row backgrounds
          await loadData();
          showCarDetail(c.id);
        } catch (err) {
          status.textContent = '';
          el('carPhotoAddBtn').disabled = false;
          uiAlert(t('car.photos.upload_error') + ': ' + (err.message || err));
        }
      };
      el('carDetailBody').querySelectorAll('[data-photo-del]').forEach(b => {
        b.onclick = async (ev) => {
          ev.stopPropagation();
          if (!(await uiConfirm(t('car.photos.confirm_delete')))) return;
          const idx = parseInt(b.dataset.photoDel, 10);
          const url = photos[idx];
          const { error } = await supa.from('cars')
            .update({ photos: photos.filter((_, i2) => i2 !== idx) }).eq('id', c.id);
          if (error) return uiAlert('Eroare: ' + error.message);
          _carPhotos = null; // refresh row backgrounds
          // Best-effort storage cleanup — the DB row is the source of truth.
          const objPath = (url || '').split('/car-photos/')[1];
          if (objPath) supa.storage.from('car-photos').remove([decodeURIComponent(objPath)]);
          await loadData();
          showCarDetail(c.id);
        };
      });
      el('carDetailBody').querySelectorAll('[data-photo-view]').forEach((img, i) => {
        img.onclick = () => openLightbox(photos, i);
      });

      // Members are viewers: hide the inline edit affordances (notes/photos).
      if (!roleAtLeast('staff')) {
        ['carEditNotesBtn', 'carPhotoAddBtn'].forEach(id => { const b = el(id); if (b) b.style.display = 'none'; });
        // The zone is a live field now, not something behind an Edit button, so
        // it has to be disabled rather than hidden — otherwise a member is
        // handed a control whose every use the database refuses.
        const zs = el('carZoneInput'); if (zs) zs.disabled = true;
        el('carDetailBody').querySelectorAll('[data-photo-del]').forEach(b => { b.style.display = 'none'; });
      }

      openModal('car-detail');
    }

    // Downscale an image client-side before upload (max 1600px, JPEG 82%).
    // Falls back to the original file for formats canvas can't decode (HEIC).
    // Photo lightbox — a swipeable gallery. Accepts a single URL or a list of
    // URLs plus the index to open at. Prev/next via arrows, swipe or keyboard.
    let _lbUrls = [], _lbIdx = 0;
    function openLightbox(urls, index = 0) {
      _lbUrls = Array.isArray(urls) ? urls.slice() : [urls];
      _lbIdx = Math.max(0, Math.min(_lbUrls.length - 1, index));
      let lb = document.getElementById('photoLightbox');
      if (!lb) {
        lb = document.createElement('div');
        lb.id = 'photoLightbox';
        lb.className = 'photo-lightbox';
        lb.innerHTML = `
          <button class="lb-close" type="button" aria-label="×">&times;</button>
          <button class="lb-nav lb-prev" type="button" aria-label="‹">&#8249;</button>
          <img alt="">
          <button class="lb-nav lb-next" type="button" aria-label="›">&#8250;</button>
          <div class="lb-count"></div>`;
        lb.addEventListener('click', (e) => {
          if (e.target === lb || e.target.closest('.lb-close')) lb.classList.remove('show');
          else if (e.target.closest('.lb-prev')) lbGo(-1);
          else if (e.target.closest('.lb-next')) lbGo(1);
        });
        // Pinch-zoom + pan + double-tap zoom; horizontal swipe navigates only
        // when the image isn't zoomed in.
        initLightboxZoom(lb);
        document.addEventListener('keydown', (e) => {
          if (!lb.classList.contains('show')) return;
          if (e.key === 'Escape') lb.classList.remove('show');
          else if (e.key === 'ArrowLeft') lbGo(-1);
          else if (e.key === 'ArrowRight') lbGo(1);
        });
        document.body.appendChild(lb);
      }
      lbRender();
      lb.classList.add('show');
    }
    function lbGo(delta) {
      if (_lbUrls.length < 2) return;
      _lbIdx = (_lbIdx + delta + _lbUrls.length) % _lbUrls.length;
      lbRender();
    }
    function lbRender() {
      const lb = document.getElementById('photoLightbox');
      if (!lb) return;
      lb.querySelector('img').src = _lbUrls[_lbIdx] || '';
      if (lb._lbReset) lb._lbReset(); // reset zoom/pan on image change
      const multi = _lbUrls.length > 1;
      lb.querySelectorAll('.lb-nav').forEach(b => b.style.display = multi ? '' : 'none');
      const cnt = lb.querySelector('.lb-count');
      if (cnt) { cnt.style.display = multi ? '' : 'none'; cnt.textContent = `${_lbIdx + 1} / ${_lbUrls.length}`; }
    }

    // Pinch-to-zoom / pan / double-tap zoom for the lightbox image.
    let _lbScale = 1, _lbTx = 0, _lbTy = 0;
    function initLightboxZoom(lb) {
      const img = lb.querySelector('img');
      if (!img) return;
      const pts = new Map();
      let startDist = 0, startScale = 1, startTx = 0, startTy = 0;
      let panX = 0, panY = 0, downX = 0, downY = 0, lastTap = 0;
      const apply = () => { img.style.transform = `translate(${_lbTx}px,${_lbTy}px) scale(${_lbScale})`; };
      const reset = () => { _lbScale = 1; _lbTx = 0; _lbTy = 0; img.style.transition = 'transform .2s ease'; apply(); };
      lb._lbReset = reset;
      img.addEventListener('pointerdown', (e) => {
        try { img.setPointerCapture(e.pointerId); } catch (_) {}
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        img.style.transition = 'none';
        downX = e.clientX; downY = e.clientY;
        if (pts.size === 2) {
          const [a, b] = [...pts.values()];
          startDist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
          startScale = _lbScale; startTx = _lbTx; startTy = _lbTy;
        } else { panX = e.clientX; panY = e.clientY; startTx = _lbTx; startTy = _lbTy; }
      });
      img.addEventListener('pointermove', (e) => {
        if (!pts.has(e.pointerId)) return;
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pts.size === 2) {
          const [a, b] = [...pts.values()];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          _lbScale = Math.max(1, Math.min(5, startScale * (dist / startDist)));
          apply();
        } else if (pts.size === 1 && _lbScale > 1.02) {
          _lbTx = startTx + (e.clientX - panX);
          _lbTy = startTy + (e.clientY - panY);
          apply();
        }
      });
      const up = (e) => {
        const wasZoomed = _lbScale > 1.02;
        if (pts.has(e.pointerId)) pts.delete(e.pointerId);
        // Pinch → single-finger pan: re-anchor to the remaining pointer so the
        // image doesn't jump when one of two fingers lifts.
        if (pts.size === 1) {
          const [p] = [...pts.values()];
          panX = p.x; panY = p.y; startTx = _lbTx; startTy = _lbTy;
        }
        if (_lbScale <= 1.02) reset();
        // Swipe to navigate only when not zoomed.
        if (pts.size === 0 && !wasZoomed) {
          const dx = e.clientX - downX, dy = e.clientY - downY;
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) lbGo(dx < 0 ? 1 : -1);
        }
      };
      img.addEventListener('pointerup', up);
      img.addEventListener('pointercancel', up);
      // Double-tap / double-click toggles zoom.
      img.addEventListener('click', (e) => {
        e.stopPropagation();
        const now = Date.now();
        if (now - lastTap < 300) {
          img.style.transition = 'transform .2s ease';
          if (_lbScale > 1.02) reset(); else { _lbScale = 2.5; apply(); }
        }
        lastTap = now;
      });
    }

    // ----- Row click → open detail; ignore action-button clicks -----
    document.addEventListener('click', (ev) => {
      // Skip if clicking any action button, chip, or explicit stop-marked element
      if (ev.target.closest('.action-btn')) return;
      if (ev.target.closest('.chip')) return;
      if (ev.target.closest('.add-btn')) return;
      if (ev.target.closest('[data-close]')) return;
      if (ev.target.closest('.modal-backdrop')) return; // click was inside a modal or on backdrop; other handlers handle it
      // Skip clicks on card action buttons that have their own data-action handler
      const tkBtn = ev.target.closest('.tk-btn');
      if (tkBtn && tkBtn.dataset.action) return; // in-card action button — handled elsewhere

      // The dots button explicitly opens the detail
      if (tkBtn && tkBtn.dataset.openDetail === '1') {
        const row = tkBtn.closest('.tk-card, .task-row, .car-row');
        if (row) {
          if (row.classList.contains('car-row')) showCarDetail(row.dataset.rowId);
          else showTaskDetail(row.dataset.rowId);
        }
        return;
      }

      const carRow = ev.target.closest('.car-row');
      if (carRow && carRow.dataset.rowId) { showCarDetail(carRow.dataset.rowId); return; }
      // Task rows expand/collapse in place to reveal their action buttons.
      const taskRow = ev.target.closest('.task-row');
      if (taskRow && taskRow.dataset.rowId) {
        const id = String(taskRow.dataset.rowId);
        if (_expandedTasks.has(id)) _expandedTasks.delete(id); else _expandedTasks.add(id);
        taskRow.classList.toggle('expanded', _expandedTasks.has(id));
        return;
      }
    });

    // Reset openTaskDetailId / openCarDetailId when modals close
    ['task-detail', 'car-detail'].forEach(name => {
      const m = document.getElementById('modal-' + name);
      if (m) {
        new MutationObserver(() => {
          if (!m.classList.contains('show')) {
            if (name === 'task-detail') openTaskDetailId = null;
            if (name === 'car-detail') openCarDetailId = null;
          }
        }).observe(m, { attributes: true, attributeFilter: ['class'] });
      }
    });

    // Detail action buttons (delegated)
    document.addEventListener('click', async (ev) => {
      const btn = ev.target.closest('[data-detail-action]');
      if (!btn) return;
      ev.stopPropagation();
      const action = btn.dataset.detailAction;
      btn.disabled = true;

      const me = currentUserEmail();

      try {
        if (action === 'task-take') {
          const id = btn.dataset.taskId;
          if (await apiTaskTake(id)) {
            await loadData();
            showTaskDetail(id);
          }

        } else if (action === 'task-finish') {
          const id = btn.dataset.taskId;
          if (await apiTaskComplete(id)) {
            await loadData();
            showTaskDetail(id);
          }

        } else if (action === 'task-reopen') {
          const id = btn.dataset.taskId;
          if (await apiTaskReopen(id)) {
            await loadData();
            showTaskDetail(id);
          }

        } else if (action === 'task-delete') {
          const id = btn.dataset.taskId;
          if (await apiTaskDelete(id, btn.dataset.taskLabel)) {
            closeModal(document.getElementById('modal-task-detail'));
            await loadData();
          }

        } else if (action === 'car-qr') {
          const id = btn.dataset.carId;
          btn.disabled = false;
          showCarQr(id);
          return;

        } else if (action === 'car-ticket') {
          const id = btn.dataset.carId;
          btn.disabled = false;
          const car = (state.cars || []).find(c => String(c.id) === String(id));
          if (car) {
            const url = ticketUrl(car);
            try { await navigator.clipboard.writeText(url); showToast(t('ticket.copied')); }
            catch (_) { try { window.open(url, '_blank'); } catch (e) {} }
          }
          return;

        } else if (action === 'car-sms') {
          const id = btn.dataset.carId;
          btn.disabled = false;
          await sendSingleSms(id);
          return;

        } else if (action === 'car-invite-tg') {
          await sendInviteToDriver(btn.dataset.carId);
          btn.disabled = false;
          return;

        } else if (action === 'car-invite-qr') {
          btn.disabled = false;
          showInviteQr(btn.dataset.carId);
          return;

        } else if (action === 'car-delete') {
          const id = btn.dataset.carId;
          const label = btn.dataset.carLabel || 'mașina';
          if (!await uiConfirm(t('car.detail.confirm_delete', { label }))) { btn.disabled = false; return; }
          const { error } = await trashCars(id);
          if (error) throw error;
          closeModal(document.getElementById('modal-car-detail'));
          await loadData();
          offerUndoRestore(id, label);
        }
      } catch (e) {
        showToast('Eroare: ' + (e.message || e), 'error');
      } finally {
        btn.disabled = false;
      }
    });

    // Delete update
    document.addEventListener('click', async (ev) => {
      const b = ev.target.closest('[data-update-delete]');
      if (!b) return;
      ev.stopPropagation();
      if (!await uiConfirm('Șterge această actualizare?')) return;
      const id = b.dataset.updateDelete;
      const { error } = await supa.from('task_updates').delete().eq('id', id);
      if (error) return showToast('Eroare: ' + error.message, 'error');
      if (openTaskDetailId != null) refreshTaskUpdates(openTaskDetailId);
    });

    const TASK_STATUS_OPTIONS = [
      { key: 'available',   label: 'Disponibil',  color: '#3B82F6' },
      { key: 'in_progress', label: 'În lucru',    color: '#F59E0B' },
      { key: 'completed',   label: 'Finisat',     color: '#10B981' }
    ];
    function taskStatusKey(status) {
      const s = (status || '').toLowerCase();
      // English keys (canonical, stored in DB)
      if (s === 'available' || s === 'open' || s === 'todo') return 'available';
      if (s === 'in_progress' || s === 'in progress') return 'in_progress';
      if (s === 'completed' || s === 'done' || s === 'finished') return 'completed';
      // Romanian labels
      if (s.includes('disponibil') || s.includes('nou')) return 'available';
      if (s.includes('lucru') || s.includes('progres')) return 'in_progress';
      if (s.includes('finisat') || s.includes('finalizat')) return 'completed';
      // Russian labels
      if (s.includes('доступ')) return 'available';
      if (s.includes('работ')) return 'in_progress';
      if (s.includes('заверш')) return 'completed';
      return 'available';
    }

    // Return a translated label for a raw task status stored in DB (e.g. "completed" -> "FINISAT" / "COMPLETED" / "ЗАВЕРШЕНО").
    function localizeTaskStatus(status) {
      return t('task.status.' + taskStatusKey(status));
    }

    // Return a translated label for a raw priority (e.g. "urgenta" / "Urgentă" -> "URGENT").
    function localizePriority(priority) {
      if (!priority) return t('task.priority_normal');
      const p = String(priority).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      if (p.includes('urgent') || p.includes('срочн')) return t('task.priority_urgent');
      if (p.includes('important') || p.includes('ridicat') || p.includes('high') || p.includes('важн')) return t('task.priority_high');
      if (p.includes('scazut') || p.includes('low') || p.includes('низк')) return t('task.priority_low');
      if (p.includes('normal') || p.includes('обычн')) return t('task.priority_normal');
      return String(priority);
    }

    // Importance level for a priority: 0=low, 1=normal, 2=high, 3=urgent.
    function priorityLevel(priority) {
      const p = String(priority || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      if (p.includes('urgent') || p.includes('срочн')) return 3;
      if (p.includes('important') || p.includes('ridicat') || p.includes('high') || p.includes('важн')) return 2;
      if (p.includes('scazut') || p.includes('low') || p.includes('низк')) return 0;
      return 1;
    }
    function priorityKey(priority) {
      return ['low', 'normal', 'high', 'urgent'][priorityLevel(priority)];
    }

    // Translate a department name (RO canonical) to the current language, or return it unchanged if it's a custom value.
    function localizeDept(dept) {
      if (!dept) return dept;
      const key = 'dept.' + String(dept).trim();
      const val = t(key);
      return val === key ? dept : val;
    }

    // Same for car statuses.
    function carStatusKey(status) {
      const s = (status || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      if (s.includes('invit') || s.includes('пригла')) return 'invited';
      if (s.includes('sosit') || s.includes('arriv') || s.includes('приб')) return 'arrived';
      if (s.includes('plecat') || s.includes('left') || s.includes('уех')) return 'left';
      if (s.includes('astept') || s.includes('waiting') || s.includes('ожид')) return 'waiting';
      return null;
    }
    function localizeCarStatus(status) {
      const k = carStatusKey(status);
      return k ? t('car.status.' + k) : (status || '—');
    }

    // Departments used across the app. Seeded with these defaults, but
    // configurable by admins from Settings (persisted in ui_settings/departments).
    const DEFAULT_DEPARTMENTS = [
      'Management',
      'Parteneriate',
      'Participanți',
      'Marketing',
      'Logistică',
      'Juridic și Financiar',
      'Design'
    ];
    let DEPARTMENTS = DEFAULT_DEPARTMENTS.slice();

    // Load the department list from ui_settings; falls back to defaults.
    async function loadDepartments() {
      try {
        const { data } = await supa.from('ui_settings').select('value').eq('key', 'departments').maybeSingle();
        let arr = null;
        if (data && data.value) {
          try { arr = typeof data.value === 'string' ? JSON.parse(data.value) : data.value; } catch (_) {}
        }
        if (Array.isArray(arr) && arr.length) {
          DEPARTMENTS = arr.map(s => String(s).trim()).filter(Boolean);
        }
      } catch (_) {}
      populateDeptSelects();
      try { renderTasksDeptChips(); } catch (_) {}
      try { renderDeptSettings(); } catch (_) {}
    }

    // Rebuild the options of every department <select>, preserving the current
    // value and the leading placeholder option.
    function populateDeptSelects() {
      document.querySelectorAll('select[data-populate="departments"]').forEach(sel => {
        const cur = sel.value;
        while (sel.options.length > 1) sel.remove(1);
        DEPARTMENTS.forEach(d => {
          const o = document.createElement('option');
          o.value = d;
          o.textContent = localizeDept(d);
          sel.appendChild(o);
        });
        if (cur) sel.value = cur;
      });
    }

    // Persist a new department list (admin only) and refresh dependent UI.
    async function saveDepartments(next) {
      const cleaned = next.map(s => String(s).trim()).filter(Boolean);
      // De-duplicate case-insensitively, keep first spelling.
      const seen = new Set(), out = [];
      for (const d of cleaned) { const k = d.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(d); } }
      DEPARTMENTS = out;
      const { error } = await supa.from('ui_settings').upsert(
        { key: 'departments', value: JSON.stringify(out), updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );
      if (error) { uiAlert(t('common.error') + ': ' + error.message); return false; }
      populateDeptSelects();
      try { renderTasksDeptChips(); } catch (_) {}
      renderDeptSettings();
      showToast(t('dept.saved'));
      return true;
    }

    // Admin-only editor list in Settings.
    function renderDeptSettings() {
      const list = el('deptSettingsList');
      if (!list) return;
      list.innerHTML = DEPARTMENTS.map((d, i) => `
        <div class="dept-item">
          <span class="dept-item-name">${escape(localizeDept(d))}</span>
          <button type="button" class="dept-item-del" data-dept-del="${i}" title="${escape(t('common.delete'))}" aria-label="${escape(t('common.delete'))}">&times;</button>
        </div>
      `).join('') || `<p class="dept-empty">${escape(t('dept.none'))}</p>`;
    }
    // Normalize a task's department for comparison — checks team/category/event.
    function taskDept(t) {
      const bag = [t.team, t.category, t.event].filter(Boolean).join(' | ').toLowerCase();
      if (!bag) return null;
      const stripDiacritics = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
      const nb = stripDiacritics(bag);
      for (const d of DEPARTMENTS) {
        const nd = stripDiacritics(d.toLowerCase());
        if (nb.includes(nd)) return d;
      }
      return null;
    }

    function filterTasks() {
      const q = state.tasksSearch.toLowerCase();
      return activeTasks().filter(t => {
        const sk = taskStatusKey(t.status);
        // Quick "views" preset — combines assignee/priority/overdue in one tap.
        const preset = state.tasksPreset || 'all';
        if ((preset === 'mine' || preset === 'mine_urgent') && !isMyTask(t)) return false;
        if ((preset === 'urgent' || preset === 'mine_urgent') && priorityLevel(t.priority) < 3) return false;
        if (preset === 'overdue' && !isOverdue(t)) return false;
        if (state.tasksFilter === 'done' && sk !== 'completed') return false;
        if (state.tasksFilter === 'open' && sk === 'completed') return false;
        if (state.tasksFilter !== 'all' && state.tasksFilter !== 'done' && state.tasksFilter !== 'open') {
          if (sk !== state.tasksFilter) return false;
        }
        if (state.tasksDept && state.tasksDept !== 'all') {
          if (taskDept(t) !== state.tasksDept) return false;
        }
        // Assignee filter: "mine" or a specific member's email/name.
        if (state.tasksAssignee && state.tasksAssignee !== 'all') {
          if (state.tasksAssignee === '__me__') {
            if (!isMyTask(t)) return false;
          } else {
            const email = state.tasksAssignee.toLowerCase();
            const name = (state.profiles || []).find(p => (p.email || '').toLowerCase() === email)?.full_name || '';
            const match = (t.assigned_to && t.assigned_to.toLowerCase() === email)
              || (name && t.assigned_user_name === name);
            if (!match) return false;
          }
        }
        if (!q) return true;
        return (t.title || '').toLowerCase().includes(q) ||
               (t.event || '').toLowerCase().includes(q) ||
               (t.team || '').toLowerCase().includes(q) ||
               (t.category || '').toLowerCase().includes(q);
      });
    }

    // A comparable timestamp for a task's deadline (missing → far future).
    function taskSortTime(tk) {
      const v = tk.due_at || tk.date;
      if (!v) return Infinity;
      const d = new Date(v);
      return isNaN(d) ? Infinity : d.getTime();
    }
    // Order tasks by the chosen sort. Completed tasks always sink to the bottom;
    // overdue tasks float within their group.
    function sortTasks(list) {
      const mode = state.tasksSort || 'priority';
      const arr = list.slice();
      if (mode === 'recent') return arr; // already newest-first
      const done = tk => taskStatusKey(tk.status) === 'completed' ? 1 : 0;
      const over = tk => isOverdue(tk) ? 0 : 1;
      arr.sort((a, b) => {
        const d = done(a) - done(b); if (d) return d;
        if (mode === 'deadline') {
          const o = over(a) - over(b); if (o) return o;
          return taskSortTime(a) - taskSortTime(b);
        }
        // priority (default)
        const p = priorityLevel(b.priority) - priorityLevel(a.priority); if (p) return p;
        const o = over(a) - over(b); if (o) return o;
        return taskSortTime(a) - taskSortTime(b);
      });
      return arr;
    }

    function renderTasksDeptChips() {
      const counts = { all: state.tasks.length };
      DEPARTMENTS.forEach(d => { counts[d] = 0; });
      state.tasks.forEach(tk => {
        const d = taskDept(tk);
        if (d) counts[d] = (counts[d] || 0) + 1;
      });
      const chips = [{ key: 'all', label: t('tasks.dept_all') }, ...DEPARTMENTS.map(d => ({ key: d, label: localizeDept(d) }))];
      const target = el('tasksDeptChips');
      if (!target) return;
      target.innerHTML = chips.map(chip => `
        <button class="chip dept-chip ${state.tasksDept === chip.key ? 'active' : ''}" data-tasks-dept="${escape(chip.key)}">
          ${escape(chip.label)}
          <span class="count">· ${counts[chip.key] || 0}</span>
        </button>
      `).join('');
    }

    function renderTasksChips() {
      // Same rule as the car chips: count what the list below will actually
      // show, which is the event in focus.
      const scoped = activeTasks();
      const total = scoped.length;
      const counts = { all: total };
      counts.open = scoped.filter(tk => taskStatusKey(tk.status) !== 'completed').length;

      TASK_STATUS_OPTIONS.forEach(o => {
        counts[o.key] = scoped.filter(tk => taskStatusKey(tk.status) === o.key).length;
      });

      const statusLabel = (k) => {
        if (k === 'available')   return t('task.status.available');
        if (k === 'in_progress') return t('task.status.in_progress');
        if (k === 'completed')   return t('task.status.completed');
        return k;
      };
      const chips = [
        { key: 'all',  label: t('tasks.filter_all') },
        { key: 'open', label: t('tasks.filter_open') },
        ...TASK_STATUS_OPTIONS.map(o => ({ key: o.key, label: statusLabel(o.key) }))
      ];
      el('tasksChips').innerHTML = chips.map(chip => `
        <button class="chip ${state.tasksFilter === chip.key ? 'active' : ''}" data-tasks-filter="${chip.key}">
          ${escape(chip.label)}
          <span class="count">· ${counts[chip.key] || 0}</span>
        </button>
      `).join('');
    }

    // Saved "views" — one-tap presets that combine assignee/priority/overdue.
    function renderTasksViewChips() {
      const box = el('tasksViewChips');
      if (!box) return;
      const open = state.tasks.filter(tk => taskStatusKey(tk.status) !== 'completed');
      const isUrgent = tk => priorityLevel(tk.priority) >= 3;
      const counts = {
        all: state.tasks.length,
        mine: open.filter(isMyTask).length,
        urgent: open.filter(isUrgent).length,
        mine_urgent: open.filter(tk => isMyTask(tk) && isUrgent(tk)).length,
        overdue: open.filter(isOverdue).length,
      };
      const presets = [
        { key: 'all',         label: t('tasks.view_all') },
        { key: 'mine',        label: t('tasks.view_mine') },
        { key: 'urgent',      label: t('tasks.view_urgent') },
        { key: 'mine_urgent', label: t('tasks.view_mine_urgent') },
        { key: 'overdue',     label: t('tasks.view_overdue') },
      ];
      box.innerHTML = presets.map(p => `
        <button class="chip preset ${state.tasksPreset === p.key ? 'active' : ''}" data-tasks-preset="${p.key}">
          ${escape(p.label)}
          <span class="count">· ${counts[p.key] || 0}</span>
        </button>
      `).join('');
    }

    function applyTasksView() {
      const ss = el('tasksSortSelect');
      if (ss && ss.value !== state.tasksSort) ss.value = state.tasksSort;
      const listC = el('tasksList'), kanC = el('tasksKanban');
      const kanban = state.tasksView === 'kanban';
      if (listC) listC.style.display = kanban ? 'none' : '';
      if (kanC)  kanC.style.display  = kanban ? '' : 'none';
      document.querySelectorAll('#tasksViewToggle [data-tasks-view]').forEach(b => {
        b.classList.toggle('active', b.dataset.tasksView === state.tasksView);
      });
    }

    // Which task rows are expanded (persists across re-renders/polls).
    const _expandedTasks = new Set();

    function renderTasks() {
      el('tasksCount').textContent = state.tasks.length;
      renderTasksViewChips();
      applyTasksView();
      if (state.tasksView === 'kanban') { renderTasksKanban(); return; }
      const list = sortTasks(filterTasks());
      const c = el('tasksList');
      if (!list.length) return c.innerHTML = '<div class="card">' + emptyState(t("common.nothing_found")) + '</div>';

      const priorityMeta = (p) => {
        const key = (p || '').toLowerCase();
        if (key.includes('urgent')) return { cls: 'priority-urgent', label: t("task.priority_urgent"), mark: '+' };
        if (key.includes('ridicat') || key.includes('important') || key.includes('high')) return { cls: 'priority-high', label: t("task.priority_high"), mark: '+' };
        if (key.includes('scăzut') || key.includes('scazut') || key.includes('low')) return { cls: 'priority-low', label: t("task.priority_normal"), mark: '' }; // Assuming normal for low in this specific UI logic
        return { cls: 'priority-normal', label: t("task.priority_normal"), mark: '' };
      };

      const iconClock = '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>';
      const iconCheck = '<polyline points="20 6 9 17 4 12"/>';
      const iconPlay  = '<polygon points="5 3 19 12 5 21 5 3"/>';
      const iconDots  = '<circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/>';
      const iconCal   = '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>';
      const iconUser  = '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>';
      const iconUndo  = '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><polyline points="3 3 3 8 8 8"/>';

      c.innerHTML = '<div class="tk-grid content-in">' + list.map(tk => {
        const sk = taskStatusKey(tk.status);
        const iconClass = sk === 'completed' ? 'done' : sk === 'in_progress' ? 'progress' : 'available';
        const iconSvg   = sk === 'completed' ? iconCheck : iconClock;

        let statusLabel = t('task.status.available');
        let statusCls   = 'stat-available';
        let badgeClass  = 'blue';

        if (sk === 'completed') {
           statusLabel = t('task.status.completed');
           statusCls   = 'stat-done';
           badgeClass  = 'green';
        } else if (sk === 'in_progress') {
           statusLabel = t('task.status.in_progress');
           statusCls   = 'stat-progress';
           badgeClass  = 'orange';
        }

        const pri = priorityMeta(tk.priority);
        const responsibleRaw = tk.assigned_user_name || '—';
        const responsible = escape(responsibleRaw);

        // Contextual primary action based on state + ownership
        const myId = currentUser?.id || null;
        const isOwner = !!myId && tk.assigned_user_id === myId;
        let primaryBtn = '';
        if (sk === 'available') {
          primaryBtn = `<button class="tk-btn blue" data-action="task-take" data-task-id="${tk.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${iconPlay}</svg>
            ${t("task.action.take")}
          </button>`;
        } else if (sk === 'in_progress') {
          if (isOwner) {
            primaryBtn = `<button class="tk-btn green" data-action="task-finish" data-task-id="${tk.id}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${iconCheck}</svg>
              ${t("task.action.finish")}
            </button>`;
          } else {
            // Someone else is working on it → show a disabled locked chip instead
            primaryBtn = `<div class="tk-btn locked" title="${escape(t("task.locked_msg", { name: responsibleRaw }))}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              ${t("task.worked_by")} ${escape((responsibleRaw || '').split('@')[0])}
            </div>`;
          }
        } else {
          primaryBtn = `<button class="tk-btn blue" data-action="task-reopen" data-task-id="${tk.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${iconUndo}</svg>
            ${t("task.action.reopen")}
          </button>`;
        }

        // Collapsed sub-line: who's working on it (if taken), else the status.
        const subLine = tk.assigned_user_name
          ? `${taskAssigneeAvatar(tk)}<span class="tk-row-who">${escape((sk === 'completed' ? t('task.finished_by') : t('task.worked_by')))}: ${responsible}</span>`
          : `<span class="tk-row-status stat-${badgeClass}">${statusLabel}</span>`;

        const prioKey = priorityKey(tk.priority);
        const prioLabel = localizePriority(tk.priority);
        return `
          <div class="tk-row task-row card-stripe stripe-t-${sk}${sk !== 'completed' ? ' tk-prio-' + prioKey : ''}${_expandedTasks.has(String(tk.id)) ? ' expanded' : ''}" data-row-id="${tk.id}">
            <div class="tk-row-head">
              <div class="tk-row-icon ${iconClass}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${iconSvg}</svg>
              </div>
              <div class="tk-row-body">
                <div class="tk-row-title ${sk === 'completed' ? 'done' : ''}">${escape(tk.title)}${isOverdue(tk) ? ` <span class="tk-badge overdue">${escape(t('task.overdue'))}</span>` : ''}</div>
                <div class="tk-row-sub">${subLine}</div>
              </div>
              <span class="tk-prio prio-${prioKey}" title="${escape(prioLabel)}"><span class="tk-prio-dot"></span>${escape(prioLabel)}</span>
              <svg class="tk-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
            <div class="tk-row-actions">
              <div class="tk-row-meta">
                ${tk.category ? `<span class="tk-badge cat">${escape(localizeDept(tk.category))}</span>` : ''}
                ${pri ? `<span class="tk-badge ${pri.cls === 'priority-urgent' ? 'pri-urgent' : pri.cls === 'priority-high' ? 'pri-high' : 'pri-normal'}">${pri.label}</span>` : ''}
                <span class="tk-badge stat-${badgeClass}">${statusLabel}</span>
                ${tk.event ? `<span class="tk-row-date">${escape(tk.event)}</span>` : ''}
                ${tk.date ? `<span class="tk-row-date"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${iconCal}</svg>${escape(tk.date)}</span>` : ''}
              </div>
              <div class="tk-row-btns">
                ${primaryBtn}
                <button class="tk-btn ghost-detail" data-row-id="${tk.id}" data-open-detail="1">${escape(t('task.details'))}</button>
              </div>
            </div>
          </div>
        `;
      }).join('') + '</div>';
    }

    // ----- KANBAN BOARD -----
    function renderTasksKanban() {
      const board = el('tasksKanban');
      if (!board) return;
      const list = sortTasks(filterTasks());
      const cols = [
        { key: 'available',   label: t('task.status.available'),   cls: 'available' },
        { key: 'in_progress', label: t('task.status.in_progress'), cls: 'progress'  },
        { key: 'completed',   label: t('task.status.completed'),   cls: 'done'      }
      ];
      const byCol = { available: [], in_progress: [], completed: [] };
      list.forEach(tk => { (byCol[taskStatusKey(tk.status)] || byCol.available).push(tk); });

      board.innerHTML = `<div class="kanban">` + cols.map(col => {
        const items = byCol[col.key] || [];
        return `
          <div class="kanban-col" data-status="${col.key}">
            <div class="kanban-col-head ${col.cls}">
              <span class="kanban-col-title">${escape(col.label)}</span>
              <span class="kanban-col-count">${items.length}</span>
            </div>
            <div class="kanban-col-body">
              ${items.map(tk => kanbanCard(tk)).join('') || `<div class="kanban-empty">${escape(t('kanban.empty'))}</div>`}
            </div>
          </div>`;
      }).join('') + `</div>`;
    }

    function kanbanCard(tk) {
      const pri = (tk.priority || '').toLowerCase();
      const priCls = pri.includes('urgent') ? 'pri-urgent'
        : (pri.includes('ridicat') || pri.includes('important') || pri.includes('high')) ? 'pri-high' : '';
      const responsible = tk.assigned_user_name ? escape(tk.assigned_user_name) : '';
      return `
        <div class="kanban-card" data-task-id="${tk.id}" data-status="${taskStatusKey(tk.status)}">
          <div class="kanban-card-top">
            ${tk.category ? `<span class="tk-badge cat">${escape(localizeDept(tk.category))}</span>` : ''}
            ${priCls ? `<span class="tk-badge ${priCls}">${escape(localizePriority(tk.priority))}</span>` : ''}
            ${isOverdue(tk) ? `<span class="tk-badge overdue">${escape(t('task.overdue'))}</span>` : ''}
          </div>
          <div class="kanban-card-title">${escape(tk.title)}</div>
          ${tk.event ? `<div class="kanban-card-sub">${escape(tk.event)}</div>` : ''}
          ${responsible ? `<div class="kanban-card-user"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>${responsible}</div>` : ''}
        </div>`;
    }

    // Change a task's status (used by Kanban drag & drop). Delegates to the
    // existing take/finish/reopen flows so side-effects stay consistent.
    async function apiTaskSetStatus(taskId, statusKey) {
      const tk = (state.tasks || []).find(x => String(x.id) === String(taskId));
      if (tk && taskStatusKey(tk.status) === statusKey) return false;
      if (statusKey === 'completed') return apiTaskComplete(taskId);
      if (statusKey === 'available') return apiTaskReopen(taskId);
      // in_progress — keep the current assignee, or claim it if unassigned.
      const patch = {
        status: 'in_progress', status_color: '#F59E0B',
        is_completed: false, completed_at: null,
        completed_by_user_id: null, completed_by_user_name: null
      };
      if (tk && !tk.assigned_user_id && currentUser) {
        patch.assigned_user_id = currentUser.id;
        patch.assigned_user_name = currentUserName();
        patch.started_at = new Date().toISOString();
      }
      const { error } = await supa.from('tasks').update(patch).eq('id', taskId);
      // Deliberately not queued offline: claiming/completing a task has conflict
      // semantics (two people can grab the same one), so replaying a stale
      // change later could silently produce the wrong outcome. Fail loudly and
      // let the user retry when there is signal.
      if (error) { uiAlert(writeErrorText(error)); return false; }
      showToast(t('kanban.moved'));
      return true;
    }

    // Pointer-based drag & drop — works with both mouse and touch (the app runs
    // inside an Android WebView, where HTML5 native DnD is unreliable).
    (function initKanbanDnD() {
      let dragging = null, ghost = null, startX = 0, startY = 0, active = false, srcCard = null;
      const THRESHOLD = 8;

      function onDown(e) {
        const card = e.target.closest('.kanban-card');
        if (!card || !el('tasksKanban') || el('tasksKanban').style.display === 'none') return;
        dragging = { id: card.dataset.taskId, from: card.dataset.status };
        srcCard = card;
        startX = e.clientX; startY = e.clientY;
        active = false;
        card.setPointerCapture?.(e.pointerId);
        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
      }
      function onMove(e) {
        if (!dragging) return;
        const dx = e.clientX - startX, dy = e.clientY - startY;
        if (!active) {
          if (Math.hypot(dx, dy) < THRESHOLD) return;
          active = true;
          srcCard.classList.add('drag-src');
          ghost = srcCard.cloneNode(true);
          ghost.classList.add('kanban-ghost');
          ghost.style.width = srcCard.offsetWidth + 'px';
          document.body.appendChild(ghost);
        }
        e.preventDefault();
        ghost.style.left = (e.clientX + 6) + 'px';
        ghost.style.top  = (e.clientY + 6) + 'px';
        const col = colUnder(e.clientX, e.clientY);
        document.querySelectorAll('.kanban-col').forEach(c => c.classList.toggle('drop-target', c === col));
      }
      async function onUp(e) {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        const wasActive = active;
        const drag = dragging;
        cleanup();
        if (!wasActive) {
          // treated as a tap → open the task detail
          if (drag) showTaskDetail(drag.id);
          return;
        }
        const col = colUnder(e.clientX, e.clientY);
        if (!col || !drag) return;
        const to = col.dataset.status;
        if (to && to !== drag.from) {
          if (await apiTaskSetStatus(drag.id, to)) await loadData();
        }
      }
      function colUnder(x, y) {
        const elu = document.elementFromPoint(x, y);
        return elu ? elu.closest('.kanban-col') : null;
      }
      function cleanup() {
        if (ghost) { ghost.remove(); ghost = null; }
        if (srcCard) srcCard.classList.remove('drag-src');
        document.querySelectorAll('.kanban-col.drop-target').forEach(c => c.classList.remove('drop-target'));
        dragging = null; srcCard = null; active = false;
      }
      document.addEventListener('pointerdown', onDown);
    })();

    // Small avatar chip for a task's assignee — photo if we have one, else initials.
    function taskAssigneeAvatar(tk) {
      const name = tk.assigned_user_name;
      if (!name) return '';
      const email = (tk.assigned_to || '').toLowerCase();
      const prof = (state.profiles || []).find(p =>
        (email && (p.email || '').toLowerCase() === email) || p.full_name === name);
      const initials = (name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('') || name[0] || '?').toUpperCase();
      const av = prof && prof.avatar_url;
      return `<span class="tk-avatar" aria-hidden="true"${av ? '' : ` style="${avatarBg(name)}"`}>${av ? `<img src="${escape(av)}" alt="" loading="lazy">` : escape(initials)}</span>`;
    }

    function emptyState(text, opts = {}) {
      const cta = opts.cta ? `<div class="empty-cta">${escape(opts.cta)}</div>` : '';
      return `<div class="empty">
        <div class="empty-art" aria-hidden="true">
          <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="10" y="16" width="44" height="34" rx="5"/>
            <path d="M10 26h44"/><circle cx="17" cy="21" r="1.3"/><circle cx="22" cy="21" r="1.3"/>
            <path d="M24 40l6-7 5 5 4-5 5 7"/>
          </svg>
        </div>
        <p>${escape(text)}</p>
        ${cta}
      </div>`;
    }
    function formatDate(iso) {
      if (!iso) return '—';
      const d = new Date(iso);
      return d.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
    }

    // ----- SESSION BOOTSTRAP -----
    (async () => {
      try {
        const { data: { session } } = await supa.auth.getSession();
        if (session?.user) {
          enterApp(session.user);
        }
      } catch (err) {
        console.error("Bootstrap error:", err);
      } finally {
        // Hide splash screen after a short delay
        setTimeout(() => {
          const splash = el('splashScreen');
          if (splash) splash.classList.add('fade-out');
        }, 1200);
      }
    })();

    supa.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') leaveApp();
      else if (event === 'SIGNED_IN' && session?.user) enterApp(session.user);
    });

    // Initial apply of language
    applyLanguage(currentLang);

    // Fail-safe: Always hide splash screen after 4 seconds
    setTimeout(() => {
      const splash = el('splashScreen');
      if (splash && !splash.classList.contains('fade-out')) {
        console.warn("Fail-safe: Forcing splash screen hide.");
        splash.classList.add('fade-out');
      }
    }, 4000);
  