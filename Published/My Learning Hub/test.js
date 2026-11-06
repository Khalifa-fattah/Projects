// test.js - dependency-free unit tests for the data layer and the safe-HTML helper.
// Run with:  node test.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

function makeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    _map: map
  };
}

// Loads the real source files into an isolated context (no browser needed).
function loadApp(storageInit) {
  const sandbox = { console, URL, Date, Math, JSON, localStorage: makeStorage(storageInit), setTimeout, clearTimeout };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const f of ['js/sample_data.js', 'js/store.js', 'js/ui.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, f), 'utf8'), sandbox, { filename: f });
  }
  sandbox.SAMPLE = vm.runInContext('INITIAL_DATA', sandbox); // top-level const is not a global property
  return sandbox;
}

let passed = 0;
const failures = [];
const pendingTests = [];
function test(name, fn) {
  try {
    const result = fn();
    if (result && typeof result.then === 'function') {
      pendingTests.push(result.then(() => { passed++; console.log('  ✓ ' + name); }).catch((e) => {
        failures.push(name); console.log('  ✗ ' + name + '\n      ' + (e && e.message));
      }));
    } else {
      passed++; console.log('  ✓ ' + name);
    }
  } catch (e) { failures.push(name); console.log('  ✗ ' + name + '\n      ' + (e && e.message)); }
}

