document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const searchResults = document.getElementById('searchResults');
    const generationsContainer = document.getElementById('generationsContainer');
    
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
        title.textContent = generation.generation_name;
        header.appendChild(title);
        
        const membersContainer = document.createElement('div');
        membersContainer.className = 'generation-members';
        
        // تجميع الأبناء حسب parentId
        const parentsMap = {};
        generation.members.forEach(member => {
            let parentName = '';
            if (generation.generation_number >= 3 && member.parentId) {
                for (let gen of familyData) {
                    const parent = gen.members.find(m => m.id === member.parentId);
                    if (parent) {
                        parentName = parent.name;
                        break;
                    }
                }
            }
            member.parentName = parentName; // مهم للبحث المتقدم
            if (!parentsMap[parentName]) {
                parentsMap[parentName] = [];
            }
            parentsMap[parentName].push(member);
        });

        Object.keys(parentsMap).forEach(parentName => {
            const familyDiv = document.createElement('div');
            familyDiv.className = 'family';
            
            const parentNameDiv = document.createElement('div');
            parentNameDiv.className = 'parent-name';
            parentNameDiv.textContent = parentName;
            familyDiv.appendChild(parentNameDiv);
            
            const childrenDiv = document.createElement('div');
            childrenDiv.className = 'children';
            parentsMap[parentName].forEach(child => {
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
        name.href = `person.html?id=${member.id}`;
        name.textContent = member.name;
        name.onclick = (e) => {
            e.preventDefault();
            navigateToPersonPage(member.id);
        };
        
        card.appendChild(name);
        return card;
    }
    
    function navigateToPersonPage(personId) {
        window.location.href = `person.html?id=${personId}`;
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
    }
    
    function performSearch(query) {
        const results = familyData.flatMap(generation => 
            generation.members.filter(member => {
                const nameMatch = member.name.toLowerCase().includes(query.toLowerCase());
                const generationMatch = generation.generation_name.toLowerCase().includes(query.toLowerCase());
                const parentMatch = member.parentName?.toLowerCase().includes(query.toLowerCase());
                return nameMatch || generationMatch || parentMatch;
            }).map(member => ({
                ...member,
                generation_name: generation.generation_name
            }))
        );
        displaySearchResults(results);
    }
    
    function displaySearchResults(results) {
        searchResults.innerHTML = '';
        if (results.length === 0) {
            const noResults = document.createElement('div');
            noResults.className = 'search-result-item';
            noResults.innerHTML = '<div class="search-result-name">لا توجد نتائج</div>';
            searchResults.appendChild(noResults);
        } else {
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
        name.textContent = person.name;
        const generation = document.createElement('div');
        generation.className = 'search-result-generation';
        generation.textContent = person.generation_name;
        item.appendChild(name);
        item.appendChild(generation);
        return item;
    }
    
    function hideSearchResults() {
        searchResults.classList.add('hidden');
    }
    
    searchInput.focus();
    
    addVisualEffects();
    
    function addVisualEffects() {
        const generationCards = document.querySelectorAll('.generation-card');
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
            card.style.transform = 'translateY(20px)';
            card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
            observer.observe(card);
        });
    }
});