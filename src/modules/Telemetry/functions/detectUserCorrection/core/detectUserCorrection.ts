import { OUTCOME_INTELLIGENCE_VERSIONS } from '#entities/executionResult';
import { validateUserCorrectionDetectionInput } from '#entities/executionResult';

import type {
  IUserCorrectionDetection,
  TUserCorrectionReasonCode,
} from '#entities/executionResult';

type TPatternGroup = Readonly<{
  patterns: readonly RegExp[];
  strong: boolean;
}>;

const CORRECTION_GROUPS: readonly TPatternGroup[] = [
  {
    patterns: [
      /ты\s+(?:снова\s+)?сломал/iu,
      /не\s+работает/iu,
      /неправильн(?:о|ый|ая|ое|ые)/iu,
      /неверн(?:о|ый|ая|ое|ые)/iu,
      /это\s+не\s+то/iu,
      /регресс(?:ия|ию|ии)?/iu,
      /\byou\s+broke\b/iu,
      /\bdoesn['’]?t\s+work\b/iu,
      /\bnot\s+what\s+i\s+asked\b/iu,
      /\bincorrect\b/iu,
      /\bregression\b/iu,
    ],
    strong: true,
  },
  {
    patterns: [
      /^\s*нет(?:\s|[,!.?:;—-]|$)/iu,
      /^\s*no\b/iu,
      /исправь/iu,
      /почини/iu,
      /\bfix\b/iu,
    ],
    strong: false,
  },
];

const NEW_TASK_PATTERNS: readonly RegExp[] = [
  /теперь\s+(?:добавь|сделай|реализуй|измени)/iu,
  /а\s+теперь/iu,
  /(?:ещ[её]|также)\s+добавь/iu,
  /\bnow\s+(?:add|build|implement|change)\b/iu,
  /\balso\s+(?:add|build|implement|change)\b/iu,
  /\bnext\s+(?:add|build|implement|change)\b/iu,
];

const matchesAny = (message: string, patterns: readonly RegExp[]) =>
  patterns.some((pattern) => pattern.test(message));

export const detectUserCorrection = (
  value: unknown,
): Readonly<IUserCorrectionDetection> => {
  const input = validateUserCorrectionDetectionInput(value);
  const strongCorrection = CORRECTION_GROUPS
    .filter(({ strong }) => strong)
    .some(({ patterns }) => matchesAny(input.message, patterns));
  const weakCorrection = CORRECTION_GROUPS
    .filter(({ strong }) => !strong)
    .some(({ patterns }) => matchesAny(input.message, patterns));
  const correction = strongCorrection || weakCorrection;
  const newTask = matchesAny(input.message, NEW_TASK_PATTERNS);
  const reasonCodes = new Set<TUserCorrectionReasonCode>();

  if (correction) reasonCodes.add('correction-marker');
  if (newTask) reasonCodes.add('new-task-marker');

  if (correction && newTask) {
    reasonCodes.add('conflicting-follow-up-signals');

    return Object.freeze({
      classification: 'ambiguous',
      confidence: 'low',
      kind: 'user-correction-detection',
      policyVersion: OUTCOME_INTELLIGENCE_VERSIONS.detectorPolicy,
      reasonCodes: Object.freeze([...reasonCodes].sort()),
      schemaVersion: OUTCOME_INTELLIGENCE_VERSIONS.detectorSchema,
    });
  }

  if (correction) {
    return Object.freeze({
      classification: 'correction',
      confidence: strongCorrection ? 'high' : 'medium',
      kind: 'user-correction-detection',
      policyVersion: OUTCOME_INTELLIGENCE_VERSIONS.detectorPolicy,
      reasonCodes: Object.freeze([...reasonCodes].sort()),
      schemaVersion: OUTCOME_INTELLIGENCE_VERSIONS.detectorSchema,
      signal: Object.freeze({
        evidenceRefs: Object.freeze([input.messageRef]),
        impact: 'partial',
        kind: 'user-correction',
        summary: 'User follow-up indicates a correction to the previous result.',
      }),
    });
  }

  if (newTask) {
    return Object.freeze({
      classification: 'new-task',
      confidence: 'high',
      kind: 'user-correction-detection',
      policyVersion: OUTCOME_INTELLIGENCE_VERSIONS.detectorPolicy,
      reasonCodes: Object.freeze([...reasonCodes].sort()),
      schemaVersion: OUTCOME_INTELLIGENCE_VERSIONS.detectorSchema,
    });
  }

  reasonCodes.add('no-strong-follow-up-signal');

  return Object.freeze({
    classification: 'ambiguous',
    confidence: 'low',
    kind: 'user-correction-detection',
    policyVersion: OUTCOME_INTELLIGENCE_VERSIONS.detectorPolicy,
    reasonCodes: Object.freeze([...reasonCodes]),
    schemaVersion: OUTCOME_INTELLIGENCE_VERSIONS.detectorSchema,
  });
};
