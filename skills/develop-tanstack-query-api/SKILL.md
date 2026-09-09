---
name: develop-tanstack-query-api
description: Create, fix, extend, refactor, or review a TanStack Query API object containing its raw request and query or mutation hook. Excludes backend endpoints and generic fetch utilities.
---

# Develop TanStack Query API

## Responsibility and Activation

Create, change, or review one frontend API object containing its raw request and TanStack Query hook. Review reports confirmed findings without edits.

Activate for query/mutation hooks, query keys, request/response types, cancellation, and raw frontend requests. Do not activate for backend endpoints, generic `fetchData`, Effector state, or a component that only consumes a correct hook. Own the response/body types, raw request, hook, and key for one API object.

## Context and References

Inspect the installed TanStack Query version, `fetchData`, backend DTO/error contract, existing keys, supporting authentication hooks, consumers, and target layer.

Read [workflow and authority](../../references/shared/workflow-and-authority.md) once. Consult only task-relevant references from: [TypeScript and objects](../../references/shared/typescript-and-objects.md), [TanStack Query](../../references/frontend/tanstack-query.md), and [backend contracts](../../references/backend/backend-contracts.md). Read [project architecture](../../references/shared/project-architecture.md) only when the layer is unclear.

## Expected Result

Produce a `use<Method><Name>` object exporting its raw request and query or mutation hook with correct types and error flow. For a query, also provide its complete key and signal propagation.

## Process

1. Inspect the backend contract, `fetchData`, keys, and consumers.
2. Define response and optional body types.
3. Implement and export the raw request returning the direct DTO.
4. Choose query or mutation by operation semantics; use HTTP method only as evidence.
5. For a query, build the complete key and pass TanStack Query's `AbortSignal`; do not impose these requirements on mutation.
6. Invoke necessary supporting hooks internally.
7. Update exports and consumers and statically compare both contracts.

## Authority

Choose query versus mutation from operation semantics, include every result-affecting input in a query key, and invoke existing supporting hooks internally. Require confirmation for backend/public API changes, dependencies, or a new universal error abstraction.

## Prevent

Prevent universal `data` wrappers, manual cancellation controllers, incomplete keys, swallowed errors, duplicated caller wiring, server-cache duplication in Effector, and undeclared `undefined` for `204`.

## Verification and Completion

Complete when the raw request and hook are exported and success/error types match the backend contract; for a query, its key is exact and the supplied signal reaches the request.

## Optional-Capability Fallback

Use installed types, local package documentation, and neighboring API objects. Follow the shared Context7 rules and report unresolved uncertainty rather than guessing.
