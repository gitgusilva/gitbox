import { ref, computed } from 'vue';
import { getItem, setItem } from './storageService';

export type LogCategory = 'Git' | 'Action' | 'System' | 'Error';
export type LogType = 'info' | 'success' | 'warning' | 'error' | 'command';

export interface LogEntry {
    id: string;
    timestamp: number;
    message: string;
    category: LogCategory;
    type: LogType;
    details?: string;
    command?: string;
    duration?: number;
}

const IGNORED_COMMANDS = [
    'git show',
    'git status',
    'git rev-parse',
    'git config',
    'git ls-files',
    'git remote get-url',
    'git log -n 1',
    'git branch --show-current',
    'git branch --list',
    'git rev-list',
    'git symbolic-ref',
    'git check-ignore',
    'git check-attr',
    'git submodule',
    'git fetch'
];

// Automatically listen for git command logs from the backend
if (window.gitbox && window.gitbox.onGitLog) {
    window.gitbox.onGitLog((_repoPath: string, cmd: string, stdout: string, stderr: string, duration: number, exitCode: number) => {
        const isIgnored = IGNORED_COMMANDS.some(ignored => cmd.startsWith(ignored));
        if (isIgnored) return;

        // Only log actual git commands here, avoid logging the 'status' or metadata calls if possible
        // but the backend usually only sends 'action' commands to this listener.
        addLog(
            cmd,
            'Git',
            exitCode === 0 ? 'command' : 'error',
            {
                command: cmd,
                details: stdout + (stderr ? '\n' + stderr : ''),
                duration
            }
        );
    });
}

const STORAGE_KEY = 'gitbox_output_logs';
const MAX_LOGS = 800;
// Cap each entry's stored output so a single big command (e.g. a full log/diff)
// can't bloat the persisted store into megabytes — that blocked the main process
// on every synchronous store read/write and could OOM/crash the app.
const MAX_DETAIL_CHARS = 4000;

function truncateDetails(details?: string): string | undefined {
    if (!details) return details;
    return details.length > MAX_DETAIL_CHARS
        ? details.slice(0, MAX_DETAIL_CHARS) + '\n…[truncated]'
        : details;
}

function loadPersistentLogs(): LogEntry[] {
    const saved = getItem(STORAGE_KEY);
    if (saved) {
        try {
            return JSON.parse(saved);
        } catch (e) {
            return [];
        }
    }
    return [];
}

const logs = ref<LogEntry[]>(loadPersistentLogs());
export const isLogOpen = ref(false);

let saveTimeout: any = null;
function persistLogs() {
    if (saveTimeout) clearTimeout(saveTimeout);
    // Debounced + only persist a trimmed slice, so a burst of commands doesn't
    // write a multi-MB blob synchronously to the shared config store.
    saveTimeout = setTimeout(() => {
        setItem(STORAGE_KEY, JSON.stringify(logs.value.slice(0, MAX_LOGS)));
    }, 1500);
}

export function addLog(
    message: string,
    category: LogCategory = 'Action',
    type: LogType = 'info',
    options: { details?: string; command?: string; duration?: number } = {}
) {
    const isIgnored = IGNORED_COMMANDS.some(ignored =>
        message.startsWith(ignored) ||
        (options.command && options.command.startsWith(ignored))
    );
    if (isIgnored) return;

    const entry: LogEntry = {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: Date.now(),
        message,
        category,
        type,
        ...options,
        details: truncateDetails(options.details)
    };

    logs.value.unshift(entry);

    // Keep only last MAX_LOGS to prevent memory and storage issues
    if (logs.value.length > MAX_LOGS) {
        logs.value.length = MAX_LOGS;
    }

    persistLogs();
}

export { logs };

export const clearLogs = () => {
    logs.value = [];
    persistLogs();
};

export const categories = ['All', 'Git', 'Action', 'Error'] as const;
export const activeCategory = ref<typeof categories[number]>('All');

export const filteredLogs = computed(() => {
    if (activeCategory.value === 'All') return logs.value;

    return logs.value.filter(log => {
        if (activeCategory.value === 'Error') return log.type === 'error' || log.category === 'Error';
        return log.category === activeCategory.value;
    });
});
