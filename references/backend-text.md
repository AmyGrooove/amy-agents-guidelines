# Backend Text

Use two centralized dictionaries and no locale switching in version 1:

- `shared/static/SHARED_DICTIONARY.ts` for general reusable backend text;
- `entities/services/static/DICTIONARY.ts` for centralized project and domain text.

Nest the project dictionary by meaningful domain and feature areas rather than flattening it. Do not place endpoint messages beside individual modules as a target convention. Keep stable machine-readable error codes separate from user-appropriate messages.
