import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { prisma } from "@/lib/db";
import { aggregateOutcomeInsights } from "@/lib/dispute/insights";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const events = await prisma.outcomeEvent.findMany({
    include: {
      item: {
        select: {
          groundCode: true,
          furnisherName: true,
          creditor: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 2000,
  });
  const { byGround, byFurnisher } = aggregateOutcomeInsights(events);

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="paper-grain flex-1 px-5 py-10 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-5xl space-y-10">
          <header>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-signal">
              Operator
            </p>
            <h1 className="mt-2 font-display text-4xl text-ink">
              Outcome learning
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted">
              Deletion and correction rates by ground and furnisher from recorded
              investigation outcomes ({events.length} events).
            </p>
            <Link
              href="/operator"
              className="mt-4 inline-block text-sm underline underline-offset-4"
            >
              ← Exception desk
            </Link>
          </header>

          <section>
            <h2 className="font-display text-2xl text-ink">By ground</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[32rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                    <th className="py-2 pr-3">Ground</th>
                    <th className="py-2 pr-3">Total</th>
                    <th className="py-2 pr-3">Deleted</th>
                    <th className="py-2 pr-3">Corrected</th>
                    <th className="py-2 pr-3">Verified</th>
                    <th className="py-2 pr-3">Win rate</th>
                  </tr>
                </thead>
                <tbody>
                  {byGround.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-muted">
                        No outcomes recorded yet.
                      </td>
                    </tr>
                  )}
                  {byGround.map((row) => (
                    <tr key={row.key} className="border-b border-line/70">
                      <td className="py-2 pr-3 font-mono text-xs text-brass">
                        {row.groundCode}
                      </td>
                      <td className="py-2 pr-3">{row.total}</td>
                      <td className="py-2 pr-3">{row.deleted}</td>
                      <td className="py-2 pr-3">{row.corrected}</td>
                      <td className="py-2 pr-3">{row.verified}</td>
                      <td className="py-2 pr-3 font-semibold text-signal">
                        {(row.winRate * 100).toFixed(0)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="font-display text-2xl text-ink">By furnisher</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[32rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                    <th className="py-2 pr-3">Furnisher</th>
                    <th className="py-2 pr-3">Total</th>
                    <th className="py-2 pr-3">Deleted</th>
                    <th className="py-2 pr-3">Corrected</th>
                    <th className="py-2 pr-3">Verified</th>
                    <th className="py-2 pr-3">Win rate</th>
                  </tr>
                </thead>
                <tbody>
                  {byFurnisher.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-muted">
                        No outcomes recorded yet.
                      </td>
                    </tr>
                  )}
                  {byFurnisher.map((row) => (
                    <tr key={row.key} className="border-b border-line/70">
                      <td className="py-2 pr-3 text-ink">{row.furnisher}</td>
                      <td className="py-2 pr-3">{row.total}</td>
                      <td className="py-2 pr-3">{row.deleted}</td>
                      <td className="py-2 pr-3">{row.corrected}</td>
                      <td className="py-2 pr-3">{row.verified}</td>
                      <td className="py-2 pr-3 font-semibold text-signal">
                        {(row.winRate * 100).toFixed(0)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
