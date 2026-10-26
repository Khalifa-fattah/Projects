/**
 * Link Hub - Advanced Hierarchical Link & Website Manager
 * Enhanced Version with Drag & Drop, Tags, Pinning, Sorting, Undo, and Context Menu
 */

const STORAGE_KEY = 'user_structured_links_v2';
const THEME_KEY = 'user_theme_preference';
const FAVICON_CACHE_KEY = 'cached_favicons_v2';

// Initial sample data showing the 3-level structure with YouTube preview & tags
const INITIAL_DATA = [
    {
        id: 'cat-media',
        name: 'شروحات ومقاطع فيديو',
        services: [
            {
                id: 'srv-youtube',
                name: 'YouTube',
                isPinned: true,
                links: [
                    {
                        id: 'lnk-yt-1',
                        title: 'كورس تعلم JavaScript للمبتدئين في ساعة واحدة',
                        url: 'https://www.youtube.com/watch?v=W6NZfCO5SIk',
                        notes: 'مرجع سريع للأساسيات ودوال اللغة الحديثة',
                        tags: ['برمجة', 'شروحات', 'مهم'],
                        isPinned: true,
                        createdAt: Date.now() - 86400000 * 2,
                        isYouTube: true,
                        ytVideoId: 'W6NZfCO5SIk',
                        ytThumbnail: 'https://img.youtube.com/vi/W6NZfCO5SIk/hqdefault.jpg'
                    },
                    {
                        id: 'lnk-yt-2',
                        title: 'طريقة بناء موقع كامل باستخدام HTML و CSS',
                        url: 'https://www.youtube.com/watch?v=FazgJVnrVuY',
                        notes: 'تطبيق عملي خطوة بخطوة',
                        tags: ['تصميم', 'شروحات'],
                        isPinned: false,
                        createdAt: Date.now() - 86400000 * 4,
                        isYouTube: true,
                        ytVideoId: 'FazgJVnrVuY',
                        ytThumbnail: 'https://img.youtube.com/vi/FazgJVnrVuY/hqdefault.jpg'
                    }
                ]
            }
        ]
    },
    {
        id: 'cat-ai',
        name: 'أدوات الذكاء الاصطناعي',
        services: [
            {
                id: 'srv-chatgpt',
                name: 'ChatGPT',
                isPinned: true,
                links: [
                    {
                        id: 'lnk-1',
                        title: 'المحادثة الرئيسية',
                        url: 'https://chatgpt.com',
                        notes: 'المساعد اليومي للبرمجة وكتابة النصوص',
                        tags: ['ذكاء اصطناعي', 'مهم'],
                        isPinned: true,
                        createdAt: Date.now() - 86400000 * 3
                    },
                    {
                        id: 'lnk-2',
                        title: 'منصة المطورين (OpenAI API)',
                        url: 'https://platform.openai.com',
                        notes: 'مفاتيح الـ API والرصيد',
                        tags: ['برمجة', 'API'],
                        isPinned: false,
                        createdAt: Date.now() - 86400000 * 5
                    }
                ]
            },
            {
                id: 'srv-claude',
                name: 'Claude AI',
                isPinned: true,
                links: [
                    {
                        id: 'lnk-3',
                        title: 'منصة المحادثة',
                        url: 'https://claude.ai',
                        notes: 'للمشاريع الطويلة ومراجعة الكود',
                        tags: ['ذكاء اصطناعي', 'برمجة'],
                        isPinned: false,
                        createdAt: Date.now() - 86400000 * 6
                    }
                ]
            },
            {
                id: 'srv-gemini',
                name: 'Google Gemini',
                isPinned: false,
                links: [
                    {
                        id: 'lnk-gemini',
                        title: 'مساعد جوجل الذكي',
                        url: 'https://gemini.google.com',
                        notes: 'محرك جوجل المتعدد الوسائط',
                        tags: ['ذكاء اصطناعي'],
                        isPinned: false,
                        createdAt: Date.now() - 86400000 * 7
                    }
                ]
            },
            {
                id: 'srv-v0',
                name: 'v0.dev',
                isPinned: false,
                links: [
                    {
                        id: 'lnk-v0',
                        title: 'توليد واجهات المستخدم React',
                        url: 'https://v0.dev',
                        notes: 'إنشاء مكونات UI بالذكاء الاصطناعي',
                        tags: ['برمجة', 'تصميم'],
                        isPinned: false,
                        createdAt: Date.now() - 86400000 * 8
                    }
                ]
            },
            {
                id: 'srv-huggingface',
                name: 'Hugging Face',
                isPinned: false,
                links: [
                    {
                        id: 'lnk-hf',
                        title: 'منصة النماذج مفتوحة المصدر',
                        url: 'https://huggingface.co',
                        notes: 'نماذج ومساحات تجارب مجانية',
                        tags: ['ذكاء اصطناعي', 'نماذج'],
                        isPinned: false,
                        createdAt: Date.now() - 86400000 * 9
                    }
                ]
            }
        ]
    },
    {
        id: 'cat-google',
        name: 'خدمات وتطبيقات Google',
        services: [
            {
                id: 'srv-gdrive',
                name: 'Google Drive',
                isPinned: false,
                links: [
                    {
                        id: 'lnk-5',
                        title: 'التخزين السحابي وملفاتي',
                        url: 'https://drive.google.com',
                        notes: 'المستندات، النماذج، والنسخ الاحتياطية',
                        tags: ['سحابة', 'عمل'],
                        isPinned: false,
                        createdAt: Date.now() - 86400000 * 10
                    }
                ]
            },
            {
                id: 'srv-fonts',
                name: 'Google Fonts',
                isPinned: false,
                links: [
                    {
                        id: 'lnk-7',
                        title: 'مكتبة الخطوط العربية والإنجليزية',
                        url: 'https://fonts.google.com',
                        notes: 'تضمين الخطوط في مواقع الويب',
                        tags: ['تصميم', 'خطوط'],
                        isPinned: false,
                        createdAt: Date.now() - 86400000 * 11
                    }
                ]
            }
        ]
    },
    {
        id: 'cat-random',
        name: 'Random',
        isRandom: true,
        services: [
            {
                id: 'srv-rnd-wiki',
                name: 'Wikipedia',
                isPinned: false,
                links: [
                    {
                        id: 'lnk-rnd-1',
                        title: 'الصفحة الرئيسية',
                        url: 'https://ar.wikipedia.org',
                        notes: 'الموسوعة الحرة المفتوحة',
                        tags: ['معرفة', 'مراجع'],
                        isPinned: false,
                        createdAt: Date.now() - 86400000 * 12
                    }
                ]
            },
            {
                id: 'srv-rnd-speed',
                name: 'Speedtest',
                isPinned: false,
                links: [
                    {
                        id: 'lnk-rnd-2',
                        title: 'فحص سرعة الإنترنت',
                        url: 'https://www.speedtest.net',
                        notes: 'قياس سرعة الاتصال والـ Ping',
                        tags: ['أدوات'],
                        isPinned: false,
                        createdAt: Date.now() - 86400000 * 13
                    }
                ]
            },
            {
                id: 'srv-rnd-unsplash',
                name: 'Unsplash',
                isPinned: false,
                links: [
                    {
                        id: 'lnk-rnd-3',
                        title: 'مكتبة الصور المجانية',
                        url: 'https://unsplash.com',
                        notes: 'خلفيات وصور بدقة عالية',
                        tags: ['تصميم', 'صور'],
                        isPinned: false,
                        createdAt: Date.now() - 86400000 * 14
                    }
                ]
            },
            {
                id: 'srv-rnd-canva',
                name: 'Canva',
                isPinned: false,
                links: [
                    {
                        id: 'lnk-rnd-4',
                        title: 'منصة التصميم السريع',
                        url: 'https://www.canva.com',
                        notes: 'تصاميم بوسترات وعروض تقديمية',
                        tags: ['تصميم'],
                        isPinned: false,
                        createdAt: Date.now() - 86400000 * 15
                    }
                ]
            },
            {
                id: 'srv-rnd-time',
                name: 'Time.is',
                isPinned: false,
                links: [
                    {
                        id: 'lnk-rnd-5',
                        title: 'التوقيت الدقيق العالمي',
                        url: 'https://time.is',
                        notes: 'عرض الوقت بدقة في كل المدن',
                        tags: ['أدوات'],
                        isPinned: false,
                        createdAt: Date.now() - 86400000 * 16
                    }
                ]
            }
        ]
    }
];

// App State
let categoriesData = [];
let activeCategoryFilter = 'all';
let activeTagFilters = new Set();
let searchQuery = '';
let detailSearchQuery = '';
let currentSort = 'default';
let currentView = 'home'; // 'home' or 'service-detail'
let activeDetailCatId = null;
let activeDetailServiceId = null;
let expandedCategories = new Set(); // IDs of categories expanded beyond 4 services
let cachedFavicons = {}; // { [domain]: base64DataUrl }
let undoStack = []; // Last 10 state snapshots
let sortableInstances = []; // Active SortableJS instances
let contextMenuData = null; // Target data for custom context menu

// DOM Elements - Navigation & Views
const homeView = document.getElementById('homeView');
const serviceDetailView = document.getElementById('serviceDetailView');
const brandHomeBtn = document.getElementById('brandHomeBtn');
const backToHomeBtn = document.getElementById('backToHomeBtn');

