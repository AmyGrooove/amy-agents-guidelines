import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type {
  TAgentsRouterSyncResult,
} from '#entities/project';

const START_MARKER = '<!-- amy-project-intelligence:start -->';
const END_MARKER = '<!-- amy-project-intelligence:end -->';
const ROUTER_BLOCK = `${START_MARKER}
## Amy Project Intelligence

Source code remains authoritative. Start with \`.amy/project-intelligence/index.json\`, then read the referenced project, architecture, and relevant module knowledge.
${END_MARKER}`;

const countOccurrences = (content: string, value: string) =>
  content.split(value).length - 1;

const readAgentsFile = async (path: string) => {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return undefined;
    }

    throw error;
  }
};

export const syncAgentsRouter = async (
  projectRoot: string,
  hasKnowledge: boolean,
): Promise<TAgentsRouterSyncResult> => {
  if (!hasKnowledge) {
    return Object.freeze({
      reason: 'missing-knowledge',
      status: 'refused',
    });
  }

  const agentsPath = join(projectRoot, 'AGENTS.md');
  const content = await readAgentsFile(agentsPath);

  if (content === undefined) {
    await writeFile(agentsPath, `${ROUTER_BLOCK}\n`, 'utf8');

    return Object.freeze({ status: 'created' });
  }

  const startCount = countOccurrences(content, START_MARKER);
  const endCount = countOccurrences(content, END_MARKER);

  if (
    startCount !== endCount ||
    startCount > 1 ||
    (startCount === 1 && content.indexOf(START_MARKER) > content.indexOf(END_MARKER))
  ) {
    return Object.freeze({
      reason: 'malformed-managed-block',
      status: 'refused',
    });
  }

  const nextContent =
    startCount === 0
      ? `${content}${
          content.length === 0 ? '' : content.endsWith('\n') ? '\n' : '\n\n'
        }${ROUTER_BLOCK}\n`
      : `${content.slice(0, content.indexOf(START_MARKER))}${ROUTER_BLOCK}${content.slice(
          content.indexOf(END_MARKER) + END_MARKER.length,
        )}`;

  if (nextContent === content) {
    return Object.freeze({ status: 'unchanged' });
  }

  await writeFile(agentsPath, nextContent, 'utf8');

  return Object.freeze({ status: 'updated' });
};
