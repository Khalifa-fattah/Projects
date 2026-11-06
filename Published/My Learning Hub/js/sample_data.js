// sample_data.js - Mock initial data for My Learning Journey
const INITIAL_DATA = {
  version: "1.0.0",
  lastUpdated: new Date().toISOString(),
  settings: {
    theme: "light", // 'light' or 'dark'
    userName: "متعلم طموح",
    studyHoursTracked: 42.5
  },
  domains: [
    {
      id: "domain-web-dev",
      name: "تطوير الويب الشامل (Full Stack)",
      icon: "code",
      color: "#3B82F6", // Blue
      description: "إتقان تقنيات الويب الحديثة من الواجهات الأمامية وصولاً للخوادم وقواعد البيانات وتطوير التطبيقات المتكاملة.",
      targetGoal: "بناء تطبيقات ويب متكاملة، ونشر مشاريع تجارية قابلة للتوسع والعمل كمطور مستقل أو بشركة برمجية.",
      startDate: "2026-01-10",
      targetDate: "2026-12-31",
      currentLevel: "متوسط",
      targetLevel: "متقدم / محترف",
      status: "active", // 'active', 'paused', 'completed'
      createdAt: "2026-01-10T10:00:00.000Z",
      stages: [
        {
          id: "stage-html-css",
          title: "1. أساسيات HTML5 و CSS3 المتقدمة",
          description: "بناء الهياكل المعيارية وتصميم الواجهات المتجاوبة مع Flexbox و Grid وتقنيات CSS الحديثة.",
          status: "completed",
          tasks: [
            {
              id: "task-html-1",
              title: "دراسة العناصر الدلالية Semantic HTML و Accessibility",
              description: "فهم بنية المستند المعياري ودعم قارئات الشاشة ومبادئ إمكانية الوصول.",
              priority: "high",
              status: "completed",
              dueDate: "2026-01-20",
              estimatedHours: 6,
              completedAt: "2026-01-19T14:30:00.000Z",
              notes: "تم استيعاب الوسوم الرئيسية وفحص إمكانية الوصول باستخدام Lighthouse.",
              links: ["https://developer.mozilla.org/ar/docs/Web/HTML"]
            },
            {
              id: "task-css-2",
              title: "إتقان تخطيط CSS Grid و Flexbox المتجاوب",
              description: "تصميم قوالب مواقع متجاوبة بدون استخدام أطر عمل خارجية.",
              priority: "high",
              status: "completed",
              dueDate: "2026-02-05",
              estimatedHours: 10,
              completedAt: "2026-02-04T18:15:00.000Z",
              notes: "تم بناء 3 تصاميم متجاوبة وتجربتها على الموبايل.",
              links: ["https://css-tricks.com/snippets/css/a-guide-to-flexbox/"]
            }
          ]
        },
        {
          id: "stage-js",
          title: "2. لغة JavaScript وتطوير التفاعل (ES6+)",
          description: "فهم أسرار الجافاسكريبت، الـ DOM، الـ Promises، والـ Async/Await وتطبيق برمجيات كائنية التوجه.",
          status: "in-progress",
          tasks: [
            {
              id: "task-js-1",
              title: "دراسة مفهوم الـ Scope والـ Closures والـ Event Loop",
              description: "التعمق في كيفية عمل محرك الجافاسكريبت والتعامل مع العمليات غير المتزامنة.",
              priority: "high",
              status: "completed",
              dueDate: "2026-02-25",
              estimatedHours: 12,
              completedAt: "2026-02-24T20:00:00.000Z",
              notes: "الـ Event Loop أصبح مفهوماً تماماً بعد رسم المخططات الذهنية.",
              links: ["https://javascript.info/"]
            },
            {
              id: "task-js-2",
              title: "التعامل مع الـ REST APIs و Fetch والـ Error Handling",
              description: "ربط واجهة المستخدم مع خوادم خارجية وجلب وعرض البيانات والتعامل مع أخطاء الشبكة.",
              priority: "urgent",
              status: "in-progress",
              dueDate: "2026-11-10",
              estimatedHours: 8,
              notes: "التركيز على معالجة حالات الخطأ وحالات التحميل loading spinners.",
              links: ["https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API"]
            },
            {
              id: "task-js-3",
              title: "بناء تطبيقات معيارية باستخدام ES Modules و LocalStorage",
              description: "هيكلة الكود في ملفات منفصلة وحفظ حالة التطبيق محلياً في المتصفح.",
              priority: "medium",
              status: "todo",
              dueDate: "2026-11-15",
              estimatedHours: 6,
              notes: "تحضير لمشروع لوحة المهام التعليمية.",
              links: []
            }
          ]
        },
        {
          id: "stage-frontend-framework",
          title: "3. أطر الواجهات الحديثة وتطوير المكونات",
          description: "إتقان بناء مكونات واجهة المستخدم التفاعلية وإدارة الحالة العامة للواجهة.",
          status: "todo",
          tasks: [
            {
              id: "task-fw-1",
              title: "تعلم المفاهيم الأساسية لإدارة الحالة والـ Component Lifecycle",
              description: "فهم تدفق البيانات في اتجاه واحد ومشاركة الحالة بين المكونات.",
              priority: "medium",
              status: "todo",
              dueDate: "2026-11-30",
              estimatedHours: 15,
              notes: "",
              links: []
            }
          ]
        },
        {
          id: "stage-backend-api",
          title: "4. تطوير الخدمات الخلفية وقواعد البيانات",
          description: "بناء RESTful APIs آمنة وقواعد بيانات علائقية وسحابية مع توثيق المستخدمين.",
          status: "todo",
          tasks: [
            {
              id: "task-be-1",
              title: "تصميم وتطوير خادم REST API مع نظام التوثيق JWT",
              description: "بناء بنية خادم آمنة مع التحقق من صحة المدخلات والتشفير.",
              priority: "medium",
              status: "todo",
              dueDate: "2026-12-20",
              estimatedHours: 20,
              notes: "",
              links: []
            }
          ]
        }
      ],
      resources: [
        {
          id: "res-1",
          title: "دليل JavaScript المعاصر (JavaScript.info)",
          url: "https://javascript.info/",
          type: "website", // 'youtube', 'course', 'book', 'website', 'article', 'other'
          description: "أشمل وأقوى مرجع تفاعلي لتعلم الجافاسكريبت الحديثة من الصفر حتى الاحتراف."
        },
        {
          id: "res-2",
          title: "توثيق شبكة مطوري موزيلا MDN Web Docs",
          url: "https://developer.mozilla.org/",
          type: "website",
          description: "المرجع القياسي لكافة واجهات برمجة المتصفح وخصائص CSS و HTML."
        },
        {
          id: "res-3",
          title: "كتاب You Don't Know JS Yet",
          url: "https://github.com/getify/You-Dont-Know-JS",
          type: "book",
          description: "سلسلة كتب شهيرة للتعمق في خبايا لغة الجافاسكريبت وسلوكياتها الدقيقة."
        }
      ],
      projects: [
        {
          id: "proj-1",
          title: "منصة إدارة رحلة التعلم (My Learning Journey)",
          description: "لوحة تحكم تفاعلية لإدارة خطط التعلم ومتابعة التقدم والمهام اليومية مع تخزين محلي كامل.",
          skills: "HTML5, CSS3 Modern Flex/Grid, Vanilla JS ES6+, LocalStorage, SVG Charts",
          tasksNeeded: "تصميم واجهة المستخدم، هندسة تخزين البيانات، ربط الإحصائيات، فلاتر البحث، ودعم الوضع الداكن.",
          status: "in-progress", // 'planned', 'in-progress', 'completed'
          liveUrl: "",
          repoUrl: ""
        },
        {
          id: "proj-2",
          title: "متجر إلكتروني مصغر مع سلة تسوق حية",
          description: "تطبيق ويب تفاعلي يعرض منتجات مع فلترة وبحث وإضافة إلى سلة مشتريات ديناميكية.",
          skills: "Async JavaScript, Fetch API, DOM Manipulation, CSS Variables",
          tasksNeeded: "جلب المنتجات من Mock API، حساب الإجمالي والضرائب، محاكاة الدفع.",
          status: "completed",
          liveUrl: "https://example.com/demo-store",
          repoUrl: "https://github.com/example/demo-store"
        }
      ],
      notes: [
        {
          id: "note-1",
          title: "ملاحظات حول أداء الـ Web Vitals",
          content: "يجب دائماً مراعاة تقليل حجم الصور، وتجنب الـ Layout Shifts عن طريق حجز أبعاد ثابتة للوسائط، واستخدام الـ Defer والـ Async للسكربتات.",
          updatedAt: "2026-02-15"
        },
        {
          id: "note-2",
          title: "نصائح تنظيم ملفات مشاريع الواجهات",
          content: "فصل التنسيقات عن المنطق، واستخدام نمط الـ MVC أو فصل الـ Services والـ State Store يسهل صيانة وتوسيع المشروع لاحقاً دون فوضى.",
          updatedAt: "2026-03-01"
        }
      ]
    },
    {
      id: "domain-data-science",
      name: "علم البيانات والذكاء الاصطناعي (Data Science & AI)",
      icon: "chart",
      color: "#10B981", // Emerald
      description: "اكتساب مهارات تحليل واستكشاف البيانات وبناء نماذج تعلم الآلة وتطبيقات الذكاء الاصطناعي التوليدي.",
      targetGoal: "القدرة على تنظيف وتحليل مجموعات البيانات الضخمة، وبناء حلول ذكية تدعم اتخاذ القرارات.",
      startDate: "2026-03-01",
      targetDate: "2026-11-30",
      currentLevel: "مبتدئ",
      targetLevel: "متوسط إلى متقدم",
      status: "active",
      createdAt: "2026-03-01T09:00:00.000Z",
      stages: [
        {
          id: "stage-python-math",
          title: "1. بايثون لتحليل البيانات والرياضيات التطبيقية",
          description: "إتقان لغة بايثون ومكتبات معالجة الأرقام والإحصاء الوصفي.",
          status: "completed",
          tasks: [
            {
              id: "task-py-1",
              title: "أساسيات لغة Python والهياكل البيانية",
              description: "القوائم، القواميس، المجموعات، والمولدات وكتابة دوال معيارية.",
              priority: "high",
              status: "completed",
              dueDate: "2026-03-15",
              estimatedHours: 14,
              completedAt: "2026-03-14T11:00:00.000Z",
              notes: "تم الانتهاء بنجاح وحل 50 مسألة على منصة LeetCode.",
              links: []
            },
            {
              id: "task-py-2",
              title: "العمل مع مكتبتي NumPy و Pandas",
              description: "معالجة المصفوفات ومجموعات البيانات والتعامل مع القيم المفقودة.",
              priority: "high",
              status: "completed",
              dueDate: "2026-03-30",
              estimatedHours: 18,
              completedAt: "2026-03-29T16:00:00.000Z",
              notes: "تم تطبيق مشاريع تحليلية على بيانات أسعار العقارات.",
              links: []
            }
          ]
        },
        {
          id: "stage-eda-viz",
          title: "2. استكشاف البيانات والتصور البصري (EDA)",
          description: "بناء الرسوم البيانية التفاعلية وفهم الأنماط الكامنة بالبيانات واستخلاص الرؤى.",
          status: "in-progress",
          tasks: [
            {
              id: "task-eda-1",
              title: "تصور البيانات عبر Matplotlib و Seaborn",
              description: "إنشاء المخططات التوزيعية والارتباطية والخرائط الحرارية.",
              priority: "medium",
              status: "in-progress",
              dueDate: "2026-11-12",
              estimatedHours: 10,
              notes: "التركيز على اختيار نوع المخطط المناسب لكل نوع من المتغيرات.",
              links: []
            }
          ]
        },
        {
          id: "stage-machine-learning",
          title: "3. خوارزميات تعلم الآلة الكلاسيكية",
          description: "الانحدار الخطي واللوجستي، أشجار القرار، التجميع والتحقق المتقاطع باستخدام Scikit-Learn.",
          status: "todo",
          tasks: [
            {
              id: "task-ml-1",
              title: "فهم وتقييم نماذج التصنيف والانحدار",
              description: "دراسة مقاييس الدقة ومصفوفة الالتباس وROC-AUC.",
              priority: "high",
              status: "todo",
              dueDate: "2026-12-15",
              estimatedHours: 20,
              notes: "",
              links: []
            }
          ]
        }
      ],
      resources: [
        {
          id: "res-ds-1",
          title: "دورة Machine Learning Specialization لـ Andrew Ng",
          url: "https://www.coursera.org/",
          type: "course",
          description: "أقوى دورة تأسيسية لفهم الخوارزميات الرياضية وراء تعلم الآلة."
        },
        {
          id: "res-ds-2",
          title: "كتاب Hands-On Machine Learning with Scikit-Learn",
          url: "https://www.oreilly.com/",
          type: "book",
          description: "دليل عملي شامل لتطبيق خوارزميات تعلم الآلة باستخدام بايثون."
        }
      ],
      projects: [
        {
          id: "proj-ds-1",
          title: "تحليل وتوقع أسعار السيارات المستعملة",
          description: "تنظيف مجموعة بيانات ضخمة وتطبيق خوارزميات Random Forest لتوقع الأسعار.",
          skills: "Python, Pandas, Scikit-Learn, Streamlit",
          tasksNeeded: "معالجة القيم الشاذة، هندسة الميزات، تدريب واختبار النماذج، بناء واجهة للمستخدم.",
          status: "planned",
          liveUrl: "",
          repoUrl: ""
        }
      ],
      notes: [
        {
          id: "note-ds-1",
          title: "قاعدة ذهبية في تنظيف البيانات",
          content: "80% من جهد عالم البيانات يذهب في تنظيف وفهم البيانات. جودة النموذج تعتمد أساساً على جودة المدخلات (Garbage In, Garbage Out).",
          updatedAt: "2026-03-25"
        }
      ]
    },
    {
      id: "domain-english",
      name: "إتقان التحدث باللغة الإنجليزية للأعمال",
      icon: "languages",
      color: "#8B5CF6", // Purple
      description: "تطوير طلاقة التحدث والمراسلات المهنية بالإنجليزية لبيئة العمل التقنية والدولية.",
      targetGoal: "اجتياز المقابلات الوظيفية العالمية والتواصل بطلاقة وسلاسة في الاجتماعات المهنية.",
      startDate: "2026-02-01",
      targetDate: "2026-08-31",
      currentLevel: "B1 (متوسط)",
      targetLevel: "C1 (متقدم طليق)",
      status: "active",
      createdAt: "2026-02-01T08:00:00.000Z",
      stages: [
        {
          id: "stage-vocab-tech",
          title: "1. المصطلحات التقنية ومراسلات العمل",
          description: "كتابة رسائل البريد الإلكتروني الرسمية وتلخيص التقارير البرمجية بدقة.",
          status: "completed",
          tasks: [
            {
              id: "task-eng-1",
              title: "دراسة قوالب إيميلات العمل والتفاوض",
              description: "حفظ وممارسة 100 تعبير وتعبير اصطلاحي احترافي.",
              priority: "medium",
              status: "completed",
              dueDate: "2026-02-28",
              estimatedHours: 8,
              completedAt: "2026-02-27T17:00:00.000Z",
              notes: "تم تجميع دفتر ملاحظات للمصطلحات واستخدامه فعلياً.",
              links: []
            }
          ]
        },
        {
          id: "stage-speaking-sessions",
          title: "2. المحادثات الصوتية الأسبوعية والمقابلات التقنية",
          description: "ممارسة الحديث الصوتي المباشر يومياً مع متحدثين وزملاء ومحاكاة المقابلات الشخصية.",
          status: "in-progress",
          tasks: [
            {
              id: "task-eng-2",
              title: "جلسة محادثة صوتية أسبوعية مدتها 45 دقيقة",
              description: "نقاش في مواضيع تقنية واقتصادية للتدرب على الارتجال الصوتي.",
              priority: "high",
              status: "in-progress",
              dueDate: "2026-11-08",
              estimatedHours: 1,
              notes: "مراجعة نطق الكلمات الشائعة التي يتم الخلط فيها.",
              links: []
            }
          ]
        }
      ],
      resources: [
        {
          id: "res-eng-1",
          title: "بودكاست 6 Minute English - BBC",
          url: "https://www.bbc.co.uk/learningenglish/",
          type: "youtube",
          description: "حلقات قصيرة وممتعة لزيادة الحصيلة اللغوية وفهم اللهجات المختلفة."
        }
      ],
      projects: [
        {
          id: "proj-eng-1",
          title: "عرض تقديمي بالإنجليزية لمدة 10 دقائق عن مشروع تقني",
          description: "تسجيل مقطع فيديو أشرح فيه بنية تطبيق ويب بالكامل باللغة الإنجليزية وتقييم الطلاقة.",
          skills: "Technical Presentation, Fluency, Pronunciation",
          tasksNeeded: "كتابة الـ Script، التدرب على الإلقاء، تسجيل الفيديو، مراجعة الأخطاء.",
          status: "planned",
          liveUrl: "",
          repoUrl: ""
        }
      ],
      notes: []
    }
  ],
  // Daily scheduled tasks: references to domain tasks or custom day items
  dailyTasks: [
    {
      id: "daily-1",
      domainId: "domain-web-dev",
      stageId: "stage-js",
      taskId: "task-js-2", // Links to the actual task
      title: "التعامل مع الـ REST APIs و Fetch والـ Error Handling",
      domainName: "تطوير الويب الشامل (Full Stack)",
      domainColor: "#3B82F6",
      priority: "urgent",
      estimatedHours: 3,
      date: "2026-11-04",
      completed: false,
      notes: "إكمال جزء الـ Async/Await وتجربة حالات الخطأ 404 و 500."
    },
    {
      id: "daily-2",
      domainId: "domain-data-science",
      stageId: "stage-eda-viz",
      taskId: "task-eda-1",
      title: "تصور البيانات عبر Matplotlib و Seaborn",
      domainName: "علم البيانات والذكاء الاصطناعي (Data Science & AI)",
      domainColor: "#10B981",
      priority: "medium",
      estimatedHours: 2,
      date: "2026-11-04",
      completed: false,
      notes: "إنشاء رسوم بيانية وتجربة لوحات ألوان ملائمة."
    },
    {
      id: "daily-3",
      domainId: null, // Standalone daily task
      stageId: null,
      taskId: null,
      title: "قراءة فصل من كتاب Clean Code لمدة 30 دقيقة",
      domainName: "تطوير عام",
      domainColor: "#F59E0B",
      priority: "low",
      estimatedHours: 0.5,
      date: "2026-11-04",
      completed: true,
      notes: "التركيز على تسمية المتغيرات والدوال بشكل واضح ومفهوم."
    }
  ],
  activityLog: [
    {
      id: "act-1",
      type: "task_completed",
      domainId: "domain-web-dev",
      domainName: "تطوير الويب الشامل (Full Stack)",
      title: "دراسة مفهوم الـ Scope والـ Closures والـ Event Loop",
      timestamp: "2026-02-24T20:00:00.000Z"
    },
    {
      id: "act-2",
      type: "stage_completed",
      domainId: "domain-data-science",
      domainName: "علم البيانات والذكاء الاصطناعي (Data Science & AI)",
      title: "1. بايثون لتحليل البيانات والرياضيات التطبيقية",
      timestamp: "2026-03-29T16:00:00.000Z"
    },
    {
      id: "act-3",
      type: "task_completed",
      domainId: "domain-english",
      domainName: "إتقان التحدث باللغة الإنجليزية للأعمال",
      title: "دراسة قوالب إيميلات العمل والتفاوض",
      timestamp: "2026-02-27T17:00:00.000Z"
    }
  ]
};
