---
name: author-storybook-story
description: Explicitly requested Storybook stories, scenarios, args/argTypes, or component documentation. Excludes component-only changes and generic visual checks.
---

# Author Storybook Story

## Responsibility and Activation

Create, change, or review an explicitly requested Storybook story artifact. An accepted offer to inspect and update existing files supplies this authorization.

Activate for a direct semantic request to add, repair, or update a story, scenario, args, argTypes, or Storybook component documentation. Do not activate for ordinary component changes, generic visual checking, or possible story impact without confirmation. Automatic discovery is allowed, but the story artifact must be explicit.

## Context and References

Start with the affected story and the component props/behavior used by the requested scenarios. For creation, establish the complete top-level public API, installed Storybook setup, and file placement; inspect a neighbor only for an unresolved convention. For a targeted change, inspect configuration, decorators, fixtures, and version only where the affected rendering or metadata relies on them.

Read [workflow and authority](../../references/shared/workflow-and-authority.md) once. Read [Storybook](../../references/frontend/storybook.md) for affected story structure, metadata, args/argTypes, or scenarios; [React](../../references/frontend/react.md) for affected component/JSX, props, lifecycle, or client semantics. Apply the shared activation conditions to [TypeScript and objects](../../references/shared/typescript-and-objects.md) and [project architecture](../../references/shared/project-architecture.md).

## Expected Result

Produce the requested top-level story file with complete prop documentation and meaningful distinct scenarios. Verify its metadata and rendering against the installed Storybook contract.
