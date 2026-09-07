---
name: maintain-project-intelligence
description: Use when creating, refreshing, or inspecting Amy Project Intelligence artifacts for a repository, including PROJECT, ARCHITECTURE, module specs, spec-worthy decisions, or AGENTS routing.
---

# Maintain Project Intelligence

## Responsibility

Build compact semantic knowledge for an unfamiliar repository. Source code remains authoritative; generated artifacts are a cached interpretation and may omit unknown information.

Read [Project Intelligence](../../references/project-intelligence.md) for the artifact contract, reason codes, Runtime API, CLI, and router rules.

## Process

1. Build Amy Runtime when `runtime/dist` is absent or stale.
2. Run `intelligence-discover` against the target project.
3. Read existing Project Intelligence before changing it.
4. Inspect cheap evidence first: manifests, package boundaries, public indexes, imports, project docs, AGENTS instructions, and framework structure. Read source only where semantic evidence is still missing. Check test and Storybook files only for existence unless their contents are explicitly authorized.
5. Treat discovered directories as candidates, not logical modules. Merge or split candidates according to responsibility, public contracts, dependency direction, and data flow.
6. Record only evidence-backed project, architecture, and module knowledge. Omit unknown optional fields.
7. Give each considered module an explainable `specWorthy` decision using canonical reason codes and `low`, `medium`, or `high` confidence. Persist specs only for `isSpecWorthy: true`; keep rejected candidates out of module artifacts.
8. Save through `intelligence-save`, reload through `intelligence-show`, then run `intelligence-sync-router` only when the user authorized project-file writes.
9. If router sync returns `refused`, preserve `AGENTS.md` unchanged and report the reason.

## Boundaries

- Keep technology rules in development skills rather than duplicating them in project knowledge.
- Do not infer `folder = module` or invent consumers, invariants, decisions, or source-of-truth paths.
- Do not add freshness metadata, fingerprints, a knowledge graph, embeddings, a database, task/context intelligence, agent roles, or orchestration.
- Never edit the Amy-managed block or canonical JSON by bypassing Runtime validation when the Runtime is available.
