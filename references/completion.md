# Completion Protocol + Stop Guards

Stage 11 adds a small deterministic completion boundary on top of the Stage 10
Verification Pipeline.

## Verdict

`simplify`

The existing Task Analysis and `quality-result` contracts already contain the
semantic and mechanical verification state required by completion. Amy therefore
does not add another verification pipeline, shell runner, orchestration envelope,
or retry engine. Stage 11 only compiles completion evidence and evaluates bounded
stop guards.

## Capability

`amy.completion` is optional and independently registered. It has no capability
dependencies and is not enabled by `createAmyRuntime()` by default.

Versions:

- capability: `1.0.0`;
- API schema: `1`;
- Completion Evidence schema: `1`;
- policy: `1`;
- result schema: `1`.

The public API is intentionally small:

```ts
interface ICompletionApi {
  complete(value: unknown): Readonly<TCompletionResult>;
}
```

CLI access is explicit:

```text
node runtime/dist/cli.js completion-evaluate --input <completion-input.json> --project <path>
```

The CLI registers the capability only for that command. Existing default runtime
behavior is unchanged.

## Inputs

`ICompletionInput` consumes canonical upstream data instead of reconstructing it:

- `completionId`;
- Stage 4 `TTaskIntelligenceAnalysis`;
- Stage 10 `TVerificationResult`;
- explicit execution evidence;
- explicit integration evidence;
- optional guard retry counters.

Execution and integration evidence are supplied by the host workflow because Amy
Runtime does not own command execution, writes, or integration. A `completed`
execution requires at least one evidence reference. Completed/failed integration
also requires concrete evidence; `not-required` must be explicit and explained.

The Completion validator also structurally validates the upstream Stage 10 result.
It does not recompute the Verification Pipeline decision, so Stage 10 remains the
single owner of verification semantics.

## Completion Evidence

The output deliberately reuses canonical `quality-result` rather than adding a
new pipeline contract kind. `ICompletionEvidence` records:

- requirements and acceptance criteria;
- mechanical checks already evaluated by Stage 10;
- skipped/unavailable checks and their existing reasons;
- execution evidence;
- integration evidence;
- Verification status, reason codes, and id;
- unresolved issues;
- explicit evidence gaps.

When optional task requirements or acceptance criteria are absent or empty, the
Task Contract `goal` is used as the minimum evidence baseline. Stage 11 never
silently treats an empty optional list as proof that nothing must be completed.

## Status semantics

Final completion status is one of:

- `complete` — execution completed, integration completed or not required,
  Verification passed, and no unresolved issue remains;
- `failed` — execution, integration, or Verification explicitly failed;
- `incomplete` — work/integration is incomplete, required verification/review is
  still pending, or explicit unresolved issues remain;
- `unverified` — execution, integration, or Verification has an evidence gap.

Precedence is conservative: `failed` → `unverified` → `incomplete` → `complete`.
This preserves the Stage 11 rule that failure to verify is not success.

`confidence` describes confidence in the completion determination, not confidence
that the implementation is good: `unverified` is low, `incomplete` is medium,
and explicit complete/failed determinations are high.

## Stop guards

The guard is declarative. It can return:

- `complete`;
- `retry`;
- `stop-failed`;
- `stop-incomplete`;
- `stop-unverified`.

Default retry allowance is `2`; the hard loop-protection cap is `5`. A result is
eligible for `retry` only while `retryCount < maxRetries`. Exhaustion produces an
explicit stop state instead of pretending completion.

A `retry` decision is permission to enter Stage 12 diagnosis, not an instruction
to repeat work. Stage 11 does not choose Debugger, expand context, escalate
compute, rerun tools, or mutate the task.

## Deliberate limits

Stage 11 does not add:

- blind or automatic retry;
- failure diagnosis or recovery strategy;
- compute escalation;
- agent execution;
- persistence/telemetry;
- outcome analytics;
- a second semantic verifier;
- a second command runner.

The host must still provide truthful execution/integration evidence and concrete
artifact references.

# Stage Handoff

- **Stage:** 11 — Evidence-Based Completion + Stop Guards.
- **Verdict:** `simplify`.
- **Implemented:** optional deterministic `amy.completion`; Completion Evidence;
  conservative completion status; explicit `unverified`/legitimate incomplete;
  bounded stop/retry guards; structural validation of upstream Verification
  results; `completion-evaluate` CLI; tests and public exports.
- **Canonical interfaces/contracts:** `ICompletionApi`, `ICompletionInput`,
  `ICompletionEvidence`, `ICompletionGuardResult`, `ICompletionResultData`,
  `TCompletionResult`, `TCompletionStatus`, `TCompletionGuardDecision`,
  `COMPLETION_VERSIONS`, `DEFAULT_COMPLETION_POLICY`, and
  `validateVerificationResult()` as the canonical structural boundary for a
  Stage 10 result consumed downstream.
- **Key architecture decisions:** reuse `quality-result`; never rerun Stage 10
  checks; host-owned execution/integration evidence; guard is declarative only;
  no default capability registration; retry budget is bounded and cannot trigger
  agent/runtime work by itself.
- **Verification results:** TypeScript typecheck passed; build passed; 125/125 runtime
  tests passed across 17 suites; generated `runtime/dist` matched TypeScript sources;
  manifest/package version matched at `2.10.0`; 16/16 skill directories contain
  `SKILL.md`; 79 local Markdown links resolved. The repository-pinned pnpm/TypeScript
  versions could not be installed because registry/network access is unavailable in
  this environment, so checks used the available local Node 22.16.0 toolchain with
  TypeScript 5.8.3 and compatible Node typings.
- **Technical debt:** Runtime cannot independently prove host execution/integration
  evidence truthfulness; Verification artifact references remain opaque; no
  persistence of guard counters; structural verification-result validation does
  not duplicate/recompute Stage 10 semantics.
- **Limits:** no recovery, Debugger routing, context expansion, compute escalation,
  telemetry, storage, or automatic loop execution in this stage.
- **Next-stage constraints:** Stage 12 must diagnose a concrete failure before any
  retry/escalation, consume existing Completion/Verification evidence, preserve
  facts between attempts, apply recovery only to the failing branch, and enforce
  a bounded recovery budget. It must not reinterpret `guard: retry` as blind
  repetition.
- **Expected next Roadmap v2 stage:** 12 — Retry + Escalation.
