/**
 * Resolves a file living in `public/` against the deployment base.
 *
 * Vite rewrites relative `src="./x.png"` as a module import (which fails for
 * public files), and a root-absolute `/x.png` breaks under the `/gitbox/` base
 * GitHub Pages serves from. BASE_URL is correct in both dev and build.
 */
export function asset(path: string): string {
    return import.meta.env.BASE_URL + path.replace(/^\/+/, '');
}
