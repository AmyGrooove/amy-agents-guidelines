# Amy Runtime

Amy Runtime is an explicitly invoked deterministic foundation for extending Amy
with independent capabilities. Installing the plugin does not route existing
skills through Runtime and does not start a background process.

## Architecture

The small Runtime kernel composes configuration, the capability registry,
runtime state, lifecycle events, and lifecycle control. It contains no React,
Effector, NestJS, analytics, semantic project analysis, or domain-skill behavior.

Capabilities expose a descriptor and a public API. They register before Runtime
startup and can declare required and optional capability dependencies. Runtime
configuration decides whether a capability is enabled or required for the
current execution. Missing, disabled, incompatible, and temporarily unavailable
optional capabilities have explicit resolution statuses and do not break an
unrelated operation.

Core depends only on public contracts. Optional capability implementations may
depend on lower-level public capabilities, but core never imports them.

## Existing plugin mechanisms

Skills remain instructions describing how to perform a kind of work. Agents are
independent reasoning workers that may use multiple skills. Deterministic code
owns configuration, discovery, validation, capability resolution, state, event
delivery, and version checks.

The built-in `amy.plugin-inventory` compatibility capability reads plugin
metadata and reports canonical skills, agents, validators, permissions, and
scripts. `PluginInventory` is descriptive: discovery never registers or runs
the reported mechanisms.

## Public API

The TypeScript source in `runtime/src` builds to ESM in `runtime/dist`.
The generated directory is ignored by Git and is created explicitly with
`pnpm build` after dependencies are installed.
Consumers import `runtime/dist/index.js` and explicitly call `createAmyRuntime`.

Runtime registration is open until `start()`. Startup validates required
capabilities and dependencies and freezes registration. `resolveOptional`
returns a status; `resolveRequired` raises `AmyRuntimeError` when resolution is
not possible.

## CLI

Install dependencies and build Runtime before using its API or CLI:

```text
pnpm install
pnpm build
```

Runtime then runs on Node.js 20 or newer:

```text
node runtime/dist/cli.js status
node runtime/dist/cli.js capabilities
node runtime/dist/cli.js inventory
node runtime/dist/cli.js config --project <path>
```

`--project` defaults to the current directory. `--plugin` overrides plugin-root
discovery. Commands return JSON and never modify configuration or project files.

## Configuration

Runtime merges configuration in this order:

1. Amy defaults.
2. `~/.amy/config.json`.
3. `<project>/.amy/config.json`.
4. API or CLI overrides.

Schema version 1 accepts only per-capability `enabled` and `required` booleans.
Later sources merge by capability ID and override only explicitly supplied
properties. Invalid JSON, unknown fields, and unsupported schema versions fail
with `INVALID_CONFIGURATION`.

## State and events

`StateStore` is asynchronous and namespaced. Stage 1 supplies only
`MemoryStateStore`; no persistence is required. JSON-compatible records carry
the independent state-schema version.

`RuntimeEventBus` delivers lifecycle events on a best-effort basis. Consumer
failures appear in `EventDeliveryResult` and never control the main workflow.
No consumer is a valid no-op configuration.

## Compatibility and versions

Runtime API, configuration, capability contracts, state, and events each have
an independent integer major version. Capability implementations retain their
own SemVer version and dependency-major requirements.

Stage 1 adds Runtime without changing existing skill instructions, activation,
references, permissions, or canonical Codex behavior.

## Project Intelligence

Stages 2–3 add an independent `amy.project-intelligence` capability. Runtime does
not register it by default; its explicit factory and CLI commands provide
deterministic discovery, versioned artifacts, validation, storage, lookup,
freshness fingerprints, a lightweight project graph, impact analysis, and safe
`AGENTS.md` routing. Semantic interpretation and evidence-backed graph
enrichment remain in the `maintain-project-intelligence` skill.

See [Project Intelligence](project-intelligence.md) for the contracts and latest
Stage Handoff.

## Task Intelligence

Stage 4 adds an independent `amy.task-intelligence` capability. It validates a
versioned Task Contract and produces deterministic categorical classification.
Natural-language normalization remains in the `analyze-task` skill. Project
Intelligence can be supplied only as explicit evidence; Task Intelligence never
loads or refreshes it automatically.

