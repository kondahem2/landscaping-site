#!/usr/bin/env node
/**
 * Prints a public URL to your local server (requires `npm run dev` in another terminal).
 * Uses PORT from .env or defaults to 3000.
 */
const path = require("path");
const { spawn } = require("child_process");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const port = String(process.env.PORT || 3000);

const child = spawn(
  "npx",
  ["--yes", "localtunnel@2.0.2", "--port", port],
  { stdio: "inherit", shell: true }
);

child.on("exit", (code) => process.exit(code ?? 0));
