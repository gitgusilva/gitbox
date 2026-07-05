import type { ConflictBlock } from './types';

export type ParseConflictOptions = {
  incomingFallbackLabel: string;
  currentFallbackLabel: string;
};

export type ParsedConflictResult = {
  conflicts: ConflictBlock[];
  incomingText: string;
  currentText: string;
  resultText: string;
};

export function parseConflicts(content: string, options: ParseConflictOptions): ParsedConflictResult {
  const lines = content.split('\n');
  const incomingLines: string[] = [];
  const currentLines: string[] = [];
  const resultLines: string[] = [];
  const parsed: ConflictBlock[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (!line.startsWith('<<<<<<<')) {
      incomingLines.push(line);
      currentLines.push(line);
      resultLines.push(line);
      i += 1;
      continue;
    }

    const incomingLabel = line.replace('<<<<<<<', '').trim() || options.incomingFallbackLabel;
    i += 1;

    const incomingChunk: string[] = [];
    while (i < lines.length && !lines[i].startsWith('|||||||') && !lines[i].startsWith('=======')) {
      incomingChunk.push(lines[i]);
      i += 1;
    }

    if (i >= lines.length) {
      incomingLines.push(...incomingChunk);
      currentLines.push(...incomingChunk);
      resultLines.push(...incomingChunk);
      break;
    }

    let baseChunk: string[] = [];
    if (i < lines.length && lines[i].startsWith('|||||||')) {
      i += 1;
      while (i < lines.length && !lines[i].startsWith('=======')) {
        baseChunk.push(lines[i]);
        i += 1;
      }
    }

    i += 1;

    const currentChunk: string[] = [];
    while (i < lines.length && !lines[i].startsWith('>>>>>>>')) {
      currentChunk.push(lines[i]);
      i += 1;
    }

    const currentLabel = i < lines.length
      ? lines[i].replace('>>>>>>>', '').trim() || options.currentFallbackLabel
      : options.currentFallbackLabel;

    if (i < lines.length && lines[i].startsWith('>>>>>>>')) i += 1;

    const blockStart = incomingLines.length + 1;
    const blockHeight = Math.max(incomingChunk.length, currentChunk.length, 1);

    const incomingPadded = [...incomingChunk];
    const currentPadded = [...currentChunk];
    while (incomingPadded.length < blockHeight) incomingPadded.push('');
    while (currentPadded.length < blockHeight) currentPadded.push('');

    incomingLines.push(...incomingPadded);
    currentLines.push(...currentPadded);
    // Pad the result to the same block height so all three models stay
    // line-aligned. The accept logic replaces startLine..endLine in the result,
    // and the ribbon connectors assume the same line numbers on every side — a
    // single blank line here desyncs both (distorted béziers, clobbered content).
    for (let k = 0; k < blockHeight; k += 1) resultLines.push('');

    parsed.push({
      index: parsed.length,
      startLine: blockStart,
      endLine: blockStart + blockHeight,
      incomingLabel,
      currentLabel,
      incoming: incomingChunk.join('\n'),
      base: baseChunk.join('\n'),
      current: currentChunk.join('\n'),
      incomingLen: incomingChunk.length,
      currentLen: currentChunk.length,
      baseLen: baseChunk.length,
    });
  }

  return {
    conflicts: parsed,
    incomingText: incomingLines.join('\n'),
    currentText: currentLines.join('\n'),
    resultText: resultLines.join('\n'),
  };
}

export function resolveAllConflictsFromSource(content: string, strategy: 'incoming' | 'current' | 'both'): string {
  const lines = content.split('\n');
  const output: string[] = [];
  let i = 0;

  while (i < lines.length) {
    if (!lines[i].startsWith('<<<<<<<')) {
      output.push(lines[i]);
      i += 1;
      continue;
    }

    i += 1;
    const incomingChunk: string[] = [];
    while (i < lines.length && !lines[i].startsWith('|||||||') && !lines[i].startsWith('=======')) {
      incomingChunk.push(lines[i]);
      i += 1;
    }

    if (i < lines.length && lines[i].startsWith('|||||||')) {
      i += 1;
      while (i < lines.length && !lines[i].startsWith('=======')) {
        i += 1;
      }
    }

    if (i < lines.length && lines[i].startsWith('=======')) i += 1;

    const currentChunk: string[] = [];
    while (i < lines.length && !lines[i].startsWith('>>>>>>>')) {
      currentChunk.push(lines[i]);
      i += 1;
    }
    if (i < lines.length && lines[i].startsWith('>>>>>>>')) i += 1;

    if (strategy === 'incoming') output.push(...incomingChunk);
    else if (strategy === 'current') output.push(...currentChunk);
    else output.push(...currentChunk, ...incomingChunk);
  }

  return output.join('\n');
}
