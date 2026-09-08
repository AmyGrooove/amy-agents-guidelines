import type { IComputeRoutingDecision, IComputeTarget, TComputeProfile } from '#entities/computeProfile';
import type { TTaskIntelligenceAnalysis } from '#entities/task';

export type TComputeRoutingMode = 'downgrade' | 'initial' | 'upgrade';

export type IComputeRoutingInput = Readonly<{
  taskAnalysis: Readonly<TTaskIntelligenceAnalysis>;

  currentProfile?: TComputeProfile;
  mode?: TComputeRoutingMode;
  requestedProfile?: TComputeProfile;
  target?: Readonly<IComputeTarget>;
  unavailableModels?: readonly string[];
}>;

export interface IComputeRoutingApi {
  route(value: unknown): Readonly<IComputeRoutingDecision>;
}