// DOM Elements - Home View
const categoriesGrid = document.getElementById('categoriesGrid');
const emptyState = document.getElementById('emptyState');
const totalCategoriesCount = document.getElementById('totalCategoriesCount');
const totalServicesCount = document.getElementById('totalServicesCount');
const totalLinksCount = document.getElementById('totalLinksCount');
const lastAddedStat = document.getElementById('lastAddedStat');
const categoryFilters = document.getElementById('categoryFilters');
const categorySuggestions = document.getElementById('categorySuggestions');
const serviceSuggestions = document.getElementById('serviceSuggestions');
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const sortSelect = document.getElementById('sortSelect');
const tagFilterRow = document.getElementById('tagFilterRow');
const activeTagChips = document.getElementById('activeTagChips');
const clearTagsFilterBtn = document.getElementById('clearTagsFilterBtn');

// DOM Elements - Detail View
const detailCatName = document.getElementById('detailCatName');
const detailServiceName = document.getElementById('detailServiceName');
const serviceHeroTitle = document.getElementById('serviceHeroTitle');
const serviceHeroIconWrapper = document.getElementById('serviceHeroIconWrapper');
const serviceHeroCatBadge = document.getElementById('serviceHeroCatBadge');
const serviceHeroLinksCount = document.getElementById('serviceHeroLinksCount');
const detailLinksList = document.getElementById('detailLinksList');
const detailEmptyState = document.getElementById('detailEmptyState');
const detailSearchInput = document.getElementById('detailSearchInput');
const addLinkToCurrentServiceBtn = document.getElementById('addLinkToCurrentServiceBtn');
const deleteCurrentServiceBtn = document.getElementById('deleteCurrentServiceBtn');
const openAllLinksBtn = document.getElementById('openAllLinksBtn');
const moveCurrentServiceBtn = document.getElementById('moveCurrentServiceBtn');

// DOM Elements - Move Service Modal
const moveServiceModal = document.getElementById('moveServiceModal');
const moveServiceForm = document.getElementById('moveServiceForm');
const moveServiceSelect = document.getElementById('moveServiceSelect');
const closeMoveServiceModalBtn = document.getElementById('closeMoveServiceModalBtn');
const cancelMoveServiceModalBtn = document.getElementById('cancelMoveServiceModalBtn');

// DOM Elements - Modals
const linkModal = document.getElementById('linkModal');
const linkForm = document.getElementById('linkForm');
const modalTitle = document.getElementById('modalTitle');
const editCatId = document.getElementById('editCatId');
const editServiceId = document.getElementById('editServiceId');
const editLinkId = document.getElementById('editLinkId');
const categoryInput = document.getElementById('categoryInput');
const serviceInput = document.getElementById('serviceInput');
const linkTitleInput = document.getElementById('linkTitleInput');
const linkUrlInput = document.getElementById('linkUrlInput');
const linkTagsInput = document.getElementById('linkTagsInput');
const linkNotesInput = document.getElementById('linkNotesInput');
const youtubeDetectedHint = document.getElementById('youtubeDetectedHint');
const duplicateWarningHint = document.getElementById('duplicateWarningHint');
const duplicateWarningText = document.getElementById('duplicateWarningText');
const openAddModalBtn = document.getElementById('openAddModalBtn');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelModalBtn = document.getElementById('cancelModalBtn');

// Category Add & Edit Modals
const categoryModal = document.getElementById('categoryModal');
const categoryForm = document.getElementById('categoryForm');
const newCategoryName = document.getElementById('newCategoryName');
const openAddCategoryModalBtn = document.getElementById('openAddCategoryModalBtn');
const closeCategoryModalBtn = document.getElementById('closeCategoryModalBtn');
const cancelCategoryModalBtn = document.getElementById('cancelCategoryModalBtn');

const editCategoryModal = document.getElementById('editCategoryModal');
const editCategoryForm = document.getElementById('editCategoryForm');
const editCategoryTargetId = document.getElementById('editCategoryTargetId');
const editCategoryNewName = document.getElementById('editCategoryNewName');
const closeEditCategoryModalBtn = document.getElementById('closeEditCategoryModalBtn');
const cancelEditCategoryModalBtn = document.getElementById('cancelEditCategoryModalBtn');

// Custom Confirm Modal
const confirmModal = document.getElementById('confirmModal');
const confirmTitle = document.getElementById('confirmTitle');
const confirmMessage = document.getElementById('confirmMessage');
const confirmOkBtn = document.getElementById('confirmOkBtn');
const confirmCancelBtn = document.getElementById('confirmCancelBtn');

// Custom Context Menu
const contextMenu = document.getElementById('contextMenu');
const ctxOpen = document.getElementById('ctxOpen');
const ctxCopy = document.getElementById('ctxCopy');
const ctxPin = document.getElementById('ctxPin');
const ctxPinText = document.getElementById('ctxPinText');
const ctxEdit = document.getElementById('ctxEdit');
const ctxDelete = document.getElementById('ctxDelete');

// Theme, Undo & Backup
const themeToggleBtn = document.getElementById('themeToggleBtn');
const undoBtn = document.getElementById('undoBtn');
const exportBtn = document.getElementById('exportBtn');
const importInput = document.getElementById('importInput');
const toast = document.getElementById('toast');
const toastIcon = document.getElementById('toastIcon');
const toastMessage = document.getElementById('toastMessage');

// ==========================================
// Initialization
// ==========================================
function init() {
    loadTheme();
    loadCachedFavicons();
    loadData();
    bindEvents();
    render();
}

function loadData() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            categoriesData = JSON.parse(saved);
        } catch (e) {
            console.error('Error parsing data:', e);
            categoriesData = INITIAL_DATA;
        }
    } else {
        categoriesData = INITIAL_DATA;
        saveToStorage();
    }

    // Ensure Random category exists for quick direct links
    if (!categoriesData.some(c => isRandomCategory(c))) {
        const randomInitial = INITIAL_DATA.find(c => isRandomCategory(c));
        if (randomInitial) {
            categoriesData.push(randomInitial);
            saveToStorage();
        }
    }
}

function saveToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(categoriesData));
}

// ==========================================
// Undo Functionality (Stack of 10 states)
// ==========================================
function saveUndoState() {
    try {
        const snapshot = JSON.stringify(categoriesData);
        undoStack.push(snapshot);
        if (undoStack.length > 10) {
            undoStack.shift();
        }
        updateUndoButton();
    } catch (e) {
        console.warn('Could not save undo state:', e);
    }
}

function undo() {
    if (undoStack.length === 0) return;
    const previousSnapshot = undoStack.pop();
    try {
        categoriesData = JSON.parse(previousSnapshot);
        saveToStorage();
        render();
        updateUndoButton();
        showToast('تم التراجع عن آخر إجراء بنجاح ↩️', 'info');
    } catch (e) {
        console.error('Error reverting state:', e);
    }
}

function updateUndoButton() {
    if (undoBtn) {
        undoBtn.disabled = undoStack.length === 0;
    }
}

// ==========================================
// Favicon Local Caching
// ==========================================
function loadCachedFavicons() {
    try {
        const cached = localStorage.getItem(FAVICON_CACHE_KEY);
        if (cached) {
            cachedFavicons = JSON.parse(cached);
        }
    } catch (e) {
        cachedFavicons = {};
    }
}

function saveCachedFavicons() {
    try {
        localStorage.setItem(FAVICON_CACHE_KEY, JSON.stringify(cachedFavicons));
    } catch (e) {
        console.warn('Storage quota reached for icons cache');
    }
}

function cacheImageLocally(domain, imgElement) {
    if (!domain || cachedFavicons[domain]) return;
    try {
        const canvas = document.createElement('canvas');
        canvas.width = imgElement.naturalWidth || 32;
        canvas.height = imgElement.naturalHeight || 32;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(imgElement, 0, 0);
        const dataUrl = canvas.toDataURL('image/png');
        if (dataUrl && dataUrl.length > 60) {
            cachedFavicons[domain] = dataUrl;
            saveCachedFavicons();
        }
    } catch (err) {
        // Cross-origin canvas restriction if any
    }
}

function getDomain(urlString) {
    try {
        let formattedUrl = (urlString || '').trim();
        if (!/^https?:\/\//i.test(formattedUrl)) {
            formattedUrl = 'https://' + formattedUrl;
        }
        return new URL(formattedUrl).hostname;
    } catch {
        return '';
    }
}

function getFavicon(url) {
    const domain = getDomain(url);
    if (!domain) return '';

    if (cachedFavicons[domain]) {
        return { src: cachedFavicons[domain], isCached: true, domain };
    }

    return {
        src: `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
        isCached: false,
        domain
    };
}

// ==========================================
// YouTube Helper (ID, Thumbnail, Title)
// ==========================================
function getYouTubeVideoId(url) {
    if (!url) return null;
    const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?\/\s]{11})/i;
    const match = url.match(regExp);
    return match ? match[1] : null;
}

async function fetchYouTubeTitle(url) {
    try {
        const res = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`);
        if (res.ok) {
            const data = await res.json();
            return data.title || null;
        }
    } catch (e) {
        // network or CORS fallback
    }
    return null;
}

