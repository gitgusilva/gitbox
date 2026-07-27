/**
 * Is a path still a repository GitBox can open?
 *
 * Kept out of gitService so workspaceService can use it too (gitService already
 * imports workspaceService, and a cycle between the two is asking for trouble).
 */
export interface RepoProbe {
    /** The folder itself is still on disk. */
    exists: boolean;
    /** The folder is a git repository (working tree or bare). */
    isRepo: boolean;
}

/**
 * Local failures that mean "this path can no longer be opened as a repository".
 *
 * Deliberately narrow: a remote 404 ("Repository not found" from a host) must
 * never be read as a missing local repo, or a bad URL would close the user's tab.
 */
const REPO_PATH_FAILURES = [
    /could not find repository/i,
    /failed to open repository/i,
    /failed to resolve path/i,
    /no such file or directory/i,
    /not a git repository/i,
];

/** True when `message` (already stripped of the IPC prefix) is one of the above. */
export function looksLikeRepoPathFailure(message: string): boolean {
    return REPO_PATH_FAILURES.some(re => re.test(message));
}

/**
 * Ask the main process what is actually on disk.
 *
 * When the probe is unavailable (older preload, tests) it answers "everything is
 * fine": closing a tab is destructive, so it must never happen on a guess.
 */
export async function probeRepoPath(path: string): Promise<RepoProbe> {
    if (!path) return { exists: false, isRepo: false };
    const api = (window as any).gitbox;
    if (!api?.probeRepo) return { exists: true, isRepo: true };
    try {
        const result = await api.probeRepo(path);
        if (!result || typeof result.exists !== 'boolean') return { exists: true, isRepo: true };
        return result;
    } catch {
        return { exists: true, isRepo: true };
    }
}
