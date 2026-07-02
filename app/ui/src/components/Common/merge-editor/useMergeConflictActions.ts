import type { Ref } from 'vue';
import { resolveAllConflictsFromSource } from './conflictParser';
import type { ConflictBlock, ConflictState } from './types';

type ApplyStrategy = 'incoming' | 'current' | 'both' | 'base';

type UseMergeConflictActionsOptions = {
  conflicts: Ref<ConflictBlock[]>;
  conflictStates: Ref<Record<number, ConflictState>>;
  resolvedConflicts: Ref<Set<number>>;
  isApplyingAction: Ref<boolean>;
  resultEditorRef: () => any;
  resultModelRef: () => any;
  modifiedContentRef: () => string;
  onAfterApply: () => void;
};

export function useMergeConflictActions(options: UseMergeConflictActionsOptions) {
  function applyConflictAt(index: number, strategy: ApplyStrategy) {
    const resultEditor = options.resultEditorRef();
    const resultModel = options.resultModelRef();
    if (!resultEditor || !resultModel) return;

    const conflict = options.conflicts.value[index];
    if (!conflict) return;

    const replacement = strategy === 'incoming'
      ? conflict.incoming
      : strategy === 'current'
        ? conflict.current
        : strategy === 'both'
          ? [conflict.current, conflict.incoming].filter(Boolean).join('\n')
          : conflict.base;

    options.isApplyingAction.value = true;
    resultEditor.executeEdits('merge-accept', [{
      range: {
        startLineNumber: conflict.startLine,
        startColumn: 1,
        endLineNumber: conflict.endLine,
        endColumn: 1,
      },
      text: replacement,
      forceMoveMarkers: true,
    }]);
    options.isApplyingAction.value = false;

    options.resolvedConflicts.value.add(index);
    options.conflictStates.value[index] = strategy;
    options.onAfterApply();
  }

  function applyAllConflicts(strategy: 'incoming' | 'current') {
    const resultModel = options.resultModelRef();
    if (!resultModel) return;

    resultModel.setValue(resolveAllConflictsFromSource(options.modifiedContentRef(), strategy));
    options.resolvedConflicts.value = new Set(options.conflicts.value.map((c) => c.index));

    const nextStates: Record<number, ConflictState> = {};
    for (const conflict of options.conflicts.value) nextStates[conflict.index] = strategy;
    options.conflictStates.value = nextStates;
    options.onAfterApply();
  }

  function markConflictAsManual(lineNumber: number) {
    const idx = options.conflicts.value.findIndex((c) => lineNumber >= c.startLine && lineNumber <= c.endLine);
    if (idx < 0 || options.resolvedConflicts.value.has(idx)) return;

    options.conflictStates.value[idx] = 'manual';
    options.resolvedConflicts.value.add(idx);
  }

  return {
    applyConflictAt,
    applyAllConflicts,
    markConflictAsManual,
  };
}
