---
name: develop-nest-module
description: Create, fix, extend, refactor, or review a standalone NestJS infrastructure or composition module and its module-owned services or supporting objects. Excludes Mongoose entities and HTTP endpoint slices.
---

# Develop Nest Module

## Responsibility and Activation

Create, change, or review standalone NestJS infrastructure/composition and its owned support objects when no more specific backend skill applies. Review reports confirmed findings without edits.

Activate for infrastructure and composition modules, standalone services, guards, pipes, filters, and Nest decorators outside entity or endpoint ownership. Do not activate for entity schemas/repositories, controllers/endpoint DTOs, or generic pure helpers. This is the Nest-owned fallback; entity and endpoint skills take priority.

## Context and References

Inspect the module graph, imports, providers, exports, infrastructure services, installed Nest/Fastify versions, and consumers.

Read [workflow and authority](../../references/shared/workflow-and-authority.md) once. Consult only task-relevant references from: [project architecture](../../references/shared/project-architecture.md), [TypeScript and objects](../../references/shared/typescript-and-objects.md), and [NestJS](../../references/backend/nest.md). Read [backend contracts](../../references/backend/backend-contracts.md) only for filters/pipes affecting transport contracts, and [backend text](../../references/backend/backend-text.md) only when messages are in scope.

## Expected Result

Produce a minimal module slice with a thin metadata file, required providers/supporting objects, and correct minimal exports.

## Process

1. Determine infrastructure/composition ownership and exclude entity/endpoint ownership.
2. Inspect the existing module/provider and module graph.
3. Define the minimal imports, providers, and exports.
4. Implement the service, guard, pipe, filter, or decorator in its owned location.
5. Keep root module metadata thin and avoid new global behavior.
6. Review graph cycles, visibility, consumers, and optional transport effects.

## Authority

Choose provider placement, module-local folders, and ordinary in-scope project configuration changes, including `.env`, within the established architecture. Require confirmation for a backend folder category, material infrastructure or shared environment-contract change, secret management, dependency, global provider/pipeline, or public API change.

## Prevent

Prevent business logic in module metadata, duplicated infrastructure, unnecessary global registration, mega-barrel modules, entity/endpoint ownership leakage, and an invented BullMQ/scheduler standard.

## Verification and Completion

Complete when the module graph is acyclic, providers are visible only where needed, exports match consumers, and the root module file contains only metadata and its class.

## Optional-Capability Fallback

Use installed Nest/Fastify types and neighboring modules. Follow the shared Context7 rules; otherwise report unresolved uncertainty without changing configuration.
