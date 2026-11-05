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
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failures.push(name); console.log('  ✗ ' + name + '\n      ' + (e && e.message)); }
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

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) { console.log('Failed: ' + failures.join(', ')); process.exit(1); }
