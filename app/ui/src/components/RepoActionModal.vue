<script setup lang="ts">
import { ref } from 'vue';
import { Icon } from '@iconify/vue';

const props = defineProps<{ action: 'init' | 'clone' }>();
const emit = defineEmits(['close', 'success']);

const activeTab = ref(props.action === 'init' ? 'local' : 'url');

// Clone Form
const cloneUrl = ref('');
const cloneTargetDir = ref('');

// Init Form
const initName = ref('');
const initTargetDir = ref('');
const defaultBranch = ref('main');

async function handleAction() {
    alert('Will be bridged to electron git commands soon!');
    emit('close');
}

async function browseFolder(formType: 'clone' | 'init') {
    if (!window.gitbox) return;
    const path = await window.gitbox.selectFolder();
    if (path) {
        if (formType === 'clone') cloneTargetDir.value = path;
        else initTargetDir.value = path;
    }
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
    <div class="bg-[#2A2B2E] border border-[#3E4044] rounded shadow-2xl w-[850px] h-[550px] flex overflow-hidden scale-in-center">
      
      <!-- Sidebar -->
      <aside class="w-64 bg-[#212224] border-r border-[#3E4044] py-3 flex flex-col">
        <div class="text-[15px] font-bold text-neutral-200 px-4 mb-4 mt-2">{{ props.action === 'init' ? 'Initialize a Repository' : 'Clone a Repository' }}</div>
        
        <button v-if="props.action === 'init'"
                @click="activeTab = 'local'" 
                class="flex items-center gap-2 px-4 py-2.5 text-[13px] transition-colors text-left"
                :class="activeTab === 'local' ? 'bg-[#37373D] text-white border-l-2 border-[#4182E1]' : 'text-neutral-400 hover:bg-[#2A2B2E] hover:text-white border-l-2 border-transparent'">
          <Icon icon="lucide:monitor" class="w-4 h-4 ml-1" /> Local Only
        </button>

        <button v-if="props.action === 'clone'"
                @click="activeTab = 'url'" 
                class="flex items-center gap-2 px-4 py-2.5 text-[13px] transition-colors text-left"
                :class="activeTab === 'url' ? 'bg-[#37373D] text-white border-l-2 border-[#4182E1]' : 'text-neutral-400 hover:bg-[#2A2B2E] hover:text-white border-l-2 border-transparent'">
          <Icon icon="lucide:globe" class="w-4 h-4 ml-1" /> Clone with URL
        </button>
      </aside>

      <!-- Main Config -->
      <main class="flex-1 flex flex-col min-w-0 bg-[#252526]">
        <header class="h-12 flex items-center justify-between px-6 pt-2">
          <h1 class="text-[17px] text-neutral-200">
             {{ props.action === 'init' ? 'Initialize a Repo' : 'Clone a Repo' }}
          </h1>
          <button @click="emit('close')" class="text-neutral-500 hover:text-white transition-colors">
            <Icon icon="lucide:x" class="w-5 h-5" />
          </button>
        </header>

        <div class="flex-1 p-6 overflow-y-auto">
          
          <!-- Local Init -->
          <div v-if="activeTab === 'local'" class="flex flex-col gap-6 max-w-[500px]">
             <div class="flex justify-between items-center gap-4">
                <label class="text-[13px] text-neutral-400 w-32 text-right shrink-0">Name</label>
                <input v-model="initName" type="text" class="flex-1 bg-[#1E1E1E] border border-[#3E4044] rounded-sm px-3 py-1.5 text-[13px] text-white outline-none focus:border-blue-500" />
             </div>
             
             <div class="flex justify-between items-center gap-4">
                <label class="text-[13px] text-neutral-400 w-32 text-right shrink-0">Initialize in</label>
                <div class="flex-1 flex gap-2">
                    <input v-model="initTargetDir" type="text" class="flex-1 bg-[#1E1E1E] border border-[#3E4044] rounded-sm px-3 py-1.5 text-[13px] text-white outline-none focus:border-blue-500" />
                    <button @click="browseFolder('init')" class="bg-[#3A6B9B] hover:bg-[#467FB7] text-white px-4 rounded-sm text-[13px] font-medium transition-colors">Browse</button>
                </div>
             </div>
             
             <div class="flex justify-between gap-4">
                <label class="text-[13px] text-neutral-400 w-32 text-right shrink-0">Full path</label>
                <div class="flex-1 text-[13px] text-white font-mono opacity-80 break-all select-all">
                    {{ initTargetDir || '/' }}{{ initTargetDir && !initTargetDir.endsWith('/') && !initTargetDir.endsWith('\\') ? '/' : '' }}{{ initName }}
                </div>
             </div>

             <div class="flex justify-between items-center gap-4">
                <label class="text-[13px] text-neutral-400 w-32 text-right shrink-0">Default branch name</label>
                <input v-model="defaultBranch" type="text" class="flex-1 bg-[#1E1E1E] border border-[#3E4044] rounded-sm px-3 py-1.5 text-[13px] text-white outline-none focus:border-blue-500" />
             </div>
             
             <div class="flex justify-end mt-4">
                <button @click="handleAction" class="bg-[#236041] hover:bg-[#348A5E] text-green-100 border border-[#2B7951] px-5 py-2 rounded-sm text-[13px] shadow transition-colors font-semibold">Create Repository</button>
             </div>
          </div>

          <!-- URL Clone -->
          <div v-if="activeTab === 'url'" class="flex flex-col gap-6 max-w-[500px]">
             
             <div class="flex justify-between items-center gap-4">
                <label class="text-[13px] text-neutral-400 w-32 text-right shrink-0">Where to clone to</label>
                <div class="flex-1 flex gap-2">
                    <input v-model="cloneTargetDir" type="text" class="flex-1 bg-[#1E1E1E] border border-[#3E4044] rounded-sm px-3 py-1.5 text-[13px] text-white outline-none focus:border-blue-500" />
                    <button @click="browseFolder('clone')" class="bg-[#3A6B9B] hover:bg-[#467FB7] text-white px-4 rounded-sm text-[13px] font-medium transition-colors">Browse</button>
                </div>
             </div>
             
             <div class="flex justify-between items-center gap-4">
                <label class="text-[13px] text-neutral-400 w-32 text-right shrink-0">URL</label>
                <input v-model="cloneUrl" type="text" class="flex-1 bg-[#1E1E1E] border border-[#3E4044] rounded-sm px-3 py-1.5 text-[13px] text-white outline-none focus:border-blue-500" />
             </div>

             <div class="flex justify-between gap-4">
                <label class="text-[13px] text-neutral-400 w-32 text-right shrink-0">Full path</label>
                <div class="flex-1 text-[13px] text-white font-mono opacity-80 break-all select-all">
                    {{ cloneTargetDir || '/' }}
                </div>
             </div>
             
             <div class="flex justify-end mt-4">
                <button @click="handleAction" class="bg-[#236041] hover:bg-[#348A5E] text-green-100 border border-[#2B7951] px-5 py-2 rounded-sm text-[13px] shadow transition-colors font-semibold">Clone the repo!</button>
             </div>
          </div>

        </div>
      </main>
    </div>
  </div>
  </Teleport>
</template>

<style scoped>
.scale-in-center {
	animation: scale-in-center 0.1s cubic-bezier(0.250, 0.460, 0.450, 0.940) both;
}
@keyframes scale-in-center {
  0% { transform: scale(0.95); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
</style>
