import type { ConflictBlock } from './types';

export function clearViewZones(editor: any, zoneIds: string[]) {
  if (!editor || zoneIds.length === 0) return [];
  editor.changeViewZones((accessor: any) => {
    for (const id of zoneIds) accessor.removeZone(id);
  });
  return [];
}

export function applyConflictViewZones(editor: any, conflicts: ConflictBlock[], heightInPx = 22): string[] {
  if (!editor || conflicts.length === 0) return [];
  let zoneIds: string[] = [];
  editor.changeViewZones((accessor: any) => {
    zoneIds = conflicts.map((conflict) => {
      const domNode = document.createElement('div');
      domNode.className = 'merge-inline-zone';
      return accessor.addZone({
        afterLineNumber: Math.max(1, conflict.startLine - 1),
        heightInPx,
        domNode,
        suppressMouseDown: true,
      });
    });
  });
  return zoneIds;
}
