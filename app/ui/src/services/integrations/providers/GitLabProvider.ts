import { BaseIntegrationProvider } from '../core/BaseProvider';
import { IPRProvider } from '../../pullRequests/providers/IPRProvider';
import { GitLabPRProvider } from '../../pullRequests/providers/GitLabPRProvider';
import { generateCodeVerifier, generateCodeChallenge } from '../../../utils/pkce';
import { IntegrationSession } from '../core/types';

export class GitLabProvider extends BaseIntegrationProvider {
    readonly id = 'gitlab';
    readonly name = 'GitLab';
    readonly icon = 'mdi:gitlab';
    readonly color = '#e24329';

    matchUrl(url: string): string | null {
        if (!url || (!url.includes('gitlab.com:') && !url.includes('gitlab.com/'))) return null;
        let repoId = '';

        if (url.includes('gitlab.com:')) repoId = url.split('gitlab.com:')[1].replace('.git', '');
        else {
            const parts = url.split('gitlab.com/')[1].split('/');
            repoId = `${parts[0]}/${parts[1].replace('.git', '')}`;
        }

        return repoId;
    }

    getPRProvider(getAccessToken: (force?: boolean) => Promise<string | undefined>): IPRProvider {
        return new GitLabPRProvider(getAccessToken);
    }

    async getAuthUrl(): Promise<string> {
        const clientId = import.meta.env.VITE_GITLAB_CLIENT_ID;
        const verifier = await generateCodeVerifier();
        const challenge = await generateCodeChallenge(verifier);

        localStorage.setItem(`gitbox_pkce_${this.id}`, verifier);

        return `https://gitlab.com/oauth/authorize?client_id=${clientId}&redirect_uri=gitbox://auth/gitlab&response_type=code&scope=api read_user&code_challenge=${challenge}&code_challenge_method=S256`;
    }

    async handleCallback(params: URLSearchParams): Promise<IntegrationSession> {
        const code = params.get('code');
        const verifier = localStorage.getItem(`gitbox_pkce_${this.id}`);
        localStorage.removeItem(`gitbox_pkce_${this.id}`);

        if (!code) throw new Error(`Authentication failed: No code received for ${this.name}`);
        if (!verifier) throw new Error(`Authentication failed: PKCE verifier missing for ${this.name}`);

        const clientId = import.meta.env.VITE_GITLAB_CLIENT_ID;
        const body = new URLSearchParams();
        body.append('client_id', clientId);
        body.append('code', code);
        body.append('grant_type', 'authorization_code');
        body.append('redirect_uri', 'gitbox://auth/gitlab');
        body.append('code_verifier', verifier);

        const res = await fetch('https://gitlab.com/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString()
        });

        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Failed to exchange token: ${err}`);
        }

        const data = await res.json();

        const userRes = await fetch('https://gitlab.com/api/v4/user', {
            headers: { 'Authorization': `Bearer ${data.access_token}` }
        });

        let user;
        if (userRes.ok) {
            const userData = await userRes.json();
            user = {
                login: userData.username,
                avatar_url: userData.avatar_url,
                name: userData.name,
                email: userData.email
            };
        }

        return {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresAt: data.expires_in ? Date.now() + (data.expires_in * 1000) : undefined,
            user
        };
    }

    async refreshToken(token: string): Promise<IntegrationSession> {
        const clientId = import.meta.env.VITE_GITLAB_CLIENT_ID;
        const body = new URLSearchParams();
        body.append('client_id', clientId);
        body.append('refresh_token', token);
        body.append('grant_type', 'refresh_token');

        const res = await fetch('https://gitlab.com/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString()
        });

        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Failed to refresh token: ${err}`);
        }

        const data = await res.json();
        return {
            accessToken: data.access_token,
            refreshToken: data.refresh_token || token,
            expiresAt: data.expires_in ? Date.now() + (data.expires_in * 1000) : undefined
        };
    }
}
