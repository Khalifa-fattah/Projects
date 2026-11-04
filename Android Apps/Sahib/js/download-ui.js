/*
 * download-ui.js — زرّا الصفحة الرئيسية: تنزيل نص القرآن كاملًا، وتنزيل التفسير كاملًا (للعمل دون اتصال).
 * المنطق في Offline.downloadAllTexts / downloadAllTafsir؛ هنا التأكيد ونافذة التقدّم والنتيجة فقط.
 * العرض كله بـ textContent. الإيقاف في أي لحظة، وما نُزِّل يبقى محفوظًا ويُستكمل لاحقًا.
 */
(function (g) {
  'use strict';
  const NS = (g.Sahib = g.Sahib || {});
  const { Quran, Utils, UI, Offline, QuranApi, TafsirApi, Settings } = NS;
  const { el } = Utils;
  const $ = (id) => document.getElementById(id);

  let job = null;

  const activeTafsir = () => TafsirApi.TAFSIRS[Settings.get('tafsirId')] || TafsirApi.TAFSIRS.muyassar;

  function paintButtons() {
    const t = $('dlQuranBtn'), f = $('dlTafsirBtn');
    if (t) t.classList.toggle('done', QuranApi.cachedSurahCount() >= Quran.SURAHS.length);
    if (f) f.classList.toggle('done', TafsirApi.persistedCount(activeTafsir().id) >= Quran.TOTAL_AYAHS);
  }

  function failureText(kind, failure) {
    if (failure && failure.code === 'storage') return 'المساحة المتاحة على الجهاز لا تكفي أو التخزين غير متاح.';
    if (kind === 'texts') return 'تعذّر الاتصال بمصدر نص القرآن.';
    return TafsirApi.describeError(failure, activeTafsir().name);
  }

  async function run(kind) {
    if (job) return;
    const isTexts = kind === 'texts';
    const tafsir = activeTafsir();
    const have = isTexts ? QuranApi.cachedSurahCount() : TafsirApi.persistedCount(tafsir.id);
    const need = isTexts ? Quran.SURAHS.length : Quran.TOTAL_AYAHS;

    if (have >= need) {
      UI.toast(isTexts ? 'نص القرآن كاملًا محفوظ على جهازك.' : `${tafsir.name} كاملًا محفوظ على جهازك.`, 'success');
      paintButtons();
      return;
    }
    if (!Offline.isOnline()) { UI.toast('لا يوجد اتصال بالإنترنت حاليًا.', 'error'); return; }

    const msg = isTexts
      ? `تنزيل نص القرآن كاملًا (${Quran.SURAHS.length} سورة) ليعمل دون اتصال؟\nالمحفوظ حاليًا: ${have} سورة. يُنزَّل الباقي فقط.`
      : `تنزيل ${tafsir.name} كاملًا ليعمل دون اتصال؟\nالمحفوظ حاليًا: ${have} من ${need} آية. يُنزَّل الباقي فقط، وقد يستغرق بضع دقائق ويحتاج مساحة على جهازك.\nيمكنك تغيير التفسير من الإعدادات.`;
    const ok = await UI.choice(msg, [
      { label: 'إلغاء', value: false, kind: 'ghost' },
      { label: 'تنزيل', value: true, kind: 'primary', focus: true }
    ], { icon: '﴾ ⬇ ﴿' });
    if (ok !== true) return;

    // نافذة التقدّم
    const bar = el('span', { style: 'width:0%' });
    const meter = el('div', { class: 'meter', role: 'progressbar', 'aria-label': 'تقدّم التنزيل', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0' }, bar);
    const count = el('p', { class: 'dl-count', 'aria-live': 'polite', text: 'جارٍ التحضير…' });
    const ctl = new AbortController();
    job = { kind, ctl, finished: false };
    const onProgress = (d, t) => {
      const pct = t ? Math.round((d / t) * 100) : 0;
      bar.style.width = `${pct}%`;
      meter.setAttribute('aria-valuenow', String(pct));
      count.textContent = `${d} من ${t} سورة (${pct}%)`;
    };
    const shown = UI.choice(isTexts ? 'جارٍ تنزيل نص القرآن…' : `جارٍ تنزيل ${tafsir.name}…`, [
      { label: 'إيقاف', value: 'stop', kind: 'danger', focus: true }
    ], { icon: '﴾ ⬇ ﴿', content: el('div', { class: 'dl-box' }, meter, count) });
    shown.then(() => { if (job && !job.finished) ctl.abort(); });

    let res;
    try {
      res = isTexts
        ? await Offline.downloadAllTexts({ signal: ctl.signal, onProgress })
        : await Offline.downloadAllTafsir({ tafsirId: tafsir.id, signal: ctl.signal, onProgress });
    } catch (err) {
      res = { failure: err || { code: 'network' }, aborted: false, done: 0, total: Quran.SURAHS.length };
    }
    job.finished = true;
    job = null;
    UI.dismiss();
    paintButtons();

    let text, icon = '﴾ ✓ ﴿';
    if (res.aborted) {
      text = `أُوقف التنزيل (${res.done} من ${res.total} سورة). ما نُزِّل بقي محفوظًا، ويمكنك الاستكمال لاحقًا.`;
      icon = '﴾ ! ﴿';
    } else if (res.failure) {
      text = `توقف التنزيل قبل اكتماله: ${failureText(kind, res.failure)}\nتم ${res.done} من ${res.total} سورة، ويمكنك الاستكمال لاحقًا.`;
      icon = '﴾ ! ﴿';
    } else if (isTexts) {
      text = res.storage
        ? 'نُزِّل نص القرآن لكن تعذّر حفظه كاملًا على الجهاز (المساحة ممتلئة)، فلن يبقى بعد إغلاق التطبيق.'
        : 'اكتمل التنزيل: نص القرآن كاملًا جاهز للعمل دون اتصال.';
      if (res.storage) icon = '﴾ ! ﴿';
    } else {
      const extra = res.skipped ? `\n${res.skipped} آية بلا نص متاح في المصدر.` : '';
      text = `اكتمل التنزيل: ${tafsir.name} جاهز للعمل دون اتصال.${extra}`;
    }
    await UI.choice(text, [{ label: 'حسنًا', value: true, kind: 'primary', focus: true }], { icon });
  }

  function init() {
    const t = $('dlQuranBtn'), f = $('dlTafsirBtn');
    if (!t || !f) return;
    t.addEventListener('click', () => run('texts'));
    f.addEventListener('click', () => run('tafsir'));
    paintButtons();
    TafsirApi.bulkReady.then(paintButtons);
  }

  NS.DownloadUI = { init, paintButtons };
})(globalThis);
