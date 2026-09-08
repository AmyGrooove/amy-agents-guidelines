# Outcome + Failure Intelligence

Stage 15 adds a deterministic, optional outcome boundary after Completion and
Recovery. It does not replace Stage 11 Completion: Completion answers whether the
current attempt has enough execution/integration/verification evidence to stop,
while Outcome Intelligence answers what the task actually amounted to using that
canonical evidence plus bounded later signals.

## Verdict

`implement`

The roadmap gap is real, but the implementation is deliberately small. Amy does
not add an outcome orchestrator, a background feedback service, an LLM judge, or
a second persistence path. Stage 15 compiles canonical evidence into one versioned
assessment and can emit that assessment through the existing Runtime event bus.

```text
Completion result
+ optional Recovery plans
+ optional bounded post-task signals
↓
Outcome Intelligence
↓
Outcome Assessment + Failure Intelligence
↓ optional
RuntimeEventBus (`outcome.assessed`)
↓ optional
Data Storage projections
```

## Capability and API

`amy.outcome-intelligence` is optional, independently registered, and has no
required Amy capability dependency. It is not registered by `createAmyRuntime()`.

Versions:

- capability: `1.0.0`;
- API: `1`;
- outcome schema: `1`;
- failure schema: `1`;
- post-task signal schema: `1`;
- user-correction detector schema/policy: `1`.

Canonical API:

```ts
interface IOutcomeIntelligenceApi {
  assess(value: unknown): Readonly<IOutcomeAssessment>;
  detectUserCorrection(value: unknown): Readonly<IUserCorrectionDetection>;
}
```

`assessOutcome()` and `detectUserCorrection()` are also exported as pure
deterministic functions. `recordOutcomeAssessment()` is the optional integration
helper that emits the sanitized semantic assessment as `outcome.assessed`.
Consumer failures produce a `degraded`/`dropped` receipt and do not turn outcome
recording into a workflow dependency.

## Outcome semantics

`IOutcomeAssessment.status` is one of:

- `success` — canonical Completion is `complete` and no later negative signal
  downgrades it;
- `partial_success` — Completion is `incomplete`, or an otherwise successful task
  has a bounded partial post-task signal;
- `failure` — Completion failed or a concrete post-task signal has failure impact;
- `unverified` — canonical Completion is explicitly unverified;
- `unknown` — there is not enough canonical Completion evidence to determine a
  result.

A passed test alone is never converted into `success`. Stage 15 consumes the
whole Completion result, including execution, integration, Verification,
unresolved issues, and guard state.

The assessment preserves compact evidence references from Completion,
verification checks, Recovery diagnoses, and post-task signals. It also exposes
retry/escalation attempt counts and unresolved issues. Historical Recovery
failures remain visible even when a later Completion result succeeds; they do not
by themselves downgrade the resolved final status.

## Failure Intelligence

Each classified failure is a versioned `IOutcomeFailure` with a source, summary,
evidence refs, stable assessment-local id, and one failure class:

- `context`;
- `classification`;
- `routing`;
- `planning`;
- `decomposition`;
- `implementation`;
- `integration`;
- `verification`;
- `documentation`;
- `tool`;
- `runtime`;
- `unknown`.

Stage 15 only classifies what the supplied evidence supports. Completion
execution/integration/verification failures map to their direct classes. Recovery
`context-understanding` maps to `context`; `architecture-uncertainty` maps to the
coarser `planning` class. Other classes can be attached to explicit post-task
signals by the host. Amy does not manufacture causal attribution from sparse
telemetry.

Stage 15 also adds `validateRecoveryPlan()` to the canonical Recovery boundary.
Outcome Intelligence reuses that validator instead of duplicating Recovery Plan
schema knowledge downstream.

## Post-task signals

Outcome revisions are explicit and bounded. Supported signal kinds are:

- `user-correction`;
- `follow-up-bug`;
- `revert`;
- `later-rewrite`.

Every signal requires at least one evidence reference and a compact semantic
summary. Default impact is conservative:

- `follow-up-bug` / `revert` → `failure`;
- `user-correction` / `later-rewrite` → `partial`.

A caller can provide a stronger supported impact/failure class when it has
concrete evidence. Stage 15 does not scan future conversations, repositories, or
Git history by itself; the host supplies later signals when they are actually
linked to the earlier task.

## User Correction Detector

`detectUserCorrection()` is intentionally a small deterministic helper for one
follow-up message. It returns:

- `correction`;
- `new-task`;
- `ambiguous`.

The detector uses bounded English/Russian lexical markers and prefers ambiguity
when correction and new-request markers conflict. A detected correction emits
only a generic semantic `user-correction` signal plus the caller-provided
`messageRef`. The original message is not returned in that signal and therefore
does not need to be persisted just to support failure intelligence.

This is not a general intent classifier. Ambiguous language remains ambiguous
rather than invoking an LLM or pretending semantic certainty.

