# Amy Agents Guidelines

**Стандарты Amy для TypeScript-проектов — в виде плагина для Codex.**

Помогает агенту выбирать место для кода, соблюдать правила разработки и поддерживать актуальный контекст проекта. Специализированные skills подбираются по задаче и владельцу изменяемого объекта.

Категория плагина — **Developer Tools**: его навыки предназначены для разработки кода и проектной документации. Плагин содержит инструкции и справочные стандарты, без собственного MCP-сервера.

## Возможности

| Направление | Что входит |
| --- | --- |
| Frontend | React-компоненты и хуки, Effector, TanStack Query, SCSS |
| Backend | NestJS endpoints и модули, Mongoose entities и репозитории |
| Архитектура | Создание Next.js, Vite и NestJS проектов; размещение TypeScript-объектов |
| Контекст и качество | AGENTS.md, закрепление рабочих правил, тесты и Storybook по явному запросу |

AGENTS.md и связанную агентную документацию можно создать по запросу. При реализации поддерживаются только затронутые документы об уже описанных предметах; новые темы документации требуют запроса.

## Требования и установка

Для использования нужен Codex с поддержкой плагинов и marketplace. Для локальных проверок нужен Node.js с командами `--check` и `--test`; зависимости npm и сборка не требуются. Приведённые проверки выполняются из корня source checkout.

Плагин устанавливается через marketplace, в котором зарегистрирован `amy-agents-guidelines`. Для локального marketplace укажите путь к его корню и имя из его манифеста; корни настроенных marketplace можно посмотреть командой `codex plugin marketplace list`:

```sh
codex plugin marketplace add /path/to/marketplace
codex plugin add amy-agents-guidelines --marketplace marketplace-name
```

Замените `/path/to/marketplace` и `marketplace-name` своими значениями. Корень этого репозитория сам по себе не является marketplace. Если marketplace уже настроен, достаточно второй команды.

## Использование

После установки описывайте задачу обычным языком:

> Создай React-компонент по стандартам проекта.
>
> Добавь NestJS endpoint для получения коллекции.
>
> Создай проектный AGENTS.md и связанную агентную документацию на основе кода проекта.

Явные требования пользователя, инструкции проекта и обязательные контракты имеют приоритет над стандартами плагина. Навыки находятся в `skills/`, общие правила — в [workflow-and-authority.md](references/shared/workflow-and-authority.md).

## Структура плагина

- [plugin.json](plugin.json) — метаданные, версия и настройки OpenAI в `extensions.com.openai`.
- `skills/<name>/SKILL.md` — специализированные навыки; `agents/openai.yaml` внутри навыков — настройки их обнаружения.
- `references/` — общие и предметные стандарты; [workflow-and-authority.md](references/shared/workflow-and-authority.md) — общие правила работы.
- `scripts/` — валидатор плагина, инструменты оценки маршрутизации, `routing-expectations.json` с ожиданиями и локальные тесты в `__tests__/`.
- `assets/` — визуальные ресурсы; [AGENTS.md](AGENTS.md) — правила сопровождения.

## Локальные тесты и валидация

```sh
node --check scripts/verifyPlugin.mjs
node --check scripts/evaluateRouting.mjs
node --check scripts/verifyInstalledPlugin.mjs
node scripts/verifyPlugin.mjs .
node scripts/evaluateRouting.mjs check
node scripts/verifyInstalledPlugin.mjs
node --test scripts/__tests__/*.test.mjs
git diff --check
```

`verifyPlugin.mjs` проверяет manifest, ограничения Agent Skills, поддерживаемый YAML/frontmatter, explicit-only policy, ресурсы, пути и локальные Markdown-ссылки. Внешние ссылки не загружаются; symlinks/junctions отклоняются. Поддерживаются строки, literal/folded blocks и вложенная строковая metadata; неподдерживаемый YAML явно отклоняется. Ограничения формата сверены со [спецификацией Agent Skills](https://agentskills.io/specification), manifest — со [схемой Agent Plugins 1.0.0](https://agent-plugins.org/schemas/1.0.0/plugin.schema.json).

CLI дополнительно вызывает `skills-ref validate` для каждого skill, если валидатор установлен отдельно и доступен в PATH. Его отсутствие явно выводится как `skipped`; зависимости автоматически не устанавливаются. Команда `node scripts/verifyPlugin.mjs . --skills-ref` требует эту проверку: отсутствие валидатора или ошибка дают ненулевой exit code. Собственные semantic/security проверки сохраняются независимо от внешнего валидатора.

`evaluateRouting.mjs check` проверяет 235 offline-сценариев, структурированные expectations, хеши исходных строк и границы skills. Unit-тесты проверяют локальные инструменты и правила. Синтетические решения не подтверждают реальную активацию skills, чтение инструкций или качество реализации (`modelBehaviorEvaluated: false`). API-зависимые команды evaluator удалены.

`verifyInstalledPlugin.mjs` без аргументов создаёт временную копию layout, проверяет manifest, все 16 skills, references, ссылки и побайтовую целостность файлов через SHA-256, затем удаляет копию. Для проверки фактической установки: `node scripts/verifyInstalledPlugin.mjs /path/to/installed/plugin`. Необязательный второй аргумент задаёт source checkout. Сравниваются все файлы, кроме Git-метаданных; дополнительные, отсутствующие и изменённые файлы дают ошибку. Это локальная проверка структуры, а не имитация установки или активации через Codex.

## Обновление и сопровождение

Источник правды — source checkout. Меняйте файлы только в нём; установленные и кэшированные копии напрямую не редактируйте. Сохраняйте [правила сопровождения](AGENTS.md).

1. Обновите версию в `plugin.json`: `MAJOR.MINOR.PATCH` без суффиксов. PATCH — исправления и уточнения, MINOR — совместимые возможности, MAJOR — несовместимые изменения; выбранная часть увеличивается на 1, младшие обнуляются.
2. Выполните локальные проверки выше.
3. Синхронизируйте содержимое плагина из source checkout в каталог, указанный локальным marketplace; Git-метаданные не копируйте. Если marketplace ссылается непосредственно на source checkout, отдельное копирование не требуется.
4. Переустановите плагин через настроенный marketplace:

```sh
codex plugin remove amy-agents-guidelines --marketplace marketplace-name
codex plugin add amy-agents-guidelines --marketplace marketplace-name
```

5. Проверьте установленную версию и совпадение файлов с source checkout, затем выполните `node scripts/verifyInstalledPlugin.mjs /path/to/installed/plugin`, заменив путь фактическим каталогом установленного плагина.

Не добавляйте cachebuster, не меняйте код сопровождаемых проектов и не создавайте Git-коммиты при сопровождении плагина.
