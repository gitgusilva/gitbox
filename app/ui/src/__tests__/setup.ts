import { vi } from 'vitest'

// Mock Electron window.gitbox
global.window.gitbox = {
    status: vi.fn(),
    branches: vi.fn(),
    remotes: vi.fn(),
    tags: vi.fn(),
    stashes: vi.fn(),
    getSubmodules: vi.fn(),
    getConfig: vi.fn(),
    log: vi.fn(),
} as any

// Mock i18n. `createI18n` has to be part of the mock: services that import the
// app's i18n instance (gitService, workspaceService) pull it in transitively, and
// a mock without it made those modules throw on import instead of running.
vi.mock('vue-i18n', () => ({
    useI18n: () => ({
        t: (key: string) => key,
    }),
    createI18n: () => ({
        global: {
            t: (key: string) => key,
            locale: { value: 'en' },
        },
        install: () => {},
    }),
}))
