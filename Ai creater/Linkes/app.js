/**
 * Link Hub - Advanced Hierarchical Link & Website Manager
 */

const STORAGE_KEY = 'user_structured_links_v2';
const THEME_KEY = 'user_theme_preference';
const FAVICON_CACHE_KEY = 'cached_favicons_v2';

// Initial sample data showing the 3-level structure with YouTube preview
const INITIAL_DATA = [
    {
        id: 'cat-media',
        name: 'شروحات ومقاطع فيديو',
        services: [
            {
                id: 'srv-youtube',
                name: 'YouTube',
                links: [
                    {
                        id: 'lnk-yt-1',
                        title: 'كورس تعلم JavaScript للمبتدئين في ساعة واحدة',
                        url: 'https://www.youtube.com/watch?v=W6NZfCO5SIk',
                        notes: 'مرجع سريع للأساسيات ودوال اللغة الحديثة',
                        isYouTube: true,
                        ytVideoId: 'W6NZfCO5SIk',
                        ytThumbnail: 'https://img.youtube.com/vi/W6NZfCO5SIk/hqdefault.jpg'
                    },
                    {
                        id: 'lnk-yt-2',
                        title: 'طريقة بناء موقع كامل باستخدام HTML و CSS',
                        url: 'https://www.youtube.com/watch?v=FazgJVnrVuY',
                        notes: 'تطبيق عملي خطوة بخطوة',
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
                links: [
                    {
                        id: 'lnk-1',
                        title: 'المحادثة الرئيسية',
                        url: 'https://chatgpt.com',
                        notes: 'المساعد اليومي للبرمجة وكتابة النصوص'
                    },
                    {
                        id: 'lnk-2',
                        title: 'منصة المطورين (OpenAI API)',
                        url: 'https://platform.openai.com',
                        notes: 'مفاتيح الـ API والرصيد'
                    }
                ]
            },
            {
                id: 'srv-claude',
                name: 'Claude AI',
                links: [
                    {
                        id: 'lnk-3',
                        title: 'منصة المحادثة',
                        url: 'https://claude.ai',
                        notes: 'للمشاريع الطويلة ومراجعة الكود'
                    }
                ]
            },
            {
                id: 'srv-gemini',
                name: 'Google Gemini',
                links: [
                    {
                        id: 'lnk-gemini',
                        title: 'مساعد جوجل الذكي',
                        url: 'https://gemini.google.com',
                        notes: 'محرك جوجل المتعدد الوسائط'
                    }
                ]
            },
            {
                id: 'srv-v0',
                name: 'v0.dev',
                links: [
                    {
                        id: 'lnk-v0',
                        title: 'توليد واجهات المستخدم React',
                        url: 'https://v0.dev',
                        notes: 'إنشاء مكونات UI بالذكاء الاصطناعي'
                    }
                ]
            },
            {
                id: 'srv-huggingface',
                name: 'Hugging Face',
                links: [
                    {
                        id: 'lnk-hf',
                        title: 'منصة النماذج مفتوحة المصدر',
                        url: 'https://huggingface.co',
                        notes: 'نماذج ومساحات تجارب مجانية'
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
                links: [
                    {
                        id: 'lnk-5',
                        title: 'التخزين السحابي وملفاتي',
                        url: 'https://drive.google.com',
                        notes: 'المستندات، النماذج، والنسخ الاحتياطية'
                    }
                ]
            },
            {
                id: 'srv-fonts',
                name: 'Google Fonts',
                links: [
                    {
                        id: 'lnk-7',
                        title: 'مكتبة الخطوط العربية والإنجليزية',
                        url: 'https://fonts.google.com',
                        notes: 'تضمين الخطوط في مواقع الويب'
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
                links: [
                    {
                        id: 'lnk-rnd-1',
                        title: 'الصفحة الرئيسية',
                        url: 'https://ar.wikipedia.org',
                        notes: 'الموسوعة الحرة المفتوحة'
                    }
                ]
            },
            {
                id: 'srv-rnd-speed',
                name: 'Speedtest',
                links: [
                    {
                        id: 'lnk-rnd-2',
                        title: 'فحص سرعة الإنترنت',
                        url: 'https://www.speedtest.net',
                        notes: 'قياس سرعة الاتصال والـ Ping'
                    }
                ]
            },
            {
                id: 'srv-rnd-unsplash',
                name: 'Unsplash',
                links: [
                    {
                        id: 'lnk-rnd-3',
                        title: 'مكتبة الصور المجانية',
                        url: 'https://unsplash.com',
                        notes: 'خلفيات وصور بدقة عالية'
                    }
                ]
            },
            {
                id: 'srv-rnd-canva',
                name: 'Canva',
                links: [
                    {
                        id: 'lnk-rnd-4',
                        title: 'منصة التصميم السريع',
                        url: 'https://www.canva.com',
                        notes: 'تصاميم بوسترات وعروض تقديمية'
                    }
                ]
            },
            {
                id: 'srv-rnd-time',
                name: 'Time.is',
                links: [
                    {
                        id: 'lnk-rnd-5',
                        title: 'التوقيت الدقيق العالمي',
                        url: 'https://time.is',
                        notes: 'عرض الوقت بدقة في كل المدن'
                    }
                ]
            }
        ]
    }
];

// App State
let categoriesData = [];
let activeCategoryFilter = 'all';
let searchQuery = '';
let detailSearchQuery = '';
let currentView = 'home'; // 'home' or 'service-detail'
let activeDetailCatId = null;
let activeDetailServiceId = null;
let expandedCategories = new Set(); // IDs of categories expanded beyond 4 services
let cachedFavicons = {}; // { [domain]: base64DataUrl }

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
const categoryFilters = document.getElementById('categoryFilters');
const categorySuggestions = document.getElementById('categorySuggestions');
const serviceSuggestions = document.getElementById('serviceSuggestions');
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');

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
const linkNotesInput = document.getElementById('linkNotesInput');
const youtubeDetectedHint = document.getElementById('youtubeDetectedHint');
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

// Theme & Backup
const themeToggleBtn = document.getElementById('themeToggleBtn');
const exportBtn = document.getElementById('exportBtn');
const importInput = document.getElementById('importInput');
const toast = document.getElementById('toast');
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

// Favicon Local Caching (Indexed / LocalStorage)
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

// Convert image element to local Base64 on load
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
        let formattedUrl = urlString.trim();
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

    // 1. If already saved locally, return offline base64
    if (cachedFavicons[domain]) {
        return { src: cachedFavicons[domain], isCached: true, domain };
    }

    // 2. Otherwise return online Google favicon URL & trigger caching
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

// Toast
let toastTimeout;
function showToast(msg) {
    toastMessage.textContent = msg;
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

    // 1. Calculate stats
    let totalServices = 0;
    let totalLinks = 0;

    categoriesData.forEach(cat => {
        totalServices += (cat.services || []).length;
        (cat.services || []).forEach(srv => {
            totalLinks += (srv.links || []).length;
        });
    });

    totalCategoriesCount.textContent = categoriesData.length;
    totalServicesCount.textContent = totalServices;
    totalLinksCount.textContent = totalLinks;

    updateSuggestions();
    renderCategoryFilterChips();

    // 2. Filter categories & websites
    const filteredCategories = filterCategoriesData();

    if (filteredCategories.length === 0) {
        categoriesGrid.innerHTML = '';
        emptyState.style.display = 'block';
    } else {
        emptyState.style.display = 'none';
        categoriesGrid.innerHTML = filteredCategories.map(cat => createCategoryCardHtml(cat)).join('');
    }
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

function filterCategoriesData() {
    const q = searchQuery.toLowerCase().trim();

    return categoriesData
        .filter(cat => activeCategoryFilter === 'all' || cat.id === activeCategoryFilter)
        .map(cat => {
            if (!q) return cat;

            const catMatches = cat.name.toLowerCase().includes(q);
            const matchingServices = (cat.services || []).filter(srv => {
                const srvMatches = srv.name.toLowerCase().includes(q);
                const hasMatchingLink = (srv.links || []).some(lnk => {
                    return lnk.title.toLowerCase().includes(q) ||
                           lnk.url.toLowerCase().includes(q) ||
                           (lnk.notes && lnk.notes.toLowerCase().includes(q));
                });
                return srvMatches || hasMatchingLink;
            });

            if (catMatches || matchingServices.length > 0) {
                return {
                    ...cat,
                    services: catMatches ? cat.services : matchingServices
                };
            }
            return null;
        })
        .filter(Boolean);
}

// Helper to identify Random category
function isRandomCategory(cat) {
    if (!cat || !cat.name) return false;
    const name = cat.name.trim().toLowerCase();
    return name === 'random' || name === 'عشوائي' || Boolean(cat.isRandom);
}

// ==========================================
// View 1 (Home) - Category Card with 4-item limit
// ==========================================
function createCategoryCardHtml(cat) {
    const services = cat.services || [];
    const totalCatLinks = services.reduce((acc, s) => acc + (s.links ? s.links.length : 0), 0);
    const servicesCount = services.length;
    const isExpanded = expandedCategories.has(cat.id);
    const isRandom = isRandomCategory(cat);

    // Limit to 4 services unless expanded
    const displayServices = (servicesCount > 4 && !isExpanded) ? services.slice(0, 4) : services;

    let servicesHtml = '';
    if (services.length > 0) {
        if (isRandom) {
            // For Random: display direct homepage cards (no sub-page)
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

            <div class="category-body">
                ${servicesHtml}
                ${toggleBtnHtml}
            </div>
        </div>
    `;
}

// Random Category Website Card (مواقع رئيسية مباشرة دون صفحة فرعية)
function createRandomServiceCardHtml(catId, srv) {
    const link = (srv.links && srv.links.length > 0) ? srv.links[0] : null;
    const url = link ? link.url : '';
    const fullUrl = /^https?:\/\//i.test(url) ? url : 'https://' + url;
    const domain = getDomain(url) || url;
    const iconData = getFavicon(url);

    return `
        <div class="random-service-card" data-service-id="${srv.id}">
            <a href="${escapeHtml(fullUrl)}" target="_blank" rel="noopener noreferrer" class="random-service-left" title="فتح الموقع مباشرة في تبويب جديد: ${escapeHtml(fullUrl)}">
                ${iconData.src ? `
                    <img src="${iconData.src}" class="service-favicon" alt="" 
                         onload="cacheImageLocally('${iconData.domain}', this)"
                         onerror="this.outerHTML='<div class=\\'service-fallback-icon\\'><i class=\\'fa-solid fa-globe\\'></i></div>';">
                ` : `
                    <div class="service-fallback-icon"><i class="fa-solid fa-globe"></i></div>
                `}
                <div class="random-service-meta">
                    <span class="random-service-name">${escapeHtml(srv.name)}</span>
                    <span class="random-service-url">${escapeHtml(domain)}</span>
                </div>
            </a>

            <div class="random-service-actions">
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

function createServiceSummaryCardHtml(catId, srv) {
    const firstUrl = (srv.links && srv.links.length > 0) ? srv.links[0].url : '';
    const iconData = getFavicon(firstUrl);
    const linksCount = (srv.links || []).length;

    return `
        <div class="service-summary-card" onclick="navigateToService('${catId}', '${srv.id}')" title="انقر لعرض روابط هذا الموقع">
            <div class="service-summary-left">
                ${iconData.src ? `
                    <img src="${iconData.src}" class="service-favicon" alt="" 
                         onload="cacheImageLocally('${iconData.domain}', this)"
                         onerror="this.outerHTML='<div class=\\'service-fallback-icon\\'><i class=\\'fa-solid fa-globe\\'></i></div>';">
                ` : `
                    <div class="service-fallback-icon"><i class="fa-solid fa-globe"></i></div>
                `}
                <span class="service-summary-name">${escapeHtml(srv.name)}</span>
            </div>

            <div class="service-summary-right">
                <span class="service-badge">${linksCount} روابط</span>
                <i class="fa-solid fa-arrow-left service-go-icon"></i>
            </div>
        </div>
    `;
}

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
    const filteredLinks = links.filter(l => {
        if (!q) return true;
        return l.title.toLowerCase().includes(q) ||
               l.url.toLowerCase().includes(q) ||
               (l.notes && l.notes.toLowerCase().includes(q));
    });

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
}

function createDetailLinkRowHtml(catId, serviceId, link, index) {
    const fullUrl = /^https?:\/\//i.test(link.url) ? link.url : 'https://' + link.url;
    const domain = getDomain(link.url) || link.url;
    const isYt = link.isYouTube || Boolean(getYouTubeVideoId(link.url));

    // YouTube Card Style
    if (isYt) {
        const videoId = link.ytVideoId || getYouTubeVideoId(link.url);
        const thumb = link.ytThumbnail || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

        return `
            <li class="youtube-preview-card" data-link-id="${link.id}">
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
                        <h4 class="detail-link-title">${escapeHtml(link.title)}</h4>
                        <a href="${escapeHtml(fullUrl)}" target="_blank" rel="noopener noreferrer" class="detail-link-url" title="${escapeHtml(fullUrl)}">
                            ${escapeHtml(fullUrl)}
                        </a>
                        ${link.notes ? `<div class="detail-link-notes">${escapeHtml(link.notes)}</div>` : ''}
                    </div>
                </div>

                <div class="link-actions-group">
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
        <li class="detail-link-card" data-link-id="${link.id}">
            <div class="detail-link-left">
                <div class="link-index-badge">${index}</div>
                <div class="detail-link-info">
                    <h4 class="detail-link-title">${escapeHtml(link.title)}</h4>
                    <a href="${escapeHtml(fullUrl)}" target="_blank" rel="noopener noreferrer" class="detail-link-url" title="${escapeHtml(fullUrl)}">
                        ${escapeHtml(domain)}
                    </a>
                    ${link.notes ? `<div class="detail-link-notes">${escapeHtml(link.notes)}</div>` : ''}
                </div>
            </div>

            <div class="link-actions-group">
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
        alert('هذا التصنيف موجود بالفعل!');
        return;
    }

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
    youtubeDetectedHint.style.display = 'none';
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
    linkNotesInput.value = link.notes || '';

    // Check YouTube
    const ytId = getYouTubeVideoId(link.url);
    youtubeDetectedHint.style.display = ytId ? 'block' : 'none';

    linkModal.classList.add('active');
    setTimeout(() => linkTitleInput.focus(), 100);
};

function closeModal() {
    linkModal.classList.remove('active');
    linkForm.reset();
    youtubeDetectedHint.style.display = 'none';
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

    // YouTube detection
    const ytId = getYouTubeVideoId(url);
    let isYouTube = Boolean(ytId);
    let ytThumbnail = ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : '';

    if (currentLinkId) {
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
            links: []
        };
        targetCat.services.push(targetSrv);
    }

    const newLink = {
        id: currentLinkId || ('lnk-' + Date.now().toString() + Math.random().toString(36).substr(2, 4)),
        title: title,
        url: url,
        notes: notes,
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

    removeLinkById(catId, serviceId, linkId);
    saveToStorage();
    render();
    showToast('تم حذف الرابط بنجاح');
};

window.deleteCategory = async function(catId) {
    const cat = categoriesData.find(c => c.id === catId);
    if (!cat) return;

    const confirmed = await showConfirmDialog(
        `تأكيد حذف تصنيف "${cat.name}"`,
        `سيتم حذف هذا التصنيف وجميع المواقع والروابط بداخله بشكل نهائي. هل ترغب بالاستمرار؟`
    );
    if (!confirmed) return;

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

    cat.services = cat.services.filter(s => s.id !== activeDetailServiceId);
    saveToStorage();
    navigateToHome();
    showToast(`تم حذف موقع "${srv.name}" بنجاح`);
}

window.copyLink = function(url) {
    navigator.clipboard.writeText(url).then(() => {
        showToast('تم نسخ الرابط إلى الحافظة! 📋');
    }).catch(err => {
        showToast('تعذر نسخ الرابط');
    });
};

// ==========================================
// Export & Import
// ==========================================
function exportData() {
    const backupObj = {
        version: 2,
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
            if (imported.categories && Array.isArray(imported.categories)) {
                categoriesData = imported.categories;
                if (imported.cachedFavicons) {
                    cachedFavicons = { ...cachedFavicons, ...imported.cachedFavicons };
                    saveCachedFavicons();
                }
            } else if (Array.isArray(imported)) {
                categoriesData = imported;
            } else {
                alert('الملف غير مطابق لصيغة الروابط.');
                return;
            }
            saveToStorage();
            render();
            showToast('تم استيراد البيانات والأيقونات بنجاح!');
        } catch (err) {
            alert('حدث خطأ أثناء قراءة ملف JSON.');
        }
        e.target.value = '';
    };
    reader.readAsText(file);
}

// ==========================================
// Event Listeners
// ==========================================
function bindEvents() {
    // Theme toggle
    themeToggleBtn.addEventListener('click', toggleTheme);

    // Navigation back to Home
    brandHomeBtn.addEventListener('click', navigateToHome);
    backToHomeBtn.addEventListener('click', navigateToHome);

    // Main Link Modal
    openAddModalBtn.addEventListener('click', openAddModal);
    closeModalBtn.addEventListener('click', closeModal);
    cancelModalBtn.addEventListener('click', closeModal);
    linkForm.addEventListener('submit', handleLinkFormSubmit);

    // YouTube URL live detection in form
    linkUrlInput.addEventListener('input', async (e) => {
        const val = e.target.value.trim();
        const ytId = getYouTubeVideoId(val);
        if (ytId) {
            youtubeDetectedHint.style.display = 'block';
            // Auto fill title if empty
            if (!linkTitleInput.value.trim()) {
                const fetchedTitle = await fetchYouTubeTitle(val);
                if (fetchedTitle && !linkTitleInput.value.trim()) {
                    linkTitleInput.value = fetchedTitle;
                }
            }
            // Auto fill service as YouTube if empty
            if (!serviceInput.value.trim()) {
                serviceInput.value = 'YouTube';
            }
            if (!categoryInput.value.trim()) {
                categoryInput.value = 'شروحات ومقاطع فيديو';
            }
        } else {
            youtubeDetectedHint.style.display = 'none';
        }
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

    // Keyboard & backdrop close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (confirmModal.classList.contains('active')) closeConfirmModal(false);
            if (linkModal.classList.contains('active')) closeModal();
            if (categoryModal.classList.contains('active')) closeCategoryModal();
            if (editCategoryModal.classList.contains('active')) closeEditCategoryModal();
        }
    });
}

// Start
document.addEventListener('DOMContentLoaded', init);
