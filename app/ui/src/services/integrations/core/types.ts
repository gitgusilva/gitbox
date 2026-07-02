export interface IntegrationUser {
    login: string;
    avatar_url?: string;
    name?: string;
    email?: string;
}

export interface IntegrationSession {
    accessToken: string;
    user?: IntegrationUser;
    expiresAt?: number;
    refreshToken?: string;
}

export interface IntegrationInfo {
    id: string;
    name: string;
    icon: string;
    color: string;
    connected: boolean;
    user?: IntegrationUser;
}

import { IPRProvider } from '../../pullRequests/providers/IPRProvider';

export interface IIntegrationProvider {
    readonly id: string;
    readonly name: string;
    readonly icon: string;
    readonly color: string;

    getAuthUrl?(): Promise<string>;
    handleCallback?(params: URLSearchParams): Promise<IntegrationSession>;
    refreshToken?(token: string): Promise<IntegrationSession>;
    connectAction?(onSuccess: (session: IntegrationSession) => void): Promise<void>;

    matchUrl?(url: string): string | null;
    getPRProvider?(getAccessToken: (force?: boolean) => Promise<string | undefined>): IPRProvider;
}
