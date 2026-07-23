import { describe, it, expect } from 'vitest';
import { normalizeHost, parseAuthMarker, stripAuthMarker } from '../credentials';

/**
 * Host normalization is the join between what a user types in Settings and what
 * the main process looks up when it authenticates a remote. A mismatch here is
 * invisible: the credential saves fine and simply never matches, and the user
 * gets "no credentials saved for <host>" while staring at the entry they added.
 */
describe('normalizeHost', () => {
    it('keeps a bare host untouched', () => {
        expect(normalizeHost('conteudoweb.itajai.sc.gov.br')).toBe('conteudoweb.itajai.sc.gov.br');
    });

    it('reduces a full clone URL to its host', () => {
        expect(normalizeHost('http://conteudoweb.itajai.sc.gov.br/educacaoitajai/erudio-clients.git'))
            .toBe('conteudoweb.itajai.sc.gov.br');
    });

    it('keeps a numeric port, so two servers on one host stay distinct', () => {
        expect(normalizeHost('http://127.0.0.1:3030/itajai/erudio-clients.git')).toBe('127.0.0.1:3030');
        expect(normalizeHost('http://127.0.0.1:8929/root/erudio-clients.git')).toBe('127.0.0.1:8929');
    });

    it('drops credentials embedded in the URL', () => {
        expect(normalizeHost('https://user:pass@git.acme.com/team/repo.git')).toBe('git.acme.com');
    });

    it('handles the scp-style SSH form', () => {
        expect(normalizeHost('git@github.com:gitgusilva/gitbox.git')).toBe('github.com');
    });

    it('lowercases, so a typed host matches the URL libgit2 reports', () => {
        expect(normalizeHost('  GitLab.Acme.COM  ')).toBe('gitlab.acme.com');
    });

    it('returns empty for blank input, which the UI uses to block saving', () => {
        expect(normalizeHost('   ')).toBe('');
    });
});

/**
 * The auth marker is the only channel between the main process (which knows an
 * operation failed for want of credentials) and the renderer (which raises the
 * askpass prompt). If parsing drifts from the format explainAuthError emits, the
 * prompt silently never appears; if stripping drifts, the marker leaks into the
 * error banner the user reads.
 */
describe('auth marker', () => {
    const needed = 'No credentials saved for 127.0.0.1. Add a token. [gitbox-auth:need:127.0.0.1]';
    const rejected = 'conteudoweb.itajai.sc.gov.br refused the saved credentials. [gitbox-auth:reject:conteudoweb.itajai.sc.gov.br]';

    it('reads the kind and host from a "need" marker', () => {
        expect(parseAuthMarker(needed)).toEqual({ kind: 'need', host: '127.0.0.1' });
    });

    it('reads a "reject" marker for a dotted hostname', () => {
        expect(parseAuthMarker(rejected)).toEqual({ kind: 'reject', host: 'conteudoweb.itajai.sc.gov.br' });
    });

    it('returns null when there is no marker', () => {
        expect(parseAuthMarker('some unrelated failure')).toBeNull();
    });

    it('strips the marker so it never reaches the UI', () => {
        expect(stripAuthMarker(needed)).toBe('No credentials saved for 127.0.0.1. Add a token.');
        expect(stripAuthMarker(rejected)).toBe('conteudoweb.itajai.sc.gov.br refused the saved credentials.');
    });

    it('leaves an unmarked message untouched', () => {
        expect(stripAuthMarker('plain error')).toBe('plain error');
    });
});
