---
name: place-typescript-object
description: TypeScript object placement, layer ownership, public API/dependency boundaries, or cycle analysis. Excludes project inception and routine implementation with an established destination.
---

# Place TypeScript Object

## Responsibility and Activation

Determine or review ownership, layer, directory, public API, and allowed dependencies when placement itself is the requested result.

Activate for where an object belongs, layer ownership, public API, cycle analysis, or moving an object between layers. Do not activate for routine implementation with an obvious destination, complete project inception, or a simple import repair owned by the affected artifact. It is not a mandatory preflight or general router; use it only for an independent placement result or when two materially different destinations remain.

## Context and References

Start with the object's responsibility, proposed/current public boundary, and relevant dependencies. For a new object, establish intended consumers and valid layers; for an existing object, search actual usages and trace only graph edges needed to assess the requested placement or cycle. Inspect aliases, indexes, reuse candidates, and neighboring objects only to resolve destination, visibility, or dependency constraints.

Read [workflow and authority](../../references/shared/workflow-and-authority.md) once and [project architecture](../../references/shared/project-architecture.md) for the requested placement/import boundaries. Read a domain reference only when framework ownership materially determines placement; apply the shared activation conditions to [TypeScript and objects](../../references/shared/typescript-and-objects.md) when object/file or public export design is in scope. Never load routing evaluation during ordinary work.

## Expected Result

Return one recommended destination, allowed dependencies, minimal public API, and required import migrations, supported by ownership and an acyclic dependency graph. If the user requests the move, also apply the owning artifact skill.
