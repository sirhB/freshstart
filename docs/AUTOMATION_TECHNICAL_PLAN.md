# Fresh Start — Technical Automation Plan

**Status:** Planning document (not yet implemented)  
**Audience:** Product + engineering  
**Goal:** Operate Fresh Start as a mostly hands-free credit dispute platform, with you supervising and approving/denying high-risk steps.

---

## 1. Product intent

Fresh Start today is a consumer marketing site plus a mock journey: upload → analyze → select items → generate bureau letters → download or “mail for me.”

The live product should:

1. Ingest a consumer’s credit report (PDF and/or bureau API data).
2. Automatically detect inaccurate, incomplete, outdated, or unverifiable items.
3. Draft **CFPB-aligned** dispute packets (CRA + furnisher letters).
4. Queue certified mail (or bureau online dispute) with tracking.
5. Monitor responses, deadlines, and outcomes.
6. Escalate only when a human decision is required.

**Non-negotiable principle:** The system disputes information that is inaccurate, incomplete, outdated past legal reporting periods, or that the furnisher/CRA cannot verify. It does **not** mass-dispute accurate negative history in hopes it “falls off.” That approach is ineffective, often rejected as frivolous, and creates CROA / unfair-practices risk.

---

## 2. What actually works (research summary)

Sources: [CFPB CRA sample letter](https://files.consumerfinance.gov/f/documents/092016_cfpb__CreditReportingSampleLetter.pdf), [CFPB furnisher sample letter](https://files.consumerfinance.gov/f/documents/092016_cfpb_FurnisherSampleLetter.pdf), [CFPB Ask CFPB](https://www.consumerfinance.gov/ask-cfpb/how-do-i-dispute-an-error-on-my-credit-report-en-314/), [FTC dispute guide](https://consumer.ftc.gov/articles/disputing-errors-your-credit-reports), [CFPB Circular 2022-07](https://www.consumerfinance.gov/compliance/circulars/consumer-financial-protection-circular-2022-07-reasonable-investigation-of-consumer-reporting-disputes/), FCRA §611 / §623, Regulation V 12 CFR 1022.43.

### 2.1 Dual-path disputes

| Path | Who | Legal duty | Why it matters |
|------|-----|------------|----------------|
| **CRA dispute** | Equifax / Experian / TransUnion | CRA must reasonably reinvestigate (~30 days, up to 45 if more info arrives mid-window) and forward all relevant consumer evidence to the furnisher | Triggers furnisher duties under FCRA §623(b); results return in writing |
| **Furnisher direct dispute** | Lender / collector / original creditor | Furnisher must reasonably investigate qualifying direct disputes under Reg V §1022.43 | Can force correction at the source; if inaccurate/unverifiable, furnisher must fix and notify all CRAs |

**Platform rule:** For each selected item, generate **both** CRA letter(s) for bureaus that report it **and** a furnisher letter when a dispute address is known.

### 2.2 Letter content that survives “frivolous” screening

Effective letters are specific, not templated boilerplate. Each disputed item must include:

1. Consumer identity block (full name, current address, DOB; report/file number; phone; optional SSN/DL only when needed for matching).
2. Exact tradeline identity (creditor name, account number as shown, dates, balance/status as reported).
3. **Field-level** inaccuracy (“Date of last activity shows 03/2019; payment records show 08/2022”), not vague “please remove.”
4. Clear ask: delete if unverifiable, or correct to stated accurate values.
5. Supporting enclosures listed (copies only): highlighted report pages, statements, payment proofs, ID + address proof (utility/bank statement), police/FTC identity-theft report when applicable.
6. Certified mail + return receipt; retain full packet copies.

CFPB structure for CRA letters:

1. Identifying information  
2. Company (CRA) information  
3. Disputed items (account #, dates, explanation, furnisher, type)  
4. Enclosures list  

Same four-block pattern for furnishers, addressed to the furnisher’s designated dispute address.

### 2.3 Ground taxonomy (machine-classifiable)

| Ground code | When to use | Evidence the engine should seek |
|-------------|-------------|----------------------------------|
| `NOT_MINE` | Account / inquiry not belonging to consumer | ID theft affidavit, FTC report, address/name mismatch |
| `INACCURATE_STATUS` | Wrong status, balance, DOFD, payment history | Statements, payoff letters, payment history export |
| `INCOMPLETE` | Missing required completeness (e.g., partial Metro 2 fields) | Side-by-side bureau comparison |
| `OUTDATED` | Past FCRA reporting window (generally 7 years / bankruptcy 10) | DOFD / filing date math |
| `DUPLICATE` | Same debt reported multiple ways | Cross-tradeline match |
| `UNVERIFIABLE` | Consumer asserts furnisher cannot produce verification | Request investigation; attach available records |
| `MIXED_FILE` | File contamination with another consumer | Address/SSN fragment mismatches across report |
| `MEDICAL_SPECIAL` | Medical collections under current reporting rules / paid or under threshold | Bill, insurance EOB, payment proof |
| `AUTHORIZED_USER_ONLY` | Wrongly reported as primary | Card agreement / AU documentation |

**Do not auto-select** items whose only “ground” is “negative but accurate.” Surface those as educational / counseling, not dispute candidates.

### 2.4 Sequencing that improves outcomes

1. **Parse + normalize** all three bureaus when available; dispute only where the error appears.  
2. **Evidence-first:** prefer items with attached proof; hold weak items for human review.  
3. **CRA + furnisher in parallel** for strong cases (mail both).  
4. **One focused packet per recipient** — avoid dumping dozens of unrelated items without per-item facts (increases frivolous risk). Cap auto-batch size (e.g., 3–5 strong items per wave).  
5. **Wait for investigation window** before re-disputing the same fact pattern; re-dispute only with **new evidence** or a new inaccuracy.  
6. After verification without change: offer a **consumer statement of dispute** (FCRA right), and optionally CFPB complaint logging — never endless identical letters.  
7. Track reinsertion: if a deleted item returns, auto-open a reinsertion challenge with prior deletion evidence.

### 2.5 Mail vs online

| Channel | Pros | Cons | Platform default |
|---------|------|------|------------------|
| Certified mail + RRR | Paper trail; enclosures travel with dispute; CFPB/FTC recommended pattern | Slower; postage cost | **Default for evidence-heavy disputes** |
| Bureau online portals | Fast intake | Enclosure quality varies; weaker audit trail | Optional secondary path when consumer opts in |
| Phone | Quick for simple ID theft follow-ups | Poor evidence trail | Not used for primary disputes |

---

## 3. Target architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client app (Next.js)                     │
│  Consumer portal · Operator console · Letter preview · Tracking  │
└───────────────┬───────────────────────────────┬─────────────────┘
                │                               │
                ▼                               ▼
┌───────────────────────────┐     ┌───────────────────────────────┐
│     API / BFF (Next or    │     │     Operator / approval API    │
│     separate Nest/Laravel)│     │     (HITL queues + audit log)  │
└─────────────┬─────────────┘     └───────────────┬───────────────┘
              │                                     │
              ▼                                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Workflow engine (Temporal / Inngest / BullMQ) │
│  intake → parse → classify → draft → approve → mail → monitor    │
└──────────┬──────────┬──────────┬──────────┬──────────┬──────────┘
           │          │          │          │          │
           ▼          ▼          ▼          ▼          ▼
      Object store  LLM+rules  PDF/letter  Lob/EasyPost  Response
      (reports,     dispute    renderer    (certified     ingest
       ID docs)     engine     (CFPB)      mail + RRR)    (OCR/email)
           │
           ▼
      Postgres (source of truth) + encrypted PII vault
```

**Recommended stack evolution** (fits current Next.js repo):

| Layer | Choice | Why |
|-------|--------|-----|
| App | Next.js App Router (keep) | Already shipping marketing + demo |
| DB | Postgres + Prisma | Relational case/tradeline/letter model |
| Jobs | Inngest or Temporal | Long-running 30–45 day dispute clocks |
| Files | S3-compatible + KMS | Reports, ID, proofs, letter PDFs |
| Letters | React-PDF or Docxtemplater from CFPB templates | Exact printable packets |
| Mail | Lob / EasyPost + USPS RRR | Certified mail automation |
| AI | Structured LLM calls behind rule gates | Ground classification + letter prose; never sole authority |
| Auth | Clerk/Auth.js + role `consumer` / `operator` / `admin` | HITL console |

---

## 4. Domain model (core entities)

```
Consumer
  ├── IdentityDocuments[]
  ├── ConsentRecord[]          # FCRA/CROA disclosures, mail authorization
  ├── CreditReport[]           # per pull / upload
  │     └── Tradeline[]        # normalized Metro-2-ish fields
  ├── DisputeCase              # one engagement / wave
  │     ├── DisputeItem[]      # tradeline + ground + confidence + evidence
  │     ├── LetterPacket[]     # CRA or Furnisher recipient
  │     │     ├── LetterVersion[]  # drafts → approved → mailed
  │     │     └── MailShipment     # tracking, RRR, delivered_at
  │     ├── ApprovalGate[]     # human decisions
  │     └── Investigation[]    # 30/45-day timers + outcomes
  └── OutcomeEvent[]           # deleted / updated / verified / reinserted
```

**Key fields on `DisputeItem`:**

- `ground_code`, `ground_rationale` (machine + human editable)  
- `confidence` (0–1) and `risk_flags[]` (`accurate_looking`, `no_evidence`, `credit_repair_pattern`, `mixed_file`)  
- `requested_remedy` (`delete` | `correct` + `corrected_values` JSON)  
- `status`: `proposed` → `approved` → `queued` → `mailed` → `investigating` → `resolved_*`

---

## 5. End-to-end automation pipeline

### Stage A — Intake (mostly automatic)

1. Consumer creates account, completes identity, uploads government ID + proof of address.  
2. Uploads credit report PDF(s) and/or connects a report provider API (future).  
3. System stores encrypted blobs; runs virus scan; records consent for automated mailing.

**Human gate:** none by default. Auto-reject corrupt/unreadable files and ask for re-upload.

### Stage B — Parse & normalize (automatic)

1. PDF → structured tradelines (OCR + layout model, or bureau API JSON).  
2. Normalize creditor names, account masks, statuses, DOFD, balances across EQ/EX/TU.  
3. Build a **cross-bureau conflict matrix** (same account, different status/balance/dates).

**Human gate:** if parse confidence &lt; threshold, operator reviews highlighted PDF mapping before classification proceeds.

### Stage C — Dispute intelligence (automatic + rules)

Rule engine first, LLM second:

1. Apply deterministic rules (outdated, duplicate, bureau conflicts, missing DOFD, AU misreport).  
2. LLM proposes ground + rationale **constrained to taxonomy**; must cite report fields.  
3. Score each item: `impact × winnability × evidence_strength`.  
4. Auto-select top N within batch limits; leave rest as `suggested` or `skip`.

**Human gate (you):** review proposed dispute set — **Approve / Deny / Edit ground / Request more evidence** per item or as a batch. This is the primary supervision surface.

### Stage D — Evidence assembly (semi-automatic)

1. Match consumer-uploaded proofs to items (statement dates, account last-4).  
2. Auto-generate annotated report pages (highlight disputed rows).  
3. Flag items lacking required enclosures.

**Human gate:** deny mailing for any approved item still missing required evidence, or approve “investigation request without primary proof” only when legally appropriate (identity/mixed-file cases).

### Stage E — Letter generation (automatic; CFPB format)

For each recipient (3 CRAs max + N furnishers):

1. Fill CFPB four-block template.  
2. Render PDF: cover letter + enclosure index + annotated pages + ID/address copies.  
3. Run compliance linter (see §7).  
4. Produce `LetterVersion` with diffable text for operator preview.

**Human gate:** final **Approve packet / Deny / Request rewrite** before postage spend. Optional auto-approve when confidence ≥ X and linter clean (configurable).

### Stage F — Mailing & tracking (automatic after approval)

1. Submit to Lob/EasyPost as certified mail + return receipt.  
2. Persist tracking numbers; notify consumer.  
3. On delivery → start investigation SLA clock (30 days; extend to 45 if consumer adds info).

**Human gate:** none after approve, unless mail soft-fails (bad address) → operator queue.

### Stage G — Response monitoring (automatic)

1. Ingest CRA results (consumer upload of result letter, mailbox OCR, or portal scrape where permitted).  
2. Classify outcome per item: deleted, corrected, verified, frivolous, no response.  
3. Update tradeline state; schedule follow-ups.

**Human gate:** verified-but-consumer-disagrees; frivolous notices; legal escalation (CFPB complaint drafting).

### Stage H — Next wave / closure (automatic with optional review)

1. If deletions occurred, pull/refresh report and confirm.  
2. Queue reinsertion watch (30/60/90 days).  
3. Propose next wave of remaining high-confidence items.  
4. Close case when no actionable inaccurate items remain.

---

## 6. Human-in-the-loop design (your supervision)

Design for **&lt;10 minutes/day** at steady state via an Operator Console.

### 6.1 Approval queues

| Queue | Trigger | Actions | Default SLA |
|-------|---------|---------|-------------|
| **Parse review** | Low OCR confidence | Confirm tradeline mapping | 24h |
| **Dispute plan** | New analysis ready | Approve/deny/edit items | 24h |
| **Packet sign-off** | Letters rendered | Approve/deny/rewrite | 12h |
| **Mail exceptions** | Address/postage failure | Fix & retry | 12h |
| **Outcome exceptions** | Verified / frivolous / odd results | Choose next step | 48h |
| **Compliance holds** | CROA/risk flags | Release or kill | Immediate |

### 6.2 Auto-approve policy (hands-free mode)

When enabled per consumer or globally:

- Auto-approve dispute items with `confidence ≥ 0.85`, deterministic ground (`OUTDATED`, `DUPLICATE`, clear bureau conflict), and attached evidence.  
- Auto-approve packets that pass the compliance linter.  
- Always require human approval for: identity theft claims, medical edge cases, high-dollar charge-offs without docs, any item flagged `accurate_looking`, first packet for a new consumer, and any LLM-only ground without rule corroboration.

### 6.3 Auditability

Every gate decision stores: actor, timestamp, before/after JSON, reason codes. Letters are immutable once mailed (`LetterVersion` frozen + SHA-256 of PDF).

---

## 7. Accurate & beneficial letter engine

### 7.1 Template strategy

Maintain versioned templates derived from CFPB samples:

- `templates/cfpb_cra_dispute_v1`  
- `templates/cfpb_furnisher_dispute_v1`  
- `templates/reinsertion_challenge_v1`  
- `templates/consumer_statement_v1`

Variable slots only — no free-form “credit repair jargon” layers (“method X,” “pay for delete demands,” threats of suit as default tone). Tone: factual, FCRA-citing, consumer-voiced.

### 7.2 Generation pipeline

```
DisputeItem[] + Consumer + Evidence
        │
        ▼
Structured prompt / rules → Item narrative blocks
        │
        ▼
Template merge → full letter text
        │
        ▼
Compliance linter
        │
        ▼
PDF render + enclosure binder
```

**LLM role:** rewrite field-level explanations for clarity; never invent account numbers, dates, or evidence.

### 7.3 Compliance linter (block mailing if fail)

- Every disputed item has account identifier + specific reason.  
- No claim of guaranteed deletion.  
- No instruction to dispute accurate information.  
- Enclosures listed match attached files.  
- Recipient address is current CRA dispute address or known furnisher dispute address.  
- Identity block complete.  
- Packet size within policy (items per letter).  
- CROA-required disclosures present in consumer-facing UI (not necessarily inside bureau letter).

### 7.4 Example CRA item block (target quality)

```text
3. Creditor: Synchrony Bank / Midland Credit Management
   Account number (as shown): ****4412
   Dates of disputed information: Opened 11/2020; status “Open collection” as of report dated 09/12/2026
   Type: Collection
   Company that furnished the information: Midland Credit Management
   Explanation of inaccuracy: This account is not mine. My full name, current address, and
   date of birth do not match the identifying information associated with this tradeline on
   my file. I have enclosed a copy of my government ID, proof of address, and Identity Theft
   Report. I request that you delete this information if it cannot be verified as belonging
   to me, or correct it to remove it from my file.
```

---

## 8. Operator & consumer UX surfaces

### Consumer portal

1. Upload reports & evidence  
2. See proposed disputes in plain language  
3. Approve mailing authorization once  
4. Track certified mail + investigation countdowns  
5. Upload bureau response letters  
6. Download all packets anytime  

### Operator console (you)

1. Unified inbox of gates (§6.1)  
2. Side-by-side: report PDF highlight ↔ proposed letter  
3. One-click approve batch / deny with reason  
4. Outcome dashboard: deletion rate by ground, SLA breaches  
5. Address book for furnisher dispute addresses (crowdsourced + manual)

### Demo alignment

Evolve `/demo` from mock copy into a **shadow mode** of the real pipeline (same stages, synthetic data) so marketing stays truthful as automation ships.

---

## 9. Integrations roadmap

| Integration | Purpose | Priority |
|-------------|---------|----------|
| PDF parser (custom + OCR) | Tradeline extraction from uploaded reports | P0 |
| Lob / EasyPost | Certified mail automation | P0 |
| Object storage + KMS | PII document vault | P0 |
| Inngest/Temporal | Investigation timers & retries | P0 |
| Array / Spinwheel / similar (optional) | Structured credit data vs PDF-only | P1 |
| Email inbound parse | Auto-ingest CRA results | P1 |
| CFPB complaint API / export | Escalation packs | P2 |
| E-signature | Consumer authorization & CROA docs | P1 |

---

## 10. Security, privacy, compliance

1. **PII:** encrypt at rest (column + object); minimize SSN storage; access-logged vault.  
2. **CROA:** if operating as a credit repair organization, implement required contracts, cancellation rights, and prohibition on charging for services before fully performed — product counsel must confirm scope.  
3. **FCRA:** platform assists consumers asserting their own rights; letters are in the consumer’s voice; retain authorization to mail as agent where applicable.  
4. **Marketing claims:** no “guaranteed score increase” or “we remove anything.” Align site copy with accurate-dispute positioning (already directionally correct).  
5. **Retention:** define purge windows for reports/ID after case closure.  
6. **Vendor DPAs** for mail and AI providers; no training on consumer data without opt-in/contractual ban.

---

## 11. Phased delivery

### Phase 0 — Foundations
Postgres schema, auth roles, encrypted uploads, audit log, operator shell.

### Phase 1 — Assisted letters (human-heavy)
Manual/parsed tradeline entry → rule suggestions → CFPB PDF generation → download. Operator approves everything. Replaces demo letter text with real templates.

### Phase 2 — Mail automation
Lob certified mail, tracking UI, investigation clocks, consumer notifications.

### Phase 3 — Intelligence
Cross-bureau normalization, ground taxonomy scoring, evidence matching, auto-select with HITL plan approval.

### Phase 4 — Hands-free mode
Auto-approve policies, response OCR, reinsertion watch, next-wave scheduler, outcome analytics that retrain rule weights (not unsupervised letter spam).

### Phase 5 — Scale
Furnisher address graph, multi-wave strategy optimization, optional bureau API ingest, staffing tools for multiple operators.

---

## 12. Success metrics

| Metric | Target direction |
|--------|------------------|
| % of mailed items with field-level rationale + evidence | → 100% |
| Frivolous/irrelevant rate | ↓ minimize |
| Deletion or correction rate on **approved inaccurate** items | ↑ (track separately from overall negatives) |
| Median operator time per active consumer / week | ↓ toward hands-free |
| Investigation SLA breaches (no follow-up logged) | → 0 |
| Reinsertion detection latency | ↓ |
| Consumer NPS / completion of authorization flow | ↑ |

---

## 13. Immediate engineering backlog (implementation order)

1. Domain schema + migrations for consumers, reports, tradelines, dispute items, letters, approvals, shipments.  
2. CFPB CRA + furnisher PDF templates with fixture golden-file tests.  
3. Compliance linter tests (reject vague / guarantee / missing ID).  
4. Operator approval API + minimal console UI.  
5. Credit report PDF parsing spike (one bureau PDF format first).  
6. Lob sandbox mailing for approved packets.  
7. Investigation timer workers + consumer status page.  
8. Dispute intelligence v1: deterministic rules only; add LLM narratives behind rules.  
9. Auto-approve policy engine.  
10. Response upload + outcome classification.

---

## 14. Open decisions (product)

1. Consumer-self-serve only vs also B2B agency mode later?  
2. PDF-only ingest vs paid credit-data API in Phase 1?  
3. Strict human packet sign-off forever vs confidence-based auto-mail?  
4. Furnisher letters in wave 1 or CRA-only first?  
5. Legal entity posture under CROA (counsel).

---

## Appendix A — CRA mailing addresses (verify before each send)

Addresses change; resolve at send-time from config fed by periodic verification:

- **Equifax Information Services LLC** — P.O. Box 740256, Atlanta, GA 30374 (confirm current)  
- **Experian** — P.O. Box 4500, Allen, TX 75013  
- **TransUnion LLC Consumer Dispute Center** — P.O. Box 2000, Chester, PA 19016  

Always prefer the dispute address printed on the consumer’s own report when it differs.

## Appendix B — Reference links

- CFPB CRA sample letter PDF: https://files.consumerfinance.gov/f/documents/092016_cfpb__CreditReportingSampleLetter.pdf  
- CFPB furnisher sample letter PDF: https://files.consumerfinance.gov/f/documents/092016_cfpb_FurnisherSampleLetter.pdf  
- CFPB how to dispute: https://www.consumerfinance.gov/ask-cfpb/how-do-i-dispute-an-error-on-my-credit-report-en-314/  
- FTC disputing errors: https://consumer.ftc.gov/articles/disputing-errors-your-credit-reports  
- CFPB Circular 2022-07 (reasonable investigation): https://www.consumerfinance.gov/compliance/circulars/consumer-financial-protection-circular-2022-07-reasonable-investigation-of-consumer-reporting-disputes/  
- Reg V direct disputes: https://www.ecfr.gov/current/title-12/chapter-X/part-1022/subpart-E/section-1022.43  
