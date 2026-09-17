# Fresh Start

Personal credit repair for consumers — upload your credit report PDF, review disputable items, generate bureau letters, and download them or have Fresh Start mail them for you.

## Stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Prisma + SQLite (Phase 0 persistence)
- Vitest (dispute engine tests)

## Develop

```bash
npm install
cp .env.example .env
npx prisma migrate dev
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

- Interactive sample journey: `/demo`
- Operator approval desk: `/operator`

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Next.js dev server |
| `npm test` | Dispute engine + letter lint tests |
| `npm run db:seed` | Seed sample consumer / case / CFPB packets |
| `npm run build` | Production build |

## What’s built (Phase 0/1)

- FCRA ground taxonomy + rules classifier (skips accurate-but-negative items)
- CFPB-structured CRA and furnisher letter generator
- Compliance linter (blocks vague / guarantee / accurate-looking mailings)
- Prisma case model with approval gates + audit log
- Operator console to approve/deny dispute plans and letter packets
- Demo wired to the real letter engine

## Roadmap

See [docs/AUTOMATION_TECHNICAL_PLAN.md](docs/AUTOMATION_TECHNICAL_PLAN.md) for the hands-free automation architecture, human approval gates, CFPB-aligned dispute letter strategy, and later phases (PDF parse, Lob certified mail, auto-approve policies).
