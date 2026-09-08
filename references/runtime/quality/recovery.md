# Retry + Escalation Recovery Planner

Stage 12 adds a small deterministic recovery boundary after Stage 11 Completion.

## Verdict

`simplify`

Amy does not add an automatic retry loop, a second orchestrator, or a new agent
executor. The existing Completion guard already owns retry allowance; Context
Intelligence, Compute Routing, Agent Roles, and Verification already own their
respective mechanisms. Stage 12 therefore adds only failure diagnosis plus a
bounded recovery plan that points to those canonical mechanisms.

## Capability

`amy.recovery` is optional and independently registered. It has no required
capability dependencies and is not enabled by `createAmyRuntime()` by default.

Versions:

- capability: `1.0.0`;
- API schema: `1`;
- diagnosis schema: `1`;
- recovery plan schema: `1`;
- policy: `1`.

Public API:

```ts
interface IRecoveryApi {
  recover(value: unknown): Readonly<TRecoveryPlan>;
}
```

CLI access is explicit:

```text
node runtime/dist/cli.js recovery-plan --input <recovery-input.json> --project <path>
```

## Input boundary

`IRecoveryInput` consumes the canonical Stage 11 `TCompletionResult` plus one
explicit `IRecoveryFailureSignal` for exactly one failing branch. Recovery does
not infer a retry merely from `guard: retry`.

A failure signal must contain:

- one failure class;
- a branch id and branch kind;
- at least one concrete evidence reference;
- a compact summary;
- explicit `directRetryAllowed`, which says whether repeating that same branch is
  justified without a corrective mechanism.

Supported failure classes are:

- `implementation`;
- `context-understanding`;
- `architecture-uncertainty`;
- `tool`;
- `verification`;
- `integration`.

`preservedFacts` is optional evidence already established by previous attempts.
The planner carries those facts forward unchanged so a later attempt does not
need to rediscover them.

Stage 12 adds `validateCompletionResult()` as the canonical structural boundary
for a Completion result consumed downstream. It validates identity, status,
policy, guard counters, and the Completion Evidence identity without recomputing
Stage 11 completion semantics.

Stage 15 adds `validateRecoveryPlan()` as the corresponding canonical structural
boundary for downstream Recovery Plan consumers. Outcome Intelligence reuses it
instead of copying the Stage 12 plan schema. The validator checks contract identity
and supported structural fields without recomputing recovery policy decisions.

## Recovery actions

The mapping is deterministic and intentionally small:

| Failure class | Recovery action | Canonical owner of the actual mechanism |
| --- | --- | --- |
| implementation | `debugger` | Stage 7 Agent Roles / host agent execution |
| context-understanding | `context-expand` | Stage 5 Context Intelligence |
| architecture-uncertainty | `compute-escalate` | Stage 6 Compute Routing |
| tool | `retry` only when `directRetryAllowed`; otherwise `stop` | host tool execution |
| verification | direct `retry` when allowed, otherwise `debugger` | Stage 10 Verification Pipeline / Stage 7 Debugger |
| integration | direct `retry` when allowed, otherwise `debugger` | host integration workflow / Stage 7 Debugger |

A recovery plan never executes these mechanisms. It states what is justified for
the failing branch and leaves execution to the existing owner. Direct retry is
therefore never inferred from a failure class alone.

Every actionable recovery plan requires Verification again. This prevents a
successful retry or escalation from bypassing Stage 10/11 evidence.

## Budgets and stop behavior

Retry budget is not duplicated. Stage 12 consumes the Stage 11 Completion guard:

- `guard.decision === retry` is required for an actionable plan;
- `retryCount` and `maxRetries` remain canonical Stage 11 counters;
- the recovery plan exposes `nextRetryCount` for the host to carry into the next
  Completion attempt.

Compute escalation has its own small policy:

- default `maxEscalations`: `1`;
- hard cap: `3`.

If the Completion guard is terminal, the task is already complete, or the
escalation budget is exhausted, the recovery action is `stop`. Stage 12 never
converts a terminal Stage 11 result back into retry permission.

## Deliberate limits

Stage 12 does not add:

- automatic retry execution;
- backoff/timers;
- shell/tool execution;
- automatic Debugger invocation;
- automatic Context refresh;
- model/provider selection;
- a second Verification pipeline;
- persistent retry counters;
- telemetry or storage.

The host remains responsible for executing the selected mechanism, passing the
updated counters/facts forward, and producing new verification/completion
evidence.

# Stage Handoff

- **Stage:** 12 — Retry + Escalation.
- **Verdict:** `simplify`.
- **Implemented:** optional deterministic `amy.recovery`; concrete failure
  taxonomy; one-branch Recovery Diagnosis; deterministic action mapping;
  preserved facts; reuse of Stage 11 retry guard; independent bounded compute
  escalation budget; mandatory post-recovery Verification; explicit terminal
  stop behavior; `recovery-plan` CLI; public exports; downstream
  `validateCompletionResult()` structural boundary.
- **Canonical interfaces/contracts:** `IRecoveryApi`, `IRecoveryInput`,
  `IRecoveryFailureSignal`, `IRecoveryDiagnosis`, `IRecoveryFact`,
  `IRecoveryAttemptState`, `IRecoveryPlanData`, `TRecoveryPlan`,
  `TRecoveryFailureClass`, `TRecoveryAction`, `TRecoveryReasonCode`,
  `RECOVERY_VERSIONS`, `DEFAULT_RECOVERY_POLICY`, `RECOVERY_LIMITS`,
  `planRecovery()`, `validateRecoveryInput()`, `validateRecoveryPolicy()`, and
  `validateCompletionResult()`.
- **Key architecture decisions:** Recovery is a planner, not an executor; one
  concrete failure signal per call keeps recovery branch-scoped; Stage 11 owns
  retry allowance/counters; Stage 5/6/7/10 remain owners of context, compute,
  Debugger, and verification; every actionable plan requires re-verification;
  no default capability registration and no required optional dependencies.
- **Verification results:** production build and production/test typecheck passed;
  test compilation passed; full Runtime suite passed `133/133` across `18` suites;
  `runtime/dist` generated parity passed; package/manifest version parity is `2.11.0`;
  Markdown links resolved and all `16` existing skill directories remained intact. The
  environment did not provide `pnpm`, so the equivalent project commands were run
  directly with available Node `22.16.0` + TypeScript `5.8.3`/Node typings rather
  than through the package-manager wrapper.
- **Technical debt:** failure evidence references remain opaque and host-owned;
  retry/escalation counters are not persisted; the deterministic failure class
  is supplied by the host rather than inferred from arbitrary logs; Recovery
  does not verify that a host actually executed the selected canonical
  mechanism.
- **Limits:** no automatic retry loop, agent execution, context expansion,
  compute/model mutation, persistence, telemetry, or outcome analysis.
- **Next-stage constraints:** Stage 13 Observability must record Recovery
  diagnosis/action decisions as provenance without storing uncontrolled
  chain-of-thought; telemetry remains optional/fail-open; it should reuse
  Recovery reason codes, branch ids, evidence refs, and policy version rather
  than invent a second recovery taxonomy.
- **Expected next Roadmap v2 stage:** 13 — Observability + Decision Provenance.
