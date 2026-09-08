import { createHash } from 'node:crypto';

import type { IProjectIntelligenceGraph, IProjectIntelligenceKnowledge } from '#entities/project';
import type {
  IContextResolutionInput,
  TContextIntelligenceSelection,
} from '#entities/context';

export interface IContextExplorationCache {
  get(key: string): Promise<Readonly<TContextIntelligenceSelection> | undefined>;
  set(
    key: string,
    selection: Readonly<TContextIntelligenceSelection>,
  ): Promise<void>;
}

export class MemoryContextExplorationCache implements IContextExplorationCache {
  readonly #entries = new Map<string, Readonly<TContextIntelligenceSelection>>();

  async get(
    key: string,
  ): Promise<Readonly<TContextIntelligenceSelection> | undefined> {
    return this.#entries.get(key);
  }

  async set(
    key: string,
    selection: Readonly<TContextIntelligenceSelection>,
  ): Promise<void> {
    this.#entries.set(key, selection);
  }
}

export const createContextExplorationCacheKey = (
  input: Readonly<IContextResolutionInput>,
  knowledge: Readonly<IProjectIntelligenceKnowledge>,
  graph: Readonly<IProjectIntelligenceGraph>,
) =>
  createHash('sha256')
    .update(
      JSON.stringify({
        graph,
        input,
        knowledge,
      }),
    )
    .digest('hex');
