# Digital MAF — Proof of Concept

A runtime schema-driven form platform for school health medication authorizations,
built on **FHIR R4 Structured Data Capture**.

The form is **data, not code**. A `Questionnaire` resource is served by the API and
rendered at runtime by a generic engine. Changing a form means editing JSON and
publishing a new version — not shipping a release.

> [!WARNING]
> **This is a proof of concept, not a product.** It has no authentication, no real
> cryptographic signatures, and no connection to any health record system. Codes in the
> form definitions are illustrative placeholders, not validated SNOMED/RxNorm/LOINC.
> **Do not use it with real patient data or for any clinical purpose.**

---

## What this exists to prove

Three falsifiable claims. Everything in the repository is scaffolding for testing them.

| # | Claim | How it's verified |
|---|---|---|
| 1 | **Runtime rendering** — the React app contains no asthma-specific code | `grep -ril "asthma\|inhaler\|albuterol" web/src --exclude-dir=osh` returns nothing |
| 2 | **Zero-code extensibility** — a structurally different second form renders with no changes outside one folder | Publish a Seizure definition, change no code |
| 3 | **Structured extraction** — a submission yields a `MedicationRequest` with a real `Dosage`, not a text blob | Assertions on `Dosage.doseAndRate` and `Dosage.route` |

**Claim 2 is the one that can come back false.** A failed extensibility test is a
successful outcome — it locates the real boundary of the pattern early, while changing
direction is still cheap.

---

## Quick start

**Prerequisites:** .NET 10 SDK, Node.js 22+, SQL Server (LocalDB, Developer Edition, or
the Docker image).

```bash
git clone <this-repo> && cd maf-poc

# Database
sqlcmd -S "(localdb)\mssqllocaldb" -i api/Osh.Maf.Data/Migrations/001_FormDefinition.sql
# ...and the remaining numbered migrations

# API  ->  http://localhost:5080
cd api/Osh.Maf.Api && dotnet run

# Web  ->  http://localhost:5173
cd web && npm install && npm run dev
```

Publish a definition, then open the app:

```bash
curl -X POST http://localhost:5080/fhir/Questionnaire \
  -H "Content-Type: application/fhir+json" \
  --data-binary @definitions/asthma-maf-2026.02.json
```

| URL | What |
|---|---|
| http://localhost:5173 | The form renderer |
| http://localhost:5080/scalar | Interactive API reference |
| http://localhost:5080/openapi/v1.json | Raw OpenAPI document |

The browser only talks to 5173; `/fhir/*` is proxied to the API inside Vite.

---

## How it works

```
Questionnaire (versioned, immutable)
        │
        ▼
QuestionnaireItemWalker ──► resolveItemControl ──┬─► item-controls/fhir/   (item.type)
        │                                        └─► item-controls/osh/    (extension code)
        ▼
QuestionnaireResponse (pins the definition version it was filled under)
        │
        ▼
Server revalidation ──► Extraction ──► FHIR document Bundle
```

The **item control registry** is the load-bearing idea. The walker reads an item's
`type`, looks up which component handles it, and hands off. It has no idea what an
inhaler is.

### Three invariants, all machine-enforced

| Invariant | Enforced by |
|---|---|
| `renderer/` never imports `item-controls/osh/` | ESLint `no-restricted-imports` |
| Only `contract.ts` imports `fhir/r4` | ESLint `no-restricted-imports` |
| Published definitions are never updated | SQL `INSTEAD OF UPDATE` trigger |

An architectural rule a machine can check is a rule that survives a busy Friday.

### Versioning

A `Questionnaire` is identified by its canonical `url` plus a `version`, and the pair is
immutable — a revision is a new row, never an edit. Every `QuestionnaireResponse` pins the
exact version it was filled against, and server-side validation loads that version rather
than the current one.

This is a legal requirement, not a preference: a signed medication order must render
exactly as it was signed, years later, after the form has been revised.

---

## API

All endpoints speak `application/fhir+json`. Requests also accept plain
`application/json`. Errors are always an `OperationOutcome`.

| Method | Route | Notes |
|---|---|---|
| `GET` | `/fhir/Questionnaire?url={canonical}&version={v}` | Omit `version` for the latest `active` |
| `GET` | `/fhir/Questionnaire/{id}` | |
| `POST` | `/fhir/Questionnaire` | `409` if `(url, version)` already exists |
| `GET` | `/fhir/QuestionnaireResponse/{id}` | |
| `POST` | `/fhir/QuestionnaireResponse` | `422` + `OperationOutcome` on validation failure |
| `PUT` | `/fhir/QuestionnaireResponse/{id}` | `409` once no longer `in-progress` |
| `GET` | `/fhir/Bundle/{responseId}` | Assembled `document` Bundle |

Validation failures set `issue.expression` to the failing `linkId`, so a client can
highlight the exact field.

This is a **façade**, not a conformant FHIR server — no `_history`, no `_include`, no full
search grammar, no `CapabilityStatement`.

---

## Stack

