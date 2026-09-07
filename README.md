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

Исходники TypeScript находятся в `runtime/src`. Не редактируйте `runtime/dist`
вручную: это generated artifact, который не хранится в Git.

## Runtime CLI

```text
node runtime/dist/cli.js status
node runtime/dist/cli.js capabilities
node runtime/dist/cli.js inventory
node runtime/dist/cli.js config --project <path>
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
```

Runtime используется только явно. Существующие skills не регистрируются и не
запускаются через него автоматически.

Подробнее: [архитектура Amy Runtime](references/amy-runtime.md) и
[Project Intelligence](references/project-intelligence.md) и
[Task Intelligence](references/task-intelligence.md) и
[Context Intelligence](references/context-intelligence.md) и
[Compute Routing](references/compute-routing.md),
[Agent Roles + Handoff](references/agent-roles.md) и
[Strategy Routing](references/strategy-routing.md),
[Decomposition + DAG](references/decomposition.md) и
[Verification Pipeline](references/verification.md).
