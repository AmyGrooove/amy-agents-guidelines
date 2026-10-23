---
name: develop-nest-endpoint
description: NestJS HTTP endpoints, controllers, request/response DTOs, application services, mapping, and endpoint module wiring. Excludes entity schemas/repositories and standalone infrastructure.
---

# Develop Nest Endpoint

## Responsibility and Activation

Create, change, or review a NestJS HTTP endpoint slice.

Activate for routes, controllers, input/response DTOs, endpoint services, validation, response/error contracts, mapping, and multi-repository use cases. Do not activate for standalone entity schemas, infrastructure providers, or frontend query hooks. Own endpoint DTOs, mapping, controller, application service, and module wiring. Apply the entity skill only when a schema or repository change is genuinely required.

## Context and References

Start with the endpoint implementation and affected HTTP/application contract. For creation, establish route/prefix/version, validation, auth/error conventions, Swagger setup, repository capabilities, and module integration. For a targeted change, inspect DTOs/mapping for affected inputs or outputs, guards/decorators for affected auth, repositories for relied-on data/session behavior, and global configuration only where it governs the affected behavior. Inspect neighboring endpoints only for unresolved conventions; inspect consumers when the public contract may change.

Read [workflow and authority](../../references/shared/workflow-and-authority.md) once. Apply its activation conditions to [project architecture](../../references/shared/project-architecture.md) and [TypeScript and objects](../../references/shared/typescript-and-objects.md). Read [NestJS](../../references/backend/nest.md) for affected controller/service/DTO structure, validation, auth, lifecycle, or wiring; [backend contracts](../../references/backend/backend-contracts.md) for creation or affected request/response/error semantics; and [backend text](../../references/backend/backend-text.md) for affected messages. Read [Mongoose](../../references/backend/mongoose.md) only when relied-on persistence/session semantics need investigation; schema changes belong to the entity skill.

## Expected Result

Produce the endpoint slice: controller, application service, validated input and response DTOs, response mapping, OpenAPI metadata, and module wiring. Verify the affected HTTP/application contract, including persistence/session integration when used.
