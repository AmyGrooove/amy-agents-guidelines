---
name: place-typescript-object
description: Determine the owning layer, destination, public API, and allowed dependencies for a TypeScript object. Use when placement or architecture is the requested result, not for routine implementation with an obvious destination.
---

# Place TypeScript Object

## Responsibility and Activation

Determine ownership, layer, directory, public API, and allowed dependencies when placement itself is the requested result.

Activate for where an object belongs, layer ownership, public API, cycle analysis, or moving an object between layers. Do not activate for routine implementation with an obvious destination, complete project inception, or a simple import repair owned by the affected artifact. It is not a mandatory preflight or general router; use it only for an independent placement result or when two materially different destinations remain.

## Context and References

Inspect layers, consumers, ownership, reuse, aliases, object indexes, and the import graph.

Read [workflow and authority](../../references/workflow-and-authority.md) once. Consult only task-relevant references from: [project architecture](../../references/project-architecture.md). Read one domain reference only when framework ownership materially determines placement. Never load routing evaluation during ordinary work.

## Expected Result

Return one recommended destination, allowed dependencies, minimal public API, and required import migrations. If the user requests the move, also apply the owning artifact skill.

## Process

1. Find the object, consumers, and current public boundary.
2. Determine who owns its meaning and whether it is portable or project-specific.
3. Trace permitted dependency direction and detect cycles.
4. Compare only valid destinations.
5. Select the lowest minimal location that preserves ownership and acyclic dependencies.
6. Describe public exports and in-scope import migration.

## Authority

Choose the destination when ownership and dependency direction leave one valid result. Require confirmation for equally valid locations with different public contracts, a new layer or backend category, a broad move, or a public API change.

## Prevent

Prevent backward or deep imports, mega-barrels, object self-imports through `index.ts`, hidden cycles, and project-specific code in `shared`.

## Verification and Completion

Complete when every proposed dependency follows direction, the public API is minimal, no cycle is hidden through a deep import, and any move authority is explicit.

## Optional-Capability Fallback

Use the local import graph, aliases, project instructions, and neighboring objects. Missing optional capabilities do not block a unique locally supported result; ask only when materially different valid placements remain.
