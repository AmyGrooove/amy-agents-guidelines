---
name: develop-mongoose-entity
description: Mongoose entities, schemas, indexes, entity repositories, domain types/helpers, and entity module wiring. Excludes endpoint DTOs/services/controllers and shared Mongo infrastructure.
---

# Develop Mongoose Entity

## Responsibility and Activation

Create, change, or review a Mongoose domain entity and its persistence-owned slice.

Activate for schemas, collection options, indexes, virtuals, entity repositories, domain types/helpers, and entity module wiring. Do not activate for request/response DTOs, controllers, generic Mongo infrastructure, or endpoint response mapping. Own entity module wiring but not endpoint modules.

## Context and References

Start with the affected schema/repository operation and persistence contract. For creation, establish collection conventions, schema/plugin defaults, repository base, module integration, and actual query/index needs. For a targeted change, follow only relevant fields, plugins, base methods, queries/sorts, sessions, and consumers; inspect them when data compatibility, constraints, results, or transaction behavior may change. Resolve installed MongoDB/Mongoose/Nest integration versions when relied-on semantics require them. Neighbors serve only unresolved conventions.

Read [workflow and authority](../../references/shared/workflow-and-authority.md) once. Apply its activation conditions to [project architecture](../../references/shared/project-architecture.md) and [TypeScript and objects](../../references/shared/typescript-and-objects.md). Read [Mongoose](../../references/backend/mongoose.md) for affected schema/entity structure, persistence, repository, index, session, or integration contracts. Read [NestJS](../../references/backend/nest.md) when entity module/provider structure or wiring is affected; ownership remains with this skill.

## Expected Result

Produce the entity slice with its schema, justified indexes, entity-specific repository, domain artifacts, module wiring, and public API. Verify affected persistence compatibility and session behavior.
