# Controlled Evolution

Stage 19 adds the independent optional `amy.evolution` capability. Its purpose is
not to edit Amy automatically. It provides deterministic, versioned boundaries for
turning measured evidence into non-causal improvement proposals, comparing shadow
routing decisions, and recording an explicit user decision.

The production rule is strict:

```text
data
→ observation
→ hypothesis
→ proposed change
→ eval
→ counterfactual / shadow evidence
→ recommendation
→ explicit user decision
```

No API in this capability applies a proposal, rewrites a skill, changes routing,
or executes an alternative strategy.

## Architecture

Stage 19 reuses the existing canonical subsystems instead of creating another
analytics, eval, router, or persistence layer:

- Stage 18 Analytics remains the source of comparable mechanism/routing health
  evidence;
- Stage 16 Eval remains the source of same-corpus baseline/candidate regression
  evidence;
- Stage 8 Strategy Routing remains the production routing contract;
- Observability/Data Storage remain optional host-owned destinations for the
  versioned Stage 19 artifacts.

`amy.evolution` is not registered by default and declares no Runtime capability
dependencies. A host may use the functions directly or register the capability
explicitly. Missing Analytics/Eval/Storage registrations therefore do not make the
Runtime unavailable.

## Counterfactual analysis

`analyzeCounterfactuals()` accepts an `ICounterfactualAnalysisInput` containing a
canonical Analytics input. It calls the existing Stage 18 health engine and inspects
only routing choices already grouped into comparable cohorts:

```text
task archetype
+ scope
+ complexity
+ risk
+ Strategy policy version
```

A bounded overkill hypothesis is produced only when both observed choices have at
least five samples, both have measured reliability and a common measured cost
signal, the alternative is at least 20% cheaper, and its observed success/failure
rates stay within a 5 percentage-point reliability tolerance.

Cost evidence is selected deterministically in this order when available for both
choices:

1. cost units;
2. tokens;
3. duration.

The supported dimensions are compute profile, context items, execution,
reasoning effort, Reviewer, Scout, and worker count. Verifier is deliberately
excluded from automatic overkill hypotheses because cheaper verification is not a
sufficient reason to weaken correctness checks. Stage 18 does not expose escalation
as a comparable routing-choice dimension, so Stage 19 does not invent escalation
evidence from aggregate retry data.

Every `ICounterfactualAnalysis` and `ICounterfactualHypothesis` contains
`causalClaim: false`. A hypothesis means "worth testing", never "this policy caused
the observed result".

## Shadow strategy comparison

Stage 19 deliberately does **not** add a second Strategy Router. Stage 8 currently
owns the canonical deterministic production router and does not expose a generic
experimental policy engine. Duplicating that logic in Evolution would create two
routing authorities.

Instead, `compareShadowStrategy()` accepts:

- a validated production `TStrategyRoutingDecision`;
- a host-produced candidate `TStrategyRoutingDecision`;
- an opaque candidate reference;
- bounded evidence refs.

It returns a versioned `IShadowStrategyComparison` containing only categorical
strategy differences. The contract hard-codes:

```text
executionPerformed = false
productionMutation = false
causalClaim = false
```

A host can log this artifact through existing Observability/Storage if desired.
The candidate is never executed by Evolution.

## Improvement proposals

`createImprovementProposal()` validates a bounded structured proposal containing:

- observation;
- evidence refs;
- sample size;
- hypothesis;
- proposed change;
- target;
- expected benefit;
- risks;
- confidence;
- optional counterfactual analysis;
- optional shadow comparison;
- optional canonical Eval comparison result.

Supported targets are:

- skill;
- routing;
- context policy;
- agent;
- verification;
- compute profile;
- Project Intelligence.

The proposal policy is intentionally conservative:

- fewer than five samples, `low`, or `insufficient` confidence →
  `collect-more-evidence`;
- no Eval comparison → `run-eval`;
- incomplete/inconclusive Eval → `collect-more-evidence`;
- any regressed Eval case or baseline winner → `do-not-adopt`;
- completed candidate/tie with no regressed cases → `request-user-decision`.

A tied Eval can still reach user decision because the expected benefit may be cost
rather than a higher correctness score. This is a recommendation gate, not automatic
policy selection.

All `IImprovementProposal` values contain:

```text
causalClaim = false
automaticApplication = false
userDecisionRequired = true
```

Stage 19 also adds `validateEvalComparisonResult()` to the existing Eval subsystem
so Evolution does not trust forged comparison aggregates. The validator checks the
baseline/candidate runs, requires completed comparisons to cover the same case ids,
recomputes per-case improvement/regression ids and score delta, and verifies completion
state plus winner consistency. `validateImprovementProposal()` also recomputes the
recommendation from the validated proposal evidence so a downstream consumer cannot
forge a safer recommendation after proposal creation.

## Explicit user decision

