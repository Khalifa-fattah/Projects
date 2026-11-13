// JavaScript للصفحة الرئيسية (قائمة الأجيال)

document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const searchResults = document.getElementById('searchResults');
    const generationsContainer = document.getElementById('generationsContainer');
    
    // سنة حقوق النشر
    const yearSpan = document.getElementById('currentYear');
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }

    // تنبيه البيانات المعدلة محلياً
    const customDataNotice = document.getElementById('customDataNotice');
    const resetDataLink = document.getElementById('resetDataLink');
    if (typeof isCustomDataLoaded === 'function' && isCustomDataLoaded()) {
        if (customDataNotice) customDataNotice.style.display = 'flex';
    }
    if (resetDataLink) {
        resetDataLink.addEventListener('click', function(e) {
            e.preventDefault();
            if (confirm('هل أنت متأكد من رغبتك في استعادة البيانات الأصلية وإلغاء جميع التعديلات المحلية؟')) {
                resetFamilyData();
                window.location.reload();
            }
        });
    }

    loadGenerations();
    setupSearch();
    
    function loadGenerations() {
        generationsContainer.innerHTML = '';
        familyData.forEach(generation => {
            const generationCard = createGenerationCard(generation);
            generationsContainer.appendChild(generationCard);
        });
    }
    
    function createGenerationCard(generation) {
        const card = document.createElement('div');
        card.className = 'generation-card';
        
        const header = document.createElement('div');
        header.className = 'generation-header';
        const title = document.createElement('h2');
        title.className = 'generation-title';
        const memberCount = generation.members ? generation.members.length : 0;
        title.textContent = `${generation.generation_name} (${memberCount} فرد)`;
        header.appendChild(title);
        
        const membersContainer = document.createElement('div');
        membersContainer.className = 'generation-members';
        
        // تجميع الأبناء حسب الوالد
        const parentsMap = {};
        
        if (generation.members) {
            generation.members.forEach(member => {
                let parentLabel = '';
                if (generation.generation_number > 1 && member.parentId) {
                    const parent = getPersonById(member.parentId);
                    if (parent) {
                        parentLabel = `أبناء: ${parent.name}`;
                    } else {
                        parentLabel = 'أفراد بدون والد مسجل';
                    }
                } else if (generation.generation_number === 1) {
                    parentLabel = ''; // الجيل الأول - الأجداد المؤسسون
                }

                if (!parentsMap[parentLabel]) {
                    parentsMap[parentLabel] = [];
                }
                parentsMap[parentLabel].push(member);
            });
        }

        Object.keys(parentsMap).forEach(parentLabel => {
            const familyDiv = document.createElement('div');
            familyDiv.className = 'family';
            
            // إضافة عنوان الوالد فقط إذا كان معرفاً وغير فارغ
            if (parentLabel && parentLabel.trim() !== '') {
                const parentNameDiv = document.createElement('div');
                parentNameDiv.className = 'parent-name';
                parentNameDiv.textContent = parentLabel;
                familyDiv.appendChild(parentNameDiv);
            }
            
            const childrenDiv = document.createElement('div');
            childrenDiv.className = 'children';
            parentsMap[parentLabel].forEach(child => {
                const childCard = createMemberCard(child);
                childrenDiv.appendChild(childCard);
            });
            
            familyDiv.appendChild(childrenDiv);
            membersContainer.appendChild(familyDiv);
        });
        
        card.appendChild(header);
        card.appendChild(membersContainer);
        return card;
    }
    
    function createMemberCard(member) {
        const card = document.createElement('div');
        card.className = 'member-card';
        card.onclick = () => navigateToPersonPage(member.id);
        
        const name = document.createElement('a');
        name.className = 'member-name';
        name.href = `person.html?id=${encodeURIComponent(member.id)}`;
        
        const genderIcon = member.gender === 'female' ? '🌸 ' : '';
        name.textContent = genderIcon + member.name;
        name.onclick = (e) => {
            e.preventDefault();
            navigateToPersonPage(member.id);
        };
        
        card.appendChild(name);
        return card;
    }
    
    function navigateToPersonPage(personId) {
        window.location.href = `person.html?id=${encodeURIComponent(personId)}`;
    }
    
    function setupSearch() {
        searchInput.addEventListener('input', function() {
            const query = this.value.trim();
            if (query.length > 0) performSearch(query);
            else hideSearchResults();
        });

        searchBtn.addEventListener('click', () => {
            const query = searchInput.value.trim();
            if (query.length > 0) performSearch(query);
        });

        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                const query = this.value.trim();
                if (query.length > 0) performSearch(query);
            }
        });

        document.addEventListener('click', function(e) {
            if (!searchResults.contains(e.target) && 
                !searchInput.contains(e.target) && 
                !searchBtn.contains(e.target)) {
                hideSearchResults();
            }
        });

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                hideSearchResults();
                searchInput.value = '';
            }
        });
    }
    
    function performSearch(query) {
        // استخدام دالة البحث المتقدمة والمطبعة للعربية من data.js
        const results = searchPeople(query);
        displaySearchResults(results);
    }
    
    function displaySearchResults(results) {
        searchResults.innerHTML = '';
        if (results.length === 0) {
            const noResults = document.createElement('div');
            noResults.className = 'search-result-item';
            noResults.innerHTML = '<div class="search-result-name" style="color: #e74c3c;">لا توجد نتائج مطابقة</div>';
            searchResults.appendChild(noResults);
        } else {
            // عرض عدد النتائج
            const countHeader = document.createElement('div');
            countHeader.style.padding = '6px 12px';
            countHeader.style.fontSize = '0.85rem';
            countHeader.style.color = '#7f8c8d';
            countHeader.style.borderBottom = '1px solid #ecf0f1';
            countHeader.textContent = `تم العثور على ${results.length} نتيجة:`;
            searchResults.appendChild(countHeader);

            results.forEach(person => {
                const resultItem = createSearchResultItem(person);
                searchResults.appendChild(resultItem);
            });
        }
        searchResults.classList.remove('hidden');
    }
    
    function createSearchResultItem(person) {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        item.onclick = () => {
            navigateToPersonPage(person.id);
            hideSearchResults();
        };

        const name = document.createElement('div');
        name.className = 'search-result-name';
        const genderIcon = person.gender === 'female' ? '🌸 ' : '👤 ';
        name.textContent = genderIcon + person.name;

        const info = document.createElement('div');
        info.className = 'search-result-generation';
        let parentTxt = '';
        if (person.parentId && personIndex[person.parentId]) {
            parentTxt = ` - ابن/ابنة: ${personIndex[person.parentId].name}`;
        }
        info.textContent = `${person.generation_name}${parentTxt}`;

        item.appendChild(name);
        item.appendChild(info);
        return item;
    }
    
    function hideSearchResults() {
        searchResults.classList.add('hidden');
    }
    
    addVisualEffects();
    
    function addVisualEffects() {
        const generationCards = document.querySelectorAll('.generation-card');
        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.style.opacity = '1';
                        entry.target.style.transform = 'translateY(0)';
                    }
                });
            }, { threshold: 0.1 });

            generationCards.forEach(card => {
                card.style.opacity = '0';
                card.style.transform = 'translateY(15px)';
                card.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
                observer.observe(card);
            });
        }
    }
});
