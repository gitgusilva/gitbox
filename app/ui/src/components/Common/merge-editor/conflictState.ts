import type { ConflictState } from './types';

export function getConflictStateLabel(state: ConflictState): string {
  if (state === 'incoming') return 'Accepted Incoming';
  if (state === 'current') return 'Accepted Current';
  if (state === 'both') return 'Accepted Both';
  if (state === 'manual') return 'Manual Resolution';
  return 'No Changes Accepted';
}
