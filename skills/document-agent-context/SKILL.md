---
name: document-agent-context
description: Use when agent documentation or AGENTS.md routing is requested, or when authorized implementation makes existing agent documentation stale or establishes useful new facts about its already documented subject. Excludes read-only work and new documentation subjects without a user request.
---

# Document Agent Context

## Purpose and Audience

Maintain project memory for future coding agents. Write `AGENTS.md` and `docs/agents/**` in English for agent retrieval and use, regardless of the user's language. The documents are operational context, not user documentation: help an agent find existing capabilities, reuse their APIs, understand entity relationships and contracts, and avoid duplicate or incompatible implementations. Keep facts concise, specific, and linked to production sources. Documentation helps locate code; inspect current code before relying on a claim.

Read [workflow and authority](../../references/shared/workflow-and-authority.md) once. User restrictions take precedence. Read-only work produces no documentation changes.

## Creation and Maintenance Boundary

Create the project-wide map only on a direct user request to initialize or generate agent documentation. An existing `AGENTS.md` alone does not authorize creating `docs/agents/index.md`. A newly created project may receive agent documentation when the user's request includes it; project creation alone does not require documentation.

Treat a documented subject as an entity, capability, integration, or contract already described in `AGENTS.md` or `docs/agents/**`, not merely a source file that already exists. During authorized implementation, automatically update affected existing documents when the behavior, fields, API, dependencies, or constraints of a documented subject change. Add newly discovered details to that subject's existing document when they help future agents use or change it correctly. Update existing incoming routes when needed. Load this skill for maintenance only when those existing facts need updating or useful new facts have been established; an implementation edit that leaves documentation accurate adds no documentation route. This maintenance needs no separate prompt.

Do not document a newly introduced subject just because implementation created it, even if a related area is documented. Do not create a new topic, area, or project-wide map without a user request. If an existing shared contract changes because of the new subject, keep that already documented contract accurate, without turning the new subject into a new topic. If an existing document cannot remain accurate without a new file, finish the implementation and suggest that specific addition.

When the user directly requests initialization, creation, or expansion, that request authorizes the stated documentation scope. Do not ask for the same authorization again. Ask only about material project intent or constraints that source inspection cannot establish; choose the best evidence-backed option for ordinary structure and wording.

## Structure and Routing

- Root `AGENTS.md`: concise project orientation, core capabilities and boundaries, important working rules, and a relative link to `docs/agents/index.md`. Make it useful on its own while keeping details in routed documents.
- `docs/agents/index.md`: project-wide capability map and conditional routes to independently meaningful areas.
- `docs/agents/<area>/index.md`: the area's responsibilities, available APIs or entities, and routes to its topics or subareas.
- Topic documents: actionable facts about a capability, entity, integration, or contract, with links to production entrypoints and consumers.

Group by responsibility, domain, or integration instead of mirroring every source directory. Each route says when to read its target and uses a relative Markdown link. Route by task intent and affected source paths where useful. Every topic must be reachable from the root index. Indexes guide selection without repeating topic details. Avoid placeholders and empty directories.

On requested initialization, inspect the project's significant production areas and existing documentation to identify reusable mechanisms, important entities, entrypoints, dependencies, and constraints. Cover the significant capabilities at a useful level, without cataloging every file or copying implementations. Ask a focused question only where the evidence leaves a material decision unresolved. Do not assume a capability is absent merely because it is missing from the map.

## Content for Agent Decisions

For each documented subject, preserve what a future agent needs to make the next change: what exists, where its public or internal API starts, when to reuse it, what it depends on, which entities or consumers connect to it, and which invariants or pitfalls govern changes. Include concrete source paths and symbol names. For example, an email area should identify the existing send path and its contract so an agent checks it before implementing another sender.

Record only facts established by inspected production sources. Distinguish observed behavior from intended behavior and resolve disagreements against current code. Avoid stale negative claims such as an unqualified assertion that a feature does not exist. Do not duplicate Amy standards, library manuals, obvious code, task transcripts, secrets, or human-facing tutorials. Preserve user-authored rules. When creating the map, migrate only relevant project knowledge from an oversized root `AGENTS.md`; retain its rules and brief project orientation.

## Working Method and Verification

Read applicable instructions and the root index when present, then follow only task-relevant routes. If a route is missing or stale, inspect the needed production code directly. During implementation, check whether changed subjects already have documentation; maintain only the affected existing documents and routes. A routine code change does not trigger a repository-wide documentation audit.

Check that changed routes resolve, topics remain reachable, reading conditions discriminate between tasks, and factual claims match inspected production sources. Check for duplication and contradictory instructions. Documentation does not authorize test or story authoring or Storybook execution; existing safe tests follow the shared verification rules. Report the documentation changes and material verification limits briefly.
