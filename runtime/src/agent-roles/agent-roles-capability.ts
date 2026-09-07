import { RUNTIME_VERSIONS } from '../versions.js';
import { getAgentRole, listAgentRoles } from './agent-role-catalog.js';
import {
  validateAgentHandoff,
  validateAgentHandoffResult,
} from './validate-agent-handoff.js';

import type { IAmyCapability } from '../capabilities/capability-contract.js';
import type { IAgentRolesApi } from './agent-role-contract.js';

export const createAgentRolesCapability = (): IAmyCapability<IAgentRolesApi> => ({
  api: {
    get: getAgentRole,
    list: listAgentRoles,
    validateHandoff: validateAgentHandoff,
    validateResult: validateAgentHandoffResult,
  },
  descriptor: {
    capabilityContract: RUNTIME_VERSIONS.capabilityContract,
    id: 'amy.agent-roles',
    runtimeApi: RUNTIME_VERSIONS.runtimeApi,
    version: '1.0.0',
  },
});
