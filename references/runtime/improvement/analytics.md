# Analytics Engine + Task Archetypes

Stage 17 adds deterministic descriptive analytics over already-produced Amy data.
It does not add a second telemetry pipeline, storage backend, dashboard, or policy
optimizer.

## Verdict

`implement`

The gap after Stage 16 is real: Amy can record outcomes, provenance, and eval
results, but there was no canonical way to aggregate them by comparable segments,
show sample size/confidence, or identify recurring task patterns without jumping to
causal conclusions.

The implementation stays intentionally small:

```text
host-provided task/eval snapshots
+ canonical Stage 4/8/15/16 validators
+ time/policy/archetype filters
↓
descriptive metrics
+ task archetype distribution
+ failure distribution
↓
non-causal findings
(metric → observation → hypothesis? → investigative recommendation?)
```

## Capability and contracts

`amy.analytics` is optional, has no required capability dependency, and is not
registered by `createAmyRuntime()`.

Versions:

- capability: `1.0.0`;
- API: `1`;
- analytics input schema: `1`;
- report schema: `1`;
- metric policy: `1`;
- archetype schema/policy: `1`.

Canonical API:

```ts
interface IAnalyticsApi {
  analyze(value: unknown): Readonly<IAnalyticsReport>;
  discoverArchetypes(value: unknown): Readonly<ITaskArchetypeDiscovery>;
  validateInput(value: unknown): Readonly<IAnalyticsInput>;
}
```

Analytics consumes materialized snapshots supplied by the host instead of opening
Stage 14 SQLite directly. This keeps Data Storage optional and lets callers analyze
live observations, exported data, fixtures, or another approved source through one
contract.

## Analytics snapshots

`IAnalyticsTaskSample` contains only fields needed for aggregation:

- stable sample id and observation time;
- canonical Task Analysis;
- optional Strategy Decision;
- optional Outcome Assessment;
- optional numeric usage measurements;
- policy provenance refs using the Stage 13 `IObservabilityPolicyRef` shape.

`IAnalyticsEvalRunSample` wraps a canonical Stage 16 `IEvalRunResult`, timestamp,
and policy refs.

Stage 17 adds `validateEvalRunResult()` and `validateEvalCaseResult()` to the Eval
System as downstream structural boundaries. Analytics does not reimplement Eval
success rules or scoring.

## Metrics

The first metric policy is deliberately descriptive and bounded. It includes:

- task count;
- outcome success/failure/partial/unverified/unknown rates;
- average retries and escalations;
- Fast Path / Scout / Verifier / Reviewer routing rates;
- average reported duration/tokens/cost units;
- average Eval score and Eval case pass rate;
- failure-class distribution;
- task-archetype distribution.

Unavailable measurements stay unavailable (`value: null`, `sampleSize: 0`) rather
than being reconstructed or treated as zero evidence.

Every metric exposes a categorical confidence derived only from sample size:

- `insufficient`: 0 samples;
- `low`: 1–4;
- `medium`: 5–19;
- `high`: 20+.

This confidence is data-volume confidence, not a statistical confidence interval or
proof of causality.

## Segmentation and windows

`IAnalyticsInput` supports a global half-open time window plus named segments.
Segments can filter by:

- policy owner/version refs;
- discovered task archetypes;
- or both.

Multiple policy refs in a segment are AND filters. Archetypes are OR filters.
Eval runs have no task archetype, so an archetype-filtered segment intentionally
contains no Eval-run metrics unless a future canonical task-to-eval linkage is
introduced.

## Task Archetype Discovery

Task archetypes are optional deterministic hints, not semantic truth. Stage 17 uses
a small ordered keyword policy over canonical Task Contract text and supports:

- `bug-investigation`;
- `testing`;
- `refactor`;
- `api-propagation`;
- `exploration`;
- `feature-modification`;
- `other`.

English and Russian signals are supported. Assignments are never marked `high`
confidence. Corpora smaller than three task samples are explicitly
`insufficient-sample` while still returning assignments for inspection.

No embeddings, vector database, clustering service, LLM classification, or
background mining is introduced.

## Findings and causal safety

A finding preserves the required distinction:

