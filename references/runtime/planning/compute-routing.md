# Compute Profiles + Model/Reasoning Router

Stage 6 adds a small deterministic compute-routing layer. It translates task
signals into logical compute requirements without coupling orchestration to a
specific provider, model name, agent role, or prompt.

## Logical profiles

Canonical profile ladder:

```text
FAST → STANDARD → ADVANCED → DEEP → EXPERT
```

The ladder expresses required compute, not agent responsibility. Roles introduced
in later stages must remain independent from these profiles.

Initial task routing uses the existing validated Task Intelligence dimensions:

- clearly local, low-complexity work can use `FAST`;
- inconclusive ordinary work uses the configured default, `STANDARD` when unset;
- one or more high-cost/risk signals select `ADVANCED`;
- several simultaneous high signals or high-risk repository blast radius select
  `DEEP`;
- `EXPERT` is reserved for explicit requests or bounded escalation rather than
  being selected routinely.

The policy is categorical and explainable. It does not calculate synthetic
scores or token estimates.

## Configuration

Compute configuration is optional and additive to existing `.amy/config.json`:

```json
{
  "capabilities": {},
  "compute": {
    "defaultProfile": "STANDARD",
    "profiles": {
      "FAST": {
        "model": "fast-model",
        "reasoningEffort": "low",
        "fallbackModels": ["fast-backup"]
      },
      "ADVANCED": {
        "model": "advanced-model",
        "reasoningEffort": "high"
      }
    }
  },
  "schemaVersion": 1
}
```

`model` and `reasoningEffort` are opaque configurable strings. Amy does not ship
or require concrete model names. A profile with no mapping remains a valid
logical result and returns `assignment.status = "unmapped"`.

Configuration follows the existing precedence:

```text
defaults < global < project < overrides
```

Profile bindings merge by profile and field. A later `fallbackModels` value
replaces the earlier list. The effective merged binding requires a primary
`model` whenever `reasoningEffort` or `fallbackModels` are configured; individual
config layers may override those fields while inheriting the model from an
earlier layer.

## Routing contract

`routeCompute(input)` consumes a valid Stage 4 Task Analysis. Its output contains:

- selected logical `profile`;
- `assignment` status and optional concrete model/reasoning effort;
- structured `reasonCodes`;
- classifier confidence;
- target metadata (`task` or future `dag-node`).

A DAG node can be routed without importing a Stage 9 DAG contract by using:

```json
{
  "target": { "kind": "dag-node", "id": "node-id" },
  "taskAnalysis": {}
}
```

Later DAG code can provide node-specific Task Analysis or an explicit requested
profile without changing the Compute Routing contract.

## Upgrade, downgrade, fallback, unavailable models

Explicit recovery/cost-control transitions use `mode` plus `currentProfile`:

- `upgrade` moves one step upward;
- `downgrade` moves one step downward;
- boundaries are clamped to `FAST` / `EXPERT`.

For a mapped profile, the primary model is tried first, followed by configured
fallback models. `unavailableModels` is explicit runtime evidence supplied by the
caller; Compute Routing does not probe providers itself.

If every model for the required profile is unavailable, Amy searches only higher
profiles for a configured available model. It never silently downgrades required
compute. If the escalation ladder is exhausted, status is `unavailable`.

This keeps provider/tool availability outside the deterministic policy and leaves
retry strategy to later Reliability stages.

## CLI

```text
node runtime/dist/cli.js compute-route --input <compute-input.json> --project <path>
```

The CLI registers `amy.compute-routing` only for that explicit command and passes
the loaded runtime compute configuration into the capability. Existing default
Runtime capability registration is unchanged.

## Deliberate limits

Stage 6 does not:

- select agent roles;
- choose execution strategy;
- activate Scout/Worker/Verifier/Reviewer;
- create DAGs;
- call model providers or test model availability;
- use LLM routing;
- escalate because context is missing (more compute is not a substitute for
  missing evidence).

Those boundaries keep Stage 6 reusable by Stages 7–9.

## Stage 6 Handoff

Stage: 6 — Compute Profiles + Model/Reasoning Router.

Verdict: `simplify`.

Implemented: deterministic logical profiles `FAST / STANDARD / ADVANCED / DEEP /
EXPERT`; task-level and DAG-node-target routing; configurable default profile;
optional profile-to-model/reasoning bindings; ordered model fallback; explicit
upgrade/downgrade; bounded upward escalation on concrete model unavailability;
`unmapped` and `unavailable` graceful states; structured reason codes; layered
runtime compute configuration; explicit `compute-route` CLI command.

Canonical interfaces/contracts: `TComputeProfile`, `IComputeRoutingConfig`,
`IComputeProfileBinding`, `IComputeRoutingInput`, `IComputeRoutingDecision`,
`IComputeAssignment`, `IComputeTarget`, `IComputeRoutingApi`,
`COMPUTE_PROFILES`, `COMPUTE_ROUTING_VERSIONS`, `routeCompute`,
`validateComputeRoutingInput`, and `createComputeRoutingCapability`.

Key architectural decisions: Compute Profile and Agent Role are independent;
Task Analysis is the canonical routing evidence; no concrete model is mandatory;
model/reasoning strings are provider-opaque configuration; no provider probing is
performed; unavailable required compute may escalate upward but never silently
downgrade; `EXPERT` is not routine automatic compute; no scoring math, LLM router,
new orchestration prompt, or external dependency was added.

Verification results: source and test TypeScript compilation, build, runtime test
suite, generated/dist consistency, CLI routing, reference/manifest checks,
archive cleanliness, and architectural diff review are performed for Stage 6
delivery. `pnpm`/network-backed install and marketplace sync are unavailable in
the execution environment; local checks use the existing Node/TypeScript toolchain
and temporary external Node typings only.

Technical debt: model availability is caller-provided rather than discovered;
routing policy is intentionally categorical and not yet outcome-calibrated;
DAG-node routing reuses Task Analysis until Stage 9 introduces canonical node
contracts; model/provider capability metadata is intentionally absent.

Limits: Stage 6 does not select roles or execution strategy, inspect model
providers, run agents, decompose work, or perform retry/recovery. Context gaps are
not treated as a reason to spend more compute automatically.

Next stage should be Stage 7 — Agent Roles + Handoff Contract. It should define a
small universal role set and handoff schema while consuming Compute Profiles only
as an independent recommendation/default, never encoding roles as model aliases.
