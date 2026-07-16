    import { createClient } from './vendor/supabase-js.mjs';
    import { translations } from './i18n.js';

    const SUPABASE_URL = 'https://knphmxxokowwkruimdus.supabase.co';
    const SUPABASE_ANON = 'sb_publishable_9b7WSJF4UlfF1JIdCDjWqQ_dxOTpqSW';

    const supa = createClient(SUPABASE_URL, SUPABASE_ANON, {
      auth: { persistSession: true, autoRefreshToken: true }
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

    function applyLanguage(lang) {
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

      // Update active state on language buttons
      document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
        if (btn.dataset.lang === lang) {
          btn.style.background = 'var(--blue)';
          btn.style.color = '#fff';
        } else {
          btn.style.background = 'transparent';
          btn.style.color = 'var(--text-dim)';
        }
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

      // Hydrate cars from the offline cache so the gate works even if we
      // opened the app with no connection (a stored session logs us straight in).
      if (!(state.cars || []).length) {
        const cached = loadCachedCars();
        if (cached.length) state.cars = cached;
      }

      loadDepartments();
      startPolling();
    }
    function leaveApp() {
      stopPolling();
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
      // The active-event picker lives only on the Home page.
      const picker = document.querySelector('.event-picker');
      if (picker) picker.style.display = (name === 'home') ? 'inline-flex' : 'none';
      // Scroll top of content when switching sections on mobile
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (name === 'map') loadMap();
    }
    document.querySelectorAll('.tab, .mtab').forEach(t => {
      t.addEventListener('click', () => selectSection(t.dataset.section));
    });

    // ----- ZONE MAP -----
    let _mapUrl = null;
    async function loadMap() {
      const { data } = await supa.from('ui_settings').select('value').eq('key', 'zone_map_url').maybeSingle();
      _mapUrl = data?.value || null;
      renderMap();
    }
    function renderMap() {
      const staff = roleAtLeast('staff');
      const actions = el('mapActions');
      if (actions) actions.style.display = staff ? 'flex' : 'none';
      const delBtn = el('mapDeleteBtn');
      if (delBtn) delBtn.style.display = (staff && _mapUrl) ? 'inline-flex' : 'none';
      const uploadLabel = el('mapUploadBtn').querySelector('span');
      if (uploadLabel) uploadLabel.textContent = _mapUrl ? t('map.replace') : t('map.upload');

      const container = el('mapContainer');
      if (!container) return;
      if (_mapUrl) {
        container.innerHTML = `<div class="map-image-wrap"><img src="${escape(_mapUrl)}" alt="Harta zonelor" id="mapImage"></div>`;
        el('mapImage').onclick = () => openLightbox(_mapUrl);
      } else {
        container.innerHTML = `
          <div class="map-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
            <p>${escape(t('map.empty'))}</p>
            <p class="map-empty-hint">${escape(t('map.empty_hint'))}</p>
          </div>`;
      }
      renderZones();
    }

    // Interactive zone breakdown, derived live from car data (respects the
    // active-event filter). Each card expands to list its cars.
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
      if (!byZone.size) {
        panel.innerHTML = `<div class="card">${emptyState(t('map.zones.empty'))}</div>`;
        return;
      }
      const zones = [...byZone.keys()].sort((a, b) => a.localeCompare(b, 'ro'));
      panel.innerHTML = '<div class="zone-grid">' + zones.map(z => {
        const cars = byZone.get(z);
        const arrived = cars.filter(c => statusKey(c.status) === 'sosit').length;
        const rows = cars.map(c => {
          const color = CAR_STATUS_OPTIONS.find(o => o.key === statusKey(c.status))?.color || '#3B82F6';
          const name = [c.brand, c.model].filter(Boolean).join(' ') || c.model || '—';
          return `<div class="zone-car-row" data-zone-car="${c.id}">
            <span class="z-status" style="background:${color}"></span>
            <span class="z-name">${escape(name)}${c.plate ? ' · ' + escape(c.plate) : ''}</span>
          </div>`;
        }).join('');
        return `<div class="zone-card" data-zone="${escape(z)}">
          <div class="zone-name"><span class="zone-dot"></span>${escape(z)}</div>
          <div class="zone-count">${cars.length}</div>
          <div class="zone-stats"><span>${arrived} ${escape(t('map.zones.arrived'))}</span></div>
          <div class="zone-cars">${rows}</div>
        </div>`;
      }).join('') + '</div>';
    }
    // Zone card: toggle expand; inner car row: open the car detail.
    el('zonePanel').addEventListener('click', (e) => {
      const carRow = e.target.closest('[data-zone-car]');
      if (carRow) { e.stopPropagation(); showCarDetail(carRow.dataset.zoneCar); return; }
      const card = e.target.closest('.zone-card');
      if (card) card.classList.toggle('open');
    });
    el('mapUploadBtn').addEventListener('click', () => el('mapFileInput').click());
    // Lazy-load the vendored pdf.js only when a PDF is actually chosen.
    let _pdfjsLoading = null;
    function ensurePdfJs() {
      if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
      if (_pdfjsLoading) return _pdfjsLoading;
      _pdfjsLoading = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'vendor/pdf.min.js';
        s.onload = () => {
          try { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js'; } catch (_) {}
          resolve(window.pdfjsLib);
        };
        s.onerror = () => { _pdfjsLoading = null; reject(new Error('Nu s-a putut încărca cititorul PDF.')); };
        document.head.appendChild(s);
      });
      return _pdfjsLoading;
    }

    // Turn any chosen file into an image data URL. PDFs render their first
    // page to a canvas at high resolution.
    async function fileToImageSrc(file) {
      const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
      if (!isPdf) {
        return await new Promise((res, rej) => {
          const fr = new FileReader();
          fr.onload = () => res(fr.result);
          fr.onerror = () => rej(new Error('Nu s-a putut citi fișierul.'));
          fr.readAsDataURL(file);
        });
      }
      const st = el('mapStatus');
      st.style.display = 'block'; st.style.color = 'var(--text-dim)';
      st.textContent = t('map.pdf_rendering');
      const pdfjs = await ensurePdfJs();
      const buf = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: buf }).promise;
      const page = await pdf.getPage(1);
      const scale = Math.min(3, 2400 / page.getViewport({ scale: 1 }).width);
      const viewport = page.getViewport({ scale: Math.max(1, scale) });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width; canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      st.style.display = 'none';
      return canvas.toDataURL('image/jpeg', 0.9);
    }

    el('mapFileInput').addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!file) return;
      const status = el('mapStatus');
      try {
        const src = await fileToImageSrc(file);
        openMapCropper(src); // upload happens after the user confirms the crop
      } catch (err) {
        status.style.display = 'block';
        status.style.color = 'var(--red)';
        status.textContent = t('map.upload_error') + ': ' + (err.message || err);
      }
    });

    // Upload a finished map blob and record its URL.
    async function uploadMapBlob(blob) {
      const status = el('mapStatus');
      status.style.display = 'block';
      status.style.color = 'var(--text-dim)';
      status.textContent = t('map.uploading');
      try {
        const path = `zone-map-${Date.now()}.jpg`;
        const { error: upErr } = await supa.storage.from('maps')
          .upload(path, blob, { contentType: 'image/jpeg' });
        if (upErr) throw upErr;
        const url = supa.storage.from('maps').getPublicUrl(path).data.publicUrl;
        const prev = _mapUrl;
        const { error: dbErr } = await supa.from('ui_settings')
          .upsert({ key: 'zone_map_url', value: url, updated_at: new Date().toISOString() }, { onConflict: 'key' });
        if (dbErr) throw dbErr;
        const prevPath = (prev || '').split('/maps/')[1];
        if (prevPath) supa.storage.from('maps').remove([decodeURIComponent(prevPath)]);
        _mapUrl = url;
        renderMap();
        status.textContent = t('map.saved');
        status.style.color = 'var(--green)';
        setTimeout(() => { status.style.display = 'none'; }, 1500);
      } catch (err) {
        status.textContent = t('map.upload_error') + ': ' + (err.message || err);
        status.style.color = 'var(--red)';
      }
    }

    // ----- MAP CROP EDITOR -----
    // Lets the user drag/resize a rectangle over the image to choose the
    // visible region before upload. Output is downscaled to <=2400px JPEG.
    let _crop = null; // { box:{x,y,w,h}, dispW, dispH }
    function openMapCropper(src) {
      const img = el('cropImage');
      img.onload = () => {
        const stage = el('cropStage');
        const dispW = img.clientWidth, dispH = img.clientHeight;
        _crop = { dispW, dispH, natW: img.naturalWidth, natH: img.naturalHeight,
                  offX: (stage.clientWidth - dispW) / 2, offY: (stage.clientHeight - dispH) / 2 };
        setCropBox(0, 0, dispW, dispH);
      };
      img.src = src;
      openModal('map-crop');
    }
    function setCropBox(x, y, w, h) {
      const c = _crop; if (!c) return;
      // clamp within the displayed image
      w = Math.max(40, Math.min(w, c.dispW));
      h = Math.max(40, Math.min(h, c.dispH));
      x = Math.max(0, Math.min(x, c.dispW - w));
      y = Math.max(0, Math.min(y, c.dispH - h));
      c.box = { x, y, w, h };
      const box = el('cropBox');
      box.style.left = (c.offX + x) + 'px';
      box.style.top = (c.offY + y) + 'px';
      box.style.width = w + 'px';
      box.style.height = h + 'px';
    }
    (function wireCropDrag() {
      const box = el('cropBox');
      let mode = null, sx = 0, sy = 0, orig = null;
      const onDown = (e) => {
        if (!_crop) return;
        const handle = e.target.closest('.crop-handle');
        mode = handle ? handle.dataset.handle : 'move';
        const p = e.touches ? e.touches[0] : e;
        sx = p.clientX; sy = p.clientY; orig = { ..._crop.box };
        e.preventDefault();
        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
      };
      const onMove = (e) => {
        if (!mode || !_crop) return;
        const dx = e.clientX - sx, dy = e.clientY - sy;
        let { x, y, w, h } = orig;
        if (mode === 'move') { setCropBox(x + dx, y + dy, w, h); return; }
        if (mode.includes('e')) w = orig.w + dx;
        if (mode.includes('s')) h = orig.h + dy;
        if (mode.includes('w')) { w = orig.w - dx; x = orig.x + dx; }
        if (mode.includes('n')) { h = orig.h - dy; y = orig.y + dy; }
        setCropBox(x, y, w, h);
      };
      const onUp = () => {
        mode = null;
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
      };
      box.addEventListener('pointerdown', onDown);
    })();
    el('cropReset').addEventListener('click', () => {
      if (_crop) setCropBox(0, 0, _crop.dispW, _crop.dispH);
    });
    el('cropCancel').addEventListener('click', () => closeModal(el('modal-map-crop')));
    el('cropConfirm').addEventListener('click', async () => {
      const c = _crop; if (!c || !c.box) return;
      const scale = c.natW / c.dispW; // display px → natural px
      const sxp = c.box.x * scale, syp = c.box.y * scale;
      const swp = c.box.w * scale, shp = c.box.h * scale;
      // Downscale the cropped region so the longest side is <=2400px.
      const out = Math.min(1, 2400 / Math.max(swp, shp));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(swp * out);
      canvas.height = Math.round(shp * out);
      canvas.getContext('2d').drawImage(el('cropImage'), sxp, syp, swp, shp, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.85));
      closeModal(el('modal-map-crop'));
      if (blob) uploadMapBlob(blob);
    });
    el('mapDeleteBtn').addEventListener('click', async () => {
      if (!_mapUrl || !(await uiConfirm(t('map.confirm_delete')))) return;
      const prevPath = (_mapUrl || '').split('/maps/')[1];
      const { error } = await supa.from('ui_settings').delete().eq('key', 'zone_map_url');
      if (error) return uiAlert('Eroare: ' + error.message);
      if (prevPath) supa.storage.from('maps').remove([decodeURIComponent(prevPath)]);
      _mapUrl = null;
      renderMap();
      showToast(t('map.deleted'));
    });

    document.querySelectorAll('#logoutBtn, #headerLogoutBtn').forEach(btn => {
      btn.addEventListener('click', async () => {
        await supa.auth.signOut();
        leaveApp();
      });
    });

    el('avatarBadge').addEventListener('click', () => selectSection('settings'));

    // Active-event picker: scope cars/tasks/stats to the chosen event.
    el('activeEventSelect').addEventListener('change', (e) => {
      state.activeEventId = e.target.value || '';
      if (state.activeEventId) localStorage.setItem('kultura_active_event', state.activeEventId);
      else localStorage.removeItem('kultura_active_event');
      applyActiveEvent();
    });

    // Tasks assignee filter.
    el('tasksAssigneeSelect').addEventListener('change', (e) => {
      state.tasksAssignee = e.target.value || 'all';
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
    const WHATSNEW_VERSION = '2026-07-16';
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
        ru: { t: 'Напоминания о сроках', d: 'Автоматическое уведомление при приближении срока задачи и уведомления о комментариях к вашим задачам.' } }
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

    el('manualRefreshBtn').addEventListener('click', async () => {
      const btn = el('manualRefreshBtn');
      btn.disabled = true;
      btn.classList.add('loading');
      btn.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;"></span>';
      try {
        await loadData();
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
        const rows = list.map(c => ({
          'Brand': c.brand || '', 'Model': c.model || '', 'An': c.year || '',
          'Proprietar': c.owner || '', 'Placă': c.plate || '',
          'Telefon': c.phone || c.contact || '', 'Email': c.email || '',
          'Oraș': c.city || '', 'Zonă': c.zone || '',
          'Status': c.status || '', 'VIP': c.is_vip ? 'DA' : '',
          'Eveniment': evTitle(c.event_id), 'Note': c.additional_notes || ''
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

    el('deleteAllCarsBtn').addEventListener('click', async () => {
      if (!await uiConfirm('Ești sigur că vrei să ștergi TOATE mașinile din baza de date?\n\nAceastă acțiune este ireversibilă!')) return;

      try {
        const { error } = await supa.from('cars').delete().neq('id', 0);
        if (error) {
          uiAlert('Eroare la ștergere: ' + error.message);
        } else {
          uiAlert('Toate mașinile au fost șterse cu succes!');
          await loadData();
        }
      } catch (err) {
        uiAlert('Eroare: ' + err.message);
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
      cars: [], tasks: [], events: [], profiles: [], notifications: [], team: [],
      authUsers: null,
      carsFilter: 'all', carsSearch: '',
      tasksFilter: 'all', tasksSearch: '', tasksDept: 'all', tasksAssignee: 'all',
      tasksView: localStorage.getItem('kultura_tasks_view') || 'list',
      eventsFilter: 'all', eventsSearch: '',
      teamSearch: '',
      activeEventId: localStorage.getItem('kultura_active_event') || ''
    };

    // ----- ACTIVE EVENT FILTER -----
    // When an event is selected in the header, cars/tasks/stats are scoped to
    // it. Empty string = all events.
    function matchesActiveEvent(row) {
      if (!state.activeEventId) return true;
      return String(row.event_id) === String(state.activeEventId);
    }
    function activeCars()  { return (state.cars  || []).filter(matchesActiveEvent); }
    function activeTasks() { return (state.tasks || []).filter(matchesActiveEvent); }

    function populateEventPicker() {
      const sel = el('activeEventSelect');
      if (!sel) return;
      const prev = state.activeEventId;
      // Rebuild options (keep the "all" placeholder = first option).
      while (sel.options.length > 1) sel.remove(1);
      (state.events || []).forEach(ev => {
        const opt = document.createElement('option');
        opt.value = String(ev.id);
        opt.textContent = ev.title || ('#' + ev.id);
        sel.appendChild(opt);
      });
      // If the previously selected event vanished, fall back to "all".
      if (prev && !(state.events || []).some(e => String(e.id) === String(prev))) {
        state.activeEventId = '';
        localStorage.removeItem('kultura_active_event');
      }
      sel.value = state.activeEventId;
    }

    function applyActiveEvent() {
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
      try { renderTeam(); } catch (_) {}
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
    const ROLE_RANK = { member: 0, staff: 1, admin: 2 };
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
      const gateBtn = el('gateOpenBtn');
      if (gateBtn) gateBtn.style.display = staff ? '' : 'none';
      // Add buttons (cars/events/tasks) are for staff and admins only.
      document.querySelectorAll('.add-btn[data-modal], #aiImportBtn').forEach(b => {
        b.style.display = staff ? '' : 'none';
      });
    }

    // ------------ INVISIBLE POLLING PIPELINE ------------
    // Goal: refresh data every 1s in the background WITHOUT touching the DOM
    // when nothing changed. When something DID change, re-render only the
    // affected slice(s) and preserve scroll + input focus across the re-render.
    // No spinners, no flicker, no dropped inputs, no dropped modals.

    // Fingerprint helper — stable, cheap digest over the fields that actually
    // affect what the user sees. If two fetches yield the same fingerprint,
    // the corresponding renderer is skipped entirely.
    const CAR_FP_FIELDS   = ['id','status','status_color','zone','plate','phone','contact','owner','model','brand','is_vip','category','additional_notes','year','city','email','transport_info','social_links','responsible_person','modifications','photos','event_id'];
    const TASK_FP_FIELDS  = ['id','status','status_color','priority','category','team','title','assigned_user_id','assigned_user_name','assigned_to','completed_by_user_id','completed_by_user_name','completed_at','started_at','is_completed','date','due_date','due_at','detailed_description','event','event_id','created_by','created_at','checklist'];
    const EVENT_FP_FIELDS = ['id','status','status_color','title','name','date','location','description','image_url'];
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

    let inFlightLoad = null;
    async function loadData() {
      if (inFlightLoad) return inFlightLoad; // dedupe concurrent calls
      inFlightLoad = (async () => {
        try {
          // Fetch all data in parallel
          const results = await Promise.allSettled([
            supa.from('cars').select('*').order('id', { ascending: false }),
            supa.from('tasks').select('*').order('id', { ascending: false }),
            supa.from('events').select('*').order('id', { ascending: false }),
            supa.from('profiles').select('*')
          ]);

          // Only overwrite each slice if the fetch succeeded; otherwise keep
          // the previous data on screen (requirement: no wipe on transient error).
          const nextCars     = results[0].status === 'fulfilled' && !results[0].value.error ? (results[0].value.data || []) : null;
          const nextTasks    = results[1].status === 'fulfilled' && !results[1].value.error ? (results[1].value.data || []) : null;
          const nextEvents   = results[2].status === 'fulfilled' && !results[2].value.error ? (results[2].value.data || []) : null;
          const nextProfiles = results[3].status === 'fulfilled' && !results[3].value.error ? (results[3].value.data || []) : null;

          if (nextCars     !== null) state.cars     = nextCars;
          if (nextTasks    !== null) state.tasks    = nextTasks;
          if (nextEvents   !== null) state.events   = nextEvents;
          if (nextProfiles !== null) state.profiles = nextProfiles;

          // Persist the car list so the offline gate check-in can look cars up
          // with no connection (the PWA shell is cached; the data is not).
          if (nextCars !== null) cacheCarsOffline(nextCars);
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
          } else {
            _consecutiveErrors = 0;
          }

          // Compute new fingerprints — this is the "diff" step. Only when the
          // fingerprint of a slice changes do we touch the DOM for that slice.
          const newFp = {
            cars:     makeFp(state.cars,     CAR_FP_FIELDS),
            tasks:    makeFp(state.tasks,    TASK_FP_FIELDS),
            events:   makeFp(state.events,   EVENT_FP_FIELDS),
            profiles: makeFp(state.profiles, PROF_FP_FIELDS)
          };
          const carsChanged   = newFp.cars     !== _fp.cars;
          const tasksChanged  = newFp.tasks    !== _fp.tasks;
          const eventsChanged = newFp.events   !== _fp.events;
          const profsChanged  = newFp.profiles !== _fp.profiles;
          const anyChanged    = carsChanged || tasksChanged || eventsChanged || profsChanged;

          // Persist new fingerprints upfront so we don't accidentally re-render
          // the same state twice if a renderer synchronously triggers another poll.
          _fp.cars     = newFp.cars;
          _fp.tasks    = newFp.tasks;
          _fp.events   = newFp.events;
          _fp.profiles = newFp.profiles;

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
          if (_consecutiveErrors <= 1) console.error('Critical data load error:', err);
        } finally {
          inFlightLoad = null;
        }
      })();
      return inFlightLoad;
    }

    // ----- POLLING (safety net) -----
    // Realtime (the kultura-live channel below) is the primary refresh
    // trigger; this poll is only a fallback for missed events, so it runs
    // every 20s instead of every second. Recursive setTimeout so a slow
    // fetch cannot pile up follow-up ticks.
    let pollTimer = null;
    let _pollBooted = false;
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
      // Backoff on repeated errors: 20s → 40s → 80s (cap 2min). 20s when healthy.
      const delay = _consecutiveErrors === 0
        ? 20000
        : Math.min(120000, 20000 * Math.pow(2, _consecutiveErrors - 1));
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
      if (action.type === 'car-update') {
        const existing = box.find(a => a.type === 'car-update' && String(a.carId) === String(action.carId));
        if (existing) {
          existing.patch = { ...existing.patch, ...action.patch };
          existing.ts = Date.now();
        } else {
          box.push({ id: 'a' + Date.now() + Math.random().toString(36).slice(2, 6), tries: 0, ts: Date.now(), ...action });
        }
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
    function gateCheckIn(carId) {
      applyLocalCarPatch(carId, { status: 'Sosit', status_color: '#10B981' });
      enqueueAction({ type: 'car-update', carId, patch: { status: 'Sosit', status_color: '#10B981' } });
      renderGate(); updateGateSyncUI();
      flushOutbox();
      showToast(t('gate.checked_in'));
    }
    function gateSetZone(carId, zone) {
      const z = (zone || '').trim();
      applyLocalCarPatch(carId, { zone: z || null });
      enqueueAction({ type: 'car-update', carId, patch: { zone: z || null } });
      updateGateSyncUI();
      flushOutbox();
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
      updateGateSyncUI();
      flushOutbox();
      setTimeout(() => inp && inp.focus(), 60);
    }
    function closeGate() {
      const ov = el('gateOverlay');
      if (!ov) return;
      ov.classList.remove('show');
      ov.setAttribute('aria-hidden', 'true');
    }
    function renderGate() {
      const box = el('gateResults');
      if (!box) return;
      const q = (state.gateSearch || '').trim().toLowerCase();
      const src = ((state.cars && state.cars.length) ? state.cars : loadCachedCars()).filter(matchesActiveEvent);
      let list = src;
      if (q) {
        list = src.filter(c =>
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
        const arrived = statusKey(c.status) === 'sosit';
        const name = [c.brand, c.model].filter(Boolean).join(' ') || c.model || '—';
        return `
          <div class="gate-car ${arrived ? 'arrived' : ''}" data-car-id="${c.id}">
            <div class="gate-car-info">
              <div class="gate-plate">${escape(c.plate || '—')}${c.is_vip ? ' <span class="gate-vip">VIP</span>' : ''}</div>
              <div class="gate-car-sub">${escape(name)}${c.owner ? ' · ' + escape(c.owner) : ''}</div>
            </div>
            <input class="gate-zone" data-gate-zone="${c.id}" value="${escape(c.zone || '')}" placeholder="${escape(t('gate.zone_ph'))}" inputmode="text">
            <button class="gate-arrive ${arrived ? 'done' : ''}" data-gate-arrive="${c.id}" ${arrived ? 'disabled' : ''}>
              ${arrived
                ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
                : escape(t('gate.arrive'))}
            </button>
          </div>`;
      }).join('') + (list.length > 60 ? `<div class="gate-more">${escape(t('gate.more', { n: list.length - 60 }))}</div>` : '');
    }

    // Gate wiring
    el('gateOpenBtn')?.addEventListener('click', openGate);
    el('gateCloseBtn')?.addEventListener('click', closeGate);
    el('gateSyncBtn')?.addEventListener('click', flushOutbox);
    el('gateSearch')?.addEventListener('input', (e) => { state.gateSearch = e.target.value; renderGate(); });
    el('gateResults')?.addEventListener('click', (e) => {
      const arr = e.target.closest('[data-gate-arrive]');
      if (arr && !arr.disabled) { gateCheckIn(arr.dataset.gateArrive); return; }
    });
    el('gateResults')?.addEventListener('change', (e) => {
      const zi = e.target.closest('[data-gate-zone]');
      if (zi) gateSetZone(zi.dataset.gateZone, zi.value);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && el('gateOverlay')?.classList.contains('show')) closeGate();
    });

    // Connectivity → drain the queue and refresh the indicator.
    window.addEventListener('online',  () => { updateGateSyncUI(); flushOutbox(); });
    window.addEventListener('offline', () => { updateGateSyncUI(); });
    updateGateSyncUI();

    function renderStats(cars, tasks, events) {
      // Cars/tasks respect the active-event filter; events count stays global.
      const scopedCars = activeCars();
      const scopedTasks = activeTasks();
      el('statCars').textContent = scopedCars.length;
      el('statEvents').textContent = (events || state.events || []).length;
      el('statCarsConfirmed').textContent = scopedCars.filter(c => (c.status || '').toLowerCase().includes('sosit')).length;
      el('statTasks').textContent = scopedTasks.filter(tk => !tk.is_completed).length;

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

      if (!list.length) {
        el('heroTitle').textContent = t("common.nothing_found");
        el('heroSub').textContent = t("home.loading");
        el('heroDate').textContent = '';
        el('heroLocation').textContent = '';
        el('heroDays').textContent = '—';
        return;
      }
      const e = list[0];
      el('heroTitle').textContent = e.title || '—';
      el('heroSub').textContent = e.subtitle || '';
      el('heroDate').innerHTML = calendarIcon() + (e.date || '');
      el('heroLocation').innerHTML = pinIcon() + (e.location || '');
      el('heroDays').textContent = e.days_left ?? '—';
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
        if (state.eventsFilter !== 'all' && state.eventsFilter !== status) return false;
        if (!q) return true;
        return (e.title || '').toLowerCase().includes(q) ||
               (e.subtitle || '').toLowerCase().includes(q) ||
               (e.location || '').toLowerCase().includes(q);
      });
    }

    function renderEventsChips() {
      const c = el('eventsChips');
      const total = state.events.length;
      const counts = { all: total };
      EVENT_STATUS_OPTIONS.forEach(o => {
        counts[o.key] = state.events.filter(e => eventStatusKey(e.status) === o.key).length;
      });
      const chips = [{ key: 'all', label: t('tasks.filter_all') }, ...EVENT_STATUS_OPTIONS.map(o => ({ key: o.key, label: translateStatus(o.label, 'event') }))];
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
                ${e.days_left != null ? `<div style="margin-top:10px;color:var(--text-dim);font-size:11px;">${e.days_left} ${t("common.days")}</div>` : ''}
              </div>
            </div>
            <div class="event-actions">
              ${buttons}
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

    const CAR_STATUS_OPTIONS = [
      { key: 'invitat', label: 'Invitat', color: '#3B82F6' },
      { key: 'sosit',   label: 'Sosit',   color: '#10B981' },
      { key: 'plecat',  label: 'Plecat',  color: '#8B5CF6' }
    ];
    function statusKey(status) {
      const s = (status || '').toLowerCase();
      if (s.includes('sosit')) return 'sosit';
      if (s.includes('plecat')) return 'plecat';
      if (s.includes('invitat')) return 'invitat';
      return null;
    }

    function filterCars() {
      const q = state.carsSearch.toLowerCase();
      return activeCars().filter(car => {
        if (state.carsFilter === 'vip' && !car.is_vip) return false;
        if (state.carsFilter !== 'all' && state.carsFilter !== 'vip') {
          if (statusKey(car.status) !== state.carsFilter) return false;
        }
        if (!q) return true;
        return (car.model || '').toLowerCase().includes(q) ||
               (car.owner || '').toLowerCase().includes(q) ||
               (car.plate || '').toLowerCase().includes(q) ||
               (car.zone || '').toLowerCase().includes(q);
      });
    }

    function renderCarsChips() {
      const total = state.cars.length;
      const counts = {
        all: total,
        vip: state.cars.filter(c => c.is_vip).length
      };
      CAR_STATUS_OPTIONS.forEach(o => {
        counts[o.key] = state.cars.filter(c => statusKey(c.status) === o.key).length;
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

    function renderCars() {
      el('carsCount').textContent = state.cars.length;
      const list = filterCars();
      const c = el('carsList');
      if (!list.length) return c.innerHTML = '<div class="card">' + emptyState(t("common.nothing_found")) + '</div>';
      c.innerHTML = '<div class="page-grid-2" id="carsInner"></div>';
      el('carsInner').innerHTML = list.map(car => {
        const active = statusKey(car.status);
        const actionButtons = CAR_STATUS_OPTIONS.map(opt => {
          let label = opt.label;
          if (opt.key === 'invitat') label = t("car.status.invited");
          if (opt.key === 'sosit')   label = t("car.status.arrived");
          if (opt.key === 'plecat')  label = t("car.status.left");

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

        return `
          <div class="card car-row" data-row-id="${car.id}" style="cursor:pointer; padding: 16px; margin-bottom: 0;">
            <div style="display:flex; align-items:flex-start; gap:12px;">
              <div class="row-icon blue" style="flex-shrink:0;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H5.24a2 2 0 0 0-1.8 1.1l-.8 1.63A6 6 0 0 0 2 12.42V16h2"/><circle cx="6.5" cy="16.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/></svg>
              </div>
              <div style="flex:1; min-width:0;">
                <div class="row-title" style="display:flex; align-items:center; flex-wrap:wrap; gap:6px;">
                  <span>${escape(carName)}</span>
                  ${car.is_vip ? '<span class="badge purple" style="font-size:8px; padding:2px 6px;">VIP</span>' : ''}
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
      }).join('');
    }

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
          sysRole: (p.role && ['admin','staff','member'].includes(p.role)) ? p.role : (p.is_admin ? 'admin' : 'member'),
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
            : '';
        return `
          <div class="team-card" ${attrs}>
            <div class="team-avatar">${m.avatar ? `<img src="${escape(m.avatar)}" alt="" loading="lazy">` : initials}</div>
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
          <div class="workload-avatar">${r.avatar ? `<img src="${escape(r.avatar)}" alt="" loading="lazy">` : initials}</div>
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
        const { error } = await withSpinner(() => supa.from('cars').update({ status: label, status_color: color }).eq('id', id));
        if (error) return uiAlert('Eroare: ' + error.message);
        await loadData();
      } else if (action === 'delete') {
        const id = btn.dataset.carId, label = btn.dataset.carLabel || 'mașina';
        if (!await uiConfirm(`Șterge "${label}"?`, { okLabel: t('common.delete') })) return;
        const snapshot = (state.cars || []).find(c => String(c.id) === String(id)) || null;
        const { error } = await withSpinner(() => supa.from('cars').delete().eq('id', id));
        if (error) return uiAlert('Eroare: ' + error.message);
        await loadData();
        if (snapshot) showUndoToast(t('undo.car_deleted'), () => restoreRow('cars', snapshot));

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
      } else if (action === 'event-delete') {
        const id = btn.dataset.eventId, label = btn.dataset.eventLabel || 'evenimentul';
        if (!await uiConfirm(`Șterge "${label}"?\nAcțiune ireversibilă.`)) return;
        const { error } = await withSpinner(() => supa.from('events').delete().eq('id', id));
        if (error) return uiAlert('Eroare: ' + error.message);
        await loadData();
      }
    });

    // Chips filter — cars/tasks/events
    document.addEventListener('click', (ev) => {
      const cc = ev.target.closest('[data-cars-filter]');
      if (cc) { state.carsFilter = cc.dataset.carsFilter; renderCarsChips(); renderCars(); return; }
      const tc = ev.target.closest('[data-tasks-filter]');
      if (tc) { state.tasksFilter = tc.dataset.tasksFilter; renderTasksChips(); renderTasks(); return; }
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
    });

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

    // Search inputs
    ['cars', 'tasks', 'events', 'team'].forEach(k => {
      const input = el(k + 'Search');
      if (!input) return;
      input.addEventListener('input', (e) => {
        state[k + 'Search'] = e.target.value;
        ({ cars: renderCars, tasks: renderTasks, events: renderEvents, team: renderTeam }[k])();
      });
    });

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
        if (currentVal) sel.value = currentVal;
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
    }
    function closeModal(m) {
      m.classList.remove('show');
      const form = m.querySelector('form');
      if (form) form.reset();
      const msg = m.querySelector('.modal-msg');
      if (msg) msg.classList.remove('show');
    }
    let userBeingEdited = null;
    // Primary admin — role is locked (also enforced by a DB trigger).
    const PRIMARY_ADMIN_EMAIL = 'igor.gratii.99@mail.ru';

    document.addEventListener('click', (ev) => {
      const opener = ev.target.closest('[data-modal]');
      if (opener) {
        const modalName = opener.dataset.modal;
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
            - status (string: "Invitat", "Sosit", "Plecat", or "În așteptare")
            - status_color (string: HEX, e.g., #3B82F6 for Invitat, #10B981 for Sosit)
            - is_vip (boolean - true if mentioned as VIP or special guest)
            - phone (string - PERSONAL PHONE NUMBER / NUMĂR DE TELEFON)
            - email (string)
            - brand (string - manufacturer, e.g. "BMW", "Audi", "Toyota")
            - city (string)

            COLUMN / LABEL HINTS — recognize these headers in the source:
            - Plate column labels: "placă", "placa", "placuță", "placuta", "nr. înmatriculare", "nr inmatriculare", "număr de înmatriculare", "matriculă", "matricula", "plate", "license plate", "reg. no", "номер"
            - Phone column labels: "telefon", "nr. telefon", "număr de telefon", "contact", "phone", "mobile", "gsm", "тел", "телефон"
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
          (dupCount ? ` (${dupCount} dubluri — vor fi sărite la import).` : '.');
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
            ? `<span style="background: rgba(245,158,11,0.18); color: var(--orange); padding: 2px 6px; border-radius: 4px; font-weight: 700;">DUBLURĂ — se sare</span>`
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
        // Skip rows flagged as duplicates during the preview step.
        const fresh = cars.filter(c => !c._dup);
        const skipped = cars.length - fresh.length;
        if (fresh.length === 0) {
          statusDiv.textContent = 'Toate mașinile din fișier există deja — nimic de importat.';
          statusDiv.style.color = 'var(--orange)';
          el('aiImportConfirmBtn').disabled = false;
          return;
        }
        // Map AI output onto uniform, whitelisted rows: a stray key invented
        // by the model would otherwise reject a whole batch ("column not
        // found"), and NOT NULL columns need string fallbacks.
        const rows = fresh.map(c => ({
          model: c.model || '',
          owner: c.owner || '',
          plate: c.plate || '',
          zone: c.zone || '',
          status: c.status || 'Invitat',
          status_color: c.status_color || '#3B82F6',
          is_vip: c.is_vip === true,
          phone: c.phone || c.contact || null,
          email: c.email || null,
          brand: c.brand || null,
          city: c.city || null,
          contact: c.contact || c.phone || null
        }));
        // Bulk insert in batches instead of one request per row — far fewer
        // round-trips, and a failed batch actually surfaces its error.
        const BATCH = 100;
        for (let i = 0; i < rows.length; i += BATCH) {
          const { error } = await supa.from('cars').insert(rows.slice(i, i + BATCH));
          if (error) throw new Error(`Lotul ${Math.floor(i / BATCH) + 1}: ${error.message}`);
        }

        statusDiv.textContent = `Au fost importate ${rows.length} mașini cu succes!` +
          (skipped ? ` ${skipped} dubluri au fost sărite.` : '');
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
      const days = fd.get('days_left');

      try {
        const { error } = await supa.from('events').insert({
          title: fd.get('title').trim(),
          subtitle: (fd.get('subtitle') || '').trim() || null,
          date: fd.get('date').trim(),
          location: (fd.get('location') || '').trim() || null,
          status, status_color: statusColor,
          days_left: days ? parseInt(days, 10) : null
        });
        if (error) throw error;
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

    // Realtime — reload when anyone changes the tables
    supa.channel('kultura-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cars' }, (payload) => {
        if (payload.eventType === 'UPDATE' && payload.new.status !== payload.old.status) {
          sendAppNotification("Actualizare Mașină", `${payload.new.brand || ''} ${payload.new.model} este acum: ${payload.new.status}`);
        } else if (payload.eventType === 'INSERT') {
          sendAppNotification("Mașină Nouă", `A fost adăugat un nou vehicul: ${payload.new.model}`);
        }
        loadData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          if (payload.new.is_completed && !payload.old.is_completed) {
            sendAppNotification("Task Finalizat", `"${payload.new.title}" a fost terminat de ${payload.new.completed_by_user_name || 'cineva'}`);
          } else if (payload.new.assigned_user_id !== payload.old.assigned_user_id && payload.new.assigned_user_id) {
            sendAppNotification("Task Preluat", `${payload.new.assigned_user_name} a început lucrul la: ${payload.new.title}`);
          }
        }
        loadData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => loadData())
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
      .subscribe((status) => {
        // On every (re)connect pull a fresh snapshot — changes that happened
        // while the socket was down would otherwise wait for the 20s poll.
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
    function uiDialog({ title = '', message = '', okLabel = 'OK', cancelLabel = null, danger = false }) {
      return new Promise((resolve) => {
        // A dialog opened over another one settles the previous as cancelled.
        if (_dialogResolve) _dialogClose(false);
        _dialogResolve = resolve;
        el('uiDialogTitle').textContent = title;
        el('uiDialogTitle').style.display = title ? 'block' : 'none';
        el('uiDialogMessage').textContent = message;
        const ok = el('uiDialogOk');
        const cancel = el('uiDialogCancel');
        ok.textContent = okLabel;
        ok.className = 'ui-dialog-btn ' + (danger ? 'danger' : 'primary');
        cancel.style.display = cancelLabel ? 'inline-block' : 'none';
        if (cancelLabel) cancel.textContent = cancelLabel;
        el('uiDialog').classList.add('show');
        ok.focus();
      });
    }
    el('uiDialogOk').addEventListener('click', () => _dialogClose(true));
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

    function showToast(msg, kind = 'ok') {
      const t = el('modalToast');
      if (!t) return;
      t.textContent = msg;
      t.className = 'modal-toast show' + (kind === 'error' ? ' error' : '');
      clearTimeout(t._timer);
      t._timer = setTimeout(() => t.classList.remove('show'), 2600);
    }

    // NOTE: both fmt helpers return PLAIN text — callers are responsible for
    // escaping (they all pass the result through escape()).
    function fmtDateTime(v) {
      if (!v) return '—';
      try {
        const d = new Date(v);
        if (isNaN(d)) return String(v);
        return d.toLocaleString('ro-RO', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      } catch { return String(v); }
    }

    function fmtRelative(v) {
      if (!v) return '';
      const d = new Date(v);
      if (isNaN(d)) return String(v);
      const diff = (Date.now() - d.getTime()) / 1000;
      if (diff < 60) return 'acum câteva secunde';
      if (diff < 3600) return `acum ${Math.floor(diff/60)} min`;
      if (diff < 86400) return `acum ${Math.floor(diff/3600)} h`;
      return fmtDateTime(v);
    }

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

    // ----- TASK DETAIL -----
    async function showTaskDetail(taskId) {
      const task = state.tasks.find(x => String(x.id) === String(taskId));
      if (!task) return;
      openTaskDetailId = task.id;

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
        </div>

        <div class="detail-section">
          <div class="detail-section-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            ${escape(t('task.detail.updates_section'))}
          </div>
          <div id="taskUpdatesList"><div class="empty" style="padding:12px 0;color:var(--text-mute);font-size:13px;">${escape(t('task.detail.updates_loading'))}</div></div>
          <div class="update-composer">
            <textarea id="taskUpdateInput" rows="2" placeholder="${escape(t('task.detail.update_placeholder'))}"></textarea>
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
            <div class="update-msg">${escape(u.message)}</div>
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
    function normalizePhone(raw) {
      let d = String(raw || '').replace(/[^\d+]/g, '');
      if (!d) return '';
      if (d.startsWith('+')) return d.slice(1).replace(/\D/g, '');
      d = d.replace(/\D/g, '');
      if (d.startsWith('00')) return d.slice(2);
      if (d.startsWith('373')) return d;
      if (d.startsWith('0')) {
        const rest = d.slice(1);
        return rest.startsWith('373') ? rest : '373' + rest; // 0 + local (guard double-code)
      }
      if (d.length >= 7 && d.length <= 9) return '373' + d;  // bare local number
      return d;
    }

    // WhatsApp + Call buttons for a car's owner, with a pre-filled message.
    function contactButtons(c) {
      const phone = normalizePhone(c.phone || c.contact);
      if (!phone) return '';
      const ev = (state.events || []).find(e => String(e.id) === String(c.event_id));
      const carName = [c.brand, c.model].filter(Boolean).join(' ') || c.model || '';
      const parts = [`Bună${c.owner ? ' ' + c.owner : ''}!`];
      if (ev?.title) parts.push(`Vă contactăm în legătură cu evenimentul ${ev.title}.`);
      if (carName) parts.push(`Mașină: ${carName}${c.plate ? ' (' + c.plate + ')' : ''}.`);
      if (c.zone) parts.push(`Zona dvs. de parcare: ${c.zone}.`);
      const msg = encodeURIComponent(parts.join(' '));
      const wa = `https://wa.me/${phone}?text=${msg}`;
      const tel = `tel:+${phone}`;
      return `
        <a class="btn ghost contact-wa" href="${wa}" target="_blank" rel="noopener">
          <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm5.8 14.01c-.24.68-1.42 1.31-1.96 1.35-.5.05-.96.23-3.23-.67-2.73-1.08-4.45-3.88-4.58-4.06-.13-.18-1.1-1.46-1.1-2.79 0-1.33.7-1.98.94-2.25.24-.27.53-.34.7-.34.18 0 .35 0 .5.01.16.01.38-.06.59.45.24.58.81 2 .88 2.14.07.14.12.31.02.49-.09.18-.14.29-.28.45-.14.16-.29.36-.42.48-.14.14-.28.29-.12.56.16.27.71 1.17 1.53 1.9 1.05.94 1.94 1.23 2.21 1.37.27.14.43.12.59-.07.16-.18.68-.79.86-1.07.18-.27.36-.22.6-.13.24.09 1.55.73 1.81.86.27.14.44.2.5.31.07.11.07.63-.17 1.31z"/></svg>
          WhatsApp
        </a>
        <a class="btn ghost" href="${tel}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          ${escape(t('car.contact.call'))}
        </a>`;
    }

    // ----- CAR DETAIL -----
    function showCarDetail(carId) {
      const c = state.cars.find(x => String(x.id) === String(carId));
      if (!c) return;
      openCarDetailId = c.id;

      const title = [c.brand, c.model].filter(Boolean).join(' ') || c.model || '—';
      el('carDetailTitle').textContent = title;
      const badges = [
        `<div class="badge ${statusToBadge(c.status)}">${escape(c.status ? localizeCarStatus(c.status) : '—')}</div>`,
        c.is_vip ? `<div class="badge purple">VIP</div>` : '',
        c.category ? `<div class="badge blue">${escape(localizeDept(c.category))}</div>` : ''
      ].filter(Boolean).join(' ');
      el('carDetailBadges').innerHTML = badges;

      const photos = Array.isArray(c.photos) ? c.photos : [];
      const photosHtml = `
        <div class="detail-photos" id="carPhotosGrid">
          ${photos.map((p, i) => `
            <div class="detail-photo-wrap">
              <img src="${escape(p)}" alt="" class="detail-photo" loading="lazy" data-photo-view="${escape(p)}">
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
        <div class="detail-section">
          <div class="detail-section-title">${escape(t('car.detail.section_photos'))}</div>
          ${photosHtml}
        </div>

        <div class="detail-section">
          <div class="detail-section-title" style="display:flex; align-items:center;">
            ${escape(t('car.detail.section_zone'))}
            <button class="detail-edit-btn" id="carEditZoneBtn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              ${escape(t('common.edit'))}
            </button>
          </div>
          <div id="carZoneView">
            ${c.zone
              ? `<div class="detail-text">${escape(c.zone)}</div>`
              : `<div class="detail-text empty">${escape(t('car.detail.zone_empty'))}</div>`}
          </div>
        </div>

        <div class="detail-section">
          <div class="detail-section-title">${escape(t('car.detail.section_car'))}</div>
          <div class="detail-grid">
            ${fieldRow(t('car.detail.brand'), c.brand)}
            ${fieldRow(t('car.detail.model'), c.model)}
            ${fieldRow(t('car.detail.year'), c.year)}
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
            ${fieldRow(t('car.detail.responsible'), c.responsible_person)}
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

      const canDelete = roleAtLeast('staff');
      el('carDetailActions').innerHTML = `
        ${contactButtons(c)}
        <button class="btn ghost" data-detail-action="car-status" data-car-id="${c.id}" data-label="Sosit" data-color="#10B981">${escape(t('car.detail.action_confirm'))}</button>
        <button class="btn ghost" data-detail-action="car-status" data-car-id="${c.id}" data-label="Plecat" data-color="#8B5CF6">${escape(t('car.detail.action_reject'))}</button>
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

      // Zone inline editor
      el('carEditZoneBtn').onclick = () => {
        const view = el('carZoneView');
        view.innerHTML = `
          <input type="text" class="detail-textarea" id="carZoneInput"
            style="min-height:auto; padding:12px 14px;"
            placeholder="${escape(t('car.detail.zone_placeholder'))}"
            value="${escape(c.zone || '')}">
          <div class="detail-inline-actions">
            <button class="btn ghost small" id="carZoneCancel">${escape(t('common.cancel'))}</button>
            <button class="btn small" id="carZoneSave">${escape(t('common.save'))}</button>
          </div>`;
        el('carEditZoneBtn').style.display = 'none';
        el('carZoneCancel').onclick = () => showCarDetail(c.id);
        el('carZoneSave').onclick = async () => {
          const btn = el('carZoneSave'); btn.disabled = true;
          const newVal = el('carZoneInput').value.trim();
          const { error } = await supa.from('cars').update({ zone: newVal || null }).eq('id', c.id);
          if (error) { showToast('Eroare: ' + error.message, 'error'); btn.disabled = false; return; }
          showToast(t('car.detail.zone_saved'));
          c.zone = newVal;
          await loadData();
          showCarDetail(c.id);
        };
        const zi = el('carZoneInput');
        zi.focus();
        zi.setSelectionRange(zi.value.length, zi.value.length);
        zi.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter') { ev.preventDefault(); el('carZoneSave').click(); }
          if (ev.key === 'Escape') { ev.preventDefault(); el('carZoneCancel').click(); }
        });
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
          // Best-effort storage cleanup — the DB row is the source of truth.
          const objPath = (url || '').split('/car-photos/')[1];
          if (objPath) supa.storage.from('car-photos').remove([decodeURIComponent(objPath)]);
          await loadData();
          showCarDetail(c.id);
        };
      });
      el('carDetailBody').querySelectorAll('[data-photo-view]').forEach(img => {
        img.onclick = () => openLightbox(img.dataset.photoView);
      });

      openModal('car-detail');
    }

    // Downscale an image client-side before upload (max 1600px, JPEG 82%).
    // Falls back to the original file for formats canvas can't decode (HEIC).
    async function downscaleImage(file, maxSide = 1600, quality = 0.82) {
      try {
        const bmp = await createImageBitmap(file);
        const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
        const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(bmp, 0, 0, w, h);
        if (bmp.close) bmp.close();
        const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality));
        return blob || file;
      } catch (_) {
        return file;
      }
    }

    function openLightbox(url) {
      let lb = document.getElementById('photoLightbox');
      if (!lb) {
        lb = document.createElement('div');
        lb.id = 'photoLightbox';
        lb.className = 'photo-lightbox';
        lb.innerHTML = '<img alt="">';
        lb.addEventListener('click', () => lb.classList.remove('show'));
        document.body.appendChild(lb);
      }
      lb.querySelector('img').src = url;
      lb.classList.add('show');
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
      const taskRow = ev.target.closest('.task-row');
      if (taskRow && taskRow.dataset.rowId) { showTaskDetail(taskRow.dataset.rowId); return; }
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

        } else if (action === 'car-status') {
          const id = btn.dataset.carId;
          const { error } = await supa.from('cars').update({
            status: btn.dataset.label, status_color: btn.dataset.color
          }).eq('id', id);
          if (error) throw error;
          showToast(t('car.detail.toast_status_updated'));
          await loadData();
          showCarDetail(id);

        } else if (action === 'car-delete') {
          const id = btn.dataset.carId;
          const label = btn.dataset.carLabel || 'mașina';
          if (!await uiConfirm(t('car.detail.confirm_delete', { label }))) { btn.disabled = false; return; }
          const snapshot = (state.cars || []).find(c => String(c.id) === String(id)) || null;
          const { error } = await supa.from('cars').delete().eq('id', id);
          if (error) throw error;
          closeModal(document.getElementById('modal-car-detail'));
          await loadData();
          if (snapshot) showUndoToast(t('undo.car_deleted'), () => restoreRow('cars', snapshot));
          else showToast(t('car.detail.toast_deleted'));
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
      const total = state.tasks.length;
      const counts = { all: total };
      counts.open = state.tasks.filter(tk => taskStatusKey(tk.status) !== 'completed').length;
      counts.done = state.tasks.filter(tk => taskStatusKey(tk.status) === 'completed').length;

      TASK_STATUS_OPTIONS.forEach(o => {
        counts[o.key] = state.tasks.filter(tk => taskStatusKey(tk.status) === o.key).length;
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
        ...TASK_STATUS_OPTIONS.map(o => ({ key: o.key, label: statusLabel(o.key) })),
        { key: 'done', label: t('tasks.filter_done') }
      ];
      el('tasksChips').innerHTML = chips.map(chip => `
        <button class="chip ${state.tasksFilter === chip.key ? 'active' : ''}" data-tasks-filter="${chip.key}">
          ${escape(chip.label)}
          <span class="count">· ${counts[chip.key] || 0}</span>
        </button>
      `).join('');
    }

    function applyTasksView() {
      const listC = el('tasksList'), kanC = el('tasksKanban');
      const kanban = state.tasksView === 'kanban';
      if (listC) listC.style.display = kanban ? 'none' : '';
      if (kanC)  kanC.style.display  = kanban ? '' : 'none';
      document.querySelectorAll('#tasksViewToggle [data-tasks-view]').forEach(b => {
        b.classList.toggle('active', b.dataset.tasksView === state.tasksView);
      });
    }

    function renderTasks() {
      el('tasksCount').textContent = state.tasks.length;
      applyTasksView();
      if (state.tasksView === 'kanban') { renderTasksKanban(); return; }
      const list = filterTasks();
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

      c.innerHTML = '<div class="tk-grid">' + list.map(tk => {
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

        return `
          <div class="tk-card task-row" data-row-id="${tk.id}">
            <div class="tk-head">
              <div class="tk-status-icon ${iconClass}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${iconSvg}</svg>
              </div>
              <div class="tk-badges">
                ${tk.category ? `<span class="tk-badge cat">${escape(tk.category)}</span>` : ''}
                ${pri ? `<span class="tk-badge ${pri.cls === 'priority-urgent' ? 'pri-urgent' : pri.cls === 'priority-high' ? 'pri-high' : 'pri-normal'}">${pri.label}${pri.mark ? ' <span style="opacity:0.75">' + pri.mark + '</span>' : ''}</span>` : ''}
                <span class="tk-badge stat-${badgeClass}">${statusLabel}</span>
                ${isOverdue(tk) ? `<span class="tk-badge overdue">${escape(t('task.overdue'))}</span>` : ''}
              </div>
            </div>

            <div class="tk-title ${sk === 'completed' ? 'done' : ''}">${escape(tk.title)}</div>
            <div class="tk-sub">
              ${tk.event ? `<span class="event">${escape(tk.event)}</span>` : ''}
              ${tk.event && tk.date ? '<span class="sep">•</span>' : ''}
              ${tk.date ? `<span>${escape(tk.date)}</span>` : ''}
            </div>

            <div class="tk-info-grid">
              <div class="tk-info-cell">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${iconCal}</svg>
                <div class="cell-body">
                  <div class="cell-k">${t("task.due_date")}</div>
                  <div class="cell-v">${escape(tk.date || '—')}</div>
                </div>
              </div>
              <div class="tk-info-cell">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${iconUser}</svg>
                <div class="cell-body">
                  <div class="cell-k">${sk === 'completed' ? t("task.finished_by") : t("task.worked_by")}</div>
                  <div class="cell-v">${responsible}</div>
                </div>
              </div>
            </div>

            <div class="tk-divider"></div>

            <div class="tk-actions">
              ${primaryBtn}
              <button class="tk-btn dots" data-row-id="${tk.id}" data-open-detail="1" title="${t("task.details")}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${iconDots}</svg>
              </button>
            </div>
          </div>
        `;
      }).join('') + '</div>';
    }

    // ----- KANBAN BOARD -----
    function renderTasksKanban() {
      const board = el('tasksKanban');
      if (!board) return;
      const list = filterTasks();
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
      if (error) { uiAlert(t('common.error') + ': ' + error.message); return false; }
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

    function emptyState(text) {
      return `<div class="empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="15" x2="15" y2="9"/></svg>
        <p>${escape(text)}</p>
      </div>`;
    }
    function escape(str) {
      return String(str ?? '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
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
  