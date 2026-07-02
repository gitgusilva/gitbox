import { getConflictStateLabel } from './conflictState';
import type { ConflictBlock, ConflictState } from './types';

type Side = 'incoming' | 'current';
type ApplyStrategy = 'incoming' | 'current' | 'both' | 'base';

type SideWidgetOptions = {
  monaco: any;
  editor: any;
  conflict: ConflictBlock;
  side: Side;
  t: (key: string) => string;
  onApply: (index: number, strategy: ApplyStrategy) => void;
};

type ResultWidgetOptions = {
  monaco: any;
  editor: any;
  conflict: ConflictBlock;
  state: ConflictState;
  onResetBase: (index: number) => void;
};

export function createSideConflictWidget(options: SideWidgetOptions) {
  const { monaco, editor, conflict, side, t, onApply } = options;
  const node = document.createElement('div');
  node.className = 'merge-inline-actions';

  const addButton = (label: string, cls: string, action: () => void) => {
    const button = document.createElement('button');
    button.className = cls;
    button.textContent = label;
    button.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      action();
    };
    node.appendChild(button);
  };

  if (side === 'incoming') {
    addButton(t('changes.accept_incoming'), 'merge-inline-btn merge-inline-btn-incoming', () => onApply(conflict.index, 'incoming'));
    addButton(t('changes.accept_both'), 'merge-inline-btn merge-inline-btn-both', () => onApply(conflict.index, 'both'));
  } else {
    addButton(t('changes.accept_current'), 'merge-inline-btn merge-inline-btn-current', () => onApply(conflict.index, 'current'));
    addButton(t('changes.accept_both'), 'merge-inline-btn merge-inline-btn-both', () => onApply(conflict.index, 'both'));
  }
  addButton('Ignore', 'merge-inline-btn merge-inline-btn-ignore', () => onApply(conflict.index, 'base'));

  const widget = {
    getId: () => `merge-widget-${side}-${conflict.index}`,
    getDomNode: () => node,
    getPosition: () => ({
      position: { lineNumber: conflict.startLine, column: 1 },
      preference: [monaco.editor.ContentWidgetPositionPreference.ABOVE],
    }),
  };

  editor.addContentWidget(widget);
  return widget;
}

export function createResultInfoWidget(options: ResultWidgetOptions) {
  const { monaco, editor, conflict, state, onResetBase } = options;
  const node = document.createElement('div');
  node.className = 'merge-result-info';

  const status = document.createElement('span');
  status.className = 'merge-result-status';
  status.textContent = getConflictStateLabel(state);
  node.appendChild(status);

  if (state === 'manual') {
    const resetBtn = document.createElement('button');
    resetBtn.className = 'merge-inline-btn merge-inline-btn-reset';
    resetBtn.textContent = 'Reset to base';
    resetBtn.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      onResetBase(conflict.index);
    };
    node.appendChild(resetBtn);
  }

  const widget = {
    getId: () => `merge-widget-result-${conflict.index}`,
    getDomNode: () => node,
    getPosition: () => ({
      position: { lineNumber: conflict.startLine, column: 1 },
      preference: [monaco.editor.ContentWidgetPositionPreference.ABOVE],
    }),
  };

  editor.addContentWidget(widget);
  return widget;
}
