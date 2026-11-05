// ai_assistant.js - Personal Gemini-powered learning-plan generation.
// The API key is stored separately from LearningStore, so it is never included in data exports.
(function (window) {
  'use strict';

  const KEY_STORAGE = 'my_learning_hub_gemini_key_v1';
  const USAGE_STORAGE = 'my_learning_hub_gemini_usage_v1';
  const MODEL_STORAGE = 'my_learning_hub_gemini_model_v1';
  const DEFAULT_MODEL = 'gemini-3.8-flash';
  const MODEL_SUGGESTIONS = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-flash-latest'];
  // Thinking tokens count toward the output limit, so keep this generous or JSON gets cut off.
  const MAX_OUTPUT_TOKENS = 16384;
  const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta/models/';
  const MAX_PLAN_STAGES = 10;
  const MAX_TASKS_PER_STAGE = 10;

  const TASK_SCHEMA = {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'عنوان مهمة عملية قصيرة وواضحة بالعربية' },
      description: { type: 'string', description: 'شرح مختصر لناتج المهمة أو خطواتها بالعربية' },
      priority: { type: 'string', enum: ['urgent', 'high', 'medium', 'low'] },
      estimatedHours: { type: 'number', description: 'عدد ساعات واقعي لتنفيذ المهمة' },
      dueDate: { type: 'string', description: 'تاريخ مستهدف بصيغة YYYY-MM-DD أو سلسلة فارغة' }
    },
    required: ['title', 'description', 'priority', 'estimatedHours', 'dueDate']
  };

  const STAGE_SCHEMA = {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'اسم مرحلة تعليمية بالعربية' },
      description: { type: 'string', description: 'الهدف من المرحلة ومعيار إتمامها بالعربية' },
      tasks: { type: 'array', items: TASK_SCHEMA }
    },
    required: ['title', 'description', 'tasks']
  };

  // The REST API documents upper-case OpenAPI types for responseSchema (OBJECT, STRING...).
  function toRestSchema(node) {
    if (Array.isArray(node)) return node.map(toRestSchema);
    if (!node || typeof node !== 'object') return node;
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      out[k] = (k === 'type' && typeof v === 'string') ? v.toUpperCase() : toRestSchema(v);
    }
    return out;
  }

  const PLAN_SCHEMA = {
    type: 'object',
    properties: {
      domainName: { type: 'string', description: 'اسم المجال أو المهارة باللغة العربية' },
      description: { type: 'string', description: 'وصف موجز للمجال باللغة العربية' },
      targetGoal: { type: 'string', description: 'النتيجة النهائية القابلة للتحقق باللغة العربية' },
      currentLevel: { type: 'string', description: 'مستوى المتعلم الحالي باللغة العربية' },
      targetLevel: { type: 'string', description: 'المستوى المراد الوصول إليه باللغة العربية' },
      targetDate: { type: 'string', description: 'الموعد المستهدف بصيغة YYYY-MM-DD أو سلسلة فارغة' },
      stages: { type: 'array', items: STAGE_SCHEMA }
    },
    required: ['domainName', 'description', 'targetGoal', 'currentLevel', 'targetLevel', 'targetDate', 'stages']
  };
  const REST_PLAN_SCHEMA = toRestSchema(PLAN_SCHEMA);

  function localDate() {
    const d = new Date();
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
  }

  function getUsage() {
    try {
      const raw = JSON.parse(localStorage.getItem(USAGE_STORAGE) || 'null');
      if (!raw || raw.date !== localDate() || !Number.isFinite(Number(raw.requests))) {
        return { date: localDate(), requests: 0 };
      }
      return { date: raw.date, requests: Math.max(0, Number(raw.requests)) };
    } catch (_) {
      return { date: localDate(), requests: 0 };
    }
  }

  function recordRequest() {
    const next = getUsage();
    next.requests += 1;
    try { localStorage.setItem(USAGE_STORAGE, JSON.stringify(next)); } catch (_) { /* Counter is best-effort only. */ }
    return next;
  }

  function cleanText(value, maxLength, fallback = '') {
    return String(value == null ? fallback : value).replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, maxLength);
  }

  function normalizePlan(raw, inputs) {
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.stages)) {
      throw new Error('أعاد Gemini نتيجة غير مكتملة. حاول إنشاء الخطة مرة أخرى.');
    }
    const stages = raw.stages.slice(0, MAX_PLAN_STAGES).map((stage, index) => {
      const tasks = Array.isArray(stage.tasks) ? stage.tasks.slice(0, MAX_TASKS_PER_STAGE) : [];
      return {
        title: cleanText(stage.title, 140, `المرحلة ${index + 1}`),
        description: cleanText(stage.description, 800),
        tasks: tasks.map((task, taskIndex) => {
          const priority = ['urgent', 'high', 'medium', 'low'].includes(task.priority) ? task.priority : 'medium';
          const hours = Number(task.estimatedHours);
          const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(String(task.dueDate || '')) ? task.dueDate : '';
          return {
            title: cleanText(task.title, 160, `مهمة ${taskIndex + 1}`),
            description: cleanText(task.description, 800),
            priority,
            estimatedHours: Number.isFinite(hours) ? Math.min(40, Math.max(0.25, hours)) : 1,
            dueDate
          };
        })
      };
    });
    if (!stages.length || !stages.some(stage => stage.tasks.length)) {
      throw new Error('الخطة المولدة لا تحتوي على مهام. أعد المحاولة مع هدف أكثر تحديدًا.');
    }
    return {
      domainName: cleanText(raw.domainName, 120, inputs.goal),
      description: cleanText(raw.description, 800, `خطة تعلم مولدة لهدف: ${inputs.goal}`),
      targetGoal: cleanText(raw.targetGoal, 1000, inputs.goal),
      currentLevel: cleanText(raw.currentLevel, 80, inputs.currentLevel),
      targetLevel: cleanText(raw.targetLevel, 80, inputs.targetLevel || 'متقدم'),
      targetDate: /^\d{4}-\d{2}-\d{2}$/.test(String(inputs.targetDate || '')) ? inputs.targetDate : '',
      stages
    };
  }

  function makePrompt(inputs) {
    return [
      'أنت مدرب تعلّم شخصي. أنشئ خطة تعلّم واقعية باللغة العربية فقط، مقسمة إلى مراحل ثم مهام قابلة للتنفيذ والقياس.',
      'أعد JSON مطابقًا تمامًا للمخطط المحدد. لا تضف Markdown ولا نصًا خارج JSON.',
      'اجعل الخطة مناسبة لمستوى المتعلم والوقت المتاح، مرتبة من الأساسيات إلى التطبيق، وتجنب الحشو والوعود غير الواقعية.',
      'أنشئ من 3 إلى 7 مراحل، وفي كل مرحلة من 2 إلى 5 مهام. اجعل كل مهمة محددة بناتج واضح، وقدر ساعاتها بشكل معقول.',
      'استخدم الأولوية urgent أو high أو medium أو low. إذا كان تاريخ الانتهاء موجودًا، وزع التواريخ تدريجيًا حتى الموعد؛ وإلا فاجعل targetDate وdueDate سلاسل فارغة.',
      'بيانات المتعلم:',
      `الهدف/المهارة: ${inputs.goal}`,
      `المستوى الحالي: ${inputs.currentLevel}`,
      `المستوى المستهدف: ${inputs.targetLevel || 'يقترحه المدرب بما يناسب الهدف'}`,
      `الوقت المتاح أسبوعيًا: ${inputs.hoursPerWeek} ساعة تقريبًا`,
      `أيام الدراسة أسبوعيًا: ${inputs.daysPerWeek} أيام`,
      `الموعد المستهدف: ${inputs.targetDate || 'غير محدد'}`,
      `تاريخ اليوم: ${localDate()}`,
      inputs.context ? `معلومات إضافية أو تفضيلات: ${inputs.context}` : ''
    ].filter(Boolean).join('\n');
  }

  function explainApiError(status, message) {
    const detail = cleanText(message, 300);
    const tail = detail ? ` (${detail})` : '';
    if (status === 400) return 'رفض Gemini الطلب.' + tail;
    if (status === 401 || status === 403) return 'مفتاح Gemini غير صالح أو لا يملك صلاحية استخدام API. راجع المفتاح وقيوده في Google AI Studio.' + tail;
    if (status === 404) return 'النموذج المحدد غير متاح لهذا المفتاح. غيّر اسم النموذج من الإعدادات.' + tail;
    if (status === 429) return 'وصل الحساب إلى حد الاستخدام أو توجد طلبات كثيرة. انتظر قليلًا ثم أعد المحاولة.' + tail;
    if (status >= 500) return 'خدمة Gemini غير متاحة مؤقتًا. حاول مرة أخرى لاحقًا.' + tail;
    return 'تعذر الاتصال بـ Gemini.' + tail;
  }

  function getModel() {
    try {
      const saved = localStorage.getItem(MODEL_STORAGE);
      if (saved && /^[a-z0-9][a-z0-9._-]{2,60}$/i.test(saved)) return saved;
    } catch (_) { /* default */ }
    return DEFAULT_MODEL;
  }

  // Extracts JSON even if the model wrapped it in a code fence or added stray text.
  function parseJsonText(text) {
    const cleaned = String(text).replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    try { return JSON.parse(cleaned); } catch (_) { /* try to locate the object */ }
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error('not json');
  }

  // Low-level call. Returns { ok, status, payload } or throws a user-facing Error for network problems.
  async function callGemini(key, model, body, timeoutMs) {
    try {
      const response = await fetch(`${API_ROOT}${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(body),
        signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(timeoutMs) : undefined
      });
      let payload;
      try { payload = await response.json(); } catch (_) { payload = {}; }
      return { ok: response.ok, status: response.status, payload };
    } catch (error) {
      if (error && (error.name === 'TimeoutError' || error.name === 'AbortError')) throw new Error('استغرق الرد وقتًا طويلًا. حاول مرة أخرى.');
      throw new Error('تعذر الوصول إلى Gemini. تحقق من اتصال الإنترنت (أو من قيود المفتاح على النطاق) وحاول مرة أخرى.');
    }
  }

  function readText(payload) {
    const cand = payload && payload.candidates && payload.candidates[0];
    const parts = cand && cand.content && cand.content.parts;
    return Array.isArray(parts) ? parts.map(part => (part && !part.thought && part.text) || '').join('').trim() : '';
  }

  const GeminiAssistant = {
    get model() { return getModel(); },
    modelSuggestions: MODEL_SUGGESTIONS,
    defaultModel: DEFAULT_MODEL,
    hasKey() {
      try { return !!localStorage.getItem(KEY_STORAGE); } catch (_) { return false; }
    },
    saveKey(value) {
      const key = cleanText(value, 300);
      if (key.length < 10) throw new Error('أدخل مفتاح Gemini API صحيحًا.');
      localStorage.setItem(KEY_STORAGE, key);
    },
    removeKey() {
      try { localStorage.removeItem(KEY_STORAGE); } catch (_) { /* no-op */ }
    },
    saveModel(value) {
      const name = cleanText(value, 60).replace(/^models\//, '');
      if (!name) { try { localStorage.removeItem(MODEL_STORAGE); } catch (_) { /* no-op */ } return DEFAULT_MODEL; }
      if (!/^[a-z0-9][a-z0-9._-]{2,60}$/i.test(name)) throw new Error('اسم النموذج غير صالح. مثال: gemini-3.8-flash');
      localStorage.setItem(MODEL_STORAGE, name);
      return name;
    },
    getUsage,
    validatePlan(raw, inputs) { return normalizePlan(raw, inputs); },
    parseJsonText,

    // Sends a tiny request so a wrong key / model / restriction shows its real error immediately.
    async testConnection() {
      let key = '';
      try { key = localStorage.getItem(KEY_STORAGE) || ''; } catch (_) { /* handled below */ }
      if (!key) throw new Error('أضف مفتاح Gemini API أولًا.');
      const res = await callGemini(key, getModel(), {
        contents: [{ parts: [{ text: 'رد بكلمة واحدة: جاهز' }] }],
        generationConfig: { maxOutputTokens: 64 }
      }, 20000);
      if (!res.ok) throw new Error(explainApiError(res.status, res.payload && res.payload.error && res.payload.error.message));
      return { model: getModel() };
    },

    async generatePlan(inputs) {
      let key = '';
      try { key = localStorage.getItem(KEY_STORAGE) || ''; } catch (_) { /* handled below */ }
      if (!key) throw new Error('أضف مفتاح Gemini API من صفحة الإعدادات أولًا.');
      const model = getModel();
      const base = { contents: [{ parts: [{ text: makePrompt(inputs) }] }] };
      // Most strict first; if the API rejects a field (400) we retry with a simpler request.
      const attempts = [
        { ...base, generationConfig: { temperature: 0.55, maxOutputTokens: MAX_OUTPUT_TOKENS, responseMimeType: 'application/json', responseSchema: REST_PLAN_SCHEMA } },
        { ...base, generationConfig: { temperature: 0.55, maxOutputTokens: MAX_OUTPUT_TOKENS, responseMimeType: 'application/json' } },
        { ...base, generationConfig: { temperature: 0.55, maxOutputTokens: MAX_OUTPUT_TOKENS } }
      ];

      let res;
      for (let i = 0; i < attempts.length; i++) {
        recordRequest();
        res = await callGemini(key, model, attempts[i], 90000);
        if (res.ok || res.status !== 400) break;
      }
      if (!res.ok) {
        throw new Error(explainApiError(res.status, res.payload && res.payload.error && res.payload.error.message));
      }

      const payload = res.payload || {};
      const cand = payload.candidates && payload.candidates[0];
      const text = readText(payload);
      if (!text) {
        const block = payload.promptFeedback && payload.promptFeedback.blockReason;
        if (block) throw new Error(`حجب Gemini الطلب (${block}). عدّل صياغة الهدف وحاول مجددًا.`);
        if (cand && cand.finishReason === 'MAX_TOKENS') throw new Error('انتهت حصة الرد قبل اكتمال الخطة. جرّب هدفًا أقصر.');
        throw new Error('لم يرجع Gemini خطة نصية' + (cand && cand.finishReason ? ` (${cand.finishReason})` : '') + '. أعد المحاولة.');
      }
      let parsed;
      try { parsed = parseJsonText(text); } catch (_) {
        if (cand && cand.finishReason === 'MAX_TOKENS') throw new Error('انقطع رد Gemini قبل اكتمال الخطة. جرّب هدفًا أقصر أو أعد المحاولة.');
        throw new Error('تعذر قراءة JSON الذي أعاده Gemini. أعد المحاولة.');
      }
      return normalizePlan(parsed, inputs);
    }
  };

  window.GeminiAssistant = GeminiAssistant;
})(window);
