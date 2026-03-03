import { BaseIntegrationProvider } from '../core/BaseProvider';
import { IntegrationSession } from '../core/types';
import { deviceFlowModal } from '../../modalService';


export class GitHubProvider extends BaseIntegrationProvider {
    readonly id = 'github';
    readonly name = 'GitHub';
    readonly icon = 'mdi:github';
    readonly color = '#24292e';

    private readonly clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
    async connectAction(onSuccess: (session: IntegrationSession) => void): Promise<void> {
        console.log('[GitHub Auth] Initiating Device Flow...');

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
        console.log(`[GitHub Auth] User Code: ${user_code}`);
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
        const pollInterval = (interval || 5) * 1000;

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
                    setTimeout(poll, pollInterval);
                } else if (tokenData.error === 'slow_down') {
                    // GitHub asked to slow down
                    setTimeout(poll, pollInterval + 5000);
                } else if (tokenData.error === 'expired_token') {
                    polling = false;
                    deviceFlowModal.value = null;
                    alert('O tempo para autorizar o GitHub expirou. Tente conectar novamente.');
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
            console.log('[GitHub Auth] Device Flow complete!');
        };

        // Start polling
        setTimeout(poll, pollInterval);
    }

    async refreshToken(token: string): Promise<IntegrationSession> {
        console.log('[GitHub Auth] Refreshing expired token...');

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
