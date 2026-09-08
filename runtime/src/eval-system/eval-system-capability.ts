import { RUNTIME_VERSIONS } from '../versions.js';
import { compareEvalVariants, runEvalCorpus } from './eval-runner.js';
import { evaluateEvalCase } from './eval-scorer.js';
import { validateEvalCorpus } from './validate-eval-system.js';

import type { IAmyCapability } from '../capabilities/capability-contract.js';
import type { IEvalSystemApi } from './eval-system-contract.js';

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
