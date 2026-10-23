---
name: route-project-changes
description: Use for authorized project file changes, before adding, editing, deleting, or generating files. Select the owning Amy skill or shared workflow. Excludes read-only design, review, and explanation, even when they describe future file changes.
---

# Route Project Changes

Use this skill as the Amy entrypoint for every task that writes project files, including code, configuration, scripts, assets, and documentation. It selects guidance; it does not replace the skill that owns an artifact or authorize additional changes. A design or review that only describes future files does not select this router without authorization to write them.

1. Before inspecting project code, identify the requested changes from the user's request and the affected artifact types. Tell the user that this Amy routing skill is in use. Refine the selection after inspecting only the context needed for the task.
2. Select owning skills from the available names and descriptions for artifacts whose behavior, structure, or contract will change. Component-, model-, API-, endpoint-, and entity-owned internals stay with their owner; do not load standalone skills for them. Read selected skills, not every candidate or linked skill. Refine ownership from project evidence when needed. Follow [workflow and authority](../../references/shared/workflow-and-authority.md) once, then only the references those skills require for this task.
3. Keep mechanical consumer updates with the owning skill. Add another skill only when that consumer's own behavior, structure, or contract changes. Do not activate test or Storybook skills without an explicit request for those artifacts.
4. If no specialized Amy skill owns the change, use this skill with the shared workflow. Apply its scope, authority, preservation, and verification rules; use project conventions where Amy has no artifact-specific standard. Do not force an unrelated skill onto the task.
5. Before editing, confirm that the selected route covers every requested file change and form the task-scoped rule checklist from the shared workflow. If later inspection reveals another artifact type, select its owning skill and update the applicable requirements before changing it.
6. Before completion, apply the shared diff and necessity review as well as the owning skill's completion criteria. Correct in-scope violations and report material unverified requirements. Report the Amy route used in the final result.

This entrypoint does not make read-only tasks writable, expand the requested scope, or override user restrictions on tests, Storybook, documentation, commits, or external actions.
