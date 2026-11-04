// اختبار واجهة حقيقي في Chromium (Playwright): node tests/e2e.test.js
// يستخدم file:// ويعترض طلبات الخطوط وAPI ببيانات وهمية (النص الوهمي للاختبار فقط وليس نصًا قرآنيًا).
'use strict';
const assert = require('assert');
const path = require('path');
const { chromium } = require('playwright');

const URL = 'file://' + path.join(__dirname, '..', 'index.html');
const results = [];
async function check(name, fn) {
  if (process.env.ONLY && !name.includes(process.env.ONLY)) return;
  try { await fn(); results.push([true, name]); console.log('  ✓', name); }
  catch (e) { results.push([false, name]); console.log('  ✗', name, '\n     ', process.env.VERBOSE ? e.stack.split('\n').slice(0, 6).join('\n      ') : e.message.split('\n')[0]); }
}

const AYAH_COUNTS = { 1: 7, 2: 286, 112: 4 };
function surahBody(n) {
  return JSON.stringify({
    code: 200,
    data: {
      number: n, edition: { identifier: 'quran-uthmani' },
      ayahs: Array.from({ length: AYAH_COUNTS[n] }, (_, i) => ({ numberInSurah: i + 1, text: `كلمة${n}_${i + 1} تجريبية` }))
    }
  });
}

async function newPage(browser, { storage, api = 'ok', tafsir = 'ok', viewport, touch } = {}) {
  const ctx = await browser.newContext({ viewport: viewport || { width: 390, height: 800 }, timezoneId: 'Africa/Khartoum', locale: 'ar', hasTouch: !!touch, isMobile: !!touch });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errors.push(m.text()); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const hits = { n: 0, t: 0, tUrls: [] };
  // ردود التفسير وهمية لاختبار السلوك فقط (ليست تفسيرًا حقيقيًا)
  await page.route(/cdn\.jsdelivr\.net/, async (r) => {
    hits.t++; hits.tUrls.push(r.request().url());
    const mode = hits.mode || tafsir;
    if (mode === 'fail') return r.abort();
    if (mode === 'bad') return r.fulfill({ status: 200, contentType: 'application/json', body: '{"surah":999,"ayah":1,"text":"x"}' });
    if (mode === 'missing') return r.fulfill({ status: 404, body: 'nf' });
    if (mode === 'slow') await new Promise((res) => setTimeout(res, 700));
    const m = /tafsir\/([^/]+)\/(\d+)\/(\d+)\.json/.exec(r.request().url());
    return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ surah: +m[2], ayah: +m[3], text: mode === 'long' ? `[${m[1]}] ` + 'كلمات طويلة جدا لاختبار التفسير الطويل '.repeat(120) : `[${m[1]}] تفسير تجريبي ${m[2]}:${m[3]}` }) });
  });
  await page.route(/api\.alquran\.cloud/, async (r) => {
    hits.n++;
    if (api === 'fail') return r.abort();
    if (api === 'bad') return r.fulfill({ status: 200, contentType: 'application/json', body: '{"code":200,"data":{"number":1,"ayahs":[]}}' });
    if (api === 'slow') await new Promise((res) => setTimeout(res, 600));
    const n = Number(/surah\/(\d+)\//.exec(r.request().url())[1]);
    return r.fulfill({ status: 200, contentType: 'application/json', body: surahBody(n) });
  });
  if (storage) await page.addInitScript((s) => {
    if (!localStorage.getItem('__seeded')) { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); localStorage.setItem('__seeded', '1'); }
  }, storage);
  await page.goto(URL);
  return { page, ctx, errors, hits };
}

