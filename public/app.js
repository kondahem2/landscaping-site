const modal = document.getElementById("quote-modal");
const modalPanel = document.getElementById("quote-modal-panel");
const form = document.getElementById("quoteForm");
const statusEl = document.getElementById("formStatus");
const serviceSelect = document.getElementById("service-select");
const quoteFormView = document.getElementById("quote-form-view");
const quoteSuccessView = document.getElementById("quote-success-view");
const quoteSuccessMessageEl = document.getElementById("quote-success-message");
const quoteSuccessCloseBtn = document.getElementById("quote-success-close");

const DEFAULT_QUOTE_SUCCESS_MESSAGE = "Our team will get in touch with you soon.";

/** Refreshed from site content on each render; used to restore the submit button label after sending. */
let quoteFormSubmitButtonLabel = "Submit request";

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s) {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function galleryPairHtml(pair) {
  const beforeImg = pair.beforeImage
    ? `<div class="gallery-item-bg"><img src="${escapeAttr(pair.beforeImage)}" alt="" loading="lazy" decoding="async" sizes="(max-width: 640px) 100vw, 50vw" /></div>`
    : "";
  const afterImg = pair.afterImage
    ? `<div class="gallery-item-bg"><img src="${escapeAttr(pair.afterImage)}" alt="" loading="lazy" decoding="async" sizes="(max-width: 640px) 100vw, 50vw" /></div>`
    : "";
  return `
      <div class="gallery-pair">
        <article class="gallery-item ${pair.beforeImage ? "has-image" : ""}">
          ${beforeImg}
          <span>Before</span>
          <div class="gallery-caption rich">${pair.beforeCaptionHtml || ""}</div>
        </article>
        <article class="gallery-item ${pair.afterImage ? "has-image" : ""}">
          ${afterImg}
          <span>After</span>
          <div class="gallery-caption rich">${pair.afterCaptionHtml || ""}</div>
        </article>
      </div>
    `;
}

function showQuoteFormView() {
  if (quoteFormView) quoteFormView.hidden = false;
  if (quoteSuccessView) quoteSuccessView.hidden = true;
  if (modalPanel) modalPanel.setAttribute("aria-labelledby", "quote-modal-title");
}

function showQuoteSuccessView(message) {
  const text =
    (message && String(message).trim()) || DEFAULT_QUOTE_SUCCESS_MESSAGE;
  if (quoteSuccessMessageEl) quoteSuccessMessageEl.textContent = text;
  if (quoteFormView) quoteFormView.hidden = true;
  if (quoteSuccessView) quoteSuccessView.hidden = false;
  if (modalPanel) modalPanel.setAttribute("aria-labelledby", "quote-success-title");
  if (quoteSuccessCloseBtn) quoteSuccessCloseBtn.focus();
}

function openQuoteModal() {
  showQuoteFormView();
  setStatus("");
  if (form) form.reset();
  const submitBtn = form && form.querySelector("button[type='submit']");
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit request";
  }
  modal.hidden = false;
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  const firstInput = form && form.querySelector("input, select, textarea, button");
  if (firstInput) firstInput.focus();
}

function closeQuoteModal() {
  modal.hidden = true;
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  setStatus("");
  showQuoteFormView();
}

function initModalChrome() {
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-open-quote]")) {
      e.preventDefault();
      openQuoteModal();
    }
  });

  modal.querySelectorAll("[data-close-modal]").forEach((el) => {
    el.addEventListener("click", closeQuoteModal);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.hidden) {
      closeQuoteModal();
    }
  });
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#b91c1c" : "#24563c";
}

function populateServiceOptions(options) {
  serviceSelect.innerHTML = '<option value="">Select one...</option>';
  (options || []).forEach((opt) => {
    const o = document.createElement("option");
    o.value = opt;
    o.textContent = opt;
    serviceSelect.appendChild(o);
  });
}

/**
 * Full-bleed hero image/video behind nav + headline, or default gradient.
 */
