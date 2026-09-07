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
```

Runtime используется только явно. Существующие skills не регистрируются и не
запускаются через него автоматически.

Подробнее: [архитектура Amy Runtime](references/amy-runtime.md).
