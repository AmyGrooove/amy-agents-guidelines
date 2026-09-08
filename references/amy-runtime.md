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

## Intentionally absent

Runtime does not implement semantic project reasoning, LLM-based drift
interpretation, automatic source exploration or agent execution, DAG execution or scheduling,
advanced orchestration, command execution, retry/recovery, analytics,
dashboards, evolution, automatic skill rewriting, persistent adapters, long-term
memory, or automatic skill routing.
