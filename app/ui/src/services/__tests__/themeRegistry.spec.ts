import { describe, it, expect } from 'vitest';
import { hasNewerVersion } from '../themeRegistry';

/**
 * An installed theme is a copy in local storage — nothing re-reads its
 * theme.json afterwards. This comparison is the only thing that surfaces a fix
 * published upstream, so it has to be right in both directions: a missed update
 * strands the user on a broken palette, and a false one offers to overwrite a
 * theme they may have edited.
 */
describe('hasNewerVersion', () => {
    it('reports an update when the registry is ahead', () => {
        expect(hasNewerVersion('1.0.0', '1.0.1')).toBe(true);
        expect(hasNewerVersion('1.0.9', '1.1.0')).toBe(true);
        expect(hasNewerVersion('1.9.9', '2.0.0')).toBe(true);
    });

    it('stays quiet when the installed copy is current or ahead', () => {
        expect(hasNewerVersion('1.0.1', '1.0.1')).toBe(false);
        expect(hasNewerVersion('1.0.1', '1.0.0')).toBe(false);
        expect(hasNewerVersion('2.0.0', '1.9.9')).toBe(false);
    });

    it('compares each part as a number, not as text', () => {
        // "10" sorts before "9" as a string; the theme would never update.
        expect(hasNewerVersion('1.0.9', '1.0.10')).toBe(true);
        expect(hasNewerVersion('1.9.0', '1.10.0')).toBe(true);
        expect(hasNewerVersion('1.0.10', '1.0.9')).toBe(false);
    });

    it('reports nothing rather than guessing when either side is unusable', () => {
        // Hand-imported themes and older installs may carry no version, or one
        // that is not MAJOR.MINOR.PATCH. Offering an update there would propose
        // overwriting a theme on no evidence.
        expect(hasNewerVersion(undefined, '1.0.1')).toBe(false);
        expect(hasNewerVersion('1.0.0', undefined)).toBe(false);
        expect(hasNewerVersion('', '1.0.1')).toBe(false);
        expect(hasNewerVersion('1.0', '1.0.1')).toBe(false);
        expect(hasNewerVersion('v1.0.0', '1.0.1')).toBe(false);
        expect(hasNewerVersion('1.0.0-beta', '1.0.1')).toBe(false);
    });
});
