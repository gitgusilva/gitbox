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
}

export interface GraphNode {
    dotLane: number;
    color: string;
    lines: GraphLine[];
    width: number;
    isMerge?: boolean;
}

export type TabKey = 'history' | 'local_changes' | 'changes' | 'stashes' | 'files' | 'changelog' | 'pull_request' | 'create_pr';

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
    addSubmodule: (repoPath: string, url: string, targetPath: string) => Promise<boolean>;
    updateSubmodule: (repoPath: string, path: string) => Promise<boolean>;
    deleteSubmodule: (repoPath: string, path: string) => Promise<boolean>;
    log: (repoPath: string, maxCount?: number, refName?: string) => Promise<Commit[]>;
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
    push: (repoPath: string, remoteName?: string) => Promise<boolean>;
    createBranch: (repoPath: string, branchName: string) => Promise<boolean>;
    deleteBranch: (repoPath: string, branchName: string) => Promise<boolean>;
    diffFile: (repoPath: string, filePath: string) => Promise<FileDiff>;
    getStagedDiff: (repoPath: string) => Promise<string>;
    getFileDiff: (repoPath: string, filePath: string) => Promise<string>;
    stashChanges: (repoPath: string, stashId: string) => Promise<GitStatusEntry[]>;
    stashSave: (repoPath: string, message?: string) => Promise<boolean>;
    stashPop: (repoPath: string, stashId?: string) => Promise<boolean>;
    stashDrop: (repoPath: string, stashId?: string) => Promise<boolean>;
    diffStashFile: (repoPath: string, stashId: string, filePath: string) => Promise<FileDiff>;
    checkMerge: (repoPath: string, toBranch: string, fromBranch: string) => Promise<{ hasConflicts: boolean; files: string[] }>;
    commitFiles: (repoPath: string, commitId: string) => Promise<GitStatusEntry[]>;
    diffCommitFile: (repoPath: string, commitId: string, filePath: string) => Promise<FileDiff>;
    getConfig: (repoPath: string) => Promise<{ userName: string, userEmail: string }>;
    setConfig: (repoPath: string, userName: string, userEmail: string) => Promise<boolean>;
    listFiles: (repoPath: string, refName?: string) => Promise<string[]>;
    getFileContent: (repoPath: string, filePath: string) => Promise<string>;
    saveFile: (repoPath: string, filePath: string, content: string) => Promise<void>;
    getAppChangelog: () => Promise<string>;
    storeGet: (key: string) => any;
    storeSet?: (key: string, value: any) => void;
    storeDelete?: (key: string) => void;
    minimize: () => void;
    maximize: () => void;
    close: () => void;
    setZoom: (factor: number) => void;
    onProtocolUrl: (callback: (url: string) => void) => void;
}

declare global {
    interface Window {
        gitbox: GitboxAPI;
    }
}
