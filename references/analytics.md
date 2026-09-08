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

# Stage Handoff

- **Stage:** 17 — Analytics Engine + Task Archetypes.
- **Verdict:** `implement`, using a deterministic snapshot-based analytics layer
  rather than a storage-coupled analytics subsystem.
- **Implemented:** optional `amy.analytics`; validated task/eval analytics samples;
  half-open time windows; named policy/archetype segments; descriptive outcome,
  recovery, routing, usage, and Eval metrics; sample-size confidence; failure-class
  distribution; deterministic bilingual task-archetype discovery; explicit
  insufficient-sample state; non-causal findings with investigative-only
  recommendations; canonical Stage 16 Eval result validators; Runtime exports,
  tests, docs, plugin version `2.16.0`.
- **Canonical interfaces/contracts:** `IAnalyticsApi`, `IAnalyticsInput`,
  `IAnalyticsTaskSample`, `IAnalyticsEvalRunSample`, `IAnalyticsWindow`,
  `IAnalyticsSegmentDefinition`, `IAnalyticsReport`, `IAnalyticsSegmentReport`,
  `IAnalyticsMetric`, `IAnalyticsFinding`, `IAnalyticsFailureClassSummary`,
  `ITaskArchetypeDiscovery`, `ITaskArchetypeAssignment`,
  `ITaskArchetypeSummary`, `TTaskArchetype`, `ANALYTICS_VERSIONS`,
  `ANALYTICS_LIMITS`, `validateAnalyticsInput()`, `analyzeAmyData()`,
  `discoverTaskArchetypes()`, plus Stage 16 `validateEvalCaseResult()` and
  `validateEvalRunResult()`.
- **Key architecture decisions:** analytics is host-snapshot based and storage
  independent; existing Stage 4/8/15/16 contracts are validated rather than copied;
  segmentation uses explicit policy provenance/time/archetype filters; missing data
  remains missing; confidence is categorical sample-size evidence only; archetype
  discovery stays simple and optional; every generated finding explicitly forbids a
  causal claim; no production policy is mutated.
- **Verification results:** Stage 16 baseline from its handoff was `161/161` tests
  across `22` suites. Stage 17 focused tests pass `7/7`; the full compiled runner
  passes `168/168` tests across `23` suites. Production and test typechecks pass,
  production/test compilation passes, `runtime/dist` matches TypeScript sources,
  manifest/package version parity is `2.16.0`, and the inventory CLI smoke check
  passes with Node `22.16.0`, global TypeScript `5.8.3`, and `@types/node` `24.0.4`.
  `pnpm` is unavailable in the sandbox, so equivalent direct `tsc`/Node checks were
  used. A configured marketplace/install sync is not available in this sandbox.
  The packaged source archive is integrity-checked and excludes generated output,
  `node_modules`, caches, and temporary files.
- **Technical debt:** analytics ingestion is a host responsibility; production
  token/cost metrics exist only when the host reports them; policy refs are compact
  provenance summaries rather than replayable historical policies; archetypes are
  keyword heuristics; no statistical intervals; no direct task-to-eval linkage for
  archetype-filtered Eval metrics.
- **Limits:** no CLI/dashboard/storage query layer, no embeddings, no LLM analytics,
  no causal inference, no automatic routing changes, no mechanism health scoring,
  no counterfactual execution.
- **Next-stage constraints:** Stage 18 should reuse Analytics segments/metrics,
  Outcome Failure Taxonomy, Strategy/Decision Provenance, and Eval results to assess
  Skill/Agent/Router/Compute health. It must answer whether a mechanism is weak or
  merely misrouted, compare only similar task segments, keep sample size/confidence
  visible, and must not mutate production routing.
- **Expected next Roadmap v2 stage:** 18 — Mechanism & Routing Health Analytics.
