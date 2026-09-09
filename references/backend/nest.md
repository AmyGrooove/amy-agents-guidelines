# NestJS

Follow stable official NestJS patterns and the installed project versions. Follow the shared Context7 rules for library-specific questions.

## New Applications

Default to the Fastify adapter, global `ValidationPipe` with `transform`, `whitelist`, and `forbidNonWhitelisted`, URI versioning, Swagger/OpenAPI, and shutdown hooks. Configure CORS only for an approved cross-origin consumer. Add a route prefix only for the chosen public URL convention and do not accidentally combine it with URI versioning. Required dependencies still need approval and are never installed automatically.

## Modules and Responsibilities

Every backend slice is a Nest module. Module and slice folders use lower camel case. The root `<moduleName>.module.ts` contains only its `@Module` class and metadata. Name services `<serviceName>.service.ts`, repositories `<entityName>.repository.ts`, and controllers `<controllerName>.controller.ts`. Create module-local `types`, `static`, or `functions` only for real files.

Controllers are thin. Application services own business logic and response mapping. Extract pure or reusable service logic only when it improves clarity or reuse. Repositories own data access. Every entity has an entity-specific repository boundary, optionally backed by an existing suitable generic infrastructure repository. Reuse existing infrastructure; do not add a backend folder category without approval.

Endpoint services map persistence documents to response DTOs or explicit response models. Controllers never return Mongoose documents. The application service defining a multi-repository use case owns `ClientSession` and transaction lifecycle and passes the session into repositories; repositories never start or commit transactions implicitly.

## DTOs and Boundaries

DTO folders may contain `body`, `query`, `params`, and `response`. Files use `<name>.<kind>.ts`; class names end in `Dto` and do not use `I` or `T`. Input DTOs use `class-validator`; use `class-transformer` only for a real transformation. Describe endpoint contracts with stable Swagger/OpenAPI decorators.

Prefer the global `ValidationPipe` configuration above. ObjectId conversion is explicit through an approved pipe or transform. Public params and OpenAPI describe ObjectId as a string; the pipe validates and converts it, and the service receives `Types.ObjectId`. Do not create a standalone `validateDto` baseline helper.

Custom Nest decorators use PascalCase and the function-object structure. Existing queue or scheduler plumbing may be maintained by the Nest module skill, but do not invent a new standard without a separate approved design.

Static completion requires an acyclic module graph, minimal provider visibility, thin metadata/controllers, owned business logic, explicit DTO validation and ObjectId boundaries, and application-service transaction ownership.
