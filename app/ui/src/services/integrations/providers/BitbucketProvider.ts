import { BaseIntegrationProvider } from '../core/BaseProvider';
import { generateCodeVerifier, generateCodeChallenge } from '../../../utils/pkce';
import { IntegrationSession } from '../core/types';

export class BitbucketProvider extends BaseIntegrationProvider {
    readonly id = 'bitbucket';
    readonly name = 'Bitbucket';
    readonly icon = 'mdi:bitbucket';
    readonly color = '#0052cc';

    async getAuthUrl(): Promise<string> {
        const clientId = import.meta.env.VITE_BITBUCKET_CLIENT_ID;
        const verifier = await generateCodeVerifier();
        const challenge = await generateCodeChallenge(verifier);

        localStorage.setItem(`gitbox_pkce_${this.id}`, verifier);

        return `https://bitbucket.org/site/oauth2/authorize?client_id=${clientId}&redirect_uri=gitbox://auth/bitbucket&response_type=code&code_challenge=${challenge}&code_challenge_method=S256`;
    }

    async handleCallback(params: URLSearchParams): Promise<IntegrationSession> {
        const code = params.get('code');
        const verifier = localStorage.getItem(`gitbox_pkce_${this.id}`);
        localStorage.removeItem(`gitbox_pkce_${this.id}`);

        if (!code) throw new Error(`Authentication failed: No code received for ${this.name}`);
        if (!verifier) throw new Error(`Authentication failed: PKCE verifier missing for ${this.name}`);

        const clientId = import.meta.env.VITE_BITBUCKET_CLIENT_ID;

        const body = new URLSearchParams();
        body.append('client_id', clientId);
        body.append('code', code);
        body.append('grant_type', 'authorization_code');
        body.append('redirect_uri', 'gitbox://auth/bitbucket');
        body.append('code_verifier', verifier);

        const res = await fetch('https://bitbucket.org/site/oauth2/access_token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString()
        });

        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Failed to exchange token: ${err}`);
        }

        const data = await res.json();

        const userRes = await fetch('https://api.bitbucket.org/2.0/user', {
            headers: { 'Authorization': `Bearer ${data.access_token}` }
        });

        let user;
        if (userRes.ok) {
            const userData = await userRes.json();
            user = {
                login: userData.username,
                avatar_url: userData.links?.avatar?.href,
                name: userData.display_name
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
        const clientId = import.meta.env.VITE_BITBUCKET_CLIENT_ID;

        const body = new URLSearchParams();
        body.append('client_id', clientId);
        body.append('refresh_token', token);
        body.append('grant_type', 'refresh_token');

        const res = await fetch('https://bitbucket.org/site/oauth2/access_token', {
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
