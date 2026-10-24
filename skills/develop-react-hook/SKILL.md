---
name: develop-react-hook
description: Use when working on standalone reusable React hooks. Excludes component-owned hooks, TanStack Query hooks, and pure functions without React semantics.
---

# Develop React Hook

## Responsibility and Activation

Create, change, or review a standalone reusable React hook object.

Activate for a standalone `use<Name>` requiring React state, lifecycle, effects, or subscriptions. Do not activate for `use<Component>`, any component-owned hook, TanStack Query hooks, or pure functions without React semantics. Activate when the primary artifact is independently reusable rather than owned by a component or API object.

## Context and References

Start with the hook's implementation, input/return contract, and affected lifecycle. For creation, establish standalone ownership and search reusable hooks. For a targeted change, inspect consumers only when return values, arguments, lifecycle, or observable behavior may affect them; inspect provider/client boundaries and the installed React version when affected semantics depend on them. Neighbors serve only unresolved conventions.

Read [workflow and authority](../../references/shared/workflow-and-authority.md) once. Apply its activation conditions to [TypeScript and objects](../../references/shared/typescript-and-objects.md) and [project architecture](../../references/shared/project-architecture.md). Read [React](../../references/frontend/react.md) for affected hook structure, lifecycle, cleanup, dependencies, or client boundaries.

## Expected Result

Produce a standalone hook object with its input/return contract, lifecycle and cleanup, necessary owned artifacts, and minimal public entrypoint.