```text
metric
→ observation
→ optional hypothesis
→ optional investigative recommendation
```

Every finding contains `causalClaim: false`. Current automatic findings are limited
to:

- small-sample warnings;
- recurrent failure-class patterns;
- elevated unverified-outcome rate.

Recommendations only ask for more data or inspection of representative evidence.
Stage 17 never changes routing, compute, skills, agents, or verification policy.

## Deliberate limits

Stage 17 does not add:

- `amy stats` / `amy analyze` CLI commands (reserved for Stage 20 Operations);
- direct SQLite/report persistence coupling;
- dashboards;
- statistical significance tests or confidence intervals;
- causal inference;
- embeddings/vector DB;
- clustering or LLM-based archetypes;
- automatic policy recommendations that mutate production;
- mechanism/skill/agent health scoring (Stage 18);
- counterfactual or shadow routing (Stage 19).

## Stage 18 — Mechanism & Routing Health Analytics

Stage 18 extends the existing optional `amy.analytics` capability. It deliberately
reuses Stage 17 snapshots, segmentation, task archetypes, Outcome Failure Taxonomy,
Strategy decisions, and sample-size confidence instead of introducing another data
pipeline or health service.

### Additional task observations

`IAnalyticsTaskSample` remains backward compatible. Two new fields are optional:

- `mechanisms`: bounded versioned observations for used `skill` or `agent`
  mechanisms. Each observation records `id`, `version`, positive `invocationCount`,
  optional attributable usage, and explicit bounded evidence signals;
- `execution`: compact measurements that are not reconstructed from prompts:
  `reasoningEffort`, `workerCount`, and `contextItems` when the host can report them.

Canonical mechanism signals are:

- `caught-issue`;
- `recovered-failure`;
- `unnecessary-invocation`;
- `useful-evidence`;
- `user-correction`.

Agent mechanism ids are validated against the canonical Stage 7 role catalog.
Skill ids stay host/plugin identifiers. Missing observations stay missing; Analytics
does not guess that an unreported skill or agent was used.

### Mechanism health

`analyzeMechanismHealth()` and `IAnalyticsApi.analyzeHealth()` return a versioned
`IAnalyticsHealthReport`. Mechanisms are grouped by `(kind, id, version)` and expose:

- task and invocation counts;
- task-archetype distribution;
- outcome rates;
- retries and escalations;
- failure-class distribution;
- attributable cost/tokens/duration when reported;
- evidence-signal rates;
- sample-size confidence;
- a non-causal health assessment with structured reason codes.

The first health policy is intentionally conservative:

- fewer than five tasks → `insufficient-evidence`;
- material explicit unnecessary-invocation evidence → `routing-fit-suspected`;
- failure concentrated in one sufficiently sampled archetype while comparable
  archetypes do materially better → `routing-fit-suspected`;
- consistently high failure across at least two sufficiently sampled archetypes →
  `mechanism-risk-suspected`;
- otherwise → `no-clear-risk`.

Every mechanism health result contains `causalClaim: false`. These statuses are
investigation priorities, not proof that a mechanism or Router caused an outcome.

### Router + Compute health

Health reports build routing cohorts only from comparable tasks. A cohort key uses:

```text
task archetype
+ scope
+ complexity
+ risk
+ Strategy policy version
```

Within a cohort Amy can compare observed choices for:

- compute profile;
- reasoning effort;
- Scout / no Scout;
- Verifier / no Verifier;
- Reviewer / no Reviewer;
- direct / Worker execution;
- reported worker count;
- reported context item count.

Each choice summary keeps outcome rates, retries, average task cost/tokens/duration,
average worker count, average context items, sample size, and confidence together.
This makes cost/reliability trade-offs inspectable without comparing unrelated task
types or claiming causality.

Stage 18 reuses the exact Stage 17 time/policy/archetype selection helper for both
analytics reports. Named health segments therefore cannot silently diverge from the
existing analytics segmentation semantics.

### Deliberate limits

Stage 18 does not add:

