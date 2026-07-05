export type ConflictBlock = {
  index: number;
  startLine: number;
  endLine: number;
  incomingLabel: string;
  currentLabel: string;
  incoming: string;
  base: string;
  current: string;
  // Real content line counts per side (before padding to blockHeight), so the
  // bezier/decorations can reflect each side's actual size instead of the max.
  incomingLen: number;
  currentLen: number;
  baseLen: number;
};

export type ConflictState = 'none' | 'incoming' | 'current' | 'both' | 'base' | 'manual';
