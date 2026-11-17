/**
 * تطبيق وِرد | Wird
 * وحدة التحكم الرئيسية، إدارة التوجيه، الشريط السفلي وتهيئة التطبيق
 */

import { db } from './db.js';
import { AzkarService } from './services/azkar-service.js';
import { ReviewService } from './services/review-service.js';
import { renderIcon } from './ui/icons.js';
import { UIComponents } from './ui/components.js';

import { HomeView } from './ui/views/home-view.js';
import { LibraryView } from './ui/views/library-view.js';
import { ReaderView } from './ui/views/reader-view.js';
import { MemoryView } from './ui/views/memory-view.js';
import { ReviewView } from './ui/views/review-view.js';
import { FavoritesView } from './ui/views/favorites-view.js';
import { SettingsView } from './ui/views/settings-view.js';

class App {
  constructor() {
    this.currentView = 'home';
    this.currentParams = {};
    this.container = null;
    this.bottomNav = null;
  }

  async init() {
    this.container = document.getElementById('app-view-container');
    this.bottomNav = document.getElementById('bottom-nav');

    // تطبيق السمة وحجم الخط فوراً
    this.initThemeAndFont();

    // تهيئة قاعدة البيانات والبيانات الافتراضية
    try {
      await db.init();
      await AzkarService.initDefaults();
    } catch (e) {
      console.error('خطأ في تهيئة قاعدة البيانات:', e);
    }

    // بناء الشريط السفلي
    this.renderBottomNavigation();

    // استعادة المسار من الـ Hash أو الافتراضي
    window.addEventListener('hashchange', () => this.handleHashChange());
    this.handleHashChange();

    // تحديث شارة المراجعات الدورية
    this.updateReviewBadge();
  }

  initThemeAndFont() {
    const savedTheme = localStorage.getItem('wird_theme') || 'system';
    const savedFontSize = localStorage.getItem('wird_font_size') || 'normal';

    window.applyTheme = (theme) => {
      if (theme === 'system') {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
      } else {
        document.documentElement.setAttribute('data-theme', theme);
      }
    };

    window.applyFontSize = (size) => {
      document.documentElement.setAttribute('data-font-size', size);
    };

    window.applyTheme(savedTheme);
    window.applyFontSize(savedFontSize);

    // الاستماع لتغير وضع النظام في حال كان الاختيار "تلقائي"
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      const current = localStorage.getItem('wird_theme') || 'system';
      if (current === 'system') {
        document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
      }
    });
  }

  renderBottomNavigation() {
    if (!this.bottomNav) return;

    this.bottomNav.innerHTML = `
      <div class="bottom-nav-inner">
        <button class="nav-item ${this.currentView === 'home' ? 'active' : ''}" data-view="home">
          <span class="nav-icon">${renderIcon('home')}</span>
          <span class="nav-label">الرئيسية</span>
        </button>

        <button class="nav-item ${this.currentView === 'library' ? 'active' : ''}" data-view="library">
          <span class="nav-icon">${renderIcon('library')}</span>
          <span class="nav-label">المكتبة</span>
        </button>

        <button class="nav-item ${this.currentView === 'review' ? 'active' : ''}" data-view="review">
          <span class="nav-icon position-relative">
            ${renderIcon('review')}
            <span class="nav-badge" id="nav-due-badge" style="display:none"></span>
          </span>
          <span class="nav-label">المراجعة</span>
        </button>

        <button class="nav-item ${this.currentView === 'favorites' ? 'active' : ''}" data-view="favorites">
          <span class="nav-icon">${renderIcon('favorite')}</span>
          <span class="nav-label">المفضلة</span>
        </button>

        <button class="nav-item ${this.currentView === 'settings' ? 'active' : ''}" data-view="settings">
          <span class="nav-icon">${renderIcon('settings')}</span>
          <span class="nav-label">الإعدادات</span>
        </button>
      </div>
    `;

    this.bottomNav.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        this.navigateTo(view);
      });
    });
  }

  async updateReviewBadge() {
    const badge = document.getElementById('nav-due-badge');
    if (!badge) return;

    try {
      const dueList = await ReviewService.getDueReviews();
      if (dueList.length > 0) {
        badge.textContent = dueList.length > 99 ? '+99' : UIComponents.toArabicNumerals(dueList.length);
        badge.style.display = 'flex';
      } else {
        badge.style.display = 'none';
      }
    } catch (e) {
      badge.style.display = 'none';
    }
  }

  navigateTo(view, params = {}) {
    let hash = `#${view}`;
    if (Object.keys(params).length > 0) {
      const query = new URLSearchParams(params).toString();
      hash += `?${query}`;
    }
    window.location.hash = hash;
  }

  handleHashChange() {
    const rawHash = window.location.hash.slice(1);
    let view = 'home';
    let params = {};

    if (rawHash) {
      const [viewPart, queryPart] = rawHash.split('?');
      view = viewPart || 'home';
      if (queryPart) {
        params = Object.fromEntries(new URLSearchParams(queryPart));
      }
    }

    this.currentView = view;
    this.currentParams = params;

    // تحديث التحديد في الشريط السفلي
    if (this.bottomNav) {
      this.bottomNav.querySelectorAll('.nav-item').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
      });
      // إخفاء الشريط السفلي في شاشة الحفظ أو القراءة لتوفير مساحة تركيز نقية
      if (view === 'memory' || view === 'reader') {
        this.bottomNav.style.display = 'none';
      } else {
        this.bottomNav.style.display = 'block';
      }
    }

    this.renderCurrentView();
    this.updateReviewBadge();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  async renderCurrentView() {
    if (!this.container) return;

    const navigate = (v, p) => this.navigateTo(v, p);

    switch (this.currentView) {
      case 'home':
        await HomeView.render(this.container, navigate);
        break;
      case 'library':
        await LibraryView.render(this.container, navigate, this.currentParams);
        break;
      case 'reader':
        await ReaderView.render(this.container, navigate, this.currentParams);
        break;
      case 'memory':
        await MemoryView.render(this.container, navigate, this.currentParams);
        break;
      case 'review':
        await ReviewView.render(this.container, navigate, this.currentParams);
        break;
      case 'favorites':
        await FavoritesView.render(this.container, navigate);
        break;
      case 'settings':
        await SettingsView.render(this.container, navigate);
        break;
      default:
        await HomeView.render(this.container, navigate);
    }
  }
}

// بدء التطبيق بعد تحميل المستند
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
});
