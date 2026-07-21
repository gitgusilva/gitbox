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

/**
 * Splits a conflicted file into its two sides.
 *
 * Git's markers are: `<<<<<<<` opens OURS — the branch you are on, i.e. HEAD,
 * the "current" side — and `>>>>>>>` closes THEIRS, the branch being merged in,
 * i.e. the "incoming" side. These were previously mapped the other way round,
 * which swapped the pane labels and, worse, made "accept all incoming" write the
 * local side into the file.
 */
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

    // `<<<<<<< HEAD` — ours / local / current.
    const currentLabel = line.replace('<<<<<<<', '').trim() || options.currentFallbackLabel;
    i += 1;

    const currentChunk: string[] = [];
    while (i < lines.length && !lines[i].startsWith('|||||||') && !lines[i].startsWith('=======')) {
      currentChunk.push(lines[i]);
      i += 1;
    }

    if (i >= lines.length) {
      incomingLines.push(...currentChunk);
      currentLines.push(...currentChunk);
      resultLines.push(...currentChunk);
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

    const incomingChunk: string[] = [];
    while (i < lines.length && !lines[i].startsWith('>>>>>>>')) {
      incomingChunk.push(lines[i]);
      i += 1;
    }

    // `>>>>>>> branch` — theirs / remote / incoming.
    const incomingLabel = i < lines.length
      ? lines[i].replace('>>>>>>>', '').trim() || options.incomingFallbackLabel
      : options.incomingFallbackLabel;

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
    // Ours / HEAD — see parseConflicts for why this side is "current".
    const currentChunk: string[] = [];
    while (i < lines.length && !lines[i].startsWith('|||||||') && !lines[i].startsWith('=======')) {
      currentChunk.push(lines[i]);
      i += 1;
    }

    if (i < lines.length && lines[i].startsWith('|||||||')) {
      i += 1;
      while (i < lines.length && !lines[i].startsWith('=======')) {
        i += 1;
      }
    }

    if (i < lines.length && lines[i].startsWith('=======')) i += 1;

    const incomingChunk: string[] = [];
    while (i < lines.length && !lines[i].startsWith('>>>>>>>')) {
      incomingChunk.push(lines[i]);
      i += 1;
    }
    if (i < lines.length && lines[i].startsWith('>>>>>>>')) i += 1;

    if (strategy === 'incoming') output.push(...incomingChunk);
    else if (strategy === 'current') output.push(...currentChunk);
    // "Both" keeps ours first, then theirs — the order git itself writes.
    else output.push(...currentChunk, ...incomingChunk);
  }

  return output.join('\n');
}
