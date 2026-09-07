# Dynamic Decomposition + DAG + Parallelism Policy

Stage 9 adds a bounded deterministic planning layer after Strategy Routing. It
turns an explicit decomposition proposal into a canonical execution DAG, applies
delegation limits, derives initial readiness, and recommends whether parallel
execution is worth exposing to a later executor.

It deliberately does **not** invent semantic subtasks from the user's prompt.
Semantic decomposition still requires a planner/Worker proposal; deterministic
Runtime owns the parts that benefit from hard contracts and predictable policy.

## Canonical flow

```text
Task Analysis
+ Stage 8 Strategy Decision or Worker handoff
+ optional semantic Decomposition Proposal
↓
amy.decomposition
↓
execution-plan
  decision
  bounded DAG
  ownership/readiness
  lifecycle policy
  parallelism policy
```

For a Stage 8 source, `planning: "decompose"` is only a routing signal. If that
signal is absent, Stage 9 returns `not-needed`. If decomposition is requested but
no semantic proposal exists, Stage 9 returns `proposal-required` rather than
fabricating nodes.

A Worker can request decomposition after execution has already started by using
a validated Worker handoff source. This path is constrained by both the global
Stage 9 policy and Stage 7 Worker child-delegation policy.

## Canonical proposal

`IDecompositionProposal` contains only the information Runtime needs to validate
and schedule safely later:

- deterministic `proposalId`;
- bounded nodes;
- node goal;
- `ownerRole` (`worker` or bounded `scout` only);
- dependencies;
- declared outputs;
- read targets;
- write targets;
- optional context refs used only as a coordination-cost signal.

Recovery-only `debugger` and post-execution `verifier`/`reviewer` roles are not
valid decomposition-node owners. Their activation remains owned by Reliability
stages rather than being smuggled into the DAG planner.

Unknown dependencies, self-dependencies, duplicate node IDs, and cycles fail
validation.

## DAG contract

A planned `TDecompositionPlan` uses the shared Runtime `execution-plan` envelope.
The DAG stores:

- stable node IDs;
- ownership by logical Agent Role;
- dependency lists;
- initial `ready` / `blocked` state;
- outputs;
- bounded read/write/context targets.

Initial readiness is structural: nodes without dependencies are `ready`; other
nodes are `blocked`. Stage 9 does not mutate live node state or supervise running
agents.

The plan also carries a conservative lifecycle policy:

- failure: `block-dependents`;
- cancellation: `cascade-dependents`;
- replanning: `allowed`.

These are declarative semantics for later execution/recovery layers, not a retry
engine.

## Delegation limits

Default policy:

```text
maxNodes = 3
maxDelegationDepth = 2
```

The policy can be overridden when constructing `amy.decomposition`. A
Worker-triggered plan additionally intersects `maxNodes` with the canonical Stage
7 Worker `maxChildren` policy, currently producing an effective cap of two child
nodes for that handoff.

If a proposal exceeds the effective cap, the plan returns `blocked` with
`node-limit-exceeded`. If the next delegation would exceed depth, it returns
`blocked` with `delegation-depth-limit`.

This is the Stage 9 agent-explosion guard. It does not create a separate scheduler
or global orchestration service.

## Parallelism policy

Parallelism is metadata over the DAG, not a mandatory executor.

The policy considers only bounded evidence already present in canonical inputs:

- structural independence in the DAG (speed-gain opportunity);
- Task Classification `parallelizability`;
- shared context refs (duplicated-context cost);
- task coupling (coordination/integration cost proxy);
- task uncertainty (dependency uncertainty);
- overlapping declared write targets (write-conflict hard guard).

The output is intentionally categorical:

- `mode`: `parallel` or `sequential`;
- `maxConcurrency`;
- categorical confidence;
- structured reason codes.

Write conflicts force sequential policy. High coupling or high uncertainty also
keeps execution sequential even when the DAG contains independent nodes. No
provider process, thread, worker pool, or child agent is started by Stage 9.

## Runtime API and CLI

Stage 9 exports:

- `DECOMPOSITION_VERSIONS`;
- `DEFAULT_DECOMPOSITION_POLICY`;
- proposal/DAG/parallelism/lifecycle contracts;
- `validateDecompositionInput()`;
- `validateDecompositionPolicy()`;
- `planDecomposition()`;
- `IDecompositionApi`;
- `createDecompositionCapability()`.

Stage 9 also adds canonical downstream validation for Stage 8 output through
`validateStrategyRoutingDecision()` instead of copying another local projection
validator.

