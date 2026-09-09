---
name: design-typescript-project
description: Design, initialize, or review a new TypeScript project using the approved Next.js, Vite, or NestJS stack. Use only for project inception, not for adding objects to an established project.
---

# Design TypeScript Project

## Responsibility and Activation

Design, initialize, or review the minimal foundation of a new Next.js, Vite, or NestJS project. Review reports confirmed findings without edits; creation writes initial files only when authorized.

Activate for a project starting from zero, framework selection, initial structure, entry points, and first real files. Do not activate for adding an object to an established project, migrating an existing application, redesigning an existing application, or standalone CI, container, or deployment work. Activate only for genuine inception. When approved implementation includes concrete artifacts, also apply their focused skills.

## Context and References

Establish the project goal, frontend or backend scope, framework, package manager, first domain modules, current directory contents, and approved dependencies.

Read [workflow and authority](../../references/shared/workflow-and-authority.md) once. Consult only task-relevant references from: [project architecture](../../references/shared/project-architecture.md). Read [TypeScript and objects](../../references/shared/typescript-and-objects.md) for real TypeScript artifacts. For the selected frontend stack, read [React](../../references/frontend/react.md) and [SCSS](../../references/frontend/scss.md). For the selected backend stack, read [NestJS](../../references/backend/nest.md) and [Mongoose](../../references/backend/mongoose.md) only when persistence is in scope. Do not load unrelated stack references or routing evaluation.

## Expected Result

Produce the selected stack, minimal real file tree, dependency list with approval-required items, layer boundaries, entry points, and required configuration. If writing is authorized, create only the approved foundation; generators, dependency installation, and package-manager operations that change `lockfile` or `node_modules` require separate confirmation.

## Process

1. Confirm that this is project inception rather than an existing-project change.
2. Determine frontend, backend, or both as separate projects; establish Next.js versus Vite where applicable.
3. Identify the first real user scenarios and artifacts.
4. Inspect current contents, dependency constraints, package-manager state, and applicable stable local or official framework information.
5. Design the minimal tree, entry points, aliases, and import boundaries.
6. Present the design and approval-required dependencies or configuration choices.
7. Obtain explicit approval before writing files when the request did not already authorize it.
8. Create only approved files and statically review the structure.

## Authority

Choose configuration placement, aliases, minimal entry points, and ordinary in-scope project configuration, including `.env`, within the approved stack. Require confirmation for frontend versus backend, Next.js versus Vite when ambiguous, every dependency, CORS, route prefix, shared environment-contract or secret-management decisions, and transition from design to file creation.

## Prevent

Prevent default monorepos, placeholder structure, premature form/test/CI dependencies, unconfirmed generators or installs, secret disclosure, deployment, and unrelated configuration.

## Verification and Completion

Complete when the tree contains only required real files, imports follow the selected layer direction, required choices are recorded, relevant safe local verification ran when available, and no empty area, unapproved dependency, confirmation-gated action, prohibited action, or scope expansion exists.

## Optional-Capability Fallback

Follow the shared fallback. If framework selection or stable compatibility cannot be established from local evidence without Context7, stop before writing and request a decision. Without Superpowers, perform the same minimal design and static review directly.
