/**
 * تطبيق وِرد | Wird
 * محرك تقسيم النصوص العربية للأذكار والأدعية
 * 
 * الميزات:
 * 1. الحفاظ الصارم على تشكيل الحروف وعلامات الإعراب وعدم فصل الحرف عن تشكيله.
 * 2. التقسيم الذكي بالاعتماد على علامات الترقيم (، ؛ . ! ؟ - :) وعطف الجمل.
 * 3. الموازنة بين طول المقاطع (تجنب المقاطع القصيرة جداً والمقاطع الطويلة المجهدة).
 * 4. دعم التعديل اليدوي (دمج مقطعين، تقسيم مقطع).
 * 5. اكتشاف تعديل النص لتنبيه المستخدم بمراجعة المقاطع السابقة.
 */

// نطاق التشكيل والرموز القرآنية في اليونيكود
const ARABIC_DIACRITICS_REGEX = /[\u064B-\u065F\u0670\u06D6-\u06ED]/g;

export class ArabicSegmenter {
  /**
   * إزالة التشكيل للبحث أو المقارنة
   */
  static stripTashkeel(text) {
    if (!text) return '';
    return text.replace(ARABIC_DIACRITICS_REGEX, '').trim();
  }

  /**
   * حساب بصمة خفيفة للنص لاكتشاف التغييرات
   */
  static computeTextHash(text) {
    if (!text) return '0';
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0; // تحويل إلى 32-bit int
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * عد الكلمات في نص عربي مع مراعاة التشكيل
   */
  static countWords(text) {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(Boolean).length;
  }

  /**
   * تقسيم النص العربي تلقائياً إلى مقاطع متوازنة للحفظ
   * @param {string} text النص العربي مع التشكيل
   * @returns {string[]} مصفوفة المقاطع
   */
  static segmentText(text) {
    if (!text || typeof text !== 'string') return [];

    const cleaned = text.trim();
    if (!cleaned) return [];

    // الخطوة 1: التقسيم الأولي بناءً على علامات الترقيم الرئيسية وفواصل الآيات
    // نحتفظ بعلامات الترقيم مع المقاطع
    const rawChunks = cleaned
      .split(/(?<=[،؛.!?:\n۝])\s+/)
      .map(c => c.trim())
      .filter(Boolean);

    let balancedSegments = [];

    for (let chunk of rawChunks) {
      const wordCount = this.countWords(chunk);

      // إذا كان المقطع طويلاً جداً (أكثر من 10 كلمات)، نقسمه عند حروف العطف المناسبة
      if (wordCount > 10) {
        const subChunks = this._splitLongChunk(chunk);
        balancedSegments.push(...subChunks);
      } else {
        balancedSegments.push(chunk);
      }
    }

    // الخطوة 2: دمج المقاطع القصيرة جداً (أقل من كلمتين) مع المقطع اللاحق أو السابق
    let finalSegments = [];
    let buffer = '';

    for (let i = 0; i < balancedSegments.length; i++) {
      const seg = balancedSegments[i];
      const combined = buffer ? (buffer + ' ' + seg) : seg;
      const combinedWords = this.countWords(combined);

      // إذا كان المقطع الحالي أو المدمج صغيراً جداً وما زال هناك مقاطع تالية
      if (this.countWords(seg) <= 2 && i < balancedSegments.length - 1 && combinedWords <= 10) {
        buffer = combined;
      } else if (buffer && combinedWords <= 12) {
        finalSegments.push(combined);
        buffer = '';
      } else {
        if (buffer) {
          finalSegments.push(buffer);
          buffer = '';
        }
        finalSegments.push(seg);
      }
    }

    if (buffer) {
      if (finalSegments.length > 0 && this.countWords(buffer) <= 2) {
        finalSegments[finalSegments.length - 1] += ' ' + buffer;
      } else {
        finalSegments.push(buffer);
      }
    }

    return finalSegments.filter(s => s && s.trim().length > 0);
  }

  /**
   * تقسيم مقطع طويل عند حروف العطف أو الفواصل الطبيعية دون كسر الكلمات
   */
  static _splitLongChunk(chunk) {
    const words = chunk.split(/\s+/).filter(Boolean);
    if (words.length <= 10) return [chunk];

    const result = [];
    let currentWords = [];

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      currentWords.push(word);

      // حروف العطف أو الوصل التي يصح الوقوف قبلها: و، ف، ثم، أو
      const plainWord = this.stripTashkeel(word);
      const isConjunctionNext = i + 1 < words.length && (
        this.stripTashkeel(words[i + 1]).startsWith('و') ||
        this.stripTashkeel(words[i + 1]).startsWith('ف') ||
        this.stripTashkeel(words[i + 1]) === 'ثم' ||
        this.stripTashkeel(words[i + 1]) === 'أو'
      );

      if (currentWords.length >= 6 && (isConjunctionNext || currentWords.length >= 9)) {
        result.push(currentWords.join(' '));
        currentWords = [];
      }
    }

    if (currentWords.length > 0) {
      if (result.length > 0 && currentWords.length <= 2) {
        result[result.length - 1] += ' ' + currentWords.join(' ');
      } else {
        result.push(currentWords.join(' '));
      }
    }

    return result;
  }

  /**
   * دمج مقطعين متجاورين
   */
  static mergeSegments(segments, firstIndex) {
    if (!segments || firstIndex < 0 || firstIndex >= segments.length - 1) {
      return [...segments];
    }
    const newSegments = [...segments];
    const merged = newSegments[firstIndex] + ' ' + newSegments[firstIndex + 1];
    newSegments.splice(firstIndex, 2, merged);
    return newSegments;
  }

  /**
   * تقسيم مقطع يدوي عند كلمة معينة
   */
  static splitSegmentAtWord(segments, segmentIndex, wordIndex) {
    if (!segments || segmentIndex < 0 || segmentIndex >= segments.length) {
      return [...segments];
    }
    const targetSegment = segments[segmentIndex];
    const words = targetSegment.split(/\s+/).filter(Boolean);

    if (wordIndex <= 0 || wordIndex >= words.length) {
      return [...segments];
    }

    const part1 = words.slice(0, wordIndex).join(' ');
    const part2 = words.slice(wordIndex).join(' ');

    const newSegments = [...segments];
    newSegments.splice(segmentIndex, 1, part1, part2);
    return newSegments;
  }
}
