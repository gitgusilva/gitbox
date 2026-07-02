import { BaseIntegrationProvider } from '../core/BaseProvider';
import { IntegrationSession } from '../core/types';
import { deviceFlowModal } from '../../modalService';
import { IPRProvider } from '../../pullRequests/providers/IPRProvider';
import { GitHubPRProvider } from '../../pullRequests/providers/GitHubPRProvider';
import { showToast } from '../../toastService';
import i18n from '../../../i18n';

export class GitHubProvider extends BaseIntegrationProvider {
    readonly id = 'github';
    readonly name = 'GitHub';
    readonly icon = 'mdi:github';
    readonly color = '#24292e';

    private readonly clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;

    matchUrl(url: string): string | null {
        if (!url || (!url.includes('github.com:') && !url.includes('github.com/'))) return null;
        let repoId = '';
        if (url.includes('github.com:')) repoId = url.split('github.com:')[1].replace('.git', '');
        else {
            const parts = url.split('github.com/')[1].split('/');
            repoId = `${parts[0]}/${parts[1].replace('.git', '')}`;
        }
        return repoId;
    }

    getPRProvider(getAccessToken: (force?: boolean) => Promise<string | undefined>): IPRProvider {
        return new GitHubPRProvider(getAccessToken);
    }

    async connectAction(onSuccess: (session: IntegrationSession) => void): Promise<void> {
        // 1. Request device code
        const deviceResponse = await fetch('https://github.com/login/device/code', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                client_id: this.clientId,
                scope: 'repo,user'
            })
        });

        if (!deviceResponse.ok) {
            throw new Error('Failed to initiate device flow');
        }

        const deviceData = await deviceResponse.json();
        const { device_code, user_code, verification_uri, interval } = deviceData;

        // 2. Notify User and Open Browser
        try {
            await navigator.clipboard.writeText(user_code);
        } catch (e) {
            console.warn('Failed to auto-copy to clipboard', e);
        }

        let cancelled = false;
        deviceFlowModal.value = {
            userCode: user_code,
            verificationUri: verification_uri,
            onCancel: () => {
                cancelled = true;
                deviceFlowModal.value = null;
            }
        };

        // 3. Poll for the token
        let polling = true;

        // GitHub usually suggests 5s. We use a base of 5s, clamped to avoid excessively large intervals
        // while still respecting the server's recommendation if it's within [5, 10] range.
        const baseInterval = Math.max(5, Math.min(10, interval || 5));
        let currentInterval = baseInterval * 1000;

        const poll = async () => {
            if (cancelled) return;
            if (!polling) return;

            const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    client_id: this.clientId,
                    device_code: device_code,
                    grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
                })
            });

            const tokenData = await tokenResponse.json();

            if (tokenData.error) {
                if (tokenData.error === 'authorization_pending') {
                    // Continue polling
                    setTimeout(poll, currentInterval);
                } else if (tokenData.error === 'slow_down') {
                    // GitHub asked to slow down
                    currentInterval += 5000;
                    setTimeout(poll, currentInterval);
                } else if (tokenData.error === 'expired_token') {
                    polling = false;
                    deviceFlowModal.value = null;
                    const { t } = i18n.global;
                    showToast(t('common.error'), t('github_auth.expired'), 'error');
                } else {
                    polling = false;
                    deviceFlowModal.value = null;
                    console.error('[GitHub Auth] Polling error:', tokenData.error_description || tokenData.error);
                }
                return;
            }

            // Success!
            polling = false;
            deviceFlowModal.value = null;

            const accessToken = tokenData.access_token;
            const refreshToken = tokenData.refresh_token;
            const expiresIn = tokenData.expires_in;
            const expiresAt = expiresIn ? Date.now() + (expiresIn * 1000) : undefined;

            // Fetch user
            const userResponse = await fetch('https://api.github.com/user', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'application/json'
                }
            });

            let user;
            if (userResponse.ok) {
                user = await userResponse.json();
            }

            onSuccess({
                accessToken,
                refreshToken,
                expiresAt,
                user: user ? {
                    login: user.login,
                    avatar_url: user.avatar_url,
                    name: user.name,
                    email: user.email
                } : undefined
            });
        };

        // Start polling
        setTimeout(poll, currentInterval);
    }

    async refreshToken(token: string): Promise<IntegrationSession> {
        const response = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                client_id: this.clientId,
                grant_type: 'refresh_token',
                refresh_token: token
            })
        });

        if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`Failed to refresh token: ${errorData}`);
        }

        const data = await response.json();
        if (data.error) {
            throw new Error(`GitHub token refresh error: ${data.error_description || data.error}`);
        }

        const accessToken = data.access_token;
        const newRefreshToken = data.refresh_token;
        const expiresIn = data.expires_in;
        const expiresAt = expiresIn ? Date.now() + (expiresIn * 1000) : undefined;

        return {
            accessToken,
            refreshToken: newRefreshToken || token,
            expiresAt
        };
    }
}