The optional capability id is `amy.decomposition` version `1.0.0`. It is not
registered by default.

Explicit CLI usage:

```text
node runtime/dist/cli.js decomposition-plan --input <decomposition-input.json> --project <path>
```

## Deliberate limits

Stage 9 does not:

- semantically split an arbitrary prompt without a proposal;
- execute or supervise DAG nodes;
- spawn agents or create provider-specific agent definitions;
- perform real parallel execution;
- persist DAG lifecycle state;
- automatically create Agent Handoffs from nodes;
- automatically route node-level compute;
- perform integration, verification, review, retry, or recovery;
- use an LLM or giant orchestration prompt.

## Stage 9 Handoff

Stage: 9 — Dynamic Decomposition + DAG + Parallelism Policy.

Verdict: `simplify`.

Implemented: deterministic optional `amy.decomposition` capability; explicit
semantic proposal boundary; canonical `execution-plan` envelope; validated
acyclic bounded DAG with ownership, dependencies, outputs and initial readiness;
Worker-triggered late decomposition; global plus role-local child limits and
delegation-depth guard; declarative failure/cancellation/replanning policy;
conservative parallelism policy using independence, classification, duplicated
context and write-conflict evidence; explicit `decomposition-plan` CLI; canonical
Stage 8 Strategy Decision validator for downstream reuse; public Runtime exports;
README/Runtime reference integration; compatible plugin minor version bump to
`2.8.0`.

Canonical interfaces/contracts: `TExecutionPlan`, `DECOMPOSITION_VERSIONS`,
`DEFAULT_DECOMPOSITION_POLICY`, `IDecompositionPolicyConfig`,
`IDecompositionProposal`, `IDecompositionNodeProposal`, `IDecompositionInput`,
`TDecompositionSource`, `IStrategyDecompositionSource`,
`IWorkerDecompositionSource`, `IDecompositionDag`, `IDecompositionDagNode`,
`IDecompositionLifecyclePolicy`, `IParallelismDecision`, `TDecompositionPlan`,
`IDecompositionApi`, `validateDecompositionInput`, `validateDecompositionPolicy`,
`planDecomposition`, `createDecompositionCapability`, and the newly reusable
`validateStrategyRoutingDecision`.

Key architectural decisions: semantic decomposition is not faked with brittle
runtime heuristics; Stage 8 remains a decision layer and Stage 9 consumes
`planning: decompose` only as a signal; Worker can request a later split without
bypassing Stage 7 delegation rules; roles and compute remain independent; DAG
lifecycle semantics are declarative only; parallelism is optional policy over the
DAG and never an implicit executor; no scheduler/provider adapter/persistence or
recovery machinery was introduced.

Verification results: baseline Stage 8 full Runtime suite passed before changes
with 93 tests / 14 suites / 0 failures. Stage 9 used TDD RED→GREEN. Final source
typecheck passed; build passed; test typecheck and compile passed; the full Runtime
suite passed with 104 tests / 15 suites / 0 failures; `check-generated` confirmed
`runtime/dist` matches TypeScript sources; package/manifest versions match at
`2.8.0`; all 16 skill directories contain `SKILL.md`; local Markdown references
resolve; and an inventory CLI smoke check reports plugin version `2.8.0`. The
architectural diff contains only Stage 9-related files. Archive structure and
cleanliness are verified immediately before delivery. `pnpm` is unavailable in
the execution environment, so project scripts are reproduced with Node and the
available TypeScript toolchain using temporary external symlinks; these are
removed before packaging. Local Windows marketplace sync/reinstall cannot be run
inside this sandbox.

Technical debt: semantic proposal generation still belongs to a planner/Worker or
future provider adapter; there is no live DAG state store/executor; the
parallelism policy is intentionally conservative and not outcome-calibrated;
context duplication uses explicit proposal refs rather than token accounting;
Stage 9 capability policy overrides are API-level and CLI currently uses defaults;
strategy/decomposition inputs do not yet carry a stronger canonical task-identity
link beyond the validated contracts supplied by the caller.

Limits: `planned` means a safe canonical plan exists, not that any node executed.
Lifecycle policy does not perform cancellation/replanning, parallel mode does not
spawn workers, and node-level Compute Routing must still be invoked explicitly by
a later executor.

Next stage should be Stage 10 — Verification Pipeline. It should consume Task
Contract/result evidence and existing project command policies, keep mechanical
checks deterministic, add semantic Verifier only when routed, and preserve
Reviewer as conditional rather than mandatory.
