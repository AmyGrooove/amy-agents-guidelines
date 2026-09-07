import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  AmyRuntimeError,
  RUNTIME_VERSIONS,
} from '../dist/index.js';

describe('VersionsAndErrors', () => {
  it('хранит независимые версии архитектурных контрактов', () => {
    assert.deepEqual(RUNTIME_VERSIONS, {
      capabilityContract: 1,
      configSchema: 1,
      eventSchema: 1,
      runtimeApi: 1,
      stateSchema: 1,
    });
  });

  it('сохраняет код, детали и причину Runtime-ошибки', () => {
    const cause = new Error('source failure');
    const error = new AmyRuntimeError({
      cause,
      code: 'INVALID_CONFIGURATION',
      details: { source: 'project' },
      message: 'Configuration is invalid',
    });

    assert.equal(error.name, 'AmyRuntimeError');
    assert.equal(error.code, 'INVALID_CONFIGURATION');
    assert.deepEqual(error.details, { source: 'project' });
    assert.equal(error.cause, cause);
  });
});
