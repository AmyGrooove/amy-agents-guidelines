---
name: design-typescript-project
description: New Next.js, Vite, or NestJS project inception, design, and initialization. Excludes additions to existing projects, migrations, and standalone CI/container/deployment work.
---

# Design TypeScript Project

## Responsibility and Activation

Design, initialize, or review the minimal foundation of a new Next.js, Vite, or NestJS project.

Activate for a project starting from zero, framework selection, initial structure, entry points, and first real files. Do not activate for adding an object to an established project, migrating an existing application, redesigning an existing application, or standalone CI, container, or deployment work. Activate only for genuine inception. Architecture-only inception stays with this skill, including layers, aliases, and planned public APIs; do not load placement or artifact skills just to confirm their exclusions. When authorized implementation includes concrete artifacts, also apply their focused skills.

## Context and References

Establish the project goal, frontend or backend scope, framework, package manager, first domain modules, current directory contents, and approved dependencies.

Read [workflow and authority](../../references/shared/workflow-and-authority.md) once and [project architecture](../../references/shared/project-architecture.md) for inception boundaries and structure. Apply the shared activation conditions to [TypeScript and objects](../../references/shared/typescript-and-objects.md); architecture-only planning does not trigger it. For the selected frontend stack, read [React](../../references/frontend/react.md) when component structure, rendering, or client boundaries are in scope, and [SCSS](../../references/frontend/scss.md) when style infrastructure, tokens, or layout decisions are in scope. For the selected backend stack, read [NestJS](../../references/backend/nest.md) for module/entrypoint structure or framework integration; read [Mongoose](../../references/backend/mongoose.md) only when persistence is in scope. Do not load unrelated stack references or routing evaluation. Project inception establishes the foundation; it does not require inventories of future consumers, DTOs, styles, or dictionaries.

## Expected Result

Produce the selected stack, minimal real file tree, authorized dependency list, layer boundaries, entry points, and required configuration. If writing is authorized, create only the approved foundation; an explicitly requested generator or dependency update includes its necessary package-manager and lockfile work.

## Process

1. Identify the first real user scenarios and artifacts before selecting the foundation.
2. Resolve material stack and dependency choices, then design the tree, entry points, aliases, and import boundaries using the selected references.
3. Deliver the design or authorized initial files and verify the resulting foundation against those choices.
