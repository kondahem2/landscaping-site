#!/usr/bin/env node
/**
 * Verifies SMTP settings and sends one test message to LEAD_EMAIL_TO.
 * Usage: from project root, with .env configured:
 *   npm run test:smtp
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const {
  sendLeadNotificationEmail,
  logLeadEmailStatus,
  verifySmtpConnection
} = require("../lib/leadEmail.js");

async function main() {
  console.log("--- Lead email self-test ---\n");
  logLeadEmailStatus();
  console.log("\nStep 1: verify SMTP connection (login + TLS)…");
  const v = await verifySmtpConnection();
  if (!v.ok) {
    console.error("FAILED:", v.error);
    console.error(
      "\nCheck .env in this project (not only .env.example). You need LEAD_EMAIL_TO, SMTP_HOST, SMTP_USER, SMTP_PASS."
    );
    console.error("Gmail: use an App Password, not your normal password.");
    process.exit(1);
  }
  console.log("OK — server accepted credentials.\n");

  console.log("Step 2: send test message to LEAD_EMAIL_TO…");
  const r = await sendLeadNotificationEmail({
    id: "smtp-self-test",
    fullName: "SMTP self-test",
    email: "test@example.com",
    phone: "555-0100",
    serviceType: "Self-test",
    message: "If you see this, quote notification email is working.",
    yardPhotoUrl: "",
    submittedAt: new Date().toISOString(),
    source: "test:smtp script"
  });

  if (!r.ok) {
    console.error("FAILED:", r.error, r.detail || "");
    process.exit(1);
  }
  console.log("OK — message id:", r.messageId);
  console.log("\nCheck the inbox for LEAD_EMAIL_TO (and spam).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
