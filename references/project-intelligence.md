# Amy Project Intelligence

Project Intelligence is an explicit Runtime capability plus a semantic skill. It caches evidence-backed project understanding while source code remains authoritative.

## Canonical artifacts

Artifacts live inside the target repository:

```text
.amy/project-intelligence/
├── index.json
├── project.json
├── architecture.json
└── modules/<module-id>.json
```

All artifacts use JSON schema version `1`. `index.json` is the stable entry point and deterministically lists module specs. There are no timestamps, fingerprints, freshness data, graph edges, or external storage in Stage 2.

`project.json` may contain `purpose`, `technologies`, `modules`, `constraints`, `sourceOfTruth`, `entryPoints`, and `verification`. `architecture.json` may contain `components`, `boundaries`, `dependencyDirection`, `dataFlows`, `invariants`, `extensionModel`, and `decisions`.

A module spec requires `id`, `sourceLocations`, and a positive `specWorthy` decision. Optional semantic fields are `purpose`, `responsibilities`, `nonResponsibilities`, `invariants`, `publicContracts`, `dependencies`, `consumers`, `dataFlow`, `extensionPoints`, `decisions`, `testing`, `examples`, and `sourceOfTruth`. Unknown information is omitted. Negative decisions are valid transient classification results but are not persisted as module specs.

## Spec-worthy decisions

The decision contract is:

```json
{
  "isSpecWorthy": true,
  "reasons": ["public-api", "architectural-role"],
  "confidence": "high"
}
```

Canonical reasons are `domain-responsibility`, `public-api`, `critical-invariants`, `many-consumers`, `nontrivial-data-flow`, `architectural-role`, `hard-to-recover`, `reused`, and `high-change-risk`. Confidence is `low`, `medium`, or `high`; it expresses evidence quality, not a numeric score.

## Runtime boundary

`createProjectIntelligenceCapability(projectRoot)` creates `amy.project-intelligence@1.0.0`. It is never registered by `createAmyRuntime` automatically. Its API is:

- `discover()` — resolve the project root and collect cheap deterministic evidence and module candidates;
- `loadKnowledge()` and `saveKnowledge(value)` — validate and load or persist canonical artifacts;
- `listModules()` and `getModule(id)` — query the semantic module index;
- `resolveSourceLocations(id?)` — resolve validated project-relative source locations;
- `syncAgentsRouter()` — create or update only Amy's managed root `AGENTS.md` block.

The independent `PROJECT_INTELLIGENCE_VERSIONS` contract is `{ api: 1, artifactSchema: 1 }`. Runtime API, capability, configuration, event, and state versions remain unchanged.

Explicit CLI commands register the capability only for that invocation:

```text
node <amy-plugin-root>/runtime/dist/cli.js intelligence-discover --project <path>
node <amy-plugin-root>/runtime/dist/cli.js intelligence-save --project <path> --input <knowledge.json>
node <amy-plugin-root>/runtime/dist/cli.js intelligence-show --project <path>
node <amy-plugin-root>/runtime/dist/cli.js intelligence-sync-router --project <path>
```

## Deterministic and semantic responsibilities

Runtime owns root and candidate discovery, path normalization, schemas, validation, deterministic ordering, persistence, lookup, and safe routing. Candidate discovery uses structure, manifests, workspace boundaries, public indexes, and framework module filenames; a candidate is not a logical module.

The `maintain-project-intelligence` skill owns purpose, boundaries, invariants, public contracts, semantic dependencies, canonical examples, logical module identity, and spec-worthy decisions. It starts from the cheapest evidence and reads source only where needed.

## AGENTS routing

Router sync appends or replaces one marker-delimited Amy block. Existing human instructions remain byte-for-byte outside that block. Missing or malformed marker pairs cause a refusal; Runtime never repairs them by overwriting the file. Nested `AGENTS.md` files are not generated.

## Stage 2 Handoff

Implemented: deterministic project discovery, candidate evidence, versioned PROJECT/ARCHITECTURE/module contracts, strict artifact validation, filesystem storage, stable query API, explicit CLI, semantic maintenance skill, and safe root routing.

Canonical interfaces are `IProjectIntelligenceApi`, `IProjectIntelligenceKnowledge`, `IProjectKnowledge`, `IArchitectureKnowledge`, `IModuleKnowledge`, `ISpecWorthinessDecision`, and `IProjectDiscovery`. Canonical storage is `.amy/project-intelligence`; `index.json` is its entry point.

Project Intelligence is optional: ordinary Runtime construction and existing development skills do not register or depend on it. Semantic reasoning remains outside deterministic Runtime. Stage 3 freshness, fingerprints, drift detection, and the Project Intelligence Graph are deliberately deferred. Stage 5 may consume the current immutable query API without changing artifact ownership.

Current limits: workspace expansion supports inexpensive one-level `/*` package patterns; discovery returns candidates rather than proving logical module boundaries; router management is limited to one root managed block. These are deliberate Stage 2 constraints, not freshness or graph seams.