function applyHeroBackground(c) {
  const header = document.getElementById("site-hero");
  const layer = document.getElementById("hero-media-layer");
  const slot = document.getElementById("hero-media-slot");
  if (!header || !layer || !slot) return;

  const bg = (c.hero && c.hero.background) || {};
  let mode = bg.mode || "gradient";
  const imgUrl = (bg.imageUrl || "").trim();
  const videoUrl = (bg.videoUrl || "").trim();
  // Match server/lib: if "gradient" is selected but a file was uploaded, still show media.
  if (mode === "gradient") {
    if (imgUrl) mode = "image";
    else if (videoUrl) mode = "video";
  }

  const pos = bg.objectPosition || "center center";
  const fit = bg.objectFit === "contain" ? "contain" : "cover";
  let op = parseFloat(bg.overlayOpacity);
  if (Number.isNaN(op)) op = 0.45;
  op = Math.max(0, Math.min(0.9, op));

  header.style.setProperty("--hero-object-fit", fit);
  header.style.setProperty("--hero-object-position", pos);
  header.style.setProperty("--hero-overlay-opacity", String(op));

  const hasImage = mode === "image" && imgUrl;
  const hasVideo = mode === "video" && videoUrl;
  const useMedia = hasImage || hasVideo;

  if (!useMedia) {
    slot.innerHTML = "";
    layer.hidden = true;
    layer.setAttribute("aria-hidden", "true");
    header.classList.remove("hero-bg-media");
    header.classList.add("hero-bg-gradient");
    return;
  }

  header.classList.remove("hero-bg-gradient");
  header.classList.add("hero-bg-media");
  layer.hidden = false;
  layer.setAttribute("aria-hidden", "false");

  if (hasVideo) {
    slot.innerHTML = `<video src="${escapeAttr(videoUrl)}" autoplay muted playsinline loop></video>`;
  } else {
    slot.innerHTML = `<img src="${escapeAttr(imgUrl)}" alt="" loading="eager" decoding="async" sizes="100vw" />`;
  }
}