async function openReview(page, surah, from, to) {
  await addEntry(page, surah, from, to);
  await page.waitForSelector('.entry-main, #masteredFolderBtn');
  await openMastered(page);   // سورة مكتملة (مثل الإخلاص 1-4) تكون داخل مجلد المتقنة
  await page.click('.entry-main');
  await page.waitForSelector('.ayah-text');
}
const holdMs = 650;
async function pointOn(page, selector) {
  const loc = page.locator(selector).first();
  await loc.waitFor();
  return loc.evaluate((n) => { const r = n.getClientRects()[0]; return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
}
async function holdOn(page, selector, ms = holdMs) {
  const { x, y } = await pointOn(page, selector);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  return { x, y };
}

// يفتح مجلد «المتقنة» إن وُجد ومطويًا (المقاطع المتقنة تُطوى في القائمة الرئيسية)
async function openMastered(page) {
  await page.waitForSelector('#view-list.active', { state: 'attached' });
  const btn = page.locator('#masteredFolderBtn');
  if (await btn.count() && (await btn.getAttribute('aria-expanded')) === 'false') await btn.click();
}

async function addEntry(page, surah, from, to) {
  await page.click('nav.bottom button[data-tab="add"]');
  await page.selectOption('#surahSelect', String(surah));
  await page.fill('#fromAyah', String(from));
  await page.fill('#toAyah', String(to));
  await page.click('#saveEntryBtn');
}

(async () => {
  const browser = await chromium.launch();

  await check('التحميل بلا أخطاء + حالة فارغة + لا تعطيل للتكبير', async () => {
    const { page, errors, ctx } = await newPage(browser);
    assert.ok(await page.locator('#listContent .empty-state').isVisible());
    const vp = await page.getAttribute('meta[name=viewport]', 'content');
    assert.ok(!/user-scalable=no|maximum-scale/.test(vp));
    assert.deepStrictEqual(errors, []);
    await ctx.close();
  });

  await check('إضافة مقطع ثم ظهوره في القائمة والإحصاء', async () => {
    const { page, errors, ctx } = await newPage(browser);
    await addEntry(page, 1, 1, 7);
    await page.waitForSelector('.entry-card');          // الفاتحة مكتملة لكنها غير متقنة: تبقى ظاهرة
    assert.strictEqual(await page.locator('#masteredFolderBtn').count(), 0);
    assert.ok((await page.textContent('#listStatsStrip')).includes('7'));
    assert.ok((await page.textContent('.surah-group-head .progress')).includes('كاملة'));
    const saved = JSON.parse(await page.evaluate(() => localStorage.getItem('quran_hifz_entries_v1')));
    assert.strictEqual(saved.length, 1);
    assert.deepStrictEqual(errors, []);
    await ctx.close();
  });

  await check('رفض نطاق معكوس ورقم يتجاوز عدد الآيات', async () => {
    const { page, ctx } = await newPage(browser);
    await addEntry(page, 1, 5, 3);
    assert.ok(await page.locator('#addError.show').isVisible());
    await page.fill('#fromAyah', '1'); await page.fill('#toAyah', '99');
    await page.click('#saveEntryBtn');
    assert.ok((await page.textContent('#addError')).includes('7'));
    assert.strictEqual(await page.locator('.entry-card').count(), 0);
    await ctx.close();
  });

  await check('تداخل: نافذة بخيارات، الإلغاء لا يضيف، الدمج يوحّد دون تكرار العدّ', async () => {
    const { page, ctx } = await newPage(browser);
    await addEntry(page, 2, 1, 10);
    await page.waitForSelector('.entry-card');
    await addEntry(page, 2, 8, 20);
    await page.waitForSelector('#choiceModal.active');
    const msg = await page.textContent('#choiceMsg');
    assert.ok(msg.includes('الموجود') && msg.includes('الجديد'));
    await page.keyboard.press('Escape');
    assert.ok(!(await page.locator('#choiceModal.active').count()));
    assert.strictEqual(JSON.parse(await page.evaluate(() => localStorage.getItem('quran_hifz_entries_v1'))).length, 1);
    await page.click('#saveEntryBtn');
    await page.click('#choiceActions button:has-text("دمج")');
    await page.waitForSelector('.entry-card');
    const saved = JSON.parse(await page.evaluate(() => localStorage.getItem('quran_hifz_entries_v1')));
    assert.strictEqual(saved.length, 1);
    assert.strictEqual(saved[0].to, 20);
    assert.ok((await page.textContent('#listStatsStrip')).includes('20'));
    await ctx.close();
  });

  await check('المراجعة: عرض النص من API الوهمي وتخزينه للاستخدام دون اتصال', async () => {
    const { page, ctx, hits } = await newPage(browser);
    await addEntry(page, 112, 1, 4);
    await openMastered(page); await page.click('.entry-main');
    await page.waitForSelector('.ayah-text');
    assert.strictEqual(await page.locator('.ayah-text').count(), 4);
    assert.ok((await page.textContent('.ayah-flow')).includes('كلمة112_1'));
    assert.strictEqual(hits.n, 1);
    await page.click('#reviewCloseBtn');
    assert.strictEqual(await page.locator('#reviewBody *').count(), 0); // لا نص متبقٍ في DOM
    await openMastered(page); await page.click('.entry-main'); // الثانية من الذاكرة
    await page.waitForSelector('.ayah-text');
    assert.strictEqual(hits.n, 1);
    await ctx.close();
  });

  await check('وضع الاختبار: النص يُموَّه بنفس الحجم (لا نجوم) ويُظهر بالنقر وبلوحة المفاتيح', async () => {
    const { page, ctx } = await newPage(browser);
    await addEntry(page, 112, 1, 4);
    await openMastered(page); await page.click('.entry-main');
    await page.waitForSelector('.ayah-text');
    const before = await page.$$eval('.ayah-text', (n) => n.map((x) => Math.round(x.getBoundingClientRect().width)));
    await page.click('#toggleHideBtn');
    const flow = await page.textContent('.ayah-flow');
    assert.ok(flow.includes('كلمة112_1') && !flow.includes('•'), 'النص يبقى (مموّهًا) بلا نجوم');
    assert.strictEqual(await page.locator('.ayah-text.is-hidden').count(), 4);
    assert.ok((await page.$eval('.ayah-text', (n) => getComputedStyle(n).filter)).includes('blur'));
    const after = await page.$$eval('.ayah-text', (n) => n.map((x) => Math.round(x.getBoundingClientRect().width)));
    assert.deepStrictEqual(after, before, 'حجم الآية لا يتغير بالتمويه');
    await page.focus('.ayah-text >> nth=0');
    await page.keyboard.press('Enter');
    assert.strictEqual(await page.locator('.ayah-text.is-hidden').count(), 3);
    await page.waitForTimeout(300); // انتهاء انتقال التمويه
    assert.strictEqual(await page.$eval('.ayah-text', (n) => getComputedStyle(n).filter), 'none');
    assert.strictEqual(await page.textContent('#toggleHideBtn'), 'إظهار كل النص');
    await page.click('#toggleHideBtn'); // يظهر الباقي
    assert.strictEqual(await page.locator('.ayah-text.is-hidden').count(), 0);
    await ctx.close();
  });

  await check('تمت المراجعة: لوحة تقييم، نقر مزدوج = تسجيل واحد + سجل بتقييم وملاحظة + تاريخ محلي', async () => {
    const { page, ctx } = await newPage(browser);
    await addEntry(page, 112, 1, 4);
    await openMastered(page); await page.click('.entry-main');
    await page.waitForSelector('.ayah-text');
    await page.click('#markReviewedBtn');
    assert.ok(await page.locator('#ratePanel').isVisible());
    assert.strictEqual(JSON.parse(await page.evaluate(() => localStorage.getItem('quran_hifz_entries_v1')))[0].reviewCount, 0); // لم يُسجَّل بعد
    await page.fill('#rateNote', 'نسيت الآية الثالثة');
    await page.dblclick('#ratePanel [data-rating="soon"]');
    await page.waitForTimeout(100);
    const entries = JSON.parse(await page.evaluate(() => localStorage.getItem('quran_hifz_entries_v1')));
    const log = JSON.parse(await page.evaluate(() => localStorage.getItem('sahib_review_log_v1')));
    assert.strictEqual(entries[0].reviewCount, 1);
    assert.strictEqual(entries[0].lastRating, 'soon');
    assert.strictEqual(log.length, 1);
    assert.strictEqual(log[0].status, 'completed');
    assert.strictEqual(log[0].rating, 'soon');
    assert.strictEqual(log[0].note, 'نسيت الآية الثالثة');
    const today = await page.evaluate(() => Sahib.Utils.toLocalDateStr());
    assert.strictEqual(entries[0].lastReviewed, today);
    assert.ok(await page.locator('#ratePanel').isHidden());
    await page.waitForTimeout(1500); // بعد فترة التهدئة يمكن مراجعة مستقلة ثانية
    await page.click('#markReviewedBtn');
    await page.click('#rateSkipBtn');
    await page.waitForTimeout(100);
    const e2 = JSON.parse(await page.evaluate(() => localStorage.getItem('quran_hifz_entries_v1')))[0];
    assert.strictEqual(e2.reviewCount, 2);
    assert.strictEqual(e2.lastRating, 'soon'); // الحفظ دون تقييم لا يمسح التقييم السابق
    await ctx.close();
  });

  await check('لوحة التقييم: «رجوع» وEsc لا يسجّلان شيئًا', async () => {
    const { page, ctx } = await newPage(browser);
    await openReview(page, 112, 1, 4);
    await page.click('#markReviewedBtn');
    await page.click('#rateCancelBtn');
    await page.click('#markReviewedBtn');
    await page.keyboard.press('Escape');
    assert.ok(await page.locator('#ratePanel').isHidden());
    assert.ok(await page.locator('#reviewOverlay.active').count()); // Esc أغلق اللوحة فقط
    assert.strictEqual(await page.evaluate(() => localStorage.getItem('sahib_review_log_v1')), null);
    await ctx.close();
  });

  await check('فشل الشبكة: رسالة خطأ، الزر معطّل، لا تسجيل مراجعة، وزر إعادة المحاولة ظاهر', async () => {
    const { page, ctx } = await newPage(browser, { api: 'fail' });
    await addEntry(page, 112, 1, 4);
    await openMastered(page); await page.click('.entry-main');
    await page.waitForSelector('.review-error');
    assert.ok(await page.locator('#markReviewedBtn').isDisabled());
    await page.evaluate(() => Sahib.Review.markReviewed());
    assert.strictEqual(JSON.parse(await page.evaluate(() => localStorage.getItem('quran_hifz_entries_v1')))[0].reviewCount, 0);
    assert.strictEqual(await page.evaluate(() => localStorage.getItem('sahib_review_log_v1')), null);
    assert.ok(await page.locator('.retry-btn').isVisible());
    await ctx.close();
  });

  await check('ردّ API غير صالح: لا يُعرض نص ولا يُخزَّن', async () => {
    const { page, ctx } = await newPage(browser, { api: 'bad' });
    await addEntry(page, 1, 1, 7);
    await openMastered(page); await page.click('.entry-main');
    await page.waitForSelector('.review-error');
    assert.strictEqual(await page.locator('.ayah-text').count(), 0);
    assert.strictEqual(await page.evaluate(() => localStorage.getItem('quran_text_cache_v1')), null);
    await ctx.close();
  });

  await check('طلب قديم يصل بعد الإغلاق لا يعرض شيئًا', async () => {
    const { page, ctx } = await newPage(browser, { api: 'slow' });
    await addEntry(page, 112, 1, 4);
    await openMastered(page); await page.click('.entry-main');
    await page.click('#reviewCloseBtn');
    await page.waitForTimeout(900);
    assert.strictEqual(await page.locator('.ayah-text').count(), 0);
    assert.ok(!(await page.locator('#reviewOverlay.active').count()));
    await ctx.close();
  });

  await check('ترحيل: بيانات النسخة القديمة (v1) تظهر كما هي دون فقد', async () => {
    const old = [
      { id: 'e1', surah: 112, surahName: 'x', from: 1, to: 4, dateAdded: '2026-10-01', lastReviewed: '2026-10-28', reviewCount: 3 },
      { id: 'e2', surah: 1, surahName: 'y', from: 1, to: 3, dateAdded: '2026-10-02', lastReviewed: null, reviewCount: 0 }
    ];
    const { page, ctx, errors } = await newPage(browser, { storage: { quran_hifz_entries_v1: JSON.stringify(old) } });
    assert.strictEqual(await page.locator('.entry-card').count(), 2);      // الإخلاص مكتملة لكنها غير متقنة: ظاهرة
    const kept = JSON.parse(await page.evaluate(() => localStorage.getItem('quran_hifz_entries_v1')));
    assert.strictEqual(kept.length, 2);
    assert.deepStrictEqual(errors, []);
    await ctx.close();
  });

  await check('تخزين تالف: لافتة تحذير، الأصل لم يُمس، ومحاولة الحفظ تفشل برسالة', async () => {
    const { page, ctx } = await newPage(browser, { storage: { quran_hifz_entries_v1: '{{broken' } });
    assert.ok(await page.locator('#storageBanner').isVisible());
    assert.strictEqual(await page.evaluate(() => localStorage.getItem('quran_hifz_entries_v1')), '{{broken');
    await addEntry(page, 1, 1, 3);
    assert.ok((await page.textContent('#addError')).includes('تالفة'));
    assert.strictEqual(await page.evaluate(() => localStorage.getItem('quran_hifz_entries_v1')), '{{broken');
    await ctx.close();
  });

  await check('الحذف: يطلب تأكيدًا، الإلغاء يُبقي المقطع، والتأكيد يحذفه', async () => {
    const { page, ctx } = await newPage(browser);
    await addEntry(page, 1, 1, 7);
    await openMastered(page);
    await page.waitForSelector('.entry-card');
    await page.click('.entry-del');
    await page.click('#choiceActions button:has-text("إلغاء")');
    assert.strictEqual(await page.locator('.entry-card').count(), 1);
    await page.click('.entry-del');
    await page.click('#choiceActions button:has-text("حذف")');
    await page.waitForSelector('.empty-state');
    await ctx.close();
  });

  await check('الوضع الليلي يُحفظ ويُستعاد عند إعادة التحميل', async () => {
    const { page, ctx } = await newPage(browser);
    await page.click('#themeToggleBtn');
    assert.ok(await page.evaluate(() => document.body.classList.contains('dark-theme')));
    await page.reload();
    assert.ok(await page.evaluate(() => document.body.classList.contains('dark-theme')));
    await ctx.close();
  });

  await check('XSS: بيانات مخزّنة بعناصر HTML لا تُنفَّذ', async () => {
    const evil = [{ id: '<img src=x onerror=window.__pwn=1>', surah: 1, surahName: '<img src=x onerror=window.__pwn=1>', from: 1, to: 3, dateAdded: '2026-10-01', lastReviewed: null, reviewCount: 0 }];
    const { page, ctx } = await newPage(browser, { storage: { quran_hifz_entries_v1: JSON.stringify(evil) } });
    await page.waitForTimeout(200);
    assert.strictEqual(await page.evaluate(() => window.__pwn), undefined);
    assert.strictEqual(await page.locator('.entry-card img').count(), 0);
    await ctx.close();
  });

  await check('التجاوب: لا تمرير أفقي على 320px و768px و1280px', async () => {
    for (const w of [320, 768, 1280]) {
      const { page, ctx } = await newPage(browser, { viewport: { width: w, height: 700 } });
      await addEntry(page, 2, 1, 286);
      await openMastered(page);
      await page.waitForSelector('.entry-card');
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(over <= 0, `overflow ${over}px at ${w}`);
      await ctx.close();
    }
  });

  await check('الإحصائيات: صفحة الإحصاء تعرض آيات فريدة ومقاطع منفصلة', async () => {
    const old = [
      { id: 'a', surah: 2, surahName: 'x', from: 1, to: 10, dateAdded: '2026-10-01', lastReviewed: null, reviewCount: 0 },
      { id: 'b', surah: 2, surahName: 'x', from: 5, to: 12, dateAdded: '2026-10-01', lastReviewed: null, reviewCount: 0 }
    ];
    const { page, ctx } = await newPage(browser, { storage: { quran_hifz_entries_v1: JSON.stringify(old) } });
    await page.click('nav.bottom button[data-tab="stats"]');
    const t = await page.textContent('#statsContent');
    assert.ok(t.includes('12') && t.includes('مقطع مسجَّل'));
    await ctx.close();
  });


  // ===================== التفسير =====================
  const popText = (page) => page.textContent('#tafsirPop');
  const popVisible = (page) => page.locator('#tafsirPop').isVisible();

  await check('التفسير: اختيار الميسر ثم السعدي، الضغط المطول يعرض تفسير الآية الصحيحة وتبقى ثابتة بعد الرفع وتُغلق بالنقر خارجها', async () => {
    const { page, ctx, hits, errors } = await newPage(browser);
    await openReview(page, 112, 1, 4);
    assert.strictEqual(await page.getAttribute('[data-tafsir="muyassar"]', 'aria-pressed'), 'true');
    assert.ok((await page.textContent('#tafsirActiveLabel')).includes('التفسير الميسر'));
    await holdOn(page, '.ayah-text[data-ayah="2"]');
    assert.ok(await popVisible(page));
    let t = await popText(page);
    assert.ok(t.includes('التفسير الميسر') && t.includes('الآية 2') && t.includes('[ar-tafsir-muyassar] تفسير تجريبي 112:2'), t);
    assert.ok(hits.tUrls.at(-1).includes('/ar-tafsir-muyassar/112/2.json'));
    assert.ok(await page.locator('.ayah-text[data-ayah="2"].is-pressed').count());
    assert.strictEqual(await page.locator('.ayah-text.is-pressed').count(), 1); // لا خلط مع الجيران
    await page.mouse.up();
    await page.waitForTimeout(500);
    assert.ok(await popVisible(page));                                   // تبقى بعد رفع الإصبع
    assert.ok(!(await page.locator('.ayah-text.is-hidden').count())); // الرفع لم يبدّل وضع الاختبار
    await page.click('#reviewTitle');                                    // نقرة خارج النافذة
    assert.ok(!(await popVisible(page)));
    assert.strictEqual(await page.locator('.ayah-text.is-pressed').count(), 0);
    await page.click('[data-tafsir="saadi"]');
    assert.strictEqual(await page.getAttribute('[data-tafsir="saadi"]', 'aria-pressed'), 'true');
    await holdOn(page, '.ayah-text[data-ayah="2"]');
    t = await popText(page);
    assert.ok(t.includes('تفسير السعدي') && !t.includes('التفسير الميسر'), t);
    assert.ok(t.includes('تفسير تجريبي 112:2'));
    await page.mouse.up();
    await page.click('#tafsirPop .tafsir-close'); // زر ✕
    assert.ok(!(await popVisible(page)));
    assert.strictEqual(await page.locator('#tafsirPop').count(), 1);
    assert.deepStrictEqual(errors, []);
    await ctx.close();
  });

  await check('التفسير: الاختيار يُحفظ بعد إعادة التحميل ويستمر عند الانتقال إلى سورة أخرى', async () => {
    const { page, ctx, hits } = await newPage(browser);
    await openReview(page, 112, 1, 4);
    await page.click('[data-tafsir="saadi"]');
    await page.click('#reviewCloseBtn');
    await page.reload();
    await addEntry(page, 1, 1, 7);
    await page.waitForSelector('.entry-main, #masteredFolderBtn'); await openMastered(page);
    await page.click('.surah-group:first-child .entry-main');
    await page.waitForSelector('.ayah-text');
    assert.strictEqual(await page.getAttribute('[data-tafsir="saadi"]', 'aria-pressed'), 'true');
    await holdOn(page, '.ayah-text[data-ayah="5"]');
    const t = await popText(page);
    assert.ok(t.includes('تفسير السعدي') && t.includes('1:5') && !t.includes('112:'), t);
    assert.ok(hits.tUrls.at(-1).endsWith('/1/5.json'));
    await ctx.close();
  });

  await check('الضغط المطول: نقرة سريعة لا تعرض تفسيرًا ولا تطلبه، والحركة قبل المهلة تلغيه', async () => {
    const { page, ctx, hits } = await newPage(browser);
    await openReview(page, 112, 1, 4);
    await page.click('.ayah-text[data-ayah="1"]');          // نقرة سريعة
    await page.waitForTimeout(700);
    assert.ok(!(await popVisible(page)));
    assert.strictEqual(hits.t, 0);
    assert.strictEqual(await page.locator('.ayah-text.is-hidden').count(), 1); // النقرة تبدّل وضع الاختبار كما كان
    const box = await page.locator('.ayah-text[data-ayah="3"]').boundingBox();
    await page.mouse.move(box.x + 5, box.y + 5);
    await page.mouse.down();
    await page.waitForTimeout(200);
    await page.mouse.move(box.x + 60, box.y + 40, { steps: 4 }); // سحب > 10px
    await page.waitForTimeout(600);
    assert.ok(!(await popVisible(page)));
    assert.strictEqual(hits.t, 0);
    await page.mouse.up();
    await ctx.close();
  });

  await check('الضغط المطول: التمرير أثناء الضغط لا يفتح التفسير، والتنقل السريع بين الآيات يعرض الصحيح فقط', async () => {
    const { page, ctx, hits } = await newPage(browser);
    await openReview(page, 2, 1, 80);
    const box = await page.locator('.ayah-text[data-ayah="1"]').boundingBox();
    await page.mouse.move(box.x + 5, box.y + 5);
    await page.mouse.down();
    await page.waitForTimeout(150);
    await page.mouse.wheel(0, 400);   // تمرير
    await page.waitForTimeout(700);
    assert.ok(!(await popVisible(page)));
    assert.strictEqual(hits.t, 0);
    await page.mouse.up();
    // تنقل سريع: ضغطات قصيرة متتالية على آيات مختلفة
    for (const a of [2, 3, 4]) {
      const b = await page.locator(`.ayah-text[data-ayah="${a}"]`).boundingBox();
      if (b && b.y > 0 && b.y < 700) { await page.mouse.move(b.x + 3, b.y + 3); await page.mouse.down(); await page.waitForTimeout(80); await page.mouse.up(); }
    }
    assert.ok(!(await popVisible(page)));
    await ctx.close();
  });

  await check('التفسير: الرفع قبل وصول الردّ يُبقي النافذة وتُعرض الإجابة عند وصولها، والإغلاق قبل الوصول لا يعرضها', async () => {
    const { page, ctx, hits } = await newPage(browser, { tafsir: 'slow' });
    await openReview(page, 112, 1, 4);
    await holdOn(page, '.ayah-text[data-ayah="1"]', 600);
    assert.ok(await popVisible(page));
    assert.ok((await popText(page)).includes('جارٍ تحميل التفسير'));
    await page.mouse.up();
    assert.ok(await popVisible(page));
    await page.waitForFunction(() => document.getElementById('tafsirPop').textContent.includes('112:1'));
    assert.strictEqual(hits.t, 1);
    await page.click('#reviewTitle');
    assert.ok(!(await popVisible(page)));
    await holdOn(page, '.ayah-text[data-ayah="1"]', 560);
    assert.ok((await popText(page)).includes('112:1')); // من الذاكرة دون طلب جديد
    assert.strictEqual(hits.t, 1);
    await page.mouse.up();
    await page.click('#reviewTitle');
    // إغلاق قبل وصول الردّ: لا يظهر لاحقًا
    await holdOn(page, '.ayah-text[data-ayah="3"]', 600);
    await page.mouse.up();
    await page.click('#tafsirPop .tafsir-close');
    await page.waitForTimeout(1000);
    assert.ok(!(await popVisible(page)));
    await ctx.close();
  });

  await check('التفسير: ردّ آية قديمة لا يظهر بعد الانتقال لآية أخرى', async () => {
    const { page, ctx, hits } = await newPage(browser, { tafsir: 'slow' });
    await openReview(page, 112, 1, 4);
    await holdOn(page, '.ayah-text[data-ayah="1"]', 600);
    await page.mouse.up();
    await page.click('#reviewTitle');
    await holdOn(page, '.ayah-text[data-ayah="2"]', 1500); // ردّ الآية 1 يصل أثناء عرض الآية 2، وردّ الآية 2 يصل بعده
    const t = await popText(page);
    assert.ok(t.includes('الآية 2'), t);
    assert.ok(!t.includes('112:1'), t);
    assert.ok(t.includes('112:2'), t);
    await page.mouse.up();
    await ctx.close();
  });

  await check('التفسير: تغيير الاختيار أثناء طلب نشط يخفي العرض ولا يعرض ردّ التفسير السابق', async () => {
    const { page, ctx } = await newPage(browser, { tafsir: 'slow' });
    await openReview(page, 112, 1, 4);
    await page.click('.ayah-num[data-ayah="2"]'); // تثبيت (بديل لوحة المفاتيح)
    assert.ok(await popVisible(page));
    await page.click('[data-tafsir="saadi"]');
    assert.ok(!(await popVisible(page)));
    await page.waitForTimeout(1000);
    assert.ok(!(await popVisible(page)));
    await ctx.close();
  });

  await check('بديل لوحة المفاتيح: زر رقم الآية يثبّت التفسير، Esc يغلقه دون إغلاق المراجعة', async () => {
    const { page, ctx } = await newPage(browser);
    await openReview(page, 112, 1, 4);
    await page.focus('.ayah-num[data-ayah="3"]');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.getElementById('tafsirPop').textContent.includes('112:3'));
    assert.ok((await popText(page)).includes('الآية 3'));
    await page.keyboard.press('Escape');
    assert.ok(!(await popVisible(page)));
    assert.ok(await page.locator('#reviewOverlay.active').count());
    await page.click('.ayah-num[data-ayah="4"]');
    await page.click('.ayah-num[data-ayah="4"]'); // الثانية تُغلق
    assert.ok(!(await popVisible(page)));
    await ctx.close();
  });

  await check('التخزين: تفسير آية محفوظة يُخزَّن محليًا ويعمل دون اتصال، وغير المخزَّن يعطي رسالة مناسبة', async () => {
    const { page, ctx, hits } = await newPage(browser);
    await openReview(page, 112, 1, 2);
    await holdOn(page, '.ayah-text[data-ayah="2"]');
    await page.mouse.up();
    await page.waitForFunction(() => localStorage.getItem('sahib_tafsir_cache_v1')); // الطلب يكمل ويُخزَّن حتى لو رُفع الإصبع مبكرًا
    const cache = JSON.parse(await page.evaluate(() => localStorage.getItem('sahib_tafsir_cache_v1')));
    assert.deepStrictEqual(Object.keys(cache), ['muyassar:112:2']);
    assert.strictEqual(cache['muyassar:112:2'].surahNumber, 112);
    assert.ok(cache['muyassar:112:2'].cachedAt && cache['muyassar:112:2'].text);
    hits.mode = 'fail'; // قطع الإنترنت
    await holdOn(page, '.ayah-text[data-ayah="2"]');
    assert.ok((await popText(page)).includes('112:2'));       // من التخزين المحلي
    await page.mouse.up();
    await page.reload();                                       // إعادة فتح التطبيق
    await openMastered(page); await page.click('.entry-main');
    await page.waitForSelector('.ayah-text');
    await holdOn(page, '.ayah-text[data-ayah="2"]');
    assert.ok((await popText(page)).includes('112:2'));
    await page.mouse.up();
    await holdOn(page, '.ayah-text[data-ayah="1"]');          // غير مخزّن: الآية 1 لم تُطلب قبل
    const t = await popText(page);
    assert.ok(t.includes('تعذّر الاتصال') && !t.includes('112:1'), t);
    await page.mouse.up();
    const after = JSON.parse(await page.evaluate(() => localStorage.getItem('sahib_tafsir_cache_v1')));
    assert.deepStrictEqual(Object.keys(after), ['muyassar:112:2']); // لم يُخزَّن خطأ
    assert.strictEqual(JSON.parse(await page.evaluate(() => localStorage.getItem('quran_hifz_entries_v1'))).length, 1);
    await ctx.close();
  });

  await check('التفسير: آية خارج المحفوظات لا تُخزَّن بل تُعرض فقط', async () => {
    const { page, ctx } = await newPage(browser);
    await openReview(page, 2, 1, 5);
    await page.evaluate(() => Sahib.TafsirApi.fetchTafsir('muyassar', 2, 200).then(() => 1)); // خارج النطاق
    assert.strictEqual(await page.evaluate(() => localStorage.getItem('sahib_tafsir_cache_v1')), null);
    await ctx.close();
  });

  await check('حالات الفشل: شبكة، ردّ غير صالح، غير متاح (404)، تخزين ممتلئ، تفسير طويل داخل الشاشة', async () => {
    for (const [mode, expect, notExpect] of [['fail', 'تعذّر الاتصال', '112:1'], ['bad', 'غير صالح', 'x'], ['missing', 'غير متاح', '112:1']]) {
      const { page, ctx } = await newPage(browser, { tafsir: mode });
      await openReview(page, 112, 1, 4);
      await holdOn(page, '.ayah-text[data-ayah="1"]');
      await page.waitForFunction(() => !document.getElementById('tafsirPop').textContent.includes('جارٍ'));
      const t = await popText(page);
      assert.ok(t.includes(expect), `${mode}: ${t}`);
      assert.ok(await page.locator('.tafsir-body.error').count());
      await page.mouse.up();
      assert.strictEqual(await page.evaluate(() => localStorage.getItem('sahib_tafsir_cache_v1')), null, mode);
      await ctx.close();
    }
    { // تخزين ممتلئ
      const { page, ctx } = await newPage(browser);
      await openReview(page, 112, 1, 4);
      await page.evaluate(() => { const o = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === 'sahib_tafsir_cache_v1') { const e = new Error('q'); e.name = 'QuotaExceededError'; throw e; } return o.call(this, k, v); }; });
      await holdOn(page, '.ayah-text[data-ayah="1"]');
      await page.waitForFunction(() => document.getElementById('tafsirPop').textContent.includes('112:1'));
      assert.ok(await page.locator('.tafsir-note').isVisible());
      assert.ok((await page.textContent('.tafsir-note')).includes('تعذّر حفظ'));
      await page.mouse.up();
      await ctx.close();
    }
    { // تفسير طويل على شاشة 320px
      const { page, ctx } = await newPage(browser, { tafsir: 'long', viewport: { width: 320, height: 640 } });
      await openReview(page, 112, 1, 4);
      await holdOn(page, '.ayah-text[data-ayah="2"]');
      await page.waitForFunction(() => document.getElementById('tafsirPop').textContent.includes('كلمات طويلة'));
      const b = await page.locator('#tafsirPop').boundingBox();
      assert.ok(b.x >= 0 && b.x + b.width <= 320 && b.y >= 0 && b.y + b.height <= 640, JSON.stringify(b));
      assert.ok(b.height <= 640 * 0.56, `height ${b.height}`);
      await page.mouse.up();
      assert.ok(await page.locator('#tafsirPop').isVisible()); // ثابتة بعد الرفع
      const sc = await page.locator('#tafsirPop .tafsir-body').evaluate((n) => { n.scrollTop = 120; return { can: n.scrollHeight > n.clientHeight, top: n.scrollTop }; });
      assert.ok(sc.can && sc.top > 0, JSON.stringify(sc)); // قابلة للتمرير
      assert.ok(await page.locator('#tafsirPop').isVisible());
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(over <= 0);
      await page.mouse.click(3, 3); // زاوية الشاشة: خارج النافذة
      assert.ok(!(await page.locator('#tafsirPop').isVisible()));
      await ctx.close();
    }
  });

  await check('حفظ تفسير المقطع للاستخدام دون اتصال: كل آيات النطاق تُخزَّن بالتفسير النشط فقط', async () => {
    const { page, ctx, hits } = await newPage(browser);
    await openReview(page, 112, 1, 4);
    await page.click('[data-tafsir="saadi"]');
    await page.click('#downloadTafsirBtn');
    await page.waitForFunction(() => document.getElementById('downloadTafsirBtn').textContent.includes('حفظ التفسير للمقطع') && !document.getElementById('downloadTafsirBtn').disabled);
    const cache = JSON.parse(await page.evaluate(() => localStorage.getItem('sahib_tafsir_cache_v1')));
    assert.deepStrictEqual(Object.keys(cache).sort(), ['saadi:112:1', 'saadi:112:2', 'saadi:112:3', 'saadi:112:4']);
    assert.strictEqual(hits.t, 4);
    await page.click('[data-tafsir="muyassar"]'); // التبديل لا يحذف المخزَّن
    assert.strictEqual(Object.keys(JSON.parse(await page.evaluate(() => localStorage.getItem('sahib_tafsir_cache_v1')))).length, 4);
    await ctx.close();
  });

  await check('اللمس: ضغط مطول يعرض التفسير ويثبّته بعد الرفع، واللمس خارجه يغلقه، والتمرير باللمس لا يفتحه', async () => {
    const { page, ctx } = await newPage(browser, { touch: true });
    await openReview(page, 2, 1, 80);
    const cdp = await ctx.newCDPSession(page);
    const box = await page.locator('.ayah-text[data-ayah="1"]').boundingBox();
    const x = Math.round(box.x + box.width / 2), y = Math.round(box.y + box.height / 2);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await page.waitForTimeout(700);
    assert.ok(await popVisible(page));
    assert.ok((await popText(page)).includes('2:1'));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(150);
    assert.ok(await popVisible(page)); // باقية بعد رفع الإصبع
    const tb = await page.locator('#reviewTitle').boundingBox();
    const tx = Math.round(tb.x + tb.width / 2), ty = Math.round(tb.y + tb.height / 2);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: tx, y: ty }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(150);
    assert.ok(!(await popVisible(page)));
    // لمس ثم سحب (تمرير)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y + 100 }] });
    await page.waitForTimeout(100);
    for (let i = 1; i <= 6; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + 100 - i * 25 }] }); await page.waitForTimeout(30); }
    await page.waitForTimeout(700);
    assert.ok(!(await popVisible(page)));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await ctx.close();
  });

  await check('عرض الآيات: ترتيب RTL، data-سورة/آية لكل آية، تكبير الخط يُحفظ، والوضع الليلي', async () => {
    const { page, ctx } = await newPage(browser, { viewport: { width: 320, height: 640 } });
    await openReview(page, 112, 1, 4);
    const attrs = await page.$$eval('.ayah-text', (ns) => ns.map((n) => `${n.dataset.surah}:${n.dataset.ayah}`));
    assert.deepStrictEqual(attrs, ['112:1', '112:2', '112:3', '112:4']);
    assert.strictEqual(await page.$eval('.ayah-flow', (n) => getComputedStyle(n).direction), 'rtl');
    assert.notStrictEqual(await page.$eval('.ayah-flow', (n) => getComputedStyle(n).textAlign), 'justify');
    const before = await page.$eval('.ayah-flow', (n) => parseFloat(getComputedStyle(n).fontSize));
    await page.click('#fontUpBtn'); await page.click('#fontUpBtn');
    const after = await page.$eval('.ayah-flow', (n) => parseFloat(getComputedStyle(n).fontSize));
    assert.ok(after > before * 1.15, `${before}→${after}`);
    await page.reload();
    assert.strictEqual(JSON.parse(await page.evaluate(() => localStorage.getItem('sahib_settings_v1'))).fontScale, 1.2);
    await page.click('#themeToggleBtn');
    await openMastered(page); await page.click('.entry-main');
    await page.waitForSelector('.ayah-text');
    const color = await page.$eval('.ayah-flow', (n) => getComputedStyle(n).color);
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    assert.notStrictEqual(color, bg);
    assert.ok(await page.locator('.ayah-text.is-hidden').count() === 0);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(over <= 0);
    await ctx.close();
  });

  // ===================== البحث والتصفية والتعديل =====================
  const seed = [
    { id: 'a', surah: 2, surahName: 'x', from: 1, to: 20, dateAdded: '2026-10-01', lastReviewed: '2026-10-29', reviewCount: 2, notes: 'موضع تشابه', lastRating: 'mastered' },
    { id: 'b', surah: 18, surahName: 'x', from: 1, to: 10, dateAdded: '2026-10-10', lastReviewed: null, reviewCount: 0 },
    { id: 'c', surah: 112, surahName: 'x', from: 1, to: 4, dateAdded: '2026-10-20', lastReviewed: '2026-09-01', reviewCount: 1, lastRating: 'soon' }
  ];
  await check('القائمة: بحث باسم السورة (بلا تشكيل) وبرقم الآية وبالملاحظات وحالة عدم وجود نتائج', async () => {
    const { page, ctx } = await newPage(browser, { storage: { quran_hifz_entries_v1: JSON.stringify(seed) } });
    await openMastered(page);
    assert.strictEqual(await page.locator('.entry-card').count(), 3);
    await page.fill('#searchInput', 'البقره');
    assert.strictEqual(await page.locator('.entry-card').count(), 1);
    await page.fill('#searchInput', 'كهف');
    assert.strictEqual(await page.locator('.entry-card').count(), 1);
    await page.fill('#searchInput', '15');
    assert.strictEqual(await page.locator('.entry-card').count(), 1); // آية 15 تقع في 2:1-20 فقط
    await page.fill('#searchInput', 'تشابه');
    assert.strictEqual(await page.locator('.entry-card').count(), 1);
    await page.fill('#searchInput', 'لا شيء مطابق');
    assert.ok((await page.textContent('#listContent')).includes('لا توجد نتائج'));
    await page.click('#listContent .empty-cta');
    assert.strictEqual(await page.locator('.entry-card').count(), 3);
    await ctx.close();
  });

  await check('القائمة: التصفية والترتيب (أولوية المراجعة) والبيانات كما هي', async () => {
    const { page, ctx } = await newPage(browser, { storage: { quran_hifz_entries_v1: JSON.stringify(seed) } });
    await page.selectOption('#filterSelect', 'due');
    assert.strictEqual(await page.locator('.entry-card').count(), 2); // b (لم يُراجع) و c (قديم+ضعيف)
    await page.selectOption('#filterSelect', 'mastered');
    assert.strictEqual(await page.locator('.entry-card').count(), 1);
    await page.selectOption('#filterSelect', 'all');
    await page.selectOption('#sortSelect', 'priority');
    await openMastered(page);
    const surahs = await page.$$eval('.entry-card .entry-surah', (ns) => ns.map((n) => n.textContent));
    assert.strictEqual(surahs.length, 3);
    assert.ok(surahs[0].includes('الكَهۡفِ'), surahs[0]); // غير المراجع أولًا
    assert.ok(surahs[2].includes('البَقَرَةِ'), surahs[2]);
    assert.strictEqual(JSON.parse(await page.evaluate(() => localStorage.getItem('quran_hifz_entries_v1'))).length, 3);
    await ctx.close();
  });

  await check('تعديل مقطع: يملأ النموذج، يحفظ النطاق والملاحظة ويُبقي المراجعات، والإلغاء لا يغيّر شيئًا', async () => {
    const { page, ctx } = await newPage(browser, { storage: { quran_hifz_entries_v1: JSON.stringify(seed) } });
    await openMastered(page);
    await page.click('.entry-card[data-id="a"] .entry-act');
    assert.strictEqual(await page.textContent('#addTitle'), 'تعديل المقطع');
    assert.strictEqual(await page.inputValue('#toAyah'), '20');
    assert.strictEqual(await page.inputValue('#notesInput'), 'موضع تشابه');
    await page.click('#cancelEditBtn');
    assert.strictEqual(JSON.parse(await page.evaluate(() => localStorage.getItem('quran_hifz_entries_v1')))[0].to, 20);
    await page.click('.entry-card[data-id="a"] .entry-act');
    await page.fill('#toAyah', '30');
    await page.fill('#notesInput', 'ملاحظة جديدة');
    await page.selectOption('#masterySelect', 'strong');
    await page.click('#saveEntryBtn');
    await page.waitForSelector('.entry-card');
    const a = JSON.parse(await page.evaluate(() => localStorage.getItem('quran_hifz_entries_v1'))).find((e) => e.id === 'a');
    assert.strictEqual(a.to, 30);
    assert.strictEqual(a.notes, 'ملاحظة جديدة');
    assert.strictEqual(a.mastery, 'strong');
    assert.strictEqual(a.reviewCount, 2);
    assert.strictEqual(a.lastRating, 'mastered');
    assert.ok((await page.textContent('.entry-card[data-id="a"]')).includes('ملاحظة جديدة'));
    await page.click('nav.bottom button[data-tab="add"]'); // الدخول من جديد = وضع إضافة نظيف
    assert.strictEqual(await page.textContent('#addTitle'), 'إضافة حفظ جديد');
    assert.strictEqual(await page.inputValue('#notesInput'), '');
    await ctx.close();
  });

  await check('تعديل مقطع: نطاق غير صالح مرفوض، وتداخل مع مقطع آخر يحذّر', async () => {
    const two = [...seed, { id: 'd', surah: 2, surahName: 'x', from: 50, to: 60, dateAdded: '2026-10-02', lastReviewed: null, reviewCount: 0 }];
    const { page, ctx } = await newPage(browser, { storage: { quran_hifz_entries_v1: JSON.stringify(two) } });
    await openMastered(page);
    await page.click('.entry-card[data-id="a"] .entry-act');
    await page.fill('#toAyah', '999');
    await page.click('#saveEntryBtn');
    assert.ok(await page.locator('#addError.show').isVisible());
    await page.fill('#toAyah', '55'); // يتداخل مع d
    await page.click('#saveEntryBtn');
    await page.waitForSelector('#choiceModal.active');
    assert.ok((await page.textContent('#choiceMsg')).includes('الموجود'));
    await page.click('#choiceActions button:has-text("تعديل النطاق")');
    assert.strictEqual(JSON.parse(await page.evaluate(() => localStorage.getItem('quran_hifz_entries_v1'))).find((e) => e.id === 'a').to, 20);
    await ctx.close();
  });

  await check('إضافة بتاريخ بدء وملاحظة ومستوى إتقان، ورفض تاريخ مستقبلي', async () => {
    const { page, ctx } = await newPage(browser);
    await page.click('nav.bottom button[data-tab="add"]');
    await page.selectOption('#surahSelect', '1');
    await page.fill('#toAyah', '3');
    await page.fill('#startDate', '2999-01-01');
    await page.click('#saveEntryBtn');
    assert.ok((await page.textContent('#addError')).includes('تاريخ'));
    await page.fill('#startDate', '2026-09-15');
    await page.fill('#notesInput', 'ملاحظة');
    await page.selectOption('#masterySelect', 'medium');
    await page.click('#saveEntryBtn');
    await page.waitForSelector('.entry-card');
    const e = JSON.parse(await page.evaluate(() => localStorage.getItem('quran_hifz_entries_v1')))[0];
    assert.deepStrictEqual([e.dateAdded, e.notes, e.mastery], ['2026-09-15', 'ملاحظة', 'medium']);
    await ctx.close();
  });

  // ===================== النسخ الاحتياطي =====================
  const fs = require('fs');
  const os = require('os');
  const tmpFile = (name, content) => { const f = path.join(os.tmpdir(), `sahib-${Date.now()}-${name}`); fs.writeFileSync(f, content); return f; };
  const entriesOf = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('quran_hifz_entries_v1') || '[]'));

  await check('نسخ احتياطي: تصدير ملف حقيقي ثم استبدال على متصفح جديد يعيد البيانات', async () => {
    const { page, ctx } = await newPage(browser, { storage: { quran_hifz_entries_v1: JSON.stringify(seed), sahib_settings_v1: JSON.stringify({ tafsirId: 'saadi', fontScale: 1.3 }) } });
    await page.click('nav.bottom button[data-tab="stats"]');
    const [download] = await Promise.all([page.waitForEvent('download'), page.click('#exportBtn')]);
    assert.ok(/^sahib-backup-\d{4}-\d{2}-\d{2}\.json$/.test(download.suggestedFilename()));
    const file = path.join(os.tmpdir(), `sahib-dl-${Date.now()}.json`);
    await download.saveAs(file);
    const body = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.strictEqual(body.app, 'sahib');
    assert.strictEqual(body.entries.length, 3);
    assert.strictEqual(body.settings.tafsirId, 'saadi');
    await ctx.close();

    const b = await newPage(browser); // جهاز جديد فارغ
    await b.page.click('nav.bottom button[data-tab="stats"]');
    await b.page.setInputFiles('#importFile', file);
    await b.page.waitForSelector('#choiceModal.active');
    assert.ok((await b.page.textContent('#choiceMsg')).includes('3 مقطع'));
    await b.page.click('#choiceActions button:has-text("استبدال")');
    await b.page.waitForFunction(() => JSON.parse(localStorage.getItem('quran_hifz_entries_v1') || '[]').length === 3);
    const settings = await b.page.evaluate(() => JSON.parse(localStorage.getItem('sahib_settings_v1')));
    assert.strictEqual(settings.tafsirId, 'saadi');
    await b.page.click('nav.bottom button[data-tab="list"]');
    await openMastered(b.page);
    assert.strictEqual(await b.page.locator('#listContent .entry-card').count(), 3);
    assert.deepStrictEqual(b.errors, []);
    await b.ctx.close();
  });

  await check('نسخ احتياطي: دمج لا يكرّر ولا يغيّر الموجود، والإلغاء لا يغيّر شيئًا', async () => {
    const { page, ctx } = await newPage(browser, { storage: { quran_hifz_entries_v1: JSON.stringify([seed[0]]) } });
    const backup = JSON.stringify({ app: 'sahib', version: 1, exportedAt: '2026-10-30T00:00:00Z', entries: seed, reviewLog: [], settings: {} });
    const f = tmpFile('merge.json', backup);
    await page.click('nav.bottom button[data-tab="stats"]');
    await page.setInputFiles('#importFile', f);
    await page.waitForSelector('#choiceModal.active');
    await page.click('#choiceActions button:has-text("إلغاء")');
    assert.strictEqual((await entriesOf(page)).length, 1);
    await page.setInputFiles('#importFile', f);
    await page.waitForSelector('#choiceModal.active');
    await page.click('#choiceActions button:has-text("دمج")');
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('quran_hifz_entries_v1')).length === 3);
    await page.setInputFiles('#importFile', f); // دمج ثانٍ لا يضيف شيئًا
    await page.waitForSelector('#choiceModal.active');
    await page.click('#choiceActions button:has-text("دمج")');
    await page.waitForTimeout(200);
    assert.strictEqual((await entriesOf(page)).length, 3);
    await ctx.close();
  });

  await check('نسخ احتياطي: ملف تالف أو غريب يُرفض برسالة ولا تتغير البيانات', async () => {
    const { page, ctx } = await newPage(browser, { storage: { quran_hifz_entries_v1: JSON.stringify(seed) } });
    await page.click('nav.bottom button[data-tab="stats"]');
    for (const [name, content, reason] of [
      ['broken.json', '{"app":"sahib", oops', 'JSON'],
      ['other.json', JSON.stringify({ app: 'other', version: 1, entries: [] }), 'ليس نسخة احتياطية من تطبيق صاحِب'],
      ['badentry.json', JSON.stringify({ app: 'sahib', version: 1, entries: [{ id: 'q', surah: 1, from: 3, to: 99 }] }), 'غير صالح'],
      ['future.json', JSON.stringify({ app: 'sahib', version: 7, entries: [] }), 'أحدث']
    ]) {
      await page.setInputFiles('#importFile', tmpFile(name, content));
      await page.waitForSelector('#choiceModal.active');
      const msg = await page.textContent('#choiceMsg');
      assert.ok(msg.includes(reason) && msg.includes('لم يتغير شيء'), `${name}: ${msg}`);
      await page.click('#choiceActions button:has-text("حسنًا")');
      assert.strictEqual((await entriesOf(page)).length, 3, name);
    }
    await ctx.close();
  });


  // ======================= الإصدار 1.3 =======================
  const ds = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA'); };
  const seedEntries = () => JSON.stringify([
    { id: 'a1', surah: 112, surahName: 'الإخلاص', from: 1, to: 4, dateAdded: ds(-30), lastReviewed: ds(-10), reviewCount: 2, lastRating: 'good' },   // متأخرة 3
    { id: 'b2', surah: 1, surahName: 'الفاتحة', from: 1, to: 7, dateAdded: ds(-3), lastReviewed: null, reviewCount: 0 },                          // متأخرة 3 (لم تُراجع)
    { id: 'c3', surah: 112, surahName: 'الإخلاص', from: 2, to: 3, dateAdded: ds(-20), lastReviewed: ds(-1), reviewCount: 4, lastRating: 'mastered' } // قادمة
  ]);
  const seeded = (extra) => ({ storage: { quran_hifz_entries_v1: seedEntries(), ...(extra || {}) } });
  const logOf = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('sahib_review_log_v1') || '[]'));
  const pickFromSheet = async (page, triggerSel, optionText) => {
    await page.click(triggerSel);
    await page.waitForSelector('#selectSheet.active');
    await page.click(`#sheetList [role="option"]:has-text("${optionText}")`);
    await page.waitForSelector('#selectSheet:not(.active)', { state: 'attached' });
  };

  await check('التبويبات الخمسة بالترتيب، ومؤشر الاتصال يتبدل عند انقطاع الشبكة', async () => {
    const { page, ctx, errors } = await newPage(browser);
    const labels = await page.$$eval('nav.bottom button span', (n) => n.map((x) => x.textContent));
    assert.deepStrictEqual(labels, ['محفوظاتي', 'المراجعة', 'إضافة', 'الإحصائيات', 'الإعدادات']);
    assert.strictEqual((await page.textContent('#netStatus')).trim(), 'متصل');
    await ctx.setOffline(true);
    await page.waitForFunction(() => document.getElementById('netStatus').textContent.includes('غير متصل'));
    assert.ok(await page.locator('#netStatus.offline').count());
    await ctx.setOffline(false);
    await page.waitForFunction(() => document.getElementById('netStatus').textContent.trim() === 'متصل');
    for (const t of ['plan', 'settings', 'stats', 'add', 'list']) {
      await page.click(`nav.bottom button[data-tab="${t}"]`);
      assert.ok(await page.locator(`#view-${t}.active`).count(), t);
    }
    assert.deepStrictEqual(errors, []);
    await ctx.close();
  });

  await check('القائمة المخصصة: لا select أصلي ظاهر، بحث، لوحة مفاتيح، Esc، وتحديث القيمة', async () => {
    const { page, ctx, errors } = await newPage(browser);
    await page.click('nav.bottom button[data-tab="add"]');
    const box = await page.locator('#surahSelect').boundingBox();
    assert.ok(box.width <= 2 && box.height <= 2, JSON.stringify(box)); // الأصلي مخفي، الزر بديله
    await page.click('#surahSelectBtn');
    assert.ok(await page.locator('#selectSheet.active').count());
    assert.ok(await page.locator('#sheetSearch').isVisible());           // 114 خيارًا: البحث ظاهر
    await page.fill('#sheetSearch', 'البقره');
    assert.strictEqual(await page.locator('#sheetList [role="option"]:not([hidden])').count(), 1);
    await page.keyboard.press('Escape');
    assert.ok(!(await page.locator('#selectSheet.active').count()));
    await page.click('#surahSelectBtn');
    await page.fill('#sheetSearch', 'البقره');
    await page.click('#sheetList [role="option"]:not([hidden])');
    assert.strictEqual(await page.inputValue('#surahSelect'), '2');
    assert.ok((await page.textContent('#surahSelectBtn')).includes('2. '));
    assert.ok((await page.textContent('#surahAyahHint')).includes('286'));   // حدث change وصل للمنطق
    // خيارات قصيرة: بلا بحث، وأسهم + Enter
    await page.click('#masterySelectBtn');
    assert.ok(!(await page.locator('#sheetSearch').isVisible()));
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
    assert.ok(await page.inputValue('#masterySelect') !== '');
    // إعادة تعيين القيمة برمجيًا (نموذج التعديل) يحدّث الزر
    await page.evaluate(() => { document.getElementById('masterySelect').value = 'strong'; });
    assert.ok((await page.textContent('#masterySelectBtn')).includes('قوي'));
    // قائمة تُفتح فوق نافذة رسالة ولا تغلقها عند Esc
    assert.deepStrictEqual(errors, []);
    await ctx.close();
  });

  await check('تبويب المراجعة: جدولة المقاطع، فلتر «عرض» المخصص، وحالات الفراغ', async () => {
    let { page, ctx, errors } = await newPage(browser, seeded());
    await page.click('nav.bottom button[data-tab="plan"]');
    assert.ok((await page.textContent('#planTop')).includes('هدف اليوم'));
    assert.strictEqual(await page.locator('.plan-card').count(), 3);
    assert.strictEqual(await page.locator('#schedList .sched-item').count(), 2);          // المستحقة اليوم
    assert.ok((await page.textContent('#schedList')).includes('متأخرة 3 أيام'));
    await pickFromSheet(page, '#planFilterBtn', 'القادمة');
    assert.strictEqual(await page.locator('#schedList .sched-item').count(), 1);
    assert.ok((await page.textContent('#schedList')).includes('بعد'));
    await pickFromSheet(page, '#planFilterBtn', 'المتأخرة');
    assert.strictEqual(await page.locator('#schedList .sched-item').count(), 2);
    await pickFromSheet(page, '#planFilterBtn', 'الكل');
    assert.strictEqual(await page.locator('#schedList .sched-item').count(), 3);
    // لا شيء مستحق: رسالة فراغ (سياق جديد ببيانات راجعها المستخدم اليوم)
    await ctx.close();
    const done = JSON.parse(seedEntries()).map((x) => ({ ...x, lastReviewed: ds(0), lastRating: 'mastered' }));
    const fresh = await newPage(browser, { storage: { quran_hifz_entries_v1: JSON.stringify(done) } });
    await fresh.page.click('nav.bottom button[data-tab="plan"]');
    assert.strictEqual(await fresh.page.locator('#schedList .sched-item').count(), 0);
    assert.ok((await fresh.page.textContent('#schedList')).includes('لا توجد مقاطع مستحقة'));
    page = fresh.page; ctx = fresh.ctx;
    // فتح مقطع من القائمة
    await pickFromSheet(page, '#planFilterBtn', 'الكل');
    await page.click('#schedList .sched-item');
    await page.waitForSelector('#reviewOverlay.active .ayah-text');
    assert.deepStrictEqual(errors, []);
    await ctx.close();
  });

  await check('جلسة اليوم: مقطعان مستحقان بالتتابع، تقييم كل منهما، ملخص، وهدف اليوم يتقدم', async () => {
    const { page, ctx, errors } = await newPage(browser, seeded());
    await page.click('nav.bottom button[data-tab="plan"]');
    await page.click('.plan-card >> nth=0');
    await page.waitForSelector('#reviewOverlay.active .ayah-text');
    assert.ok((await page.textContent('#reviewSubtitle')).includes('جلسة اليوم · 1 من 2'));
    await page.click('#markReviewedBtn');
    await page.click('#ratePanel [data-rating="good"]');
    await page.waitForFunction(() => document.getElementById('reviewSubtitle').textContent.includes('2 من 2'), null, { timeout: 8000 });
    await page.waitForSelector('.ayah-text');
    await page.click('#markReviewedBtn');
    await page.click('#ratePanel [data-rating="mastered"]');
    await page.waitForSelector('#choiceModal.active', { timeout: 8000 });
    assert.ok((await page.textContent('#choiceMsg')).includes('أتممت جلسة اليوم: 2'));
    await page.click('#choiceActions button');
    assert.ok(!(await page.locator('#reviewOverlay.active').count()));
    assert.ok((await page.textContent('#planTop')).includes('2 من 3 جلسة'));
    const log = await logOf(page);
    assert.strictEqual(log.length, 2);
    assert.ok(log.every((r) => r.type === 'session' && r.status === 'completed' && r.date === ds(0)));
    const ents = JSON.parse(await page.evaluate(() => localStorage.getItem('quran_hifz_entries_v1')));
    assert.strictEqual(ents.filter((e) => e.lastReviewed === ds(0)).length, 2);
    assert.strictEqual(await page.locator('#schedList .sched-item').count(), 0); // لم يعد شيء مستحقًا
    assert.deepStrictEqual(errors, []);
    await ctx.close();
  });

  await check('جلسة اليوم: الإغلاق في المنتصف يوقف الجلسة دون تسجيل، ولا شيء مستحق = رسالة', async () => {
    const { page, ctx } = await newPage(browser, seeded());
    await page.click('nav.bottom button[data-tab="plan"]');
    await page.click('.plan-card >> nth=0');
    await page.waitForSelector('.ayah-text');
    await page.click('#reviewCloseBtn');
    await page.waitForTimeout(1200);
    assert.ok(!(await page.locator('#reviewOverlay.active').count()));
    assert.strictEqual((await logOf(page)).length, 0);
    await ctx.close();
    const only = await newPage(browser, { storage: { quran_hifz_entries_v1: JSON.stringify([JSON.parse(seedEntries())[2]]) } });
    await only.page.click('nav.bottom button[data-tab="plan"]');
    await only.page.click('.plan-card >> nth=0');
    await only.page.waitForFunction(() => document.getElementById('toast').textContent.includes('لا توجد مقاطع مستحقة'));
    assert.ok(!(await only.page.locator('#reviewOverlay.active').count()));
    await only.ctx.close();
  });

  await check('المراجعة العشوائية: بلا تكرار حتى تنتهي المقاطع، مع خيار الإنهاء', async () => {
    const { page, ctx, errors } = await newPage(browser, seeded());
    await page.click('nav.bottom button[data-tab="plan"]');
    const seen = [];
    await page.click('.plan-card >> nth=1');
    for (let i = 0; i < 3; i++) {
      await page.waitForSelector('#reviewOverlay.active .ayah-text');
      await page.waitForFunction(() => !document.getElementById('markReviewedBtn').disabled);
      seen.push((await page.textContent('#reviewTitle')) + (await page.textContent('#reviewSubtitle')).split('·')[0].trim());
      await page.click('#markReviewedBtn');
      await page.click('#ratePanel [data-rating="good"]');
      await page.waitForSelector('#choiceModal.active', { timeout: 8000 });
      assert.ok((await page.textContent('#choiceMsg')).includes('مقطعًا عشوائيًا آخر'));
      if (i < 2) await page.click('#choiceActions button:has-text("مقطع آخر")');
      else await page.click('#choiceActions button:has-text("إنهاء")');
    }
    assert.strictEqual(new Set(seen).size, 3, seen.join(' | '));
    const log = await logOf(page);
    assert.ok(log.length === 3 && log.every((r) => r.type === 'random'));
    assert.ok(!(await page.locator('#reviewOverlay.active').count()));
    assert.deepStrictEqual(errors, []);
    await ctx.close();
  });

  await check('مراجعة سورة ونطاق: نافذة بقائمة مخصصة، تحقق، وتسجَّل دون تغيير المحفوظات', async () => {
    const { page, ctx, errors } = await newPage(browser, seeded());
    const before = await page.evaluate(() => localStorage.getItem('quran_hifz_entries_v1'));
    await page.click('nav.bottom button[data-tab="plan"]');
    await page.click('.plan-card >> nth=2');
    await page.waitForSelector('#choiceModal.active #rangeSurahBtn');
    await pickFromSheet(page, '#rangeSurahBtn', '112. ');
    assert.ok(await page.locator('#choiceModal.active').count());       // اختيار القائمة لا يغلق النافذة
    assert.strictEqual(await page.inputValue('#rangeFrom'), '1');
    assert.strictEqual(await page.inputValue('#rangeTo'), '4');
    await page.fill('#rangeTo', '9');
    await page.click('#choiceActions button:has-text("ابدأ المراجعة")');
    assert.ok(await page.locator('.dlg-error').isVisible());
    assert.ok(await page.locator('#choiceModal.active').count());       // بقيت مفتوحة مع الخطأ
    await page.fill('#rangeTo', '2');
    await page.click('#choiceActions button:has-text("ابدأ المراجعة")');
    await page.waitForSelector('#reviewOverlay.active .ayah-text');
    assert.strictEqual(await page.locator('.ayah-text').count(), 2);
    await page.click('#markReviewedBtn');
    await page.click('#ratePanel [data-rating="mastered"]');
    await page.waitForFunction(() => document.getElementById('toast').textContent.includes('أحسنت'));
    const log = await logOf(page);
    assert.strictEqual(log.length, 1);
    assert.ok(log[0].type === 'range' && log[0].entryId === null && log[0].surah === 112 && log[0].from === 1 && log[0].to === 2);
    assert.strictEqual(await page.evaluate(() => localStorage.getItem('quran_hifz_entries_v1')), before);
    assert.deepStrictEqual(errors, []);
    await ctx.close();
  });

  await check('الإحصائيات: مخطط النشاط 7 أيام، الأهداف، وتعريف المتقن الجديد في الملاحظة', async () => {
    const log = [
      { id: 'l1', entryId: 'a1', status: 'completed', type: 'normal', date: ds(0) }, { id: 'l2', entryId: 'a1', status: 'completed', type: 'normal', date: ds(0) },
      { id: 'l3', entryId: 'b2', status: 'completed', type: 'normal', date: ds(-3) }, { id: 'l4', entryId: 'b2', status: 'completed', type: 'normal', date: ds(-9) }
    ];
    const ents = JSON.parse(seedEntries()); ents[1].mastery = 'strong';
    const { page, ctx, errors } = await newPage(browser, { storage: { quran_hifz_entries_v1: JSON.stringify(ents), sahib_review_log_v1: JSON.stringify(log) } });
    await page.click('nav.bottom button[data-tab="stats"]');
    const txt = await page.textContent('#statsContent');
    assert.ok(txt.includes('النشاط خلال آخر 7 أيام') && txt.includes('أنجزت 3 جلسات مراجعة'), txt);
    assert.strictEqual(await page.locator('.activity .col').count(), 7);
    assert.deepStrictEqual(await page.$$eval('.activity .n', (n) => n.map((x) => x.textContent)), ['0', '0', '0', '1', '0', '0', '2']);
    assert.ok(txt.includes('الأهداف') && txt.includes('2 من 3') && txt.includes('3 من 15'));
    assert.ok(txt.includes('إتقانك «قوي»'));
    // متقن: c3 (تقييم) + b2 (إتقان قوي بلا تقييم) = 2
    const nums = await page.$$eval('#statsContent .stat-box', (b) => b.map((x) => x.textContent));
    assert.ok(nums.some((t) => t.startsWith('2') && t.includes('متقن')), nums.join('|'));
    assert.deepStrictEqual(errors, []);
    await ctx.close();
  });

  await check('الإعدادات: وضع ليلي، خطوات الأرقام، الترتيب الافتراضي، مدة الضغط تؤثر فعلًا، وإعادة الضبط لا تمس المحفوظات', async () => {
    const { page, ctx, errors } = await newPage(browser, seeded());
    await page.click('nav.bottom button[data-tab="settings"]');
    const settingsOf = () => page.evaluate(() => JSON.parse(localStorage.getItem('sahib_settings_v1') || '{}'));
    // وضع ليلي
    await page.click('#settingsContent [role="switch"]');
    assert.ok(await page.evaluate(() => document.body.classList.contains('dark-theme')));
    assert.strictEqual(await page.evaluate(() => localStorage.getItem('quran_theme_v1')), 'dark');
    await page.click('#settingsContent [role="switch"]');
    // هدف اليوم +
    await page.click('button[aria-label="زيادة هدف اليوم"]');
    assert.strictEqual((await settingsOf()).dailyGoal, 4);
    // حدود: حجم الجلسة لا ينزل عن 1
    for (let i = 0; i < 4; i++) await page.click('button[aria-label="إنقاص حجم جلسة اليوم"]', { trial: false }).catch(() => {});
    assert.ok(await page.locator('button[aria-label="إنقاص حجم جلسة اليوم"]').isDisabled());
    assert.strictEqual((await settingsOf()).sessionSize, 1);
    // ترتيب افتراضي
    await pickFromSheet(page, '#setSortBtn', 'الأحدث إضافة');
    assert.strictEqual((await settingsOf()).defaultSort, 'added');
    await page.click('nav.bottom button[data-tab="list"]');
    assert.strictEqual(await page.inputValue('#sortSelect'), 'added');
    await page.waitForTimeout(400); // localStorage على file:// يُكتب إلى القرص بتأخير؛ نتجنب سباقًا في الاختبار فقط
    await page.reload();
    assert.strictEqual(await page.inputValue('#sortSelect'), 'added', await page.evaluate(() => localStorage.getItem('sahib_settings_v1')));
    // مدة الضغط 300ms: ضغطة 420ms تفتح التفسير بينما الافتراضي 500 لا يفتح
    await page.click('nav.bottom button[data-tab="settings"]');
    for (let i = 0; i < 4; i++) await page.click('button[aria-label="إنقاص مدة الضغط المطول"]');
    assert.strictEqual((await settingsOf()).holdMs, 300);
    await page.click('nav.bottom button[data-tab="list"]');
    await openMastered(page);
    await page.click('.entry-main >> nth=0');
    await page.waitForSelector('.ayah-text');
    await holdOn(page, '.ayah-text[data-ayah="1"]', 420);
    assert.ok(await page.locator('#tafsirPop').isVisible());
    await page.mouse.up();
    await page.click('#tafsirPop .tafsir-close');
    await page.click('#reviewCloseBtn');
    // إعادة الضبط
    const entriesBefore = await page.evaluate(() => localStorage.getItem('quran_hifz_entries_v1'));
    await page.click('nav.bottom button[data-tab="settings"]');
    await page.click('button:has-text("إعادة ضبط الإعدادات")');
    await page.waitForSelector('#choiceModal.active');
    await page.click('#choiceActions button:has-text("إلغاء")');
    assert.strictEqual((await settingsOf()).holdMs, 300);                // الإلغاء لا يغيّر
    await page.click('button:has-text("إعادة ضبط الإعدادات")');
    await page.click('#choiceActions button:has-text("إعادة الضبط")');
    await page.waitForFunction(() => { const s = JSON.parse(localStorage.getItem('sahib_settings_v1') || '{}'); return s.holdMs === 500 && s.dailyGoal === 3; });
    assert.strictEqual(await page.evaluate(() => localStorage.getItem('quran_hifz_entries_v1')), entriesBefore);
    assert.deepStrictEqual(errors, []);
    await ctx.close();
  });

  await check('الإعدادات: فترات الجدولة تغيّر مواعيد المراجعة فعلًا', async () => {
    const { page, ctx } = await newPage(browser, seeded());
    await page.click('nav.bottom button[data-tab="plan"]');
    await page.click('#planFilterBtn'); await page.click('#sheetList [role="option"]:has-text("القادمة")');
    assert.strictEqual(await page.locator('#schedList .sched-item').count(), 1);   // c3 (متقن +14)
    await page.click('nav.bottom button[data-tab="settings"]');
    for (let i = 0; i < 13; i++) await page.click('button[aria-label="إنقاص بعد تقييم «متقن»"]'); // 14 → 1 يوم
    await page.click('nav.bottom button[data-tab="plan"]');
    await page.click('#planFilterBtn'); await page.click('#sheetList [role="option"]:has-text("المستحقة اليوم")');
    assert.strictEqual(await page.locator('#schedList .sched-item').count(), 3);   // c3 صار مستحقًا اليوم (بعد 1 يوم من أمس)
    await ctx.close();
  });

  await check('الإعدادات: تنزيل النصوص والتفاسير لكل المحفوظات دون اتصال، وإيقاف، ومسح بتأكيد', async () => {
    const { page, ctx, hits } = await newPage(browser, seeded());
    await page.click('nav.bottom button[data-tab="settings"]');
    await page.click('button:has-text("تنزيل نصوص سور محفوظاتي")');
    await page.waitForFunction(() => document.querySelector('.set-progress').textContent.includes('اكتمل'));
    const texts = JSON.parse(await page.evaluate(() => localStorage.getItem('quran_text_cache_v1')));
    assert.deepStrictEqual(Object.keys(texts).sort(), ['1', '112']);
    await page.click('button:has-text("تنزيل التفسير الميسر لكل محفوظاتي")');
    await page.waitForFunction(() => document.querySelector('.set-progress').textContent.includes('اكتمل: التفسير الميسر'));
    const tc = JSON.parse(await page.evaluate(() => localStorage.getItem('sahib_tafsir_cache_v1')));
    assert.strictEqual(Object.keys(tc).length, 11);                       // 112:1-4 + 1:1-7
    assert.ok(Object.keys(tc).every((k) => k.startsWith('muyassar:')));
    const used = hits.t;
    await page.click('button:has-text("تنزيل التفسير الميسر لكل محفوظاتي")');   // الموجود لا يُعاد جلبه
    await page.waitForFunction(() => document.querySelector('.set-progress').textContent.includes('اكتمل'));
    assert.strictEqual(hits.t, used);
    // بلا اتصال: لا يبدأ
    await ctx.setOffline(true);
    await page.click('button:has-text("تنزيل نصوص سور محفوظاتي")');
    await page.waitForFunction(() => document.getElementById('toast').textContent.includes('لا يوجد اتصال'));
    await ctx.setOffline(false);
    // مسح التفاسير مع تأكيد؛ المحفوظات لا تُمس
    const entriesBefore = await page.evaluate(() => localStorage.getItem('quran_hifz_entries_v1'));
    await page.click('button:has-text("مسح التفاسير المحفوظة")');
    await page.click('#choiceActions button:has-text("إلغاء")');
    assert.strictEqual(Object.keys(JSON.parse(await page.evaluate(() => localStorage.getItem('sahib_tafsir_cache_v1')))).length, 11);
    await page.click('button:has-text("مسح التفاسير المحفوظة")');
    await page.click('#choiceActions button:has-text("مسح")');
    await page.waitForFunction(() => localStorage.getItem('sahib_tafsir_cache_v1') === '{}');
    await page.click('button:has-text("مسح نصوص السور المحفوظة")');
    await page.click('#choiceActions button:has-text("مسح")');
    await page.waitForFunction(() => localStorage.getItem('quran_text_cache_v1') === '{}');
    assert.strictEqual(await page.evaluate(() => localStorage.getItem('quran_hifz_entries_v1')), entriesBefore);
    await ctx.close();
  });

  await check('العمل دون اتصال الفعلي: Service Worker عبر خادم محلي، ثم إعادة التحميل بلا شبكة تعمل بكامل الواجهة والبيانات', async () => {
    const http = require('http'); const fs = require('fs');
    const root = path.join(__dirname, '..');
    const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };
    const server = http.createServer((req, res) => {
      const u = decodeURIComponent(req.url.split('?')[0]);
      const f = path.join(root, u === '/' ? 'index.html' : u);
      if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('nf'); }
      res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-cache' });
      fs.createReadStream(f).pipe(res);
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const base = `http://localhost:${server.address().port}/`;
    const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, timezoneId: 'Africa/Khartoum', locale: 'ar' });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route(/api\.alquran\.cloud/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: surahBody(Number(/surah\/(\d+)\//.exec(r.request().url())[1])) }));
    try {
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller === null ? false : true, null, { timeout: 15000 }).catch(() => {});
      await page.waitForFunction(async () => { const r = await navigator.serviceWorker.getRegistration(); return !!(r && r.active); }, null, { timeout: 15000 });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 });
      const cached = await page.evaluate(async () => { const n = (await caches.keys()).find((k) => k.startsWith('sahib-shell-')); return n ? (await (await caches.open(n)).keys()).length : 0; });
      assert.ok(cached >= 19, 'cached ' + cached);
      // نخزّن بيانات ونصًا أثناء الاتصال
      await addEntry(page, 112, 1, 4);
      await page.waitForSelector('.entry-main, #masteredFolderBtn'); await openMastered(page);
      await openMastered(page); await page.click('.entry-main');
      await page.waitForSelector('.ayah-text');
      await page.click('#reviewCloseBtn');
      // انقطاع كامل
      await ctx.setOffline(true);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.entry-main, #masteredFolderBtn'); await openMastered(page);
      assert.ok((await page.textContent('#netStatus')).includes('غير متصل'));
      assert.strictEqual(await page.locator('#listContent .entry-card').count(), 1);
      await openMastered(page); await page.click('.entry-main');
      await page.waitForSelector('.ayah-text');                           // النص من الذاكرة المحلية
      assert.strictEqual(await page.locator('.ayah-text').count(), 4);
      await page.click('#reviewCloseBtn');
      for (const t of ['plan', 'stats', 'settings']) { await page.click(`nav.bottom button[data-tab="${t}"]`); assert.ok(await page.locator(`#view-${t}.active`).count()); }
      assert.ok((await page.textContent('#settingsContent')).includes('جاهزة: تُفتح ملفات التطبيق دون إنترنت'));
      assert.deepStrictEqual(errors, []);
    } finally {
      await ctx.close(); server.close();
    }
  });


  await check('مجلد المتقنة: السورة المكتملة والمتقنة كل مقاطعها تنتقل كاملة، وآيات متقنة جزئية أو سورة فيها مقطع غير متقن تبقى ظاهرة', async () => {
    const mk = (id, surah, from, to, r = 'mastered') => ({ id, surah, surahName: 'x', from, to, dateAdded: ds(-5), lastReviewed: ds(-1), reviewCount: 1, lastRating: r });
    // الإخلاص مكتملة (1-2 و3-4) ومتقنة؛ الفاتحة 1-3 متقنة لكنها جزء من سورة؛ البقرة 1-20 جزء
    const ents = [mk('i1', 112, 1, 2), mk('i2', 112, 3, 4), mk('f1', 1, 1, 3), mk('b1', 2, 1, 20)];
    const { page, ctx, errors } = await newPage(browser, { storage: { quran_hifz_entries_v1: JSON.stringify(ents) } });
    assert.strictEqual(await page.locator('#listContent .entry-card').count(), 2);       // الفاتحة والبقرة (جزئيتان)
    assert.ok((await page.textContent('#masteredFolderBtn')).includes('المتقنة (1 سورة)'));
    assert.strictEqual(await page.getAttribute('#masteredFolderBtn', 'aria-expanded'), 'false');
    assert.ok((await page.textContent('#listStatsStrip')).includes('27'));                // الشريط يحسب كل الآيات
    await page.click('#masteredFolderBtn');
    assert.strictEqual(await page.locator('#listContent .entry-card').count(), 4);       // السورة بمقطعيها
    await page.click('#masteredFolderBtn');
    assert.strictEqual(await page.locator('#listContent .entry-card').count(), 2);
    await page.fill('#searchInput', 'الاخلاص');                                           // البحث يشمل المكتمل بلا مجلد
    assert.strictEqual(await page.locator('#masteredFolderBtn').count(), 0);
    await page.fill('#searchInput', '');
    // إكمال الفاتحة بمقطع جديد غير متقن: تبقى ظاهرة (فيها مقطع غير متقن)
    await addEntry(page, 1, 4, 7);
    await page.waitForSelector('#choiceModal.active');                                    // مجاور لـ 1-3
    await page.click('#choiceActions button:has-text("إضافة كمقطع مستقل")');
    await page.waitForSelector('#listContent .entry-card');
    assert.ok((await page.textContent('#masteredFolderBtn')).includes('المتقنة (1 سورة)'));
    assert.strictEqual(await page.locator('#listContent .entry-card').count(), 3);       // الفاتحة×2 + البقرة
    // تقييم المقطع الجديد «متقن»: تنتقل الفاتحة كاملة
    await page.click('#listContent .entry-card:has-text("4 إلى 7") .entry-main');
    await page.waitForSelector('.ayah-text');
    await page.click('#markReviewedBtn');
    await page.click('#ratePanel [data-rating="mastered"]');
    await page.waitForFunction(() => document.getElementById('toast').textContent.includes('أحسنت'));
    await page.click('#reviewCloseBtn');
    assert.ok((await page.textContent('#masteredFolderBtn')).includes('المتقنة (2 سور)'));
    assert.strictEqual(await page.locator('#listContent .entry-card').count(), 1);       // البقرة فقط
    // تقييم مقطع منها بتقييم أقل يُخرج السورة كلها من المجلد
    await page.click('#masteredFolderBtn');
    await page.click('#listContent .entry-card[data-id="i1"] .entry-main');
    await page.waitForSelector('.ayah-text');
    await page.click('#markReviewedBtn');
    await page.click('#ratePanel [data-rating="soon"]');
    await page.waitForFunction(() => document.getElementById('toast').textContent.includes('أحسنت'));
    await page.click('#reviewCloseBtn');
    assert.ok((await page.textContent('#masteredFolderBtn')).includes('المتقنة (1 سورة)'));
    // كل السور مكتملة ومتقنة: رسالة + المجلد
    const f = await newPage(browser, { storage: { quran_hifz_entries_v1: JSON.stringify([mk('i1', 112, 1, 4)]) } });
    assert.ok((await f.page.textContent('#listContent')).includes('كل سورك المحفوظة مكتملة'));
    assert.deepStrictEqual(errors, []);
    await f.ctx.close(); await ctx.close();
  });

  await check('عرض أرقام الآيات الطويلة في القائمة: لا تلتف ولا تتجاوز الحبة ولا تدفع النص', async () => {
    const e = [{ id: 'z', surah: 2, surahName: 'x', from: 100, to: 286, dateAdded: ds(-2), lastReviewed: null, reviewCount: 0 },
               { id: 'y', surah: 2, surahName: 'x', from: 1, to: 2, dateAdded: ds(-2), lastReviewed: null, reviewCount: 0 }];
    const { page, ctx } = await newPage(browser, { storage: { quran_hifz_entries_v1: JSON.stringify(e) }, viewport: { width: 320, height: 700 } });
    const r = await page.$$eval('.entry-marker', (ms) => ms.map((m) => ({ w: m.getBoundingClientRect().width, sw: m.scrollWidth, cw: m.clientWidth, h: m.getBoundingClientRect().height })));
    assert.ok(r.every((x) => x.sw <= x.cw && x.h <= 36 && Math.abs(x.w - r[0].w) < 1), JSON.stringify(r));
    assert.ok((await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 0);
    await ctx.close();
  });


  await check('البسملة: سطر مستقل فوق السورة، وأول آية بدونها، ولا تظهر في الفاتحة ولا عند البدء من آية 2', async () => {
    const B = 'بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ';
    const { page, ctx, errors } = await newPage(browser);
    await page.unroute(/api\.alquran\.cloud/);
    await page.route(/api\.alquran\.cloud/, (r) => {
      const n = Number(/surah\/(\d+)\//.exec(r.request().url())[1]);
      const ayahs = Array.from({ length: AYAH_COUNTS[n] }, (_, i) => ({ numberInSurah: i + 1, text: i === 0 && n !== 1 ? `${B} كلمةأولى${n}` : `كلمة${n}_${i + 1}` }));
      if (n === 1) ayahs[0].text = B;
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 200, data: { number: n, edition: { identifier: 'quran-uthmani' }, ayahs } }) });
    });
    await openReview(page, 112, 1, 4);
    assert.strictEqual((await page.textContent('.basmala')).trim(), B);
    assert.strictEqual(await page.locator('.basmala').count(), 1);
    assert.strictEqual((await page.textContent('.ayah-text[data-ayah="1"]')).trim(), 'كلمةأولى112');
    // أول عنصر في الجسم هو البسملة (فوق الآيات)
    assert.strictEqual(await page.$eval('#reviewBody', (n) => n.firstElementChild.className), 'basmala');
    await page.click('#reviewCloseBtn');
    await openMastered(page);
    await page.click('.entry-del');
    await page.click('#choiceActions button:has-text("حذف")');
    await addEntry(page, 112, 2, 4);
    await openMastered(page); await page.waitForSelector('.entry-main');
    await page.click('.entry-main');
    await page.waitForSelector('.ayah-text');
    assert.strictEqual(await page.locator('.basmala').count(), 0);        // البداية من آية 2: لا بسملة
    await page.click('#reviewCloseBtn');
    assert.deepStrictEqual(errors, []);
    await ctx.close();
  });


  // ---- أزرار تنزيل القرآن/التفسير كاملين ----
  async function mockFull(page, { slow = 0, surahFile = true } = {}) {
    const counts = await page.evaluate(() => Sahib.Quran.SURAHS.map((s) => s.ayahs));
    await page.route(/api\.alquran\.cloud/, (r) => {
      const n = Number(/surah\/(\d+)\//.exec(r.request().url())[1]);
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 200, data: { number: n, edition: { identifier: 'quran-uthmani' }, ayahs: Array.from({ length: counts[n - 1] }, (_, i) => ({ numberInSurah: i + 1, text: `ن${n}_${i + 1}` })) } }) });
    });
    await page.route(/cdn\.jsdelivr\.net/, async (r) => {
      if (slow) await new Promise((res) => setTimeout(res, slow));
      const url = r.request().url();
      const ms = /tafsir\/([^/]+)\/(\d+)\.json$/.exec(url);
      if (ms) {
        if (!surahFile) return r.fulfill({ status: 404, body: 'nf' });
        const n = +ms[2];
        return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ ayahs: Array.from({ length: counts[n - 1] }, (_, i) => ({ ayah: i + 1, text: `[${ms[1]}] ت${n}:${i + 1}` })) }) });
      }
      const m = /tafsir\/([^/]+)\/(\d+)\/(\d+)\.json/.exec(url);
      return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ surah: +m[2], ayah: +m[3], text: `[${m[1]}] ت${m[2]}:${m[3]}` }) });
    });
  }
  const waitResult = (page, re) => page.waitForFunction((src) => new RegExp(src).test(document.getElementById('choiceMsg').textContent) && !!document.querySelector('#choiceActions button'), re.source, { timeout: 60000 });

  await check('أزرار التنزيل بجانب «محفوظاتي»: صغيرة وأنيقة وفي نفس السطر بلا تجاوز (390 و320)', async () => {
    for (const w of [390, 320]) {
      const { page, ctx, errors } = await newPage(browser, { viewport: { width: w, height: 700 } });
      const r = await page.evaluate(() => {
        const rc = (id) => document.getElementById(id).getBoundingClientRect();
        const h = document.querySelector('h1.page-title').getBoundingClientRect();
        return { h: { t: h.top, b: h.bottom, r: h.right, l: h.left }, a: rc('dlQuranBtn').toJSON(), b: rc('dlTafsirBtn').toJSON(), over: document.documentElement.scrollWidth - document.documentElement.clientWidth };
      });
      for (const x of [r.a, r.b]) assert.ok(x.height <= 36 && x.width <= 100 && x.top >= r.h.t - 6 && x.bottom <= r.h.b + 6, JSON.stringify(r));
      assert.ok(r.over <= 0 && r.a.left >= 0 && r.b.left >= 0);
      assert.ok((await page.textContent('#dlQuranBtn')).includes('القرآن') && (await page.textContent('#dlTafsirBtn')).includes('التفسير'));
      assert.deepStrictEqual(errors, []);
      if (w === 390) await page.screenshot({ path: process.env.SHOT_DIR ? process.env.SHOT_DIR + '/home.png' : '/tmp/home.png', clip: { x: 0, y: 0, width: 390, height: 200 } });
      await ctx.close();
    }
  });

  await check('تنزيل نص القرآن كاملًا: تأكيد ثم تقدّم ثم اكتمال، والمحفوظ على الجهاز، وإعادة الضغط لا تنزّل شيئًا', async () => {
    const { page, ctx, errors, hits } = await newPage(browser);
    await mockFull(page);
    await page.click('#dlQuranBtn');
    assert.ok((await page.textContent('#choiceMsg')).includes('114'));
    await page.click('#choiceActions button:has-text("تنزيل")');
    await waitResult(page, /اكتمل التنزيل/);
    assert.strictEqual(await page.evaluate(() => Sahib.QuranApi.cachedSurahCount()), 114);
    assert.strictEqual(await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('quran_text_cache_v1'))).length), 114);
    await page.click('#choiceActions button:has-text("حسنًا")');
    assert.ok(await page.$eval('#dlQuranBtn', (b) => b.classList.contains('done')));
    await page.click('#dlQuranBtn');
    assert.ok(!(await page.$('#choiceModal.active')));
    assert.deepStrictEqual(errors, []);
    await ctx.close();
  });

  await check('تنزيل التفسير كاملًا: يُحفظ في IndexedDB ويبقى بعد إعادة التحميل ويظهر دون إنترنت', async () => {
    const { page, ctx, errors } = await newPage(browser, { storage: { sahib_settings_v1: JSON.stringify({ tafsirId: 'saadi' }) } });
    await mockFull(page);
    await page.click('#dlTafsirBtn');
    assert.ok((await page.textContent('#choiceMsg')).includes('تفسير السعدي'));
    await page.click('#choiceActions button:has-text("تنزيل")');
    await waitResult(page, /اكتمل التنزيل/);
    await page.click('#choiceActions button:has-text("حسنًا")');
    assert.strictEqual(await page.evaluate(() => Sahib.TafsirApi.persistedCount('saadi')), 6236);
    assert.strictEqual(await page.evaluate(() => localStorage.getItem('sahib_tafsir_cache_v1')), null, 'لا يملأ localStorage');
    assert.ok(await page.$eval('#dlTafsirBtn', (b) => b.classList.contains('done')));
    await page.waitForTimeout(300);
    await page.unroute(/cdn\.jsdelivr\.net/);
    await page.route(/cdn\.jsdelivr\.net/, (r) => r.abort());
    await page.reload();
    const got = await page.evaluate(async () => { await Sahib.TafsirApi.bulkReady; const r = await Sahib.TafsirApi.fetchTafsir('saadi', 2, 255); return { text: r.text, fromCache: r.fromCache, n: Sahib.TafsirApi.persistedCount('saadi') }; });
    assert.deepStrictEqual(got, { text: '[ar-tafseer-al-saddi] ت2:255', fromCache: true, n: 6236 });
    assert.deepStrictEqual(errors, []);
    await ctx.close();
  });

  await check('تنزيل التفسير: يعود للجلب آية آية إن لم يتوفر ملف السورة، ويمكن الإيقاف وما نُزِّل يبقى', async () => {
    const { page, ctx } = await newPage(browser);
    await mockFull(page, { slow: 40, surahFile: false });
    await page.click('#dlTafsirBtn');
    await page.click('#choiceActions button:has-text("تنزيل")');
    await page.waitForFunction(() => /\(\d+%\)/.test(document.querySelector('.dl-count').textContent) && Sahib.TafsirApi.persistedCount('muyassar') > 0, null, { timeout: 30000 });
    await page.click('#choiceActions button:has-text("إيقاف")');
    await waitResult(page, /أُوقف التنزيل/);
    const n = await page.evaluate(() => Sahib.TafsirApi.persistedCount('muyassar'));
    assert.ok(n > 0 && n < 6236, String(n));
    await page.click('#choiceActions button:has-text("حسنًا")');
    assert.ok(!(await page.$eval('#dlTafsirBtn', (b) => b.classList.contains('done'))));
    await ctx.close();
  });

  await check('تنزيل بلا إنترنت أو عند فشل المصدر: رسالة واضحة ولا ادّعاء نجاح', async () => {
    const { page, ctx } = await newPage(browser);
    await page.route(/api\.alquran\.cloud/, (r) => r.abort());
    await page.click('#dlQuranBtn');
    await page.click('#choiceActions button:has-text("تنزيل")');
    await waitResult(page, /توقف التنزيل/);
    assert.ok(!(await page.textContent('#choiceMsg')).includes('اكتمل'));
    await page.click('#choiceActions button:has-text("حسنًا")');
    assert.ok(!(await page.$eval('#dlQuranBtn', (b) => b.classList.contains('done'))));
    await ctx.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await page.click('#dlQuranBtn');
    await page.waitForTimeout(150);
    assert.ok(!(await page.$('#choiceModal.active')) || !(await page.textContent('#choiceMsg')).includes('تنزيل نص'));
    await ctx.close();
  });

  await browser.close();
  const failed = results.filter((r) => !r[0]).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
