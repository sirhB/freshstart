# Fresh Start — Tier 2 & 3 Execution Tracker

**Status:** In progress (execute now)  
**Scope:** Dispute-winning features + operator innovation  
**Out of scope here:** Auth, CROA, Lob, production OCR, billing — see [PRE_LAUNCH_TODO.md](./PRE_LAUNCH_TODO.md)

---

## Goal

Make disputes harder to rubber-stamp and make your day-to-day work **exception-only**, without waiting on pre-launch infrastructure.

---

## Tier 2 — Makes automation actually win disputes

| ID | Feature | Status | Notes / files |
|----|---------|--------|----------------|
| T2.1 | **Evidence coach** — guided uploads per ground; block mail when required evidence missing | pending | `src/lib/dispute/evidence.ts`, lint, consumer portal |
| T2.2 | **Annotated report excerpts** — highlighted PDF pages of disputed tradelines as enclosures | pending | new PDF generator + packet attachment |
| T2.3 | **Response letter inbox** — upload bureau/furnisher result PDFs → classify outcome → exception gate | pending | portal + outcomes API |
| T2.4 | **Consumer statement + CFPB pack** — one-click FCRA statement after verified; export complaint pack | pending | letter templates + export endpoint |

---

## Tier 3 — Innovation / hands-free differentiation

| ID | Feature | Status | Notes / files |
|----|---------|--------|----------------|
| T3.1 | **Exception-only operator home** — ranked inbox of parse/evidence/SLA/outcome exceptions | pending | `OperatorConsole` redesign |
| T3.2 | **Impact-ranked dispute waves** — rank by impact × winnability × evidence; suggest next 3–5 | pending | scoring module + plan UI |
| T3.3 | **Cross-bureau conflict radar** — side-by-side EQ/EX/TU conflicts surfaced in UI | pending | use `findCrossBureauConflicts` |
| T3.4 | **Reinsertion watchdog** — schedule 30/60/90-day checks; auto-open reinsertion challenge | pending | workflow + case portal |
| T3.5 | **Outcome learning loop** — dashboard: deletion/correction rate by ground / furnisher | pending | `/operator/insights` or panel |
| T3.6 | **Notification center** — richer in-app feed (mail, SLA, exceptions); email/SMS stays Pre-Launch | pending | notifications API + UI |

---

## Execution order

1. T2.1 Evidence coach + lint gating  
2. T2.2 Annotated excerpts  
3. T2.3 Response inbox  
4. T2.4 Statement + CFPB pack  
5. T3.2 Impact ranking (feeds wave selection)  
6. T3.3 Conflict radar  
7. T3.1 Exception-only operator inbox  
8. T3.4 Reinsertion watchdog  
9. T3.5 Outcome insights  
10. T3.6 Notification center  

---

## Definition of done (this tracker)

- [ ] Every disputed item shows required evidence checklist; mailing blocked when missing  
- [ ] Each CRA packet can include annotated report excerpt PDF  
- [ ] Consumer can upload a response letter and get an outcome + exception gate  
- [ ] Verified items can generate a consumer statement + CFPB pack download  
- [ ] Operator default view is exception inbox, not full case dump  
- [ ] Wave suggestions are impact-ranked  
- [ ] Conflict radar visible on case/operator views  
- [ ] Reinsertion checks can be scheduled and listed  
- [ ] Outcome rates visible on an insights surface  
- [ ] In-app notification center usable from portal/operator  

---

## Related docs

- Architecture: [AUTOMATION_TECHNICAL_PLAN.md](./AUTOMATION_TECHNICAL_PLAN.md)  
- Deferred launch work: [PRE_LAUNCH_TODO.md](./PRE_LAUNCH_TODO.md)  