console.log('Security helpers');
{
  const w = loadApp();
  const U = w.LearningUtils;
  const { h } = w.UI;

  test('escapeHtml escapes all dangerous characters', () => {
    assert.strictEqual(U.escapeHtml(`<img src=x onerror="a('b')">&`), '&lt;img src=x onerror=&quot;a(&#39;b&#39;)&quot;&gt;&amp;');
    assert.strictEqual(U.escapeHtml(null), '');
  });
  test('safeUrl accepts only http(s)', () => {
    assert.strictEqual(U.safeUrl('javascript:alert(1)'), '');
    assert.strictEqual(U.safeUrl('JaVaScRiPt:alert(1)'), '');
    assert.strictEqual(U.safeUrl('data:text/html,<script>1</script>'), '');
    assert.strictEqual(U.safeUrl('vbscript:x'), '');
    assert.strictEqual(U.safeUrl('https://example.com/a?b=1'), 'https://example.com/a?b=1');
    assert.strictEqual(U.safeUrl('example.com'), 'https://example.com/');
    assert.strictEqual(U.safeUrl(''), '');
    assert.strictEqual(U.safeUrl({}), '');
  });
  test('h`` escapes interpolations but keeps nested templates', () => {
    const evil = '<script>alert(1)</script>';
    const out = String(h`<p>${evil}</p>`);
    assert.ok(!out.includes('<script>'));
    const nested = String(h`<ul>${['a', 'b<'].map(x => h`<li>${x}</li>`)}</ul>`);
    assert.strictEqual(nested, '<ul><li>a</li><li>b&lt;</li></ul>');
    assert.strictEqual(String(h`${false}${null}${undefined}x`), 'x');
  });
  test('a quote in an id cannot break out of an attribute', () => {
    const out = String(h`<button data-arg0="${`x" onclick="alert(1)`}">`);
    assert.ok(!/"\s*onclick=/.test(out));
  });
}

console.log('\nData validation');
{
  test('sample data survives sanitising unchanged in size', () => {
    const w = loadApp();
    const clean = w.LearningUtils.sanitizeData(w.SAMPLE);
    assert.strictEqual(clean.domains.length, w.SAMPLE.domains.length);
    const count = (d) => d.domains.reduce((n, x) => n + x.stages.reduce((m, s) => m + s.tasks.length, 0), 0);
    assert.strictEqual(count(clean), count(w.SAMPLE));
    assert.strictEqual(clean.domains[0].stages[0].tasks[0].links[0], w.SAMPLE.domains[0].stages[0].tasks[0].links[0]);
  });
  test('import rejects invalid input and keeps current data', () => {
    const w = loadApp();
    const S = w.LearningStore;
    const before = S.exportJSON();
    for (const bad of ['not json', '[]', '{"domains": "x"}', '{}', 'null']) {
      assert.strictEqual(S.importJSON(bad).success, false, bad);
    }
    assert.strictEqual(S.exportJSON(), before);
  });
  test('import neutralises malicious fields', () => {
    const w = loadApp();
    const S = w.LearningStore;
    const evil = {
      domains: [{
        id: `d1"><img src=x onerror=alert(1)>`, name: '<b>x</b>', color: 'red;background:url(//evil)', status: 'hacked', icon: 'nope',
        resources: [{ id: 'r', title: 't', url: 'javascript:alert(1)', type: 'x' }],
        projects: [{ id: 'p', title: 't', liveUrl: 'data:text/html,1', repoUrl: 'https://github.com/a/b' }],
        stages: [{ id: 's', title: 's', tasks: [{ id: 't', title: 't', links: ['javascript:1', 'https://ok.dev'], priority: 'zzz', status: 'zzz' }] }]
      }]
    };
    const res = S.importJSON(JSON.stringify(evil));
    assert.strictEqual(res.success, true);
    const d = S.getData().domains[0];
    assert.ok(/^[A-Za-z0-9_.-]+$/.test(d.id));
    assert.strictEqual(d.color, '#3B82F6');
    assert.strictEqual(d.status, 'active');
    assert.strictEqual(d.icon, 'book');
    assert.strictEqual(d.name, '<b>x</b>'); // kept as text; escaped at render time
    assert.strictEqual(d.resources[0].url, '');
    assert.strictEqual(d.projects[0].liveUrl, '');
    assert.strictEqual(d.projects[0].repoUrl, 'https://github.com/a/b');
    assert.deepStrictEqual(Array.from(d.stages[0].tasks[0].links), ['https://ok.dev/']);
    assert.strictEqual(d.stages[0].tasks[0].priority, 'medium');
    assert.strictEqual(d.stages[0].tasks[0].status, 'todo');
  });
  test('duplicate ids are made unique', () => {
    const w = loadApp();
    const clean = w.LearningUtils.sanitizeData({ domains: [{ id: 'a', name: '1' }, { id: 'a', name: '2' }] });
    assert.notStrictEqual(clean.domains[0].id, clean.domains[1].id);
  });
  test('corrupt stored data is preserved and the app starts fresh', () => {
    const w = loadApp({ my_learning_journey_data_v1: '{broken' });
    assert.strictEqual(w.LearningStore.loadError, 'corrupt-data');
    assert.strictEqual(w.localStorage.getItem('my_learning_journey_data_v1_corrupt'), '{broken');
    assert.ok(w.LearningStore.getDomains().length > 0);
  });
  test('save failure is reported through onSaveError', () => {
    const w = loadApp();
    let reported = null;
    w.LearningStore.onSaveError = (e) => { reported = e; };
    w.localStorage.setItem = () => { throw new Error('quota'); };
    assert.strictEqual(w.LearningStore.save(), false);
    assert.ok(reported);
  });
  test('store sanitises URLs on write', () => {
    const w = loadApp();
    const S = w.LearningStore;
    const d = S.saveDomain({ name: 'x' });
    const r = S.addResource(d.id, { title: 'r', url: 'javascript:alert(1)' });
    assert.strictEqual(r.url, '');
    const p = S.addProject(d.id, { title: 'p', liveUrl: 'javascript:1', repoUrl: 'https://a.dev' });
    assert.strictEqual(p.liveUrl, '');
    assert.strictEqual(p.repoUrl, 'https://a.dev/');
  });
}

console.log('\nBusiness logic');
{
  const fresh = () => {
    const w = loadApp();
    w.LearningStore.resetData(false);
    return w;
  };
  test('local date helper matches the local calendar', () => {
    const w = loadApp();
    const d = new Date(2026, 0, 5, 0, 30); // 00:30 local
    assert.strictEqual(w.LearningUtils.localDate(d), '2026-01-05');
  });
  test('ids are unique even when created in the same millisecond', () => {
    const w = loadApp();
    const ids = new Set(Array.from({ length: 2000 }, () => w.LearningUtils.uid('task')));
    assert.strictEqual(ids.size, 2000);
  });
  test('completing all tasks completes the stage and updates progress', () => {
    const w = fresh(); const S = w.LearningStore;
    const d = S.saveDomain({ name: 'D' });
    const st = S.addStage(d.id, { title: 'S' });
    const t1 = S.addTask(d.id, st.id, { title: 'a' });
    const t2 = S.addTask(d.id, st.id, { title: 'b' });
    S.toggleTaskStatus(d.id, st.id, t1.id);
    assert.strictEqual(S.getDomainById(d.id).stages[0].status, 'in-progress');
    assert.strictEqual(S.getAnalytics().overallProgress, 50);
    S.toggleTaskStatus(d.id, st.id, t2.id);
    assert.strictEqual(S.getDomainById(d.id).stages[0].status, 'completed');
    assert.strictEqual(S.getAnalytics().overallProgress, 100);
  });
  test('removing a daily task does not delete the learning-path task', () => {
    const w = fresh(); const S = w.LearningStore;
    const d = S.saveDomain({ name: 'D' });
    const st = S.addStage(d.id, { title: 'S' });
    const t = S.addTask(d.id, st.id, { title: 'a' });
    const dt = S.addDailyTask({ domainId: d.id, stageId: st.id, taskId: t.id, title: 'a' });
    S.deleteDailyTask(dt.id);
    assert.strictEqual(S.getDomainById(d.id).stages[0].tasks.length, 1);
  });
  test('completing a daily task syncs the original task', () => {
    const w = fresh(); const S = w.LearningStore;
    const d = S.saveDomain({ name: 'D' });
    const st = S.addStage(d.id, { title: 'S' });
    const t = S.addTask(d.id, st.id, { title: 'a' });
    const dt = S.addDailyTask({ domainId: d.id, stageId: st.id, taskId: t.id, title: 'a' });
    S.toggleDailyTask(dt.id);
    assert.strictEqual(S.getDomainById(d.id).stages[0].tasks[0].status, 'completed');
  });
  test('focus sessions are added to learning hours', () => {
    const w = fresh(); const S = w.LearningStore;
    S.updateSettings({ studyHoursTracked: 10 });
    S.addFocusSession({ minutes: 30 });
    S.addFocusSession({ minutes: 30 });
    const a = S.getAnalytics();
    assert.strictEqual(a.hoursTracked, 11);
    assert.strictEqual(a.focusMinutesToday, 60);
    assert.strictEqual(S.addFocusSession({ minutes: 0 }), null);
  });
  test('search ignores Arabic diacritics and alef variants', () => {
    const w = fresh(); const S = w.LearningStore;
    const d = S.saveDomain({ name: 'أكواد البرمجة', description: 'تَعَلُّم' });
    S.addNote(d.id, { title: 'ملاحظة', content: 'مفاهيم الإنترنت' });
    assert.ok(S.searchAll('اكواد').some(r => r.type === 'domain'));
    assert.ok(S.searchAll('تعلم').some(r => r.type === 'domain'));
    assert.ok(S.searchAll('الانترنت').some(r => r.type === 'note'));
    assert.strictEqual(S.searchAll('ا').length, 0);
  });
  test('deleting a domain cleans related daily tasks', () => {
    const w = fresh(); const S = w.LearningStore;
    const d = S.saveDomain({ name: 'D' });
    S.addDailyTask({ domainId: d.id, title: 'x' });
    S.deleteDomain(d.id);
    assert.strictEqual(S.getData().dailyTasks.length, 0);
  });
}

console.log('\nLearning journal and weekly insights');
{
  const w = loadApp();
  const S = w.LearningStore;
  S.resetData(false);
  test('learning journal entries validate and persist', () => {
    const item = S.addLearningLog({ minutes: 45, summary: 'قرأت أساسيات المكامن', concentration: 'high' });
    assert.ok(item && item.minutes === 45);
    assert.strictEqual(S.getLearningLogs().length, 1);
    assert.strictEqual(S.getAnalytics().hoursTracked, 0.8);
    assert.strictEqual(S.addLearningLog({ minutes: 0 }), null);
  });
  test('weekly review aggregates journal, focus, and daily tasks', () => {
    const today = w.LearningUtils.localDate();
    S.addLearningLog({ minutes: 60, date: today });
    const review = S.getWeeklyReview(new Date());
    assert.ok(review.current.minutes >= 60);
    assert.ok(review.current.activeDays >= 1);
    assert.ok(review.start <= review.end);
  });
  test('learning streak counts consecutive activity days', () => {
    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    S.addLearningLog({ minutes: 20, date: w.LearningUtils.localDate(today) });
    S.addLearningLog({ minutes: 20, date: w.LearningUtils.localDate(yesterday) });
    assert.strictEqual(S.getLearningStreak(), 2);
  });
}

console.log('\nGemini assistant and generated plans');
{
  const loadWithGemini = () => {
    const w = loadApp();
    vm.runInContext(fs.readFileSync(path.join(__dirname, 'js/ai_assistant.js'), 'utf8'), w, { filename: 'js/ai_assistant.js' });
    return w;
  };
  test('Gemini key is stored separately from learning data exports', () => {
    const w = loadWithGemini();
    w.GeminiAssistant.saveKey('test-gemini-key-value');
    assert.strictEqual(w.GeminiAssistant.hasKey(), true);
    assert.ok(!w.LearningStore.exportJSON().includes('test-gemini-key-value'));
    w.GeminiAssistant.removeKey();
    assert.strictEqual(w.GeminiAssistant.hasKey(), false);
  });
  test('daily request counter increments locally', () => {
    const w = loadWithGemini();
    w.localStorage.setItem('my_learning_hub_gemini_usage_v1', JSON.stringify({ date: w.LearningUtils.localDate(), requests: 2 }));
    const before = w.GeminiAssistant.getUsage();
    assert.strictEqual(before.requests, 2);
    w.GeminiAssistant.saveKey('test-gemini-key-value');
    w.fetch = async (_url, options) => {
      assert.ok(options.headers['x-goog-api-key']);
      return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({
        domainName: 'تعلم البرمجة', description: 'خطة عملية', targetGoal: 'إنجاز تطبيق', currentLevel: 'مبتدئ', targetLevel: 'متوسط', targetDate: '',
        stages: [{ title: 'الأساسيات', description: 'فهم المفاهيم', tasks: [{ title: 'دراسة المتغيرات', description: 'حل تمارين', priority: 'medium', estimatedHours: 2, dueDate: '' }] }]
      }) }] } }] }) };
    };
    return w.GeminiAssistant.generatePlan({ goal: 'تعلم البرمجة', currentLevel: 'مبتدئ', targetLevel: 'متوسط', hoursPerWeek: 5, daysPerWeek: 5, targetDate: '', context: '' }).then(plan => {
      assert.strictEqual(plan.stages[0].tasks[0].estimatedHours, 2);
      assert.strictEqual(w.GeminiAssistant.getUsage().requests, 3);
    });
  });
  test('malformed generated plans are rejected before persistence', () => {
    const w = loadWithGemini();
    assert.throws(() => w.GeminiAssistant.validatePlan({ stages: [] }, { goal: 'هدف' }), /لا تحتوي على مهام/);
  });
  test('generated learning plan is persisted as a domain with stages and tasks', () => {
    const w = loadApp();
    w.LearningStore.resetData(false);
    const domain = w.LearningStore.addGeneratedPlan({
      domainName: 'خطة تجريبية', description: 'وصف', targetGoal: 'هدف', currentLevel: 'مبتدئ', targetLevel: 'متوسط', targetDate: '',
      stages: [{ title: 'مرحلة أولى', description: 'وصف المرحلة', tasks: [{ title: 'مهمة أولى', description: 'تفصيل', priority: 'high', estimatedHours: 3, dueDate: '' }] }]
    });
    assert.strictEqual(domain.name, 'خطة تجريبية');
    assert.strictEqual(domain.stages.length, 1);
    assert.strictEqual(domain.stages[0].tasks[0].title, 'مهمة أولى');
    assert.ok(!w.LearningStore.exportJSON().includes('gemini_api_key'));
  });
}

