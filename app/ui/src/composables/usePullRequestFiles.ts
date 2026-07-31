import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { fetchPullRequestFileDiff, fetchPullRequestFiles } from '../services/pullRequestService';
import type { PullRequest, PullRequestFile } from '../services/pullRequestService';
import { isImagePath } from '../utils/formatters';

/** Providers hand file contents over as base64; text has to be decoded. */
function decodeBase64Text(payload: string) {
    const binary = atob(payload);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
}

/**
 * Owns a pull request's changed-file list and the diff of whichever file is
 * open. Split out of the components so the list and the panel that shows the
 * diff can live in different places in the layout while sharing one state.
 */
export function usePullRequestFiles(pr: () => PullRequest | null | undefined) {
    const { t } = useI18n();

    const files = ref<PullRequestFile[]>([]);
    const isLoading = ref(false);
    const loadError = ref<string | null>(null);

    const openIndex = ref<number | null>(null);
    const isLoadingDiff = ref(false);
    const diffError = ref<string | null>(null);
    const original = ref('');
    const modified = ref('');

    const openFile = computed(() => (openIndex.value === null ? null : files.value[openIndex.value] ?? null));

    const totals = computed(() => files.value.reduce(
        (acc, f) => ({ additions: acc.additions + f.additions, deletions: acc.deletions + f.deletions }),
        { additions: 0, deletions: 0 },
    ));

    async function load() {
        const current = pr();
        if (!current) return;
        isLoading.value = true;
        loadError.value = null;
        try {
            files.value = await fetchPullRequestFiles(current.number);
        } catch (e: any) {
            loadError.value = e?.message || String(e);
            files.value = [];
        } finally {
            isLoading.value = false;
        }
    }

    async function openAt(index: number) {
        const current = pr();
        const file = files.value[index];
        if (!file || !current) return;

        openIndex.value = index;
        diffError.value = null;
        original.value = '';
        modified.value = '';

        if (!current.baseSha || !current.headSha) {
            // The list payload carries no SHAs on some providers; the detail
            // fetch fills them in, so this only shows before that lands.
            diffError.value = t('pr_view.diff_unavailable');
            return;
        }

        isLoadingDiff.value = true;
        try {
            const sides = await fetchPullRequestFileDiff(file, current.baseSha, current.headSha);
            // Images stay base64 — the diff viewer turns them into data URLs.
            const decode = (value: string | null) => {
                if (!value) return '';
                return isImagePath(file.path) ? value : decodeBase64Text(value);
            };
            original.value = decode(sides.original);
            modified.value = decode(sides.modified);

            if (!original.value && !modified.value && !isImagePath(file.path)) {
                diffError.value = t('pr_view.diff_unavailable');
            }
        } catch (e: any) {
            diffError.value = e?.message || String(e);
        } finally {
            isLoadingDiff.value = false;
        }
    }

    function close() {
        openIndex.value = null;
        // Dropped together with the selection: the watcher below mirrors the
        // change to the detached window, and there is no reason to ship the
        // previous file's contents along with "nothing is open".
        original.value = '';
        modified.value = '';
    }

    function step(direction: 1 | -1) {
        if (openIndex.value === null) return;
        const next = openIndex.value + direction;
        if (next >= 0 && next < files.value.length) openAt(next);
    }

    // Escape and arrow navigation belong to the panel only while it is open, so
    // they keep working for the rest of the view otherwise.
    function onKeydown(e: KeyboardEvent) {
        if (openIndex.value === null) return;
        const target = e.target as HTMLElement | null;
        // Never hijack typing in the comment box.
        if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return;

        if (e.key === 'Escape') close();
        if (e.key === 'ArrowDown') step(1);
        if (e.key === 'ArrowUp') step(-1);
    }

    // --- Detached window --------------------------------------------------
    // The separate window renders whatever it is pushed and owns no state, so
    // both surfaces always agree and there is one fetch path.
    const isDetached = ref(false);

    function pushState() {
        if (!isDetached.value) return;

        // Every field is copied out by hand: `openFile` is a Vue reactive
        // proxy, and Electron's structured clone rejects those outright
        // ("An object could not be cloned"), which silently left the detached
        // window showing nothing.
        const file = openFile.value;

        window.gitbox.sendDiffWindowMessage({
            type: 'state',
            payload: {
                file: file
                    ? {
                        path: file.path,
                        status: file.status,
                        additions: file.additions,
                        deletions: file.deletions,
                        previousPath: file.previousPath,
                    }
                    : null,
                original: original.value,
                modified: modified.value,
                index: openIndex.value ?? 0,
                total: files.value.length,
                context: pr() ? `#${pr()!.number} ${pr()!.title}` : '',
                isLoading: isLoadingDiff.value,
                error: diffError.value,
            },
        });
    }

    async function detach() {
        if (openIndex.value === null) return;
        isDetached.value = true;
        // No push here: openDiffWindow resolves as soon as the window object
        // exists, long before its renderer can listen. The window announces
        // itself with 'ready' and gets the state then.
        await window.gitbox.openDiffWindow();
    }

    function attach() {
        isDetached.value = false;
        window.gitbox.closeDiffWindow();
    }

    const stopDiffWindowMessages = window.gitbox.onDiffWindowMessage((message) => {
        if (!message) return;

        // 'ready' arrives when the detached window finished mounting — it may
        // beat the first push, so answer it with the current state.
        if (message.type === 'ready') pushState();
        if (message.type === 'navigate') step(message.direction);

        // Docking back keeps the file open, now in the panel.
        if (message.type === 'attach') attach();

        // Dismissing the window from its own title bar is not the same thing:
        // it goes back to attached mode but shows nothing, so the panel does
        // not pop open again behind a window the user just closed. The guard
        // is what tells the two apart — attach() already cleared the flag
        // before the window's own 'closed' arrives.
        if (message.type === 'closed' && isDetached.value) {
            isDetached.value = false;
            close();
        }
    });

    // Any change to the open file, its contents or its loading state is
    // mirrored to the detached window.
    watch([openIndex, original, modified, isLoadingDiff, diffError], () => pushState());

    watch(openIndex, (value) => {
        if (value === null) {
            window.removeEventListener('keydown', onKeydown);
            // Closing the last file closes the window that was showing it.
            if (isDetached.value) attach();
            return;
        }

        window.addEventListener('keydown', onKeydown);
        // Selecting another file raises the detached window — otherwise the
        // click updates a window the user cannot see. Tied to the index rather
        // than to the content watcher above, which fires several times per
        // file and would keep stealing focus.
        if (isDetached.value) window.gitbox.sendDiffWindowMessage({ type: 'focus' });
    });

    watch(() => pr()?.number, () => {
        openIndex.value = null;
        load();
    }, { immediate: true });

    onBeforeUnmount(() => {
        window.removeEventListener('keydown', onKeydown);
        stopDiffWindowMessages?.();
        // A detached window outliving the view that feeds it would sit there
        // showing a file nothing can navigate.
        if (isDetached.value) window.gitbox.closeDiffWindow();
    });

    return {
        files, isLoading, loadError, totals,
        openIndex, openFile, isLoadingDiff, diffError, original, modified,
        isDetached,
        load, openAt, close, step, detach, attach,
    };
}