function renderSite(content) {
  const c = content;
  document.getElementById("doc-title").textContent = c.meta.title || "Harmeet Landscaping";
  const metaDesc = document.getElementById("meta-desc");
  metaDesc.setAttribute("content", c.meta.description || "");

  document.getElementById("site-brand").textContent = c.brand || "Harmeet Landscaping";

  const navRoot = document.querySelector("header.hero .nav-links");
  if (navRoot) {
    const nv = c.nav || {};
    const a = (hash, label, fallback) => {
      const el = navRoot.querySelector(`a[href="${hash}"]`);
      if (el) el.textContent = (label || fallback).trim() || fallback;
    };
    a("#services", nv.servicesLabel, "Services");
    a("#gallery", nv.galleryLabel, "Gallery");
    a("#contact", nv.contactLabel, "Contact");
  }

  const phone = c.contact.phone || "";
  const navCall = document.getElementById("nav-call");
  navCall.href = phone ? `tel:${phone}` : "#";
  const hNav = c.hero || {};
  navCall.textContent = (hNav.ctaSecondary || "Call Now").trim() || "Call Now";

  const hero = document.getElementById("hero-mount");
  const h = c.hero || {};
  hero.innerHTML = `
    <div class="eyebrow-wrap">${h.eyebrowHtml || ""}</div>
    <div class="hero-title-wrap">${h.titleHtml || ""}</div>
    <div class="hero-body">${h.bodyHtml || ""}</div>
    <div class="hero-actions">
      <button type="button" class="btn" id="hero-open-quote" data-open-quote>${escapeHtml(h.ctaPrimary || "Get a Free Quote")}</button>
      <a href="${phone ? `tel:${escapeHtml(phone)}` : "#"}" class="btn btn-ghost">${escapeHtml(h.ctaSecondary || "Call Now")}</a>
    </div>
  `;
  applyHeroBackground(c);

  const trustMount = document.getElementById("trust-mount");
  trustMount.innerHTML = (c.trustItems || []).map((html) => `<div class="trust-cell">${html}</div>`).join("");

  document.getElementById("services-title").textContent = c.servicesTitle || "Services";
  const servicesMount = document.getElementById("services-mount");
  servicesMount.innerHTML = (c.services || [])
    .map(
      (s) => `
    <article class="card">
      <div class="card-title rich">${s.titleHtml || ""}</div>
      <div class="rich">${s.bodyHtml || ""}</div>
    </article>
  `
    )
    .join("");

  const gallery = c.gallery || {};
  document.getElementById("gallery-title").innerHTML = gallery.titleHtml || "";
  document.getElementById("gallery-lead").innerHTML = gallery.leadHtml || "";

  const pairs = gallery.pairs || [];
  let splitAt = Math.floor(Number(gallery.visibleCount));
  if (Number.isNaN(splitAt) || splitAt < 0) splitAt = 2;
  if (splitAt === 0) splitAt = pairs.length;
  splitAt = Math.min(splitAt, pairs.length);

  const visiblePairs = pairs.slice(0, splitAt);
  const restPairs = pairs.slice(splitAt);

  document.getElementById("gallery-mount").innerHTML = visiblePairs.map(galleryPairHtml).join("");

  const viewWrap = document.getElementById("gallery-view-more-wrap");
  const restEl = document.getElementById("gallery-rest");
  const viewBtn = document.getElementById("gallery-view-more-btn");
  const viewMoreText = (gallery.viewMoreLabel || "View more projects").trim() || "View more projects";
  if (viewBtn) viewBtn.textContent = viewMoreText;

  if (restPairs.length > 0) {
    viewWrap.hidden = false;
    restEl.hidden = true;
    restEl.setAttribute("aria-hidden", "true");
    restEl.innerHTML = restPairs.map(galleryPairHtml).join("");
    viewBtn.onclick = () => {
      restEl.hidden = false;
      restEl.setAttribute("aria-hidden", "false");
      viewWrap.hidden = true;
      restEl.scrollIntoView({ behavior: "smooth", block: "start" });
    };
  } else {
    viewWrap.hidden = true;
    restEl.innerHTML = "";
    restEl.hidden = true;
  }

  document.getElementById("reviews-mount").innerHTML = (c.testimonials || [])
    .map((t) => {
      const photo = (t.photoUrl || "").trim();
      const imgBlock = photo
        ? `<div class="review-photo"><img src="${escapeAttr(photo)}" alt="" loading="lazy" decoding="async" sizes="(max-width: 480px) 100vw, 320px" /></div>`
        : "";
      return `
    <article class="card card-review">
      ${imgBlock}
      <div class="card-review-body">
        <p class="stars">${escapeHtml(t.stars || "")}</p>
        <div class="rich">${t.quoteHtml || ""}</div>
        <div class="rich">${t.authorHtml || ""}</div>
      </div>
    </article>
  `;
    })
    .join("");

  const reviewsHeading = document.getElementById("reviews-title");
  if (reviewsHeading) {
    reviewsHeading.textContent = c.reviewsTitle || "What clients say";
  }

  document.getElementById("process-title").innerHTML = c.processTitle || "How it works";
  document.getElementById("process-mount").innerHTML = (c.processSteps || [])
    .map(
      (step, i) => `
    <article class="step">
      <p class="step-num">${i + 1}</p>
      <div class="step-title rich">${step.titleHtml || ""}</div>
      <div class="rich">${step.bodyHtml || ""}</div>
    </article>
  `
    )
    .join("");

  const about = c.about || {};
  document.getElementById("about-main").innerHTML = `
    <div class="rich">${about.titleHtml || ""}</div>
    <div class="rich">${about.bodyHtml || ""}</div>
  `;
  const phoneDisplay = about.phoneDisplay || "";
  const emailDisplay = about.emailDisplay || "";
  document.getElementById("about-card").innerHTML = `
    <h3>${about.serviceAreasTitle || "Service areas"}</h3>
    <div class="rich">${about.serviceAreasHtml || ""}</div>
    <p><strong>Phone:</strong> <a href="${phone ? `tel:${escapeHtml(phone)}` : "#"}">${escapeHtml(phoneDisplay)}</a></p>
    <p><strong>Email:</strong> <a href="mailto:${escapeHtml(c.contact.email || "")}">${escapeHtml(emailDisplay)}</a></p>
  `;

  const cs = c.contactSection || {};
  document.getElementById("contact-copy").innerHTML = `
    <div class="rich">${cs.titleHtml || ""}</div>
    <div class="rich">${cs.leadHtml || ""}</div>
  `;
  const contactLeadEl = document.getElementById("contact-cta-lead");
  if (contactLeadEl) {
    contactLeadEl.innerHTML = cs.ctaLeadHtml || "";
  }
  const contactQuoteBtn = document.getElementById("contact-open-quote");
  if (contactQuoteBtn) {
    contactQuoteBtn.textContent = (cs.ctaButtonLabel || "Get a free quote").trim() || "Get a free quote";
  }
  const stickyCta = document.getElementById("sticky-open-quote");
  if (stickyCta) {
    stickyCta.textContent = (cs.stickyCtaLabel || "Get free quote").trim() || "Get free quote";
  }
  const modalTitleEl = document.getElementById("quote-modal-title");
  if (modalTitleEl) {
    modalTitleEl.textContent = (cs.quoteModalTitle || "Get a free quote").trim() || "Get a free quote";
  }
  quoteFormSubmitButtonLabel = (cs.quoteFormSubmitLabel || "Submit request").trim() || "Submit request";
  const quoteSubmitBtn = form && form.querySelector("button[type='submit']");
  if (quoteSubmitBtn) quoteSubmitBtn.textContent = quoteFormSubmitButtonLabel;

  document.getElementById(
    "contact-phone-line"
  ).innerHTML = `<strong>Call now:</strong> <a href="${phone ? `tel:${escapeHtml(phone)}` : "#"}">${escapeHtml(cs.phoneDisplay || phoneDisplay)}</a>`;
  document.getElementById("contact-email-line").innerHTML = `<strong>Email:</strong> <a href="mailto:${escapeHtml(c.contact.email || "")}">${escapeHtml(cs.emailDisplay || emailDisplay)}</a>`;

  const year = new Date().getFullYear();
  const name = (c.footer && c.footer.copyrightName) || c.brand || "Harmeet Landscaping";
  document.getElementById("footer-line").innerHTML = `&copy; ${year} ${escapeHtml(name)}. All rights reserved.`;

  populateServiceOptions(c.serviceOptions);
}

