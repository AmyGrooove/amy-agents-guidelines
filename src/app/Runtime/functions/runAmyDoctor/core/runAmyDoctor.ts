import { Diagnostics } from '#modules/Diagnostics';

import { loadRuntimeConfig } from '../../loadRuntimeConfig/index.js';

import type { IRunAmyDoctorOptions } from '#modules/Diagnostics';

export const runAmyDoctor = (options: Readonly<IRunAmyDoctorOptions>) =>
  Diagnostics(options, loadRuntimeConfig);
