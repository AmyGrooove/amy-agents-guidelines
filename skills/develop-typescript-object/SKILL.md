---
name: develop-typescript-object
description: Create, fix, extend, or refactor a standalone TypeScript object. Excludes objects owned by a React, Effector, TanStack Query, Storybook, test, NestJS, or Mongoose artifact.
---

# Develop TypeScript Object

## Responsibility and Activation

Create or change an ordinary standalone non-framework TypeScript object.

Activate for functions, types, constants, generic utilities, non-framework decorators, and their local files. Do not activate for component-owned helpers, React hooks, query API objects, Nest decorators, DTOs, schemas, modules, tests, or stories. Use this only as the strict fallback when no framework-specific or owning artifact covers the object.

## Context and References

Inspect consumers, neighboring objects, types, constants, public index, installed configuration, and reusable utilities. Read [workflow and authority](../../references/workflow-and-authority.md) once. Consult only task-relevant references from: [TypeScript and objects](../../references/typescript-and-objects.md). No other reference is required.

## Expected Result

Create a complete object folder or minimal complete modification with a correct public API and updated in-scope imports.

## Process

1. Establish the object's single responsibility and consumers.
2. Find existing reusable objects before adding code.
3. Inspect and preserve the intended public signature.
4. Change the core implementation.
5. Add only necessary types, constants, or child helpers.
6. Update minimal public exports and in-scope imports.
7. Statically review the changed code and affected contract.

## Authority

Choose internal file names, object-local extraction, and reuse of an existing suitable utility. Require confirmation for breaking signatures, broad rename or deletion, and dependencies.

## Prevent

Prevent `let`, `any`, IIFEs, unjustified assertions, excess barrels, duplicated utilities, and more than two authored semantic parameters without a props object.

## Verification and Completion

Complete when the object has one responsibility, correct exports, consistent touched consumers, and no unnecessary files, directories, or framework ownership leakage.

## Optional-Capability Fallback

Use local TypeScript configuration, types, and neighboring objects. Framework uncertainty routes to the owning skill rather than this fallback. Superpowers and Context7 are not required for ordinary standalone work.
