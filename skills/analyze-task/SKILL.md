---
name: analyze-task
description: Use when Amy needs to normalize a user development request into a Task Contract or classify task complexity, uncertainty, scope, risk, coupling, blast radius, novelty, parallelizability, context cost, or verification cost before orchestration.
---

# Analyze Task

## Responsibility

Turn the explicit user request and already available conversation evidence into a compact Task Contract, then use Amy Task Intelligence for deterministic classification. This is task understanding, not repository exploration or execution strategy.

Read [Task Intelligence](../../references/runtime/context/task-intelligence.md) for the canonical contract, classification dimensions, reason codes, Runtime API, and CLI.

## Process

1. Start from the user's explicit request and relevant conversation constraints only. Do not inspect the repository merely to classify the task.
2. Normalize only evidence-backed fields: `goal`, `requirements`, `nonGoals`, `constraints`, `acceptanceCriteria`, `affectedScope`, `uncertainties`, and `verificationExpectations`.
3. Keep the goal concise without changing intent. Separate requirements from acceptance criteria and non-goals instead of copying the same sentence into multiple fields.
4. Use `affectedScope.kind: "unknown"` or omit the field when scope cannot be established from available evidence. Add `targets` only when their identity is already known.
5. Use an explicit empty array only when the source evidence supports that the category is known to be empty. Omit a field when it is genuinely unknown.
6. Validate the result with `task-contract-validate`, then classify it with `task-classify` without `projectEvidence` for the default text-only triage.
7. Treat `confidence`, `reasonCodes`, and `evidenceGaps` as orchestration evidence, not commands. Low confidence does not itself authorize repository-wide exploration.
8. Add `projectEvidence` only from Project Intelligence results that were already obtained for the current work or from explicitly requested targeted inspection. Never rebuild the graph, refresh freshness fingerprints, or scan source code merely to make classification more certain.
9. Preserve `unknown` dimensions when evidence is missing. Do not invent numeric scores or force categorical certainty.

## Boundaries

- Do not resolve task context, choose files to read, select agents/models, decompose work, or decide execution strategy here.
- Do not turn Project Intelligence into a required dependency of Task Intelligence.
- Do not reinterpret a missing field as negative evidence; omission means unknown unless the contract explicitly carries an empty array.
- Do not persist raw prompts or create task history as part of this stage.
