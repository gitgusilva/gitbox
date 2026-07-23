export interface GitStatusEntry {
    path: string;
    status: string;
}

export interface Branch {
    name: string;
    is_head: boolean;
    is_remote?: boolean;
    ahead?: number;
    behind?: number;
    target?: string;
    timestamp?: number;
}

export interface Commit {
    id: string;
    author: string;
    authorEmail?: string;
    committer?: string;
    committerEmail?: string;
    summary: string;
    message?: string;
    timestamp: number;
    committerTimestamp?: number;
    parents?: CommitParent[];
}

export interface CommitParent {
    id: string;
    summary: string;
    author: string;
    authorEmail?: string;
    timestamp: number;
}

export interface Stash {
    id: string;
    index: number;
    message: string;
    timestamp: number;
}

export interface FileDiff {
    path: string;
    original: string;
    modified: string;
}

export interface GraphLine {
    path: string;
    color: string;
    isPrimary?: boolean;
    /** Line belongs to a commit not reachable from HEAD → drawn dim gray. */
    dimmed?: boolean;
}

export interface GraphNode {
    dotLane: number;
    color: string;
    lines: GraphLine[];
    width: number;
    isMerge?: boolean;
    /** Commit is NOT reachable from the current branch (HEAD) → dim gray dot. */
    dimmed?: boolean;
    /** Commit is the current branch tip (HEAD). */
    isHead?: boolean;
}

export type TabKey = 'history' | 'local_changes' | 'changes' | 'stashes' | 'files' | 'pull_request' | 'create_pr' | 'output_log' | 'statistics';

export interface StatAuthor {
    name: string;
    email: string;
    commits: number;
    added: number;
    deleted: number;
    lines: number;
    avgLinesPerCommit: number;
}

export interface StatMonth {
    month: string; // 'YYYY-MM'
    total: number; // churn (added + deleted)
    commits: number;
    byAuthor: Record<string, number>;
}

export interface FileHistoryEntry {
    id: string;
    author: string;
    email: string;
    timestamp: number;
    summary: string;
}

export interface BlameLine {
    line: number;
    commit: string;
    author: string;
    email: string;
    time: number | string;
    summary: string;
}

export interface GitStatistics {
    totalCommits: number;
    branchCount: number;
    remoteBranchCount: number;
    tagCount: number;
    sizeBytes: number;
    objectCount: number;
    sinceMonths: number;
    authors: StatAuthor[];
    monthly: StatMonth[];
    weekday: number[]; // length 7, index 0 = Sunday
    hourly: number[];  // length 24
    totalAdded: number;
    totalDeleted: number;
}

export type RepoState = 'clean' | 'merge' | 'rebase' | 'revert' | 'cherrypick' | 'bisect' | 'apply_mailbox';

export interface MergeResult {
    status: 'up_to_date' | 'fast_forward' | 'merged' | 'conflicts';
    commit?: string;
    conflicts?: string[];
}

/** Live status pushed by the main-process auto-updater (see updater.js). */
export interface UpdaterStatus {
    state: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
    info?: { version?: string; releaseNotes?: string | null; releaseDate?: string } | null;
    progress?: { percent?: number; transferred?: number; total?: number; bytesPerSecond?: number } | null;
    error?: string | null;
    supported?: boolean;
}

