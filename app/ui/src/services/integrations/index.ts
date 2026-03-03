import { ref, computed } from 'vue';
import { getItem, setItem } from '../storageService';
import { IntegrationInfo, IIntegrationProvider, IntegrationSession } from './core/types';
import { GitHubProvider } from './providers/GitHubProvider';
import { GitLabProvider } from './providers/GitLabProvider';
import { BitbucketProvider } from './providers/BitbucketProvider';

const providers: IIntegrationProvider[] = [
    new GitHubProvider(),
    new GitLabProvider(),
    new BitbucketProvider()
];

const sessions = ref<Record<string, IntegrationSession>>(initSessions());

function initSessions() {
    const stored = getItem('gitbox_integrations');
    if (!stored) return {};
    try {
        return typeof stored === 'string' ? JSON.parse(stored) : stored;
    } catch (e) {
        return {};
    }
}

export function useIntegrations() {
    const list = computed<IntegrationInfo[]>(() => providers.map(p => ({
        id: p.id,
        name: p.name,
        icon: p.icon,
        color: p.color,
        connected: !!sessions.value[p.id],
        user: sessions.value[p.id]?.user
    })));

    async function connect(providerId: string) {
        const provider = providers.find(p => p.id === providerId);
        if (!provider) return;

        if (provider.connectAction) {
            await provider.connectAction((session) => {
                const current = { ...sessions.value };
                current[providerId] = session;
                sessions.value = current;
                saveSessions();
            });
            return;
        }

        if (provider.getAuthUrl) {
            const url = await provider.getAuthUrl();
            if (window.gitbox?.openExternal) {
                await window.gitbox.openExternal(url);
            }
        }
    }

    function disconnect(providerId: string) {
        const current = { ...sessions.value };
        delete current[providerId];
        sessions.value = current;
        saveSessions();
    }

    async function handleAuthCallback(providerId: string, params: URLSearchParams) {
        const provider = providers.find(p => p.id === providerId);
        if (!provider) {
            console.error(`[Integrations] Provider not found: ${providerId}`);
            return;
        }

        console.log(`[Integrations] Handling callback for ${providerId}...`);
        if (!provider.handleCallback) {
            console.error(`[Integrations] Provider does not support auth callbacks: ${providerId}`);
            return;
        }

        try {
            const session = await provider.handleCallback(params);
            console.log(`[Integrations] Session acquired for ${providerId}:`, session.user?.login);
            const current = { ...sessions.value };
            current[providerId] = session;
            sessions.value = current;
            saveSessions();
        } catch (e) {
            console.error(`[Integrations] Auth callback failed for ${providerId}:`, e);
        }
    }

    function saveSessions() {
        console.log('[Integrations] Saving sessions to store...');
        setItem('gitbox_integrations', JSON.stringify(sessions.value));
    }

    function getSession(providerId: string) {
        return sessions.value[providerId];
    }

    async function getValidSession(providerId: string): Promise<IntegrationSession | undefined> {
        let session = sessions.value[providerId];
        if (!session) return undefined;

        // Verifica se expirou ou está perto de expirar (ex: 5 minutos)
        if (session.expiresAt && Date.now() > session.expiresAt - 5 * 60 * 1000) {
            const provider = providers.find(p => p.id === providerId);
            if (provider && provider.refreshToken && session.refreshToken) {
                try {
                    console.log(`[Integrations] Refreshing session for ${providerId}...`);
                    const newSessionData = await provider.refreshToken(session.refreshToken);

                    // Atualiza a sessão mantendo dados do usuário que não vêm no refresh
                    session = {
                        ...session,
                        accessToken: newSessionData.accessToken,
                        refreshToken: newSessionData.refreshToken || session.refreshToken,
                        expiresAt: newSessionData.expiresAt
                    };

                    const current = { ...sessions.value };
                    current[providerId] = session;
                    sessions.value = current;
                    saveSessions();
                } catch (e) {
                    console.error(`[Integrations] Failed to refresh token for ${providerId}:`, e);
                    // Se falhou por token revogado, desconecta
                    disconnect(providerId);
                    return undefined;
                }
            }
        }
        return session;
    }

    return {
        list,
        connect,
        disconnect,
        handleAuthCallback,
        getSession,
        getValidSession
    };
}