**Backend** — .NET 10, ASP.NET Core, [Firely .NET SDK](https://github.com/FirelyTeam/firely-net-sdk)
(`Hl7.Fhir.R4` 6.x), Dapper, SQL Server, Scalar for the API UI

**Frontend** — React 19, TypeScript, Vite, [fhirpath.js](https://github.com/HL7/fhirpath.js),
TanStack Query

**Standard** — [FHIR R4](http://hl7.org/fhir/R4/) with the
[Structured Data Capture IG](http://hl7.org/fhir/uv/sdc/)

Deliberately **not** used: no FHIR server, no form library, no component library, no
identity provider.

Conditional logic is evaluated with **FHIRPath, never `eval()`**. Definitions are served
to parents and outside practitioners over the public internet; a definition that can be
influenced must not be able to execute code in their browsers.

---

## Repository layout

```
maf-poc/
├── api/
│   ├── Osh.Maf.Api/          FHIR façade — controllers, validation, extraction
│   ├── Osh.Maf.Data/         repositories + numbered .sql migrations
│   └── Osh.Maf.Tests/
├── web/src/
│   ├── renderer/             the engine: walks the tree, owns state
│   ├── item-controls/
│   │   ├── contract.ts       the props contract + RenderMode
│   │   ├── index.ts          registry + resolveItemControl
│   │   ├── fhir/             keyed by item.type — standard, domain-free
│   │   └── osh/              keyed by extension code — the only domain-aware code
│   └── api/                  typed fetch clients
├── definitions/              published Questionnaire JSON
└── docs/
```

---

## Documentation

| Document | What it covers |
|---|---|
| **[Developer guide](docs/DEVELOPER-GUIDE.md)** | The full walkthrough — FHIR SDC background, every component, with the reasoning inline. Start here. |
| [Quick reference](docs/DEVELOPER-GUIDE.md#quick-reference) | Ports, folder map, endpoints, the `item.type` → answer key table |
| [Naming convention](docs/DEVELOPER-GUIDE.md#appendix-e--naming-convention) | Why `QuestionnaireItemProps` and not `ItemProps` |
| [Decision log](docs/DEVELOPER-GUIDE.md#appendix-f--decision-log) | What was chosen, what was rejected, and where the reasoning is weakest |
| [Troubleshooting](docs/DEVELOPER-GUIDE.md#appendix-b--troubleshooting) | The failures you'll actually hit |
| [Build spec](docs/BUILD-SPEC.md) | Constraint-oriented version for AI coding agents |

New to FHIR? The developer guide assumes no prior knowledge and its orientation section
takes about twenty minutes.

---

## Status

| Component | State |
|---|---|
| FHIR serialization and API scaffolding | |
| Immutable versioned definition storage | |
| Runtime renderer and item control registry | |
| Conditional logic (`enableWhen`, FHIRPath) | |
| Submission and server-side revalidation | |
| Custom item controls, Asthma definition | |
| Extraction into clinical resources | |
| Extensibility verification (second form type) | |
| `FINDINGS.md` | |

---

## Known gaps

Not oversights — deliberate scope boundaries, recorded so nobody mistakes this for a
foundation.

| Concern | Current state |
|---|---|
| Authentication | A role dropdown. No IdP, no tokens, no passwords. |
| Signatures | Name + timestamp + SHA-256. Not real detached JWS. |
| `repeats: true` | The state layer handles arrays; controls read `answers[0]`. |
| Per-item `readOnly` | A separate axis from `RenderMode`. Needed first for parallel actor lanes. |
| Parallel lanes | Item-level ownership within one response has no SDC standard answer. Design is assembled from adjacent patterns. |
| Extraction generality | Definition-pointer extraction is the least mature part of SDC. May require per-form C#. |
| Terminology | Illustrative codes only. No terminology server. |
| Downstream delivery | Writes a Bundle to a local file. |
| PDF of record | Print stylesheet on `view` mode, or nothing. |

---

## Working on this

- Read the [naming convention](docs/DEVELOPER-GUIDE.md#appendix-e--naming-convention)
  before naming anything. `item` is heavily overloaded in FHIR and the convention exists
  to disambiguate it.
- Domain knowledge goes in `item-controls/osh/` and nowhere else. ESLint will tell you.
- Never `UPDATE` a published definition. Publish a new version.
- A new item type means a control in `item-controls/fhir/` plus a registry entry. If you
  find yourself editing the walker, something is wrong.
- FHIR JSON forbids empty arrays — `"answer": []` is a parse error, not an empty value.

---

## License

<!-- Choose one before making this repository public. MIT is the usual choice for a POC;
     check whether your organization requires something specific for public-sector work. -->

TBD.

---

## Acknowledgements

The [OpenMRS ESM form engine](https://github.com/openmrs/openmrs-esm-form-engine-lib) was
evaluated as a foundation and rejected — it is inseparable from OpenMRS's Encounter/Obs
data model. Three of its ideas are visible throughout this codebase and are gratefully
borrowed: the component registry, multiple render modes, and derived mode predicates.
