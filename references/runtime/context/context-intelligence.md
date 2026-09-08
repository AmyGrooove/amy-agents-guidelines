# Amy Context Intelligence

Context Intelligence turns a canonical Stage 4 Task Analysis plus already available Project Intelligence into the smallest deterministic Context Packet Amy can justify. It is an explicit optional Runtime capability: it selects context and recommends exploration, but never scans the repository, starts Scout, refreshes specs, or chooses execution strategy by itself.

## Pipeline boundary

```text
Task Contract + Classification
            ↓
optional Project Intelligence knowledge / freshness / graph impact
            ↓
Context Resolver → Context Budget → Context Compiler
            ↓
context-selection { packet, resolution }
```

Stage 5 reuses the Stage 1 `TContextSelection` pipeline envelope. It does not introduce a second project graph, semantic index, vector store, or persistent context database.

`createContextIntelligenceCapability({ projectIntelligence? })` creates `amy.context-intelligence@1.0.0`. Project Intelligence is declared as an optional capability dependency. If its API or persisted knowledge is unavailable, Context Intelligence degrades to an explicit `source-read` or `scout` recommendation rather than failing an unrelated Runtime path.

## Canonical input

`resolve(value)` accepts only:

```json
{
  "taskAnalysis": {
    "kind": "task-analysis",
    "schemaVersion": 1,
    "data": {
      "contract": { "kind": "task-contract", "schemaVersion": 1, "goal": "..." },
      "classification": { "schemaVersion": 1 }
    }
  },
  "budgetProfile": "small"
}
```

`taskAnalysis` must be a valid `TTaskIntelligenceAnalysis`. Stage 5 therefore adds the public `validateTaskIntelligenceAnalysis(value)` validator to the existing Task Intelligence boundary. `budgetProfile` is optional and can be `small`, `standard`, or `large`.

## Context Packet

Packet schema version `1` contains only evidence selected for the current task:

- task goal, requirements, non-goals, constraints, and acceptance criteria;
- selected primary modules and their freshness/graph state;
- trusted module spec fragments;
- trusted architecture decisions and invariants when architecture contributes semantic context;
- direct dependencies and canonical examples;
- likely affected files and verification evidence.

Trusted semantic specs can satisfy a module-level context request without reading source. Stale or unknown semantic owners are never copied into the semantic spec portion of the packet; Runtime instead returns targeted `sourceReads` and an explicit freshness evidence gap.

Explicit file targets remain source-of-truth requests even when they map to a trusted module, so they produce `source-read`. A known file target that is not mapped to a module does not by itself justify Scout. Unresolved semantic module targets do.

## Resolution metadata

`IContextResolution` records:

- `confidence`: `low`, `medium`, or `high`;
- `exploration`: `none`, `source-read`, or `scout`;
- structured `reasonCodes`;
- explicit `evidenceGaps`;
- ordered, bounded `sourceReads`;
- the chosen context budget and actual usage.

Important reason codes include `trusted-spec-sufficient`, `source-confirmation-required`, `scout-recommended`, freshness/graph reasons, target-match reasons, and `budget-truncated`.

`exploration` is a recommendation, not an execution command. Stage 5 does not create or invoke a Scout role. Later Strategy/Agent stages may consume this signal.

## Context budget

The deterministic baseline is deliberately simple:

| Profile | Files | Modules | Semantic spec items |
| --- | ---: | ---: | ---: |
| `small` | 4 | 1 | 12 |
| `standard` | 8 | 3 | 30 |
| `large` | 16 | 6 | 60 |

Without an explicit override, `classification.dimensions.expectedContextCost` maps `low → small`, `high → large`, and every other value to `standard`.

The budget is an item-count guard, not a token estimator. `maxSpecItems` is the shared semantic-item budget for trusted architecture decisions/invariants plus selected module-spec fields; items are truncated deterministically and the resolution reports `budget-truncated`. File/module limits are also enforced before returning the packet.

## Project Intelligence usage

Context Intelligence only uses existing canonical Project Intelligence APIs:

- `loadKnowledge()`;
- targeted `assessFreshness(owners)`;
- targeted `analyzeImpact(moduleId)`;
- `loadGraph()` only when validating an in-memory cache hit.

It never calls `discover()`, `rebuildGraph()`, `refreshFreshness()`, `saveKnowledge()`, or `saveGraph()` during resolution.

Architecture freshness is assessed only if architecture knowledge would actually contribute decisions or invariants to the packet. This avoids turning an empty architecture artifact into unnecessary source exploration.

Graph impact supplies direct tests, owned sources, dependencies, and canonical examples. Stage 5 deliberately does not perform transitive dependency traversal or automatically pull supporting module specs into context.

## Exploration cache

`MemoryContextExplorationCache` is a lightweight optional in-process cache. A cached no-exploration result is eligible only when:

1. the currently relevant freshness owners are still `trusted`;
2. a graph exists;
3. the graph `knowledgeFingerprint` matches the current canonical knowledge;
4. the cache key matches the validated Task Analysis, knowledge, and graph.

Freshness is reassessed before every cache hit. The cache is an optimization only and is never authoritative. It is intentionally non-persistent; persistent cache/storage belongs to later roadmap stages only if needed.

## Runtime and CLI

Canonical public Stage 5 interfaces are:

- `IContextIntelligenceApi`;
- `IContextResolutionInput`;
- `IContextPacket`;
- `IContextResolution`;
- `IContextModuleSelection`;
- `IContextSpecSelection`;
- `IContextBudgetSummary` and related budget types;
- `TContextIntelligenceSelection`;
- `IContextExplorationCache` and `MemoryContextExplorationCache`;
- `CONTEXT_INTELLIGENCE_VERSIONS`;
- `validateContextResolutionInput(value)`;
- `resolveTaskContext(value, options?)`;
- `createContextIntelligenceCapability(options?)`.

`CONTEXT_INTELLIGENCE_VERSIONS` is `{ api: 1, packetSchema: 1, resolutionSchema: 1 }`.

CLI access is explicit:

```text
node <amy-plugin-root>/runtime/dist/cli.js context-resolve \
  --input <context-input.json> \
  --project <project-root>
```

The CLI wires one Project Intelligence instance into Context Intelligence for that invocation. It does not persist or refresh project knowledge automatically.

## Semantic skill boundary

The `resolve-task-context` skill consumes the deterministic resolution and decides how to use its evidence in an agentic workflow. It must:

- use the packet directly when `exploration: "none"`;
- read only the listed `sourceReads` first when `exploration: "source-read"`;
- treat `exploration: "scout"` as a recommendation to the later orchestration layer, not as automatic delegation;
- prefer source code when freshness is stale or unknown;
- avoid broad repository exploration merely because classification confidence is low.

## Stage 5 Handoff

Stage: 5 — Context Intelligence.

Verdict: `simplify`.

Implemented: a deterministic Context Resolver, Context Compiler, categorical Context Budget Manager, bounded Context Packet, freshness-aware stale handling, direct Project Graph impact consumption, safe fallbacks when Project Intelligence is absent, a validated in-memory Exploration Cache, explicit `context-resolve` CLI access, downstream Task Analysis validation, and the `resolve-task-context` semantic workflow skill.

Canonical interfaces/contracts: existing `TContextSelection` remains the pipeline envelope; Stage 5 adds `IContextIntelligenceApi`, `IContextResolutionInput`, `IContextPacket`, `IContextResolution`, `IContextModuleSelection`, `IContextSpecSelection`, `IContextBudgetSummary`, `TContextIntelligenceSelection`, `IContextExplorationCache`, `MemoryContextExplorationCache`, `CONTEXT_INTELLIGENCE_VERSIONS`, `validateContextResolutionInput`, `resolveTaskContext`, and `createContextIntelligenceCapability`. `validateTaskIntelligenceAnalysis` is the additive Stage 4 downstream validator.

Key architectural decisions: Project Intelligence remains optional; source and semantic knowledge stay separate; only trusted semantic fragments enter the packet; explicit source targets keep source-of-truth priority; graph impact is direct and bounded; Context Intelligence recommends but never runs Scout; budgets use deterministic category/item limits rather than false token precision; cache is in-memory, freshness-gated, graph-fingerprint-gated, and fail-safe; no new graph, database, embeddings, vector index, LLM resolver, repository-wide scan, or giant orchestration prompt was added.

Verification results: fresh source/test typecheck passed; build passed; 67/67 runtime tests passed; `runtime/dist` matches TypeScript sources. Manifest/skills/reference validation, architectural diff review, and final archive cleanliness/structure checks are completed during Stage 5 delivery. The environment has no `pnpm` binary or configured local marketplace/install validator, so equivalent local TypeScript/Node checks were used and install/sync verification was unavailable.

Technical debt: budget limits are item counts rather than measured token budgets; semantic relevance is exact module/path matching rather than fuzzy retrieval; direct graph impact does not auto-select supporting module specs; the cache is process-local and intentionally has no persistence/eviction policy beyond process lifetime.

Limits: Stage 5 does not read source contents, semantically discover unknown modules, activate Scout, choose compute/model/roles/strategy, decompose tasks, or persist context history. `source-read`/`scout` are explicit recommendations for later execution layers.

Next stage should be Stage 6 — Compute Profiles + Model/Reasoning Router. It should consume Task Classification (and, where useful, Context Resolution confidence/evidence gaps) without coupling ROLE to COMPUTE PROFILE and without making any concrete model mandatory.