console.log('\nGemini request robustness');
{
  const mk = () => {
    const w = loadApp();
    vm.runInContext(fs.readFileSync(path.join(__dirname, 'js/ai_assistant.js'), 'utf8'), w, { filename: 'js/ai_assistant.js' });
    w.GeminiAssistant.saveKey('test-gemini-key-value');
    return w;
  };
  const plan = { domainName: 'د', description: 'و', targetGoal: 'ه', currentLevel: 'م', targetLevel: 'م', targetDate: '',
    stages: [{ title: 'س', description: 'و', tasks: [{ title: 'ت', description: 'و', priority: 'high', estimatedHours: 1, dueDate: '' }] }] };
  const ok = (text, extra = {}) => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text }] }, ...extra }] }) });
  const inputs = { goal: 'هدف', currentLevel: 'مبتدئ', targetLevel: '', hoursPerWeek: 5, daysPerWeek: 5, targetDate: '', context: '' };

  test('request uses documented REST fields (upper-case schema types, no responseFormat)', () => {
    const w = mk(); let body;
    w.fetch = async (url, opt) => { body = JSON.parse(opt.body); assert.ok(url.includes('/gemini-3.5-flash-lite:generateContent')); assert.ok(!url.includes('key=')); return ok(JSON.stringify(plan)); };
    return w.GeminiAssistant.generatePlan(inputs).then(() => {
      const g = body.generationConfig;
      assert.strictEqual(g.responseMimeType, 'application/json');
      assert.strictEqual(g.responseSchema.type, 'OBJECT');
      assert.strictEqual(g.responseSchema.properties.stages.items.type, 'OBJECT');
      assert.ok(!('responseFormat' in g));
      assert.ok(g.maxOutputTokens >= 8192);
    });
  });
  test('400 on schema falls back to simpler request', () => {
    const w = mk(); const bodies = [];
    w.fetch = async (_u, opt) => {
      const b = JSON.parse(opt.body); bodies.push(b);
      if (b.generationConfig.responseSchema) return { ok: false, status: 400, json: async () => ({ error: { message: 'Unknown field' } }) };
      return ok(JSON.stringify(plan));
    };
    return w.GeminiAssistant.generatePlan(inputs).then(p => {
      assert.strictEqual(bodies.length, 2);
      assert.strictEqual(p.stages.length, 1);
    });
  });
  test('JSON inside a code fence is parsed', () => {
    const w = mk();
    w.fetch = async () => ok('```json\n' + JSON.stringify(plan) + '\n```');
    return w.GeminiAssistant.generatePlan(inputs).then(p => assert.strictEqual(p.stages[0].tasks.length, 1));
  });
  test('thought parts are ignored and truncation is reported clearly', () => {
    const w = mk();
    w.fetch = async () => ({ ok: true, status: 200, json: async () => ({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ thought: true, text: 'thinking' }, { text: '{"domainName":"x","stages":[' }] } }] }) });
    return w.GeminiAssistant.generatePlan(inputs).then(() => { throw new Error('should reject'); }, e => assert.ok(/انقطع|اكتمال/.test(e.message)));
  });
  test('API errors show the real reason and 404 points to the model setting', () => {
    const w = mk();
    w.fetch = async () => ({ ok: false, status: 404, json: async () => ({ error: { message: 'models/x is not found' } }) });
    return w.GeminiAssistant.generatePlan(inputs).then(() => { throw new Error('should reject'); }, e => { assert.ok(/النموذج/.test(e.message)); assert.ok(e.message.includes('models/x is not found')); });
  });
  test('model can be changed and validated', () => {
    const w = mk();
    assert.strictEqual(w.GeminiAssistant.model, 'gemini-3.5-flash-lite');
    w.GeminiAssistant.saveModel('models/gemini-flash-latest');
    assert.strictEqual(w.GeminiAssistant.model, 'gemini-flash-latest');
    assert.throws(() => w.GeminiAssistant.saveModel('bad name/../x'));
    w.GeminiAssistant.saveModel('');
    assert.strictEqual(w.GeminiAssistant.model, 'gemini-3.5-flash-lite');
  });
}