See [Task Intelligence](task-intelligence.md) for contracts and the Stage 4
Handoff.

## Context Intelligence

Stage 5 adds an independent `amy.context-intelligence` capability. It consumes a
validated Task Analysis and selectively reuses Project Intelligence knowledge,
freshness, and direct graph impact to compile a bounded `context-selection`
packet. Project Intelligence remains optional. The resolver never scans the
repository, refreshes knowledge, or activates Scout; it returns explicit
`none`, `source-read`, or `scout` exploration recommendations with evidence.

See [Context Intelligence](context-intelligence.md) for contracts and the Stage 5
Handoff.

## Compute Routing

Stage 6 adds an independent `amy.compute-routing` capability. It maps validated
Task Intelligence signals to provider-independent logical compute profiles and,
when configured, to opaque model/reasoning bindings. The capability supports
explicit task/DAG-node targets, upgrade/downgrade transitions, ordered model
fallback, and bounded upward escalation when a required model is explicitly
reported unavailable. It does not select agent roles or execution strategy.

See [Compute Routing](compute-routing.md) for contracts and the Stage 6 Handoff.

## Agent Roles + Handoff

Stage 7 adds an independent `amy.agent-roles` capability with a deterministic
universal role catalog and strict assignment/result handoff contracts. Roles carry
responsibility, I/O, read/write/tool, delegation, completion, and typical logical
compute metadata, but Runtime does not select or spawn an agent. Compute Profile
remains an independent logical recommendation rather than a role or model alias.

See [Agent Roles + Handoff](agent-roles.md) for contracts and the Stage 7 Handoff.

## Strategy Routing + Fast Path

Stage 8 adds an independent `amy.strategy-routing` capability. It consumes a
canonical Task Analysis plus optional Context Resolution and task-level Compute
Decision evidence, then returns a versioned `execution-strategy` contract with
only high-level categorical directives: exploration, planning/decomposition
recommendation, direct versus Worker execution, conditional Verifier/Reviewer
selection, compute escalation, confidence, and structured reason codes.

The router is deterministic and does not execute the strategy. A cheap targeted
`source-read` can remain on Fast Path; Scout, Worker, Verifier, and Reviewer are
selected only when concrete task/context/risk signals justify their cost.
Optional upstream capabilities remain optional because Strategy Routing accepts
Task Analysis alone and declares no Runtime capability dependency.

See [Strategy Routing](strategy-routing.md) for contracts and the Stage 8 Handoff.

## Dynamic Decomposition + DAG

Stage 9 adds an independent `amy.decomposition` capability. It consumes canonical
Task Analysis plus either a Stage 8 Strategy Decision or a validated Worker
handoff. Runtime never fabricates semantic subtasks: a requested decomposition
without an explicit proposal returns `proposal-required`. Valid proposals become a
bounded acyclic `execution-plan` DAG with ownership, dependencies, outputs,
initial readiness, declarative failure/cancellation/replanning semantics, and a
conservative parallelism recommendation.

The default plan allows at most three nodes and delegation depth two;
Worker-triggered decomposition is further constrained by the Stage 7 Worker child
policy. Parallelism remains metadata only: Stage 9 does not spawn agents or run a
scheduler.

See [Decomposition + DAG](decomposition.md) for contracts and the Stage 9 Handoff.

## Verification Pipeline

Stage 10 adds an independent `amy.verification` capability. It consumes canonical
Task Analysis, the Stage 8 Strategy Decision, explicit implementation/artifact
refs, and mechanical verification evidence supplied by the host workflow. Runtime
does not introduce a second shell executor: command execution and permission
handling stay with the existing Codex/project workflow, while Runtime validates
and evaluates the resulting evidence deterministically.

When Strategy Routing requests semantic verification or conditional review, the
pipeline produces canonical read-only Stage 7 handoffs for `verifier` and
`reviewer`. Verifier reports must cover each task requirement and acceptance
criterion with explicit evidence or a gap remains `unverified`; Reviewer findings
only fail quality when marked `required`. Missing, skipped, unavailable, or failed
verification execution is never treated as success. The Verifier role catalog now
accepts an optional `context-packet` input so relevant specs can be supplied
without creating a new context contract.

