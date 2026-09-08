# Amy Project Intelligence

Project Intelligence is an explicit Runtime capability plus a semantic skill. It caches evidence-backed project understanding while source code remains authoritative.

## Canonical artifacts

Artifacts live inside the target repository:

```text
.amy/project-intelligence/
├── index.json
├── project.json
├── architecture.json
├── modules/<module-id>.json
├── graph.json
└── freshness.json
```

`project.json`, `architecture.json`, module specs, and `index.json` keep artifact schema version `1`. Stage 3 deliberately does not migrate or rewrite Stage 2 knowledge. `graph.json` and `freshness.json` are independent versioned sidecars with schema version `1`.

`index.json` remains the stable entry point for semantic specs and deterministically lists module specs. The fixed-name sidecars add derived relationship and freshness data without changing Stage 2 storage ownership.

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

## Freshness and drift

Freshness is tracked per semantic owner:

- `project`;
- `architecture`;
- `module:<module-id>`.

A snapshot stores deterministic source metadata: normalized project-relative path, semantic role, source kind, byte count, file count, and SHA-256 fingerprint. Amy fingerprints file contents and deterministic directory manifests; timestamps are intentionally not authoritative. `.git`, `.amy`, and `node_modules` descendants are excluded from directory traversal.

Source roles are `implementation`, `contract`, `architecture`, or `unknown`. The generated graph derives conservative defaults from canonical knowledge: project/module source locations are implementation evidence, entry points/module `sourceOfTruth` and canonical examples are contract evidence. Architecture source paths are not guessed; the semantic skill may enrich the graph with evidence-backed `owner: "architecture"` source nodes.

Freshness states are:

- `trusted` — the semantic cache remains usable;
- `stale` — contract or architecture evidence changed and semantic refresh is required;
- `unknown` — Amy cannot prove freshness, for example because there is no baseline, source metadata changed, knowledge changed, or a tracked source is missing.

Change kinds are `none`, `implementation`, `contract`, `architecture`, and `unknown`. Implementation-only drift is reported but remains `trusted`; it does not force semantic spec regeneration. Contract and architecture drift are `stale`. This is an evidence classification, not a claim that Runtime understands source semantics.

`refreshFreshness(owners?)` supports selective baseline refresh. A stale contract/architecture owner must be semantically inspected and updated before its baseline is refreshed; refreshing fingerprints alone must not be used to hide drift.

## Project Intelligence Graph

`graph.json` is a lightweight typed graph, not a database. Nodes can represent project, architecture, modules, sources, contracts, symbols, tests, canonical examples, and semantic references. Supported relations are:

- `owns`;
- `depends_on`;
- `consumed_by`;
- `public_api`;
- `important_symbol`;
- `tested_by`;
- `canonical_example`;
- `related_to`.

`rebuildGraph()` deterministically creates the graph from current canonical knowledge. `saveGraph(value)` validates enriched graphs, rejects dangling edges, requires all canonical module nodes, and requires the graph knowledge fingerprint to match current semantic knowledge. This lets the semantic skill add evidence-backed architecture sources, important symbols, or relationships without allowing stale graph data to masquerade as current.

`analyzeImpact(moduleId)` returns direct module dependencies/consumers, related modules, owned sources, public API, tests, canonical examples, graph state, and a categorical change-risk estimate with reason codes. If the graph is missing or was built from older knowledge, risk is `unknown` rather than guessed.

## Runtime boundary

`createProjectIntelligenceCapability(projectRoot)` creates `amy.project-intelligence@1.1.0`. It is never registered by `createAmyRuntime` automatically. Its Stage 2 API remains backward compatible and Stage 3 adds:

- `rebuildGraph()`, `loadGraph()`, and `saveGraph(value)`;
- `analyzeImpact(moduleId)`;
- `refreshFreshness(owners?)` and `assessFreshness(owners?)`.

`PROJECT_INTELLIGENCE_VERSIONS` is `{ api: 1, artifactSchema: 1, freshnessSchema: 1, graphSchema: 1 }`. Runtime API, capability, configuration, event, and state versions remain unchanged. The Project Intelligence API major stays `1` because Stage 3 is additive.

