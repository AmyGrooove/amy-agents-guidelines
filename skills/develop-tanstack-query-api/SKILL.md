---
name: develop-tanstack-query-api
description: Use when working on TanStack Query API hooks and their owned raw requests, query keys, and types. Excludes standalone fetch utilities, backend endpoints, and caller-only component changes.
---

# Develop TanStack Query API

## Responsibility and Activation

Create, change, or review one frontend API object containing its raw request and TanStack Query hook.

Activate for query/mutation hooks and their owned query keys, request/response types, cancellation, and raw request functions within a TanStack Query API object. Do not activate for backend endpoints, generic `fetchData`, Effector state, or a component that only consumes a correct hook. Do not activate for standalone requests outside a TanStack Query API object, even when TanStack Query is installed. Route them by actual artifact ownership; use the TypeScript object skill only when no more specific owner applies. Own the response/body types, raw request, hook, and key for one API object.

## Context and References

Start with the affected request/hook/key and its cache or HTTP contract. For creation, establish ownership, backend DTO/error contract, request utility, and necessary authentication integration. For a targeted change, inspect the request utility, DTOs, and authentication hooks only when their behavior is relied on or affected; inspect key usages, invalidation, and consumers when cache identity or hook behavior may change. Resolve the installed TanStack Query version for version-dependent semantics. Neighbors serve only unresolved conventions.

Read [workflow and authority](../../references/shared/workflow-and-authority.md) once. Apply its activation conditions to [TypeScript and objects](../../references/shared/typescript-and-objects.md) and [project architecture](../../references/shared/project-architecture.md). Read [TanStack Query](../../references/frontend/tanstack-query.md) for affected request/hook structure, keys, cache behavior, cancellation, or query/mutation semantics. Read [backend contracts](../../references/backend/backend-contracts.md) for creation or affected request, response, error, or transport semantics. A key-only change with established unchanged HTTP behavior requires neither backend source/DTO inspection nor that reference.

## Expected Result

Produce one API object exporting its raw request and query or mutation hook. Check HTTP compatibility when creating or changing transport semantics; for a key-only change, check key completeness, cache separation, and relevant invalidation/usages without reopening unchanged backend contracts.