// ==========================================
// Duplicate URL Detection
// ==========================================
function checkDuplicateUrl(url, currentLinkId) {
    if (!url || url.length < 5) return null;
    const cleanUrl = url.trim().toLowerCase().replace(/\/+$/, '');
    for (const cat of categoriesData) {
        for (const srv of (cat.services || [])) {
            for (const lnk of (srv.links || [])) {
                if (currentLinkId && lnk.id === currentLinkId) continue;
                const existingUrl = (lnk.url || '').trim().toLowerCase().replace(/\/+$/, '');
                if (existingUrl === cleanUrl) {
                    return { catName: cat.name, srvName: srv.name, title: lnk.title };
                }
            }
        }
    }
    return null;
}

// ==========================================
// Custom Confirmation Dialog (Promise-based)
// ==========================================
let confirmResolver = null;

function showConfirmDialog(titleText, messageText) {
    confirmTitle.textContent = titleText;
    confirmMessage.textContent = messageText;
    confirmModal.classList.add('active');

    return new Promise((resolve) => {
        confirmResolver = resolve;
    });
}

function closeConfirmModal(result) {
    confirmModal.classList.remove('active');
    if (confirmResolver) {
        confirmResolver(result);
        confirmResolver = null;
    }
}

// Theme Handling
function loadTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem(THEME_KEY, newTheme);
    updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
    const icon = themeToggleBtn.querySelector('i');
    if (theme === 'light') {
        icon.className = 'fa-solid fa-sun';
        icon.style.color = '#f59e0b';
    } else {
        icon.className = 'fa-solid fa-moon';
        icon.style.color = '';
    }
}

// ==========================================
// Toast Notification with Type Styles
// ==========================================
let toastTimeout;
function showToast(msg, type = 'success') {
    toastMessage.textContent = msg;

    // Reset types
    toast.classList.remove('toast-success', 'toast-error', 'toast-warning', 'toast-info');
    toast.classList.add(`toast-${type}`);

    // Update icon based on type
    if (type === 'error') {
        toastIcon.className = 'fa-solid fa-circle-xmark';
    } else if (type === 'warning') {
        toastIcon.className = 'fa-solid fa-triangle-exclamation';
    } else if (type === 'info') {
        toastIcon.className = 'fa-solid fa-circle-info';
    } else {
        toastIcon.className = 'fa-solid fa-circle-check';
    }

    toast.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 2800);
}

// ==========================================
// Navigation & View Routing
// ==========================================
function navigateToHome() {
    currentView = 'home';
    activeDetailCatId = null;
    activeDetailServiceId = null;
    serviceDetailView.style.display = 'none';
    homeView.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    render();
}

window.navigateToService = function(catId, serviceId) {
    activeDetailCatId = catId;
    activeDetailServiceId = serviceId;
    currentView = 'service-detail';
    detailSearchQuery = '';
    detailSearchInput.value = '';

    homeView.style.display = 'none';
    serviceDetailView.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    renderDetailView();
};

// ==========================================
// Render Logic
// ==========================================
function render() {
    if (currentView === 'service-detail') {
        renderDetailView();
        return;
    }

    // 1. Calculate stats & latest added timestamp
    let totalServices = 0;
    let totalLinks = 0;
    let latestTimestamp = 0;

    categoriesData.forEach(cat => {
        totalServices += (cat.services || []).length;
        (cat.services || []).forEach(srv => {
            totalLinks += (srv.links || []).length;
            (srv.links || []).forEach(lnk => {
                if (lnk.createdAt && lnk.createdAt > latestTimestamp) {
                    latestTimestamp = lnk.createdAt;
                }
            });
        });
    });

    totalCategoriesCount.textContent = categoriesData.length;
    totalServicesCount.textContent = totalServices;
    totalLinksCount.textContent = totalLinks;

    if (latestTimestamp > 0) {
        const d = new Date(latestTimestamp);
        lastAddedStat.textContent = d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' });
    } else {
        lastAddedStat.textContent = 'لا يوجد';
    }

    updateSuggestions();
    renderCategoryFilterChips();
    renderTagFilters();

    // 2. Filter & Sort categories & websites
    const filteredCategories = filterCategoriesData();

    if (filteredCategories.length === 0) {
        categoriesGrid.innerHTML = '';
        emptyState.style.display = 'block';
    } else {
        emptyState.style.display = 'none';
        categoriesGrid.innerHTML = filteredCategories.map(cat => createCategoryCardHtml(cat)).join('');
    }

    // 3. Initialize Drag & Drop via SortableJS
    initSortable();
}

function updateSuggestions() {
    const catNames = categoriesData.map(c => c.name);
    categorySuggestions.innerHTML = catNames.map(c => `<option value="${escapeHtml(c)}">`).join('');

    const srvSet = new Set();
    categoriesData.forEach(c => {
        (c.services || []).forEach(s => srvSet.add(s.name));
    });
    serviceSuggestions.innerHTML = Array.from(srvSet).map(s => `<option value="${escapeHtml(s)}">`).join('');
}

function renderCategoryFilterChips() {
    let html = `
        <button class="filter-chip ${activeCategoryFilter === 'all' ? 'active' : ''}" data-cat="all">
            الكل (${categoriesData.length})
        </button>
    `;

    categoriesData.forEach(cat => {
        const linkCount = (cat.services || []).reduce((acc, s) => acc + (s.links ? s.links.length : 0), 0);
        const isActive = activeCategoryFilter === cat.id ? 'active' : '';
        html += `
            <button class="filter-chip ${isActive}" data-cat="${cat.id}">
                ${escapeHtml(cat.name)} (${linkCount})
            </button>
        `;
    });

    categoryFilters.innerHTML = html;

    categoryFilters.querySelectorAll('.filter-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            activeCategoryFilter = btn.getAttribute('data-cat');
            render();
        });
    });
}

function renderTagFilters() {
    // Collect all tags and their counts
    const tagCounts = {};
    categoriesData.forEach(cat => {
        (cat.services || []).forEach(srv => {
            (srv.links || []).forEach(lnk => {
                (lnk.tags || []).forEach(tag => {
                    const t = tag.trim();
                    if (t) tagCounts[t] = (tagCounts[t] || 0) + 1;
                });
            });
        });
    });

    const uniqueTags = Object.keys(tagCounts);
    if (uniqueTags.length === 0) {
        tagFilterRow.style.display = 'none';
        return;
    }

    tagFilterRow.style.display = 'flex';
    let chipsHtml = '';

    uniqueTags.forEach(tag => {
        const isSelected = activeTagFilters.has(tag);
        chipsHtml += `
            <span class="tag-badge ${isSelected ? 'active-filter' : ''}" onclick="toggleTagFilter('${escapeHtml(tag)}')">
                <i class="fa-solid fa-tag"></i> ${escapeHtml(tag)} (${tagCounts[tag]})
            </span>
        `;
    });

    activeTagChips.innerHTML = chipsHtml;
    clearTagsFilterBtn.style.display = activeTagFilters.size > 0 ? 'inline-flex' : 'none';
}

window.toggleTagFilter = function(tag) {
    if (activeTagFilters.has(tag)) {
        activeTagFilters.delete(tag);
    } else {
        activeTagFilters.add(tag);
    }
    render();
};

window.filterByTag = function(tag) {
    activeTagFilters.clear();
    activeTagFilters.add(tag);
    if (currentView !== 'home') {
        navigateToHome();
    } else {
        render();
    }
};

function filterCategoriesData() {
    const q = searchQuery.toLowerCase().trim();

    let result = categoriesData
        .filter(cat => activeCategoryFilter === 'all' || cat.id === activeCategoryFilter)
        .map(cat => {
            let matchingServices = (cat.services || []).filter(srv => {
                const srvMatchesName = srv.name.toLowerCase().includes(q);
                const matchingLinks = (srv.links || []).filter(lnk => {
                    // Tag filtering check
                    if (activeTagFilters.size > 0) {
                        const lnkTags = lnk.tags || [];
                        const matchesAllTags = Array.from(activeTagFilters).every(tf => lnkTags.includes(tf));
                        if (!matchesAllTags) return false;
                    }

                    if (!q) return true;

                    const titleMatch = (lnk.title || '').toLowerCase().includes(q);
                    const urlMatch = (lnk.url || '').toLowerCase().includes(q);
                    const notesMatch = (lnk.notes || '').toLowerCase().includes(q);
                    const tagsMatch = (lnk.tags || []).some(t => t.toLowerCase().includes(q));

                    return titleMatch || urlMatch || notesMatch || tagsMatch;
                });

                if (activeTagFilters.size > 0) {
                    return matchingLinks.length > 0;
                }

                if (!q) return true;
                return srvMatchesName || matchingLinks.length > 0;
            });

            if (matchingServices.length > 0) {
                return {
                    ...cat,
                    services: matchingServices
                };
            }
            return null;
        })
        .filter(Boolean);

    // Apply Sorting
    result = applySorting(result);

    return result;
}

