import { describe, it, expect } from 'vitest';
import { humanBytes, isImagePath } from '../formatters';

describe('humanBytes', () => {
    it('keeps whole bytes whole and scales up', () => {
        expect(humanBytes(0)).toBe('0 B');
        expect(humanBytes(512)).toBe('512 B');
        expect(humanBytes(1536)).toBe('1.5 KB');
        expect(humanBytes(100 * 1024)).toBe('100 KB');
        expect(humanBytes(1024 * 1024 * 3.5)).toBe('3.5 MB');
    });

    it('answers for values that are not sizes', () => {
        expect(humanBytes(-1)).toBe('0 B');
        expect(humanBytes(Number.NaN)).toBe('0 B');
    });
});

describe('isImagePath', () => {
    it('agrees with the viewer about what is an image', () => {
        for (const path of ['a.png', 'a.PNG', 'a.jpg', 'a.jpeg', 'a.gif', 'a.webp', 'a.ico', 'a.svg']) {
            expect(isImagePath(path)).toBe(true);
        }
        // The extension has to be at the end — "png.ts" is TypeScript.
        for (const path of ['a.ts', 'a.md', 'png.ts', '', null, undefined]) {
            expect(isImagePath(path as any)).toBe(false);
        }
    });
});
