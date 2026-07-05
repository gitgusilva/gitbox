import type { ConflictState } from './types';

/** i18n key for the result-widget status badge, translated at the call site. */
export function getConflictStateKey(state: ConflictState): string {
  if (state === 'incoming') return 'changes.accepted_incoming';
  if (state === 'current') return 'changes.accepted_current';
  if (state === 'both') return 'changes.accepted_both_label';
  if (state === 'manual') return 'changes.manual_resolution';
  return 'changes.no_changes_accepted';
}
