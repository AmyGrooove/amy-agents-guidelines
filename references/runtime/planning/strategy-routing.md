# Strategy Router + Fast Path

Stage 8 adds a small deterministic routing layer between understanding/context and
later execution machinery. It decides how much orchestration a task justifies,
but it never executes that strategy itself.

## Canonical input

`IStrategyRoutingInput` consumes already available canonical evidence:

- required `TTaskIntelligenceAnalysis`;
- optional `IContextResolution` from Context Intelligence;
- optional task-level `IComputeRoutingDecision` from Compute Routing.

The capability deliberately has no Runtime capability dependencies. A caller may
route from Task Analysis alone, so Project/Context/Compute capabilities remain
optional and fail-open outside the operation that explicitly needs them.

Stage 8 does not consume raw prompts, rescan the repository, resolve models, or
reclassify the task.

## Canonical decision

The router reuses the Stage 1 `execution-strategy` pipeline envelope instead of
creating a parallel top-level contract. `IStrategyRoutingData` contains only
categorical directives:

- `exploration`: `none`, `source-read`, or the canonical `scout` role;
- `planning`: `none`, `plan`, or `decompose`;
- `execution`: `direct` or the canonical `worker` role;
- `verification`: `none` or the canonical `verifier` role;
- `review`: `none` or the canonical `reviewer` role;
- `escalation`: `none` or `compute`;
- optional logical `computeProfile`;
- categorical `confidence`;
- `fastPath`;
- structured `reasonCodes`;
- `policyVersion`.

These fields are high-level routing directives, not ordered steps or DAG nodes.
Stage 9 can translate `planning: decompose` into a bounded DAG without changing
Stage 8 into an execution engine.

## Fast Path

Fast Path is intentionally strict but cheap. It is selected when the task is
local with local blast radius, low complexity/coupling/uncertainty/verification
cost, no medium/high risk signal, no required Scout/planning/Verifier/Reviewer,
and no exhausted compute route.

A targeted `source-read` remains compatible with Fast Path. Reading the concrete
source-of-truth file is cheap evidence acquisition and should not force agent
orchestration by itself.

If Context Intelligence explicitly recommends `scout`, Stage 8 respects that
signal. When Context Resolution is absent, a low-confidence Task Analysis may use
Scout only when material evidence gaps concern affected scope, project risk, or
uncertainty. It does not launch broad repository exploration merely because some
classification dimensions are unknown.

## Planning, roles, and reliability cost

`decompose` is recommended only for wide-scope work combined with high complexity
or coupling. `plan` is used for high complexity/coupling/uncertainty/risk when a
DAG recommendation is not justified.

Worker delegation is reserved for decomposition, high complexity, high expected
context cost, or repository-wide work. A medium task can therefore remain direct
instead of paying subagent coordination cost automatically.

Verifier is conditional on concrete risk signals such as high risk, repository
blast radius, public API/critical invariants, or a high-complexity task with
non-low verification cost. Reviewer is stricter: it requires elevated risk plus
systemic coupling/scope. Debugger is never an initial Stage 8 route; recovery is a
later Reliability concern.

## Compute escalation

When a task-level Compute Decision is present, Strategy Routing preserves only its
logical profile. It does not copy provider model/reasoning strings into the
strategy contract.

If Compute Routing has already exhausted its allowed fallback/escalation ladder
and returns `unavailable`, Strategy Routing returns `escalation: compute`, lowers
routing confidence to `low`, and disables Fast Path. It never silently interprets
missing required compute as success or downgrades the requested reliability.

DAG-node Compute Decisions are rejected at this stage. Stage 9 owns node-level
routing after canonical DAG nodes exist.

## Runtime API and CLI

Stage 8 exports:

- `STRATEGY_ROUTING_VERSIONS`;
- `IStrategyRoutingInput`;
- `IStrategyRoutingData`;
- `TStrategyRoutingDecision`;
- categorical strategy directive/reason types;
- `validateStrategyRoutingInput()`;
- `routeStrategy()`;
- `IStrategyRoutingApi`;
- `createStrategyRoutingCapability()`.

