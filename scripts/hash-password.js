#!/usr/bin/env node
/**
 * Usage: node scripts/hash-password.js "your-strong-password"
 * Paste the printed hash into ADMIN_PASSWORD_HASH in .env
 */
const bcrypt = require("bcryptjs");

const pwd = process.argv[2];
if (!pwd) {
  console.error('Usage: node scripts/hash-password.js "your-password"');
  process.exit(1);
}

console.log(bcrypt.hashSync(pwd, 10));