async function loadContent() {
  try {
    const res = await fetch("/api/content");
    const data = await res.json();
    if (!data.ok || !data.content) throw new Error("No content");
    renderSite(data.content);
  } catch (e) {
    console.error(e);
    document.getElementById("hero-mount").innerHTML =
      "<p>Could not load site content. Is the server running?</p>";
    applyHeroBackground({ hero: { background: { mode: "gradient" } } });
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(form);
  const fullName = (formData.get("fullName") || "").trim();
  const email = (formData.get("email") || "").trim();
  const phone = (formData.get("phone") || "").trim();
  const serviceType = (formData.get("serviceType") || "").trim();
  const message = (formData.get("message") || "").trim();

  if (!fullName || fullName.length < 2) {
    setStatus("Please enter your name.", true);
    return;
  }

  if (!email || !email.includes("@")) {
    setStatus("Please enter a valid email.", true);
    return;
  }

  if (!phone || phone.length < 8) {
    setStatus("Please enter a valid phone number.", true);
    return;
  }

  if (!serviceType) {
    setStatus("Please select a service.", true);
    return;
  }

  if (!message || message.length < 10) {
    setStatus("Please add a short project description.", true);
    return;
  }

  const submitButton = form.querySelector("button[type='submit']");
  submitButton.disabled = true;
  submitButton.textContent = "Sending...";
  setStatus("Submitting your request...");

  try {
    const response = await fetch("/api/leads", {
      method: "POST",
      body: formData
    });

    const result = await response.json();
    if (!response.ok || !result.ok) {
      throw new Error(result.message || "Submission failed");
    }

    form.reset();
    setStatus("");
    const successMsg = result.message || DEFAULT_QUOTE_SUCCESS_MESSAGE;
    showQuoteSuccessView(successMsg);
  } catch (error) {
    setStatus(error.message || "Something went wrong. Please try again.", true);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = quoteFormSubmitButtonLabel;
  }
});

if (location.pathname === "/admin") {
  const site = document.getElementById("site-view");
  const admin = document.getElementById("admin-view");
  if (site) site.hidden = true;
  if (admin) admin.hidden = false;
  document.title = "Site admin — Harmeet Landscaping";
} else {
  initModalChrome();
  loadContent();
}