## Storage integration

Stage 15 reuses the Stage 14 privacy/storage path:

```text
recordOutcomeAssessment()
↓
RuntimeEventBus
↓
optional `amy.data-storage` consumer
↓
privacy sanitization
↓
raw JSONL + SQLite projection
```

Data Storage capability version is now `1.1.0`; SQLite schema is `2`. Migration
`2` adds normalized `outcomes` and `failures` tables while preserving schema `1`
`runtime_events` and `observability_records`. Existing schema-1 databases are
upgraded sequentially through `amy_storage_migrations`; fresh databases record
both migrations.

Storage remains optional and fail-open. Outcome Intelligence can be used without
Data Storage, and the assessment never writes SQLite directly.

## Deliberate limits

Stage 15 does not add:

- automatic user-feedback monitoring or task/thread attribution;
- raw prompt persistence for correction detection;
- LLM-based outcome judging;
- causal analytics or recommendations;
- automatic failure repair/retry execution;
- a second event bus or direct database writer;
- a Stage 15 CLI/product command;
- automatic capability registration.

Repeated outcome assessments are append-only observations. Stage 15 does not
silently overwrite older assessments or claim that a later signal is linked to a
task unless the caller provides that link.

# Stage Handoff

- **Stage:** 15 — Outcome + Failure Intelligence.
- **Verdict:** `implement`, with a deliberately simplified deterministic User
  Correction Detector.
- **Implemented:** optional `amy.outcome-intelligence`; canonical outcome statuses;
  evidence-preserving Outcome Assessment; Failure Taxonomy; bounded post-task
  signals; conservative User Correction Detector; fail-open `outcome.assessed`
  recording via the existing event bus; Stage 14 SQLite schema-2 projections for
  outcomes/failures; backward-compatible schema-1 → schema-2 migration; canonical
  downstream `validateRecoveryPlan()`; Runtime exports; documentation; plugin
  version `2.14.0`.
- **Canonical interfaces/contracts:** `IOutcomeIntelligenceApi`,
  `IOutcomeAssessment`, `IOutcomeFailure`, `IOutcomeInput`,
  `IOutcomePostTaskSignal`, `IUserCorrectionDetection`, `TOutcomeStatus`,
  `TOutcomeFailureClass`, `OUTCOME_INTELLIGENCE_VERSIONS`, `assessOutcome()`,
  `detectUserCorrection()`, `recordOutcomeAssessment()`,
  `createOutcomeIntelligenceCapability()`, and Recovery's
  `validateRecoveryPlan()` structural downstream boundary. Persistence reuses
  `IRuntimeEvent` type `outcome.assessed` and Data Storage SQLite schema `2`.
- **Key architecture decisions:** Completion remains the canonical current-attempt
  stop/evidence protocol; Outcome Intelligence is a downstream deterministic
  compiler, not a replacement verifier; later evidence is caller-supplied and
  bounded; historical Recovery failures do not automatically negate a later
  successful Completion; correction detection is lexical/conservative and stores
  only a semantic signal; persistence is downstream of `RuntimeEventBus`; storage
  and Outcome Intelligence remain independently optional; no default registration,
  new orchestrator, or direct SQLite coupling.
- **Verification results:** focused Stage 15/Recovery/Data Storage suites passed
  `24/24`; production typecheck, clean build, test typecheck/compile, and the full
  runner passed with `156/156` tests across `21` suites; generated `runtime/dist`
  parity passed. Data Storage migration `1 → 2`, privacy-safe outcome projection,
  and fail-open outcome recording are covered by regression tests. The environment
  does not provide `pnpm`, so the equivalent scripts were run directly with Node
  `22.16.0`, TypeScript `5.8.3`, and compatible locally available Node typings;
  repository-pinned `pnpm@11.23.0` / TypeScript `5.9.2` could not be installed.
- **Technical debt:** User Correction detection is intentionally limited to
  bounded EN/RU lexical patterns; later feedback/task linkage is host-owned;
  failure attribution beyond direct canonical evidence must be supplied explicitly;
  repeated assessments are append-only rather than deduplicated; built-in
  `node:sqlite` remains host-version-dependent/experimental as inherited from
  Stage 14.
- **Limits:** no background feedback watcher, no LLM outcome judge, no automatic
  follow-up attribution, no causal inference, no outcome CLI, no mandatory
  storage, and no automatic recovery/evolution.
- **Next-stage constraints:** Stage 16 Eval System should consume canonical
  `IOutcomeAssessment`/Failure Intelligence (or their normalized projections) as
  outcome evidence rather than inventing a second success taxonomy. Eval must
  remain usable without production storage, keep cases compact/repeatable and
  versioned, prefer deterministic scoring where possible, and preserve explicit
  cost limits. Real/failure/regression corpora should store only the essential
  task/environment/expected behavior needed for evaluation.
- **Expected next Roadmap v2 stage:** 16 — Eval System.
