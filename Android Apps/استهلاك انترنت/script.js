document.addEventListener('DOMContentLoaded', () => {
    // --- 1. Selection of Elements ---
    const gbInput = document.getElementById('gb');
    const daysInput = document.getElementById('days');
    const expiryDateInput = document.getElementById('expiry-date');
    const daysGroup = document.getElementById('days-input-group');
    const dateGroup = document.getElementById('date-input-group');
    const modeBtns = document.querySelectorAll('.mode-btn');
    const presetBtns = document.querySelectorAll('.preset-btn');
    const resetBtn = document.getElementById('reset-btn');
    const themeToggleBtn = document.getElementById('theme-toggle');

    const optionalSection = document.getElementById('optional-section');
    const totalGbInput = document.getElementById('total-gb');
    const totalDaysInput = document.getElementById('total-days');

    const resultContainer = document.getElementById('result-container');
    const mainResultEl = document.getElementById('main-result');
    const subResultEl = document.getElementById('sub-result');
    const progressBar = document.getElementById('consumption-progress');
    const statusBadge = document.getElementById('status-badge');
    const comparisonCard = document.getElementById('comparison-card');
    const comparisonContent = document.getElementById('comparison-content');
    const estimatorGrid = document.getElementById('estimator-grid');

    const gbError = document.getElementById('gb-error');
    const daysError = document.getElementById('days-error');
    const dateError = document.getElementById('date-error');
    const totalError = document.getElementById('total-error');

    let currentMode = 'days'; // 'days' or 'date'

    // --- 2. Theme Management ---
    function applyTheme(theme) {
        if (theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            themeToggleBtn.textContent = '☀️';
            themeToggleBtn.setAttribute('aria-label', 'التبديل إلى الوضع النهاري');
        } else {
            document.documentElement.removeAttribute('data-theme');
            themeToggleBtn.textContent = '🌙';
            themeToggleBtn.setAttribute('aria-label', 'التبديل إلى الوضع الليلي');
        }
    }

    function initTheme() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            applyTheme(savedTheme);
        } else {
            const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            applyTheme(prefersDark ? 'dark' : 'light');
        }
    }

    themeToggleBtn.addEventListener('click', () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const nextTheme = isDark ? 'light' : 'dark';
        applyTheme(nextTheme);
        localStorage.setItem('theme', nextTheme);
    });

    // --- 3. Date Helpers ---
    function getLocalTodayStr() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    expiryDateInput.setAttribute('min', getLocalTodayStr());

    // --- 4. Mode Switcher (Days vs Expiry Date) ---
    function setMode(mode) {
        currentMode = mode;
        modeBtns.forEach(b => {
            const isActive = b.dataset.mode === currentMode;
            b.classList.toggle('active', isActive);
            b.setAttribute('aria-pressed', String(isActive));
        });

        if (currentMode === 'days') {
            daysGroup.classList.remove('hidden');
            dateGroup.classList.add('hidden');
        } else {
            daysGroup.classList.add('hidden');
            dateGroup.classList.remove('hidden');
        }
    }

    modeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            setMode(btn.dataset.mode);
            calculateAndUpdate();
        });
    });

    // --- 5. Quick Preset Buttons ---
    function updatePresetHighlight() {
        const currentDays = daysInput.value.trim();
        presetBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.days === currentDays);
        });
    }

    presetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            daysInput.value = btn.dataset.days;
            updatePresetHighlight();
            calculateAndUpdate();
        });
    });

    // --- 6. Load Saved Data ---
    function loadSavedData() {
        initTheme();
        const savedGb = localStorage.getItem('savedGb');
        const savedDays = localStorage.getItem('savedDays');
        const savedDate = localStorage.getItem('savedDate');
        const savedMode = localStorage.getItem('savedMode');
        const savedTotalGb = localStorage.getItem('savedTotalGb');
        const savedTotalDays = localStorage.getItem('savedTotalDays');

        if (savedGb) gbInput.value = savedGb;
        if (savedDays) daysInput.value = savedDays;
        if (savedDate) expiryDateInput.value = savedDate;
        if (savedTotalGb) totalGbInput.value = savedTotalGb;
        if (savedTotalDays) totalDaysInput.value = savedTotalDays;

        if (savedTotalGb || savedTotalDays) {
            optionalSection.open = true;
        }

        if (savedMode === 'days' || savedMode === 'date') {
            setMode(savedMode);
        }

        updatePresetHighlight();

        if (gbInput.value && (daysInput.value || expiryDateInput.value)) {
            calculateAndUpdate();
        }
    }

    // --- 7. Main Calculation Logic ---
    function calculateAndUpdate() {
        gbError.textContent = '';
        daysError.textContent = '';
        dateError.textContent = '';
        totalError.textContent = '';

        const gbStr = gbInput.value.trim();
        const gb = parseFloat(gbStr);

        let days = 0;
        let hasError = false;

        localStorage.setItem('savedMode', currentMode);

        if (gbStr !== '' && !isNaN(gb)) {
            localStorage.setItem('savedGb', gbStr);
        } else {
            localStorage.removeItem('savedGb');
        }

        if (gbStr === '' || isNaN(gb) || gb < 0) {
            if (gbStr !== '') gbError.textContent = 'أدخل قيمة صالحة للجيجابايت.';
            hasError = true;
        }

        if (currentMode === 'days') {
            const daysStr = daysInput.value.trim();
            days = parseInt(daysStr, 10);
            updatePresetHighlight();

            if (daysStr !== '' && !isNaN(days)) {
                localStorage.setItem('savedDays', daysStr);
            } else {
                localStorage.removeItem('savedDays');
            }

            if (daysStr === '' || isNaN(days) || days <= 0) {
                if (daysStr !== '') daysError.textContent = 'أدخل عدد أيام أكبر من 0.';
                hasError = true;
            }
        } else {
            const dateStr = expiryDateInput.value;
            if (dateStr) {
                localStorage.setItem('savedDate', dateStr);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const expiryDate = new Date(dateStr + 'T00:00:00');

                const diffDays = Math.round((expiryDate - today) / (1000 * 60 * 60 * 24));

                if (diffDays < 0) {
                    dateError.textContent = 'تاريخ التجديد يجب أن يكون اليوم أو في المستقبل.';
                    hasError = true;
                } else {
                    // If today is selected (diffDays === 0), treat as 1 remaining day
                    days = Math.max(1, diffDays);
                }
            } else {
                localStorage.removeItem('savedDate');
                hasError = true;
            }
        }

        if (hasError || days <= 0 || isNaN(gb) || gb < 0) {
            resultContainer.classList.add('hidden');
            return;
        }

        const dailyGb = gb / days;
        const dailyMb = dailyGb * 1024;

        updateResultDisplay(dailyGb, dailyMb);
        updateProgressBar(dailyGb, gb);
        updateComparison(gb, days);
        updateEstimatorGrid(dailyMb, dailyGb);
    }

    // --- 8. UI Update Subroutines ---
    function updateResultDisplay(dailyGb, dailyMb) {
        resultContainer.classList.remove('hidden');
        if (dailyGb < 1) {
            mainResultEl.innerHTML = `${dailyMb.toFixed(0)} <span class="unit">MB</span>`;
            subResultEl.textContent = `(أي ${dailyGb.toFixed(2)} GB في اليوم)`;
        } else {
            mainResultEl.innerHTML = `${dailyGb.toFixed(2)} <span class="unit">GB</span>`;
            subResultEl.textContent = `(أي ${dailyMb.toFixed(0)} MB في اليوم)`;
        }
    }

    function updateProgressBar(dailyGb, totalRemainingGb) {
        let widthPercent = 0;
        let statusClass = '';
        let badgeText = '';
        let badgeClass = '';

        if (totalRemainingGb === 0) {
            widthPercent = 0;
            statusClass = 'status-high';
            badgeText = '🔴 انتهت الباقة (0 MB متبقية)';
            badgeClass = 'badge-high';
        } else if (dailyGb >= 2.5) {
            widthPercent = 100;
            statusClass = 'status-safe';
            badgeText = '🟢 حصة يومية ممتازة (وفيرة)';
            badgeClass = 'badge-safe';
        } else if (dailyGb >= 0.6) {
            widthPercent = Math.min(100, Math.max(35, (dailyGb / 2.5) * 100));
            statusClass = 'status-moderate';
            badgeText = '🟡 حصة يومية متوسطة';
            badgeClass = 'badge-moderate';
        } else {
            widthPercent = Math.max(15, (dailyGb / 0.6) * 35);
            statusClass = 'status-high';
            badgeText = '🔴 حصة يومية منخفضة جداً (حرجة)';
            badgeClass = 'badge-high';
        }

        progressBar.style.width = `${widthPercent}%`;
        progressBar.className = 'progress-bar ' + statusClass;

        statusBadge.textContent = badgeText;
        statusBadge.className = 'status-badge ' + badgeClass;
    }

    function updateComparison(remainingGb, remainingDays) {
        const totalGbStr = totalGbInput.value.trim();
        const totalDaysStr = totalDaysInput.value.trim();

        if (totalGbStr !== '') {
            localStorage.setItem('savedTotalGb', totalGbStr);
        } else {
            localStorage.removeItem('savedTotalGb');
        }

        if (totalDaysStr !== '') {
            localStorage.setItem('savedTotalDays', totalDaysStr);
        } else {
            localStorage.removeItem('savedTotalDays');
        }

        if (!totalGbStr || !totalDaysStr) {
            comparisonCard.classList.add('hidden');
            return;
        }

        const totalGb = parseFloat(totalGbStr);
        const totalDays = parseInt(totalDaysStr, 10);

        if (isNaN(totalGb) || totalGb <= 0 || isNaN(totalDays) || totalDays <= 0) {
            totalError.textContent = 'أدخل قيماً صالحة لإجمالي الباقة ومدتها.';
            comparisonCard.classList.add('hidden');
            return;
        }

        if (totalGb < remainingGb) {
            totalError.textContent = 'إجمالي الباقة يجب أن يكون أكبر أو يساوي الرصيد المتبقي.';
            comparisonCard.classList.add('hidden');
            return;
        }

        if (totalDays < remainingDays) {
            totalError.textContent = 'مدة الباقة يجب أن تكون أكبر أو تساوي الأيام المتبقية.';
            comparisonCard.classList.add('hidden');
            return;
        }

        const consumedGb = totalGb - remainingGb;
        const elapsedDays = totalDays - remainingDays;
        const normalDailyRate = totalGb / totalDays;
        const remainingPercent = (remainingGb / totalGb) * 100;

        let statusHtml = '';
        let actualRateText = '—';

        if (elapsedDays > 0) {
            const actualDailyRate = consumedGb / elapsedDays;
            actualRateText = `${actualDailyRate.toFixed(2)} GB / يوم`;

            if (actualDailyRate > normalDailyRate * 1.1) {
                const daysUntilEmpty = actualDailyRate > 0 ? Math.floor(remainingGb / actualDailyRate) : remainingDays;
                statusHtml = `<div class="comp-status badge-high">⚠️ استهلاكك أسرع من الطبيعي (قد تنتهي خلال ~${daysUntilEmpty} يوم)</div>`;
            } else if (actualDailyRate < normalDailyRate * 0.9) {
                statusHtml = `<div class="comp-status badge-safe">✅ استهلاكك أوفر من المعدل الطبيعي</div>`;
            } else {
                statusHtml = `<div class="comp-status badge-moderate">⚖️ استهلاكك متوازن مع مدة الباقة</div>`;
            }
        } else {
            statusHtml = `<div class="comp-status badge-moderate">📌 بداية الباقة — المعدل الطبيعي ${normalDailyRate.toFixed(2)} GB/يوم</div>`;
        }

        comparisonContent.innerHTML = `
            <div class="comp-row">
                <span class="comp-label">المتبقي من الباقة</span>
                <span class="comp-value">${remainingPercent.toFixed(0)}% (${remainingGb.toFixed(1)} من ${totalGb} GB)</span>
            </div>
            <div class="comp-row">
                <span class="comp-label">المعدل الطبيعي للباقة</span>
                <span class="comp-value">${normalDailyRate.toFixed(2)} GB / يوم</span>
            </div>
            <div class="comp-row">
                <span class="comp-label">معدل استهلاكك الفعلي</span>
                <span class="comp-value">${actualRateText}</span>
            </div>
            ${statusHtml}
        `;

        comparisonCard.classList.remove('hidden');
    }

    function formatTimeEstimate(hours) {
        if (hours >= 24) {
            return 'طوال اليوم (24+ ساعة)';
        }
        if (hours < 1) {
            const mins = Math.round(hours * 60);
            return `${mins} دقيقة`;
        }
        return `${hours.toFixed(1)} ساعة`;
    }

    function updateEstimatorGrid(dailyMb, dailyGb) {
        const youtubeHours = dailyGb / 1.2;
        const socialHours = dailyMb / 150;
        const videoCallHours = dailyMb / 350;
        const musicHours = dailyMb / 50;

        estimatorGrid.innerHTML = `
            <div class="est-item">
                <div class="icon">🎬</div>
                <div class="value">${formatTimeEstimate(youtubeHours)}</div>
                <div class="label">فيديو HD يومياً</div>
            </div>
            <div class="est-item">
                <div class="icon">📱</div>
                <div class="value">${formatTimeEstimate(socialHours)}</div>
                <div class="label">سوشيال ميديا</div>
            </div>
            <div class="est-item">
                <div class="icon">📞</div>
                <div class="value">${formatTimeEstimate(videoCallHours)}</div>
                <div class="label">مكالمات فيديو</div>
            </div>
            <div class="est-item">
                <div class="icon">🎵</div>
                <div class="value">${formatTimeEstimate(musicHours)}</div>
                <div class="label">استماع للموسيقى</div>
            </div>
        `;
    }

    // --- 9. Reset Functionality ---
    resetBtn.addEventListener('click', () => {
        gbInput.value = '';
        daysInput.value = '';
        expiryDateInput.value = '';
        totalGbInput.value = '';
        totalDaysInput.value = '';

        localStorage.removeItem('savedGb');
        localStorage.removeItem('savedDays');
        localStorage.removeItem('savedDate');
        localStorage.removeItem('savedTotalGb');
        localStorage.removeItem('savedTotalDays');

        gbError.textContent = '';
        daysError.textContent = '';
        dateError.textContent = '';
        totalError.textContent = '';

        updatePresetHighlight();
        comparisonCard.classList.add('hidden');
        resultContainer.classList.add('hidden');
        gbInput.focus();
    });

    // --- 10. Event Listeners ---
    gbInput.addEventListener('input', calculateAndUpdate);
    daysInput.addEventListener('input', calculateAndUpdate);
    expiryDateInput.addEventListener('change', calculateAndUpdate);
    totalGbInput.addEventListener('input', calculateAndUpdate);
    totalDaysInput.addEventListener('input', calculateAndUpdate);

    // Initial load
    loadSavedData();

    // --- 11. PWA Service Worker Registration ---
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
});
