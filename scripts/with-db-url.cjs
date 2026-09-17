#!/usr/bin/env node
/**
 * Run a command with DB_URL aliased from DATABASE_URL when needed.
 * Usage: node scripts/with-db-url.cjs <command> [args...]
 */
require("./ensure-db-url.cjs");

const { spawnSync } = require("child_process");

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node scripts/with-db-url.cjs <command> [args...]");
  process.exit(1);
}

const result = spawnSync(args[0], args.slice(1), {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});

process.exit(result.status === null ? 1 : result.status);