See [Verification Pipeline](verification.md) for contracts and the Stage 10 Handoff.

## Completion Protocol + Stop Guards

Stage 11 adds the independent deterministic `amy.completion` capability. It
consumes canonical Task Analysis, the Stage 10 `quality-result`, and explicit
execution/integration evidence from the host workflow. It does not rerun
verification. Instead it compiles a canonical Completion Evidence record and a
bounded declarative guard decision.

`complete` is possible only when execution is completed, integration is either
completed or explicitly not required, Verification is `passed`, and no explicit
unresolved issue remains. Verification gaps remain `unverified`; pending required
Verifier/Reviewer work remains `incomplete`; failures remain failures. Guard
`retry` means only that a retry is still allowed by the configured budget. Stage
11 never performs blind recovery or escalation.

See [Completion Protocol](completion.md) for contracts and the Stage 11 Handoff.

## Retry + Escalation

Stage 12 adds the independent deterministic `amy.recovery` capability. It consumes
a canonical Stage 11 Completion result plus one concrete failure signal for one
failing branch. It does not execute retries. Instead it diagnoses the failure class
and emits a bounded `execution-plan` action that reuses the canonical owner:
Debugger, Context Intelligence, Compute Routing, host retry/integration, followed by
Verification.

Retry allowance remains owned by the Stage 11 Completion guard; compute escalation
has a separate bounded policy. Terminal Completion guards are never overridden,
preserved facts are carried forward explicitly, and every actionable recovery plan
requires verification again. The capability remains optional and is registered only
for explicit use/CLI.

See [Retry + Escalation](recovery.md) for contracts and the Stage 12 Handoff.

## Observability + Decision Provenance

Stage 13 adds optional `amy.observability` on top of the existing
`RuntimeEventBus`. Runtime lifecycle/capability events remain canonical telemetry;
explicit task/session/agent/tool telemetry and decision provenance use the same bus
through `observability.recorded`. Consumer failures are isolated and returned in a
receipt, so observability remains fail-open.

`buildDecisionProvenance()` deterministically translates canonical Stage 4–12
outputs into bounded records for classification, context, compute, strategy/Scout,
decomposition/parallelism, Verifier/Reviewer, retry, Recovery, and escalation. It
reuses source reason codes and policy/version evidence and never stores raw prompts
or uncontrolled chain-of-thought. Persistence remains outside Stage 13.

See [Observability + Decision Provenance](observability.md) for contracts and the
Stage 13 Handoff.

## Data Storage + Privacy

Stage 14 adds the independent optional `amy.data-storage` capability. It persists
sanitized Runtime events as append-only day-segmented JSONL and, when the running
Node version exposes `node:sqlite`, maintains a normalized SQLite projection with
versioned migrations and indexes. The SQLite path is dynamically loaded, so Node
20-compatible core imports remain usable; unavailable SQLite degrades storage to
raw JSONL rather than becoming a Runtime dependency.

The storage layer consumes the existing `RuntimeEventBus` through an explicit
consumer adapter. Backend failures are reported by the event bus but remain
fail-open for the main workflow. Raw prompt/tool/body-like fields are omitted by
default; explicit opt-in stores only their redacted form, and secret/.env
redaction is always applied. Retention cleanup, bounded export, corrupt JSONL
reporting, and SQLite quarantine/recreation are deterministic storage concerns.

See [Data Storage + Privacy](data-storage.md) for contracts and the Stage 14
Handoff.

## Outcome + Failure Intelligence

Stage 15 adds the independent deterministic `amy.outcome-intelligence` capability.
It compiles canonical Completion results, optional Recovery plans, and explicit
bounded post-task signals into a versioned Outcome Assessment with real outcome
status, evidence refs, retry/escalation counts, unresolved issues, and Failure
Intelligence. Missing verification remains `unverified`; missing Completion evidence
remains `unknown`; tests-passed alone is never treated as task success.

