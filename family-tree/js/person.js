// JavaScript لصفحة الشخص الفردية

document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const personId = urlParams.get('id');
    
    if (!personId) {
        showError('لم يتم تحديد الشخص المطلوب');
        return;
    }
    
    const person = getPersonById(personId);
    
    if (!person) {
        showError('الشخص المطلوب غير موجود');
        return;
    }
    
    displayPersonInfo(person);
    displayPersonChildren(person);

    // --- تم تعديل هذه الدالة ---
    function displayPersonInfo(person) {
        document.getElementById('pageTitle').textContent = `${person.name} - شجرة العائلة`;
        
        const personImage = document.getElementById('personImage');

        // --- هذا هو الجزء الجديد والمهم ---
        // 1. منطق اختيار الصورة الصحيحة بناءً على الجنس
        let imageSrc = person.image;
        if (!imageSrc || !imageSrc.includes('.')) {
            if (person.gender === 'female') {
                imageSrc = 'images/female-avatar.jpg';
            } else {
                imageSrc = 'images/default-avatar.jpg';
            }
        }
        // ------------------------------------

        // 2. استخدام رابط الصورة الصحيح وتعيين دالة onerror كحل احتياطي
        personImage.src = imageSrc;
        personImage.alt = person.name;
        personImage.onerror = function() { 
            // إذا فشل تحميل الصورة (حتى الصورة الرمزية)، اعرض صورة الذكر كحل أخير
            this.src = 'images/default-avatar.jpg'; 
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
                parentLink.onclick = (e) => { e.preventDefault(); navigateToPersonPage(parent.id); };
                parentElement.appendChild(parentLink);
            } else {
                parentElement.textContent = "غير متوفر";
            }
        } else {
            parentElement.textContent = "غير متوفر";
        }
        
        document.getElementById('personBio').textContent = person.bio || 'لا توجد معلومات إضافية متاحة.';
    }
    
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
            row.style.marginBottom = '1rem';

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
        
        const name = document.createElement('a');
        name.className = 'child-name';
        name.href = `person.html?id=${child.id}`;
        name.textContent = child.name;
        name.onclick = (e) => { e.preventDefault(); navigateToPersonPage(child.id); };
        
        card.appendChild(name);
        return card;
    }
    
    function navigateToPersonPage(personId) {
        window.location.href = `person.html?id=${personId}`;
    }
    
    function formatDate(dateString) {
        if (!dateString) return 'غير محدد';
        const date = new Date(dateString);
        return date.toLocaleDateString('ar', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
    
    function showError(message) {
        const container = document.querySelector('.container');
        container.innerHTML = `
            <div style="text-align: center; padding: 2rem; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <h2 style="color: #e74c3c; margin-bottom: 1rem;">خطأ</h2>
                <p style="color: #7f8c8d; margin-bottom: 2rem;">${message}</p>
                <a href="index.html" style="background: #3498db; color: white; padding: 0.75rem 1.5rem; text-decoration: none; border-radius: 5px; display: inline-block;">العودة للصفحة الرئيسية</a>
            </div>
        `;
    }
    
    function addVisualEffects() {
        const personProfile = document.querySelector('.person-profile');
        const childrenSection = document.querySelector('.children-section');
        const parentLink = document.querySelector('#personParent a');

        if (personProfile) {
            personProfile.style.opacity = '0';
            personProfile.style.transform = 'translateY(20px)';
            personProfile.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
            setTimeout(() => { personProfile.style.opacity = '1'; personProfile.style.transform = 'translateY(0)'; }, 100);
        }

        if (parentLink) {
            parentLink.style.opacity = '0';
            parentLink.style.transition = 'opacity 0.5s ease';
            setTimeout(() => { parentLink.style.opacity = '1'; }, 150);
        }

        if (childrenSection && !childrenSection.classList.contains('hidden')) {
            childrenSection.style.opacity = '0';
            childrenSection.style.transform = 'translateY(20px)';
            childrenSection.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
            setTimeout(() => { childrenSection.style.opacity = '1'; childrenSection.style.transform = 'translateY(0)'; }, 300);
        }

        const personImage = document.getElementById('personImage');
        if (personImage) {
            personImage.style.opacity = '0';
            personImage.style.transition = 'opacity 0.5s ease';
            personImage.onload = function() { this.style.opacity = '1'; };
        }
    }

    addVisualEffects();

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') { window.location.href = 'index.html'; }
    });
});