function applySorting(cats) {
    if (currentSort === 'default') return cats;

    const sortedCats = [...cats];

    if (currentSort === 'name-asc') {
        sortedCats.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
        sortedCats.forEach(c => {
            c.services = [...c.services].sort((a, b) => a.name.localeCompare(b.name, 'ar'));
        });
    } else if (currentSort === 'name-desc') {
        sortedCats.sort((a, b) => b.name.localeCompare(a.name, 'ar'));
        sortedCats.forEach(c => {
            c.services = [...c.services].sort((a, b) => b.name.localeCompare(a.name, 'ar'));
        });
    } else if (currentSort === 'links-desc') {
        sortedCats.sort((a, b) => {
            const countA = a.services.reduce((acc, s) => acc + (s.links ? s.links.length : 0), 0);
            const countB = b.services.reduce((acc, s) => acc + (s.links ? s.links.length : 0), 0);
            return countB - countA;
        });
        sortedCats.forEach(c => {
            c.services = [...c.services].sort((a, b) => (b.links ? b.links.length : 0) - (a.links ? a.links.length : 0));
        });
    } else if (currentSort === 'links-asc') {
        sortedCats.sort((a, b) => {
            const countA = a.services.reduce((acc, s) => acc + (s.links ? s.links.length : 0), 0);
            const countB = b.services.reduce((acc, s) => acc + (s.links ? s.links.length : 0), 0);
            return countA - countB;
        });
        sortedCats.forEach(c => {
            c.services = [...c.services].sort((a, b) => (a.links ? a.links.length : 0) - (b.links ? b.links.length : 0));
        });
    } else if (currentSort === 'newest') {
        const getLatest = (item) => {
            let maxT = 0;
            if (item.services) {
                item.services.forEach(s => (s.links || []).forEach(l => { if (l.createdAt && l.createdAt > maxT) maxT = l.createdAt; }));
            } else if (item.links) {
                item.links.forEach(l => { if (l.createdAt && l.createdAt > maxT) maxT = l.createdAt; });
            }
            return maxT;
        };
        sortedCats.sort((a, b) => getLatest(b) - getLatest(a));
        sortedCats.forEach(c => {
            c.services = [...c.services].sort((a, b) => getLatest(b) - getLatest(a));
        });
    }

    return sortedCats;
}

// Helper to identify Random category
function isRandomCategory(cat) {
    if (!cat || !cat.name) return false;
    const name = cat.name.trim().toLowerCase();
    return name === 'random' || name === 'عشوائي' || Boolean(cat.isRandom);
}

// ==========================================
// View 1 (Home) - Category Card with Pinning
// ==========================================
function createCategoryCardHtml(cat) {
    const services = cat.services || [];
    const totalCatLinks = services.reduce((acc, s) => acc + (s.links ? s.links.length : 0), 0);
    const servicesCount = services.length;
    const isExpanded = expandedCategories.has(cat.id);
    const isRandom = isRandomCategory(cat);

    // Sort services so pinned items appear first
    const sortedServices = [...services].sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));

    // Limit to 4 services unless expanded
    const displayServices = (servicesCount > 4 && !isExpanded) ? sortedServices.slice(0, 4) : sortedServices;

    let servicesHtml = '';
    if (services.length > 0) {
        if (isRandom) {
            servicesHtml = displayServices.map(srv => createRandomServiceCardHtml(cat.id, srv)).join('');
        } else {
            servicesHtml = displayServices.map(srv => createServiceSummaryCardHtml(cat.id, srv)).join('');
        }
    } else {
        servicesHtml = `<p style="color: var(--text-secondary); font-size: 0.85rem; text-align: center; padding: 14px;">لا توجد مواقع في هذا التصنيف بعد.</p>`;
    }

    // Toggle button if more than 4 services
    let toggleBtnHtml = '';
    if (servicesCount > 4) {
        if (!isExpanded) {
            toggleBtnHtml = `
                <button class="toggle-expand-btn" onclick="toggleCategoryExpand('${cat.id}')">
                    <i class="fa-solid fa-chevron-down"></i>
                    عرض باقي المواقع (${servicesCount - 4}+)
                </button>
            `;
        } else {
            toggleBtnHtml = `
                <button class="toggle-expand-btn" onclick="toggleCategoryExpand('${cat.id}')">
                    <i class="fa-solid fa-chevron-up"></i>
                    إخفاء باقي المواقع
                </button>
            `;
        }
    }

    const categoryIcon = isRandom ? 'fa-shuffle' : 'fa-folder';
    const countsLabel = isRandom ? `${servicesCount} مواقع مباشرة` : `${servicesCount} مواقع • ${totalCatLinks} روابط`;

    return `
        <div class="category-card" data-cat-id="${cat.id}">
            <div class="category-header">
                <div class="category-title-wrap">
                    <span class="drag-handle" title="اسحب لإعادة ترتيب التصنيف"><i class="fa-solid fa-grip-vertical"></i></span>
                    <div class="category-icon">
                        <i class="fa-solid ${categoryIcon}"></i>
                    </div>
                    <div>
                        <div class="category-title-inner">
                            <h2 class="category-title">${escapeHtml(cat.name)}</h2>
                            <button class="edit-cat-pencil" title="تعديل اسم التصنيف" onclick="openEditCategoryModal('${cat.id}', '${escapeHtml(cat.name)}')">
                                <i class="fa-solid fa-pen"></i>
                            </button>
                        </div>
                        <span class="category-counts">${countsLabel}</span>
                    </div>
                </div>

                <div class="category-header-actions">
                    <button class="action-icon-btn" title="إضافة موقع جديد لهذا التصنيف" onclick="openAddModalForCategory('${escapeHtml(cat.name)}')">
                        <i class="fa-solid fa-plus"></i>
                    </button>
                    <button class="action-icon-btn delete-btn" title="حذف التصنيف" onclick="deleteCategory('${cat.id}')">
                        <i class="fa-regular fa-trash-can"></i>
                    </button>
                </div>
            </div>

            <div class="category-body" data-cat-id="${cat.id}">
                ${servicesHtml}
                ${toggleBtnHtml}
            </div>
        </div>
    `;
}

// Random Category Website Card
function createRandomServiceCardHtml(catId, srv) {
    const link = (srv.links && srv.links.length > 0) ? srv.links[0] : null;
    const url = link ? link.url : '';
    const fullUrl = /^https?:\/\//i.test(url) ? url : 'https://' + url;
    const domain = getDomain(url) || url;
    const iconData = getFavicon(url);
    const isPinned = Boolean(srv.isPinned);

    return `
        <div class="random-service-card ${isPinned ? 'is-pinned' : ''}" data-cat-id="${catId}" data-service-id="${srv.id}">
            <span class="drag-handle" title="اسحب للترتيب"><i class="fa-solid fa-grip-vertical"></i></span>
            <a href="${escapeHtml(fullUrl)}" target="_blank" rel="noopener noreferrer" class="random-service-left" title="فتح الموقع مباشرة في تبويب جديد: ${escapeHtml(fullUrl)}">
                ${iconData.src ? `
                    <img src="${iconData.src}" class="service-favicon" alt="" 
                         onload="cacheImageLocally('${iconData.domain}', this)"
                         onerror="this.outerHTML='<div class=\\'service-fallback-icon\\'><i class=\\'fa-solid fa-globe\\'></i></div>';">
                ` : `
                    <div class="service-fallback-icon"><i class="fa-solid fa-globe"></i></div>
                `}
                <div class="random-service-meta">
                    <span class="random-service-name">
                        ${escapeHtml(srv.name)}
                        ${isPinned ? `<i class="fa-solid fa-thumbtack pinned-indicator" title="مثبت"></i>` : ''}
                    </span>
                    <span class="random-service-url">${escapeHtml(domain)}</span>
                </div>
            </a>

            <div class="random-service-actions">
                <button class="pin-btn ${isPinned ? 'pinned' : ''}" title="${isPinned ? 'إلغاء التثبيت' : 'تثبيت في الأعلى'}" onclick="togglePinService('${catId}', '${srv.id}')">
                    <i class="fa-solid fa-thumbtack"></i>
                </button>
                <button class="action-icon-btn" title="نسخ الرابط" onclick="copyLink('${escapeHtml(fullUrl)}')">
                    <i class="fa-regular fa-copy"></i>
                </button>
                <button class="action-icon-btn" title="تعديل الموقع والرابط" onclick="openEditRandomModal('${catId}', '${srv.id}')">
                    <i class="fa-regular fa-pen-to-square"></i>
                </button>
                <button class="action-icon-btn delete-btn" title="حذف الموقع" onclick="deleteService('${catId}', '${srv.id}')">
                    <i class="fa-regular fa-trash-can"></i>
                </button>
                <a href="${escapeHtml(fullUrl)}" target="_blank" rel="noopener noreferrer" class="action-icon-btn visit-btn" title="زيارة الموقع مباشرة">
                    <i class="fa-solid fa-arrow-up-right-from-square"></i>
                </a>
            </div>
        </div>
    `;
}

function createServiceSummaryCardHtml(catId, srv) {
    const firstUrl = (srv.links && srv.links.length > 0) ? srv.links[0].url : '';
    const iconData = getFavicon(firstUrl);
    const linksCount = (srv.links || []).length;
    const isPinned = Boolean(srv.isPinned);

    return `
        <div class="service-summary-card ${isPinned ? 'is-pinned' : ''}" data-cat-id="${catId}" data-service-id="${srv.id}" onclick="navigateToService('${catId}', '${srv.id}')" title="انقر لعرض روابط هذا الموقع">
            <span class="drag-handle" title="اسحب للترتيب" onclick="event.stopPropagation();"><i class="fa-solid fa-grip-vertical"></i></span>
            <div class="service-summary-left">
                ${iconData.src ? `
                    <img src="${iconData.src}" class="service-favicon" alt="" 
                         onload="cacheImageLocally('${iconData.domain}', this)"
                         onerror="this.outerHTML='<div class=\\'service-fallback-icon\\'><i class=\\'fa-solid fa-globe\\'></i></div>';">
                ` : `
                    <div class="service-fallback-icon"><i class="fa-solid fa-globe"></i></div>
                `}
                <span class="service-summary-name">
                    ${escapeHtml(srv.name)}
                    ${isPinned ? `<i class="fa-solid fa-thumbtack pinned-indicator" title="مثبت"></i>` : ''}
                </span>
            </div>

            <div class="service-summary-right">
                <button class="pin-btn ${isPinned ? 'pinned' : ''}" title="${isPinned ? 'إلغاء التثبيت' : 'تثبيت في الأعلى'}" onclick="event.stopPropagation(); togglePinService('${catId}', '${srv.id}')">
                    <i class="fa-solid fa-thumbtack"></i>
                </button>
                <span class="service-badge">${linksCount} روابط</span>
                <i class="fa-solid fa-arrow-left service-go-icon"></i>
            </div>
        </div>
    `;
}

