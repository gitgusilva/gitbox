<script setup lang="ts">
import { computed, ref } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import Tooltip from '../Common/Tooltip.vue';
import { fetchReactions, toggleReaction } from '../../services/pullRequestService';
import type { PRReaction, ReactionTarget } from '../../services/pullRequestService';

const props = defineProps<{
    target: ReactionTarget;
    /**
     * The provider's inline reaction counts (GitHub sends them with the PR and
     * with every comment). Rendering these first means the bar shows up
     * immediately; who reacted is only fetched when the user asks for it.
     */
    initial?: Record<string, any> | null;
    /** False when nobody is signed in — the bar stays read-only. */
    canReact?: boolean;
}>();

const { t } = useI18n();

// Declared in the order the picker offers them, so the two cannot drift.
const ICONS: Record<string, string> = {
    '+1': 'lucide:thumbs-up',
    '-1': 'lucide:thumbs-down',
    'laugh': 'mdi:emoticon-laugh-outline',
    'hooray': 'mdi:party-popper',
    'confused': 'mdi:emoticon-confused-outline',
    'heart': 'mdi:heart-outline',
    'rocket': 'mdi:rocket-launch-outline',
    'eyes': 'mdi:eye-outline',
};

const PICKER = Object.keys(ICONS);

function iconFor(content: string) {
    return ICONS[content] || 'mdi:emoticon-outline';
}

/** Counts straight off the payload, before anything is fetched. */
const fromInitial = computed<PRReaction[]>(() => {
    const raw = props.initial;
    if (!raw) return [];
    return Object.entries(raw)
        .filter(([key, value]) => typeof value === 'number' && value > 0 && key !== 'total_count')
        .map(([content, count]) => ({ content, count: count as number, users: [] }));
});

const detailed = ref<PRReaction[] | null>(null);
const isLoadingDetails = ref(false);
const isPickerOpen = ref(false);
const pending = ref<string | null>(null);

const reactions = computed(() => detailed.value ?? fromInitial.value);

/**
 * Who reacted needs a request per target, so it is deferred until the user
 * shows interest (hovering the bar or opening the picker) instead of firing
 * once per comment on every render.
 */
async function ensureDetails(force = false) {
    if (isLoadingDetails.value) return;
    if (detailed.value && !force) return;
    isLoadingDetails.value = true;
    try {
        detailed.value = await fetchReactions(props.target);
    } finally {
        isLoadingDetails.value = false;
    }
}

function tooltipFor(reaction: PRReaction) {
    if (reaction.users.length) {
        return `${reaction.users.join(', ')} ${t('pr_view.reacted_with')} :${reaction.content}:`;
    }
    return isLoadingDetails.value ? t('common.loading') : `:${reaction.content}:`;
}

async function react(content: string) {
    if (!props.canReact || pending.value) return;
    isPickerOpen.value = false;
    pending.value = content;

    // The viewer's own reaction id only exists in the detailed payload; without
    // it a second click would try to add a duplicate instead of undoing.
    await ensureDetails();
    const existing = detailed.value?.find(r => r.content === content);

    try {
        const ok = await toggleReaction(props.target, content, existing?.viewerReactionId);
        if (ok) await ensureDetails(true);
    } finally {
        pending.value = null;
    }
}
</script>

<template>
    <div class="flex flex-wrap items-center gap-2" @mouseenter="ensureDetails()">
        <Tooltip v-for="reaction in reactions" :key="reaction.content" :text="tooltipFor(reaction)">
            <button type="button"
                    :disabled="!canReact || pending === reaction.content"
                    @click="react(reaction.content)"
                    :class="[
                        'flex items-center gap-1.5 border rounded-full px-2.5 py-0.5 text-[10px] transition-colors',
                        canReact ? 'cursor-pointer' : 'cursor-default',
                        reaction.viewerReactionId
                            ? 'bg-accent/15 border-accent/50 text-accent'
                            : 'bg-surface-hover border-line text-content-muted hover:text-content-strong',
                    ]">
                <Icon :icon="iconFor(reaction.content)" class="text-[12px]" />
                <span class="font-medium tabular-nums">{{ reaction.count }}</span>
            </button>
        </Tooltip>

        <div v-if="canReact" class="relative">
            <Tooltip :text="t('pr_view.add_reaction')">
                <button type="button"
                        @click="isPickerOpen = !isPickerOpen; isPickerOpen && ensureDetails()"
                        class="flex items-center justify-center w-6 h-6 rounded-full border border-line bg-surface-hover text-content-muted hover:text-content-strong transition-colors">
                    <Icon icon="lucide:smile-plus" class="text-[12px]" />
                </button>
            </Tooltip>

            <!-- Click-away closes the picker without stealing the click that
                 lands on one of the emoji. -->
            <div v-if="isPickerOpen" class="fixed inset-0 z-40" @click="isPickerOpen = false"></div>
            <div v-if="isPickerOpen"
                 class="absolute bottom-full left-0 mb-1 z-50 flex items-center gap-0.5 p-1 rounded-lg border border-line-strong bg-overlay shadow-xl">
                <button v-for="content in PICKER" :key="content"
                        type="button"
                        @click="react(content)"
                        class="w-7 h-7 flex items-center justify-center rounded hover:bg-surface-hover text-content-muted hover:text-content-strong transition-colors">
                    <Icon :icon="iconFor(content)" class="text-sm" />
                </button>
            </div>
        </div>
    </div>
</template>
