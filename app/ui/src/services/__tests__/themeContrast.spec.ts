import { describe, it, expect } from 'vitest';
import { readableOn } from '../themeService';

/**
 * Picks the foreground for solid added/removed fills. White is the default —
 * black only appears where white would be unreadable, which is the case the
 * old hardcoded `text-white` got wrong.
 */
describe('readableOn', () => {
    it('keeps white on fills where it still reads', () => {
        expect(readableOn('#000000')).toBe('255 255 255');
        expect(readableOn('#EF4444')).toBe('255 255 255'); // GitBox default red
        expect(readableOn('#B4637A')).toBe('255 255 255'); // Rosé Pine love
        expect(readableOn('#C45B3C')).toBe('255 255 255'); // Arrakis clay red
        expect(readableOn('#286983')).toBe('255 255 255'); // Rosé Pine pine
        expect(readableOn('#859900')).toBe('255 255 255'); // Solarized green
    });

    it('switches to black where white would be unreadable', () => {
        expect(readableOn('#FFFFFF')).toBe('0 0 0');
        expect(readableOn('#22C55E')).toBe('0 0 0'); // GitBox default green
        expect(readableOn('#A8B545')).toBe('0 0 0'); // Arrakis olive
        expect(readableOn('#D4A017')).toBe('0 0 0'); // Arrakis spice gold
        expect(readableOn('#EA9D34')).toBe('0 0 0'); // Rosé Pine gold
    });

    it('accepts shorthand hex', () => {
        expect(readableOn('#fff')).toBe('0 0 0');
        expect(readableOn('#000')).toBe('255 255 255');
    });
});
