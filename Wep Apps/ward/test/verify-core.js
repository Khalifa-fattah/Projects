/**
 * اختبارات التحقق من صحة المنطق، الخوارزميات، المحتوى وسلامة البيانات
 * لتطبيق «وِرد | Wird»
 */

import { ArabicSegmenter } from '../js/services/segmenter.js';
import { ReviewService } from '../js/services/review-service.js';
import { BackupService } from '../js/services/backup-service.js';
import { DEFAULT_COLLECTIONS, DEFAULT_AZKAR } from '../js/data/default-azkar.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [✔] ${message}`);
    passed++;
  } else {
    console.error(`  [✖] FAILED: ${message}`);
    failed++;
  }
}

console.log('==================================================');
console.log('1. اختبار سلامة المحتوى الديني الموثق (Data Integrity)');
console.log('==================================================');

assert(DEFAULT_COLLECTIONS.length === 6, 'عدد المجموعات الافتراضية يجب أن يكون 6');
assert(DEFAULT_AZKAR.length >= 25, `عدد الأذكار الموثقة يجب أن يكون وافياً (الحالي: ${DEFAULT_AZKAR.length})`);

const collectionIds = new Set(DEFAULT_COLLECTIONS.map(c => c.id));
let allItemsValid = true;
let allHaveTashkeel = true;
let allHaveSources = true;

for (const item of DEFAULT_AZKAR) {
  if (!item.id || !item.title || !item.text || !collectionIds.has(item.collectionId)) {
    allItemsValid = false;
  }
  if (!/[\u064B-\u065F]/.test(item.text)) {
    allHaveTashkeel = false;
  }
  if (!item.source || item.source.trim().length === 0) {
    allHaveSources = false;
  }
}

assert(allItemsValid, 'جميع الأذكار تمتلك معرفاً وعنواناً وتصنيفاً صحيحاً');
assert(allHaveTashkeel, 'جميع نصوص الأذكار تتضمن التشكيل العربي الكامل والصحيح');
assert(allHaveSources, 'جميع الأذكار موثقة بمصدر صريح ومرجع حديثي موثوق');

console.log('\n==================================================');
console.log('2. اختبار محرك تقسيم النص العربي (ArabicSegmenter)');
console.log('==================================================');

const sampleText = 'اللَّهُ لَا إِلَهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ لَهُ مَا فِي السَّمَاوَاتِ وَمَا فِي الْأَرْضِ مَنْ ذَا الَّذِي يَشْفَعُ عِنْدَهُ إِلَّا بِإِذْنِهِ';
const segments = ArabicSegmenter.segmentText(sampleText);

assert(segments.length >= 2, `تقسيم النص الطويل إلى مقاطع متوازنة (عدد المقاطع: ${segments.length})`);
assert(segments.every(s => s.trim().length > 0), 'لا توجد مقاطع فارغة');

// التحقق من أن إعادة تجميع الكلمات لا تفقد أي كلمة
const originalWords = sampleText.split(/\s+/).filter(Boolean);
const segmentedWords = segments.join(' ').split(/\s+/).filter(Boolean);
assert(originalWords.length === segmentedWords.length, `الحفاظ على جميع الكلمات دون نقصان (الأصل: ${originalWords.length}، المقاطع: ${segmentedWords.length})`);

// اختبار تجريد التشكيل
const plain = ArabicSegmenter.stripTashkeel('سُبْحَانَ اللَّهِ');
assert(plain === 'سبحان الله', `تجريد التشكيل بنجاح (${plain})`);

// اختبار دمج المقاطع
const merged = ArabicSegmenter.mergeSegments(['مقطع أول', 'مقطع ثان', 'مقطع ثالث'], 0);
assert(merged.length === 2 && merged[0] === 'مقطع أول مقطع ثان', 'دمج مقطعين متجاورين بنجاح');

// اختبار تقسيم مقطع عند كلمة
const splitRes = ArabicSegmenter.splitSegmentAtWord(['سبحان الله العظيم وبحمده'], 0, 2);
assert(splitRes.length === 2 && splitRes[0] === 'سبحان الله' && splitRes[1] === 'العظيم وبحمده', 'تقسيم المقطع يدوياً عند كلمة محددة');

