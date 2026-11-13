// JavaScript لصفحة الشخص الفردية

document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const personId = urlParams.get('id');
    
    // تعيين سنة حقوق النشر
    const yearSpan = document.getElementById('currentYear');
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }
    
    if (!personId) {
        showError('لم يتم تحديد الشخص المطلوب');
        return;
    }
    
    const person = getPersonById(personId);
    
    if (!person) {
        showError('الشخص المطلوب غير موجود في شجرة العائلة');
        return;
    }
    
    displayPersonInfo(person);
    displayAncestorChain(person);
    displayPersonSiblings(person);
    displayPersonChildren(person);

    function displayPersonInfo(person) {
        document.getElementById('pageTitle').textContent = `${person.name} - شجرة العائلة`;
        
        const personImage = document.getElementById('personImage');

        // تحديد الصورة الصحيحة مع وجود صورة SVG افتراضية
        let defaultAvatar = person.gender === 'female' ? 'images/female-avatar.svg' : 'images/default-avatar.svg';
        let imageSrc = person.image && person.image.trim() !== '' ? person.image : defaultAvatar;

        personImage.src = imageSrc;
        personImage.alt = person.name;
        personImage.onerror = function() {
            // حل بديل آمن لمنع حلقات الخطأ اللانهائية
            if (this.src !== defaultAvatar) {
                this.src = defaultAvatar;
            }
        };
        
        document.getElementById('personName').textContent = person.name;
        document.getElementById('personBirthDate').textContent = formatDate(person.birth_date);
        document.getElementById('personGeneration').textContent = getPersonGeneration(person.id);

        // اسم الوالد كرابط
        const parentElement = document.getElementById("personParent");
        parentElement.innerHTML = '';
        if (person.parentId) {
            const parent = getPersonById(person.parentId);
            if (parent) {
                const parentLink = document.createElement('a');
                parentLink.textContent = parent.name;
                parentLink.href = `person.html?id=${parent.id}`;
                parentElement.appendChild(parentLink);
            } else {
                parentElement.textContent = "غير مسجل";
            }
        } else {
            parentElement.textContent = "غير مسجل (الجيل الأول)";
        }

        // الزوج / الزوجة إن وجد
        const partnerItem = document.getElementById('partnerItem');
        const partnerElem = document.getElementById('personPartner');
        if (person.partnerId && partnerItem && partnerElem) {
            const partner = getPersonById(person.partnerId);
            if (partner) {
                partnerItem.style.display = 'flex';
                partnerElem.innerHTML = `<a href="person.html?id=${partner.id}" style="color: var(--secondary-color); text-decoration: none; font-weight: 600;">${partner.name}</a>`;
            }
        }
        
        document.getElementById('personBio').textContent = person.bio && person.bio.trim() !== '' 
            ? person.bio 
            : 'لا توجد معلومات إضافية مسجلة.';

        // زر التعديل
        const editBtn = document.getElementById('editPersonBtn');
        if (editBtn) {
            editBtn.href = `edit.html?editId=${encodeURIComponent(person.id)}`;
        }
    }

    // عرض سلسلة النسب (Breadcrumbs)
    function displayAncestorChain(person) {
        const chainContainer = document.getElementById('ancestorChain');
        const linksContainer = document.getElementById('ancestorLinks');
        if (!chainContainer || !linksContainer) return;

        const ancestors = typeof getPersonAncestors === 'function' ? getPersonAncestors(person.id) : [];
        
        linksContainer.innerHTML = '';
        
        if (ancestors.length === 0) {
            linksContainer.innerHTML = `<span class="current-person">${person.name} (رأس الشجرة)</span>`;
            return;
        }

        ancestors.forEach((anc) => {
            const a = document.createElement('a');
            a.href = `person.html?id=${anc.id}`;
            a.textContent = anc.name;
            linksContainer.appendChild(a);

            const sep = document.createElement('span');
            sep.className = 'separator';
            sep.textContent = ' ← ';
            linksContainer.appendChild(sep);
        });

        const currentSpan = document.createElement('span');
        currentSpan.className = 'current-person';
        currentSpan.textContent = person.name;
        linksContainer.appendChild(currentSpan);
    }

    // عرض قائمة الإخوة والأخوات
    function displayPersonSiblings(person) {
        const siblingsSection = document.getElementById('siblingsSection');
        const siblingsContainer = document.getElementById('siblingsContainer');
        if (!siblingsSection || !siblingsContainer) return;

        const siblings = typeof getPersonSiblings === 'function' ? getPersonSiblings(person.id) : [];
        if (siblings.length === 0) {
            siblingsSection.classList.add('hidden');
            return;
        }

        siblingsSection.classList.remove('hidden');
        siblingsContainer.innerHTML = '';

        siblings.forEach(sib => {
            const a = document.createElement('a');
            a.className = 'sibling-badge';
            a.href = `person.html?id=${sib.id}`;
            const genderIcon = sib.gender === 'female' ? '🌸' : '👤';
            a.innerHTML = `<span>${genderIcon}</span><span>${sib.name}</span>`;
            siblingsContainer.appendChild(a);
        });
    }
    
    // عرض قائمة الأبناء
    function displayPersonChildren(person) {
        const childrenContainer = document.getElementById('childrenContainer');
        const childrenSection = document.getElementById('childrenSection');
        const noChildrenMessage = document.getElementById('noChildrenMessage');
        
        const children = getPersonChildren(person.id);
        
        if (children.length === 0) {
            childrenSection.classList.add('hidden');
            noChildrenMessage.classList.remove('hidden');
            return;
        }
        
        childrenSection.classList.remove('hidden');
        noChildrenMessage.classList.add('hidden');
        childrenContainer.innerHTML = '';

        children.forEach((child) => {
            const row = document.createElement('div');
            row.className = 'children-row';
            row.style.display = 'flex';
            row.style.justifyContent = 'center';
            row.style.marginBottom = '0.75rem';

            const childCard = createChildCard(child);
            childCard.style.flex = '1';
            childCard.style.maxWidth = '100%';
            row.appendChild(childCard);

            childrenContainer.appendChild(row);
        });
    }
    
    function createChildCard(child) {
        const card = document.createElement('div');
        card.className = 'child-card';
        card.style.textAlign = 'center';
        card.style.cursor = 'pointer';
        card.onclick = () => { window.location.href = `person.html?id=${child.id}`; };
        
        const name = document.createElement('a');
        name.className = 'child-name';
        name.href = `person.html?id=${child.id}`;
        const genderIcon = child.gender === 'female' ? '🌸 ' : '👤 ';
        name.textContent = genderIcon + child.name;
        name.onclick = (e) => {
            e.preventDefault();
            window.location.href = `person.html?id=${child.id}`;
        };
        
        card.appendChild(name);
        return card;
    }
    
    // دالة مرنة ومحسنة لمعالجة وتنسيق التواريخ
    function formatDate(dateString) {
        if (!dateString || dateString.toString().trim() === '') return 'غير محدد';
        const str = dateString.toString().trim();
        
        // إذا كان الإدخال سنة فقط من 4 أرقام
        if (/^\d{4}$/.test(str)) {
            return `${str} م`;
        }
        
        // محاولة التحويل لتاريخ قياسي
        const date = new Date(str);
        if (!isNaN(date.getTime())) {
            return date.toLocaleDateString('ar-EG', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }
        
        // إذا كان نصاً مخصصاً (مثل تقريبي أو هجري) أظهره كما هو
        return str;
    }
    
    function showError(message) {
        const container = document.querySelector('.container');
        if (!container) return;
        container.innerHTML = `
            <div style="text-align: center; padding: 3rem 1.5rem; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin-top: 2rem;">
                <h2 style="color: #e74c3c; margin-bottom: 1rem;">عفواً، تنبيه</h2>
                <p style="color: #7f8c8d; margin-bottom: 2rem; font-size: 1.1rem;">${message}</p>
                <div style="display: flex; justify-content: center; gap: 1rem; flex-wrap: wrap;">
                    <a href="index.html" class="btn-tree" style="background-color: var(--secondary-color); color: white;">العودة لقائمة الأجيال</a>
                    <a href="tree.html" class="btn-tree">عرض الشجرة المرئية</a>
                </div>
            </div>
        `;
    }
    
    function addVisualEffects() {
        const personProfile = document.querySelector('.person-profile');
        if (personProfile) {
            personProfile.style.opacity = '0';
            personProfile.style.transform = 'translateY(15px)';
            personProfile.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            setTimeout(() => { 
                personProfile.style.opacity = '1'; 
                personProfile.style.transform = 'translateY(0)'; 
            }, 50);
        }
    }

    addVisualEffects();

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') { window.location.href = 'index.html'; }
    });
});
