export type ConflictBlock = {
  index: number;
  startLine: number;
  endLine: number;
  incomingLabel: string;
  currentLabel: string;
  incoming: string;
  base: string;
  current: string;
};

export type ConflictState = 'none' | 'incoming' | 'current' | 'both' | 'base' | 'manual';
