/* Petroleum Engineer — Software Mastery
   البيانات في data.js (PE_DOMAINS, PE_TOOLS). هذا الملف يحتوي المنطق والواجهة فقط. */
'use strict';

(() => {
  /* ---------- أدوات مساعدة ---------- */
  const $ = (id) => document.getElementById(id);
  const MAX_COMPARE = 3;

  // تخزين آمن: قد يفشل في الوضع الخاص أو عند حظر الموقع
  const store = {
    get(key, fallback = null) {
      try { const v = localStorage.getItem(key); return v === null ? fallback : v; } catch { return fallback; }
    },
    set(key, value) { try { localStorage.setItem(key, value); } catch { /* تجاهل */ } },
    getJSON(key, fallback) {
      try { const v = JSON.parse(localStorage.getItem(key)); return Array.isArray(v) ? v : fallback; } catch { return fallback; }
    },
    setJSON(key, value) { this.set(key, JSON.stringify(value)); }
  };

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeUrl = (url) => { try { const u = new URL(url); return /^https?:$/.test(u.protocol) ? u.href : '#'; } catch { return '#'; } };
  const escRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const normalize = (value) => String(value || '').toLocaleLowerCase('ar').normalize('NFKD')
    .replace(/[ً-ٰٟ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

  const debounce = (fn, ms = 180) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  const licenseLabel = (v) => v === 'free' ? 'مجاني / مفتوح المصدر' : v === 'commercial' ? 'تجاري / يحتاج ترخيصاً' : 'حسب الإصدار أو الاستخدام';

  // تمييز كلمة البحث بعد تهريب النص (آمن)
  const highlight = (text, q) => {
    const safe = esc(text);
    const term = q.trim();
    if (!term) return safe;
    return safe.replace(new RegExp(escRegExp(esc(term)), 'gi'), (m) => `<mark>${m}</mark>`);
  };

  /* ---------- البيانات ---------- */
  const tools = PE_TOOLS;
  const domains = PE_DOMAINS;
  const domainByName = new Map(domains.map((d) => [d.name, d]));
  const toolById = new Map(tools.map((t) => [t.id, t]));
  const searchIndex = new Map(tools.map((t) => {
    const d = domainByName.get(t.domain);
    const hay = normalize([t.name, t.domain, d ? d.en : '', ...(d ? d.aliases : []), t.desc, t.why, t.workflow, t.example, ...t.uses].join(' '));
    return [t.id, hay];
  }));

  /* ---------- الحالة ---------- */
  const state = {
    q: '', domain: 'all', license: 'all', favOnly: false,
    favs: new Set(store.getJSON('pe-favs', []).filter((id) => toolById.has(id))),
    compare: store.getJSON('pe-compare', []).filter((id) => toolById.has(id)).slice(0, MAX_COMPARE),
    lastFocus: null
  };

  /* ---------- عناصر الصفحة ---------- */
  const el = {
    domainGrid: $('domainGrid'), toolGrid: $('toolGrid'), searchInput: $('searchInput'), clearSearch: $('clearSearch'),
    domainFilter: $('domainFilter'), licenseFilter: $('licenseFilter'), favOnly: $('favOnly'), favCount: $('favCount'),
    resultCount: $('resultCount'), emptyState: $('emptyState'), emptyText: $('emptyText'), resetFilters: $('resetFilters'),
    dialog: $('toolDialog'), dialogContent: $('dialogContent'), dialogClose: $('dialogClose'),
    compareBar: $('compareBar'), compareChips: $('compareChips'), compareGo: $('compareGo'), compareClear: $('compareClear'),
    compareDialog: $('compareDialog'), compareContent: $('compareContent'), compareClose: $('compareClose'),
    toast: $('toast'), menuToggle: $('menuToggle'), mainNav: $('mainNav'), themeToggle: $('themeToggle'),
    installBtn: $('installBtn'), progressBar: $('progressBar')
  };

  /* ---------- إشعار مؤقت ---------- */
  let toastTimer;
  const toast = (msg) => {
    el.toast.textContent = msg;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('show'), 2600);
  };

  /* ---------- الصور مع بديل عند الفشل ---------- */
  const imageUrl = (tool) => {
    const d = domainByName.get(tool.domain);
    return `https://images.unsplash.com/${encodeURIComponent(d ? d.image : 'photo-1516937941344-00b4e0337589')}?auto=format&fit=crop&w=1000&q=82`;
  };
  const attachImageFallback = (root) => {
    root.querySelectorAll('img[data-fallback]').forEach((img) => {
      const swap = () => {
        const box = document.createElement('div');
        box.className = 'img-fallback';
        box.setAttribute('role', 'img');
        box.setAttribute('aria-label', img.alt);
        box.textContent = img.dataset.icon || '◇';
        img.replaceWith(box);
      };
      img.addEventListener('error', swap, { once: true });
      if (img.complete && img.naturalWidth === 0 && img.src) swap();
    });
  };

  /* ---------- المجالات ---------- */
  const renderDomains = () => {
    const frag = document.createDocumentFragment();
    domains.forEach((d) => {
      const count = tools.filter((t) => t.domain === d.name).length;
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'domain-card';
      card.innerHTML = `<span class="domain-icon" aria-hidden="true">${esc(d.icon)}</span><h3>${esc(d.name)}</h3><p>${esc(d.en)}</p><small class="domain-tool-count">${count} أداة</small><span class="arrow" aria-hidden="true">↙</span>`;
      card.setAttribute('aria-label', `${d.name}: ${count} أداة. عرض أدوات المجال`);
      card.addEventListener('click', () => {
        el.domainFilter.value = d.name;
        applyFilters();
        $('toolbox').scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      });
      frag.appendChild(card);
      const option = document.createElement('option');
      option.value = d.name;
      option.textContent = d.name;
      el.domainFilter.appendChild(option);
    });
    el.domainGrid.appendChild(frag);
  };

  const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- الفلترة وحالة الرابط ---------- */
  const filterTools = () => {
    const q = normalize(state.q);
    return tools.filter((t) =>
      (!q || searchIndex.get(t.id).includes(q)) &&
      (state.domain === 'all' || t.domain === state.domain) &&
      (state.license === 'all' || t.license === state.license) &&
      (!state.favOnly || state.favs.has(t.id)));
  };

  const syncUrl = () => {
    try {
      const p = new URLSearchParams();
      if (state.q.trim()) p.set('q', state.q.trim());
      if (state.domain !== 'all') p.set('d', state.domain);
      if (state.license !== 'all') p.set('l', state.license);
      if (state.favOnly) p.set('fav', '1');
      const qs = p.toString();
      history.replaceState(null, '', `${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`);
    } catch { /* file:// أو بيئة مقيدة */ }
  };

  const readUrl = () => {
    try {
      const p = new URLSearchParams(location.search);
      state.q = (p.get('q') || '').slice(0, 80);
      const d = p.get('d');
      state.domain = d && domainByName.has(d) ? d : 'all';
      const l = p.get('l');
      state.license = ['free', 'commercial', 'mixed'].includes(l) ? l : 'all';
      state.favOnly = p.get('fav') === '1';
    } catch { /* تجاهل */ }
    el.searchInput.value = state.q;
    el.domainFilter.value = state.domain;
    el.licenseFilter.value = state.license;
  };

  const applyFilters = () => {
    state.q = el.searchInput.value;
    state.domain = el.domainFilter.value;
    state.license = el.licenseFilter.value;
    renderTools();
    syncUrl();
  };

  /* ---------- بطاقات الأدوات ---------- */
  const favButtonHTML = (id) => {
    const on = state.favs.has(id);
    return `<button type="button" class="icon-action fav-btn${on ? ' on' : ''}" data-id="${esc(id)}" aria-pressed="${on}" aria-label="${on ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}" title="المفضلة">${on ? '♥' : '♡'}</button>`;
  };
  const compareButtonHTML = (id) => {
    const on = state.compare.includes(id);
    return `<button type="button" class="icon-action cmp-btn${on ? ' on' : ''}" data-id="${esc(id)}" aria-pressed="${on}" aria-label="${on ? 'إزالة من المقارنة' : 'إضافة إلى المقارنة'}" title="مقارنة">⇄</button>`;
  };

  const renderTools = () => {
    const filtered = filterTools();
    const q = state.q;
    const frag = document.createDocumentFragment();
    filtered.forEach((t) => {
      const card = document.createElement('article');
      card.className = 'tool-card';
      card.dataset.id = t.id;
      card.innerHTML = `<div class="tool-top"><span class="tool-category">${esc(t.domain)}</span><span class="card-actions">${favButtonHTML(t.id)}${compareButtonHTML(t.id)}</span></div>
        <span class="license ${esc(t.license)}">${esc(licenseLabel(t.license))}</span>
        <h3>${highlight(t.name, q)}</h3><p>${highlight(t.desc, q)}</p>
        <div class="tool-foot"><span>${t.uses.length} استخدامات رئيسية</span><button type="button" class="details-btn" data-open="${esc(t.id)}" aria-label="شرح ومثال تطبيقي: ${esc(t.name)}">شرح ومثال تطبيقي ←</button></div>`;
      frag.appendChild(card);
    });
    el.toolGrid.replaceChildren(frag);
    el.resultCount.textContent = `${filtered.length} أداة`;
    el.emptyState.hidden = filtered.length !== 0;
    if (!filtered.length) {
      el.emptyText.textContent = state.favOnly && !state.favs.size
        ? 'لم تضف أي أداة إلى المفضلة بعد. اضغط على ♡ في أي بطاقة لحفظها هنا.'
        : 'لا توجد نتائج مطابقة. جرّب كلمة بحث أخرى أو غيّر عوامل التصفية.';
    }
    el.clearSearch.hidden = !el.searchInput.value;
  };

  // تحديث حالة الأزرار دون إعادة بناء الشبكة (يحافظ على موضع التمرير والتركيز)
  const refreshToolButtons = () => {
    document.querySelectorAll('.fav-btn').forEach((b) => {
      const on = state.favs.has(b.dataset.id);
      b.classList.toggle('on', on);
      b.textContent = on ? '♥' : '♡';
      b.setAttribute('aria-pressed', String(on));
      b.setAttribute('aria-label', on ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة');
    });
    document.querySelectorAll('.cmp-btn').forEach((b) => {
      const on = state.compare.includes(b.dataset.id);
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
      b.setAttribute('aria-label', on ? 'إزالة من المقارنة' : 'إضافة إلى المقارنة');
    });
    el.favCount.textContent = state.favs.size;
    el.favCount.hidden = state.favs.size === 0;
    el.favOnly.setAttribute('aria-pressed', String(state.favOnly));
    el.favOnly.classList.toggle('on', state.favOnly);
  };

  /* ---------- المفضلة ---------- */
  const toggleFav = (id) => {
    const t = toolById.get(id);
    if (!t) return;
    if (state.favs.has(id)) { state.favs.delete(id); toast(`أُزيلت ${t.name} من المفضلة`); }
    else { state.favs.add(id); toast(`أُضيفت ${t.name} إلى المفضلة`); }
    store.setJSON('pe-favs', [...state.favs]);
    if (state.favOnly) { renderTools(); } // تحديث القائمة إذا كان فلتر المفضلة مفعلاً
    refreshToolButtons();
    refreshDialogButtons();
  };

  /* ---------- المقارنة ---------- */
  const toggleCompare = (id) => {
    const t = toolById.get(id);
    if (!t) return;
    const i = state.compare.indexOf(id);
    if (i >= 0) state.compare.splice(i, 1);
    else if (state.compare.length >= MAX_COMPARE) { toast(`الحد الأقصى ${MAX_COMPARE} أدوات للمقارنة`); return; }
    else state.compare.push(id);
    store.setJSON('pe-compare', state.compare);
    refreshToolButtons();
    renderCompareBar();
    refreshDialogButtons();
  };

  const renderCompareBar = () => {
    const n = state.compare.length;
    el.compareBar.hidden = n === 0;
    document.body.classList.toggle('has-compare-bar', n > 0);
    el.compareChips.replaceChildren(...state.compare.map((id) => {
      const t = toolById.get(id);
      const chip = document.createElement('span');
      chip.className = 'chip';
      const label = document.createElement('span');
      label.textContent = t.name;
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.textContent = '×';
      rm.setAttribute('aria-label', `إزالة ${t.name} من المقارنة`);
      rm.addEventListener('click', () => toggleCompare(id));
      chip.append(label, rm);
      return chip;
    }));
    el.compareGo.disabled = n < 2;
    el.compareGo.textContent = n < 2 ? 'اختر أداتين على الأقل' : `قارن ${n} أدوات`;
  };

  const openCompare = () => {
    const items = state.compare.map((id) => toolById.get(id)).filter(Boolean);
    if (items.length < 2) { toast('اختر أداتين على الأقل للمقارنة'); return; }
    const row = (label, fn) => `<tr><th scope="row">${esc(label)}</th>${items.map((t) => `<td>${fn(t)}</td>`).join('')}</tr>`;
    el.compareContent.innerHTML = `
      <h2 id="compareTitle">مقارنة الأدوات</h2>
      <p class="dialog-desc">مقارنة سريعة للمجال والترخيص والاستخدامات. التفاصيل الكاملة في نافذة كل أداة.</p>
      <div class="table-wrap"><table class="compare-table">
        <thead><tr><th scope="col"><span class="visually-hidden">الخاصية</span></th>${items.map((t) => `<th scope="col" class="ltr">${esc(t.name)}</th>`).join('')}</tr></thead>
        <tbody>
          ${row('المجال', (t) => esc(t.domain))}
          ${row('الترخيص', (t) => `<span class="license ${esc(t.license)}">${esc(licenseLabel(t.license))}</span>`)}
          ${row('الوصف', (t) => esc(t.desc))}
          ${row('أهم الاستخدامات', (t) => `<ul>${t.uses.map((u) => `<li>${esc(u)}</li>`).join('')}</ul>`)}
          ${row('سير العمل', (t) => esc(t.workflow))}
          ${row('مثال تطبيقي', (t) => esc(t.example))}
          ${row('الروابط', (t) => `<a href="${esc(safeUrl(t.url))}" target="_blank" rel="noopener noreferrer">الموقع الرسمي ↗</a>`)}
        </tbody></table></div>
      <div class="dialog-actions"><button type="button" class="btn btn-ghost" id="comparePrint">طباعة المقارنة</button></div>`;
    $('comparePrint').addEventListener('click', () => { document.body.classList.add('printing-dialog'); window.print(); });
    openDialog(el.compareDialog);
  };

  /* ---------- النوافذ ---------- */
  const openDialog = (dlg) => {
    state.lastFocus = document.activeElement;
    if (!dlg.open) dlg.showModal();
  };
  const bindDialog = (dlg) => {
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('close', () => {
      document.body.classList.remove('printing-dialog');
      if (state.lastFocus && document.contains(state.lastFocus)) state.lastFocus.focus();
    });
  };

  let currentToolId = null;
  const refreshDialogButtons = () => {
    if (!el.dialog.open || !currentToolId) return;
    const fav = $('dialogFav'), cmp = $('dialogCmp');
    if (fav) { const on = state.favs.has(currentToolId); fav.setAttribute('aria-pressed', String(on)); fav.textContent = on ? '♥ في المفضلة' : '♡ أضف إلى المفضلة'; fav.classList.toggle('on', on); }
    if (cmp) { const on = state.compare.includes(currentToolId); cmp.setAttribute('aria-pressed', String(on)); cmp.textContent = on ? '⇄ في المقارنة' : '⇄ أضف للمقارنة'; cmp.classList.toggle('on', on); }
  };

  const openTool = (t) => {
    currentToolId = t.id;
    const d = domainByName.get(t.domain);
    const youtube = `https://www.youtube.com/results?search_query=${encodeURIComponent(t.course)}`;
    el.dialogContent.innerHTML = `
      <span class="dialog-kicker">${esc(t.domain)}</span><h2 id="dialogTitle">${esc(t.name)}</h2><span class="license ${esc(t.license)}">${esc(licenseLabel(t.license))}</span>
      <div class="dialog-actions top">
        <button type="button" class="btn btn-ghost small" id="dialogFav" aria-pressed="false"></button>
        <button type="button" class="btn btn-ghost small" id="dialogCmp" aria-pressed="false"></button>
      </div>
      <p class="dialog-desc">${esc(t.desc)}</p>
      <figure class="tool-example-figure"><img src="${esc(imageUrl(t))}" alt="صورة توضيحية مرتبطة بمجال ${esc(t.domain)}" loading="lazy" decoding="async" data-fallback data-icon="${esc(d ? d.icon : '◇')}"><figcaption>صورة توضيحية للمجال الهندسي، وليست لقطة شاشة من البرنامج.</figcaption></figure>
      <div class="dialog-section"><h3>لماذا يستخدمها المهندس؟</h3><p class="dialog-desc">${esc(t.why)}</p></div>
      <div class="dialog-section"><h3>أهم الاستخدامات</h3><ul>${t.uses.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
      <div class="dialog-section"><h3>سير عمل هندسي مقترح</h3><p class="dialog-desc">${esc(t.workflow)}</p></div>
      <div class="dialog-section"><h3>مثال تطبيقي تتعلم منه</h3><div class="example-box">${esc(t.example)}</div></div>
      <div class="dialog-section"><h3>روابط مباشرة</h3><div class="link-list"><a href="${esc(safeUrl(t.url))}" target="_blank" rel="noopener noreferrer">الموقع الرسمي / صفحة المنتج ↗</a><a href="${esc(youtube)}" target="_blank" rel="noopener noreferrer">ابحث عن دروس على YouTube ↗</a></div><small class="link-note">تحقق من الترخيص والتوفر ومتطلبات النظام من الجهة المطورة؛ روابط YouTube تفتح نتائج بحث وليست اعتماداً لدورة بعينها.</small></div>`;
    attachImageFallback(el.dialogContent);
    $('dialogFav').addEventListener('click', () => toggleFav(t.id));
    $('dialogCmp').addEventListener('click', () => toggleCompare(t.id));
    openDialog(el.dialog);
    refreshDialogButtons();
  };

  /* ---------- المظهر ---------- */
  const applyTheme = (dark) => {
    document.body.classList.toggle('dark', dark);
    el.themeToggle.setAttribute('aria-pressed', String(dark));
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#101a16' : '#1c6b50');
  };
  const initTheme = () => {
    const saved = store.get('pe-theme');
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    applyTheme(saved ? saved === 'dark' : mq.matches);
    mq.addEventListener?.('change', (e) => { if (!store.get('pe-theme')) applyTheme(e.matches); });
    el.themeToggle.addEventListener('click', () => {
      const dark = !document.body.classList.contains('dark');
      applyTheme(dark);
      store.set('pe-theme', dark ? 'dark' : 'light');
    });
  };

  /* ---------- القائمة وشريط التقدم ---------- */
  const initNav = () => {
    const setMenu = (open) => {
      el.mainNav.classList.toggle('open', open);
      el.menuToggle.setAttribute('aria-expanded', String(open));
      el.menuToggle.setAttribute('aria-label', open ? 'إغلاق القائمة' : 'فتح القائمة');
    };
    el.menuToggle.addEventListener('click', () => setMenu(!el.mainNav.classList.contains('open')));
    el.mainNav.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

    let ticking = false;
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const total = document.documentElement.scrollHeight - window.innerHeight;
        el.progressBar.style.width = `${total > 0 ? (window.scrollY / total) * 100 : 0}%`;
        ticking = false;
      });
    }, { passive: true });
  };

  /* ---------- PWA ---------- */
  const initPwa = () => {
    let deferred = null;
    window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; el.installBtn.hidden = false; });
    el.installBtn.addEventListener('click', async () => {
      if (!deferred) return;
      deferred.prompt();
      try { await deferred.userChoice; } catch { /* تجاهل */ }
      deferred = null;
      el.installBtn.hidden = true;
    });
    window.addEventListener('appinstalled', () => { el.installBtn.hidden = true; toast('تم تثبيت التطبيق'); });
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => { /* التسجيل اختياري */ }); });
    }
  };

  /* ---------- أرقام الواجهة ---------- */
  const initStats = () => {
    const set = (id, v) => { const n = $(id); if (n) n.textContent = v; };
    set('statDomains', domains.length);
    set('statTools', tools.length);
  };

  /* ---------- الأحداث ---------- */
  const bindEvents = () => {
    el.searchInput.addEventListener('input', debounce(applyFilters));
    el.searchInput.addEventListener('input', () => { el.clearSearch.hidden = !el.searchInput.value; });
    el.clearSearch.addEventListener('click', () => { el.searchInput.value = ''; applyFilters(); el.searchInput.focus(); });
    el.domainFilter.addEventListener('change', applyFilters);
    el.licenseFilter.addEventListener('change', applyFilters);
    el.favOnly.addEventListener('click', () => { state.favOnly = !state.favOnly; renderTools(); refreshToolButtons(); syncUrl(); });
    el.resetFilters.addEventListener('click', () => {
      el.searchInput.value = ''; el.domainFilter.value = 'all'; el.licenseFilter.value = 'all'; state.favOnly = false;
      applyFilters(); refreshToolButtons();
    });

    // تفويض الأحداث على شبكة الأدوات
    el.toolGrid.addEventListener('click', (e) => {
      const fav = e.target.closest('.fav-btn');
      if (fav) { toggleFav(fav.dataset.id); return; }
      const cmp = e.target.closest('.cmp-btn');
      if (cmp) { toggleCompare(cmp.dataset.id); return; }
      const open = e.target.closest('[data-open]');
      if (open) { const t = toolById.get(open.dataset.open); if (t) openTool(t); }
    });

    el.dialogClose.addEventListener('click', () => el.dialog.close());
    el.compareClose.addEventListener('click', () => el.compareDialog.close());
    bindDialog(el.dialog);
    bindDialog(el.compareDialog);
    el.compareGo.addEventListener('click', openCompare);
    el.compareClear.addEventListener('click', () => { state.compare = []; store.setJSON('pe-compare', []); refreshToolButtons(); renderCompareBar(); });
    window.addEventListener('afterprint', () => document.body.classList.remove('printing-dialog'));
  };

  /* ---------- التشغيل ---------- */
  renderDomains();
  readUrl();
  initTheme();
  initNav();
  initPwa();
  initStats();
  bindEvents();
  renderTools();
  refreshToolButtons();
  renderCompareBar();
})();
