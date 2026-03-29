(function () {
  if (location.pathname !== "/admin") {
    return;
  }

  const fetchOpts = { credentials: "include" };

  function escapeAdminAttr(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function htmlToPlainText(html) {
    if (html == null || html === "") return "";
    const d = document.createElement("div");
    d.innerHTML = String(html);
    const ps = d.querySelectorAll("p");
    if (ps.length > 1) {
      return Array.from(ps)
        .map((p) => p.textContent.trim())
        .filter(Boolean)
        .join("\n\n");
    }
    return (d.textContent || "").trim();
  }

  function headingHtmlToPlain(html, tag) {
    if (!html) return "";
    const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
    const m = String(html).match(re);
    if (m) return htmlToPlainText(m[1]);
    return htmlToPlainText(html);
  }

  function plainToParagraphHtml(text) {
    const s = String(text).trim();
    if (!s) return "";
    const blocks = s
      .split(/\n\n+/)
      .map((b) => b.trim())
      .filter(Boolean);
    return blocks
      .map((b) => {
        const inner = escapeHtml(b).replace(/\n/g, "<br>");
        return `<p>${inner}</p>`;
      })
      .join("");
  }

  function plainToSingleP(text) {
    const s = String(text).trim();
    if (!s) return "";
    return `<p>${escapeHtml(s)}</p>`;
  }

  function plainToHeadingHtml(text, tag) {
    const s = String(text).trim();
    if (!s) return "";
    return `<${tag}>${escapeHtml(s)}</${tag}>`;
  }

  function plainToReviewerHtml(text) {
    const s = String(text).trim();
    if (!s) return "";
    return `<p class="reviewer">${escapeHtml(s)}</p>`;
  }

  const loginPanel = document.getElementById("login-panel");
  const editorPanel = document.getElementById("editor-panel");
  const loginForm = document.getElementById("login-form");
  const loginError = document.getElementById("login-error");
  const editorRoot = document.getElementById("editor-root");
  const saveBtn = document.getElementById("save-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const saveStatus = document.getElementById("save-status");

  let siteContent = null;

  function setDeep(obj, path, value) {
    let cur = obj;
    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];
      const nextKey = path[i + 1];
      if (cur[key] === undefined) {
        cur[key] = typeof nextKey === "number" ? [] : {};
      }
      cur = cur[key];
    }
    cur[path[path.length - 1]] = value;
  }

  function tip(el, text) {
    if (el && text) el.title = text;
  }

  function ensureContentShape(raw) {
    const c = JSON.parse(JSON.stringify(raw || {}));
    c.meta = c.meta || {};
    c.contact = c.contact || {};
    c.hero = c.hero || {};
    const hb = c.hero.background || {};
    const posOk = new Set([
      "center center",
      "center top",
      "center bottom",
      "left center",
      "right center",
      "left top",
      "right top",
      "left bottom",
      "right bottom"
    ]);
    let oa = Number(hb.overlayOpacity);
    if (Number.isNaN(oa)) oa = 0.45;
    oa = Math.max(0, Math.min(0.9, oa));
    const imageUrlStr = typeof hb.imageUrl === "string" ? hb.imageUrl.trim() : "";
    const videoUrlStr = typeof hb.videoUrl === "string" ? hb.videoUrl.trim() : "";
    let hbMode = ["gradient", "image", "video"].includes(hb.mode) ? hb.mode : "gradient";
    if (hbMode === "gradient") {
      if (imageUrlStr) hbMode = "image";
      else if (videoUrlStr) hbMode = "video";
    }
    c.hero.background = {
      mode: hbMode,
      imageUrl: imageUrlStr,
      videoUrl: videoUrlStr,
      objectPosition: typeof hb.objectPosition === "string" && posOk.has(hb.objectPosition.trim())
        ? hb.objectPosition.trim()
        : "center center",
      objectFit: hb.objectFit === "contain" ? "contain" : "cover",
      overlayOpacity: oa
    };
    c.trustItems = Array.isArray(c.trustItems) ? c.trustItems : [];
    c.services = Array.isArray(c.services) ? c.services : [];
    c.gallery = c.gallery || {};
    c.gallery.pairs = Array.isArray(c.gallery.pairs) ? c.gallery.pairs : [];
    if (typeof c.gallery.viewMoreLabel !== "string") c.gallery.viewMoreLabel = "View more projects";
    if (typeof c.reviewsTitle !== "string") c.reviewsTitle = "What clients say";
    c.testimonials = Array.isArray(c.testimonials) ? c.testimonials : [];
    c.processSteps = Array.isArray(c.processSteps) ? c.processSteps : [];
    c.about = c.about || {};
    c.contactSection = c.contactSection || {};
    if (typeof c.contactSection.ctaLeadHtml !== "string") {
      c.contactSection.ctaLeadHtml = "<p>Ready to get started?</p>";
    }
    if (typeof c.contactSection.ctaButtonLabel !== "string") {
      c.contactSection.ctaButtonLabel = "Get a free quote";
    }
    if (typeof c.contactSection.quoteModalTitle !== "string") {
      c.contactSection.quoteModalTitle = "Get a free quote";
    }
    if (typeof c.contactSection.stickyCtaLabel !== "string") {
      c.contactSection.stickyCtaLabel = "Get free quote";
    }
    if (typeof c.contactSection.quoteFormSubmitLabel !== "string") {
      c.contactSection.quoteFormSubmitLabel = "Submit request";
    }
    c.footer = c.footer || {};
    c.serviceOptions = Array.isArray(c.serviceOptions) ? c.serviceOptions : [];
    c.nav = c.nav || {};
    if (typeof c.nav.servicesLabel !== "string") c.nav.servicesLabel = "Services";
    if (typeof c.nav.galleryLabel !== "string") c.nav.galleryLabel = "Gallery";
    if (typeof c.nav.contactLabel !== "string") c.nav.contactLabel = "Contact";
    return c;
  }

  function buildToc() {
    const nav = document.createElement("nav");
    nav.className = "admin-toc";
    nav.setAttribute("aria-label", "Jump to section");
    const links = [
      ["admin-brand", "Brand & SEO"],
      ["admin-contact", "Contact"],
      ["admin-hero", "Hero"],
      ["admin-trust", "Trust bar"],
      ["admin-services", "Services"],
      ["admin-quote-form", "Quote form"],
      ["admin-gallery", "Gallery"],
      ["admin-testimonials", "Reviews"],
      ["admin-process", "Process"],
      ["admin-about", "About"],
      ["admin-contact-block", "Contact block"],
      ["admin-footer", "Footer"]
    ];
    links.forEach(([id, label]) => {
      const a = document.createElement("a");
      a.href = `#${id}`;
      a.textContent = label;
      nav.appendChild(a);
    });
    return nav;
  }

  function sectionTitle(text, anchorId) {
    const h = document.createElement("h2");
    h.className = "admin-section-title";
    if (anchorId) h.id = anchorId;
    h.textContent = text;
    return h;
  }

  function addPlainMultiLine(parent, label, hint, path, html, rows = 4) {
    const wrap = document.createElement("div");
    wrap.className = "field";
    const lab = document.createElement("label");
    lab.className = "stack";
    lab.textContent = label;
    const ta = document.createElement("textarea");
    ta.rows = rows;
    ta.className = "plain-textarea";
    ta.value = htmlToPlainText(html);
    ta.dataset.path = JSON.stringify(path);
    ta.dataset.plainMode = "paragraph";
    lab.appendChild(ta);
    wrap.appendChild(lab);
    if (hint) {
      const h = document.createElement("p");
      h.className = "field-hint";
      h.textContent = hint;
      wrap.appendChild(h);
    }
    parent.appendChild(wrap);
  }

  function addPlainSingleLine(parent, label, hint, path, html, mode = "lineP") {
    const wrap = document.createElement("div");
    wrap.className = "field";
    const lab = document.createElement("label");
    lab.className = "stack";
    lab.textContent = label;
    const inp = document.createElement("input");
    inp.type = "text";
    inp.className = "plain-input";
    inp.value = htmlToPlainText(html);
    inp.dataset.path = JSON.stringify(path);
    inp.dataset.plainMode = mode;
    lab.appendChild(inp);
    wrap.appendChild(lab);
    if (hint) {
      const h = document.createElement("p");
      h.className = "field-hint";
      h.textContent = hint;
      wrap.appendChild(h);
    }
    parent.appendChild(wrap);
  }

  function addPlainHeading(parent, label, hint, path, html, tag) {
    const wrap = document.createElement("div");
    wrap.className = "field";
    const lab = document.createElement("label");
    lab.className = "stack";
    lab.textContent = label;
    const inp = document.createElement("input");
    inp.type = "text";
    inp.className = "plain-input";
    inp.value = headingHtmlToPlain(html, tag);
    inp.dataset.path = JSON.stringify(path);
    inp.dataset.plainMode = tag;
    lab.appendChild(inp);
    wrap.appendChild(lab);
    if (hint) {
      const h = document.createElement("p");
      h.className = "field-hint";
      h.textContent = hint;
      wrap.appendChild(h);
    }
    parent.appendChild(wrap);
  }

  function addInput(parent, labelText, path, value, type = "text") {
    const wrap = document.createElement("div");
    wrap.className = "field";
    const lab = document.createElement("label");
    lab.className = "stack";
    lab.textContent = labelText;
    const input = document.createElement("input");
    input.type = type;
    input.value = value || "";
    input.dataset.path = JSON.stringify(path);
    lab.appendChild(input);
    wrap.appendChild(lab);
    parent.appendChild(wrap);
    return input;
  }

  function addSelect(parent, labelText, path, options, value, tooltip) {
    const wrap = document.createElement("div");
    wrap.className = "field";
    const lab = document.createElement("label");
    lab.className = "stack";
    lab.textContent = labelText;
    if (tooltip) lab.title = tooltip;
    const sel = document.createElement("select");
    sel.className = "plain-input admin-select";
    sel.dataset.path = JSON.stringify(path);
    if (tooltip) sel.title = tooltip;
    options.forEach(([v, label]) => {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = label;
      sel.appendChild(o);
    });
    sel.value = value;
    lab.appendChild(sel);
    wrap.appendChild(lab);
    parent.appendChild(wrap);
    return sel;
  }

  function addNumberField(parent, labelText, hint, path, value, opts, tooltip) {
    const wrap = document.createElement("div");
    wrap.className = "field";
    const lab = document.createElement("label");
    lab.className = "stack";
    lab.textContent = labelText;
    if (tooltip) lab.title = tooltip;
    const input = document.createElement("input");
    input.type = "number";
    input.min = String(opts.min);
    input.max = String(opts.max);
    input.step = String(opts.step ?? 0.05);
    input.value = String(value);
    input.dataset.path = JSON.stringify(path);
    input.className = "plain-input";
    if (tooltip) input.title = tooltip;
    lab.appendChild(input);
    wrap.appendChild(lab);
    if (hint) {
      const h = document.createElement("p");
      h.className = "field-hint";
      h.textContent = hint;
      wrap.appendChild(h);
    }
    parent.appendChild(wrap);
    return input;
  }

  /**
   * Image upload with hidden path field for save; no manual URL entry.
   * @param {(url: string) => void} [onUploaded] — called with new URL or "" when removed
   * @param {string} [tooltip] — native tooltip on hover
   */
  function addImageUpload(parent, labelText, path, value, onUploaded, tooltip) {
    const wrap = document.createElement("div");
    wrap.className = "field admin-image-upload";
    const lab = document.createElement("label");
    lab.className = "stack";
    lab.textContent = labelText;
    if (tooltip) lab.title = tooltip;
    const hidden = document.createElement("input");
    hidden.type = "hidden";
    hidden.value = value || "";
    hidden.dataset.path = JSON.stringify(path);
    const preview = document.createElement("div");
    preview.className = "admin-image-preview";
    const img = document.createElement("img");
    img.alt = "";
    if (value) {
      img.src = value;
    } else {
      img.hidden = true;
    }
    preview.appendChild(img);
    const file = document.createElement("input");
    file.type = "file";
    file.accept = "image/*";
    file.className = "admin-file-input";
    tip(file, tooltip || "Choose an image file from your computer. It uploads immediately; click Save changes to publish.");
    const actions = document.createElement("div");
    actions.className = "admin-image-actions";
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn-secondary";
    removeBtn.textContent = "Remove image";
    tip(removeBtn, "Clear this uploaded image. Save changes to update the live site.");
    removeBtn.hidden = !value;
    file.addEventListener("change", async () => {
      const f = file.files && file.files[0];
      if (!f) return;
      saveStatus.textContent = "Uploading…";
      try {
        const fd = new FormData();
        fd.append("file", f);
        const res = await fetch("/api/admin/upload", { method: "POST", ...fetchOpts, body: fd });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.message || "Upload failed");
        hidden.value = data.url;
        img.src = data.url;
        img.hidden = false;
        removeBtn.hidden = false;
        file.value = "";
        saveStatus.textContent = "Image uploaded — click Save changes.";
        if (onUploaded) onUploaded(data.url);
      } catch (e) {
        saveStatus.textContent = e.message || "Upload failed";
      }
    });
    removeBtn.addEventListener("click", () => {
      hidden.value = "";
      img.removeAttribute("src");
      img.hidden = true;
      removeBtn.hidden = true;
      file.value = "";
      if (onUploaded) onUploaded("");
    });
    actions.appendChild(file);
    actions.appendChild(removeBtn);
    lab.appendChild(hidden);
    lab.appendChild(preview);
    lab.appendChild(actions);
    wrap.appendChild(lab);
    parent.appendChild(wrap);
    return hidden;
  }

  function addVideoUpload(parent, labelText, path, value, onUploaded, tooltip) {
    const wrap = document.createElement("div");
    wrap.className = "field admin-image-upload";
    const lab = document.createElement("label");
    lab.className = "stack";
    lab.textContent = labelText;
    if (tooltip) lab.title = tooltip;
    const hidden = document.createElement("input");
    hidden.type = "hidden";
    hidden.value = value || "";
    hidden.dataset.path = JSON.stringify(path);
    const preview = document.createElement("div");
    preview.className = "admin-image-preview admin-video-preview";
    const vid = document.createElement("video");
    vid.controls = true;
    vid.muted = true;
    if (value) {
      vid.src = value;
    } else {
      vid.hidden = true;
    }
    preview.appendChild(vid);
    const file = document.createElement("input");
    file.type = "file";
    file.accept = "video/mp4,video/webm";
    file.className = "admin-file-input";
    tip(
      file,
      tooltip || "MP4 or WebM, max ~45 MB. Plays muted and loops on the homepage. Save changes after upload."
    );
    const actions = document.createElement("div");
    actions.className = "admin-image-actions";
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn-secondary";
    removeBtn.textContent = "Remove video";
    tip(removeBtn, "Remove this video from the hero. Save changes to update the site.");
    removeBtn.hidden = !value;
    file.addEventListener("change", async () => {
      const f = file.files && file.files[0];
      if (!f) return;
      saveStatus.textContent = "Uploading video…";
      try {
        const fd = new FormData();
        fd.append("file", f);
        const res = await fetch("/api/admin/upload-hero", { method: "POST", ...fetchOpts, body: fd });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.message || "Upload failed");
        hidden.value = data.url;
        vid.src = data.url;
        vid.hidden = false;
        removeBtn.hidden = false;
        file.value = "";
        saveStatus.textContent = "Video uploaded — click Save changes.";
        if (onUploaded) onUploaded(data.url);
      } catch (e) {
        saveStatus.textContent = e.message || "Upload failed";
      }
    });
    removeBtn.addEventListener("click", () => {
      hidden.value = "";
      vid.removeAttribute("src");
      vid.hidden = true;
      removeBtn.hidden = true;
      file.value = "";
      if (onUploaded) onUploaded("");
    });
    actions.appendChild(file);
    actions.appendChild(removeBtn);
    lab.appendChild(hidden);
    lab.appendChild(preview);
    lab.appendChild(actions);
    wrap.appendChild(lab);
    parent.appendChild(wrap);
    return hidden;
  }

  function addTextarea(parent, labelText, value) {
    const wrap = document.createElement("div");
    wrap.className = "field";
    const lab = document.createElement("label");
    lab.className = "stack";
    lab.textContent = labelText;
    const ta = document.createElement("textarea");
    ta.rows = 5;
    ta.value = value || "";
    ta.id = "service-options-textarea";
    lab.appendChild(ta);
    wrap.appendChild(lab);
    parent.appendChild(wrap);
    return ta;
  }

  /**
   * Reads every editor field from the live DOM so saves always match what the user sees.
   * (Plain text fields use data-plain-mode; regular inputs/selects use values as-is.)
   */
  function collectPathFieldsFromDom(out) {
    editorRoot
      .querySelectorAll("input[data-path], select[data-path], textarea[data-path]")
      .forEach((el) => {
        const path = JSON.parse(el.dataset.path);
        const key = path[path.length - 1];
        const plainMode = el.dataset.plainMode;

        if (plainMode) {
          const v = el.value;
          let outVal = "";
          switch (plainMode) {
            case "paragraph":
              outVal = plainToParagraphHtml(v);
              break;
            case "lineP":
              outVal = plainToSingleP(v);
              break;
            case "h1":
              outVal = plainToHeadingHtml(v, "h1");
              break;
            case "h2":
              outVal = plainToHeadingHtml(v, "h2");
              break;
            case "reviewer":
              outVal = plainToReviewerHtml(v);
              break;
            default:
              outVal = plainToParagraphHtml(v);
          }
          setDeep(out, path, outVal);
          return;
        }

        if (key === "overlayOpacity") {
          let n = parseFloat(el.value);
          if (Number.isNaN(n)) n = 0.45;
          setDeep(out, path, Math.max(0, Math.min(0.9, n)));
          return;
        }

        setDeep(out, path, el.value);
      });
  }

  function renderEditor(content) {
    siteContent = ensureContentShape(content);
    editorRoot.innerHTML = "";

    try {
      renderEditorBody(siteContent);
    } catch (err) {
      console.error(err);
      editorRoot.innerHTML = "";
      const p = document.createElement("p");
      p.className = "error";
      p.textContent = `Could not load the editor (${err.message}). Try a hard refresh.`;
      editorRoot.appendChild(p);
    }
  }

  function renderEditorBody(c) {
    const layout = document.createElement("div");
    layout.className = "admin-editor-layout";
    layout.appendChild(buildToc());
    const main = document.createElement("div");
    main.className = "admin-editor-main";
    layout.appendChild(main);
    editorRoot.appendChild(layout);

    main.appendChild(sectionTitle("Brand & SEO", "admin-brand"));
    const seo = document.createElement("div");
    seo.className = "admin-section admin-card";
    addInput(seo, "Business name (shown in the top bar)", ["brand"], c.brand);
    addInput(seo, "Page title (browser tab)", ["meta", "title"], c.meta.title);
    addInput(
      seo,
      "Meta description (plain text for Google — no HTML)",
      ["meta", "description"],
      htmlToPlainText(c.meta.description || "")
    );
    const navHint = document.createElement("p");
    navHint.className = "field-hint";
    navHint.textContent = "Top navigation link labels (next to Call).";
    seo.appendChild(navHint);
    addInput(seo, "Nav link: Services", ["nav", "servicesLabel"], c.nav.servicesLabel);
    addInput(seo, "Nav link: Gallery", ["nav", "galleryLabel"], c.nav.galleryLabel);
    addInput(seo, "Nav link: Contact", ["nav", "contactLabel"], c.nav.contactLabel);
    main.appendChild(seo);

    main.appendChild(sectionTitle("Contact (phone & email links)", "admin-contact"));
    const contact = document.createElement("div");
    contact.className = "admin-section admin-card";
    addInput(
      contact,
      "Phone (use digits, e.g. +15125550199)",
      ["contact", "phone"],
      c.contact.phone
    );
    addInput(contact, "Email", ["contact", "email"], c.contact.email, "email");
    main.appendChild(contact);

    main.appendChild(sectionTitle("Hero (top of homepage)", "admin-hero"));
    const hero = document.createElement("div");
    hero.className = "admin-section admin-card";
    addPlainSingleLine(
      hero,
      "Eyebrow line (small text above headline)",
      "One short line.",
      ["hero", "eyebrowHtml"],
      c.hero.eyebrowHtml,
      "lineP"
    );
    addPlainHeading(
      hero,
      "Main headline",
      "This becomes the large headline on the page.",
      ["hero", "titleHtml"],
      c.hero.titleHtml,
      "h1"
    );
    addPlainMultiLine(
      hero,
      "Supporting text",
      "A few sentences. Blank line = new paragraph.",
      ["hero", "bodyHtml"],
      c.hero.bodyHtml,
      5
    );
    addInput(hero, "Primary button label", ["hero", "ctaPrimary"], c.hero.ctaPrimary);
    addInput(hero, "Secondary button label (next to Call)", ["hero", "ctaSecondary"], c.hero.ctaSecondary);

    const hb = c.hero.background || {};
    const hbSub = document.createElement("div");
    hbSub.className = "sub-block";
    const hbH = document.createElement("h3");
    hbH.className = "sub-block-title";
    hbH.textContent = "Hero background (full-width behind headline)";
    hbSub.appendChild(hbH);
    const hbIntro = document.createElement("p");
    hbIntro.className = "field-hint";
    hbIntro.textContent =
      "Optional photo or looping video behind the top of the homepage. If you upload a file, it is shown even if the type is still set to the green gradient — pick Photo or Video to label it clearly. Adjust framing and overlay so text stays readable.";
    hbSub.appendChild(hbIntro);

    addSelect(
      hbSub,
      "Background type",
      ["hero", "background", "mode"],
      [
        ["gradient", "Green gradient (default)"],
        ["image", "Photo"],
        ["video", "Video (MP4 / WebM, loops)"]
      ],
      hb.mode,
      "Default green gradient, or upload a photo or short video for a full-bleed hero."
    );

    addImageUpload(
      hbSub,
      "Hero photo",
      ["hero", "background", "imageUrl"],
      hb.imageUrl,
      null,
      "Wide landscape works best. Uploads to your server; click Save changes to publish."
    );

    addVideoUpload(
      hbSub,
      "Hero video",
      ["hero", "background", "videoUrl"],
      hb.videoUrl,
      null,
      "MP4 or WebM. Autoplays muted and loops. Keep files reasonably small for mobile visitors."
    );

    addSelect(
      hbSub,
      "View / focus (center of the frame)",
      ["hero", "background", "objectPosition"],
      [
        ["center center", "Center"],
        ["center top", "Top"],
        ["center bottom", "Bottom"],
        ["left center", "Left"],
        ["right center", "Right"],
        ["left top", "Top left"],
        ["right top", "Top right"],
        ["left bottom", "Bottom left"],
        ["right bottom", "Bottom right"]
      ],
      hb.objectPosition,
      "Which part of the image or video stays centered when the browser crops on different screen sizes."
    );

    addSelect(
      hbSub,
      "How media fits the hero area",
      ["hero", "background", "objectFit"],
      [
        ["cover", "Fill area (crop edges — recommended)"],
        ["contain", "Show entire image (may add empty bands)"]
      ],
      hb.objectFit,
      "Cover behaves like a banner crop. Contain shows the whole picture with possible letterboxing."
    );

    addNumberField(
      hbSub,
      "Text overlay darkness",
      "0 = no dimming, 0.9 = very dark. Try 0.35–0.55 for white text on bright photos.",
      ["hero", "background", "overlayOpacity"],
      hb.overlayOpacity,
      { min: 0, max: 0.9, step: 0.05 },
      "Darkens the media behind the headline and buttons so text stays legible."
    );

    hero.appendChild(hbSub);
    main.appendChild(hero);

    main.appendChild(sectionTitle("Trust bar", "admin-trust"));
    const trust = document.createElement("div");
    trust.className = "admin-section admin-card";
    trust.id = "trust-editor";
    (c.trustItems || []).forEach((html, i) => {
      addPlainSingleLine(
        trust,
        `Line ${i + 1}`,
        "Short phrase (e.g. “5-star rated”).",
        ["trustItems", i],
        html,
        "lineP"
      );
    });
    const trustActions = document.createElement("div");
    trustActions.className = "row-actions";
    const addTrust = document.createElement("button");
    addTrust.type = "button";
    addTrust.className = "btn-secondary";
    addTrust.textContent = "Add line";
    tip(addTrust, "Adds another short trust line under the hero. Save changes to publish.");
    addTrust.addEventListener("click", () => {
      const next = JSON.parse(JSON.stringify(siteContent));
      next.trustItems.push("<p>New line</p>");
      renderEditor(next);
    });
    const remTrust = document.createElement("button");
    remTrust.type = "button";
    remTrust.className = "btn-secondary";
    remTrust.textContent = "Remove last line";
    tip(remTrust, "Deletes the last trust line only. Save changes to apply.");
    remTrust.addEventListener("click", () => {
      if (siteContent.trustItems.length <= 1) return;
      const next = JSON.parse(JSON.stringify(siteContent));
      next.trustItems.pop();
      renderEditor(next);
    });
    trustActions.appendChild(addTrust);
    trustActions.appendChild(remTrust);
    trust.appendChild(trustActions);
    main.appendChild(trust);

    main.appendChild(sectionTitle("Services", "admin-services"));
    const svc = document.createElement("div");
    svc.className = "admin-section admin-card";
    addInput(svc, "Section heading", ["servicesTitle"], c.servicesTitle);
    const svcList = document.createElement("div");
    svcList.id = "services-editor";
    (c.services || []).forEach((s, i) => {
      const block = document.createElement("div");
      block.className = "sub-block";
      const sh = document.createElement("h3");
      sh.className = "sub-block-title";
      sh.textContent = `Service ${i + 1}`;
      block.appendChild(sh);
      addPlainSingleLine(block, "Name", null, ["services", i, "titleHtml"], s.titleHtml, "lineP");
      addPlainMultiLine(
        block,
        "Description",
        null,
        ["services", i, "bodyHtml"],
        s.bodyHtml,
        4
      );
      svcList.appendChild(block);
    });
    const svcActions = document.createElement("div");
    svcActions.className = "row-actions";
    const addSvc = document.createElement("button");
    addSvc.type = "button";
    addSvc.className = "btn-secondary";
    addSvc.textContent = "Add service";
    tip(addSvc, "Adds another service card on the homepage. Save changes to publish.");
    addSvc.addEventListener("click", () => {
      const next = JSON.parse(JSON.stringify(siteContent));
      next.services.push({ titleHtml: "<p>New service</p>", bodyHtml: "<p>Description</p>" });
      renderEditor(next);
    });
    const remSvc = document.createElement("button");
    remSvc.type = "button";
    remSvc.className = "btn-secondary";
    remSvc.textContent = "Remove last";
    tip(remSvc, "Removes the last service in the list. Save changes to apply.");
    remSvc.addEventListener("click", () => {
      if (siteContent.services.length <= 1) return;
      const next = JSON.parse(JSON.stringify(siteContent));
      next.services.pop();
      renderEditor(next);
    });
    svcActions.appendChild(addSvc);
    svcActions.appendChild(remSvc);
    svc.appendChild(svcList);
    svc.appendChild(svcActions);
    main.appendChild(svc);

    main.appendChild(sectionTitle("Quote form (dropdown options)", "admin-quote-form"));
    const opts = document.createElement("div");
    opts.className = "admin-section admin-card";
    addTextarea(opts, "One service name per line", (c.serviceOptions || []).join("\n"));
    main.appendChild(opts);

    main.appendChild(sectionTitle("Before & after gallery", "admin-gallery"));
    const gal = document.createElement("div");
    gal.className = "admin-section admin-card gallery-admin";

    const help = document.createElement("p");
    help.className = "muted";
    help.textContent =
      "Each project needs both a before and an after image — upload below (no URLs). Reorder with ↑ ↓. Empty rows are removed when you save.";
    gal.appendChild(help);

    const vcField = document.createElement("div");
    vcField.className = "field";
    const vcLabel = document.createElement("label");
    vcLabel.className = "stack";
    vcLabel.appendChild(document.createTextNode('How many projects show before “View more” '));
    const vcInput = document.createElement("input");
    vcInput.type = "number";
    vcInput.id = "gallery-visible-count";
    vcInput.min = "0";
    vcInput.max = "50";
    vcInput.value = String(Number(c.gallery.visibleCount ?? 2));
    tip(
      vcInput,
      "How many before/after pairs show before the “View more” button. Use 0 to show every project at once."
    );
    vcLabel.appendChild(vcInput);
    const vcHint = document.createElement("span");
    vcHint.className = "field-hint";
    vcHint.textContent = "0 = show all in the first block (no View more).";
    vcField.appendChild(vcLabel);
    vcField.appendChild(vcHint);
    gal.appendChild(vcField);

    addInput(
      gal,
      "“View more projects” button label",
      ["gallery", "viewMoreLabel"],
      c.gallery.viewMoreLabel
    );

    addPlainHeading(
      gal,
      "Gallery title",
      null,
      ["gallery", "titleHtml"],
      c.gallery.titleHtml,
      "h2"
    );
    addPlainMultiLine(
      gal,
      "Intro under the title",
      null,
      ["gallery", "leadHtml"],
      c.gallery.leadHtml,
      3
    );

    const addTop = document.createElement("div");
    addTop.className = "row-actions";
    const addPairBtn = document.createElement("button");
    addPairBtn.type = "button";
    addPairBtn.className = "btn-primary";
    addPairBtn.textContent = "+ Add before/after project";
    tip(
      addPairBtn,
      "Adds a new before/after pair. Upload both images before saving, or the row may be dropped."
    );
    addPairBtn.addEventListener("click", () => {
      const next = JSON.parse(JSON.stringify(siteContent));
      if (!next.gallery.pairs) next.gallery.pairs = [];
      next.gallery.pairs.push({
        beforeImage: "",
        afterImage: "",
        beforeCaptionHtml: "<p>Before</p>",
        afterCaptionHtml: "<p>After</p>"
      });
      renderEditor(next);
    });
    addTop.appendChild(addPairBtn);
    gal.appendChild(addTop);

    (c.gallery.pairs || []).forEach((pair, i) => {
      const block = document.createElement("div");
      block.className = "sub-block gallery-entry";
      const head = document.createElement("div");
      head.className = "gallery-entry-head";
      const h3 = document.createElement("h3");
      h3.textContent = `Project ${i + 1}`;
      const headActions = document.createElement("div");
      headActions.className = "gallery-entry-actions";

      const upBtn = document.createElement("button");
      upBtn.type = "button";
      upBtn.className = "btn-secondary btn-icon";
      upBtn.title = "Move this project higher in the gallery order.";
      upBtn.textContent = "↑";
      upBtn.disabled = i === 0;
      upBtn.addEventListener("click", () => {
        const next = JSON.parse(JSON.stringify(siteContent));
        const arr = next.gallery.pairs;
        [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
        renderEditor(next);
      });

      const downBtn = document.createElement("button");
      downBtn.type = "button";
      downBtn.className = "btn-secondary btn-icon";
      downBtn.title = "Move this project lower in the gallery order.";
      downBtn.textContent = "↓";
      downBtn.disabled = i === (c.gallery.pairs || []).length - 1;
      downBtn.addEventListener("click", () => {
        const next = JSON.parse(JSON.stringify(siteContent));
        const arr = next.gallery.pairs;
        [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
        renderEditor(next);
      });

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "btn-secondary btn-danger";
      delBtn.textContent = "Delete";
      tip(delBtn, "Permanently remove this before/after project after you confirm.");
      delBtn.addEventListener("click", () => {
        if (!confirm(`Delete project ${i + 1}?`)) return;
        const next = JSON.parse(JSON.stringify(siteContent));
        next.gallery.pairs.splice(i, 1);
        renderEditor(next);
      });

      headActions.appendChild(upBtn);
      headActions.appendChild(downBtn);
      headActions.appendChild(delBtn);
      head.appendChild(h3);
      head.appendChild(headActions);
      block.appendChild(head);

      const preview = document.createElement("div");
      preview.className = "gallery-preview-row";
      const bSrc = (pair.beforeImage || "").trim();
      const aSrc = (pair.afterImage || "").trim();
      preview.innerHTML = `
      <div class="gallery-thumb">${bSrc ? `<img src="${escapeAdminAttr(bSrc)}" alt="Before preview" />` : "<span>Before</span>"}</div>
      <div class="gallery-thumb">${aSrc ? `<img src="${escapeAdminAttr(aSrc)}" alt="After preview" />` : "<span>After</span>"}</div>
    `;
      block.appendChild(preview);

      const thumbs = preview.querySelectorAll(".gallery-thumb");
      addImageUpload(block, "Before image", ["gallery", "pairs", i, "beforeImage"], pair.beforeImage, (url) => {
        thumbs[0].innerHTML = url
          ? `<img src="${escapeAdminAttr(url)}" alt="Before preview" />`
          : "<span>Before</span>";
      });
      addImageUpload(block, "After image", ["gallery", "pairs", i, "afterImage"], pair.afterImage, (url) => {
        thumbs[1].innerHTML = url
          ? `<img src="${escapeAdminAttr(url)}" alt="After preview" />`
          : "<span>After</span>";
      });
      addPlainSingleLine(
        block,
        "Before caption",
        null,
        ["gallery", "pairs", i, "beforeCaptionHtml"],
        pair.beforeCaptionHtml,
        "lineP"
      );
      addPlainSingleLine(
        block,
        "After caption",
        null,
        ["gallery", "pairs", i, "afterCaptionHtml"],
        pair.afterCaptionHtml,
        "lineP"
      );
      gal.appendChild(block);
    });
    main.appendChild(gal);

    main.appendChild(sectionTitle("Customer reviews", "admin-testimonials"));
    const rev = document.createElement("div");
    rev.className = "admin-section admin-card";
    addInput(
      rev,
      "Reviews section heading (above the cards)",
      ["reviewsTitle"],
      c.reviewsTitle
    );
    (c.testimonials || []).forEach((t, i) => {
      const block = document.createElement("div");
      block.className = "sub-block";
      const rh = document.createElement("h3");
      rh.className = "sub-block-title";
      rh.textContent = `Review ${i + 1}`;
      block.appendChild(rh);
      addInput(block, "Stars (e.g. ★★★★★)", ["testimonials", i, "stars"], t.stars);
      addPlainMultiLine(
        block,
        "Quote",
        "What they said — plain text, no HTML needed.",
        ["testimonials", i, "quoteHtml"],
        t.quoteHtml,
        3
      );
      addPlainSingleLine(
        block,
        "Name & location",
        "Example: — Priya S., Austin",
        ["testimonials", i, "authorHtml"],
        t.authorHtml,
        "reviewer"
      );
      addImageUpload(block, "Photo (optional)", ["testimonials", i, "photoUrl"], t.photoUrl || "");
      rev.appendChild(block);
    });
    const revActions = document.createElement("div");
    revActions.className = "row-actions";
    const addRev = document.createElement("button");
    addRev.type = "button";
    addRev.className = "btn-secondary";
    addRev.textContent = "Add review";
    tip(addRev, "Adds another testimonial block on the homepage.");
    addRev.addEventListener("click", () => {
      const next = JSON.parse(JSON.stringify(siteContent));
      next.testimonials.push({
        stars: "★★★★★",
        quoteHtml: "<p></p>",
        authorHtml: '<p class="reviewer"></p>',
        photoUrl: ""
      });
      renderEditor(next);
    });
    const remRev = document.createElement("button");
    remRev.type = "button";
    remRev.className = "btn-secondary";
    remRev.textContent = "Remove last";
    tip(remRev, "Removes the last review in the list.");
    remRev.addEventListener("click", () => {
      if (siteContent.testimonials.length <= 1) return;
      const next = JSON.parse(JSON.stringify(siteContent));
      next.testimonials.pop();
      renderEditor(next);
    });
    revActions.appendChild(addRev);
    revActions.appendChild(remRev);
    rev.appendChild(revActions);
    main.appendChild(rev);

    main.appendChild(sectionTitle("How it works", "admin-process"));
    const proc = document.createElement("div");
    proc.className = "admin-section admin-card";
    addPlainHeading(
      proc,
      "Section title",
      null,
      ["processTitle"],
      c.processTitle,
      "h2"
    );
    (c.processSteps || []).forEach((step, i) => {
      const block = document.createElement("div");
      block.className = "sub-block";
      const ph = document.createElement("h3");
      ph.className = "sub-block-title";
      ph.textContent = `Step ${i + 1}`;
      block.appendChild(ph);
      addPlainSingleLine(block, "Step title", null, ["processSteps", i, "titleHtml"], step.titleHtml, "lineP");
      addPlainMultiLine(
        block,
        "Description",
        null,
        ["processSteps", i, "bodyHtml"],
        step.bodyHtml,
        3
      );
      proc.appendChild(block);
    });
    const procActions = document.createElement("div");
    procActions.className = "row-actions";
    const addStep = document.createElement("button");
    addStep.type = "button";
    addStep.className = "btn-secondary";
    addStep.textContent = "Add step";
    tip(addStep, "Adds another numbered step in the “How it works” section.");
    addStep.addEventListener("click", () => {
      const next = JSON.parse(JSON.stringify(siteContent));
      next.processSteps.push({ titleHtml: "<p>New step</p>", bodyHtml: "<p>Details</p>" });
      renderEditor(next);
    });
    const remStep = document.createElement("button");
    remStep.type = "button";
    remStep.className = "btn-secondary";
    remStep.textContent = "Remove last";
    tip(remStep, "Removes the last process step.");
    remStep.addEventListener("click", () => {
      if (siteContent.processSteps.length <= 1) return;
      const next = JSON.parse(JSON.stringify(siteContent));
      next.processSteps.pop();
      renderEditor(next);
    });
    procActions.appendChild(addStep);
    procActions.appendChild(remStep);
    proc.appendChild(procActions);
    main.appendChild(proc);

    main.appendChild(sectionTitle("About & service area", "admin-about"));
    const about = document.createElement("div");
    about.className = "admin-section admin-card";
    addPlainHeading(about, "Section title", null, ["about", "titleHtml"], c.about.titleHtml, "h2");
    addPlainMultiLine(about, "About text", null, ["about", "bodyHtml"], c.about.bodyHtml, 6);
    addInput(about, "Service areas box title", ["about", "serviceAreasTitle"], c.about.serviceAreasTitle);
    addPlainMultiLine(
      about,
      "Areas you serve",
      null,
      ["about", "serviceAreasHtml"],
      c.about.serviceAreasHtml,
      3
    );
    addInput(about, "Phone (display text)", ["about", "phoneDisplay"], c.about.phoneDisplay);
    addInput(about, "Email (display text)", ["about", "emailDisplay"], c.about.emailDisplay);
    main.appendChild(about);

    main.appendChild(sectionTitle("Contact section (on page)", "admin-contact-block"));
    const cs = document.createElement("div");
    cs.className = "admin-section admin-card";
    addPlainHeading(cs, "Title", null, ["contactSection", "titleHtml"], c.contactSection.titleHtml, "h2");
    addPlainMultiLine(cs, "Intro text", null, ["contactSection", "leadHtml"], c.contactSection.leadHtml, 3);
    addInput(cs, "Phone (display)", ["contactSection", "phoneDisplay"], c.contactSection.phoneDisplay);
    addInput(cs, "Email (display)", ["contactSection", "emailDisplay"], c.contactSection.emailDisplay);
    addPlainSingleLine(
      cs,
      "Short line above quote button (contact column)",
      "Shown in the card next to your contact copy.",
      ["contactSection", "ctaLeadHtml"],
      c.contactSection.ctaLeadHtml,
      "lineP"
    );
    addInput(
      cs,
      "Quote button (contact column)",
      ["contactSection", "ctaButtonLabel"],
      c.contactSection.ctaButtonLabel
    );
    addInput(
      cs,
      "Quote popup title",
      ["contactSection", "quoteModalTitle"],
      c.contactSection.quoteModalTitle
    );
    addInput(
      cs,
      "Floating bottom-right button label",
      ["contactSection", "stickyCtaLabel"],
      c.contactSection.stickyCtaLabel
    );
    addInput(
      cs,
      "Quote form submit button label",
      ["contactSection", "quoteFormSubmitLabel"],
      c.contactSection.quoteFormSubmitLabel
    );
    main.appendChild(cs);

    main.appendChild(sectionTitle("Footer", "admin-footer"));
    const foot = document.createElement("div");
    foot.className = "admin-section admin-card";
    addInput(foot, "Copyright name", ["footer", "copyrightName"], c.footer.copyrightName);
    main.appendChild(foot);
  }

  function collectPayload() {
    const out = JSON.parse(JSON.stringify(siteContent));
    collectPathFieldsFromDom(out);

    const ta = document.getElementById("service-options-textarea");
    if (ta) {
      out.serviceOptions = ta.value
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
    }

    const vcInputEl = document.getElementById("gallery-visible-count");
    if (vcInputEl && out.gallery) {
      let n = parseInt(vcInputEl.value, 10);
      if (Number.isNaN(n)) n = 2;
      out.gallery.visibleCount = Math.max(0, Math.min(50, n));
    }

    return out;
  }

  async function save() {
    saveStatus.textContent = "Saving…";
    const payload = collectPayload();
    try {
      const res = await fetch("/api/admin/content", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        ...fetchOpts,
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || "Save failed");
      siteContent = data.content;
      saveStatus.textContent = "Saved.";
      renderEditor(siteContent);
    } catch (e) {
      saveStatus.textContent = e.message || "Save failed";
    }
  }

  async function checkSession() {
    const res = await fetch("/api/admin/me", fetchOpts);
    const data = await res.json();
    if (data.ok && data.admin) {
      const contentRes = await fetch("/api/admin/content", fetchOpts);
      const c = await contentRes.json();
      if (!contentRes.ok || !c.ok) throw new Error("Could not load content");
      loginPanel.hidden = true;
      editorPanel.hidden = false;
      renderEditor(c.content);
    } else {
      loginPanel.hidden = false;
      editorPanel.hidden = true;
    }
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.textContent = "";
    const password = loginForm.password.value;
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        ...fetchOpts,
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || "Login failed");
      await checkSession();
    } catch (err) {
      loginError.textContent = err.message || "Login failed";
    }
  });

  saveBtn.addEventListener("click", save);

  logoutBtn.addEventListener("click", async () => {
    await fetch("/api/admin/logout", { method: "POST", ...fetchOpts });
    editorRoot.innerHTML = "";
    siteContent = null;
    await checkSession();
  });

  tip(
    saveBtn,
    "Writes every field to the server. Visitors see updates after they refresh the homepage."
  );
  tip(logoutBtn, "Ends your admin session in this browser. You can sign in again anytime.");

  const loginSubmitBtn = loginForm && loginForm.querySelector('button[type="submit"]');
  tip(loginSubmitBtn, "Sign in with the admin password from your server .env (ADMIN_PASSWORD).");

  checkSession().catch(() => {
    loginError.textContent = "Could not reach server.";
  });
})();
