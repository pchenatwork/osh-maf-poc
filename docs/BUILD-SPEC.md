# Build spec — Digital MAF proof of concept

**Audience:** an AI coding agent (Claude Code, Copilot Workspace, Cursor).
**Companion document:** `DEVELOPER-GUIDE.md` explains *why*. This file states *what*.

Read the whole file before generating code. §2 constrains everything after it.

---

## 0. Using this document

Place a condensed version of §2 and §3 at `.github/copilot-instructions.md` or
`CLAUDE.md` so the non-negotiables load into every request.

Build in the order given in §10. Do not start a stage until the previous stage's
acceptance criteria pass. Where a decision isn't covered here, prefer the simpler option
and leave a `// SPEC-GAP:` comment explaining the choice.

---

## 1. What this system is

A school nurse, a parent, and a healthcare practitioner each complete part of an asthma
Medication Administration Form. The result must be structured clinical data, not a scan.

The form changes yearly, and more form types are coming (allergy, seizure, diabetes).
So the form is **not coded** — it is a FHIR `Questionnaire` served by an API and rendered
at runtime by a generic engine.

Three claims this exists to test. They are the acceptance criteria for the whole project:

1. **Runtime rendering.** No asthma-specific code in the React app.
2. **Zero-code extensibility.** A structurally different second form type renders with no
   changes outside `web/src/item-controls/osh/`.
3. **Structured extraction.** A submission yields a `MedicationRequest` with a discrete
   `Dosage`, not a text blob.

If claim 2 fails, this has succeeded at its job. **Report the failure clearly rather than
working around it.**

---

## 2. Non-negotiables

Constraints, not preferences. Violating any invalidates the exercise.

| # | Rule | Why |
|---|---|---|
| N1 | The form definition format **is** FHIR R4 `Questionnaire`. Do not invent a schema format. | One format in and out; no translation layer. |
| N2 | The submission format **is** FHIR R4 `QuestionnaireResponse`. | Same. |
| N3 | Definitions are **immutable and versioned**. Never `UPDATE` a published definition; a revision is a new row. | A signed order must render exactly as signed, years later. |
| N4 | Every `QuestionnaireResponse` pins its definition via `questionnaire: "<canonical>\|<version>"`, and validation loads *that* version. | Same. |
| N5 | **Never `eval()` or `new Function()`** on anything from the server. FHIRPath only. | Forms are served to parents and outside practitioners over the public internet. |
| N6 | **All validation runs server-side** against the pinned definition. Client validation is a UX affordance only. | Rules that live only in the browser have no integrity story. |
| N7 | Domain knowledge lives **only** in `web/src/item-controls/osh/` and `definitions/`. No other file may reference asthma, inhalers, MAFs, or NAEPP. | This is the seam that makes claim 2 testable. |
| N8 | `web/src/renderer/` must not import from `web/src/item-controls/osh/`. | Same. Enforce with ESLint. |
| N9 | Only `web/src/item-controls/contract.ts` imports from `fhir/r4`. | One version-change point. Enforce with ESLint. |
| N10 | Every `/fhir/*` error response is an `OperationOutcome`, including framework-level failures. | A rule that holds 80% of the time is worse than no rule. |

---

## 3. Stack

Use exactly these. Do not substitute.

### Backend
- **.NET 10** (LTS), ASP.NET Core Web API — `dotnet new webapi --use-controllers`
  (templates default to minimal APIs since .NET 8)
- **Firely .NET SDK** — NuGet `Hl7.Fhir.R4` **6.x**. Provides R4 POCOs, System.Text.Json
  serialization, a FHIRPath engine, and structural validation.
  **Do not hand-roll FHIR model classes.**
  v6 removed the Newtonsoft stack — `FhirJsonParser` / `FhirJsonSerializer` are gone or
  obsolete. Any tutorial using them is written for v5.
- **Dapper** + `Microsoft.Data.SqlClient`
- **SQL Server 2022+** (LocalDB acceptable)
- **Scalar.AspNetCore** for the API UI
- **xUnit**

