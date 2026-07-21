import { describe, it, expect } from 'vitest';
import { parseConflicts, resolveAllConflictsFromSource } from '../conflictParser';

const OPTS = { incomingFallbackLabel: 'Incoming', currentFallbackLabel: 'Current' };

// Exactly what git writes into a conflicted file: `<<<<<<<` opens OURS (HEAD,
// the branch you are on) and `>>>>>>>` closes THEIRS (the branch merged in).
const CONFLICT = [
    'name = "demo"',
    '<<<<<<< HEAD',
    'theme = "solarized"',
    '=======',
    'theme = "midnight"',
    '>>>>>>> feature/tuning',
    'trailing = true',
].join('\n');

const WITH_BASE = [
    '<<<<<<< HEAD',
    'ours',
    '||||||| merged common ancestors',
    'base',
    '=======',
    'theirs',
    '>>>>>>> feature/x',
].join('\n');

describe('parseConflicts', () => {
    it('maps the HEAD side to current and the merged-in branch to incoming', () => {
        const { conflicts } = parseConflicts(CONFLICT, OPTS);

        expect(conflicts).toHaveLength(1);
        const c = conflicts[0];
        expect(c.currentLabel).toBe('HEAD');
        expect(c.current).toBe('theme = "solarized"');
        expect(c.incomingLabel).toBe('feature/tuning');
        expect(c.incoming).toBe('theme = "midnight"');
    });

    it('keeps each side model on its own content', () => {
        const { currentText, incomingText } = parseConflicts(CONFLICT, OPTS);

        expect(currentText).toContain('solarized');
        expect(currentText).not.toContain('midnight');
        expect(incomingText).toContain('midnight');
        expect(incomingText).not.toContain('solarized');
        // Context lines belong to both sides.
        expect(currentText).toContain('name = "demo"');
        expect(incomingText).toContain('trailing = true');
    });

    it('reads the base chunk of a diff3 conflict without confusing the sides', () => {
        const { conflicts } = parseConflicts(WITH_BASE, OPTS);

        expect(conflicts[0].current).toBe('ours');
        expect(conflicts[0].base).toBe('base');
        expect(conflicts[0].incoming).toBe('theirs');
    });

    it('falls back to the given labels when a marker carries no name', () => {
        const bare = ['<<<<<<<', 'a', '=======', 'b', '>>>>>>>'].join('\n');
        const { conflicts } = parseConflicts(bare, OPTS);

        expect(conflicts[0].currentLabel).toBe('Current');
        expect(conflicts[0].incomingLabel).toBe('Incoming');
    });
});

describe('resolveAllConflictsFromSource', () => {
    it('"current" keeps the local side', () => {
        expect(resolveAllConflictsFromSource(CONFLICT, 'current')).toBe(
            ['name = "demo"', 'theme = "solarized"', 'trailing = true'].join('\n')
        );
    });

    it('"incoming" keeps the merged-in side', () => {
        expect(resolveAllConflictsFromSource(CONFLICT, 'incoming')).toBe(
            ['name = "demo"', 'theme = "midnight"', 'trailing = true'].join('\n')
        );
    });

    it('"both" keeps ours first, then theirs — the order git writes', () => {
        expect(resolveAllConflictsFromSource(CONFLICT, 'both')).toBe(
            ['name = "demo"', 'theme = "solarized"', 'theme = "midnight"', 'trailing = true'].join('\n')
        );
    });
});
