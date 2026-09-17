/**
 * Prisma schema uses env("DB_URL"). Hosts like Render often inject DATABASE_URL,
 * and may provide neither during `next build` page-data collection.
 *
 * Resolve order:
 * 1. DB_URL
 * 2. DATABASE_URL (aliased to DB_URL)
 * 3. Build-time / missing-env SQLite fallback so deploys don't crash
 */
const SQLITE_FALLBACK = "file:./prisma/prod.db";

function isBuildPhase(): boolean {
  return (
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.npm_lifecycle_event === "build" ||
    process.env.npm_lifecycle_event === "postinstall"
  );
}

export function resolveDbUrl(): string {
  const configured =
    process.env.DB_URL?.trim() || process.env.DATABASE_URL?.trim() || "";

  const url = configured || SQLITE_FALLBACK;

  // Always satisfy schema.prisma env("DB_URL") before PrismaClient constructs.
  process.env.DB_URL = url;

  if (!configured && !isBuildPhase()) {
    console.warn(
      `[db] DB_URL/DATABASE_URL unset — using SQLite fallback ${SQLITE_FALLBACK}. ` +
        "Set DB_URL on Render for a durable database (SQLite disk is ephemeral).",
    );
  }

  return url;
}
