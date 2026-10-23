# Amy Agents Guidelines

Метаданные и версия редактируются только в корневом `plugin.json` ([Agent Plugins](https://developers.openai.com/plugins/build/plugins)). Настройки OpenAI находятся в `extensions.com.openai`; `shortDescription` содержит не более 30 символов ([лимиты](https://developers.openai.com/plugins/deploy/submission)). Совместимый манифест сохраняет прежний путь для локального marketplace:

```powershell
node scripts/syncManifest.mjs
node scripts/syncManifest.mjs --check
```

Локальные проверки без сборки, установки и обращений к моделям:

```powershell
node --input-type=module -e "import { runChecks } from './scripts/buildPlugin.mjs'; runChecks();"
```

Сборка требует Node.js 22+ и Git с поддержкой `git archive --mtime`:

```powershell
node scripts/buildPlugin.mjs
```

Команда требует чистый Git index и рабочее дерево, включая untracked-файлы; после проверок повторно проверяет состояние и HEAD. Создаёт `dist/amy-agents-guidelines-<version>.zip` из файлов HEAD. Существующий архив не перезаписывается. Манифесты должны быть синхронизированы заранее; сборка их не исправляет.

Перед созданием ZIP запускаются синтаксические проверки скриптов, сверка манифестов, проверка skills/ссылок, локальная проверка каталога маршрутизации, существующие Node-тесты и `git diff --check`. Модельные эксперименты и Docker не запускаются.

В ZIP находится одна папка `amy-agents-guidelines/`: оба манифеста, Markdown/YAML skills и references, изображения assets и четыре служебных файла scripts, на которые ссылается документация проверки. Git, тесты, инструкции сопровождения, документация сборки и локальные файлы не включаются. Список файлов берётся из Git; порядок, время записей и уровень ZIP-сжатия фиксированы. Повторная сборка одного коммита той же версией Git даёт одинаковые байты.

Сборка ничего не коммитит, не синхронизирует и не устанавливает. Прежний механизм синхронизации исходной папки в локальный marketplace и установки плагина остаётся отдельной операцией.
