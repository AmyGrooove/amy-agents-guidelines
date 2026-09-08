import { RUNTIME_VERSIONS } from '#entities/runtime';
import { getAgentRole, listAgentRoles } from '#entities/agentRole';
import {
  validateAgentHandoff,
  validateAgentHandoffResult,
} from '#entities/agentRole';

import type { IAmyCapability } from '#entities/runtime';
import type { IAgentRolesApi } from '#entities/agentRole';

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
    version: '1.1.0',
  },
});
