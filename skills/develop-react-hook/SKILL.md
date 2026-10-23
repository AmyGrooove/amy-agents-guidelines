---
name: develop-react-hook
description: Create, fix, extend, refactor, or review a standalone reusable React hook object. Do not use for a hook owned by a component or for TanStack Query API hooks.
---

# Develop React Hook

## Responsibility and Activation

Create, change, or review a standalone reusable React hook object.

Activate for a standalone `use<Name>` requiring React state, lifecycle, effects, or subscriptions. Do not activate for `use<Component>`, any component-owned hook, TanStack Query hooks, or pure functions without React semantics. Activate when the primary artifact is independently reusable rather than owned by a component or API object.

## Context and References

Inspect consumers, React version, lifecycle needs, shared hooks, target layer, and any Next.js client boundary. Read [workflow and authority](../../references/shared/workflow-and-authority.md) once. Consult only task-relevant references from: [TypeScript and objects](../../references/shared/typescript-and-objects.md), and [React](../../references/frontend/react.md). Read [project architecture](../../references/shared/project-architecture.md) only when the layer is unclear.

## Expected Result

Produce `core/use<Name>.ts`, only necessary types, constants, or helpers, and a minimal public `index.ts`.

## Process

1. Confirm that React hook semantics and standalone reuse are real.
2. Inspect consumers and neighboring hooks.
3. Define the input, return contract, lifecycle, and cleanup obligations.
4. Implement in the approved logical order.
5. Add cleanup and stable effect dependencies where required.
6. Expose only the required public API and update consumers.

## Authority

Choose a plain function instead when hook semantics are unnecessary, and extract hook-local helpers when justified. Require confirmation only when not already authorized for breaking return contracts, a materially new Next.js client boundary, or a dependency.

## Prevent

Prevent hooks for pure logic, leaked listeners or subscriptions, unstable effects, unnecessary manual `AbortController`, and component ownership leakage.

## Verification and Completion

Complete when Rules of Hooks are satisfied, cleanup exists where required, the public API is minimal, and no consumer deep-imports internals.

## Optional-Capability Fallback

Use the installed React version, local types, and neighboring hooks. Report unresolved version-sensitive lifecycle behavior rather than guessing; otherwise missing optional capabilities do not block the work.