### Frontend
- **Vite + React 19 + TypeScript** (strict)
- **`fhirpath`** (npm, HL7) for `enableWhen` and expressions
- **`@types/fhir`** for R4 types — do not hand-write FHIR interfaces
- **TanStack Query**
- **Vitest + React Testing Library**

### Deliberately not used — do not add
- No FHIR server (HAPI, Firely Server/Vonk, Medplum). This is a **façade**.
- No form library (Formik, react-hook-form, RJSF). The renderer is the point.
- No component library. Plain semantic HTML plus CSS. Accessibility matters (§11);
  visual polish does not.
- No auth provider. See §9.

---

## 4. Repository layout

```
maf-poc/
├── README.md
├── docs/
│   ├── DEVELOPER-GUIDE.md
│   └── BUILD-SPEC.md              this file
├── api/
│   ├── Osh.Maf.sln                (.slnx by default in .NET 10)
│   ├── Directory.Build.props      net10.0, nullable, LangVersion latest
│   ├── Osh.Maf.Api/
│   │   ├── Program.cs
│   │   ├── Outcomes.cs
│   │   ├── FhirDeserializationFilter.cs
│   │   ├── Serialization/FhirJson.cs
│   │   ├── Controllers/
│   │   ├── Validation/
│   │   └── Extraction/
│   ├── Osh.Maf.Data/
│   │   ├── FormDefinitionRepository.cs
│   │   ├── FormResponseRepository.cs
│   │   └── Migrations/            numbered .sql files
│   └── Osh.Maf.Tests/
├── web/
│   ├── vite.config.ts             strictPort, /fhir proxy
│   ├── eslint.config.js           the N8 and N9 rules
│   └── src/
│       ├── renderer/              engine — no domain knowledge
│       ├── item-controls/
│       │   ├── contract.ts        props contract, RenderMode, FHIR type re-exports
│       │   ├── index.ts           itemControlRegistry, resolveItemControl
│       │   ├── fhir/              keyed by item.type
│       │   └── osh/               keyed by item-control extension code
│       └── api/
└── definitions/
    ├── asthma-maf-2026.02.json
    └── seizure-maf-0.1.json
```

---

## 5. Naming convention

**Name types after the FHIR element they wrap, not the role they play.** FHIR overloads
`item` heavily — `Questionnaire.item` and `QuestionnaireResponse.item` are different types
appearing in the same files, and `Claim.item`, `List.entry.item` also exist.

| Pattern | Meaning | Example |
|---|---|---|
| `<Element>Props` | React props for rendering one FHIR element | `QuestionnaireItemProps` |
| `<Type>Control` | A registry-resolvable component | `BooleanControl`, `MedicationOrderControl` |

Required identifiers:

| Identifier | Kind |
|---|---|
| `QuestionnaireItemProps` | interface |
| `QuestionnaireItemControl` | `FC<QuestionnaireItemProps>` |
| `QuestionnaireItemWalker` | component |
| `itemControlRegistry` | the map |
| `resolveItemControl` | the lookup function |
| `StringControl`, `BooleanControl`, … | 12 controls in `fhir/` |

**Do not rename** `Questionnaire.ItemComponent` or `QuestionnaireResponse.ItemComponent` —
those are Firely SDK C# types. **Do not rename** wire strings: extension URLs, `valueCode`
values, `linkId`s, FHIR `item.type` values. Those are registry keys and schema content.

`RenderMode` is a local concept with no FHIR equivalent, so the naming rule doesn't apply:

```ts
export type RenderMode = 'edit' | 'view' | 'print';
export const isEditable = (m: RenderMode) => m === 'edit';
export const isReadOnly = (m: RenderMode) => !isEditable(m);
export const isPrint    = (m: RenderMode) => m === 'print';
```

Controls must call the predicates, never compare to a literal. `RenderMode` is unrelated
to `QuestionnaireResponse.status` — do not map one to the other.

---

## 6. Data model

Four tables. Numbered `.sql` files, applied manually. No migration framework.

