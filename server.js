const fsSync = require("fs");
const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const { randomUUID } = require("crypto");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const sanitizeHtml = require("sanitize-html");

const { ensureSiteContentFile, readSiteContent, writeSiteContent } = require("./lib/content");
const {
  sendLeadNotificationEmail,
  logLeadEmailStatus,
  verifySmtpConnection
} = require("./lib/leadEmail");

const ROOT = __dirname;
const ENV_PATH = path.join(ROOT, ".env");
const ENV_EXAMPLE_PATH = path.join(ROOT, ".env.example");

if (fsSync.existsSync(ENV_PATH)) {
  require("dotenv").config({ path: ENV_PATH });
} else if (fsSync.existsSync(ENV_EXAMPLE_PATH)) {
  require("dotenv").config({ path: ENV_EXAMPLE_PATH });
  console.warn(
    "No .env file found — loaded .env.example. Copy .env.example to .env and put your secrets in .env (not in .env.example)."
  );
} else {
  require("dotenv").config();
}

const app = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const LEADS_FILE = path.join(DATA_DIR, "leads.jsonl");
const PUBLIC_DIR = path.join(__dirname, "public");
const UPLOADS_DIR = path.join(PUBLIC_DIR, "uploads");

const SESSION_SECRET = process.env.SESSION_SECRET || "change-me-in-production";
const ADMIN_HASH_FILE = path.join(DATA_DIR, "admin.hash");

let adminPasswordHash = null;

async function resolveAdminPasswordHash() {
  if (process.env.ADMIN_PASSWORD_HASH) {
    return process.env.ADMIN_PASSWORD_HASH.trim();
  }
  if (process.env.ADMIN_PASSWORD) {
    return bcrypt.hashSync(process.env.ADMIN_PASSWORD, 10);
  }
  try {
    const existing = await fs.readFile(ADMIN_HASH_FILE, "utf8");
    if (existing.trim()) return existing.trim();
  } catch {
    // no legacy file
  }
  return null;
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "") || ".jpg";
      cb(null, `${randomUUID()}${ext}`);
    }
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /^image\/(jpeg|png|gif|webp|svg\+xml)$/.test(file.mimetype);
    if (ok) cb(null, true);
    else cb(new Error("Only image uploads are allowed"));
  }
});

const uploadHeroMedia = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "") || "";
      const safe =
        ext && /^\.(jpe?g|png|gif|webp|mp4|webm)$/i.test(ext) ? ext.toLowerCase() : ".mp4";
      cb(null, `${randomUUID()}${safe}`);
    }
  }),
  limits: { fileSize: 45 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok =
      /^image\/(jpeg|png|gif|webp)$/.test(file.mimetype) ||
      /^video\/(mp4|webm)$/.test(file.mimetype);
    if (ok) cb(null, true);
    else cb(new Error("Use JPEG, PNG, WebP, GIF, MP4, or WebM for hero media"));
  }
});

