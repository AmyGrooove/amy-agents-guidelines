import type { IRuntimeEvent } from '#entities/runtime';
import type { TJsonValue } from '#entities/runtime';
import type { IDataPrivacyPolicy } from '../../../types/dataStorageContract.js';

const SENSITIVE_KEY_PATTERN = /(?:^|[-_])(api[-_]?key|authorization|cookie|credential|password|passwd|private[-_]?key|refresh[-_]?token|secret|token)(?:$|[-_])/i;
const RAW_CONTENT_KEY_PATTERN = /^(body|content|conversation|messages|prompt|raw[-_]?prompt|request[-_]?body|response[-_]?body|tool[-_]?input|tool[-_]?output|tool[-_]?payload)$/i;
const SECRET_ASSIGNMENT_PATTERN = /\b(api[-_]?key|password|passwd|secret|token)\s*[:=]\s*([^\s,;]+)/gi;
const BEARER_PATTERN = /\bBearer\s+[^\s,;]+/gi;

const checkContainsProtectedEnvPath = (value: string) => {
  const pathParts = value.split(/[\\/]/);

  return pathParts.some((part) => {
    const normalized = part.toLowerCase();

    if (normalized === '.env') {
      return true;
    }

    if (!normalized.startsWith('.env.')) {
      return false;
    }

    return !['.env.example', '.env.sample', '.env.template'].includes(normalized);
  });
};

const redactString = (value: string) => {
  if (checkContainsProtectedEnvPath(value)) {
    return '[redacted:.env-path]';
  }

  return value
    .replace(BEARER_PATTERN, 'Bearer [redacted]')
    .replace(
      SECRET_ASSIGNMENT_PATTERN,
      (_match, key: string) => `${key}=[redacted]`,
    );
};

const sanitizeJsonValue = (
  value: TJsonValue,
  policy: Readonly<IDataPrivacyPolicy>,
): TJsonValue => {
  if (typeof value === 'string') {
    return redactString(value);
  }

  if (Array.isArray(value)) {
    return Object.freeze(value.map((entry) => sanitizeJsonValue(entry, policy)));
  }

  if (value !== null && typeof value === 'object') {
    return Object.freeze(
      Object.fromEntries(
        Object.entries(value).map(([key, entry]) => {
          if (SENSITIVE_KEY_PATTERN.test(key)) {
            return [key, '[redacted]'];
          }

          if (RAW_CONTENT_KEY_PATTERN.test(key)) {
            return [
              key,
              policy.rawContent === 'omit'
                ? '[raw-content-omitted]'
                : sanitizeJsonValue(entry, policy),
            ];
          }

          return [key, sanitizeJsonValue(entry, policy)];
        }),
      ),
    );
  }

  return value;
};

export const sanitizeRuntimeEventForStorage = (
  event: Readonly<IRuntimeEvent>,
  policy: Readonly<IDataPrivacyPolicy>,
): Readonly<IRuntimeEvent> =>
  Object.freeze({
    ...event,
    payload: sanitizeJsonValue(
      event.payload as unknown as TJsonValue,
      policy,
    ) as Readonly<Record<string, TJsonValue>>,
  });