**`FormDefinition`** — `CanonicalUrl`, `Version`, `Title`, `Status`, `DefinitionJson`,
`PublishedUtc`. Unique on `(CanonicalUrl, Version)`. `ISJSON` check constraint.
**An `INSTEAD OF UPDATE` trigger that throws** — N3 enforced at the database.

**`FormResponse`** — FK to `FormDefinition`, `ResponseJson`, `Status`, and
`SubjectOsis` as a **persisted computed column** over
`JSON_VALUE(ResponseJson,'$.subject.identifier.value')`, indexed. No immutability
trigger: drafts are legitimately mutable. Immutability arrives at completion, enforced by
`UpdateIfInProgressAsync`'s `WHERE Status = 'in-progress'`.

**`ExtractedResource`** — FK, `ResourceType`, `ResourceId`, `ResourceJson`.

**`WorkflowTask`** — FK, `Status`, `BusinessStatus`, `ReviewOutcome`, `OperationalJson`.
The only freely mutable table.

Relational spine, JSON payload: workflow state in real columns because you filter on it;
clinical payload in `NVARCHAR(MAX)` because its shape varies per form type.

---

## 7. API

A **FHIR façade**. No `_history`, no `_include`, no search grammar, no
`CapabilityStatement`.

| Method | Route | Behaviour |
|---|---|---|
| `GET` | `/fhir/Questionnaire?url={canonical}&version={v}` | Stored JSON verbatim. No version → latest `active`. |
| `GET` | `/fhir/Questionnaire/{id:guid}` | |
| `POST` | `/fhir/Questionnaire` | **409** if `(url, version)` exists |
| `GET` | `/fhir/QuestionnaireResponse/{id:guid}` | |
| `POST` | `/fhir/QuestionnaireResponse` | Validate (§8). On `completed`, extract and create a `WorkflowTask`. |
| `PUT` | `/fhir/QuestionnaireResponse/{id:guid}` | **409** once no longer `in-progress`. Reload the definition from the **stored** `FormDefinitionId`, not the request body. |
| `GET` | `/fhir/Bundle/{responseId:guid}` | `document` Bundle |

### Serialization

```csharp
builder.Services
    .AddControllers(options =>
    {
        options.Filters.Add(new ProducesAttribute("application/fhir+json"));
        options.Filters.Add<FhirDeserializationFilter>();
    })
    .AddJsonOptions(o => o.JsonSerializerOptions.ForFhir());
```

A single **static readonly** `JsonSerializerOptions` in `Serialization/FhirJson.cs` —
creating them per call degrades performance severely.

Actions declare `[Consumes("application/fhir+json", "application/json")]` — every tool
defaults to plain JSON, and listing only the FHIR type produces a bare 415.

### Error handling (N10)

Three tiers, three mechanisms:

| Tier | Example | Handled by |
|---|---|---|
| Controller | 404, 409, 422 | `Outcomes.*` helpers |
| Model binding | missing param, malformed JSON | `InvalidModelStateResponseFactory` |
| Content negotiation | 415, 406 | Broad `[Consumes]`; optional empty-body middleware |

Validation failures set `issue.expression` to the failing `linkId`. Binding failures use
`issue.diagnostics` — a query parameter name is not a FHIRPath expression.

`FhirDeserializationFilter` unwraps `DeserializationFailedException` into per-element
messages; ASP.NET's generic "The supplied value is invalid" is useless against a 120-field
hand-authored form.

Name body parameters meaningfully (`response`, not `r`) — the name appears in binding
errors.

### OpenAPI

`AddOpenApi()` + `MapScalarApiReference()` at `/scalar`, development only.

**Required:** a schema transformer collapsing every `Hl7.Fhir.Model.Base`-derived type to
a plain object with a spec link. Without it the generator follows `Questionnaire.item`
recursively through the entire FHIR datatype graph, and the resulting schema is wrong
anyway — `value[x]` cannot be expressed by reflecting over a `DataType` property.

If `Scalar.AspNetCore` fails to compile against `Microsoft.OpenApi` 3.x
(`IOpenApiMediaType.Example ... is read only`), constrain to `[2.0.0,3.0.0)` with a
comment. Try without the constraint first.

---

## 8. Validation

