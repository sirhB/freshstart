# Fresh Start — Pre-Launch TODO

**Status:** Deferred (do **not** execute in the current Tier 2/3 build)  
**Scope:** Trust, legality, real-world I/O, and later scale  
**Active work:** [TIER_2_3_EXECUTION.md](./TIER_2_3_EXECUTION.md)

---

## Why this is separate

Tier 2/3 improve dispute quality and operator leverage on the **existing demo automation spine**.  
Tier 1/4 are required (or useful) **before charging real customers / mailing at scale**, but they do not block shipping the dispute-intelligence and exception-ops features now.

---

## Tier 1 — Must-have to go live

| ID | Feature | Status | Why it waits |
|----|---------|--------|--------------|
| PL.1 | Consumer accounts + identity vault (auth, encrypted ID/address storage) | deferred | Needs auth provider + object storage/KMS |
| PL.2 | CROA / mailing authorization (disclosures, e-sign, fee timing) | deferred | Needs legal review + consent product |
| PL.3 | Real certified mail (Lob/EasyPost) + delivery/RRR webhooks | deferred | Vendor account + production secrets |
| PL.4 | Production PDF parsing / OCR + parse-review gate for real bureau PDFs | deferred | OCR stack + labeled samples; heuristic parser remains for now |

### Tier 1 acceptance (when we pick this up)

- [ ] Real consumers can sign up and upload ID/address proof  
- [ ] No mail without stored CROA + mailing consent  
- [ ] Lob (or EasyPost) sandbox → production path with tracking webhooks  
- [ ] Scanned/complex bureau PDFs parse at usable confidence or hit operator parse-review  

---

## Tier 4 — Later scale

| ID | Feature | Status | Why it waits |
|----|---------|--------|--------------|
| PL.5 | Paid credit-data APIs (Array/Spinwheel/etc.) instead of PDF-only | deferred | Cost + vendor contracts |
| PL.6 | Bureau online dispute adapters (optional secondary channel) | deferred | Fragile integrations; mail stays primary |
| PL.7 | Multi-operator roles / agency white-label | deferred | Solo-supervisor model first |
| PL.8 | Billing / subscriptions | deferred | Only after CROA counsel on fee structure |
| PL.9 | Postgres migration off SQLite | deferred | Fine until multi-tenant / volume |

---

## Explicit non-goals right now

- Do not block Tier 2/3 on Lob, Auth.js/Clerk, or Stripe  
- Do not expand marketing site as a substitute for dispute features  
- Do not add unsupervised mass-dispute modes  

---

## When to open this doc for execution

Start Pre-Launch when:

1. Tier 2/3 checklist in [TIER_2_3_EXECUTION.md](./TIER_2_3_EXECUTION.md) is largely done, **and**  
2. You are ready to onboard non-demo consumers or spend on Lob/OCR vendors.

---

## Related docs

- Architecture: [AUTOMATION_TECHNICAL_PLAN.md](./AUTOMATION_TECHNICAL_PLAN.md)  
- Active build: [TIER_2_3_EXECUTION.md](./TIER_2_3_EXECUTION.md)  
