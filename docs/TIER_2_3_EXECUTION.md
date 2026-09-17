# Fresh Start — Tier 2 & 3 Execution Tracker

**Status:** Complete (Tier 2 & 3 shipped on this branch)  
**Scope:** Dispute-winning features + operator innovation  
**Out of scope here:** Auth, CROA, Lob, production OCR, billing — see [PRE_LAUNCH_TODO.md](./PRE_LAUNCH_TODO.md)

---

## Goal

Make disputes harder to rubber-stamp and make your day-to-day work **exception-only**, without waiting on pre-launch infrastructure.

---

## Tier 2 — Makes automation actually win disputes

| ID | Feature | Status | Notes / files |
|----|---------|--------|----------------|
| T2.1 | **Evidence coach** — guided uploads per ground; block mail when required evidence missing | done | `evidence-coach.ts`, lint errors, `decidePacket` / `queueMail` gates, CasePortal coach UI |
| T2.2 | **Annotated report excerpts** — highlighted PDF pages of disputed tradelines as enclosures | done | `annotate.ts`, `GET /api/packets/[id]/excerpt-pdf`, auto `report_excerpt` evidence on plan approve |
| T2.3 | **Response letter inbox** — upload bureau/furnisher result PDFs → classify outcome → exception gate | done | multipart `POST .../outcomes`, `response_letter` evidence, portal upload + paste |
| T2.4 | **Consumer statement + CFPB pack** — one-click FCRA statement after verified; export complaint pack | done | `statements.ts`, `GET .../statement?itemId=` / `?pack=cfpb` |

---

## Tier 3 — Innovation / hands-free differentiation

| ID | Feature | Status | Notes / files |
|----|---------|--------|----------------|
| T3.1 | **Exception-only operator home** — ranked inbox of parse/evidence/SLA/outcome exceptions | done | `exceptions.ts`, `GET /api/operator/exceptions`, OperatorConsole default tab |
| T3.2 | **Impact-ranked dispute waves** — rank by impact × winnability × evidence; suggest next 3–5 | done | `impact.ts`, bundle `suggestedWaveIds`, plan UI pre-select |
| T3.3 | **Cross-bureau conflict radar** — side-by-side EQ/EX/TU conflicts surfaced in UI | done | `findCrossBureauConflicts` on case bundle; operator + portal panels |
| T3.4 | **Reinsertion watchdog** — schedule 30/60/90-day checks; auto-open reinsertion challenge | done | `ReinsertionCheck` model, schedule on wins, `.../reinsertion` API |
| T3.5 | **Outcome learning loop** — dashboard: deletion/correction rate by ground / furnisher | done | `insights.ts`, `/operator/insights`, `GET /api/insights/outcomes` |
| T3.6 | **Notification center** — richer in-app feed (mail, SLA, exceptions); email/SMS stays Pre-Launch | done | `notifications.ts`, portal center + operator feed tab |

---

## Execution order

1. T2.1 Evidence coach + lint gating ✅  
2. T2.2 Annotated excerpts ✅  
3. T2.3 Response inbox ✅  
4. T2.4 Statement + CFPB pack ✅  
5. T3.2 Impact ranking (feeds wave selection) ✅  
6. T3.3 Conflict radar ✅  
7. T3.1 Exception-only operator inbox ✅  
8. T3.4 Reinsertion watchdog ✅  
9. T3.5 Outcome insights ✅  
10. T3.6 Notification center ✅  

---

## Definition of done (this tracker)

- [x] Every disputed item shows required evidence checklist; mailing blocked when missing  
- [x] Each CRA packet can include annotated report excerpt PDF  
- [x] Consumer can upload a response letter and get an outcome + exception gate  
- [x] Verified items can generate a consumer statement + CFPB pack download  
- [x] Operator default view is exception inbox, not full case dump  
- [x] Wave suggestions are impact-ranked  
- [x] Conflict radar visible on case/operator views  
- [x] Reinsertion checks can be scheduled and listed  
- [x] Outcome rates visible on an insights surface  
- [x] In-app notification center usable from portal/operator  

---

## Related docs

- Architecture: [AUTOMATION_TECHNICAL_PLAN.md](./AUTOMATION_TECHNICAL_PLAN.md)  
- Deferred launch work: [PRE_LAUNCH_TODO.md](./PRE_LAUNCH_TODO.md)  