`ResponseValidator.Validate(Questionnaire, QuestionnaireResponse)` →
`IReadOnlyList<ValidationIssue>`.

Walk the **Questionnaire** tree, not the response tree. Per item, **in this order**:

1. Evaluate `enableWhen` / `enableWhenExpression` (honour `enableBehavior`).
2. If disabled: assert **no answer is present**. An answer on a disabled item means the
   client was bypassed — raise an issue, don't ignore it.
3. If enabled and `required`, assert an answer exists.
4. Assert cardinality against `repeats`.
5. Assert the answer type matches `item.type`.
6. Assert `answerOption` / `answerValueSet` membership (local dictionary; no terminology
   server).
7. Recurse.

Order matters — checking `required` before `enableWhen` fires errors on hidden fields.

Load the definition by the **pinned version** from `QuestionnaireResponse.questionnaire`.
Never validate against "the current version."

---

## 9. Front end

### Contract

```ts
export interface QuestionnaireItemProps {
  item: QuestionnaireItem;
  answers: QuestionnaireResponseItemAnswer[];
  setAnswers: (answers: QuestionnaireResponseItemAnswer[]) => void;
  errors: string[];
  mode: RenderMode;
  children?: ReactNode;   // group items only
}
```

**Do not widen this interface.** A control needing the whole response, an API client, or
routing is doing something that doesn't belong in `item-controls/`.

`answers` is always an array — `repeats: true` items have several.

### Resolution

```ts
export function resolveItemControl(item: QuestionnaireItem): QuestionnaireItemControl {
  const control = item.extension?.find(e => e.url === OSH_ITEM_CONTROL)?.valueCode;
  return itemControlRegistry[control ?? item.type] ?? Fhir.UnsupportedControl;
}
```

`UnsupportedControl` renders a **visible** placeholder naming the type and `linkId`.
**Never throw. Never return null.** It is the gap report for stage 8.

### State

Hold a real working `QuestionnaireResponse`, not a flat `{ linkId: value }` map. Scaffold
the item tree from the definition on mount.

### Submission

Two transforms, in order, before `POST`:

1. `pruneDisabled()` — strip items `enableWhen` currently hides.
2. `stripEmpty()` — **remove empty `answer` arrays and empty items.** FHIR JSON forbids
   empty arrays; scaffolding necessarily creates them. Without this, nothing submits.

### Render modes

Build `edit`, `view`, and `print` from the start. `view` is a four-line early return per
control up front and a miserable retrofit later; it is also how a signed form is displayed.

### Dev server

`vite.config.ts`: `strictPort: true`, and proxy `/fhir` to the API. Relative fetch URLs,
no cross-origin request, API port in one file.

---

## 10. Build order

Each stage has an acceptance test. Do not proceed on a red stage.

**0 — Environment.** Projects, packages, `FhirJson.cs`, `Program.cs`, Scalar, ESLint rules.
*Accept:* both projects build; `/scalar` renders instantly.

**1 — Author a Questionnaire.** No code. `definitions/asthma-maf-2026.02.json` as valid R4.
Model the whole form. `enableWhen` for conditional dependencies. Items that need custom
rendering get an `item-control` extension with one of exactly four codes:
`osh-signature-block`, `osh-medication-order`, `osh-attestation`, `osh-risk-panel`.
**If a fifth is needed, stop and raise it** — that is a signal about the architecture.
*Accept:* parses via `FhirJson.Deserialize<Questionnaire>` in a passing test; every paper
field has a `linkId`.

**2 — Definition storage.** Migrations, repository, `GET`/`POST /fhir/Questionnaire`.
*Accept:* publish succeeds; duplicate `(url, version)` → 409 + `OperationOutcome`; direct
SQL `UPDATE` throws.

**3 — Renderer.** `renderer/` and `item-controls/fhir/` against a synthetic test
questionnaire first.
*Accept:* a definition renders from the API; `grep -ril "asthma\|inhaler\|albuterol\|naepp"
web/src --exclude-dir=osh` returns nothing.