window.togglePinService = function(catId, serviceId) {
    const cat = categoriesData.find(c => c.id === catId);
    if (!cat) return;
    const srv = (cat.services || []).find(s => s.id === serviceId);
    if (!srv) return;

    saveUndoState();
    srv.isPinned = !srv.isPinned;
    saveToStorage();
    render();
    showToast(srv.isPinned ? `تم تثبيت "${srv.name}" في الأعلى 📌` : `تم إلغاء تثبيت "${srv.name}"`, 'info');
};

window.togglePinLink = function(catId, serviceId, linkId) {
    const cat = categoriesData.find(c => c.id === catId);
    if (!cat) return;
    const srv = (cat.services || []).find(s => s.id === serviceId);
    if (!srv) return;
    const link = (srv.links || []).find(l => l.id === linkId);
    if (!link) return;

    saveUndoState();
    link.isPinned = !link.isPinned;
    saveToStorage();
    renderDetailView();
    showToast(link.isPinned ? `تم تثبيت الرابط في الأعلى 📌` : `تم إلغاء تثبيت الرابط`, 'info');
};

window.openEditRandomModal = function(catId, serviceId) {
    const cat = categoriesData.find(c => c.id === catId);
    if (!cat) return;
    const srv = (cat.services || []).find(s => s.id === serviceId);
    if (!srv) return;
    const link = (srv.links && srv.links.length > 0) ? srv.links[0] : null;
    if (link) {
        openEditModal(catId, serviceId, link.id);
    }
};

window.toggleCategoryExpand = function(catId) {
    if (expandedCategories.has(catId)) {
        expandedCategories.delete(catId);
    } else {
        expandedCategories.add(catId);
    }
    render();
};

// ==========================================
// View 2 (Service Detail Page)
// ==========================================
function renderDetailView() {
    const cat = categoriesData.find(c => c.id === activeDetailCatId);
    if (!cat) {
        navigateToHome();
        return;
    }
    const srv = (cat.services || []).find(s => s.id === activeDetailServiceId);
    if (!srv) {
        navigateToHome();
        return;
    }

    // Breadcrumb
    detailCatName.textContent = cat.name;
    detailServiceName.textContent = srv.name;

    // Hero Card
    serviceHeroTitle.textContent = srv.name;
    serviceHeroCatBadge.innerHTML = `<i class="fa-regular fa-folder"></i> ${escapeHtml(cat.name)}`;
    const links = srv.links || [];
    serviceHeroLinksCount.innerHTML = `<i class="fa-solid fa-link"></i> ${links.length} روابط`;

    // Service Icon
    const firstUrl = links.length > 0 ? links[0].url : '';
    const iconData = getFavicon(firstUrl);
    if (iconData.src) {
        serviceHeroIconWrapper.innerHTML = `
            <img src="${iconData.src}" alt="${escapeHtml(srv.name)}" 
                 onload="cacheImageLocally('${iconData.domain}', this)"
                 onerror="this.outerHTML='<div class=\\'fallback-icon\\'><i class=\\'fa-solid fa-globe\\'></i></div>';">
        `;
    } else {
        serviceHeroIconWrapper.innerHTML = `<div class="fallback-icon"><i class="fa-solid fa-globe"></i></div>`;
    }

    // Filter links in detail search
    const q = detailSearchQuery.toLowerCase().trim();
    let filteredLinks = links.filter(l => {
        if (!q) return true;
        const titleMatch = (l.title || '').toLowerCase().includes(q);
        const urlMatch = (l.url || '').toLowerCase().includes(q);
        const notesMatch = (l.notes || '').toLowerCase().includes(q);
        const tagsMatch = (l.tags || []).some(t => t.toLowerCase().includes(q));
        return titleMatch || urlMatch || notesMatch || tagsMatch;
    });

    // Pinned links first
    filteredLinks.sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));

    if (filteredLinks.length === 0) {
        detailLinksList.innerHTML = '';
        detailEmptyState.style.display = 'block';
    } else {
        detailEmptyState.style.display = 'none';
        detailLinksList.innerHTML = filteredLinks.map((link, idx) => {
            const actualIndex = links.indexOf(link) + 1;
            return createDetailLinkRowHtml(cat.id, srv.id, link, actualIndex);
        }).join('');
    }

    // Re-initialize Drag & Drop on detail links
    initSortable();
}