export interface GitboxAPI {
    selectFolder: () => Promise<string | null>;
    status: (repoPath: string) => Promise<GitStatusEntry[]>;
    openExternal: (url: string) => Promise<void>;
    spawnTerminal: (repoPath: string) => Promise<number>;
    writeTerminal: (id: number, data: string) => void;
    resizeTerminal: (id: number, cols: number, rows: number) => void;
    killTerminal: (id: number) => void;
    onTerminalData: (callback: (id: number, data: string) => void) => void;
    onTerminalExit: (callback: (id: number) => void) => void;
    branches: (repoPath: string) => Promise<Branch[]>;
    remotes: (repoPath: string) => Promise<string[]>;
    getRemoteUrl: (repoPath: string, remoteName?: string) => Promise<string>;
    tags: (repoPath: string) => Promise<{ name: string, target?: string }[]>;
    stashes: (repoPath: string) => Promise<Stash[]>;
    getSubmodules: (repoPath: string) => Promise<{ path: string; sha: string; ref: string; status: string }[]>;
    getSubmoduleCommitInfo: (repoPath: string, submodulePath: string, sha: string) => Promise<any>;
    addSubmodule: (repoPath: string, url: string, targetPath: string) => Promise<boolean>;
    updateSubmodule: (repoPath: string, path: string) => Promise<boolean>;
    deleteSubmodule: (repoPath: string, path: string) => Promise<boolean>;
    log: (repoPath: string, maxCount?: number, refName?: string, skip?: number) => Promise<Commit[]>;
    stageAll: (repoPath: string) => Promise<boolean>;
    stageFile: (repoPath: string, filePath: string) => Promise<boolean>;
    unstageAll: (repoPath: string) => Promise<boolean>;
    unstageFile: (repoPath: string, filePath: string) => Promise<boolean>;
    discardAll: (repoPath: string) => Promise<boolean>;
    discardFile: (repoPath: string, filePath: string) => Promise<boolean>;
    commitAll: (repoPath: string, message: string) => Promise<string>;
    checkoutBranch: (repoPath: string, branchName: string) => Promise<boolean>;
    fetch: (repoPath: string, remoteName?: string) => Promise<boolean>;
    pull: (repoPath: string, remoteName?: string) => Promise<boolean>;
    push: (repoPath: string, remoteName?: string, branchName?: string, setUpstream?: boolean, force?: boolean, pushTags?: boolean, forceWithLease?: boolean) => Promise<boolean>;
    clone: (url: string, targetDir: string, options?: { name?: string; username?: string; password?: string; remember?: boolean }) => Promise<{ path: string; name: string }>;
    testCredentials: (url: string, username?: string, token?: string) => Promise<{ ok: boolean; message?: string }>;
    init: (targetDir: string, name?: string, defaultBranch?: string) => Promise<{ path: string; name: string }>;
    createBranch: (repoPath: string, branchName: string, startPoint?: string) => Promise<boolean>;
    deleteBranch: (repoPath: string, branchName: string) => Promise<boolean>;
    renameBranch: (repoPath: string, oldName: string, newName: string) => Promise<boolean>;
    diffFile: (repoPath: string, filePath: string) => Promise<FileDiff>;
    getStagedDiff: (repoPath: string) => Promise<string>;
    getFileDiff: (repoPath: string, filePath: string) => Promise<string>;
    stashChanges: (repoPath: string, stashId: string) => Promise<GitStatusEntry[]>;
    stashSave: (repoPath: string, message?: string) => Promise<boolean>;
    stashApply: (repoPath: string, stashId?: string) => Promise<boolean>;
    stashPop: (repoPath: string, stashId?: string) => Promise<boolean>;
    stashDrop: (repoPath: string, stashId?: string) => Promise<boolean>;
    diffStashFile: (repoPath: string, stashId: string, filePath: string) => Promise<FileDiff>;
    checkMerge: (repoPath: string, toBranch: string, fromBranch: string) => Promise<{ hasConflicts: boolean; files: string[] }>;
    openMergeTool: (repoPath: string, filePath: string, toolName?: string) => Promise<boolean>;
    openMergeWindow: (repoPath: string, filePath: string) => Promise<boolean>;
    notifyMergeResolved: () => void;
    onMergeResolved: (callback: () => void) => (() => void);
    broadcastTheme?: (theme: unknown) => void;
    onThemeChanged?: (callback: (theme: unknown) => void) => (() => void);
    mergeBranch: (repoPath: string, branchName: string, noFastForward?: boolean) => Promise<MergeResult>;
    mergeContinue: (repoPath: string, message?: string) => Promise<string>;
    mergeAbort: (repoPath: string) => Promise<boolean>;
    rebaseAbort: (repoPath: string) => Promise<boolean>;
    rebaseSkip: (repoPath: string) => Promise<{ done: boolean; conflicts: boolean }>;
    rebaseContinue: (repoPath: string) => Promise<{ done: boolean; conflicts: boolean }>;
    rebaseOnto: (repoPath: string, upstream: string) => Promise<{ status: 'rebased' | 'conflicts'; done: boolean }>;
    cherryPick: (repoPath: string, commitSha: string) => Promise<{ status: 'done' | 'conflicts' }>;
    cherryPickAbort: (repoPath: string) => Promise<boolean>;
    cherryPickContinue: (repoPath: string) => Promise<{ status: 'done' | 'conflicts' }>;
    cherryPickSkip: (repoPath: string) => Promise<{ status: 'done' | 'conflicts' }>;
    repoState: (repoPath: string) => Promise<RepoState>;
    statistics: (repoPath: string, sinceMonths?: number) => Promise<GitStatistics>;
    openPath: (fullPath: string) => Promise<boolean>;
    revealInFolder: (fullPath: string) => Promise<boolean>;
    assumeUnchanged: (repoPath: string, filePath: string, assume: boolean) => Promise<boolean>;
    stashFile: (repoPath: string, filePath: string | string[], message?: string, options?: { keepIndex?: boolean; includeUntracked?: boolean }) => Promise<boolean>;
    savePatch: (repoPath: string, filePath: string | string[], staged?: boolean) => Promise<{ saved: boolean; path?: string }>;
    fileHistory: (repoPath: string, filePath: string, maxCount?: number) => Promise<FileHistoryEntry[]>;
    saveTextFile: (defaultName: string, content: string) => Promise<{ saved: boolean; path?: string }>;
    openTextFile: () => Promise<{ content: string; path: string } | null>;
    fetchText: (url: string) => Promise<string>;
    cachePreview: (url: string) => Promise<string | null>;
    getFileBlame: (repoPath: string, filePath: string, rev?: string) => Promise<BlameLine[]>;
    commitFiles: (repoPath: string, commitId: string) => Promise<GitStatusEntry[]>;
    diffCommitFile: (repoPath: string, commitId: string, filePath: string) => Promise<FileDiff>;
    commitDiff: (repoPath: string, commitId: string) => Promise<string>;
    getConfig: (repoPath: string) => Promise<{ userName: string, userEmail: string }>;
    setConfig: (repoPath: string, userName: string, userEmail: string) => Promise<boolean>;
    getGlobalConfig: () => Promise<{ userName: string, userEmail: string }>;
    setGlobalConfig: (userName: string, userEmail: string) => Promise<boolean>;
    listFiles: (repoPath: string, refName?: string) => Promise<string[]>;
    getFileContent: (repoPath: string, filePath: string) => Promise<string>;
    saveFile: (repoPath: string, filePath: string, content: string) => Promise<void>;
    getAppChangelog: () => Promise<string>;
    getAppVersion: () => Promise<string>;
    // Native auto-update (electron-updater). `supported` is false on builds that
    // can't self-update (deb/rpm/pacman/msi, dev) — callers fall back to the
    // browser-download path.
    updaterCheck: () => Promise<{ supported: boolean }>;
    updaterDownload: () => Promise<{ supported: boolean }>;
    updaterInstall: () => Promise<{ supported: boolean }>;
    updaterGetState: () => Promise<UpdaterStatus>;
    onUpdaterStatus: (callback: (status: UpdaterStatus) => void) => (() => void);
    detectExternalTools: () => Promise<{ editors: { value: string, label: string }[], terminals: { value: string, label: string }[], mergeTools: { value: string, label: string }[], diffTools: { value: string, label: string }[] }>;
    detectAiClis: () => Promise<{ id: string, label: string }[]>;
    aiRunCli: (cliId: string, prompt: string) => Promise<{ text: string, error?: string }>;
    createTag: (repoPath: string, tagName: string, commitSha?: string) => Promise<void>;
    deleteTag: (repoPath: string, tagName: string) => Promise<boolean>;
    rewordCommit: (repoPath: string, commitSha: string, newMessage: string) => Promise<void>;
    squashCommit: (repoPath: string, commitSha: string) => Promise<void>;
    revertCommit: (repoPath: string, commitSha: string) => Promise<void>;
    commitAmend: (repoPath: string, message?: string) => Promise<void>;
    resetToCommit: (repoPath: string, commitSha: string, mode: 'soft' | 'mixed' | 'hard') => Promise<boolean>;
    addRemote: (repoPath: string, name: string, url: string) => Promise<boolean>;
    removeRemote: (repoPath: string, name: string) => Promise<boolean>;
    renameRemote: (repoPath: string, oldName: string, newName: string) => Promise<boolean>;
    setRemoteUrl: (repoPath: string, name: string, url: string) => Promise<boolean>;
    storeGet: (key: string) => any;
    storeSet?: (key: string, value: any) => void;
    storeDelete?: (key: string) => void;
    minimize: () => void;
    maximize: () => void;
    close: () => void;
    setZoom: (factor: number) => void;
    onProtocolUrl: (callback: (url: string) => void) => void;
    onGitLog: (callback: (repoPath: string, cmd: string, stdout: string, stderr: string, duration: number, exitCode: number) => void) => void;
}

declare global {
    interface Window {
        gitbox: GitboxAPI;
    }
}
