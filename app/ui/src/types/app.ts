export type Theme = 'dark' | 'light' | 'system';

export interface AppSettings {
    theme: Theme;
    locale: string;
    git: {
        userName: string;
        userEmail: string;
        defaultBranch: string;
    };
}

export interface ModalState<T> {
    isOpen: boolean;
    props: T | null;
}