function createDetailLinkRowHtml(catId, serviceId, link, index) {
    const fullUrl = /^https?:\/\//i.test(link.url) ? link.url : 'https://' + link.url;
    const domain = getDomain(link.url) || link.url;
    const isYt = link.isYouTube || Boolean(getYouTubeVideoId(link.url));
    const isPinned = Boolean(link.isPinned);

    // Tags Badges
    const tagsHtml = (link.tags && link.tags.length > 0)
        ? `<div class="link-tags-row">
            ${link.tags.map(tag => `<span class="tag-badge" onclick="event.stopPropagation(); filterByTag('${escapeHtml(tag)}')"><i class="fa-solid fa-tag"></i> ${escapeHtml(tag)}</span>`).join('')}
           </div>`
        : '';

    // YouTube Card Style
    if (isYt) {
        const videoId = link.ytVideoId || getYouTubeVideoId(link.url);
        const thumb = link.ytThumbnail || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

        return `
            <li class="youtube-preview-card ${isPinned ? 'is-pinned' : ''}" data-cat-id="${catId}" data-service-id="${serviceId}" data-link-id="${link.id}">
                <span class="drag-handle" title="اسحب للترتيب"><i class="fa-solid fa-grip-vertical"></i></span>
                <div class="detail-link-left">
                    <div class="link-index-badge">${index}</div>

                    <a href="${escapeHtml(fullUrl)}" target="_blank" rel="noopener noreferrer" class="youtube-thumbnail-wrapper" title="مشاهدة على YouTube">
                        <img src="${thumb}" alt="${escapeHtml(link.title)}" onerror="this.src='https://placehold.co/140x80?text=YouTube';">
                        <div class="youtube-play-overlay">
                            <i class="fa-solid fa-play"></i>
                        </div>
                    </a>

                    <div class="detail-link-info">
                        <span class="youtube-badge"><i class="fa-brands fa-youtube"></i> مقطع فيديو</span>
                        <h4 class="detail-link-title">
                            ${escapeHtml(link.title)}
                            ${isPinned ? `<i class="fa-solid fa-thumbtack pinned-indicator" title="مثبت"></i>` : ''}
                        </h4>
                        <a href="${escapeHtml(fullUrl)}" target="_blank" rel="noopener noreferrer" class="detail-link-url" title="${escapeHtml(fullUrl)}">
                            ${escapeHtml(fullUrl)}
                        </a>
                        ${link.notes ? `<div class="detail-link-notes">${escapeHtml(link.notes)}</div>` : ''}
                        ${tagsHtml}
                    </div>
                </div>

                <div class="link-actions-group">
                    <button class="pin-btn ${isPinned ? 'pinned' : ''}" title="${isPinned ? 'إلغاء التثبيت' : 'تثبيت في الأعلى'}" onclick="togglePinLink('${catId}', '${serviceId}', '${link.id}')">
                        <i class="fa-solid fa-thumbtack"></i>
                    </button>
                    <button class="action-icon-btn" title="نسخ الرابط" onclick="copyLink('${escapeHtml(fullUrl)}')">
                        <i class="fa-regular fa-copy"></i>
                    </button>
                    <button class="action-icon-btn" title="تعديل الرابط" onclick="openEditModal('${catId}', '${serviceId}', '${link.id}')">
                        <i class="fa-regular fa-pen-to-square"></i>
                    </button>
                    <button class="action-icon-btn delete-btn" title="حذف الرابط" onclick="deleteLink('${catId}', '${serviceId}', '${link.id}')">
                        <i class="fa-regular fa-trash-can"></i>
                    </button>
                    <a href="${escapeHtml(fullUrl)}" target="_blank" rel="noopener noreferrer" class="action-icon-btn visit-btn" title="مشاهدة الفيديو">
                        <i class="fa-solid fa-arrow-up-right-from-square"></i>
                    </a>
                </div>
            </li>
        `;
    }

    // Standard Link Card Style
    return `
        <li class="detail-link-card ${isPinned ? 'is-pinned' : ''}" data-cat-id="${catId}" data-service-id="${serviceId}" data-link-id="${link.id}">
            <span class="drag-handle" title="اسحب للترتيب"><i class="fa-solid fa-grip-vertical"></i></span>
            <div class="detail-link-left">
                <div class="link-index-badge">${index}</div>
                <div class="detail-link-info">
                    <h4 class="detail-link-title">
                        ${escapeHtml(link.title)}
                        ${isPinned ? `<i class="fa-solid fa-thumbtack pinned-indicator" title="مثبت"></i>` : ''}
                    </h4>
                    <a href="${escapeHtml(fullUrl)}" target="_blank" rel="noopener noreferrer" class="detail-link-url" title="${escapeHtml(fullUrl)}">
                        ${escapeHtml(domain)}
                    </a>
                    ${link.notes ? `<div class="detail-link-notes">${escapeHtml(link.notes)}</div>` : ''}
                    ${tagsHtml}
                </div>
            </div>

            <div class="link-actions-group">
                <button class="pin-btn ${isPinned ? 'pinned' : ''}" title="${isPinned ? 'إلغاء التثبيت' : 'تثبيت في الأعلى'}" onclick="togglePinLink('${catId}', '${serviceId}', '${link.id}')">
                    <i class="fa-solid fa-thumbtack"></i>
                </button>
                <button class="action-icon-btn" title="نسخ الرابط" onclick="copyLink('${escapeHtml(fullUrl)}')">
                    <i class="fa-regular fa-copy"></i>
                </button>
                <button class="action-icon-btn" title="تعديل الرابط" onclick="openEditModal('${catId}', '${serviceId}', '${link.id}')">
                    <i class="fa-regular fa-pen-to-square"></i>
                </button>
                <button class="action-icon-btn delete-btn" title="حذف الرابط" onclick="deleteLink('${catId}', '${serviceId}', '${link.id}')">
                    <i class="fa-regular fa-trash-can"></i>
                </button>
                <a href="${escapeHtml(fullUrl)}" target="_blank" rel="noopener noreferrer" class="action-icon-btn visit-btn" title="فتح الرابط">
                    <i class="fa-solid fa-arrow-up-right-from-square"></i>
                </a>
            </div>
        </li>
    `;
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ==========================================
// SortableJS Drag & Drop Initialization
// ==========================================
function initSortable() {
    // Destroy previous instances
    sortableInstances.forEach(inst => {
        try { inst.destroy(); } catch (e) {}
    });
    sortableInstances = [];

    if (typeof Sortable === 'undefined') return;

    if (currentView === 'home') {
        // 1. Categories Reordering
        if (categoriesGrid && activeCategoryFilter === 'all' && !searchQuery && activeTagFilters.size === 0 && currentSort === 'default') {
            const catSortable = new Sortable(categoriesGrid, {
                animation: 200,
                handle: '.drag-handle',
                ghostClass: 'sortable-ghost',
                chosenClass: 'sortable-chosen',
                onEnd: (evt) => {
                    if (evt.oldIndex === evt.newIndex) return;
                    saveUndoState();
                    const movedItem = categoriesData.splice(evt.oldIndex, 1)[0];
                    categoriesData.splice(evt.newIndex, 0, movedItem);
                    saveToStorage();
                    renderCategoryFilterChips();
                    showToast('تم تحديث ترتيب التصنيفات', 'info');
                }
            });
            sortableInstances.push(catSortable);
        }

        // 2. Services inside each category
        if (!searchQuery && activeTagFilters.size === 0 && currentSort === 'default') {
            document.querySelectorAll('.category-body').forEach(bodyEl => {
                const catId = bodyEl.getAttribute('data-cat-id');
                const cat = categoriesData.find(c => c.id === catId);
                if (!cat) return;

                const srvSortable = new Sortable(bodyEl, {
                    animation: 200,
                    handle: '.drag-handle',
                    draggable: '.service-summary-card, .random-service-card',
                    ghostClass: 'sortable-ghost',
                    chosenClass: 'sortable-chosen',
                    onEnd: (evt) => {
                        if (evt.oldIndex === evt.newIndex) return;
                        saveUndoState();
                        const movedSrv = cat.services.splice(evt.oldIndex, 1)[0];
                        cat.services.splice(evt.newIndex, 0, movedSrv);
                        saveToStorage();
                        showToast('تم تحديث ترتيب المواقع', 'info');
                    }
                });
                sortableInstances.push(srvSortable);
            });
        }
    } else if (currentView === 'service-detail') {
        // 3. Links Reordering
        if (detailLinksList && !detailSearchQuery) {
            const cat = categoriesData.find(c => c.id === activeDetailCatId);
            const srv = cat ? (cat.services || []).find(s => s.id === activeDetailServiceId) : null;
            if (srv) {
                const linkSortable = new Sortable(detailLinksList, {
                    animation: 200,
                    handle: '.drag-handle',
                    ghostClass: 'sortable-ghost',
                    chosenClass: 'sortable-chosen',
                    onEnd: (evt) => {
                        if (evt.oldIndex === evt.newIndex) return;
                        saveUndoState();
                        const movedLink = srv.links.splice(evt.oldIndex, 1)[0];
                        srv.links.splice(evt.newIndex, 0, movedLink);
                        saveToStorage();
                        renderDetailView();
                        showToast('تم تحديث ترتيب الروابط', 'info');
                    }
                });
                sortableInstances.push(linkSortable);
            }
        }
    }
}

// ==========================================
// Category Add & Edit Operations
// ==========================================
function openAddCategoryModal() {
    newCategoryName.value = '';
    categoryModal.classList.add('active');
    setTimeout(() => newCategoryName.focus(), 100);
}

function closeCategoryModal() {
    categoryModal.classList.remove('active');
}

function handleCategoryFormSubmit(e) {
    e.preventDefault();
    const name = newCategoryName.value.trim();
    if (!name) return;

    const exists = categoriesData.some(c => c.name.toLowerCase() === name.toLowerCase());
    if (exists) {
        showToast('هذا التصنيف موجود بالفعل!', 'warning');
        return;
    }

    saveUndoState();

    const newCat = {
        id: 'cat-' + Date.now().toString() + Math.random().toString(36).substr(2, 4),
        name: name,
        services: []
    };

    categoriesData.push(newCat);
    saveToStorage();
    closeCategoryModal();
    render();
    showToast(`تم إنشاء تصنيف "${name}" بنجاح!`);
}

window.openEditCategoryModal = function(catId, currentName) {
    editCategoryTargetId.value = catId;
    editCategoryNewName.value = currentName;
    editCategoryModal.classList.add('active');
    setTimeout(() => editCategoryNewName.focus(), 100);
};

function closeEditCategoryModal() {
    editCategoryModal.classList.remove('active');
}

function handleEditCategoryFormSubmit(e) {
    e.preventDefault();
    const id = editCategoryTargetId.value;
    const newName = editCategoryNewName.value.trim();
    if (!id || !newName) return;

    const cat = categoriesData.find(c => c.id === id);
    if (cat) {
        saveUndoState();
        cat.name = newName;
        saveToStorage();
        closeEditCategoryModal();
        render();
        showToast('تم تحديث اسم التصنيف بنجاح');
    }
}

// ==========================================
// Link Add & Edit Modal
// ==========================================
function openAddModal() {
    modalTitle.textContent = 'إضافة رابط أو موقع جديد';
    editCatId.value = '';
    editServiceId.value = '';
    editLinkId.value = '';
    linkTagsInput.value = '';
    youtubeDetectedHint.style.display = 'none';
    duplicateWarningHint.style.display = 'none';
    linkForm.reset();
    linkModal.classList.add('active');
    setTimeout(() => categoryInput.focus(), 100);
}

window.openAddModalForCategory = function(catName) {
    openAddModal();
    categoryInput.value = catName;
    if (isRandomCategory({ name: catName })) {
        linkTitleInput.value = 'الصفحة الرئيسية';
    }
    setTimeout(() => serviceInput.focus(), 100);
};

window.openEditModal = function(catId, serviceId, linkId) {
    const cat = categoriesData.find(c => c.id === catId);
    if (!cat) return;
    const srv = (cat.services || []).find(s => s.id === serviceId);
    if (!srv) return;
    const link = (srv.links || []).find(l => l.id === linkId);
    if (!link) return;

    modalTitle.textContent = 'تعديل تفاصيل الرابط';
    editCatId.value = catId;
    editServiceId.value = serviceId;
    editLinkId.value = linkId;

    categoryInput.value = cat.name;
    serviceInput.value = srv.name;
    linkTitleInput.value = link.title;
    linkUrlInput.value = link.url;
    linkTagsInput.value = (link.tags || []).join('، ');
    linkNotesInput.value = link.notes || '';

    // Check YouTube
    const ytId = getYouTubeVideoId(link.url);
    youtubeDetectedHint.style.display = ytId ? 'block' : 'none';
    duplicateWarningHint.style.display = 'none';

    linkModal.classList.add('active');
    setTimeout(() => linkTitleInput.focus(), 100);
};

function closeModal() {
    linkModal.classList.remove('active');
    linkForm.reset();
    youtubeDetectedHint.style.display = 'none';
    duplicateWarningHint.style.display = 'none';
}

async function handleLinkFormSubmit(e) {
    e.preventDefault();

    const catName = categoryInput.value.trim();
    const srvName = serviceInput.value.trim();
    let title = linkTitleInput.value.trim();
    let url = linkUrlInput.value.trim();
    const notes = linkNotesInput.value.trim();

    if (!catName || !srvName || !title || !url) return;

    if (!/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
    }

    const currentCatId = editCatId.value;
    const currentServiceId = editServiceId.value;
    const currentLinkId = editLinkId.value;

    saveUndoState();

    // YouTube detection
    const ytId = getYouTubeVideoId(url);
    let isYouTube = Boolean(ytId);
    let ytThumbnail = ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : '';

    // Parse Tags
    const tags = linkTagsInput.value
        ? linkTagsInput.value.split(/[,،]/).map(t => t.trim()).filter(Boolean)
        : [];

    let isPinned = false;
    let createdAt = Date.now();

    if (currentLinkId) {
        // Preserve pin status & creation date if editing
        const oldCat = categoriesData.find(c => c.id === currentCatId);
        const oldSrv = oldCat ? (oldCat.services || []).find(s => s.id === currentServiceId) : null;
        const oldLnk = oldSrv ? (oldSrv.links || []).find(l => l.id === currentLinkId) : null;
        if (oldLnk) {
            isPinned = Boolean(oldLnk.isPinned);
            if (oldLnk.createdAt) createdAt = oldLnk.createdAt;
        }
        removeLinkById(currentCatId, currentServiceId, currentLinkId);
    }

    // Find or create Category
    let targetCat = categoriesData.find(c => c.name.toLowerCase() === catName.toLowerCase());
    if (!targetCat) {
        targetCat = {
            id: 'cat-' + Date.now().toString() + Math.random().toString(36).substr(2, 4),
            name: catName,
            services: []
        };
        categoriesData.push(targetCat);
    }

    // Find or create Service
    let targetSrv = (targetCat.services || []).find(s => s.name.toLowerCase() === srvName.toLowerCase());
    if (!targetSrv) {
        targetSrv = {
            id: 'srv-' + Date.now().toString() + Math.random().toString(36).substr(2, 4),
            name: srvName,
            isPinned: false,
            links: []
        };
        targetCat.services.push(targetSrv);
    }

    const newLink = {
        id: currentLinkId || ('lnk-' + Date.now().toString() + Math.random().toString(36).substr(2, 4)),
        title: title,
        url: url,
        notes: notes,
        tags: tags,
        isPinned: isPinned,
        createdAt: createdAt,
        isYouTube: isYouTube,
        ytVideoId: ytId || '',
        ytThumbnail: ytThumbnail
    };

    targetSrv.links.push(newLink);

    saveToStorage();
    closeModal();
    render();
    showToast(currentLinkId ? 'تم تحديث الرابط بنجاح' : 'تمت إضافة الرابط بنجاح');
}

function removeLinkById(catId, srvId, linkId) {
    const cat = categoriesData.find(c => c.id === catId);
    if (!cat) return;
    const srv = (cat.services || []).find(s => s.id === srvId);
    if (!srv) return;

    srv.links = (srv.links || []).filter(l => l.id !== linkId);
}

// ==========================================
// Deletions with Custom Confirmation Modal
// ==========================================
window.deleteLink = async function(catId, serviceId, linkId) {
    const confirmed = await showConfirmDialog(
        'تأكيد حذف الرابط',
        'هل أنت متأكد من رغبتك في حذف هذا الرابط؟ لن يمكنك استرجاعه بعد الحذف.'
    );
    if (!confirmed) return;

    saveUndoState();
    removeLinkById(catId, serviceId, linkId);
    saveToStorage();
    render();
    showToast('تم حذف الرابط بنجاح');
};

window.deleteService = async function(catId, serviceId) {
    const cat = categoriesData.find(c => c.id === catId);
    if (!cat) return;
    const srv = (cat.services || []).find(s => s.id === serviceId);
    if (!srv) return;

    const confirmed = await showConfirmDialog(
        `تأكيد حذف موقع "${srv.name}"`,
        `هل أنت متأكد من حذف هذا الموقع وجميع روابطه المندرجة تحته؟`
    );
    if (!confirmed) return;

    saveUndoState();
    cat.services = cat.services.filter(s => s.id !== serviceId);
    saveToStorage();
    render();
    showToast(`تم حذف موقع "${srv.name}" بنجاح`);
};

window.deleteCategory = async function(catId) {
    const cat = categoriesData.find(c => c.id === catId);
    if (!cat) return;

    const confirmed = await showConfirmDialog(
        `تأكيد حذف تصنيف "${cat.name}"`,
        `سيتم حذف هذا التصنيف وجميع المواقع والروابط بداخله بشكل نهائي. هل ترغب بالاستمرار؟`
    );
    if (!confirmed) return;

    saveUndoState();
    categoriesData = categoriesData.filter(c => c.id !== catId);
    if (activeCategoryFilter === catId) activeCategoryFilter = 'all';
    saveToStorage();
    render();
    showToast(`تم حذف تصنيف "${cat.name}"`);
};

async function deleteActiveService() {
    const cat = categoriesData.find(c => c.id === activeDetailCatId);
    if (!cat) return;
    const srv = (cat.services || []).find(s => s.id === activeDetailServiceId);
    if (!srv) return;

    const confirmed = await showConfirmDialog(
        `تأكيد حذف موقع "${srv.name}"`,
        `هل أنت متأكد من حذف هذا الموقع وجميع روابطه المندرجة تحته؟`
    );
    if (!confirmed) return;

    saveUndoState();
    cat.services = cat.services.filter(s => s.id !== activeDetailServiceId);
    saveToStorage();
    navigateToHome();
    showToast(`تم حذف موقع "${srv.name}" بنجاح`);
}

window.copyLink = function(url) {
    navigator.clipboard.writeText(url).then(() => {
        showToast('تم نسخ الرابط إلى الحافظة! 📋');
    }).catch(err => {
        showToast('تعذر نسخ الرابط', 'error');
    });
};

// ==========================================
// Export & Import
// ==========================================
function exportData() {
    const backupObj = {
        version: 3,
        categories: categoriesData,
        cachedFavicons: cachedFavicons,
        exportedAt: new Date().toISOString()
    };
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupObj, null, 2));
    const downloadAnchor = document.createElement('a');
    const filename = `links_hub_backup_${new Date().toISOString().slice(0, 10)}.json`;
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', filename);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('تم تصدير النسخة الاحتياطية بنجاح');
}

