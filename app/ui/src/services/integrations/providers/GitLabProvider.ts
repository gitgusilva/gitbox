import { BaseIntegrationProvider } from '../core/BaseProvider';

export class GitLabProvider extends BaseIntegrationProvider {
    readonly id = 'gitlab';
    readonly name = 'GitLab';
    readonly icon = 'mdi:gitlab';
    readonly color = '#e24329';

    async getAuthUrl(): Promise<string> {
        const clientId = import.meta.env.VITE_GITLAB_CLIENT_ID;
        return `https://gitlab.com/oauth/authorize?client_id=${clientId}&redirect_uri=gitbox://auth/gitlab&response_type=code&scope=api`;
    }
}