Explicit CLI commands register the capability only for that invocation:

```text
node <amy-plugin-root>/runtime/dist/cli.js intelligence-discover --project <path>
node <amy-plugin-root>/runtime/dist/cli.js intelligence-save --project <path> --input <knowledge.json>
node <amy-plugin-root>/runtime/dist/cli.js intelligence-show --project <path>
node <amy-plugin-root>/runtime/dist/cli.js intelligence-graph-build --project <path>
node <amy-plugin-root>/runtime/dist/cli.js intelligence-graph-show --project <path>
node <amy-plugin-root>/runtime/dist/cli.js intelligence-graph-save --project <path> --input <graph.json>
node <amy-plugin-root>/runtime/dist/cli.js intelligence-freshness-refresh --project <path> [--owner <owner>]
node <amy-plugin-root>/runtime/dist/cli.js intelligence-freshness-show --project <path> [--owner <owner>]
node <amy-plugin-root>/runtime/dist/cli.js intelligence-impact --project <path> --module <module-id>
node <amy-plugin-root>/runtime/dist/cli.js intelligence-sync-router --project <path>
```

## Deterministic and semantic responsibilities

Runtime owns root/candidate discovery, path normalization, schemas, validation, deterministic ordering, persistence, content fingerprints, graph consistency, direct impact traversal, categorical risk reasons, and safe routing. Candidate discovery still uses structure, manifests, workspace boundaries, public indexes, and framework module filenames; a candidate is not a logical module.

The `maintain-project-intelligence` skill owns purpose, boundaries, invariants, public contracts, semantic dependencies, canonical examples, logical module identity, spec-worthy decisions, source semantic roles that cannot be inferred safely, important symbols, semantic relationships, and the decision whether observed drift requires spec changes.

## AGENTS routing

Router sync appends or replaces one marker-delimited Amy block. Existing human instructions remain byte-for-byte outside that block. Missing or malformed marker pairs cause a refusal; Runtime never repairs them by overwriting the file. Nested `AGENTS.md` files are not generated.

## Stage 3 Handoff

Implemented: deterministic source fingerprints and metadata, owner-scoped freshness baselines, `trusted/stale/unknown` assessment, implementation-vs-contract-vs-architecture drift classification, selective refresh, a versioned lightweight Project Intelligence Graph, graph enrichment validation, direct impact analysis, categorical change-risk reasons, and explicit CLI access.

Canonical Stage 3 interfaces are `IProjectIntelligenceGraph`, `IProjectIntelligenceGraphNode`, `IProjectIntelligenceGraphEdge`, `IProjectIntelligenceFreshnessSnapshot`, `IProjectIntelligenceFreshnessAssessment`, `IProjectIntelligenceSourceFingerprint`, and `IProjectIntelligenceImpactAnalysis`. The existing `IProjectIntelligenceApi` remains canonical and is extended additively.

Key decisions: Stage 2 semantic artifacts and schema remain unchanged; freshness and graph are sidecars; Runtime does not attempt LLM semantic drift analysis; only evidence-backed source roles can turn a content fingerprint change into contract/architecture drift; implementation-only drift does not automatically stale specs; graph/risk logic is deterministic and categorical; no database, embeddings, vector index, timestamps, or automatic repository-wide scan was introduced.

Current limits: fingerprints read the contents of explicitly tracked directories and can therefore be non-trivial for very large module roots; there is no incremental per-file fingerprint cache yet. Architecture sources and important symbols require semantic graph enrichment when canonical knowledge does not identify them. Impact analysis is intentionally direct rather than a transitive dependency solver. These are acceptable Stage 3 limits and should only be expanded when later context/routing stages prove the need.

Stage 4 can consume module freshness, graph state, direct impact, and categorical risk as optional evidence for Task Contract / Task Classifier, but classification must not trigger graph rebuilds or repository fingerprint scans automatically.
