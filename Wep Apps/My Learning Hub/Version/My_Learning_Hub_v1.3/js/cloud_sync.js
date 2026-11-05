// cloud_sync.js - optional sync of the learning data to the user's own Google Drive.
//
// - Data lives in a single JSON file inside Drive's hidden "appDataFolder". Only this app's OAuth
//   client can see it, and the app is limited to the `drive.appdata` scope (no access to other files).
// - Sign-in uses Google Identity Services (token flow, no secrets and no server involved).
//   The access token lives in sessionStorage only (about one hour); the Client ID is not a secret.
// - The Gemini API key, the focus-timer state and the AI draft are never synced.
(function (window) {
  'use strict';

  const META_KEY = 'my_learning_hub_sync_v1';
  const TOKEN_KEY = 'my_learning_hub_sync_token_v1';
  const FILE_NAME = 'learning-hub-data.json';
  const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
  const GIS_URL = 'https://accounts.google.com/gsi/client';
  const DRIVE_FILES = 'https://www.googleapis.com/drive/v3/files';
  const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
  const FILE_FIELDS = 'id,md5Checksum,modifiedTime';
  const AUTO_SYNC_DELAY_MS = 4000;
  const MIN_FOCUS_SYNC_GAP_MS = 60000;

  const CLIENT_ID_PATTERN = /^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/i;

  const state = {
    status: 'off',        // off | needs-auth | idle | syncing | conflict | error
    error: '',
    lastSyncAt: 0,
    conflict: null        // { local, remote, resolve(choice) } while status === 'conflict'
  };
  const listeners = [];
  let busy = false;
  let queued = false;
  let applying = false;
  let timer = null;
  let gisPromise = null;
  let store = null;

  // ---------- small helpers ---------- //
  const readJson = (storage, key) => {
    try { return JSON.parse(storage.getItem(key) || 'null'); } catch (_) { return null; }
  };
  const writeJson = (storage, key, value) => {
    try { storage.setItem(key, JSON.stringify(value)); } catch (_) { /* best effort */ }
  };

  function getMeta() {
    const m = readJson(localStorage, META_KEY) || {};
    return {
      clientId: typeof m.clientId === 'string' ? m.clientId : '',
      fileId: typeof m.fileId === 'string' ? m.fileId : '',
      remoteTag: typeof m.remoteTag === 'string' ? m.remoteTag : '',
      localHash: typeof m.localHash === 'string' ? m.localHash : '',
      lastSyncAt: Number(m.lastSyncAt) || 0,
      enabled: m.enabled !== false
    };
  }
  function setMeta(patch) {
    const next = { ...getMeta(), ...patch };
    writeJson(localStorage, META_KEY, next);
    return next;
  }

  function getToken() {
    const t = readJson(sessionStorage, TOKEN_KEY);
    return t && t.token && Number(t.expiresAt) > Date.now() ? t.token : '';
  }
  function setToken(token, expiresInSec) {
    writeJson(sessionStorage, TOKEN_KEY, { token, expiresAt: Date.now() + Math.max(60, Number(expiresInSec) || 3600) * 1000 - 60000 });
  }
  function clearToken() {
    try { sessionStorage.removeItem(TOKEN_KEY); } catch (_) { /* ignore */ }
  }

  function emit() { listeners.forEach(cb => { try { cb({ ...state }); } catch (e) { console.error(e); } }); }
  function setStatus(status, error = '') {
    state.status = status;
    state.error = error;
    state.lastSyncAt = getMeta().lastSyncAt;
    emit();
  }

  function summarize(data) {
    const domains = Array.isArray(data.domains) ? data.domains : [];
    const tasks = domains.reduce((n, d) => n + (d.stages || []).reduce((m, s) => m + (s.tasks || []).length, 0), 0);
    return { domains: domains.length, tasks, updated: data.lastUpdated || '' };
  }

  // ---------- Google Identity Services ---------- //
  function loadGis() {
    if (window.google && window.google.accounts && window.google.accounts.oauth2) return Promise.resolve();
    if (gisPromise) return gisPromise;
    gisPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = GIS_URL;
      s.async = true;
      s.onload = () => (window.google && window.google.accounts && window.google.accounts.oauth2
        ? resolve() : reject(new Error('تعذر تحميل مكتبة تسجيل الدخول من Google.')));
      s.onerror = () => { gisPromise = null; reject(new Error('تعذر الوصول إلى خدمة تسجيل الدخول من Google. تحقق من اتصال الإنترنت.')); };
      document.head.appendChild(s);
    });
    return gisPromise;
  }

  async function requestToken(prompt) {
    const meta = getMeta();
    if (!CLIENT_ID_PATTERN.test(meta.clientId)) throw new Error('أدخل معرّف عميل Google (Client ID) صحيحًا أولًا.');
    await loadGis();
    return new Promise((resolve, reject) => {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: meta.clientId,
        scope: SCOPE,
        callback: (resp) => {
          if (!resp || resp.error || !resp.access_token) {
            reject(new Error(resp && resp.error === 'access_denied'
              ? 'لم تمنح الإذن للتطبيق. المزامنة تحتاج إذن الوصول إلى مجلد بيانات التطبيق فقط.'
              : 'فشل تسجيل الدخول إلى Google' + (resp && resp.error_description ? `: ${resp.error_description}` : '.')));
            return;
          }
          setToken(resp.access_token, resp.expires_in);
          resolve(resp.access_token);
        },
        error_callback: (err) => {
          const type = err && err.type;
          reject(new Error(type === 'popup_closed' ? 'أُغلقت نافذة تسجيل الدخول قبل الإكمال.'
            : type === 'popup_failed_to_open' ? 'منع المتصفح نافذة تسجيل الدخول. اسمح بالنوافذ المنبثقة لهذا الموقع.'
            : 'تعذر تسجيل الدخول إلى Google.'));
        }
      });
      client.requestAccessToken({ prompt });
    });
  }

  // ---------- Drive REST ---------- //
  async function driveFetch(url, options = {}) {
    const token = getToken();
    if (!token) { const e = new Error('انتهت جلسة Google. اضغط «اتصال» لتسجيل الدخول مجددًا.'); e.code = 'auth'; throw e; }
    let res;
    try {
      res = await fetch(url, { ...options, headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` } });
    } catch (_) {
      const e = new Error('تعذر الاتصال بـ Google Drive. تحقق من الإنترنت.'); e.code = 'network'; throw e;
    }
    if (res.status === 401) { clearToken(); const e = new Error('انتهت جلسة Google. اضغط «اتصال» لتسجيل الدخول مجددًا.'); e.code = 'auth'; throw e; }
    if (!res.ok) {
      let msg = '';
      try { const j = await res.json(); msg = j && j.error && j.error.message || ''; } catch (_) { /* ignore */ }
      const e = new Error(res.status === 403
        ? 'رفض Google الطلب. تأكد من تفعيل Google Drive API في مشروعك ومن أنك مضاف كمستخدم تجريبي.' + (msg ? ` (${msg})` : '')
        : `خطأ من Google Drive (${res.status})` + (msg ? `: ${msg}` : ''));
      e.code = 'http';
      throw e;
    }
    return res;
  }

  async function findRemote() {
    const q = encodeURIComponent(`name='${FILE_NAME}' and trashed=false`);
    const res = await driveFetch(`${DRIVE_FILES}?spaces=appDataFolder&q=${q}&orderBy=modifiedTime desc&pageSize=1&fields=files(${FILE_FIELDS})`);
    const json = await res.json();
    return (json.files && json.files[0]) || null;
  }

  async function downloadRemote(fileId) {
    const res = await driveFetch(`${DRIVE_FILES}/${encodeURIComponent(fileId)}?alt=media`);
    const text = await res.text();
    if (text.length > 5 * 1024 * 1024) throw new Error('ملف السحابة كبير جدًا.');
    return text;
  }

  async function uploadRemote(fileId, body) {
    if (fileId) {
      const res = await driveFetch(`${DRIVE_UPLOAD}/${encodeURIComponent(fileId)}?uploadType=media&fields=${FILE_FIELDS}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body
      });
      return res.json();
    }
    const boundary = 'lhb' + Math.random().toString(36).slice(2);
    const metadata = JSON.stringify({ name: FILE_NAME, parents: ['appDataFolder'], mimeType: 'application/json' });
    const multipart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${boundary}--`;
    const res = await driveFetch(`${DRIVE_UPLOAD}?uploadType=multipart&fields=${FILE_FIELDS}`, {
      method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body: multipart
    });
    return res.json();
  }

  // ---------- local data bridge ---------- //
  function applyLocal(data) {
    applying = true;
    try { store.replaceData(data); } finally { applying = false; }
  }

  async function pushLocal(remote) {
    const body = JSON.stringify(store.getData());
    const hash = window.LearningUtils.hashData(store.getData());
    const meta = await uploadRemote(remote ? remote.id : getMeta().fileId, body);
    setMeta({ fileId: meta.id, remoteTag: meta.md5Checksum || meta.modifiedTime || '', localHash: hash, lastSyncAt: Date.now() });
  }

  async function pullRemote(remote, parsedText) {
    const clean = window.LearningUtils.sanitizeData(JSON.parse(parsedText));
    applyLocal(clean);
    setMeta({ fileId: remote.id, remoteTag: remote.md5Checksum || remote.modifiedTime || '', localHash: window.LearningUtils.hashData(store.getData()), lastSyncAt: Date.now() });
  }

  // ---------- main sync ---------- //
  async function runSync() {
    const remote = await findRemote();
    const meta = getMeta();
    const localHash = window.LearningUtils.hashData(store.getData());

    if (!remote) {
      await pushLocal(null);
      return 'uploaded';
    }

    const remoteTag = remote.md5Checksum || remote.modifiedTime || '';
    const localChanged = localHash !== meta.localHash;
    const remoteChanged = remoteTag !== meta.remoteTag;
    const neverSynced = !meta.remoteTag;

    if (!neverSynced && !localChanged && !remoteChanged) {
      setMeta({ lastSyncAt: Date.now() });
      return 'unchanged';
    }
    if (!neverSynced && localChanged && !remoteChanged) {
      await pushLocal(remote);
      return 'uploaded';
    }

    const text = await downloadRemote(remote.id);
    let remoteData;
    try { remoteData = window.LearningUtils.sanitizeData(JSON.parse(text)); } catch (_) {
      throw new Error('ملف السحابة تالف أو بصيغة غير مدعومة. لم يتم تغيير أي شيء.');
    }

    if (!neverSynced && remoteChanged && !localChanged) {
      await pullRemote(remote, text);
      return 'downloaded';
    }
    // First connection on this device with untouched sample data: just adopt the cloud copy.
    if (neverSynced && !store.isTouched()) {
      await pullRemote(remote, text);
      return 'downloaded';
    }

    // Both sides changed (or first connect with real local data): let the user decide.
    state.conflict = {
      local: summarize(store.getData()),
      remote: summarize(remoteData),
      resolve: async (choice) => {
        if (choice === 'cloud') {
          await pullRemote(remote, text);
        } else if (choice === 'local') {
          await pushLocal(remote);
        } else {
          applyLocal(window.LearningUtils.mergeData(store.getData(), remoteData));
          await pushLocal(remote);
        }
      }
    };
    return 'conflict';
  }

  async function syncNow(options = {}) {
    if (!store || !CLIENT_ID_PATTERN.test(getMeta().clientId)) return;
    if (busy) { queued = true; return; }
    if (state.status === 'conflict' && state.conflict) { emit(); return; }

    busy = true;
    try {
      if (!getToken()) {
        if (!options.interactive) { setStatus('needs-auth'); return; }
        await requestToken('');
      }
      setStatus('syncing');
      const result = await runSync();
      setStatus(result === 'conflict' ? 'conflict' : 'idle');
      return result;
    } catch (error) {
      state.conflict = null;
      if (error && error.code === 'auth') setStatus('needs-auth', error.message);
      else setStatus('error', (error && error.message) || 'فشلت المزامنة.');
      if (options.interactive) throw error;
    } finally {
      busy = false;
      if (queued) { queued = false; scheduleSync(); }
    }
  }

  function scheduleSync() {
    if (!store || !getMeta().enabled || !CLIENT_ID_PATTERN.test(getMeta().clientId)) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (getToken() && !busy) syncNow();
      else if (!getToken()) setStatus('needs-auth', state.error);
    }, AUTO_SYNC_DELAY_MS);
  }

  const CloudSync = {
    CLIENT_ID_PATTERN,

    attach(dataStore) {
      store = dataStore;
      store.subscribe(() => { if (!applying) scheduleSync(); });
      const meta = getMeta();
      if (CLIENT_ID_PATTERN.test(meta.clientId)) {
        loadGis().catch(() => {}); // preload so the sign-in popup opens right after the click
        setStatus(getToken() ? 'idle' : 'needs-auth');
        if (getToken()) syncNow();
      }
      // Pull changes made on another device when coming back to the tab.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && getToken() && !busy &&
            Date.now() - getMeta().lastSyncAt > MIN_FOCUS_SYNC_GAP_MS) syncNow();
      });
      window.addEventListener('online', () => { if (getToken()) syncNow(); });
    },

    subscribe(cb) { listeners.push(cb); },
    getState() { return { ...state }; },
    getConfig() { const m = getMeta(); return { clientId: m.clientId, configured: CLIENT_ID_PATTERN.test(m.clientId), connected: !!getToken(), lastSyncAt: m.lastSyncAt }; },

    setClientId(value) {
      const id = String(value || '').trim();
      if (!CLIENT_ID_PATTERN.test(id)) throw new Error('معرّف العميل غير صحيح. يجب أن ينتهي بـ .apps.googleusercontent.com');
      const previous = getMeta().clientId;
      // A different project = a different appData sandbox, so forget the old sync baseline.
      if (previous && previous !== id) { setMeta({ clientId: id, fileId: '', remoteTag: '', localHash: '', lastSyncAt: 0 }); clearToken(); }
      else setMeta({ clientId: id });
      loadGis().catch(() => {});
      setStatus(getToken() ? 'idle' : 'needs-auth');
    },

    // Must be called from a click handler (the sign-in popup needs a user gesture).
    async connect() {
      await syncNow({ interactive: true });
    },

    async syncNow() { return syncNow({ interactive: true }); },

    async resolveConflict(choice) {
      const c = state.conflict;
      if (!c || busy || !['merge', 'cloud', 'local'].includes(choice)) return;
      busy = true;
      setStatus('syncing');
      try {
        await c.resolve(choice);
        state.conflict = null;
        setStatus('idle');
      } catch (e) {
        state.conflict = null;
        if (e && e.code === 'auth') setStatus('needs-auth', e.message);
        else setStatus('error', (e && e.message) || 'فشلت المزامنة.');
      } finally {
        busy = false;
      }
    },

    // Stops syncing on this device. Local data and the cloud copy are both left untouched.
    disconnect() {
      const token = getToken();
      try { if (token && window.google && window.google.accounts) window.google.accounts.oauth2.revoke(token, () => {}); } catch (_) { /* ignore */ }
      clearToken();
      clearTimeout(timer);
      state.conflict = null;
      setMeta({ fileId: '', remoteTag: '', localHash: '', lastSyncAt: 0 });
      setStatus('off');
    },

    forgetClientId() {
      this.disconnect();
      try { localStorage.removeItem(META_KEY); } catch (_) { /* ignore */ }
      setStatus('off');
    }
  };

  window.CloudSync = CloudSync;
})(window);
