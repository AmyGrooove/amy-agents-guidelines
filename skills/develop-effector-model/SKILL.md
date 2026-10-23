---
name: develop-effector-model
description: Create, fix, extend, refactor, or review a standalone cohesive Effector model and its public units. Do not use for an internal store owned exclusively by a React component object.
---

# Develop Effector Model

## Responsibility and Activation

Create, change, or review a standalone cohesive Effector model and its public units.

Activate for stores, events, effects, `sample`, derived stores, and wiring owned by one standalone model. Do not activate for component-local state, a store exclusively owned by one component, TanStack Query cache logic, or generic state without Effector. Own all units of the cohesive model; keep incidental pure helpers inside it unless independently reusable.

## Context and References

Inspect consumers, scopes/providers, domain events, effects, existing APIs, and neighboring Effector conventions. Read [workflow and authority](../../references/shared/workflow-and-authority.md) once. Read [TypeScript and objects](../../references/shared/typescript-and-objects.md) for changed code, types, exports, or object structure, and [Effector](../../references/frontend/effector.md) for affected units and their interactions. Read [project architecture](../../references/shared/project-architecture.md) only when ownership, placement, or imports change.

## Expected Result

For creation, produce a cohesive model under `stores/<name>`, declarative data flow, and a minimal public index. For a targeted change, modify the requested flow and necessary consumers only; full normalization covers the agreed model, and review does not edit it.

## Process

1. Identify owned state, events, effects, consumers, and provider scope.
2. Inspect existing units and public contracts.
3. Separate only independently reusable pure logic.
4. Build derived stores and coordination with `sample`.
5. Restrict `watch` to genuine external side effects.
6. Export only units actually consumed and update consumers.

## Authority

Compose events, effects, stores, and samples, and remove behavior-free wrappers only in the agreed area. Require confirmation only when not already authorized for breaking public-unit changes, ownership moves between layers, or dependencies.

## Prevent

Prevent imperative unit coordination through `watch`, redundant wrappers, hidden side effects, internal-unit exports, and duplication of TanStack Query server cache as domain state.

## Verification and Completion

Complete a creation or explicit normalization when no unnecessary imperative link remains in its agreed model, effect triggers and ownership are explicit, and public exports match consumers. Complete a targeted change when the requested link and necessary consumers meet those checks; unrelated wrappers or imperative links do not block it.

## Optional-Capability Fallback

Use the installed Effector version, local types, and neighboring models. Request guidance only when a material version-sensitive unit API cannot be established safely.
