---
name: develop-tanstack-query-api
description: Create, fix, extend, or refactor a TanStack Query API object containing its raw request and query or mutation hook. Excludes backend endpoints and generic fetch utilities.
---

# Develop TanStack Query API

## Responsibility and Activation

Create or change one frontend API object containing its raw request and TanStack Query hook.

Activate for query/mutation hooks, query keys, request/response types, cancellation, and raw frontend requests. Do not activate for backend endpoints, generic `fetchData`, Effector state, or a component that only consumes a correct hook. Own the response/body types, raw request, hook, and key for one API object.

## Context and References

Inspect the installed TanStack Query version, `fetchData`, backend DTO/error contract, existing keys, supporting authentication hooks, consumers, and target layer.

Read [workflow and authority](../../references/workflow-and-authority.md) once. Consult only task-relevant references from: [TypeScript and objects](../../references/typescript-and-objects.md), [TanStack Query](../../references/tanstack-query.md), and [backend contracts](../../references/backend-contracts.md). Read [project architecture](../../references/project-architecture.md) only when the layer is unclear.

## Expected Result

Produce a `use<Method><Name>` object exporting its raw request and query or mutation hook with correct types, signal propagation, key, and error flow.

## Process

1. Inspect the backend contract, `fetchData`, keys, and consumers.
2. Define response and optional body types.
3. Implement and export the raw request returning the direct DTO.
4. Implement the query or mutation according to HTTP semantics.
5. Build the complete key and pass TanStack Query's `AbortSignal`.
6. Invoke necessary supporting hooks internally.
7. Update exports and consumers and statically compare both contracts.

## Authority

Choose query versus mutation from HTTP semantics, include every result-affecting input in the key, and invoke existing supporting hooks internally. Require confirmation for backend/public API changes, dependencies, or a new universal error abstraction.

## Prevent

Prevent universal `data` wrappers, manual cancellation controllers, incomplete keys, swallowed errors, duplicated caller wiring, server-cache duplication in Effector, and undeclared `undefined` for `204`.

## Verification and Completion

Complete when the raw request and hook are exported, the key is exact, the signal reaches the request, and success/error types match the backend contract.

## Optional-Capability Fallback

Use installed types, local package documentation, and neighboring API objects. Follow the shared Context7 rules and report unresolved uncertainty rather than guessing.
