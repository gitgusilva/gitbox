export type Theme = 'dark' | 'light' | 'system';

export interface AppSettings {
    theme: Theme;
    locale: string;
    git: {
        userName: string;
        userEmail: string;
        defaultBranch: string;
    };
    ai?: {
        provider: 'gemini';
        apiKey: string;
    };
    integrations?: {
        github?: { accessToken: string; user?: any };
        gitlab?: { accessToken: string; user?: any };
        bitbucket?: { accessToken: string; user?: any };
    };
}

export interface ModalState<T> {
    isOpen: boolean;
    props: T | null;
}
