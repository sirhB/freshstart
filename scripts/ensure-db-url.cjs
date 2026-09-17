/**
 * Ensure process.env.DB_URL is set before Prisma CLI / Next start.
 * Render may inject DATABASE_URL, or neither during build — fall back to SQLite.
 */
const FALLBACK = "file:./prisma/prod.db";
const url =
  process.env.DB_URL?.trim() ||
  process.env.DATABASE_URL?.trim() ||
  FALLBACK;

process.env.DB_URL = url;

if (
  !process.env.DATABASE_URL?.trim() &&
  process.env.DB_URL === FALLBACK &&
  process.env.npm_lifecycle_event !== "build" &&
  process.env.npm_lifecycle_event !== "postinstall"
) {
  console.warn(
    `[ensure-db-url] Using SQLite fallback ${FALLBACK}. Set DB_URL on Render for production.`,
  );
}