The capability also provides a conservative deterministic User Correction Detector
that distinguishes correction/new-task/ambiguous follow-ups and emits only a generic
semantic correction signal plus an opaque evidence ref. `recordOutcomeAssessment()`
reuses `RuntimeEventBus`; optional Data Storage schema 2 projects
`outcome.assessed` into normalized `outcomes` and `failures` tables. Neither outcome
analysis nor persistence is registered automatically.

See [Outcome + Failure Intelligence](outcome-intelligence.md) for contracts and the
Stage 15 Handoff.


## Eval System

Stage 16 adds the independent optional `amy.eval-system` capability. It validates
compact versioned Real Task, Failure, and Regression corpora, evaluates canonical
Completion/Verification/Strategy/Outcome observations with deterministic weighted
checks, enforces explicit per-run usage budgets, and supports same-corpus A/B
comparison. Actual task execution remains host-provided through a bounded executor
port, so the Runtime does not acquire an LLM dependency or replay an entire
production repository by itself.

Eval does not require Data Storage and is not registered automatically. Stage 14's
`evals/` directory remains only a host-owned artifact location; Stage 16 introduces
no second persistence path. `validateOutcomeAssessment()` is now the canonical
structural boundary for downstream consumers of Stage 15 outcome evidence.

See [Eval System](eval-system.md) for contracts and the Stage 16 Handoff.

## Analytics Engine + Task Archetypes

Stage 17 adds the independent optional `amy.analytics` capability. It aggregates
host-provided canonical Task/Strategy/Outcome/Eval snapshots into bounded
descriptive metrics, named time/policy/archetype segments, failure distributions,
and sample-size confidence. Missing measurements stay missing rather than being
reconstructed.

Task archetype discovery uses a small deterministic bilingual keyword policy and
returns `insufficient-sample` for tiny corpora. Generated findings preserve
`metric → observation → hypothesis → recommendation` explicitly, set
`causalClaim: false`, and only recommend collecting or inspecting evidence. The
capability has no storage dependency and is not registered automatically.

Stage 16 Eval results now have canonical `validateEvalCaseResult()` and
`validateEvalRunResult()` downstream validators so Analytics reuses Eval semantics
instead of inventing a second scoring taxonomy.

Stage 18 extends the same optional `amy.analytics` capability instead of adding a
second analytics subsystem. Task snapshots may now carry optional versioned
skill/agent mechanism observations and compact execution measurements. Health
analysis aggregates mechanism usage, outcomes, recovery, failures, cost and explicit
evidence signals, then compares routing/compute choices only inside comparable
cohorts derived from task archetype, scope, complexity, risk, and strategy policy
version. Assessments are deterministic hypotheses (`routing-fit-suspected`,
`mechanism-risk-suspected`, etc.), always non-causal, and never mutate production
routing.

See [Analytics Engine + Task Archetypes + Mechanism Health](analytics.md) for contracts and the Stage 18 Handoff.

## Controlled Evolution

Stage 19 adds the independent optional `amy.evolution` capability. It reuses Stage
18 Analytics health evidence, Stage 16 Eval comparison evidence, and canonical Stage
8 Strategy decisions to create bounded non-causal counterfactual hypotheses, safe
shadow strategy comparisons, Improvement Proposals, and explicit user-decision
receipts.

Evolution never executes a shadow candidate, never mutates production policy, and
contains no apply API. Shadow comparison accepts a host-produced candidate instead
of duplicating the Stage 8 router. Counterfactual analysis uses only comparable
Stage 18 routing cohorts with measured cost and reliability. The capability is not
registered automatically and has no mandatory Storage/Analytics/Eval registration
dependency.

See [Controlled Evolution](evolution.md) for contracts and the Stage 19 Handoff.

## Intentionally absent

Runtime does not implement semantic project reasoning, LLM-based drift
interpretation, automatic source exploration or agent execution, DAG execution or scheduling,
advanced orchestration, command execution, automatic recovery execution, dashboards, automatic skill
rewriting, long-term memory, automatic
storage scheduling, automatic skill routing, shadow execution, or automatic production policy mutation.
