import { useIntegrations } from '../integrations';

export function initProtocolHandler() {
    if (window.gitbox && window.gitbox.onProtocolUrl) {
        window.gitbox.onProtocolUrl((url: string) => {
            handleProtocolUrl(url);
        });
    }
}

function handleProtocolUrl(url: string) {
    console.log('[Protocol] Handling URL:', url);

    try {
        const parsed = new URL(url);

        // Router for gitbox:// protocols
        if (parsed.host === 'auth') {
            handleAuthProtocol(parsed);
        } else if (parsed.host === 'repo') {
            // Future feature: gitbox://repo/open?path=...
            console.log('[Protocol] Repo action requested:', parsed.pathname);
        }
    } catch (e) {
        // Fallback for simple parsers if URL object fails on custom protocols
        if (url.startsWith('gitbox://auth/')) {
            const parts = url.replace('gitbox://auth/', '').split('?');
            const provider = parts[0];
            const params = new URLSearchParams(parts[1] || '');

            const { handleAuthCallback } = useIntegrations();
            handleAuthCallback(provider, params);
        }
    }
}

function handleAuthProtocol(url: URL) {
    // URL format: gitbox://auth/github?token=...
    const provider = url.pathname.replace('/', '');
    const params = url.searchParams;

    const { handleAuthCallback } = useIntegrations();
    handleAuthCallback(provider, params);
}
