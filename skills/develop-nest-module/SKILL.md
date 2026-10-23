---
name: develop-nest-module
description: Standalone NestJS infrastructure/composition modules, services, guards, pipes, filters, and decorators. Excludes entity-owned or endpoint-owned artifacts and pure helpers.
---

# Develop Nest Module

## Responsibility and Activation

Create, change, or review standalone NestJS infrastructure/composition and its owned support objects when no more specific backend skill applies.

Activate for infrastructure and composition modules, standalone services, guards, pipes, filters, and Nest decorators outside entity or endpoint ownership. Do not activate for entity schemas/repositories, controllers/endpoint DTOs, or generic pure helpers. This is the Nest-owned fallback; entity and endpoint skills take priority.

## Context and References

Start with the affected module/provider and its responsibility. For creation, establish placement, required services, imports/providers/exports, and consuming module integration. For a targeted change, inspect graph edges and consumers when wiring, visibility, dependency injection, or lifecycle may change; inspect service dependencies and installed Nest/Fastify versions when relied-on behavior requires them. Inspect a neighbor only for an unresolved convention.

Read [workflow and authority](../../references/shared/workflow-and-authority.md) once. Apply its activation conditions to [project architecture](../../references/shared/project-architecture.md) and [TypeScript and objects](../../references/shared/typescript-and-objects.md). Read [NestJS](../../references/backend/nest.md) for affected module/provider structure, dependency injection, lifecycle, guards, pipes, filters, or decorators. Read [backend contracts](../../references/backend/backend-contracts.md) for affected transport contracts, and [backend text](../../references/backend/backend-text.md) for affected messages.

## Expected Result

Produce the infrastructure/composition slice with its metadata, required providers/supporting objects, and public exports. Verify affected dependency injection, lifecycle, graph edges, and consuming-module integration.
