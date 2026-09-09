---
name: develop-mongoose-entity
description: Create, fix, extend, refactor, or review a Mongoose domain entity, including its schema, entity-specific repository, domain types, helpers, and entity module wiring. Excludes HTTP controllers, request DTOs, and endpoint services.
---

# Develop Mongoose Entity

## Responsibility and Activation

Create, change, or review a Mongoose domain entity and its persistence-owned slice. Review reports confirmed findings without edits.

Activate for schemas, collection options, indexes, virtuals, entity repositories, domain types/helpers, and entity module wiring. Do not activate for request/response DTOs, controllers, generic Mongo infrastructure, or endpoint response mapping. Own entity module wiring but not endpoint modules. A schema change requires confirmation unless the request explicitly asks for it.

## Context and References

Inspect schemas/plugins, collection naming, repository base, real queries/sorts/constraints, consumers, and installed MongoDB/Mongoose/Nest integration versions. Read [workflow and authority](../../references/shared/workflow-and-authority.md) once. Consult only task-relevant references from: [project architecture](../../references/shared/project-architecture.md), [TypeScript and objects](../../references/shared/typescript-and-objects.md), and [Mongoose](../../references/backend/mongoose.md).

## Expected Result

Produce a complete entity slice with explicit collection, approved schema options, justified indexes, entity-specific repository, module wiring, and minimal public API.

## Process

1. Determine domain and persistence ownership.
2. Inspect schema, repository, plugins, queries, consumers, and collection conventions.
3. Establish the persistence contract and confirm any non-explicit schema change.
4. Implement schema options, fields, virtuals, and only proven indexes.
5. Implement or adapt the entity-specific repository and session-aware operations.
6. Add necessary domain types/helpers and wire the entity module.
7. Review transport leakage, index justification, transaction ownership, and exports.

## Authority

For a new entity, apply approved timestamps, version-key, collection, and `toJSON` defaults; reuse a suitable generic repository behind an entity boundary; choose internal structure. Require confirmation for non-explicit schema/migration changes, collection renames, operationally significant indexes, destructive data implications, or dependencies.

## Prevent

Prevent speculative indexes, Mongoose documents in transport responses, repository-owned transactions, generic repository access without an entity boundary, and `_id` or `__v` leakage.

## Verification and Completion

Complete when schema options match the contract, every index maps to a real operation or constraint, repositories accept rather than own sessions/transactions, and public exports are minimal.

## Optional-Capability Fallback

Use installed Mongoose/Nest integration types and neighboring entities. Do not guess migration consequences, collection behavior, or index requirements; report material uncertainty and request a decision.
