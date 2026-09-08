# Agent Roles + Handoff Contract

Stage 7 defines a small provider-independent vocabulary for agent ownership. It
adds deterministic role metadata and handoff validation, but does not yet choose,
spawn, schedule, or supervise agents.

## Canonical role set

Amy uses five universal roles:

```text
scout
worker
debugger
verifier
reviewer
```

Technology knowledge remains in existing development skills. Roles describe the
kind of responsibility an agent owns, not a framework, language, model, or prompt.

Each role descriptor defines:

- responsibility and explicit non-responsibilities;
- accepted input kinds and produced output kinds;
- tool, read, and write policy;
- role-local completion criteria;
- child-delegation policy;
- a typical logical Compute Profile.

`typicalComputeProfile` is only a default/recommendation. It is not a model alias
and does not prevent later routing from selecting a different profile for a
concrete task or DAG node.

### Baseline policies

- `scout` performs bounded read-only exploration and returns source-backed findings.
- `worker` owns an implementation subtask through local integration and may delegate
  only bounded Scout, Worker, or Debugger work.
- `debugger` diagnoses a concrete failing branch and may repair only delegated task
  scope.
- `verifier` is read-only and checks requirements against implementation, relevant
  context/specs, and verification evidence. Stage 10 extends its accepted inputs with
  optional `context-packet` while preserving the Stage 7 handoff schema.
- `reviewer` is read-only, conditional, and reserved for architecture/regression/
  maintainability review when later routing decides it is justified.

The Worker owns its delegated result. It is not a one-command executor and cannot
promote its own implementation claim into global task completion.

## Handoff Contract

`IAgentHandoff` is the canonical assignment envelope between the orchestrator or a
permitted parent role and a target role. It contains only bounded execution data:

- stable `handoffId`;
- source and target role;
- goal, requirements, non-goals, constraints, and acceptance criteria;
- explicit read/write targets;
- referenced inputs with compact summaries rather than uncontrolled raw context;
- expected role output kinds;
- optional logical Compute Profile.

Validation rejects:

- unknown fields and unsupported schema versions;
- unsupported roles, input kinds, output kinds, or compute profiles;
- write targets for read-only roles;
- child delegation not allowed by the parent role policy;
- duplicate or empty bounded values.

The Runtime does not infer extra scope during validation.

## Handoff Result

`IAgentHandoffResult` is the canonical role-owned return envelope. It contains:

- `handoffId` and role;
- `completed`, `blocked`, or `failed` role-local status;
- compact summary;
- produced output references;
- evidence references;
- child handoff ids;
- unresolved issues.

Blocked or failed results must explain at least one unresolved issue. Output kinds
must be valid for the returning role, and child handoff count is bounded by that
role's delegation policy.

This is not the Stage 11 Completion Protocol. A completed handoff means only that
the delegated role reports its own assignment complete; later Verification and
Completion stages decide whether the parent/user task is actually complete.

## Runtime API

Stage 7 adds the explicit optional capability `amy.agent-roles` and exports:

- `AGENT_ROLES`;
- `AGENT_ROLE_VERSIONS`;
- `listAgentRoles()`;
- `getAgentRole()`;
- `validateAgentHandoff()`;
- `validateAgentHandoffResult()`;
- `createAgentRolesCapability()`.

The capability has no Runtime capability dependency. It reuses the Stage 6
`TComputeProfile` type only as a logical value in descriptors/handoffs; it never
resolves a model or calls Compute Routing.

## Deliberate limits

Stage 7 does not:

- select a role for a task;
- activate Scout/Worker/Debugger/Verifier/Reviewer;
- create provider- or Codex-specific executable agent definitions;
- choose models or reasoning effort;
- create DAGs or parallel execution;
- enforce global delegation depth or cross-handoff child counts;
- perform verification, review, retry, escalation, or completion decisions.

No `agents/` prompt directory is introduced yet. The repository has no canonical
provider-specific agent-file contract, and inventing one here would couple Stage 7
to an execution mechanism before Strategy/DAG stages establish how roles are
actually invoked.

## Stage 7 Handoff

Stage: 7 — Agent Roles + Handoff Contract.

Verdict: `simplify`.

Implemented: deterministic universal role catalog for Scout, Worker, Debugger,
Verifier, and Reviewer; explicit responsibility/non-responsibility, I/O, tool,
read/write, completion, delegation, and typical compute policies; canonical
`IAgentHandoff` assignment envelope; canonical `IAgentHandoffResult` return
envelope; strict structural/role-policy validators; explicit `amy.agent-roles`
capability and public Runtime exports.

Canonical interfaces/contracts: `TAgentRole`, `IAgentRoleDescriptor`,
`IAgentChildDelegationPolicy`, `IAgentHandoff`, `TAgentHandoffSource`,
`IAgentHandoffScope`, `IAgentHandoffInput`, `IAgentHandoffResult`,
`IAgentHandoffOutput`, `IAgentHandoffEvidence`, `IAgentRolesApi`, `AGENT_ROLES`,
`AGENT_ROLE_VERSIONS`, `listAgentRoles`, `getAgentRole`, `validateAgentHandoff`,
`validateAgentHandoffResult`, and `createAgentRolesCapability`.

Key architectural decisions: role and Compute Profile remain independent; domain
knowledge stays in skills; role definitions are deterministic data rather than
large prompts; Worker owns a subtask/result rather than a single command; only
Worker can delegate at this stage and only to Scout/Worker/Debugger with a
role-local cap of two; Verifier/Reviewer remain read-only; a role-local completed result is not
global completion; no executable agent adapter or provider-specific file format is
invented without repository evidence.

Verification results: Stage 7 source/tests are covered by TDD; final delivery runs
source/test typecheck, build, full runtime tests, generated/dist consistency,
reference/manifest checks, archive cleanliness, and architectural diff review.
`pnpm` itself is unavailable in the execution environment, so checks use the
existing global Node/TypeScript toolchain with temporary symlinks to installed
Node typings/TypeScript outside the project; these temporary `node_modules` links
are removed before packaging.

Technical debt: there is no execution adapter that maps logical roles to native
Codex/provider subagents; handoff results are structurally role-validated but are
not yet reconciled against their originating handoff as a lifecycle store; global
delegation depth, total child count, cancellation, and ownership across DAG nodes
belong to Stage 9; outcome-calibrated role policies do not exist yet.

Limits: Stage 7 defines contracts only. It does not choose strategy/roles, spawn or
schedule agents, create DAGs, perform parallelism, verify a task, retry failures,
or determine user-task completion.

Next stage should be Stage 8 — Strategy Router + Fast Path. It should consume Task
Analysis, Context Resolution, Compute Routing, and this role catalog to choose the
minimum-cost reliable execution strategy, while keeping trivial direct execution
as the preferred fast path and returning structured reason codes/confidence.
