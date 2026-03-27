const modal = document.getElementById("quote-modal");
const form = document.getElementById("quoteForm");
const statusEl = document.getElementById("formStatus");
const serviceSelect = document.getElementById("service-select");

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
  const beforeStyle = pair.beforeImage
    ? `background-image:url(${JSON.stringify(pair.beforeImage)})`
    : "";
  const afterStyle = pair.afterImage
    ? `background-image:url(${JSON.stringify(pair.afterImage)})`
    : "";
  return `
      <div class="gallery-pair">
        <article class="gallery-item ${pair.beforeImage ? "has-image" : ""}" style="${beforeStyle}">
          <span>Before</span>
          <div class="gallery-caption rich">${pair.beforeCaptionHtml || ""}</div>
        </article>
        <article class="gallery-item ${pair.afterImage ? "has-image" : ""}" style="${afterStyle}">
          <span>After</span>
          <div class="gallery-caption rich">${pair.afterCaptionHtml || ""}</div>
        </article>
      </div>
    `;
}

function openQuoteModal() {
  modal.hidden = false;
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  const firstInput = form.querySelector("input, select, textarea, button");
  if (firstInput) firstInput.focus();
}

function closeQuoteModal() {
  modal.hidden = true;
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
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

function renderSite(content) {
  const c = content;
  document.getElementById("doc-title").textContent = c.meta.title || "Harmeet Landscaping";
  const metaDesc = document.getElementById("meta-desc");
  metaDesc.setAttribute("content", c.meta.description || "");

  document.getElementById("site-brand").textContent = c.brand || "Harmeet Landscaping";

  const phone = c.contact.phone || "";
  const navCall = document.getElementById("nav-call");
  navCall.href = phone ? `tel:${phone}` : "#";

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
        ? `<div class="review-photo"><img src="${escapeAttr(photo)}" alt="" loading="lazy" width="160" height="160" /></div>`
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
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  if (!payload.fullName || payload.fullName.trim().length < 2) {
    setStatus("Please enter your name.", true);
    return;
  }

  if (!payload.email || !payload.email.includes("@")) {
    setStatus("Please enter a valid email.", true);
    return;
  }

  if (!payload.phone || payload.phone.trim().length < 8) {
    setStatus("Please enter a valid phone number.", true);
    return;
  }

  if (!payload.message || payload.message.trim().length < 10) {
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    if (!response.ok || !result.ok) {
      throw new Error(result.message || "Submission failed");
    }

    form.reset();
    setStatus(result.message || "Request submitted successfully.");
    closeQuoteModal();
  } catch (error) {
    setStatus(error.message || "Something went wrong. Please try again.", true);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Submit request";
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
