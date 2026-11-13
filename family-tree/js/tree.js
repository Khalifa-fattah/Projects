// كود شجرة العائلة الرسومية باستخدام OrgChart

window.onload = function () {
    // تعيين سنة حقوق النشر
    const yearSpan = document.getElementById('currentYear');
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }

    // 1. تعريف القالب المخصص للصور
    OrgChart.templates.photo_template = Object.assign({}, OrgChart.templates.base);
    OrgChart.templates.photo_template.size = [120, 140];
    OrgChart.templates.photo_template.node =
        '<rect x="0" y="0" width="120" height="140" fill="#ffffff" rx="8" ry="8" stroke="#cbd5e1" stroke-width="1.5"></rect>' +
        '<clipPath id="clip"><circle cx="60" cy="55" r="42"></circle></clipPath>' +
        '<image preserveAspectRatio="xMidYMid slice" clip-path="url(#clip)" xlink:href="{val}" x="18" y="13" width="84" height="84"></image>';
    OrgChart.templates.photo_template.field_0 =
        '<text style="font-size: 15px; font-weight: 700; font-family: Cairo, sans-serif;" fill="#2c3e50" x="60" y="122" text-anchor="middle">{val}</text>';
    OrgChart.templates.photo_template.img_0 = '';

    // 2. تحويل البيانات مع بناء مسارات الصور
    const chartData = [];
    const baseUrl = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);

    familyData.forEach(generation => {
        const generationTag = `gen-${generation.generation_number}`;
        if (!generation.members) return;

        generation.members.forEach(person => {
            let imageUrl = person.image;

            if (imageUrl && imageUrl.trim() !== '') {
                imageUrl = baseUrl + imageUrl;
            } else {
                if (person.gender === 'female') {
                    imageUrl = baseUrl + 'images/female-avatar.svg';
                } else {
                    imageUrl = baseUrl + 'images/default-avatar.svg';
                }
            }

            let personNode = {
                id: person.id,
                pid: person.parentId || null,
                name: person.name,
                img: imageUrl,
                tags: [generationTag]
            };

            if (person.partnerId) {
                personNode.pids = [person.partnerId];
            }
            chartData.push(personNode);
        });
    });

    // 3. إعدادات الشجرة
    const treeContainer = document.getElementById("tree");
    if (!treeContainer) return;

    var chart = new OrgChart(treeContainer, {
        nodes: chartData,
        template: "photo_template",
        lazyLoading: false,
        dragScrool: true, 
        nodeBinding: {
            val: "img",
            field_0: "name"
        },
        tags: { "gen-1": {}, "gen-2": {}, "gen-3": {}, "gen-4": {} },
        partnerSeparation: 120,
        enableSearch: true,
        rootId: "person1_1",
        mouseScrool: OrgChart.action.zoom,
        layout: OrgChart.mixed,
        scaleInitial: OrgChart.match.boundary,
        // عند النقر على الشخص، الذهاب لصفحته الشخصية
        onClick: function(sender, args) {
            if (args && args.node && args.node.id) {
                window.location.href = `person.html?id=${encodeURIComponent(args.node.id)}`;
                return false;
            }
        }
    });

    // أحداث أزرار شريط التحكم
    const zoomInBtn = document.getElementById('zoomInBtn');
    if (zoomInBtn) {
        zoomInBtn.addEventListener('click', () => {
            if (chart.zoom) chart.zoom(true);
        });
    }

    const zoomOutBtn = document.getElementById('zoomOutBtn');
    if (zoomOutBtn) {
        zoomOutBtn.addEventListener('click', () => {
            if (chart.zoom) chart.zoom(false);
        });
    }

    const fitBtn = document.getElementById('fitBtn');
    if (fitBtn) {
        fitBtn.addEventListener('click', () => {
            if (chart.fit) chart.fit();
        });
    }

    const centerRootBtn = document.getElementById('centerRootBtn');
    if (centerRootBtn) {
        centerRootBtn.addEventListener('click', () => {
            if (chart.center) chart.center('person1_1');
        });
    }

    // تحسين الأداء عند السحب
    chart.on('drag', function (sender, args) {
        if (sender.SVG) sender.SVG.style.imageRendering = 'pixelated';
    });
    chart.on('dragend', function (sender, args) {
        if (sender.SVG) sender.SVG.style.imageRendering = 'auto';
    });
};
