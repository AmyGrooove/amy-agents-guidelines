---
name: develop-nest-endpoint
description: Create, fix, extend, refactor, or review a NestJS HTTP endpoint slice, including its controller, application service, input and response DTOs, mapping, and endpoint module wiring. Excludes persistence-schema ownership and standalone infrastructure modules.
---

# Develop Nest Endpoint

## Responsibility and Activation

Create, change, or review a NestJS HTTP endpoint slice.

Activate for routes, controllers, input/response DTOs, endpoint services, validation, response/error contracts, mapping, and multi-repository use cases. Do not activate for standalone entity schemas, infrastructure providers, or frontend query hooks. Own endpoint DTOs, mapping, controller, application service, and module wiring. Apply the entity skill only when a schema or repository change is genuinely required.

## Context and References

Inspect route conventions, global validation, versioning/prefix configuration, repositories, auth/decorators, error contract, Swagger setup, and neighboring endpoints.

Read [workflow and authority](../../references/shared/workflow-and-authority.md) once. Consult only task-relevant references from: [project architecture](../../references/shared/project-architecture.md), [TypeScript and objects](../../references/shared/typescript-and-objects.md), [NestJS](../../references/backend/nest.md), [backend contracts](../../references/backend/backend-contracts.md), and [backend text](../../references/backend/backend-text.md). Read [Mongoose](../../references/backend/mongoose.md) only to understand an existing persistence contract; a schema change belongs to the entity skill.

## Expected Result

Produce a complete endpoint slice with a thin controller, application service, validated DTOs, response mapping, explicit transport/error contracts, OpenAPI metadata, and module wiring.

## Process

1. Establish the HTTP route, input, success, error, auth, and version contract.
2. Inspect neighboring endpoints and global framework configuration without changing it.
3. Define DTOs, validation, ObjectId conversion, and OpenAPI metadata.
4. Inspect repository capabilities and persistence contracts.
5. Implement the application service, including transaction/session lifecycle when a transaction is required by the operation contract and used.
6. Implement the thin controller and explicit response mapping.
7. Add endpoint module wiring and statically review all boundaries.

## Authority

Choose DTO decomposition, reuse existing pipes/decorators, own transaction lifecycle in the application service when a transaction is required by the operation contract and used, and make ordinary in-scope project configuration changes, including `.env`. Require confirmation only when not already authorized for public API changes, schema/database changes, global validation, route prefix/versioning, material infrastructure or shared environment-contract changes, secret management, or dependencies.

## Prevent

Prevent controller business logic, Mongoose documents in responses, implicit ObjectId guessing, universal `data` wrappers, repository-owned transactions, unstable error envelopes, and persistence-schema ownership inside the endpoint.

## Verification and Completion

Complete when the controller is thin, inputs are validated, response DTO and error envelope are explicit, ObjectId boundaries are correct, OpenAPI matches runtime behavior, and the use case owns its transaction when a transaction is required by the operation contract and used.

## Optional-Capability Fallback

Use installed Nest, Fastify, validation, Swagger, and Mongoose types plus neighboring endpoints. Follow the shared Context7 rules; otherwise report uncertainty rather than changing global configuration.