function importData(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            const imported = JSON.parse(event.target.result);
            saveUndoState();
            if (imported.categories && Array.isArray(imported.categories)) {
                categoriesData = imported.categories;
                if (imported.cachedFavicons) {
                    cachedFavicons = { ...cachedFavicons, ...imported.cachedFavicons };
                    saveCachedFavicons();
                }
            } else if (Array.isArray(imported)) {
                categoriesData = imported;
            } else {
                showToast('الملف غير مطابق لصيغة الروابط.', 'error');
                return;
            }
            saveToStorage();
            render();
            showToast('تم استيراد البيانات والأيقونات بنجاح!');
        } catch (err) {
            showToast('حدث خطأ أثناء قراءة ملف JSON.', 'error');
        }
        e.target.value = '';
    };
    reader.readAsText(file);
}

// ==========================================
// Move Service Modal
// ==========================================
function openMoveServiceModal() {
    const otherCats = categoriesData.filter(c => c.id !== activeDetailCatId);
    if (otherCats.length === 0) {
        showToast('لا توجد تصنيفات أخرى متاحة للنقل إليها.', 'warning');
        return;
    }

    moveServiceSelect.innerHTML = otherCats.map(c => `
        <option value="${c.id}">${escapeHtml(c.name)}</option>
    `).join('');

    moveServiceModal.classList.add('active');
}

function closeMoveServiceModal() {
    moveServiceModal.classList.remove('active');
}

function handleMoveServiceSubmit(e) {
    e.preventDefault();
    const targetCatId = moveServiceSelect.value;
    if (!targetCatId) return;

    const currentCat = categoriesData.find(c => c.id === activeDetailCatId);
    const targetCat = categoriesData.find(c => c.id === targetCatId);
    if (!currentCat || !targetCat) return;

    const srvIndex = (currentCat.services || []).findIndex(s => s.id === activeDetailServiceId);
    if (srvIndex === -1) return;

    saveUndoState();

    const [serviceToMove] = currentCat.services.splice(srvIndex, 1);
    if (!targetCat.services) targetCat.services = [];
    targetCat.services.push(serviceToMove);

    saveToStorage();
    closeMoveServiceModal();
    navigateToService(targetCat.id, serviceToMove.id);
    showToast(`تم نقل موقع "${serviceToMove.name}" إلى تصنيف "${targetCat.name}" بنجاح!`);
}