console.log('\nCloud sync (Google Drive, mocked)');
{
  const CLIENT = '123456-abc123.apps.googleusercontent.com';
  function setup(opts = {}) {
    const w = loadApp(opts.storage);
    const session = makeStorage();
    w.sessionStorage = session;
    w.document = { addEventListener() {}, createElement() { return {}; }, head: { appendChild() {} }, visibilityState: 'visible' };
    w.window.addEventListener = () => {};
    // Fake Drive appDataFolder with one file.
    const drive = { file: null, calls: [] };
    const md5 = (s) => 'md5-' + w.LearningUtils.hashData({ s });
    w.fetch = async (url, init = {}) => {
      const u = new URL(url); drive.calls.push((init.method || 'GET') + ' ' + u.pathname);
      const auth = init.headers && init.headers.Authorization;
      if (!auth || drive.expired) return { ok: false, status: 401, json: async () => ({ error: { message: 'expired' } }) };
      const J = (o) => ({ ok: true, status: 200, json: async () => o, text: async () => (typeof o === 'string' ? o : JSON.stringify(o)) });
      if (u.pathname === '/drive/v3/files' && !init.method) return J({ files: drive.file ? [{ id: 'F1', md5Checksum: drive.file.md5, modifiedTime: 'x' }] : [] });
      if (u.pathname === '/drive/v3/files/F1' && u.searchParams.get('alt') === 'media') return J(drive.file.body);
      if (u.pathname === '/upload/drive/v3/files' && init.method === 'POST') {
        const body = init.body.split('\r\n').filter(l => l.startsWith('{') && l.includes('"domains"'))[0];
        drive.file = { body, md5: md5(body) }; return J({ id: 'F1', md5Checksum: drive.file.md5 });
      }
      if (u.pathname === '/upload/drive/v3/files/F1' && init.method === 'PATCH') { drive.file = { body: init.body, md5: md5(init.body) }; return J({ id: 'F1', md5Checksum: drive.file.md5 }); }
      return { ok: false, status: 404, json: async () => ({}) };
    };
    const token = () => session.setItem('my_learning_hub_sync_token_v1', JSON.stringify({ token: 't', expiresAt: Date.now() + 3600000 }));
    vm.runInContext(fs.readFileSync(path.join(__dirname, 'js/cloud_sync.js'), 'utf8'), w, { filename: 'js/cloud_sync.js' });
    w.CloudSync.attach(w.LearningStore);
    w.CloudSync.setClientId(CLIENT);
    token();
    return { w, drive, token, S: w.LearningStore, C: w.CloudSync };
  }
  const touch = (S, name) => S.saveDomain({ name });
  const remoteDomain = (id, name) => ({ id, name });

  test('client id validation', () => {
    const { C } = setup();
    assert.throws(() => C.setClientId('nope'));
    assert.throws(() => C.setClientId('javascript:alert(1)'));
  });
  test('first sync uploads; unchanged afterwards; local edit uploads again', async () => {
    const { S, C, drive } = setup();
    touch(S, 'محلي');
    assert.strictEqual(await C.syncNow(), 'uploaded');
    assert.ok(drive.file.body.includes('محلي'));
    assert.strictEqual(await C.syncNow(), 'unchanged');
    touch(S, 'ثاني');
    assert.strictEqual(await C.syncNow(), 'uploaded');
    assert.ok(drive.file.body.includes('ثاني'));
  });
  test('remote change is downloaded and applied locally', async () => {
    const { w, S, C, drive } = setup();
    touch(S, 'محلي'); await C.syncNow();
    const other = JSON.parse(drive.file.body); other.domains.push(remoteDomain('dx', 'من جهاز آخر'));
    drive.file = { body: JSON.stringify(other), md5: 'md5-changed' };
    assert.strictEqual(await C.syncNow(), 'downloaded');
    assert.ok(S.getDomains().some(d => d.name === 'من جهاز آخر'));
    assert.ok(w.localStorage.getItem('my_learning_journey_data_v1_presync'));
    assert.strictEqual(await C.syncNow(), 'unchanged');
  });
  test('new device with untouched sample data adopts the cloud copy silently', async () => {
    const a = setup(); touch(a.S, 'بياناتي الحقيقية'); await a.C.syncNow();
    const b = setup(); b.drive.file = a.drive.file;
    assert.strictEqual(b.S.isTouched(), false);
    assert.strictEqual(await b.C.syncNow(), 'downloaded');
    assert.ok(b.S.getDomains().some(d => d.name === 'بياناتي الحقيقية'));
  });
  test('both sides changed -> conflict; merge keeps both and uploads', async () => {
    const { S, C, drive } = setup();
    touch(S, 'أ'); await C.syncNow();
    const other = JSON.parse(drive.file.body); other.domains.push(remoteDomain('dr', 'من السحابة'));
    drive.file = { body: JSON.stringify(other), md5: 'md5-other' };
    touch(S, 'ب');
    assert.strictEqual(await C.syncNow(), 'conflict');
    assert.strictEqual(C.getState().status, 'conflict');
    await C.resolveConflict('merge');
    const names = S.getDomains().map(d => d.name);
    assert.ok(names.includes('أ') && names.includes('ب') && names.includes('من السحابة'));
    assert.ok(drive.file.body.includes('من السحابة') && drive.file.body.includes('ب'));
    assert.strictEqual(C.getState().status, 'idle');
  });
  test('conflict: choose cloud replaces local; choose local overwrites cloud', async () => {
    let { S, C, drive } = setup();
    touch(S, 'أ'); await C.syncNow();
    let other = JSON.parse(drive.file.body); other.domains = [remoteDomain('dr', 'سحابة فقط')];
    drive.file = { body: JSON.stringify(other), md5: 'md5-o1' }; touch(S, 'ب');
    await C.syncNow(); await C.resolveConflict('cloud');
    assert.strictEqual(JSON.stringify(S.getDomains().map(d => d.name)), JSON.stringify(['سحابة فقط']));
    touch(S, 'ج');
    other = JSON.parse(drive.file.body); other.domains.push(remoteDomain('d9', 'آخر'));
    drive.file = { body: JSON.stringify(other), md5: 'md5-o2' };
    await C.syncNow(); await C.resolveConflict('local');
    assert.ok(drive.file.body.includes('ج') && !drive.file.body.includes('آخر'));
  });
  test('expired token -> needs-auth and nothing is changed', async () => {
    const { S, C, drive } = setup();
    touch(S, 'أ'); await C.syncNow();
    drive.expired = true; touch(S, 'ب');
    await C.syncNow().catch(() => {});
    assert.strictEqual(C.getState().status, 'needs-auth');
    assert.ok(S.getDomains().some(d => d.name === 'ب'));
  });
  test('corrupt cloud file is rejected without touching local data', async () => {
    const { S, C, drive } = setup();
    touch(S, 'أ'); await C.syncNow();
    drive.file = { body: '{not json', md5: 'md5-bad' };
    const before = JSON.stringify(S.getData().domains);
    await C.syncNow().catch(() => {});
    assert.strictEqual(C.getState().status, 'error');
    assert.strictEqual(JSON.stringify(S.getData().domains), before);
  });
  test('malicious cloud data is sanitised on download', async () => {
    const { S, C, drive } = setup();
    touch(S, 'أ'); await C.syncNow();
    const other = JSON.parse(drive.file.body);
    other.domains = [{ id: 'x"><img onerror=1>', name: 'n', color: 'red;x', resources: [{ id: 'r', title: 't', url: 'javascript:1' }] }];
    drive.file = { body: JSON.stringify(other), md5: 'md5-evil' };
    await C.syncNow();
    const d = S.getDomains()[0];
    assert.ok(/^[A-Za-z0-9_.-]+$/.test(d.id));
    assert.strictEqual(d.resources[0].url, '');
  });
  test('gemini key and timer state are never part of synced data', async () => {
    const { w, S, C, drive } = setup();
    w.localStorage.setItem('my_learning_hub_gemini_key_v1', 'SECRET-KEY-123');
    touch(S, 'أ'); await C.syncNow();
    assert.ok(!drive.file.body.includes('SECRET-KEY-123'));
    assert.ok(!JSON.stringify(w.localStorage._map.get('my_learning_hub_sync_v1')).includes('SECRET'));
  });
  test('mergeData: union by id, newer domain wins, tasks unioned, nothing lost', () => {
    const w = loadApp(); const U = w.LearningUtils;
    const mk = (domains) => U.sanitizeData({ domains });
    const local = mk([{ id: 'd1', name: 'محلي', updatedAt: '2026-01-01T00:00:00Z', stages: [{ id: 's1', title: 'S', tasks: [{ id: 't1', title: 'a' }] }] }, { id: 'd2', name: 'فقط محلي' }]);
    const remote = mk([{ id: 'd1', name: 'سحابي أحدث', updatedAt: '2026-02-01T00:00:00Z', stages: [{ id: 's1', title: 'S', tasks: [{ id: 't2', title: 'b' }] }] }, { id: 'd3', name: 'فقط سحابي' }]);
    const m = U.mergeData(local, remote);
    assert.strictEqual(m.domains.map(d => d.id).join(), 'd1,d2,d3');
    assert.strictEqual(m.domains[0].name, 'سحابي أحدث');
    assert.strictEqual(m.domains[0].stages[0].tasks.map(t => t.id).sort().join(), 't1,t2');
  });
  test('hashData ignores lastUpdated but detects changes', () => {
    const w = loadApp(); const U = w.LearningUtils;
    const a = U.defaultData(); const b = { ...a, lastUpdated: 'other' };
    assert.strictEqual(U.hashData(a), U.hashData(b));
    b.settings = { ...b.settings, userName: 'x' };
    assert.notStrictEqual(U.hashData(a), U.hashData(b));
  });
}

Promise.all(pendingTests).then(() => {
  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log('Failed: ' + failures.join(', '));
    process.exitCode = 1;
  }
});
