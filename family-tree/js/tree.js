// هذا هو الكود النهائي مع إصلاح مسارات الصور المطلقة

window.onload = function () {
    // 1. تعريف القالب المخصص للصور
    OrgChart.templates.photo_template = Object.assign({}, OrgChart.templates.base);
    OrgChart.templates.photo_template.size = [120, 140];
    OrgChart.templates.photo_template.node =
        '<rect x="0" y="0" width="120" height="140" fill="none" stroke="none"></rect>' +
        '<clipPath id="clip"><circle cx="60" cy="60" r="50"></circle></clipPath>' +
        '<image preserveAspectRatio="xMidYMid slice" clip-path="url(#clip)" xlink:href="{val}" x="10" y="10" width="100" height="100" onerror="this.setAttribute(\'href\', \'images/default-avatar.jpg\')"></image>';
    OrgChart.templates.photo_template.field_0 =
        '<text style="font-size: 18px; font-weight: bold;" fill="#2c3e50" x="60" y="130" text-anchor="middle">{val}</text>';
    OrgChart.templates.photo_template.img_0 = '';

    // --- هذا هو الجزء الذي تم تعديله بشكل رئيسي ---
    // 2. تحويل البيانات مع بناء مسارات صور مطلقة
    const chartData = [];
    // الحصول على المسار الأساسي للموقع
    const baseUrl = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);

    familyData.forEach(generation => {
        const generationTag = `gen-${generation.generation_number}`;
        generation.members.forEach(person => {
            
            let imageUrl = person.image;
            
            // التحقق إذا كانت هناك صورة مخصصة
            if (imageUrl && imageUrl.includes('.')) {
                // بناء المسار المطلق للصورة المخصصة
                imageUrl = baseUrl + imageUrl;
            } else {
                // إذا لم تكن هناك صورة، اختر الصورة الرمزية وبناء مسارها المطلق
                if (person.gender === 'female') {
                    imageUrl = baseUrl + 'images/female-avatar.jpg';
                } else {
                    imageUrl = baseUrl + 'images/default-avatar.jpg';
                }
            }

            let personNode = {
                id: person.id,
                pid: person.parentId,
                name: person.name,
                img: imageUrl, // الآن نمرر المسار المطلق الكامل
                tags: [generationTag]
            };

            if (person.partnerId) {
                personNode.pids = [person.partnerId];
            }
            chartData.push(personNode);
        });
    });
    // -------------------------------------------------

    // 3. إعدادات الشجرة (تبقى كما هي)
    var chart = new OrgChart(document.getElementById("tree"), {
        nodes: chartData,
        template: "photo_template",
        lazyLoading: true,
        dragScrool: false, 
        onNodeClick: function(args) { return false; },
        nodeBinding: {
            val: "img",
            field_0: "name"
        },
        tags: { "gen-1": {}, "gen-2": {}, "gen-3": {}, "gen-4": {} },
        partnerSeparation: 150,
        enableSearch: true,
        nodeMenu: { details: { text: "تفاصيل" } },
        rootId: "person1_1",
        mouseScrool: OrgChart.action.zoom,
        layout: OrgChart.mixed,
        scaleInitial: OrgChart.match.boundary,
    });

    // تحسين الأداء عند السحب
    chart.on('drag', function (sender, args) {
        sender.SVG.style.imageRendering = 'pixelated';
    });
    chart.on('dragend', function (sender, args) {
        sender.SVG.style.imageRendering = 'auto';
    });
};
