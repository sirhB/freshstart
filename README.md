# Fresh Start

Personal credit repair for consumers — upload your credit report PDF, review disputable items, generate bureau letters, and download them or have Fresh Start mail them for you.

## Stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Prisma + SQLite
- PDFKit (letter PDFs) + pdf-parse (report intake)
- Vitest

## Develop

```bash
npm install
cp .env.example .env
npx prisma migrate dev
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

| Route | Purpose |
|-------|---------|
| `/demo` | Consumer sample journey (live letter engine) |
| `/operator` | Exception desk, impact-ranked plans, mail, hands-free |
| `/operator/insights` | Outcome win rates by ground / furnisher |
| `/intake` | **Upload credit report PDF** (paste text is secondary) |
| `/cases/[id]` | Consumer portal (evidence coach, responses, tracking) |

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Next.js dev server |
| `npm test` | Engine + platform tests |
| `npm run db:seed` | Seed sample case + furnisher directory |
| `npm run build` | Production build |

## What’s built

**Phase 0/1**
- FCRA ground taxonomy + rules classifier
- CFPB CRA/furnisher letters + compliance linter
- Prisma cases, packets, approval gates, audit log
- Operator approve/deny desk

**Phase 2**
- Simulated certified mail tracking numbers
- Delivery + FCRA investigation clocks
- Letter PDF download

**Phase 3**
- Credit report text/PDF parse spike
- Evidence matching + confidence boost
- Cross-bureau conflict helpers
- Furnisher address directory

**Phase 4**
- Auto-approve policy engine
- Hands-free wave (approve → mail → deliver)
- Response outcome classification
- Next-wave scheduler + reinsertion detection
- In-app / email-stub notifications

**Tier 2 & 3 (current)**
- Evidence coach + required-evidence mail gating
- Annotated report excerpt PDFs
- Response letter inbox (paste / PDF upload)
- Consumer statement + CFPB pack export
- Exception-only operator inbox
- Impact-ranked wave suggestions + conflict radar
- 30/60/90 reinsertion watchdog
- Outcome learning dashboard + richer notification center

## Roadmap / architecture

- Architecture: [docs/AUTOMATION_TECHNICAL_PLAN.md](docs/AUTOMATION_TECHNICAL_PLAN.md)
- **Tier 2 & 3 (done on this branch):** [docs/TIER_2_3_EXECUTION.md](docs/TIER_2_3_EXECUTION.md)
- **Deferred pre-launch (Tier 1 & 4):** [docs/PRE_LAUNCH_TODO.md](docs/PRE_LAUNCH_TODO.md)

Live Lob postage, auth, CROA consent, and bureau data APIs are tracked in Pre-Launch — not in the current execution pass.