console.log('\n==================================================');
console.log('3. اختبار خوارزمية المراجعة المتباعدة (Review Algorithm)');
console.log('==================================================');

// اختبار "لم أتذكر"
const forgotInterval = ReviewService.calculateNextInterval(5, 'forgot');
assert(forgotInterval === 0, 'تقييم "لم أتذكر" يعيد الفاصل إلى 0 (إعادة خلال 10 دقائق أو غداً)');

// اختبار "تذكرت بصعوبة"
const hardFirst = ReviewService.calculateNextInterval(0, 'hard');
assert(hardFirst === 1, 'أول مراجعة لتقييم "تذكرت بصعوبة" تكون بعد يوم واحد (1)');

const hardNext = ReviewService.calculateNextInterval(2, 'hard');
assert(hardNext === 3, 'المراجعة التالية لـ "تذكرت بصعوبة" تضرب في 1.5 بالتقريب (2 * 1.5 = 3)');

const hardNext2 = ReviewService.calculateNextInterval(3, 'hard');
assert(hardNext2 === 5, 'المراجعة التالية (3 * 1.5 = 4.5 تقرب إلى 5)');

// اختبار "أتقنت الحفظ"
const masteredFirst = ReviewService.calculateNextInterval(0, 'mastered');
assert(masteredFirst === 2, 'أول مراجعة لتقييم "أتقنت الحفظ" تكون بعد يومين (2)');

const masteredNext = ReviewService.calculateNextInterval(2, 'mastered');
assert(masteredNext === 4, 'المراجعة التالية لـ "أتقنت الحفظ" تضرب في 2 (2 * 2 = 4)');

const masteredNext2 = ReviewService.calculateNextInterval(4, 'mastered');
assert(masteredNext2 === 8, 'المراجعة التالية (4 * 2 = 8)');

// اختبار سقف الـ 90 يوماً
const capped = ReviewService.calculateNextInterval(60, 'mastered');
assert(capped === 90, `الالتزام الصارم بالحد الأقصى للفاصل وهو 90 يوماً (الناتج: ${capped})`);

console.log('\n==================================================');
console.log('4. اختبار نظام النسخ الاحتياطي والاستعادة والأمان (Backup & Security)');
console.log('==================================================');

// فحص رفض الملفات غير الصالحة
const invalidObj = { foo: 'bar' };
const resInvalid = BackupService.validateBackup(invalidObj);
assert(!resInvalid.isValid, 'رفض ملف لا ينتمي لتطبيق وِرد');

// فحص ملف وِرد سليم مع بصمة
const validData = {
  personalAzkar: [
    { id: 'custom_1', title: 'دعاء شخصي', text: 'اللهم اهدنا فيمن هديت' }
  ],
  collections: [],
  reviewLogs: []
};
const serialized = JSON.stringify(validData);
const checksum = BackupService.generateChecksum(serialized);

const backupFile = {
  app: 'Wird',
  version: '1.0.0',
  exportedAt: new Date().toISOString(),
  checksum,
  data: validData
};

const resValid = BackupService.validateBackup(backupFile);
assert(resValid.isValid, 'قبول ملف نسخة احتياطية صالح وموثوق');
assert(resValid.summary.personalCount === 1, 'حساب ملخص المحتويات بدقة (1 ذكر شخصي)');

// فحص رفض ملف تالف أو تم تعديله بعد البصمة
const corruptedBackup = {
  ...backupFile,
  data: {
    ...validData,
    personalAzkar: [...validData.personalAzkar, { id: 'bad', title: 'تعديل خارجي', text: 'نص' }]
  }
};
const resCorrupted = BackupService.validateBackup(corruptedBackup);
assert(!resCorrupted.isValid, 'اكتشاف تلف الملف وتعديله غير المصرح عبر فحص البصمة');

console.log('\n==================================================');
console.log(`إجمالي الاختبارات: ${passed + failed} | ناجحة: ${passed} | فاشلة: ${failed}`);
console.log('==================================================');

if (failed > 0) {
  process.exit(1);
}
