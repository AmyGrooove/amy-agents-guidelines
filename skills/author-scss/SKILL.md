---
name: author-scss
description: Standalone/shared/global SCSS, design tokens, Sass functions, mixins, and responsive resources. Excludes component-owned SCSS Modules and tooling-only configuration.
---

# Author SCSS

## Responsibility and Activation

Create, change, or review shared, global, or standalone Sass infrastructure not owned by a component.

Activate for `global.scss`, `reusable.scss`, reset, design tokens, Sass functions/mixins, typography, animation, and responsive resources. Do not activate for component-owned SCSS Modules, tooling-only configuration, or component markup and state classes. Activate only when a standalone/shared/global style resource is the primary artifact.

## Context and References

Start with the affected resource and its emitted CSS or Sass API. For creation, establish shared/global ownership, reusable/global entry integration, and existing suitable tokens/mixins. For a targeted change, read tokens/mixins only where the changed rules rely on them; inspect import/forward edges and consumers when exported Sass APIs, emitted selectors, token values, or cascade may affect them. Check browser baseline for changed CSS support requirements and Stylelint configuration for relevant lint rules. Neighbors serve only unresolved conventions.

Read [workflow and authority](../../references/shared/workflow-and-authority.md) once. Read [SCSS](../../references/frontend/scss.md) for affected style, token, layout, responsive, motion, or cascade contracts. Apply the shared activation conditions to [project architecture](../../references/shared/project-architecture.md).

## Expected Result

Produce the minimal shared/global Sass change and necessary import/forward updates. Verify the affected cascade, emitted CSS, exported Sass API, browser support, responsive behavior, and motion. Report any justified third-party `!important` exception.
