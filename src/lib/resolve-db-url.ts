/**
 * Prisma schema uses env("DB_URL"). Hosts like Render often inject DATABASE_URL.
 * Resolve once and alias so both names work.
 */
export function resolveDbUrl(): string {
  const url = process.env.DB_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "Missing database URL. Set DB_URL (preferred) or DATABASE_URL on this host.",
    );
  }
  if (!process.env.DB_URL) {
    process.env.DB_URL = url;
  }
  return url;
}
