---
name: resolve-task-context
description: Use after Amy has a canonical Task Analysis and needs the minimum reliable project context, relevant specs/files, freshness handling, or a targeted source-read/Scout recommendation before execution strategy.
---

# Resolve Task Context

## Responsibility

Turn an existing Task Analysis into a bounded Context Packet using Amy Context Intelligence. This skill interprets the packet for the agentic workflow; deterministic Runtime owns validation, matching, freshness checks, graph impact, budgets, and cache safety.

Read [Context Intelligence](../../references/context-intelligence.md) for canonical contracts and boundaries.

## Process

1. Start from a validated Stage 4 `task-analysis`. Do not broaden or reinterpret the user's task here.
2. Invoke `context-resolve` with the Task Analysis and current project root. Do not refresh Project Intelligence merely to improve Context Intelligence confidence.
3. If `resolution.exploration` is `none`, use the Context Packet as the initial project context and do not read extra files without a concrete new evidence gap.
4. If it is `source-read`, read `resolution.sourceReads` first and prefer those source-of-truth files over stale/unknown semantic specs. Expand only when those reads expose a specific unresolved dependency or invariant.
5. If it is `scout`, preserve the recommendation and its reason codes for the orchestration layer. Before Agent Roles/Strategy Router exist, perform only the targeted exploration required by the current task rather than a repository-wide scan.
6. Respect `budget.truncated`, `confidence`, `reasonCodes`, and `evidenceGaps` as evidence. They explain limitations; they do not authorize unlimited exploration.
7. Treat `likelyAffectedFiles` as candidates, not guaranteed edit targets. Reconfirm against source before changing code.
8. Never treat the in-memory exploration cache as authoritative; freshness and canonical project knowledge remain the authority.

## Boundaries

- Do not rebuild graphs, refresh freshness baselines, generate specs, or mutate Project Intelligence as part of context resolution.
- Do not choose models, reasoning effort, agents, decomposition, parallelism, verification policy, retry, or completion here.
- Do not launch Scout solely because classifier confidence is low; use the Context Resolution recommendation and evidence gaps.
- Do not add a vector database, embeddings, persistent context store, or a giant orchestration prompt for this workflow.
