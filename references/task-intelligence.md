# Amy Task Intelligence

Task Intelligence normalizes a development request into a versioned Task Contract and produces a deterministic categorical classification for later orchestration. It is an explicit optional Runtime capability and does not inspect a repository by itself.

## Task Contract

Canonical schema version `1`:

```json
{
  "kind": "task-contract",
  "schemaVersion": 1,
  "goal": "Add a disabled state to Button.",
  "requirements": ["Expose a disabled prop"],
  "nonGoals": [],
  "constraints": [],
  "acceptanceCriteria": ["Pointer and keyboard interaction are disabled"],
  "affectedScope": {
    "kind": "local",
    "targets": ["src/components/Button.tsx"]
  },
  "uncertainties": [],
  "verificationExpectations": ["Run relevant unit tests"]
}
```

`goal` is required. The semantic fields are optional because Amy must represent incomplete understanding honestly. Arrays may be explicitly empty when the category is known to be empty; an omitted field means the information is unknown. Unknown fields, duplicate array entries, unsupported schemas, invalid scope kinds, and malformed values are rejected.

`affectedScope.kind` is one of `local`, `module`, `multi-module`, `repository`, or `unknown`. `targets` may contain known paths or semantic module identifiers; Task Intelligence does not resolve or verify them against the repository.

The `analyze-task` skill owns semantic normalization from natural-language requests. Deterministic Runtime code owns schema validation and classification.

## Task Classification

Classification schema version `1` is carried inside the existing Runtime `task-analysis` pipeline contract. Its classification payload contains:

- `complexity`;
- `uncertainty`;
- `scope`;
- `risk`;
- `coupling`;
- `blastRadius`;
- `novelty`;
- `parallelizability`;
- `expectedContextCost`;
- `verificationCost`;
- categorical `confidence`;
- structured `reasonCodes`;
- explicit `evidenceGaps`.

Most dimensions use `low`, `medium`, `high`, or `unknown`; scope and blast radius use the Task Contract scope categories. The classifier intentionally avoids numeric scores.

The default mode is `text-only`: it consumes only the normalized Task Contract. Missing evidence remains `unknown`. In particular, project risk and novelty are not guessed from wording.

Optional `projectEvidence` can refine project risk, coupling, and blast radius. It is a small decoupled projection of already available Project Intelligence facts: module id, freshness state, graph state, categorical risk, and existing risk reason codes. Task Intelligence has no Runtime dependency on Project Intelligence and never calls it automatically.

Stale or missing Project Intelligence evidence is surfaced as an evidence gap rather than silently treated as trustworthy. Classification never rebuilds the Project Intelligence graph, refreshes fingerprints, or scans source code.

## Runtime boundary

`createTaskIntelligenceCapability()` creates `amy.task-intelligence@1.0.0`. It is not registered by `createAmyRuntime` automatically and declares no capability dependencies.

Canonical public functions are:

- `validateTaskContract(value)`;
- `classifyTask(value)`;
- `createTaskIntelligenceCapability()`.

`TASK_INTELLIGENCE_VERSIONS` is `{ analysisSchema: 1, api: 1, classificationSchema: 1, taskContractSchema: 1 }`. `classifyTask` returns the existing `TTaskAnalysis` envelope with `kind: "task-analysis"`; its `data` contains the validated `contract` and categorical `classification`.

CLI access is explicit:

```text
node <amy-plugin-root>/runtime/dist/cli.js task-contract-validate --input <contract.json>
node <amy-plugin-root>/runtime/dist/cli.js task-classify --input <classification-input.json>
```

Classification input is:

```json
{
  "contract": { "kind": "task-contract", "schemaVersion": 1, "goal": "..." },
  "projectEvidence": {
    "kind": "project-intelligence",
    "modules": []
  }
}
```

`projectEvidence` is optional. Omitting it guarantees text-only classification.

## Stage 4 Handoff

Stage: 4 — Task Contract + Task Classifier.

Verdict: `implement`.

Implemented: a strict versioned Task Contract, honest unknown/empty semantics, deterministic categorical Task Classifier, confidence/reason codes/evidence gaps, explicit optional Project Intelligence evidence, an independent `amy.task-intelligence` capability, explicit CLI commands, and the `analyze-task` semantic normalization skill.

Canonical interfaces/contracts: existing `TTaskAnalysis` as the pipeline envelope plus `ITaskContract`, `ITaskAffectedScope`, `ITaskClassificationInput`, `ITaskClassification`, `ITaskClassificationDimensions`, `ITaskAnalysisData`, `TTaskIntelligenceAnalysis`, `ITaskProjectEvidence`, `ITaskProjectModuleEvidence`, `ITaskIntelligenceApi`, `TASK_INTELLIGENCE_VERSIONS`, `validateTaskContract`, and `classifyTask`.

Key architectural decisions: Stage 1 `task-analysis` pipeline abstraction is reused rather than creating a parallel envelope; semantic normalization stays in a skill while Runtime stays deterministic; text-only classification is the default; Project Intelligence is passed only as a decoupled evidence projection and is never invoked by Task Intelligence; missing evidence stays `unknown`; no numeric scoring, repository scan, persistence, router, Scout, model selection, or decomposition was introduced.

Technical debt: novelty remains `unknown` until later execution/history data can support it; parallelizability remains conservative without explicit independence evidence; classifier thresholds are intentionally small deterministic heuristics and should be changed only with later eval/telemetry evidence.

Limits: Task Intelligence does not discover affected files/modules, prove scope, resolve context, or choose an execution strategy. Project evidence can be stale and is surfaced rather than refreshed automatically.

Next stage should consume Task Contract and classification as inputs to Stage 5 Context Intelligence. It should use Project Intelligence selectively, respect `evidenceGaps`, and avoid turning low classifier confidence into an unconditional repository scan.
