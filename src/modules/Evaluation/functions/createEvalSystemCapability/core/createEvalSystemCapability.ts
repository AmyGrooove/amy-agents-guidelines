import { RUNTIME_VERSIONS } from '#entities/runtime';
import { compareEvalVariants, runEvalCorpus } from '../../../core/Evaluation.js';
import { evaluateEvalCase } from '../../evaluateEvalCase/core/evaluateEvalCase.js';
import { validateEvalCorpus } from '../../validateEvalSystem/core/validateEvalSystem.js';

import type { IAmyCapability } from '#entities/runtime';
import type { IEvalSystemApi } from '../../../types/evalSystemContract.js';

export const createEvalSystemCapability = (): IAmyCapability<IEvalSystemApi> => ({
  api: {
    compareVariants: compareEvalVariants,
    evaluateCase: evaluateEvalCase,
    runCorpus: runEvalCorpus,
    validateCorpus: validateEvalCorpus,
  },
  descriptor: {
    capabilityContract: RUNTIME_VERSIONS.capabilityContract,
    id: 'amy.eval-system',
    runtimeApi: RUNTIME_VERSIONS.runtimeApi,
    version: '1.0.0',
  },
});
