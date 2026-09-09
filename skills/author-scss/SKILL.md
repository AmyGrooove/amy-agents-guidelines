---
name: author-scss
description: Create, change, or review standalone SCSS, global styles, design-token infrastructure, Sass functions, mixins, or responsive resources. Do not use for a component-owned SCSS Module.
---

# Author SCSS

## Responsibility and Activation

Create, change, or review shared, global, or standalone Sass infrastructure not owned by a component. Review reports confirmed findings without edits.

Activate for `global.scss`, `reusable.scss`, reset, design tokens, Sass functions/mixins, typography, animation, and responsive resources. Do not activate for component-owned SCSS Modules, Stylelint configuration without an explicit configuration request, or component markup and state classes. Activate only when a shared/global style resource is the primary artifact.

## Context and References

Inspect the style import graph, tokens, reusable entry, consumers, browser baseline, and project Stylelint configuration. Read [workflow and authority](../../references/shared/workflow-and-authority.md) once. Consult only task-relevant references from: [SCSS](../../references/frontend/scss.md). Read [project architecture](../../references/shared/project-architecture.md) only for global or shared placement.

## Expected Result

Produce the minimal Sass infrastructure change without cycles, speculative resources, component leakage, or unapproved colors/tokens.

## Process

1. Determine ownership and whether this is genuinely shared/global.
2. Inspect reusable/global import graphs, tokens, mixins, and consumers.
3. Check project browser requirements and support for any modern CSS.
4. Change the direct resource and only real supporting files.
5. Update forwarding/imports without reverse edges.
6. Review cascade, responsive behavior, units, and reduced motion.

## Authority

Use supported modern CSS with necessary fallback, existing tokens/mixins, and a resource directory only when it contains a real file. Require confirmation for a new color/token, CSS Layers, new global style category, or browser-baseline change.

## Prevent

Prevent `!important` by default, literal colors outside token definitions, reverse imports into `reusable.scss`, excessive nesting, component styles in global resources, speculative folders, and critical unsupported selectors without fallback. Allow a narrowly scoped `!important` only for justified third-party integration after ordinary cascade and styling APIs are insufficient; report its reason in the result.

## Verification and Completion

Complete when the graph is acyclic, `reusable.scss` emits no CSS, global styles are not a component collection, and values, units, selectors, responsive behavior, and motion follow the reference.

## Optional-Capability Fallback

Use Browserslist, Stylelint configuration, existing resources, and stable local Sass behavior. Report unsupported critical CSS uncertainty; missing optional capabilities do not justify configuration or dependency changes.
