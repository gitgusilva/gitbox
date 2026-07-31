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
        // Dropped together with the selection so nothing stale is left behind
        // for the next file.
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

    watch(openIndex, (value) => {
        if (value === null) window.removeEventListener('keydown', onKeydown);
        else window.addEventListener('keydown', onKeydown);
    });

    watch(() => pr()?.number, () => {
        openIndex.value = null;
        load();
    }, { immediate: true });

    onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));

    return {
        files, isLoading, loadError, totals,
        openIndex, openFile, isLoadingDiff, diffError, original, modified,
        load, openAt, close, step,
    };
}
