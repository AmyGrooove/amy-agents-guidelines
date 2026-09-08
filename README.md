# Amy Agents Guidelines

Персональный плагин Codex с правилами разработки и явно вызываемым Runtime на
Node.js и TypeScript.

## Требования

- Node.js 20 или новее
- pnpm 11

## Установка

```text
pnpm install
pnpm build
```

Команда `pnpm install` устанавливает инструменты сборки. Команда `pnpm build`
создаёт игнорируемый каталог `runtime/dist`. До сборки Runtime API и CLI
недоступны.

## Разработка

```text
pnpm build
pnpm check
```

Исходники TypeScript находятся в `src` и разделены на `shared`, `entities`, `modules`, `app`. Не редактируйте `runtime/dist`
вручную: это generated artifact, который не хранится в Git.

## Runtime CLI

```text
node runtime/dist/cli.js status
node runtime/dist/cli.js capabilities
node runtime/dist/cli.js inventory
node runtime/dist/cli.js config --project <path>
node runtime/dist/cli.js doctor --project <path>
node runtime/dist/cli.js intelligence-discover --project <path>
node runtime/dist/cli.js intelligence-show --project <path>
node runtime/dist/cli.js intelligence-graph-build --project <path>
node runtime/dist/cli.js intelligence-freshness-show --project <path>
node runtime/dist/cli.js intelligence-impact --project <path> --module <module-id>
node runtime/dist/cli.js task-contract-validate --input <contract.json>
node runtime/dist/cli.js task-classify --input <classification-input.json>
node runtime/dist/cli.js context-resolve --input <context-input.json> --project <path>
node runtime/dist/cli.js compute-route --input <compute-input.json> --project <path>
node runtime/dist/cli.js strategy-route --input <strategy-input.json> --project <path>
node runtime/dist/cli.js decomposition-plan --input <decomposition-input.json> --project <path>
node runtime/dist/cli.js verification-evaluate --input <verification-input.json> --project <path>
node runtime/dist/cli.js completion-evaluate --input <completion-input.json> --project <path>
node runtime/dist/cli.js recovery-plan --input <recovery-input.json> --project <path>
node runtime/dist/cli.js observability-record --input <observability-input.json> --project <path>
node runtime/dist/cli.js analyze --input <analytics-input.json> --project <path>
node runtime/dist/cli.js eval --input <eval-input.json> --project <path>
```

Runtime используется только явно. Существующие skills не регистрируются и не
запускаются через него автоматически.

Подробнее: [архитектура Amy Runtime](references/runtime/core/amy-runtime.md) и
[Project Intelligence](references/runtime/context/project-intelligence.md) и
[Task Intelligence](references/runtime/context/task-intelligence.md) и
[Context Intelligence](references/runtime/context/context-intelligence.md) и
[Compute Routing](references/runtime/planning/compute-routing.md),
[Agent Roles + Handoff](references/runtime/planning/agent-roles.md) и
[Strategy Routing](references/runtime/planning/strategy-routing.md),
[Decomposition + DAG](references/runtime/planning/decomposition.md) и
[Verification Pipeline](references/runtime/quality/verification.md) и
[Completion Protocol](references/runtime/quality/completion.md) и
[Retry + Escalation](references/runtime/quality/recovery.md) и
[Observability + Decision Provenance](references/runtime/data/observability.md) и
[Data Storage + Privacy](references/runtime/data/data-storage.md) и
[Outcome + Failure Intelligence](references/runtime/data/outcome-intelligence.md) и
[Eval System](references/runtime/improvement/eval-system.md) и
[Analytics Engine + Task Archetypes + Mechanism Health](references/runtime/improvement/analytics.md) и
[Controlled Evolution](references/runtime/improvement/evolution.md) и
[Amy Operations](references/runtime/core/operations.md) и
[решение по Optional MCP Layer](references/runtime/core/mcp.md) и
[Final Integration + Hardening](references/runtime/core/hardening.md).