- a new capability id, storage backend, telemetry stream, dashboard, or CLI command;
- automatic mechanism invocation discovery from raw prompts;
- automatic production routing or compute changes;
- causal inference or statistical significance tests;
- an LLM/embedding health classifier;
- task-to-Eval linkage that does not already exist;
- Controlled Evolution, counterfactual execution, or Shadow Router behavior.


# Stage Handoff

- **Stage:** 18 — Mechanism & Routing Health Analytics.
- **Verdict:** `implement`, as a backward-compatible extension of the canonical
  optional `amy.analytics` capability rather than a new subsystem.
- **Implemented:** optional versioned skill/agent mechanism observations; compact
  execution measurements; deterministic mechanism-health aggregation by
  kind/id/version; skill/agent outcome, retry/escalation, failure, attributable
  usage and evidence-signal summaries; conservative non-causal mechanism-vs-routing
  assessments; comparable routing cohorts; compute/reasoning/Scout/Verifier/
  Reviewer/execution/worker-count/context-size choice summaries; shared Stage 17
  window/policy/archetype selection; Runtime exports, tests, docs, plugin version
  `2.17.0`.
- **Canonical interfaces/contracts:** existing `IAnalyticsApi` now includes
  `analyzeHealth()`; `IAnalyticsTaskSample` optionally includes `mechanisms` and
  `execution`; `IAnalyticsMechanismUse`, `IAnalyticsExecutionObservation`,
  `IAnalyticsHealthReport`, `IAnalyticsHealthSegmentReport`,
  `IAnalyticsMechanismHealth`, `IAnalyticsMechanismOutcomeSummary`,
  `IAnalyticsMechanismRecoverySummary`, `IAnalyticsMechanismUsageSummary`,
  `IAnalyticsMechanismSignalSummary`, `IAnalyticsRoutingCohort`,
  `IAnalyticsRoutingChoiceSummary`, `IAnalyticsRoutingExecutionSummary`,
  `TAnalyticsHealthAssessment`, `TAnalyticsHealthReasonCode`,
  `TAnalyticsMechanismSignal`, `TAnalyticsRoutingHealthDimension`,
  `analyzeMechanismHealth()`; `ANALYTICS_VERSIONS.api = 2`,
  `inputSchema = 2`, `healthPolicy = 1`, `healthReportSchema = 1`.
- **Key architecture decisions:** reuse `amy.analytics`; host snapshots remain the
  ingestion boundary; existing Stage 17 inputs remain valid; agent ids reuse the
  canonical role catalog; missing measurements are not reconstructed; health
  comparisons are scoped to comparable task cohorts and Strategy policy versions;
  assessment thresholds are conservative hypotheses with `causalClaim: false`;
  no production policy mutation; one shared selector prevents segmentation drift.
- **Verification results:** production and test TypeScript checks passed; build passed;
  full Runtime suite passed `172/172` tests across `23/23` suites; generated output
  matched TypeScript sources; CLI `inventory` smoke passed; package/manifest version
  parity, JSON parsing and local Markdown-link checks passed. `pnpm` was unavailable
  in the execution environment, so the equivalent commands were run directly with
  Node.js `22.16.0` and the available TypeScript toolchain instead of `pnpm check`.
- **Technical debt:** mechanism/version/signal attribution is still host-provided;
  reasoning effort, worker count and context size exist only when reported;
  skill-specific verifier failures are represented through canonical failure classes
  plus explicit signals rather than a new taxonomy; health thresholds are simple
  deterministic heuristics; no statistical intervals; no canonical task-to-Eval
  linkage; Eval-run evidence therefore remains Stage 17 aggregate evidence rather
  than mechanism-linked evidence.
- **Limits:** no CLI/dashboard/storage query layer, no raw prompt mining, no
  embeddings/LLM health classifier, no causal inference, no automatic router/compute
  changes, no automatic skill/agent rewriting, no counterfactual execution.
- **Next-stage constraints:** Stage 19 Controlled Evolution should consume these
  descriptive health results and Stage 16 Eval comparison as evidence for proposals,
  but must preserve `observation → hypothesis → proposed change → eval → explicit
  user decision`; counterfactual/shadow decisions must not execute alternatives or
  mutate production silently.
- **Expected next Roadmap v2 stage:** 19 — Controlled Evolution.
