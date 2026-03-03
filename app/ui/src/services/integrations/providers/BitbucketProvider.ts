import { BaseIntegrationProvider } from '../core/BaseProvider';

export class BitbucketProvider extends BaseIntegrationProvider {
    readonly id = 'bitbucket';
    readonly name = 'Bitbucket';
    readonly icon = 'mdi:bitbucket';
    readonly color = '#0052cc';

    async getAuthUrl(): Promise<string> {
        const clientId = import.meta.env.VITE_BITBUCKET_CLIENT_ID;
        return `https://bitbucket.org/site/oauth2/authorize?client_id=${clientId}&redirect_uri=gitbox://auth/bitbucket&response_type=code`;
    }
}