function sanitizeRich(html) {
  if (typeof html !== "string") return "";
  return sanitizeHtml(html, {
    allowedTags: [
      "p",
      "br",
      "strong",
      "em",
      "b",
      "i",
      "u",
      "s",
      "a",
      "ul",
      "ol",
      "li",
      "h1",
      "h2",
      "h3",
      "h4",
      "blockquote",
      "span",
      "img"
    ],
    allowedAttributes: {
      a: ["href", "target", "rel"],
      img: ["src", "alt", "width", "height"],
      p: ["class"],
      span: ["class"]
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: {
      img: ["http", "https", "data"]
    }
  });
}

function sanitizePlain(text) {
  if (typeof text !== "string") return "";
  return sanitizeHtml(text, { allowedTags: [], allowedAttributes: {} });
}

function sanitizeUploadPath(p) {
  if (typeof p !== "string") return "";
  const t = p.trim();
  if (!t.startsWith("/uploads/")) return "";
  if (t.includes("..")) return "";
  return t;
}

function sanitizeHeroBackground(bg) {
  if (!bg || typeof bg !== "object") {
    return {
      mode: "gradient",
      imageUrl: "",
      videoUrl: "",
      objectPosition: "center center",
      objectFit: "cover",
      overlayOpacity: 0.45
    };
  }
  let mode = ["gradient", "image", "video"].includes(bg.mode) ? bg.mode : "gradient";
  const positions = new Set([
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
  const objectPosition = positions.has(String(bg.objectPosition || "").trim())
    ? String(bg.objectPosition).trim()
    : "center center";
  const objectFit = bg.objectFit === "contain" ? "contain" : "cover";
  let overlayOpacity = Number(bg.overlayOpacity);
  if (Number.isNaN(overlayOpacity)) overlayOpacity = 0.45;
  overlayOpacity = Math.max(0, Math.min(0.9, overlayOpacity));
  const imageUrl = sanitizeUploadPath(bg.imageUrl);
  const videoUrl = sanitizeUploadPath(bg.videoUrl);
  if (mode === "gradient") {
    if (imageUrl) mode = "image";
    else if (videoUrl) mode = "video";
  }
  return {
    mode,
    imageUrl,
    videoUrl,
    objectPosition,
    objectFit,
    overlayOpacity
  };
}

function sanitizeSiteContent(raw) {
  if (!raw || typeof raw !== "object") return raw;
  const out = JSON.parse(JSON.stringify(raw));

  const plainKeys = new Set([
    "brand",
    "ctaPrimary",
    "ctaSecondary",
    "servicesTitle",
    "reviewsTitle",
    "copyrightName",
    "phoneDisplay",
    "emailDisplay",
    "serviceAreasTitle",
    "stars",
    "title",
    "description",
    "phone",
    "email",
    "beforeImage",
    "afterImage",
    "photoUrl",
    "viewMoreLabel",
    "ctaButtonLabel",
    "quoteModalTitle",
    "stickyCtaLabel",
    "quoteFormSubmitLabel",
    "servicesLabel",
    "galleryLabel",
    "contactLabel"
  ]);

  function walk(obj) {
    if (Array.isArray(obj)) {
      obj.forEach((item, i) => {
        if (typeof item === "string") {
          obj[i] = sanitizeRich(item);
        } else if (item && typeof item === "object") {
          walk(item);
        }
      });
      return;
    }
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (typeof val === "string") {
        if (key.endsWith("Html") || key === "processTitle") {
          obj[key] = sanitizeRich(val);
        } else if (plainKeys.has(key)) {
          obj[key] = sanitizePlain(val);
        } else {
          obj[key] = sanitizePlain(val);
        }
      } else if (Array.isArray(val)) {
        if (key === "trustItems") {
          obj[key] = val.map((t) => (typeof t === "string" ? sanitizeRich(t) : t));
        } else if (key === "serviceOptions") {
          obj[key] = val.map((t) => (typeof t === "string" ? sanitizePlain(t) : t));
        } else {
          walk(val);
        }
      } else if (val && typeof val === "object") {
        walk(val);
      }
    }
  }

  walk(out);

  if (out.hero && out.hero.background) {
    out.hero.background = sanitizeHeroBackground(out.hero.background);
  }

  if (out.gallery && typeof out.gallery === "object") {
    let vc = Number(out.gallery.visibleCount);
    if (Number.isNaN(vc)) vc = 2;
    out.gallery.visibleCount = Math.max(0, Math.min(50, Math.floor(vc)));
  }

  return out;
}

function normalizeGalleryPairs(gallery) {
  if (!gallery || !Array.isArray(gallery.pairs)) return null;
  const cleaned = [];
  for (let i = 0; i < gallery.pairs.length; i++) {
    const p = gallery.pairs[i];
    if (!p || typeof p !== "object") continue;
    const b = String(p.beforeImage || "").trim();
    const a = String(p.afterImage || "").trim();
    if (!b && !a) continue;
    if (!b || !a) {
      return `Each before/after project must include both images (project ${i + 1}). Remove the row or add the missing image.`;
    }
    cleaned.push({ ...p, beforeImage: b, afterImage: a });
  }
  gallery.pairs = cleaned;
  return null;
}

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    name: "harmeet.sid",
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/"
    }
  })
);

app.get("/admin", (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.get("/admin.html", (_req, res) => {
  res.redirect(301, "/admin");
});

app.use(
  express.static(PUBLIC_DIR, {
    setHeaders(res, filePath) {
      if (process.env.NODE_ENV !== "production" && /\.(html|js|css|json)$/i.test(filePath)) {
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      }
    }
  })
);

function requireAdmin(req, res, next) {
  if (req.session && req.session.admin === true) return next();
  return res.status(401).json({ ok: false, message: "Unauthorized" });
}

function sanitizeInput(value = "") {
  return String(value).trim().replace(/\s+/g, " ");
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function saveLead(lead) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.appendFile(LEADS_FILE, `${JSON.stringify(lead)}\n`, "utf8");
}

function leadPhotoUpload(req, res, next) {
  upload.single("yardPhoto")(req, res, (err) => {
    if (err) {
      return res.status(400).json({ ok: false, message: err.message || "Invalid image" });
    }
    next();
  });
}

app.get("/api/content", async (_req, res) => {
  try {
    await ensureSiteContentFile();
    const content = await readSiteContent();
    res.json({ ok: true, content });
  } catch (error) {
    console.error("Read content error:", error);
    res.status(500).json({ ok: false, message: "Could not load site content" });
  }
});

app.post("/api/admin/login", async (req, res) => {
  try {
    if (!adminPasswordHash) {
      return res.status(503).json({
        ok: false,
        message: "Admin password not configured. Set ADMIN_PASSWORD or ADMIN_PASSWORD_HASH in .env"
      });
    }
    const password = req.body.password || "";
    const match = bcrypt.compareSync(password, adminPasswordHash);
    if (!match) {
      return res.status(401).json({ ok: false, message: "Invalid password" });
    }
    req.session.admin = true;
    await new Promise((resolve, reject) => {
      req.session.save((err) => (err ? reject(err) : resolve()));
    });
    return res.json({ ok: true });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ ok: false, message: "Login failed" });
  }
});