The optional capability id is `amy.strategy-routing` version `1.0.0`. It is not
registered by default.

Explicit CLI usage:

```text
node runtime/dist/cli.js strategy-route --input <strategy-input.json> --project <path>
```

## Deliberate limits

Stage 8 does not:

- spawn, schedule, or supervise agents;
- create executable agent/provider definitions;
- create DAG nodes/dependencies or run parallel workers;
- perform planning itself;
- execute source reads or Scout exploration;
- run tests, semantic verification, or review;
- reconcile handoff lifecycle/results;
- diagnose failures or invoke Debugger;
- implement retry/recovery budgets;
- persist routing history or telemetry;
- use an LLM or giant orchestrator prompt.

## Stage 8 Handoff

Stage: 8 — Strategy Router + Fast Path.

Verdict: `simplify`.

Implemented: deterministic `amy.strategy-routing` capability; canonical
`execution-strategy` decision data; strict Task/Context/Compute routing-evidence
validation; local Fast Path; bounded Scout fallback; conditional planning,
decomposition recommendation, Worker, Verifier, Reviewer, and compute escalation;
structured reason codes/confidence/policy version; explicit `strategy-route` CLI;
public Runtime exports; README/Runtime reference integration; compatible plugin
minor version bump to `2.7.0`.

Canonical interfaces/contracts: `STRATEGY_ROUTING_VERSIONS`,
`IStrategyRoutingInput`, `IStrategyRoutingData`, `TStrategyRoutingDecision`,
`TStrategyExploration`, `TStrategyPlanning`, `TStrategyExecution`,
`TStrategyVerification`, `TStrategyReview`, `TStrategyEscalation`,
`TStrategyReasonCode`, `IStrategyRoutingApi`, `validateStrategyRoutingInput`,
`routeStrategy`, and `createStrategyRoutingCapability`. Existing
`TTaskIntelligenceAnalysis`, `IContextResolution`, `IComputeRoutingDecision`,
`TAgentRole`, and Stage 1 `TExecutionStrategy` remain the reused upstream/cross-
stage contracts rather than being duplicated.

Key architectural decisions: Stage 8 is a pure decision layer, not an executor;
Fast Path tolerates targeted source reads; optional upstream capabilities are
input evidence rather than Runtime dependencies; role and compute remain
independent; model/provider strings are not copied into strategy decisions;
`decompose` is only a recommendation for Stage 9; Debugger/retry are deferred to
Reliability; no ordered pseudo-DAG, orchestration prompt, persistence, or provider
adapter was introduced.

Verification results: TDD RED→GREEN was used for Strategy Router and CLI routing;
source TypeScript typecheck passed; test TypeScript typecheck passed after build;
build passed; full Runtime suite passed with 93 tests / 14 suites / 0 failures;
`runtime/dist` matched a fresh TypeScript generation via `check-generated`; plugin
manifest/package JSON parse and local Markdown reference checks passed; archive
structure/cleanliness is verified immediately before delivery. `pnpm` is unavailable in the execution environment, so the same
project scripts were reproduced with Node and the available TypeScript toolchain;
TypeScript available in the environment is 5.8.3 rather than the lockfile's 5.9.3.

Technical debt: the Stage 8 validator locally validates the canonical Context
Resolution and Compute Decision projections because those earlier modules do not
currently export output validators; later stages should avoid multiplying such
cross-stage validation copies if a shared canonical validator becomes justified.
Routing policy is categorical and intentionally not outcome-calibrated yet. There
is still no provider execution adapter or lifecycle store for role handoffs.

Limits: Stage 8 chooses strategy directives only. `decompose` does not create a
DAG, role selections do not spawn agents, Verifier/Reviewer are not executed,
compute escalation is only surfaced, and no completion/retry semantics are
implemented.

Next stage should be Stage 9 — Dynamic Decomposition + DAG + Parallelism Policy.
It should consume Stage 8 `planning: decompose` only as a routing signal, create a
bounded canonical DAG with ownership/dependencies/failure/cancellation metadata,
keep the usual child-agent count/depth limited, and treat parallel execution as an
optional policy rather than a mandatory runtime dependency.
