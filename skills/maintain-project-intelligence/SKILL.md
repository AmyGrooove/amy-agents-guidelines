---
name: maintain-project-intelligence
description: Use when creating, refreshing, or inspecting Amy Project Intelligence artifacts for a repository, including PROJECT, ARCHITECTURE, module specs, freshness, graph relationships, impact, spec-worthy decisions, or AGENTS routing.
---

# Maintain Project Intelligence

## Responsibility

Build and maintain compact semantic knowledge for an unfamiliar repository. Source code remains authoritative; Project Intelligence is a cached interpretation and must not be trusted past its evidence.

Read [Project Intelligence](../../references/project-intelligence.md) for artifact contracts, freshness states, graph relations, reason codes, Runtime API, CLI, and router rules.

## Process

1. Build Amy Runtime when `runtime/dist` is absent or stale.
2. Run `intelligence-discover` against the target project.
3. Read existing Project Intelligence before changing it. When knowledge exists, inspect `intelligence-freshness-show` and `intelligence-graph-show` before trusting semantic specs.
4. Inspect cheap evidence first: manifests, package boundaries, public indexes, imports, project docs, AGENTS instructions, and framework structure. Read source only where semantic evidence is still missing or freshness evidence requires it. Check test and Storybook files only for existence unless their contents are explicitly authorized.
5. Treat discovered directories as candidates, not logical modules. Merge or split candidates according to responsibility, public contracts, dependency direction, and data flow.
6. Record only evidence-backed project, architecture, and module knowledge. Omit unknown optional fields.
7. Give each considered module an explainable `specWorthy` decision using canonical reason codes and `low`, `medium`, or `high` confidence. Persist specs only for `isSpecWorthy: true`; keep rejected candidates out of module artifacts.
8. Save semantic knowledge through `intelligence-save`, reload it, then rebuild the graph. Enrich the graph only when evidence supports architecture source ownership, important symbols, or semantic relationships; save enriched graphs through Runtime validation rather than editing `graph.json` directly.
9. Assess freshness per affected owner. `implementation` drift may keep a spec trusted; `contract` or `architecture` drift requires semantic inspection and any necessary spec/graph update before refreshing that owner's baseline. Never refresh fingerprints merely to make a stale result green.
10. Use `intelligence-impact --module <id>` when a change needs dependency/consumer, public API, testing, canonical-example, or risk context. Treat `graphState: missing/stale` and `risk: unknown` as evidence gaps, not low risk.
11. Refresh only owners whose semantic knowledge has just been established. Run `intelligence-sync-router` only when the user authorized project-file writes.
12. If router sync returns `refused`, preserve `AGENTS.md` unchanged and report the reason.

## Boundaries

- Keep technology rules in development skills rather than duplicating them in project knowledge.
- Do not infer `folder = module` or invent consumers, invariants, decisions, source roles, important symbols, relationships, or source-of-truth paths.
- Do not treat a content fingerprint as semantic understanding. Runtime classifies drift only from evidence-backed source roles.
- Do not rebuild graph or fingerprint broad repository roots unless the current Project Intelligence workflow needs them.
- Do not add embeddings, a vector database, task/context intelligence, task classification, agent roles, or orchestration here.
- Never edit the Amy-managed AGENTS block, canonical semantic JSON, graph, or freshness baselines by bypassing Runtime validation when Runtime is available.
