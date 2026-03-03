import { IIntegrationProvider, IntegrationSession } from './types';

export abstract class BaseIntegrationProvider implements IIntegrationProvider {
    abstract readonly id: string;
    abstract readonly name: string;
    abstract readonly icon: string;
    abstract readonly color: string;

    getAuthUrl?(): Promise<string>;

    async handleCallback(params: URLSearchParams): Promise<IntegrationSession> {
        // Default implementation for deep link exchange
        const token = params.get('token');
        const userStr = params.get('user');

        if (!token) {
            throw new Error(`Authentication failed: No token received for ${this.name}`);
        }

        let user;
        try {
            if (userStr) user = JSON.parse(decodeURIComponent(userStr));
        } catch (e) {
            console.warn(`Failed to parse user data for ${this.name}`, e);
        }

        return {
            accessToken: token,
            user
        };
    }
}
