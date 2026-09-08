---
name: author-storybook-story
description: Create or change a Storybook story only when the user explicitly requests a story, Storybook scenario, or story documentation artifact. Never activate merely because a component changed.
---

# Author Storybook Story

## Responsibility and Activation

Create or change an explicitly requested Storybook story artifact. An accepted offer to inspect and update existing files supplies this authorization.

Activate for a direct semantic request to add, repair, or update a story, scenario, args, argTypes, or Storybook component documentation. Do not activate for ordinary component changes, generic visual checking, or possible story impact without confirmation. Automatic discovery is allowed, but the story artifact must be explicit.

## Context and References

Inspect the top-level component public API, existing story, installed Storybook version/configuration, and neighboring stories. Read [workflow and authority](../../references/standards/workflow-and-authority.md) once. Consult only task-relevant references from: [Storybook](../../references/frontend/storybook.md), and [React](../../references/frontend/react.md). Read [TypeScript and objects](../../references/standards/typescript-and-objects.md) only when types change.

## Expected Result

Produce one meaningful top-level story file with metadata, `TStory`, `DocsPreview`, args, argTypes, and necessary distinct scenarios.

## Process

1. Confirm explicit story intent and top-level component ownership.
2. Inspect component props, installed configuration, and neighboring stories.
3. Choose meaningful, non-duplicative scenarios.
4. Create or update metadata, args, and complete argTypes.
5. Define `TStory`, `DocsPreview`, and required distinct stories.
6. Use custom `render` only when necessary and statically review types.

## Authority

Choose meaningful states and args directly implied by public props. Require confirmation before changing the component API for the story or when a production task only incidentally affects an existing story.

## Prevent

Prevent automatic story generation, internal-component stories, empty or duplicate scenarios, English story descriptions, unnecessary custom render functions, and unauthorized production changes.

## Verification and Completion

Complete when metadata uses `satisfies`, all props are documented, scenarios are distinct, `DocsPreview` uses `!dev`, the installed Storybook contract is respected, and relevant safe local verification ran when available.

## Optional-Capability Fallback

Use installed Storybook types/configuration and neighboring stories. Do not change configuration or dependencies because optional documentation access is missing; report material version uncertainty.
