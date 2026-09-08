# Eval System

Stage 16 adds deterministic regression evaluation for Amy itself without turning
evals into a production orchestrator. The execution host supplies observations;
Amy validates and scores them against compact versioned cases.

## Verdict

`implement`

The gap after Stage 15 is real: Outcome/Failure Intelligence provides outcome
evidence, and Data Storage reserves an `evals/` artifact directory, but there was
no corpus contract, scoring policy, cost guard, repeatable runner, or A/B comparison.
The implementation is intentionally bounded and storage-independent.

```text
versioned Eval Corpus
+ explicit usage budget
+ host-provided executor
↓
canonical observations
(Strategy / Verification / Completion / Outcome)
↓
deterministic case scoring
↓
Eval Run Result
↓ optional
same-corpus A/B comparison
```

## Capability and contracts

`amy.eval-system` is optional, has no required capability dependency, and is not
registered by `createAmyRuntime()`.

Versions:

- capability: `1.0.0`;
- API: `1`;
- case/corpus/observation/result schemas: `1`;
- comparison schema: `1`;
- scoring policy: `1`.

Canonical API:

```ts
interface IEvalSystemApi {
  validateCorpus(value: unknown): Readonly<IEvalCorpus>;
  evaluateCase(value: unknown): Readonly<IEvalCaseResult>;
  runCorpus(value: unknown, executor: TEvalExecutor): Promise<Readonly<IEvalRunResult>>;
  compareVariants(value: unknown, executor: TEvalExecutor): Promise<Readonly<IEvalComparisonResult>>;
}
```

The executor is deliberately a host port rather than an Amy-owned model runner.
This keeps evaluation usable for deterministic fixtures, real Codex runs, or
future shadow experiments without coupling Stage 16 to a specific model/provider.

## Corpora and cases

`IEvalCorpus.corpusKind` distinguishes the roadmap corpora:

- `real-task`;
- `failure`;
- `regression`.

Each `IEvalCase` stores only essential evaluation context:

- canonical `ITaskContract`;
- environment assumptions;
- eval-only constraints;
- deterministic expectations;
- scoring threshold.

Cases do not store raw production repositories, prompts, tool payloads, or
telemetry dumps. Corpus and case IDs are caller-owned and stable, case IDs must be
unique, and corpus `version` is explicit for repeatable comparisons.

## Deterministic expectations and scoring

Expectations can assert:

- Completion status;
- Verification status;
- Outcome status;
- required Failure Taxonomy class;
- Strategy execution/exploration/planning/Verifier/Reviewer/Fast Path decisions.

Each expectation has a bounded integer weight and can be marked `required`.
The case score is the weighted percentage of passed checks. A case passes only if
its score reaches `passThreshold` and every required expectation passes. No LLM
judge or subjective free-text grader is introduced.

Stage 16 consumes canonical upstream results through their validators. It adds
`validateOutcomeAssessment()` to Stage 15 because Outcome Assessment previously
had no downstream structural validator; this is the only targeted prior-stage
change required by Eval.

## Cost and repeatability

Every corpus run requires an explicit `IEvalBudget`:

- `maxCases`;
- `maxTokens`;
- `maxDurationMs`;
- `maxCostUnits`.

Execution is sequential and preserves corpus order. This avoids hidden parallel
coordination cost and makes result ordering deterministic. The runner stops before
starting another case when a limit has been reached and marks remaining case IDs
as skipped. A single executed case can exceed its remaining budget because the
host reports usage only after execution; Amy then stops subsequent cases.

Executor exceptions or invalid observations become case-level `error` results
rather than crashing the whole corpus. Usage that the host does not report cannot
be reconstructed by Stage 16 and is therefore outside the budget guarantee.

## A/B comparison

`compareEvalVariants()` runs baseline and candidate against the same validated
corpus and the same explicit budget. It reports:

- baseline/candidate run results;
- score delta;
- per-case improvements/regressions;
- winner only when both runs complete.

Budget-exhausted comparisons are `inconclusive`. Comparison never changes
production routing or applies the candidate configuration.

## Deliberate limits

Stage 16 does not add:

- `amy eval` CLI (reserved for Amy Operations / Stage 20);
- LLM-based grading;
- automatic corpus mining from production storage;
- background eval scheduling;
- production routing mutation;
- analytics, causal conclusions, or mechanism health scoring;
- a new database or persistence path;
- full production repository replay;
- parallel eval execution.

# Stage Handoff

- **Stage:** 16 — Eval System.
- **Verdict:** `implement`, with a deliberately small deterministic runner and
  host-owned execution port.
- **Implemented:** optional `amy.eval-system`; versioned Real Task / Failure /
  Regression corpus contracts; compact canonical eval cases; deterministic
  weighted scoring; explicit run budgets for cases/tokens/duration/cost units;
  sequential repeatable corpus runner; case-level executor error isolation;
  same-corpus A/B comparison with improvements/regressions and inconclusive
  budget state; canonical `validateOutcomeAssessment()` downstream boundary;
  Runtime exports, tests, docs, plugin version `2.15.0`.
- **Canonical interfaces/contracts:** `IEvalSystemApi`, `IEvalCorpus`,
  `IEvalCase`, `TEvalExpectation`, `IEvalObservation`, `IEvalBudget`,
  `IEvalUsage`, `IEvalRunResult`, `IEvalComparisonResult`, `IEvalVariant`,
  `TEvalExecutor`, `EVAL_SYSTEM_VERSIONS`, `EVAL_SYSTEM_LIMITS`,
  `validateEvalCorpus()`, `evaluateEvalCase()`, `runEvalCorpus()`,
  `compareEvalVariants()`, and Stage 15 `validateOutcomeAssessment()`.
- **Key architecture decisions:** Eval is optional and not default-registered;
  execution remains host-owned; scoring is deterministic; canonical upstream
  results are validated instead of inventing a second success taxonomy; corpora
  remain compact and storage-independent; budgets are explicit; runs are
  sequential for repeatability; A/B is observational only and cannot mutate
  production routing.
- **Verification results:** Stage 15 baseline passed `156/156` tests across `21`
  suites. Stage 16 focused tests passed `5/5`. Production build/typecheck, test
  typecheck/compile, full runner, and generated parity passed with `161/161`
  tests across `22` suites. Verification used Node `22.16.0`, global TypeScript
  `5.8.3`, and locally available `@types/node` `24.0.4`; repository `pnpm@11.23.0`
  and pinned TypeScript `5.9.x` were unavailable in the environment.
- **Technical debt:** cost enforcement depends on usage reported by the host and
  can overshoot by one case; no corpus artifact serializer/loader is owned by
  Runtime; expectation kinds are intentionally limited to current canonical
  Stage 8/10/11/15 outputs; no statistical confidence or segmentation yet.
- **Limits:** no CLI, no background runner, no automatic corpus extraction, no
  LLM judge, no parallel evals, no analytics/recommendations, no production
  routing changes, no mandatory storage.
- **Next-stage constraints:** Stage 17 Analytics should consume these eval run
  results plus Stage 13–15 telemetry/outcome data rather than creating another
  evaluation taxonomy. Keep `metric → observation → hypothesis → recommendation`
  explicit, segment by policy/version/time window, surface sample size, and avoid
  causal claims. Task archetype discovery should stay simple and optional.
- **Expected next Roadmap v2 stage:** 17 — Analytics Engine + Task Archetypes.
