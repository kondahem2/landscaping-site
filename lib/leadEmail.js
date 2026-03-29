const nodemailer = require("nodemailer");

function parseRecipients(raw) {
  if (!raw || typeof raw !== "string") return [];
  return raw
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function isSmtpConfigured() {
  const pass = process.env.SMTP_PASS;
  const passOk = typeof pass === "string" && pass.length > 0;
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      passOk &&
      String(process.env.SMTP_HOST).trim() &&
      String(process.env.SMTP_USER).trim()
  );
}

function buildSmtpTransport() {
  if (!isSmtpConfigured()) return null;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const secure = process.env.SMTP_SECURE === "true" || process.env.SMTP_SECURE === "1";
  const host = process.env.SMTP_HOST.trim();
  const transportOpts = {
    host,
    port: Number.isNaN(port) ? 587 : port,
    secure,
    auth: {
      user: process.env.SMTP_USER.trim(),
      pass: String(process.env.SMTP_PASS)
    },
    connectionTimeout: 20000,
    greetingTimeout: 20000
  };
  if (!secure && port !== 465 && process.env.SMTP_REQUIRE_TLS === "true") {
    transportOpts.requireTLS = true;
  }
  return nodemailer.createTransport(transportOpts);
}

/**
 * Quick check that SMTP accepts login (run: npm run test:smtp).
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
async function verifySmtpConnection() {
  const transporter = buildSmtpTransport();
  if (!transporter) {
    return { ok: false, error: "SMTP_HOST, SMTP_USER, and SMTP_PASS are required in .env" };
  }
  try {
    await transporter.verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @param {object} lead - saved lead object from server
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
async function sendLeadNotificationEmail(lead) {
  if (process.env.LEAD_EMAIL_DISABLED === "true" || process.env.LEAD_EMAIL_DISABLED === "1") {
    return { ok: false, error: "disabled" };
  }
  const recipients = parseRecipients(process.env.LEAD_EMAIL_TO);
  if (recipients.length === 0) {
    return { ok: false, error: "LEAD_EMAIL_TO not set" };
  }
  if (!isSmtpConfigured()) {
    return { ok: false, error: "SMTP not configured" };
  }

  const transporter = buildSmtpTransport();
  if (!transporter) {
    return { ok: false, error: "SMTP not configured" };
  }

  const from =
    process.env.LEAD_EMAIL_FROM?.trim() ||
    `Harmeet Landscaping <${process.env.SMTP_USER.trim()}>`;

  const lines = [
    "New quote request from the website",
    "",
    `Name: ${lead.fullName}`,
    `Email: ${lead.email}`,
    `Phone: ${lead.phone}`,
    `Service: ${lead.serviceType}`,
    "",
    "Project details:",
    lead.message,
    ""
  ];
  if (lead.yardPhotoUrl) {
    lines.push(`Yard photo URL: ${lead.yardPhotoUrl}`, "");
  }
  lines.push(
    `Submitted: ${lead.submittedAt}`,
    `Lead ID: ${lead.id}`,
    `Source: ${lead.source || "website"}`
  );
  const text = lines.join("\n");

  const html = `
<!DOCTYPE html>
<html><body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #1f2937;">
  <h2 style="margin-top:0;">New quote request</h2>
  <table style="border-collapse: collapse;">
    <tr><td style="padding: 4px 12px 4px 0; font-weight: 600;">Name</td><td>${escapeHtml(lead.fullName)}</td></tr>
    <tr><td style="padding: 4px 12px 4px 0; font-weight: 600;">Email</td><td><a href="mailto:${escapeHtml(lead.email)}">${escapeHtml(lead.email)}</a></td></tr>
    <tr><td style="padding: 4px 12px 4px 0; font-weight: 600;">Phone</td><td>${escapeHtml(lead.phone)}</td></tr>
    <tr><td style="padding: 4px 12px 4px 0; font-weight: 600;">Service</td><td>${escapeHtml(lead.serviceType)}</td></tr>
  </table>
  <p style="font-weight: 600; margin-bottom: 0.25rem;">Project details</p>
  <p style="white-space: pre-wrap; margin-top: 0;">${escapeHtml(lead.message)}</p>
  ${
    lead.yardPhotoUrl
      ? `<p><strong>Yard photo:</strong> <a href="${escapeHtml(lead.yardPhotoUrl)}">${escapeHtml(
          lead.yardPhotoUrl
        )}</a></p>`
      : ""
  }
  <p style="font-size: 0.85rem; color: #6b7280;">Lead ID: ${escapeHtml(lead.id)} · ${escapeHtml(
    lead.submittedAt
  )}</p>
</body></html>`;

  try {
    const info = await transporter.sendMail({
      from,
      to: recipients.join(", "),
      replyTo: lead.email,
      subject: `New quote: ${lead.fullName}`,
      text,
      html
    });
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    const code = err.code || err.responseCode || "";
    const resp = err.response || "";
    const detail = [code, err.message, typeof resp === "string" ? resp : ""]
      .filter(Boolean)
      .join(" — ");
    return { ok: false, error: "smtp_send_failed", detail };
  }
}

function logLeadEmailStatus() {
  const to = parseRecipients(process.env.LEAD_EMAIL_TO);
  if (to.length === 0) {
    console.log("Lead email: disabled (set LEAD_EMAIL_TO and SMTP_* in .env to notify by email)");
    return;
  }
  if (!isSmtpConfigured()) {
    console.warn(
      "Lead email: LEAD_EMAIL_TO is set but SMTP is incomplete — add SMTP_HOST, SMTP_USER, SMTP_PASS (and optional SMTP_PORT)"
    );
    return;
  }
  if (process.env.LEAD_EMAIL_DISABLED === "true" || process.env.LEAD_EMAIL_DISABLED === "1") {
    console.log("Lead email: disabled (LEAD_EMAIL_DISABLED=true)");
    return;
  }
  console.log(`Lead email: enabled → ${to.join(", ")}`);
}

module.exports = {
  sendLeadNotificationEmail,
  logLeadEmailStatus,
  verifySmtpConnection
};
