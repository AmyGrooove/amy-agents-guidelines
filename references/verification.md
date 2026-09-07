# Verification Pipeline

Stage 10 adds a bounded deterministic quality layer after execution. It evaluates
mechanical evidence, turns Stage 8 Verifier/Reviewer routing decisions into
canonical Stage 7 read-only handoffs, and evaluates returned semantic/review
evidence without claiming global task completion.

## Canonical flow

```text
Task Analysis
+ Strategy Decision
+ implementation/artifact refs
+ mechanical check evidence
+ optional Verifier/Reviewer reports
↓
amy.verification
↓
quality-result
  mechanical status
  semantic verification status + optional verifier handoff
  conditional review status + optional reviewer handoff
  structured reason codes
```

The capability is explicit and optional. It is not registered by default.

## Mechanical verification

Runtime does not add a shell/process executor. Existing Codex/project permission
and command workflows remain responsible for actually running tests, typecheck,
lint, build, or another project command. Stage 10 receives the resulting evidence
as `IMechanicalVerificationCheck` records and evaluates it deterministically.

Canonical kinds are:

- `test`;
- `typecheck`;
- `lint`;
- `build`;
- `project-command`.

A passed or failed check requires evidence. `skipped` and `unavailable` require an explicit
reason. A failed check makes mechanical verification `failed`; skipped/unavailable
checks make it `unverified`. If the Task Contract asks for verification but no
mechanical evidence is supplied, the result is also `unverified`.

This preserves the rule that missing verification is not success without
introducing a second command runner or duplicating existing permissions.

## Semantic verification

Semantic verification is activated only when the canonical Stage 8 Strategy
Decision contains `verification: "verifier"`.

Stage 10 then creates a canonical read-only `IAgentHandoff` for the Stage 7
Verifier with references to:

- Task Analysis;
- implementation result;
- mechanical verification evidence;
- optional Context Packet, which can carry relevant specs and invariants.

The Stage 7 Verifier role descriptor therefore accepts `context-packet` as an
additional backward-compatible input. `amy.agent-roles` is bumped to `1.1.0`; the
handoff/result schemas remain version 1.

`IVerifierReport` wraps a canonical Verifier handoff result and criterion-level
evidence. Every explicit Task Contract requirement and acceptance criterion must
be represented. If neither exists, the task goal is the fallback semantic
subject. `not-met` produces `failed`; missing or `unknown` evidence produces
`unverified`; a Verifier execution failure is also `unverified`, not proof that
the implementation is wrong.

## Conditional review

Reviewer activation remains owned by Strategy Routing. Stage 10 creates a Reviewer
handoff only when the Strategy Decision contains `review: "reviewer"`.

`IReviewerReport` carries bounded findings with severity:

- `required` — quality failure that must be resolved before later completion;
- `advisory` — maintainability observation that does not fail verification by
  itself.

A missing or failed Reviewer execution is `pending`/`unverified`; Reviewer is not
a mandatory gate for tasks where Stage 8 did not route it.

## Quality status

The Stage 10 result uses the shared `quality-result` envelope and one of:

- `passed`;
- `failed`;
- `pending`;
- `unverified`.

This is the status of the verification pipeline, not the final user-task completion
status. Stage 11 owns Completion Evidence and Stop Guards.

## Runtime API and CLI

Stage 10 exports:

- `VERIFICATION_VERSIONS`;
- mechanical check/result contracts;
- Verifier criterion/report contracts;
- Reviewer finding/report contracts;
- `IVerificationInput`;
- `TVerificationResult`;
- `validateVerificationInput()`;
- `runVerificationPipeline()`;
- `IVerificationApi`;
- `createVerificationCapability()`.

Explicit CLI usage:

```text
node runtime/dist/cli.js verification-evaluate --input <verification-input.json> --project <path>
```

The optional capability id is `amy.verification` version `1.0.0`.

## Deliberate limits

Stage 10 does not:

- run shell commands or bypass existing permissions;
- spawn Verifier/Reviewer agents;
- make Reviewer mandatory;
- mutate production code;
- retry failed work or escalate compute;
- determine final task completion;
- persist verification history;
- store uncontrolled chain-of-thought.

## Stage 10 Handoff

Stage: 10 — Verification Pipeline.

Verdict: `simplify`.

Implemented: optional deterministic `amy.verification` capability; canonical
mechanical evidence records for test/typecheck/lint/build/project commands;
explicit `passed`/`failed`/`pending`/`unverified` quality states; deterministic
Verifier and conditional Reviewer activation from Stage 8 routing; canonical
Stage 7 read-only handoffs; criterion-level semantic verification covering Task
Contract requirements/acceptance criteria; bounded Reviewer findings with
required/advisory severity; explicit verification CLI; public Runtime exports;
Verifier Context Packet compatibility; plugin minor version bump to `2.9.0`.

Canonical interfaces/contracts: `VERIFICATION_VERSIONS`,
`TMechanicalCheckKind`, `TMechanicalCheckStatus`, `IMechanicalVerificationCheck`,
`TVerificationStageStatus`, `TVerificationStatus`,
`TVerificationCriterionKind`, `TVerificationCriterionStatus`,
`IVerifierCriterionResult`, `IVerifierReport`, `TReviewFindingSeverity`,
`IReviewFinding`, `IReviewerReport`, `IVerificationArtifactRefs`,
`IVerificationInput`, `IMechanicalVerificationResult`,
`ISemanticVerificationResult`, `IReviewVerificationResult`,
`IVerificationResultData`, `TVerificationResult`, `IVerificationApi`,
`validateVerificationInput`, `runVerificationPipeline`, and
`createVerificationCapability`. Stage 7 `IAgentHandoff`/`IAgentHandoffResult`
remain canonical agent boundaries.

Key architectural decisions: no duplicate shell/permission subsystem; mechanical
command execution remains external and only evidence enters Runtime; Verifier and
Reviewer remain roles selected by Stage 8 rather than a mandatory quality
pipeline; semantic verification is evidence-based and never treats missing agent
execution as success; Reviewer required findings fail quality while advisory
findings do not; Stage 10 returns `quality-result` only and does not pre-implement
Stage 11 completion guards; optional Context Packet reuse is an additive Stage 7
role capability change rather than a new spec transport abstraction.

Verification results: fresh source typecheck, clean build, test typecheck/compile,
full Runtime tests (`114/114`, 16 suites, 0 failures), and generated/dist
consistency all passed. Package/plugin versions are both `2.9.0`; all 16 skill
directories contain `SKILL.md`; 77 local Markdown links resolve; inventory and
`verification-evaluate` CLI smokes passed. The architectural diff was reviewed
for Stage 10 scope only, and the final archive is checked separately for
generated/temp content before delivery. `pnpm` and local Windows marketplace
reinstall/sync are unavailable in this sandbox; the checks above used the
available Node 22 / TypeScript toolchain.

Technical debt: Runtime does not execute mechanical checks itself, so hosts must
supply truthful evidence; semantic/review agents still need a provider/executor;
criterion matching intentionally uses exact canonical Task Contract text rather
than semantic equivalence; verification artifacts are referenced by opaque refs
without persistence; Stage 11 must formalize completion evidence, required/skipped
check policy, retry guard counts, and final `unverified` handling.

Limits: `quality-result: passed` means the supplied Stage 10 evidence has no known
verification failure or gap. It is not global completion. Pending handoffs are
instructions for an external agent executor, not proof that an agent ran.

Next stage should be Stage 11 — Evidence-Based Completion + Stop Guards. It should
consume Stage 10 `TVerificationResult` plus execution/integration evidence, make
missing verification gaps explicit, add bounded stop/retry guards and a legitimate
`unverified`/incomplete outcome, without duplicating Stage 10 checking logic.