// ==========================================
// Custom Context Menu Operations
// ==========================================
function handleContextMenu(e) {
    const targetCard = e.target.closest('.service-summary-card, .random-service-card, .detail-link-card, .youtube-preview-card');
    if (!targetCard) {
        hideContextMenu();
        return;
    }

    e.preventDefault();

    const catId = targetCard.getAttribute('data-cat-id');
    const serviceId = targetCard.getAttribute('data-service-id');
    const linkId = targetCard.getAttribute('data-link-id');

    const cat = categoriesData.find(c => c.id === catId);
    const srv = cat ? (cat.services || []).find(s => s.id === serviceId) : null;
    let link = null;

    if (linkId && srv) {
        link = (srv.links || []).find(l => l.id === linkId);
    } else if (srv && srv.links && srv.links.length > 0) {
        link = srv.links[0];
    }

    const fullUrl = link ? (/^https?:\/\//i.test(link.url) ? link.url : 'https://' + link.url) : '';
    const isPinned = linkId ? (link ? Boolean(link.isPinned) : false) : (srv ? Boolean(srv.isPinned) : false);

    contextMenuData = {
        type: linkId ? 'link' : 'service',
        catId,
        serviceId,
        linkId,
        url: fullUrl,
        isPinned
    };

    ctxPinText.textContent = isPinned ? 'إلغاء التثبيت' : 'تثبيت في الأعلى 📌';

    // Position context menu
    contextMenu.style.display = 'block';
    const menuWidth = 210;
    const menuHeight = 220;

    let posX = e.clientX;
    let posY = e.clientY;

    if (posX + menuWidth > window.innerWidth) {
        posX = window.innerWidth - menuWidth - 10;
    }
    if (posY + menuHeight > window.innerHeight) {
        posY = window.innerHeight - menuHeight - 10;
    }

    contextMenu.style.left = `${posX}px`;
    contextMenu.style.top = `${posY}px`;
}

function hideContextMenu() {
    if (contextMenu) {
        contextMenu.style.display = 'none';
    }
    contextMenuData = null;
}

// ==========================================
// Event Listeners Binding
// ==========================================
function bindEvents() {
    // Theme toggle & Undo
    themeToggleBtn.addEventListener('click', toggleTheme);
    undoBtn.addEventListener('click', undo);

    // Navigation back to Home
    brandHomeBtn.addEventListener('click', navigateToHome);
    backToHomeBtn.addEventListener('click', navigateToHome);

    // Sorting Dropdown
    sortSelect.addEventListener('change', (e) => {
        currentSort = e.target.value;
        render();
    });

    // Clear Tags Filter
    clearTagsFilterBtn.addEventListener('click', () => {
        activeTagFilters.clear();
        render();
    });

    // Main Link Modal
    openAddModalBtn.addEventListener('click', openAddModal);
    closeModalBtn.addEventListener('click', closeModal);
    cancelModalBtn.addEventListener('click', closeModal);
    linkForm.addEventListener('submit', handleLinkFormSubmit);

    // YouTube URL live detection & Duplicate Warning
    linkUrlInput.addEventListener('input', async (e) => {
        const val = e.target.value.trim();

        // 1. YouTube detection
        const ytId = getYouTubeVideoId(val);
        if (ytId) {
            youtubeDetectedHint.style.display = 'block';
            if (!linkTitleInput.value.trim()) {
                const fetchedTitle = await fetchYouTubeTitle(val);
                if (fetchedTitle && !linkTitleInput.value.trim()) {
                    linkTitleInput.value = fetchedTitle;
                }
            }
            if (!serviceInput.value.trim()) {
                serviceInput.value = 'YouTube';
            }
            if (!categoryInput.value.trim()) {
                categoryInput.value = 'شروحات ومقاطع فيديو';
            }
        } else {
            youtubeDetectedHint.style.display = 'none';
        }

        // 2. Duplicate Detection
        const currentId = editLinkId.value;
        const dup = checkDuplicateUrl(val, currentId);
        if (dup) {
            duplicateWarningHint.style.display = 'block';
            duplicateWarningText.textContent = `تنبيه: هذا الرابط مسجل مسبقاً في "${dup.srvName}" ضمن تصنيف "${dup.catName}" (${dup.title})`;
        } else {
            duplicateWarningHint.style.display = 'none';
        }
    });

    // Move Service Modal
    moveCurrentServiceBtn.addEventListener('click', openMoveServiceModal);
    closeMoveServiceModalBtn.addEventListener('click', closeMoveServiceModal);
    cancelMoveServiceModalBtn.addEventListener('click', closeMoveServiceModal);
    moveServiceForm.addEventListener('submit', handleMoveServiceSubmit);

    // Open All Links in Service
    openAllLinksBtn.addEventListener('click', async () => {
        const cat = categoriesData.find(c => c.id === activeDetailCatId);
        const srv = cat ? (cat.services || []).find(s => s.id === activeDetailServiceId) : null;
        if (!srv || !srv.links || srv.links.length === 0) {
            showToast('لا توجد روابط في هذا الموقع لفتحها!', 'warning');
            return;
        }

        if (srv.links.length > 6) {
            const confirmed = await showConfirmDialog(
                'تأكيد فتح جميع الروابط',
                `سيتم فتح ${srv.links.length} تبويبات جديدة معاً في متصفحك. هل أنت متأكد من الاستمرار؟`
            );
            if (!confirmed) return;
        }

        srv.links.forEach(l => {
            const fullUrl = /^https?:\/\//i.test(l.url) ? l.url : 'https://' + l.url;
            window.open(fullUrl, '_blank');
        });
        showToast(`تم فتح ${srv.links.length} روابط في تبويبات جديدة! 🚀`);
    });

    // Add Category Modal
    openAddCategoryModalBtn.addEventListener('click', openAddCategoryModal);
    closeCategoryModalBtn.addEventListener('click', closeCategoryModal);
    cancelCategoryModalBtn.addEventListener('click', closeCategoryModal);
    categoryForm.addEventListener('submit', handleCategoryFormSubmit);

    // Edit Category Modal
    closeEditCategoryModalBtn.addEventListener('click', closeEditCategoryModal);
    cancelEditCategoryModalBtn.addEventListener('click', closeEditCategoryModal);
    editCategoryForm.addEventListener('submit', handleEditCategoryFormSubmit);

    // Confirm Dialog Events
    confirmOkBtn.addEventListener('click', () => closeConfirmModal(true));
    confirmCancelBtn.addEventListener('click', () => closeConfirmModal(false));

    // Detail View Actions
    addLinkToCurrentServiceBtn.addEventListener('click', () => {
        const cat = categoriesData.find(c => c.id === activeDetailCatId);
        const srv = cat ? (cat.services || []).find(s => s.id === activeDetailServiceId) : null;
        if (cat && srv) {
            openAddModal();
            categoryInput.value = cat.name;
            serviceInput.value = srv.name;
            setTimeout(() => linkTitleInput.focus(), 100);
        }
    });

    deleteCurrentServiceBtn.addEventListener('click', deleteActiveService);

    // Search Events
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        clearSearchBtn.style.display = searchQuery ? 'block' : 'none';
        render();
    });

    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        clearSearchBtn.style.display = 'none';
        render();
        searchInput.focus();
    });

    detailSearchInput.addEventListener('input', (e) => {
        detailSearchQuery = e.target.value;
        renderDetailView();
    });

    // Backup
    exportBtn.addEventListener('click', exportData);
    importInput.addEventListener('change', importData);

    // Custom Context Menu Events
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#contextMenu')) {
            hideContextMenu();
        }
    });

    ctxOpen.addEventListener('click', () => {
        if (contextMenuData && contextMenuData.url) {
            window.open(contextMenuData.url, '_blank');
        }
        hideContextMenu();
    });

    ctxCopy.addEventListener('click', () => {
        if (contextMenuData && contextMenuData.url) {
            copyLink(contextMenuData.url);
        }
        hideContextMenu();
    });

    ctxPin.addEventListener('click', () => {
        if (!contextMenuData) return;
        if (contextMenuData.type === 'link') {
            togglePinLink(contextMenuData.catId, contextMenuData.serviceId, contextMenuData.linkId);
        } else {
            togglePinService(contextMenuData.catId, contextMenuData.serviceId);
        }
        hideContextMenu();
    });

    ctxEdit.addEventListener('click', () => {
        if (!contextMenuData) return;
        if (contextMenuData.type === 'link') {
            openEditModal(contextMenuData.catId, contextMenuData.serviceId, contextMenuData.linkId);
        } else {
            openEditRandomModal(contextMenuData.catId, contextMenuData.serviceId);
        }
        hideContextMenu();
    });

    ctxDelete.addEventListener('click', () => {
        if (!contextMenuData) return;
        if (contextMenuData.type === 'link') {
            deleteLink(contextMenuData.catId, contextMenuData.serviceId, contextMenuData.linkId);
        } else {
            deleteService(contextMenuData.catId, contextMenuData.serviceId);
        }
        hideContextMenu();
    });

    // Keyboard Shortcuts & Escape Handler
    document.addEventListener('keydown', (e) => {
        // Ctrl+K -> Focus Search
        if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
            e.preventDefault();
            if (currentView !== 'home') navigateToHome();
            searchInput.focus();
            searchInput.select();
            return;
        }

        // Ctrl+N -> Add New Link/Service Modal
        if ((e.ctrlKey || e.metaKey) && (e.key === 'n' || e.key === 'N')) {
            e.preventDefault();
            openAddModal();
            return;
        }

        // Ctrl+Z -> Undo
        if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
            // Only trigger undo if not typing inside an input/textarea
            const tag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
            if (tag !== 'input' && tag !== 'textarea') {
                e.preventDefault();
                undo();
                return;
            }
        }

        // Escape Key
        if (e.key === 'Escape') {
            hideContextMenu();
            if (confirmModal.classList.contains('active')) closeConfirmModal(false);
            if (linkModal.classList.contains('active')) closeModal();
            if (moveServiceModal.classList.contains('active')) closeMoveServiceModal();
            if (categoryModal.classList.contains('active')) closeCategoryModal();
            if (editCategoryModal.classList.contains('active')) closeEditCategoryModal();
        }
    });
}

// Start Application
document.addEventListener('DOMContentLoaded', init);
