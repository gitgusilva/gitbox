<script setup lang="ts">
import { ref } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import Sidebar from './Sidebar/Sidebar.vue';
import Header from './Header.vue';
import Toolbar from './Toolbar.vue';
import WelcomeView from './WelcomeView.vue';
import ContextMenu from '../components/ContextMenu.vue';
import ConfirmModal from '../components/ConfirmModal.vue';
import InputModal from '../components/InputModal.vue';
import { confirmModal, inputModal, contextMenu, isSettingsOpen, isShortcutsModalOpen } from '../services/modalService';
import { onMouseMove, onMouseUp } from '../services/layoutService';
import { activeWorkspaceId, workspaces } from '../services/workspaceService';
import TerminalPanel from './TerminalPanel.vue';
import AppFooter from './Footer.vue';
import { initGlobalShortcuts } from '../services/shortcutService';
import { computed, onMounted } from 'vue';
import { getItem, setItem } from '../services/storageService';
import { activeTab, toggleTerminal } from '../services/gitService';
import ChangelogView from './ChangelogView.vue';
import { registerShortcut } from '../services/shortcutService';

const activeWorkspacePath = computed(() => {
    const ws = workspaces.value.find(w => w.id === activeWorkspaceId.value);
    return ws ? ws.path : null;
});

const currentVersion = '1.0.0';

onMounted(() => {
    registerShortcut('ctrl+j', () => toggleTerminal(), { descriptionKey: 'Toggle Terminal', category: 'global' });
    registerShortcut('ctrl+,', () => isSettingsOpen.value = true, { descriptionKey: 'Settings', category: 'global' });
    registerShortcut('ctrl+/', () => isShortcutsModalOpen.value = true, { descriptionKey: 'Keyboard Shortcuts', category: 'global' });
    
    const neverShow = getItem('gitbox_hide_changelog_forever');
    const seenVersion = getItem(`gitbox_changelog_seen_${currentVersion}`);
    if (neverShow !== 'true' && seenVersion !== 'true') {
        setTimeout(() => {
            activeWorkspaceId.value = 'changelog';
            setItem(`gitbox_changelog_seen_${currentVersion}`, 'true');
        }, 1000); // Small delay before switching
    }
});

initGlobalShortcuts();

const { t } = useI18n();
</script>

<template>
  <div class="flex flex-col h-screen bg-[#F3F3F3] dark:bg-[#18181A] text-neutral-800 dark:text-neutral-300 font-sans text-sm outline-none overflow-hidden pb-[env(safe-area-inset-bottom)] transition-colors">
    
    <ContextMenu v-if="contextMenu" :x="contextMenu.x" :y="contextMenu.y" :items="contextMenu.items" @close="contextMenu = null" />

    <ConfirmModal v-if="confirmModal"
      :title="confirmModal.title"
      :message="confirmModal.message"
      :danger="confirmModal.danger"
      @cancel="confirmModal = null"
      @confirm="confirmModal.onConfirm" />

    <InputModal v-if="inputModal"
      :title="inputModal.title"
      :message="inputModal.message"
      :placeholder="inputModal.placeholder"
      :initialValue="inputModal.initialValue"
      :confirmText="inputModal.confirmText"
      @cancel="inputModal = null"
      @confirm="inputModal.onConfirm" />

    <Toolbar />
    
    <div v-if="activeWorkspaceId && activeWorkspacePath" class="flex-col flex flex-1 h-full min-h-0 relative">
      <!-- Header -->
      <Header />

      <div class="flex-1 flex min-h-0 relative">
        <!-- Sidebar -->
        <Sidebar />

        <!-- Main Content -->
        <main class="flex-1 flex flex-col min-w-0 min-h-0 bg-white dark:bg-[#1E1E1E] transition-colors relative">
          <slot />
          <TerminalPanel />
        </main>
      </div>
    </div>
    <div v-else class="flex-1 overflow-hidden">
      <ChangelogView v-if="activeWorkspaceId === 'changelog'" :version="currentVersion" />
      <WelcomeView v-else />
    </div>

    <!-- Application Footer -->
    <AppFooter />
  </div>
</template>
