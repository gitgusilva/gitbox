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
import DeviceFlowModal from '../components/DeviceFlowModal.vue';
import ToastContainer from '../components/ToastContainer.vue';
import UpdateModal from '../components/UpdateModal.vue';
import BranchActionModal from '../components/BranchActionModal.vue';
import StashModal from '../components/StashModal.vue';
import { confirmModal, inputModal, contextMenu, isSettingsOpen, isShortcutsModalOpen, isCreatePROpen, deviceFlowModal, branchActionModal } from '../services/modalService';
import { activeWorkspaceId, workspaces, isChangelogVisible } from '../services/workspaceService';
import TerminalPanel from './TerminalPanel.vue';
import AppFooter from './Footer.vue';
import { initGlobalShortcuts } from '../services/shortcutService';
import { computed, onMounted } from 'vue';
import { getItem, setItem } from '../services/storageService';
import { toggleTerminal } from '../services/gitService';
import ChangelogView from './ChangelogView.vue';
import CreatePRModal from '../components/CreatePRModal.vue';
import PushModal from '../components/PushModal.vue';
import PullModal from '../components/PullModal.vue';
import AddSubmoduleModal from '../components/AddSubmoduleModal.vue';
import EditSubmoduleModal from '../components/EditSubmoduleModal.vue';
import { registerShortcut } from '../services/shortcutService';
import { initProtocolHandler } from '../services/protocol';



const activeWorkspacePath = computed(() => {
    const ws = workspaces.value.find(w => w.id === activeWorkspaceId.value);
    return ws ? ws.path : null;
});

const currentVersion = '1.0.0';

onMounted(() => {
    registerShortcut('ctrl+j', () => toggleTerminal(), { descriptionKey: 'Toggle Terminal', category: 'global' });
    registerShortcut('ctrl+,', () => isSettingsOpen.value = true, { descriptionKey: 'Settings', category: 'global' });
    registerShortcut('ctrl+/', () => isShortcutsModalOpen.value = true, { descriptionKey: 'Keyboard Shortcuts', category: 'global' });
    
    const lastVersion = getItem('gitbox_last_version');
    if (lastVersion !== currentVersion) {
        setTimeout(() => {
            isChangelogVisible.value = true;
            activeWorkspaceId.value = 'changelog';
            setItem('gitbox_last_version', currentVersion);
        }, 1000); // Small delay before switching
    }

    initProtocolHandler();
});

initGlobalShortcuts();

const { t } = useI18n();
</script>

<template>
  <div class="v-stack h-screen bg-[#F3F3F3] dark:bg-[#18181A] text-neutral-800 dark:text-neutral-300 font-sans text-sm outline-none overflow-hidden pb-[env(safe-area-inset-bottom)] transition-colors">
    
    <CreatePRModal />
    <PushModal />
    <PullModal />
    <AddSubmoduleModal />
    <EditSubmoduleModal />
    <ContextMenu v-if="contextMenu" :x="contextMenu.x" :y="contextMenu.y" :items="contextMenu.items" @close="contextMenu = null" />
    <DeviceFlowModal v-if="deviceFlowModal" />
    <BranchActionModal v-if="branchActionModal" />
    <StashModal />
    <UpdateModal />
    <ToastContainer />

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
    
    <div v-if="activeWorkspaceId && activeWorkspacePath" class="v-stack flex-1 h-full min-h-0 relative">
      <!-- Header -->
      <Header />

      <div class="flex flex-row flex-1 min-h-0 overflow-hidden relative">
        <!-- Sidebar -->
        <Sidebar />

        <!-- Main Content -->
        <main class="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden bg-app transition-colors relative">
          <div class="flex-1 min-h-0 overflow-hidden flex flex-col">
            <slot />
          </div>
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
