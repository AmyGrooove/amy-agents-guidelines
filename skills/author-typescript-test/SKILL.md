---
name: author-typescript-test
description: Explicitly requested TypeScript test authoring, repair, or review. Excludes test execution, generic verification, and production-only changes.
---

# Author TypeScript Test

## Responsibility and Activation

Create, change, or review an explicitly requested TypeScript test artifact. An accepted offer to inspect and update existing files supplies this authorization.

Activate for writing a test, adding a test case or regression, repairing a test file, or covering explicitly named behavior. Do not activate for production work alone, command execution, or generic verification without a test artifact.

## Context and References

Start with the requested behavior's production contract and affected tests. For creation, establish test placement, runner/setup, and suitable existing mocks/fixtures; inspect a neighbor only for an unresolved convention. For a targeted change, inspect setup, mocks, fixtures, and dependencies only where affected cases rely on them. Read production consumers only to resolve the tested contract or interactions.

Read [workflow and authority](../../references/shared/workflow-and-authority.md) once. Read [testing](../../references/shared/testing.md) for affected cases, assertions, test structure, or failure diagnosis. Apply the shared activation conditions to [TypeScript and objects](../../references/shared/typescript-and-objects.md) and [project architecture](../../references/shared/project-architecture.md); read the tested artifact's reference only to resolve its relevant behavior or contract.

## Expected Result

Produce the requested test artifact and meaningful coverage of every applicable case in the scoped case map. Follow the testing reference for failure diagnosis and coverage review; report uncovered or blocked cases as partial completion and give the actual test result or execution limit.
