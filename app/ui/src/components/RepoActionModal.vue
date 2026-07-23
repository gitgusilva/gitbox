<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import Modal from './Common/Modal.vue';
import ScrollArea from './Common/ScrollArea.vue';
import Button from './Common/Button.vue';
import Checkbox from './Common/Checkbox.vue';
import { openRepository } from '../services/workspaceService';
import { withCredentialRetry, stripAuthMarker } from '../services/credentials';

const { t } = useI18n();

const busy = ref(false);
const error = ref('');

const props = defineProps<{ action: 'init' | 'clone' }>();
const emit = defineEmits(['close', 'success']);

// Clone Form
const cloneUrl = ref('');
const cloneTargetDir = ref('');
const cloneName = ref('');
// The name field defaults to whatever the URL implies, but the user may rename
// the local folder — once they do, typing more of the URL must not clobber it.
const nameEdited = ref(false);

// Optional per-clone credentials, collapsed by default. A public repo needs
// nothing here; a private origin on a server GitBox has no saved credential for
// would otherwise fail with "authentication failed" and no way to recover from
// this dialog.
const showAuth = ref(false);
const cloneUser = ref('');
const clonePass = ref('');
// Opt-in: persist the typed credentials encrypted. Off by default — otherwise
// they're kept for this session only (askpass default).
const cloneRemember = ref(false);

// "Test credentials": a no-clone auth handshake against the host, so the user
// finds out the token is wrong here instead of after a long clone fails.
const testing = ref(false);
const testResult = ref<{ ok: boolean; message?: string } | null>(null);

// Init Form
const initName = ref('');
const initTargetDir = ref('');
const defaultBranch = ref('main');

/** The repository name a URL implies — its last path segment, minus .git. */
function nameFromUrl(url: string): string {
    const cleaned = String(url).trim().replace(/[/\\]+$/, '');   // drop trailing slashes
    const last = cleaned.split(/[/\\:]/).pop() || '';
    return last.replace(/\.git$/i, '');
}

watch(cloneUrl, (url) => {
    if (!nameEdited.value) cloneName.value = nameFromUrl(url);
});

/** SSH remotes authenticate with keys, not a username/password — the auth
 *  fields only make sense for http(s). */
const isSshUrl = computed(() => /^(git@|ssh:\/\/)/i.test(cloneUrl.value.trim()));

/** Absolute path the clone will land in: <destination>/<name>. */
const cloneFullPath = computed(() => {
    const dir = cloneTargetDir.value.trim();
    const name = cloneName.value.trim();
    if (!dir) return '/';
    const sep = dir.endsWith('/') || dir.endsWith('\\') ? '' : '/';
    return name ? `${dir}${sep}${name}` : dir;
});

const canClone = computed(() =>
    !!cloneUrl.value.trim() && !!cloneTargetDir.value.trim() && !!cloneName.value.trim() && !busy.value);

async function handleAction() {
    error.value = '';
    if (props.action === 'clone') {
        if (!window.gitbox || !canClone.value) return;
        busy.value = true;
        try {
            // On the first attempt use whatever was typed in the Authentication
            // collapse; on a prompt-driven retry drop it so the just-saved
            // credentials win (a wrong inline value would otherwise fail again).
            const res = await withCredentialRetry((isRetry) => window.gitbox.clone(
                cloneUrl.value.trim(), cloneTargetDir.value.trim(), {
                    name: cloneName.value.trim(),
                    username: isRetry ? undefined : (cloneUser.value.trim() || undefined),
                    password: isRetry ? undefined : (clonePass.value || undefined),
                    remember: isRetry ? undefined : cloneRemember.value,
                }));
            if (res && res.path) openRepository(res.path, res.name);
            emit('success');
            emit('close');
        } catch (e: any) {
            error.value = stripAuthMarker(e?.message || 'Clone failed');
        } finally {
            busy.value = false;
        }
        return;
    }

    // init
    if (!window.gitbox || !initTargetDir.value.trim() || busy.value) return;
    busy.value = true;
    try {
        const res = await window.gitbox.init(initTargetDir.value.trim(), initName.value.trim(), defaultBranch.value.trim() || 'main');
        if (res && res.path) openRepository(res.path, res.name);
        emit('success');
        emit('close');
    } catch (e: any) {
        error.value = e?.message || 'Init failed';
    } finally {
        busy.value = false;
    }
}

async function browseFolder(formType: 'clone' | 'init') {
    if (!window.gitbox) return;
    const path = await window.gitbox.selectFolder();
    if (path) {
        if (formType === 'clone') cloneTargetDir.value = path;
        else initTargetDir.value = path;
    }
}

