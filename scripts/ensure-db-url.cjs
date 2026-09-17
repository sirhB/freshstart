/**
 * Ensure process.env.DB_URL is set before Prisma CLI / Next start.
 * Render and many hosts provide DATABASE_URL; our schema expects DB_URL.
 */
const url = process.env.DB_URL?.trim() || process.env.DATABASE_URL?.trim();
if (url && !process.env.DB_URL) {
  process.env.DB_URL = url;
}
if (!process.env.DB_URL) {
  console.warn(
    "[ensure-db-url] Neither DB_URL nor DATABASE_URL is set. Prisma will fail until one is configured.",
  );
}
