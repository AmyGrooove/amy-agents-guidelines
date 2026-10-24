---
name: develop-typescript-object
description: Use when working on standalone TypeScript functions, types, constants, and utilities. Fallback only when no React, Effector, TanStack Query, NestJS, Mongoose, test, or story artifact owns them.
---

# Develop TypeScript Object

## Responsibility and Activation

Create, change, or review an ordinary standalone non-framework TypeScript object.

Activate for functions, types, constants, generic utilities, non-framework decorators, and their local files. Do not activate for component-owned helpers, React hooks, query API objects, Nest decorators, DTOs, schemas, modules, tests, or stories. Use this only as the strict fallback when no framework-specific or owning artifact covers the object.

## Context and References

Start with the affected implementation and signature. For creation, establish ownership, public entrypoint, and required structure; search for suitable reusable utilities and inspect a neighbor only for an unresolved convention. For a targeted change, read types, constants, configuration, and dependencies only where the changed behavior relies on them; inspect consumers when the public or observable contract may be affected.

Read [workflow and authority](../../references/shared/workflow-and-authority.md) once. Apply its activation conditions to [TypeScript and objects](../../references/shared/typescript-and-objects.md) and [project architecture](../../references/shared/project-architecture.md); a local value/expression change within an established shape does not by itself trigger either reference.

## Expected Result

Produce a complete standalone object or targeted modification, with its public API and necessary consumer adaptations. Verify the affected signature and observable behavior.