app.post("/api/admin/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

app.get("/api/admin/me", (req, res) => {
  res.json({ ok: true, admin: Boolean(req.session && req.session.admin) });
});

app.get("/api/admin/content", requireAdmin, async (_req, res) => {
  try {
    const content = await readSiteContent();
    res.json({ ok: true, content });
  } catch (error) {
    console.error("Admin read content error:", error);
    res.status(500).json({ ok: false, message: "Could not load content" });
  }
});

app.put("/api/admin/content", requireAdmin, async (req, res) => {
  try {
    const sanitized = sanitizeSiteContent(req.body);
    if (!sanitized || typeof sanitized !== "object") {
      return res.status(400).json({ ok: false, message: "Invalid content" });
    }
    const galleryErr = normalizeGalleryPairs(sanitized.gallery);
    if (galleryErr) {
      return res.status(400).json({ ok: false, message: galleryErr });
    }
    sanitized.version = typeof sanitized.version === "number" ? sanitized.version : 1;
    await writeSiteContent(sanitized);
    res.json({ ok: true, content: sanitized });
  } catch (error) {
    console.error("Save content error:", error);
    res.status(500).json({ ok: false, message: "Could not save content" });
  }
});

app.post("/api/admin/upload", requireAdmin, (req, res) => {
  upload.single("file")(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ ok: false, message: err.message || "Upload failed" });
    }
    if (!req.file) {
      return res.status(400).json({ ok: false, message: "No file" });
    }
    const url = `/uploads/${req.file.filename}`;
    res.json({ ok: true, url });
  });
});

app.post("/api/admin/upload-hero", requireAdmin, (req, res) => {
  uploadHeroMedia.single("file")(req, res, (err) => {
    if (err) {
      return res.status(400).json({ ok: false, message: err.message || "Upload failed" });
    }
    if (!req.file) {
      return res.status(400).json({ ok: false, message: "No file" });
    }
    const url = `/uploads/${req.file.filename}`;
    res.json({ ok: true, url });
  });
});

app.post("/api/leads", leadPhotoUpload, async (req, res) => {
  try {
    const fullName = sanitizeInput(req.body.fullName);
    const email = sanitizeInput(req.body.email).toLowerCase();
    const phone = sanitizeInput(req.body.phone);
    const serviceType = sanitizeInput(req.body.serviceType);
    const message = sanitizeInput(req.body.message);
    const website = sanitizeInput(req.body.website);

    let yardPhotoUrl = "";
    if (req.file) {
      yardPhotoUrl = `/uploads/${req.file.filename}`;
    }

    if (website) {
      return res.status(200).json({ ok: true, message: "Submitted" });
    }

    if (!fullName || fullName.length < 2) {
      return res.status(400).json({ ok: false, message: "Please enter your name." });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ ok: false, message: "Please enter a valid email." });
    }

    if (!phone || phone.length < 8) {
      return res.status(400).json({ ok: false, message: "Please enter a valid phone number." });
    }

    if (!serviceType) {
      return res.status(400).json({ ok: false, message: "Please select a service." });
    }

    if (!message || message.length < 10) {
      return res.status(400).json({ ok: false, message: "Please add a short project description." });
    }

    const lead = {
      id: randomUUID(),
      fullName,
      email,
      phone,
      serviceType,
      message,
      yardPhotoUrl,
      source: "website",
      submittedAt: new Date().toISOString(),
      userAgent: req.headers["user-agent"] || "unknown",
      ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown"
    };

    await saveLead(lead);

    const mailResult = await sendLeadNotificationEmail(lead);
    if (!mailResult.ok) {
      if (mailResult.error === "smtp_send_failed") {
        console.error("[Lead email] SMTP rejected or failed:", mailResult.detail || "");
      } else {
        console.warn(
          `[Lead email] Not sent (${mailResult.error}). Fix .env — see .env.example and run: npm run test:smtp`
        );
      }
    } else {
      console.log("[Lead email] Sent OK", mailResult.messageId || "");
    }

    return res.status(201).json({
      ok: true,
      message: "Our team will get in touch with you soon."
    });
  } catch (error) {
    console.error("Lead submission error:", error);
    return res.status(500).json({ ok: false, message: "Something went wrong. Please try again." });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

async function start() {
  adminPasswordHash = await resolveAdminPasswordHash();
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  await ensureSiteContentFile();

  app.listen(PORT, async () => {
    console.log(`Harmeet Landscaping site running on http://localhost:${PORT}`);
    console.log(`Admin (same site): http://localhost:${PORT}/admin`);
    logLeadEmailStatus();
    if (process.env.SMTP_VERIFY_ON_START === "true" || process.env.SMTP_VERIFY_ON_START === "1") {
      const v = await verifySmtpConnection();
      if (v.ok) {
        console.log("SMTP verify: OK");
      } else {
        console.warn("SMTP verify failed:", v.error);
      }
    }
    if (!adminPasswordHash) {
      console.warn(
        "Admin login is DISABLED — set ADMIN_PASSWORD or ADMIN_PASSWORD_HASH in .env (copy from .env.example)."
      );
    } else {
      console.log("Admin login: enabled");
    }
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