const canTest = computed(() => !!cloneUrl.value.trim() && !testing.value);

async function testCredentials() {
    if (!canTest.value || !window.gitbox?.testCredentials) return;
    testing.value = true;
    testResult.value = null;
    try {
        testResult.value = await window.gitbox.testCredentials(
            cloneUrl.value.trim(), cloneUser.value.trim(), clonePass.value);
    } catch (e: any) {
        testResult.value = { ok: false, message: stripAuthMarker(e?.message || 'Test failed') };
    } finally {
        testing.value = false;
    }
}

// A changed URL or credential invalidates any earlier test result.
watch([cloneUrl, cloneUser, clonePass], () => { testResult.value = null; });
</script>

<template>
  <Modal :modelValue="true" :scrollBody="false"
         :title="props.action === 'init' ? t('modal.initialize_a_repository') : t('modal.clone_a_repository')"
         :icon="props.action === 'init' ? 'lucide:folder-plus' : 'lucide:git-branch'"
         iconColor="text-accent"
         @update:modelValue="!$event && emit('close')" width="560px" height="auto" maxHeight="86vh">

    <ScrollArea class="flex-1 min-h-0 px-6 py-5">

      <!-- Local Init -->
      <div v-if="props.action === 'init'" class="flex flex-col gap-4">
         <div>
            <label class="block text-[10px] font-bold text-content-muted uppercase tracking-wide mb-1.5">{{ t('modal.name') }}</label>
            <input v-model="initName" type="text" class="w-full bg-app border border-line-strong rounded-md px-3 py-2 text-[13px] text-content-strong outline-none focus:border-accent transition-colors" />
         </div>

         <div>
            <label class="block text-[10px] font-bold text-content-muted uppercase tracking-wide mb-1.5">{{ t('modal.initialize_in') }}</label>
            <div class="flex gap-2">
                <input v-model="initTargetDir" type="text" class="flex-1 min-w-0 bg-app border border-line-strong rounded-md px-3 py-2 text-[13px] text-content-strong outline-none focus:border-accent transition-colors" />
                <Button variant="secondary" @click="browseFolder('init')">{{ t('modal.browse') }}</Button>
            </div>
         </div>

         <div>
            <label class="block text-[10px] font-bold text-content-muted uppercase tracking-wide mb-1.5">{{ t('modal.default_branch_name') }}</label>
            <input v-model="defaultBranch" type="text" class="w-full bg-app border border-line-strong rounded-md px-3 py-2 text-[13px] text-content-strong outline-none focus:border-accent transition-colors" />
         </div>

         <div class="rounded-md bg-app/60 border border-line px-3 py-2">
            <span class="text-[9px] font-bold text-content-muted uppercase tracking-wide">{{ t('modal.full_path') }}</span>
            <div class="text-[12px] text-content-strong font-mono break-all select-all mt-0.5">
               {{ initTargetDir || '…' }}{{ initTargetDir && !initTargetDir.endsWith('/') && !initTargetDir.endsWith('\\') ? '/' : '' }}{{ initName }}
            </div>
         </div>
      </div>

      <!-- URL Clone -->
      <div v-else class="flex flex-col gap-4">

         <div>
            <label class="block text-[10px] font-bold text-content-muted uppercase tracking-wide mb-1.5">{{ t('modal.url') }}</label>
            <input v-model="cloneUrl" type="text" placeholder="https://… / git@…" class="w-full bg-app border border-line-strong rounded-md px-3 py-2 text-[13px] text-content-strong outline-none focus:border-accent transition-colors" />
         </div>

         <div>
            <label class="block text-[10px] font-bold text-content-muted uppercase tracking-wide mb-1.5">{{ t('modal.name') }}</label>
            <input v-model="cloneName" @input="nameEdited = true" type="text" class="w-full bg-app border border-line-strong rounded-md px-3 py-2 text-[13px] text-content-strong outline-none focus:border-accent transition-colors" />
         </div>

         <div>
            <label class="block text-[10px] font-bold text-content-muted uppercase tracking-wide mb-1.5">{{ t('modal.where_to_clone_to') }}</label>
            <div class="flex gap-2">
                <input v-model="cloneTargetDir" type="text" class="flex-1 min-w-0 bg-app border border-line-strong rounded-md px-3 py-2 text-[13px] text-content-strong outline-none focus:border-accent transition-colors" />
                <Button variant="secondary" @click="browseFolder('clone')">{{ t('modal.browse') }}</Button>
            </div>
         </div>

         <div class="rounded-md bg-app/60 border border-line px-3 py-2">
            <span class="text-[9px] font-bold text-content-muted uppercase tracking-wide">{{ t('modal.full_path') }}</span>
            <div class="text-[12px] font-mono break-all select-all mt-0.5" :class="cloneTargetDir ? 'text-content-strong' : 'text-content-muted'">
               {{ cloneTargetDir ? cloneFullPath : '…' }}
            </div>
         </div>

         <!-- Private origin: optional credentials -->
         <div class="border-t border-line pt-3 -mx-0">
            <button type="button" @click="showAuth = !showAuth"
                    class="flex items-center gap-1.5 text-[12px] font-medium text-content-muted hover:text-content-strong transition-colors">
               <Icon :icon="showAuth ? 'lucide:chevron-down' : 'lucide:chevron-right'" class="w-3.5 h-3.5" />
               <Icon icon="lucide:lock" class="w-3.5 h-3.5" />
               {{ t('modal.clone_auth') }}
            </button>
            <div v-if="showAuth" class="mt-3 flex flex-col gap-3 pl-1">
               <p class="text-[11px] text-content-muted leading-relaxed">{{ t('modal.clone_auth_hint') }}</p>
               <p v-if="isSshUrl" class="text-[11px] text-amber-500 flex items-start gap-1.5 leading-relaxed">
                  <Icon icon="lucide:info" class="w-3.5 h-3.5 shrink-0 mt-px" />
                  {{ t('modal.clone_auth_ssh') }}
               </p>
               <template v-else>
                 <div>
                    <label class="block text-[10px] font-bold text-content-muted uppercase tracking-wide mb-1.5">{{ t('modal.username') }}</label>
                    <input v-model="cloneUser" type="text" autocomplete="off" :placeholder="t('modal.username_placeholder')" class="w-full bg-app border border-line-strong rounded-md px-3 py-2 text-[13px] text-content-strong outline-none focus:border-accent transition-colors" />
                 </div>
                 <div>
                    <label class="block text-[10px] font-bold text-content-muted uppercase tracking-wide mb-1.5">{{ t('modal.password') }}</label>
                    <input v-model="clonePass" type="password" autocomplete="off" :placeholder="t('modal.password_placeholder')" class="w-full bg-app border border-line-strong rounded-md px-3 py-2 text-[13px] text-content-strong outline-none focus:border-accent transition-colors" />
                 </div>
                 <Checkbox v-model="cloneRemember" class="items-start">
                    <span class="text-[11px] text-content leading-snug">
                       {{ t('credential_prompt.remember') }}
                       <span class="block text-[10px] text-content-muted mt-0.5">{{ t('credential_prompt.remember_on') }}</span>
                    </span>
                 </Checkbox>

                 <div class="flex flex-col gap-2">
                    <button type="button" @click="testCredentials" :disabled="!canTest"
                            class="self-start shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold border border-line-strong text-content-muted hover:text-content-strong hover:border-accent/50 hover:bg-surface-hover transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                       <Icon :icon="testing ? 'lucide:loader-circle' : 'lucide:plug-zap'" :class="['w-3.5 h-3.5', testing && 'animate-spin']" />
                       {{ testing ? t('modal.testing') : t('modal.test_credentials') }}
                    </button>
                    <div v-if="testResult" class="text-[11px] flex items-start gap-1.5 leading-snug"
                         :class="testResult.ok ? 'text-green-500' : 'text-red-400'">
                       <Icon :icon="testResult.ok ? 'lucide:circle-check' : 'lucide:circle-x'" class="w-3.5 h-3.5 shrink-0 mt-px" />
                       <span class="min-w-0 break-words">{{ testResult.ok ? t('modal.test_credentials_ok') : testResult.message }}</span>
                    </div>
                 </div>
               </template>
            </div>
         </div>
      </div>

    </ScrollArea>

    <template #footer>
       <div class="flex items-center justify-between gap-3">
          <p v-if="error" class="text-[12px] text-red-400 leading-snug flex-1 min-w-0">{{ error }}</p>
          <span v-else class="flex-1"></span>
          <Button v-if="props.action === 'init'" variant="primary" :loading="busy" icon="lucide:folder-plus" @click="handleAction">{{ t('modal.create_repository') }}</Button>
          <Button v-else variant="primary" :loading="busy" :disabled="!canClone" icon="lucide:git-branch" @click="handleAction">{{ t('modal.clone_the_repo') }}</Button>
       </div>
    </template>
  </Modal>
</template>
