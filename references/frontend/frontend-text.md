# Frontend Text

Write ordinary user-facing project text in Russian. Text used only inside code, including test and Storybook descriptions, is also Russian. Do not add locale switching or an i18n dependency without a separate decision.

Use exactly these centralized sources:

- `shared/static/SHARED_DICTIONARY.ts` for portable text consumed by `shared` and `providers`;
- `entities/services/static/DICTIONARY.ts` for all project-specific text consumed by `entities`, pages or routes, and `app`.

The project dictionary is one global source nested by meaningful page, feature, object, and section areas. Do not create local per-component or per-page dictionaries.
