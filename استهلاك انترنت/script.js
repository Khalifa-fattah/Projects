document.addEventListener('DOMContentLoaded', () => {
    // --- 1. Elements Selection ---
    const gbInput = document.getElementById('gb');
    const daysInput = document.getElementById('days');
    const resultContainer = document.getElementById('result-container');
    const mainResultEl = document.getElementById('main-result');
    const subResultEl = document.getElementById('sub-result');
    const progressBar = document.getElementById('consumption-progress');
    const gbError = document.getElementById('gb-error');
    const daysError = document.getElementById('days-error');
    const tableContainer = document.getElementById('weekly-table-container');

    // --- 2. Load Saved Data from localStorage ---
    function loadSavedData() {
        const savedGb = localStorage.getItem('savedGb');
        const savedDays = localStorage.getItem('savedDays');

        if (savedGb) {
            gbInput.value = savedGb;
        }
        if (savedDays) {
            daysInput.value = savedDays;
        }
        
        // Trigger calculation if both values are loaded
        if (savedGb && savedDays) {
            calculateAndUpdate();
        }
    }

    // --- 3. Main Calculation and Update Function ---
    function calculateAndUpdate() {
        // Clear previous errors and table
        gbError.textContent = '';
        daysError.textContent = '';
        tableContainer.innerHTML = '';

        const gb = parseFloat(gbInput.value);
        const days = parseInt(daysInput.value);

        // Save current values to localStorage
        if (gbInput.value) localStorage.setItem('savedGb', gbInput.value);
        if (daysInput.value) localStorage.setItem('savedDays', daysInput.value);

        // Validation
        let hasError = false;
        if (isNaN(gb) || gb < 0) {
            gbError.textContent = 'أدخل قيمة صالحة للجيجابايت.';
            hasError = true;
        }
        if (isNaN(days) || days <= 0) {
            daysError.textContent = 'أدخل عدد أيام أكبر من صفر.';
            hasError = true;
        }

        if (hasError || !gbInput.value || !daysInput.value) {
            resultContainer.classList.add('hidden');
            return;
        }

        // Calculations
        const dailyGb = gb / days;
        const dailyMb = dailyGb * 1024;

        // Update UI
        updateResultDisplay(dailyGb, dailyMb);
        updateProgressBar(dailyGb);
        generateWeeklyTable(days, dailyGb);
    }

    // --- 4. UI Update Functions ---
    function updateResultDisplay(dailyGb, dailyMb) {
        resultContainer.classList.remove('hidden');
        if (dailyGb < 1) {
            mainResultEl.innerHTML = `${dailyMb.toFixed(0)} <span class="unit">MB</span>`;
            subResultEl.textContent = `(أي ${dailyGb.toFixed(2)} GB)`;
        } else {
            mainResultEl.innerHTML = `${dailyGb.toFixed(2)} <span class="unit">GB</span>`;
            subResultEl.textContent = `(أي ${dailyMb.toFixed(0)} MB)`;
        }
    }

    function updateProgressBar(dailyGb) {
        let widthPercent = 0;
        let statusClass = '';

        if (dailyGb <= 0.5) {
            widthPercent = (dailyGb / 2) * 100;
            statusClass = 'status-safe';
        } else if (dailyGb <= 2) {
            widthPercent = Math.min(100, 50 + ((dailyGb - 0.5) / 1.5) * 50);
            statusClass = 'status-moderate';
        } else {
            widthPercent = 100;
            statusClass = 'status-high';
        }
        
        progressBar.style.width = `${widthPercent}%`;
        progressBar.className = 'progress-bar';
        progressBar.classList.add(statusClass);
    }

    function generateWeeklyTable(totalDays, dailyGb) {
        // Show table only if there are days to show, up to 7
        const daysToShow = Math.min(totalDays,daysInput.value);
        
        let tableHTML = `
            <table class="weekly-table">
                <thead>
                    <tr>
                        <th>اليوم</th>
                        <th>الاستهلاك اليومي</th>
                        <th>الإجمالي المستهلك</th>
                    </tr>
                </thead>
                <tbody>
        `;

        for (let i = 1; i <= daysToShow; i++) {
            const totalConsumedGb = i * dailyGb;
            const dailyDisplay = dailyGb < 1 ? `${(dailyGb * 1024).toFixed(0)} MB` : `${dailyGb.toFixed(2)} GB`;
            
            tableHTML += `
                <tr>
                    <td>اليوم ${i}</td>
                    <td>${dailyDisplay}</td>
                    <td>${totalConsumedGb.toFixed(2)} GB</td>
                </tr>
            `;
        }

        tableHTML += `</tbody></table>`;
        tableContainer.innerHTML = tableHTML;
    }

    // --- 5. Event Listeners ---
    gbInput.addEventListener('input', calculateAndUpdate);
    daysInput.addEventListener('input', calculateAndUpdate);

    // --- 6. Initial Load ---
    loadSavedData();
});
