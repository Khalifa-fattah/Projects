(function () {
  const profile = window.profile;
  const app = document.getElementById("app");

  if (!profile || !app) {
    throw new Error("تعذر تحميل بيانات الموقع أو عنصر الصفحة الرئيسي.");
  }

  const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);

  const safeURL = (value) => {
    const url = String(value ?? "").trim();
    if (!url) return "";
    if (/^(https?:|mailto:|tel:)/i.test(url) || /^(\/|\.\/|\.\.\/|#)/.test(url)) {
      return escapeHTML(url);
    }
    return "";
  };

  const icon = (name, size = 18) => {
    const paths = {
      arrowDown: '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
      arrowLeft: '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
      arrowUpLeft: '<path d="M7 17 17 7"/><path d="M7 7h10v10"/>',
      briefcase: '<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 12h18"/><path d="M10 12v2h4v-2"/>',
      code: '<path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/><path d="m14 4-4 16"/>',
      graduation: '<path d="m22 10-10-5L2 10l10 5 10-5Z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/><path d="M22 10v6"/>',
      mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
      map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15"/><path d="M15 6v15"/>',
      phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.5 3.2a2 2 0 0 1-.6 1.7L7.1 10.5a16 16 0 0 0 6 6l1.9-1.9a2 2 0 0 1 1.7-.6l3.2.5a2 2 0 0 1 1.7 2Z"/>',
      sparkles: '<path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z"/><path d="m19 14 1.2 2.8L23 18l-2.8 1.2L19 22l-1.2-2.8L15 18l2.8-1.2L19 14Z"/>',
      user: '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>'
    };
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ""}</svg>`;
  };

  const sectionKicker = (number, title) =>
    `<div class="section-kicker"><span>${number}</span><span class="kicker-line"></span><span>${title}</span></div>`;

  const navItems = [
    ["نبذة", "about"],
    ["الخبرة", "experience"],
    ["التعليم", "education"],
    ["المهارات", "skills"],
    ["المشاريع", "projects"],
    ["تواصل", "contact"]
  ];

  const experience = profile.experience.map((item, index) => `
    <article class="timeline-item">
      <div class="timeline-marker">${icon("briefcase", 17)}</div>
      <span class="timeline-date">${escapeHTML(item.period)}</span>
      <div class="timeline-detail">
        <h3>${escapeHTML(item.role)}</h3>
        <p class="timeline-company">${escapeHTML(item.company)}</p>
        <p class="muted-copy">${escapeHTML(item.description)}</p>
      </div>
      <span class="item-number">${String(index + 1).padStart(2, "0")}</span>
    </article>`).join("");

  const education = profile.education.map((item, index) => `
    <article class="education-card">
      <div class="education-icon">${icon("graduation", 21)}</div>
      <div class="education-text">
        <span class="education-period">${escapeHTML(item.period)}</span>
        <h3>${escapeHTML(item.degree)}</h3>
        <p>${escapeHTML(item.school)}</p>
        <small>${escapeHTML(item.note)}</small>
      </div>
      <span class="item-number">${String(index + 1).padStart(2, "0")}</span>
    </article>`).join("");

  const skills = profile.skills.map((skill, index) =>
    `<span class="skill-tag" key="${index}"><span class="skill-spark">✳</span>${escapeHTML(skill)}</span>`
  ).join("");

  const services = profile.services.map((service) => `
    <article class="service-item">
      ${icon("code")}
      <div><h3>${escapeHTML(service.title)}</h3><p>${escapeHTML(service.description)}</p></div>
    </article>`).join("");

  const projects = profile.projects.map((project, index) => {
    const image = safeURL(project.image || `./images/project-${index + 1}.jpg`);
    const link = safeURL(project.link);
    const projectNumber = String(index + 1).padStart(2, "0");

    return `
      <article class="project-card">
        <div class="project-visual project-visual-${index + 1}">
          <div class="project-placeholder"><span class="project-shape"></span><span class="project-count">${projectNumber}</span><span class="project-image-label">الصورة: images/project-${index + 1}.jpg</span></div>
          <img class="project-image" src="${image}" alt="${escapeHTML(project.title)}" hidden>
        </div>
        <div class="project-info">
          <div>
            <span class="project-category">${escapeHTML(project.category)}</span>
            <h3>${escapeHTML(project.title)}</h3>
            <p>${escapeHTML(project.description)}</p>
          </div>
          ${link
            ? `<a href="${link}" target="_blank" rel="noopener noreferrer" class="project-link" aria-label="رابط ${escapeHTML(project.title)}">${icon("arrowUpLeft", 19)}</a>`
            : `<span class="project-link project-link-muted">${icon("arrowUpLeft", 19)}</span>`}
        </div>
      </article>`;
  }).join("");

  const socials = profile.socials.map((social) => {
    const url = safeURL(social.url);
    return url
      ? `<a href="${url}" target="_blank" rel="noopener noreferrer">${escapeHTML(social.name)}${icon("arrowUpLeft", 14)}</a>`
      : `<span class="social-placeholder">${escapeHTML(social.name)}<small>${escapeHTML(social.label)}</small></span>`;
  }).join("");

  const email = escapeHTML(profile.email);
  const phone = escapeHTML(profile.phone);
  const emailLink = safeURL(profile.email && !profile.email.startsWith("[") ? `mailto:${profile.email}` : "");
  const phoneLink = safeURL(profile.phone && !profile.phone.startsWith("[") ? `tel:${profile.phone}` : "");
  const photo = safeURL(profile.photo);
  const cvUrl = safeURL(profile.cvUrl);

  app.innerHTML = `
    <div class="site-shell" dir="rtl">
      <header class="site-header">
        <a class="brand" href="#home" aria-label="العودة إلى الرئيسية">
          <span class="brand-mark"><span></span></span><span>ملفي<span class="brand-dot">.</span></span>
        </a>
        <nav class="main-nav" aria-label="التنقل الرئيسي">
          ${navItems.map(([label, id]) => `<a href="#${id}">${label}</a>`).join("")}
        </nav>
        <a class="header-contact" href="#contact">لنتواصل ${icon("arrowUpLeft", 16)}</a>
      </header>

      <main>
        <section class="hero section-wrap" id="home">
          <div class="hero-copy">
            <div class="eyebrow"><span class="status-dot"></span> ملف مهني شخصي</div>
            <h1>${escapeHTML(profile.name)}<span class="hero-period">.</span></h1>
            <p class="hero-role">${escapeHTML(profile.role)}</p>
            <p class="hero-intro">${escapeHTML(profile.intro)}</p>
            <div class="hero-actions">
              <a href="#contact" class="button button-primary">تواصل معي ${icon("arrowLeft", 17)}</a>
              ${cvUrl
                ? `<a href="${cvUrl}" class="button button-quiet" download>تنزيل السيرة الذاتية ${icon("arrowDown", 16)}</a>`
                : `<span class="button button-quiet button-disabled" title="أضف رابط السيرة الذاتية في profile.js">السيرة الذاتية ${icon("arrowDown", 16)}</span>`}
            </div>
            <div class="hero-meta">${icon("map", 15)}<span>${escapeHTML(profile.location)}</span><span class="meta-divider"></span><span>${escapeHTML(profile.availability)}</span></div>
          </div>

          <div class="portrait-column">
            <div class="portrait-frame">
              <div class="portrait-halo"></div>
              <div class="portrait-placeholder"><div class="portrait-orbit"></div>${icon("user", 92)}<span>الصورة الشخصية</span><small>images/profile.jpg</small></div>
              <img class="portrait-image" src="${photo || "./images/profile.jpg"}" alt="الصورة الشخصية" hidden>
              <span class="portrait-index">01 / 06</span>
            </div>
            <div class="portrait-caption"><span>الصورة الشخصية</span><span>images/profile.jpg</span></div>
            <div class="hero-deco" aria-hidden="true">✳</div>
          </div>
          <a href="#about" class="scroll-cue"><span>اكتشف المزيد</span>${icon("arrowDown", 15)}</a>
        </section>

        <section class="section-wrap about-section" id="about">
          ${sectionKicker("01", "نبذة عني")}
          <div class="about-grid">
            <h2>أصنع أثرًا<br><span>من خلال عملي.</span></h2>
            <div class="about-copy"><p>${escapeHTML(profile.about)}</p><div class="quote-mark">“</div><p class="about-note">${escapeHTML(profile.aboutNote)}</p></div>
          </div>
        </section>

        <section class="section-wrap timeline-section" id="experience">
          ${sectionKicker("02", "الخبرة المهنية")}
          <div class="section-heading-row"><h2>محطاتك المهنية</h2><span class="section-aside">الخبرات والإنجازات</span></div>
          <div class="timeline-list">${experience}</div>
        </section>

        <section class="section-wrap education-section" id="education">
          ${sectionKicker("03", "التعليم والتطوير")}
          <div class="section-heading-row"><h2>معرفة تنمو باستمرار</h2><span class="section-aside">المؤهلات والدورات</span></div>
          <div class="education-list">${education}</div>
        </section>

        <section class="skills-section" id="skills">
          <div class="section-wrap skills-inner">
            ${sectionKicker("04", "المهارات والتخصص")}
            <div class="section-heading-row"><h2>مجالات أتميز بها</h2><span class="section-aside">خصص هذه القائمة بما يناسبك</span></div>
            <div class="skills-layout"><div class="skill-tags">${skills}</div><div class="services-list">${services}</div></div>
          </div>
        </section>

        <section class="section-wrap projects-section" id="projects">
          ${sectionKicker("05", "المشاريع المختارة")}
          <div class="section-heading-row"><h2>أعمال تستحق المشاهدة</h2><span class="section-aside">أضف مشاريعك ونماذج أعمالك</span></div>
          <div class="project-grid">${projects}</div>
        </section>

        <section class="contact-section" id="contact">
          <div class="section-wrap contact-inner">
            ${sectionKicker("06", "لنتحدث")}
            <div class="contact-layout">
              <div><p class="contact-overline">هل لديك فكرة أو فرصة؟</p><h2>يسعدني أن<br>أسمع منك<span class="hero-period">.</span></h2><a class="contact-cta" href="${emailLink || "#contact-details"}">ابدأ المحادثة ${icon("arrowLeft", 18)}</a></div>
              <div class="contact-details" id="contact-details">
                <div class="contact-row">${icon("mail")}<span class="contact-label">البريد الإلكتروني</span>${emailLink ? `<a href="${emailLink}">${email}</a>` : `<span>${email}</span>`}</div>
                <div class="contact-row">${icon("phone")}<span class="contact-label">الهاتف</span>${phoneLink ? `<a href="${phoneLink}">${phone}</a>` : `<span>${phone}</span>`}</div>
                <div class="contact-row">${icon("map")}<span class="contact-label">الموقع</span><span>${escapeHTML(profile.location)}</span></div>
                <div class="social-links">${socials}</div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer class="site-footer">
        <a class="brand footer-brand" href="#home"><span class="brand-mark"><span></span></span><span>ملفي<span class="brand-dot">.</span></span></a>
        <span>مساحة شخصية تعكس رحلتك المهنية.</span>
        <a href="#home" class="back-top">العودة للأعلى ${icon("sparkles", 15)}</a>
        <small>© ${new Date().getFullYear()} ${escapeHTML(profile.name)}</small>
      </footer>
    </div>`;

  document.querySelectorAll(".portrait-image, .project-image").forEach((image) => {
    image.addEventListener("load", () => {
      image.hidden = false;
      const placeholder = image.parentElement.querySelector(".portrait-placeholder, .project-placeholder");
      if (placeholder) placeholder.hidden = true;
    });
  });
})();