**4 — Conditional logic.** `enableWhen` via fhirpath, `pruneDisabled`, `stripEmpty`,
client validation.
*Accept:* conditional items appear and disappear; the submitted payload contains no hidden
items and no empty arrays.

**5 — Submission and validation.** `POST`/`PUT`/`GET`, `ResponseValidator`,
`OperationOutcome` mapping, client error display keyed by `linkId`.
*Accept:* missing required → 422 with correct `issue.expression`; answer on a disabled item
→ 422; third `PUT` after completion → 409; a crafted request bypassing the UI is rejected
identically.

**6 — Custom item controls.** The four `osh/` controls, registered.
*Accept:* the asthma form renders fully. **Record how many custom controls it needed.**

**7 — Extraction.** `MedicationRequest` (discrete `Dosage`), two `Consent` resources with
independent dates, `Condition` with severity. Then `BundleAssembler` producing a `document`
Bundle opening with a `Composition`.
*Accept:* asserted in xUnit on the POCOs, not on JSON strings.

**8 — Extensibility verification.** Author `definitions/seizure-maf-0.1.json`,
**structurally different**: deeper nesting, a repeating group, an item type asthma never
used, `enableBehavior: "any"`, a different order structure. Publish. Render. Change no code.
*Accept:* it renders. Unsupported types appear as visible `UnsupportedControl` placeholders
— not thrown, not silently omitted. Produce `FINDINGS.md`.

---

## 11. Accessibility

Every input has a `<label>` bound by `htmlFor`. Errors are `aria-describedby`-linked and
announced via `role="alert"`. `required` maps to `aria-required`. Group items render as
`<fieldset><legend>`.

---

## 12. Testing

- **xUnit:** validator tests as a table of (definition, response, expected issues).
  Extraction tests assert on POCOs, not JSON strings. One test asserts the immutability
  trigger fires.
- **Vitest:** renderer tests use a **synthetic** questionnaire fixture. If they need the
  asthma definition, N7 has been violated.
- **One end-to-end:** publish → render → fill → submit → extract → assert on the Bundle.

---

## 13. Stub these deliberately

| Concern | Implementation |
|---|---|
| Authentication | A role switcher in the UI header; an `X-Poc-Role` header. No IdP, no tokens. |
| Signatures | Signer name, UTC timestamp, SHA-256 of the canonical response, in a `Provenance`. **No real detached JWS.** |
| Downstream delivery | `POST` to a local `/sink` that writes `./out/{responseId}.json`. |
| Terminology | Hardcoded codes tagged `ILLUSTRATIVE-CODES`. No terminology server. |
| PDF of record | Print stylesheet on `view` mode, or skip. |
| Notifications | Console log. |

---

## 14. Do not build

The agent will be tempted by all of these.

- A form builder or visual schema editor. Definitions are hand-authored JSON.
- A conformant FHIR server, `CapabilityStatement`, or search parameter engine.
- Real authentication, authorization, sessions, or password handling.
- Real cryptographic signatures or PKI.
- A terminology server or value set expansion.
- Multi-tenancy, caching layers, message queues, container orchestration.
- Retry or resilience policies for the fake `/sink`.
- Any styling framework or design system.
- Per-item `readOnly` on `QuestionnaireItemProps` — a real future need, but out of scope.
  Do not scaffold for it.
- A fourth `RenderMode` value.

If a stage seems to require one of these, it does not. Reread §13 and stub it.

---

## 15. Definition of done

`FINDINGS.md` answering:

1. Did the asthma form render entirely from JSON? *(claim 1)*
2. Did the seizure form render with zero changes outside `item-controls/osh/`? If not,
   exactly what changed? *(claim 2)*
3. How many custom controls did asthma need? How many more did seizure? *(If seizure needs
   many, this is a component library with a config file, not a form engine.)*
4. Did extraction produce discrete `Dosage` structures? Was definition-pointer mapping
   sufficient, or was per-form C# required? *(claim 3 — definition-based extraction is the
   least mature part of SDC; falling back partially undercuts claim 2, and that must be
   written down rather than papered over.)*
5. What broke that this spec did not anticipate?

**Question 5 is the most valuable output.**
