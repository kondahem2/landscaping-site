const fs = require("fs/promises");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const SITE_FILE = path.join(DATA_DIR, "site-content.json");
const DEFAULT_FILE = path.join(DATA_DIR, "default-site-content.json");

async function ensureSiteContentFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(SITE_FILE);
  } catch {
    const raw = await fs.readFile(DEFAULT_FILE, "utf8");
    await fs.writeFile(SITE_FILE, raw, "utf8");
  }
}

function mergeContentDefaults(data) {
  const out = data;
  if (!out.gallery || typeof out.gallery !== "object") out.gallery = {};
  let vc = out.gallery.visibleCount;
  if (typeof vc === "string") vc = parseInt(vc, 10);
  if (typeof vc !== "number" || Number.isNaN(vc)) vc = 2;
  out.gallery.visibleCount = Math.max(0, Math.min(50, vc));
  if (!Array.isArray(out.gallery.pairs)) out.gallery.pairs = [];
  if (typeof out.gallery.viewMoreLabel !== "string") out.gallery.viewMoreLabel = "View more projects";
  if (typeof out.reviewsTitle !== "string") out.reviewsTitle = "What clients say";
  if (Array.isArray(out.testimonials)) {
    out.testimonials.forEach((t) => {
      if (t && typeof t === "object" && t.photoUrl === undefined) t.photoUrl = "";
    });
  }
  if (!out.hero || typeof out.hero !== "object") out.hero = {};
  const hb = out.hero.background || {};
  const pos = new Set([
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
  let overlayOpacity = Number(hb.overlayOpacity);
  if (Number.isNaN(overlayOpacity)) overlayOpacity = 0.45;
  overlayOpacity = Math.max(0, Math.min(0.9, overlayOpacity));
  const imageUrlRaw = typeof hb.imageUrl === "string" ? hb.imageUrl.trim() : "";
  const videoUrlRaw = typeof hb.videoUrl === "string" ? hb.videoUrl.trim() : "";
  let mode = ["gradient", "image", "video"].includes(hb.mode) ? hb.mode : "gradient";
  // If the dropdown was left on "gradient" but a file was uploaded, infer the real mode.
  if (mode === "gradient") {
    if (imageUrlRaw) mode = "image";
    else if (videoUrlRaw) mode = "video";
  }
  out.hero.background = {
    mode,
    imageUrl: imageUrlRaw,
    videoUrl: videoUrlRaw,
    objectPosition: typeof hb.objectPosition === "string" && pos.has(hb.objectPosition.trim())
      ? hb.objectPosition.trim()
      : "center center",
    objectFit: hb.objectFit === "contain" ? "contain" : "cover",
    overlayOpacity
  };
  out.contactSection = out.contactSection || {};
  const cs = out.contactSection;
  if (typeof cs.ctaLeadHtml !== "string") cs.ctaLeadHtml = "<p>Ready to get started?</p>";
  if (typeof cs.ctaButtonLabel !== "string") cs.ctaButtonLabel = "Get a free quote";
  if (typeof cs.quoteModalTitle !== "string") cs.quoteModalTitle = "Get a free quote";
  if (typeof cs.stickyCtaLabel !== "string") cs.stickyCtaLabel = "Get free quote";
  if (typeof cs.quoteFormSubmitLabel !== "string") cs.quoteFormSubmitLabel = "Submit request";

  out.nav = out.nav || {};
  const nv = out.nav;
  if (typeof nv.servicesLabel !== "string") nv.servicesLabel = "Services";
  if (typeof nv.galleryLabel !== "string") nv.galleryLabel = "Gallery";
  if (typeof nv.contactLabel !== "string") nv.contactLabel = "Contact";

  return out;
}

async function readSiteContent() {
  await ensureSiteContentFile();
  const raw = await fs.readFile(SITE_FILE, "utf8");
  return mergeContentDefaults(JSON.parse(raw));
}

async function writeSiteContent(data) {
  await ensureSiteContentFile();
  await fs.writeFile(SITE_FILE, JSON.stringify(data, null, 2), "utf8");
}

module.exports = {
  SITE_FILE,
  DEFAULT_FILE,
  ensureSiteContentFile,
  readSiteContent,
  writeSiteContent
};