`recordImprovementDecision()` accepts only `decidedBy: "user"` and returns a
versioned `IImprovementDecision` for `approved`, `rejected`, or `deferred`.

An approved decision is evidence that a user chose the proposal. It is **not** an
apply command. There is intentionally no `applyImprovementProposal()` API.

## Canonical API

`IEvolutionApi` exposes only:

```text
analyzeCounterfactuals(value)
compareShadowStrategy(value)
createProposal(value)
recordDecision(value)
```

Canonical contracts include:

- `ICounterfactualAnalysisInput`;
- `ICounterfactualAnalysis`;
- `ICounterfactualHypothesis`;
- `IShadowStrategyInput`;
- `IShadowStrategyComparison`;
- `IShadowStrategyDifference`;
- `IImprovementProposalInput`;
- `IImprovementProposal`;
- `IImprovementDecisionInput`;
- `IImprovementDecision`;
- `EVOLUTION_VERSIONS`;
- `EVOLUTION_LIMITS`.

## Deliberate limits

Stage 19 does not add:

- automatic production routing or compute changes;
- automatic skill/agent/project-instruction rewriting;
- an apply/mutation API;
- alternative task execution from Shadow Routing;
- a second Strategy Router;
- an LLM proposal generator;
- causal inference;
- automatic persistence or background analysis;
- CLI/dashboard commands;
- automatic escalation-overkill inference without a canonical Stage 18 choice
  dimension.

# Stage Handoff

- **Stage:** 19 — Controlled Evolution.
- **Verdict:** `implement`, with Shadow Router deliberately simplified to a
  validation/comparison boundary so Stage 8 remains the single routing authority.
- **Implemented:** optional `amy.evolution`; deterministic counterfactual overkill
  hypotheses over Stage 18 comparable routing cohorts; bounded cost/reliability
  policy; non-causal Improvement Proposal contracts and recommendation gates;
  canonical Eval comparison-result validation; safe shadow production/candidate
  strategy comparison with hard `executionPerformed=false` and
  `productionMutation=false`; explicit user decision receipts; Runtime exports,
  tests, docs, plugin version `2.18.0`.
- **Canonical interfaces/contracts:** `IEvolutionApi`,
  `ICounterfactualAnalysisInput`, `ICounterfactualAnalysis`,
  `ICounterfactualHypothesis`, `IShadowStrategyInput`,
  `IShadowStrategyComparison`, `IImprovementProposalInput`,
  `IImprovementProposal`, `IImprovementDecisionInput`,
  `IImprovementDecision`, `EVOLUTION_VERSIONS`, `EVOLUTION_LIMITS`,
  `analyzeCounterfactuals()`, `compareShadowStrategy()`,
  `createImprovementProposal()`, `recordImprovementDecision()`,
  `validateEvalComparisonResult()`.
- **Key architecture decisions:** Evolution is optional and not default-registered;
  no capability dependency on Analytics/Eval/Storage is required at Runtime startup;
  counterfactual analysis reuses the Stage 18 health engine; Eval evidence is
  structurally and mathematically validated; Stage 8 remains the only canonical
  router; candidate routing is host-produced and comparison-only; proposals are
  recommendations, never mutations; only an explicit `decidedBy: user` receipt can
  close the decision step; approval still does not auto-apply anything.
- **Verification results:** Stage 19 focused RED was observed before implementation;
  the final focused suite passed `9/9`; production/test typecheck and build succeeded;
  the full Runtime suite passed `181/181` tests across `24/24` suites; generated
  output matched TypeScript sources; CLI `inventory`/`status` smoke passed;
  package/manifest JSON and `2.18.0` version parity passed; `94` local Markdown links
  were checked with zero broken links. Exact `pnpm check` was unavailable because
  `pnpm` and installed project dependencies are not shipped in the source archive;
  the checks used Node `22.16.0`, TypeScript `5.8.3`, and available Node types `25.1.0`.
- **Technical debt:** Stage 18 routing cohorts do not expose escalation as a choice,
  so unnecessary escalation is not inferred; counterfactual thresholds are simple
  deterministic heuristics rather than statistical intervals; candidate shadow
  strategies are host-produced because Strategy Routing has no experimental policy
  port; proposal wording remains host/agent-provided structured input rather than an
  LLM generator; there is no task-to-Eval mechanism attribution beyond existing
  evidence refs.
- **Limits:** no silent self-modification, no apply API, no shadow execution, no
  automatic policy edits, no causal claims, no mandatory persistence, no CLI.
- **Next-stage constraints:** Stage 20 Amy Operations should expose useful existing
  capabilities through the smallest CLI/script surface possible. `amy doctor` is
  the strongest candidate; `stats/analyze/eval` should reuse current Analytics,
  Evolution, and Eval APIs rather than creating service layers. Operations must not
  turn optional Analytics/Eval/Evolution/Storage into required Runtime dependencies.
- **Expected next Roadmap v2 stage:** 20 — Amy Operations.
