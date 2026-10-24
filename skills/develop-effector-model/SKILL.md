---
name: develop-effector-model
description: Use when working on standalone Effector models and their stores, events, effects, and sample wiring. Excludes component-owned stores and TanStack Query cache logic.
---

# Develop Effector Model

## Responsibility and Activation

Create, change, or review a standalone cohesive Effector model and its public units.

Activate for stores, events, effects, `sample`, derived stores, and wiring owned by one standalone model. Do not activate for component-local state, a store exclusively owned by one component, TanStack Query cache logic, or generic state without Effector. Own all units of the cohesive model; keep incidental pure helpers inside it unless independently reusable.

## Context and References

Start with the affected units and their event/data flow. For creation, establish model ownership, public units, and required scope/provider integration; inspect a neighbor only for an unresolved convention. For a targeted change, follow connected events, effects, APIs, scopes/providers, and consumers only where state, payloads, coordination, or isolation may be affected.

Read [workflow and authority](../../references/shared/workflow-and-authority.md) once. Apply its activation conditions to [TypeScript and objects](../../references/shared/typescript-and-objects.md) and [project architecture](../../references/shared/project-architecture.md). Read [Effector](../../references/frontend/effector.md) for affected unit structure, state, coordination, effects, or scope semantics.

## Expected Result

Produce a cohesive standalone model with declarative data flow and public units. Verify affected effect triggers, coordination, scope isolation, and consumer integration.
