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
  if (Array.isArray(out.testimonials)) {
    out.testimonials.forEach((t) => {
      if (t && typeof t === "object" && t.photoUrl === undefined) t.photoUrl = "";
    });
  }
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
