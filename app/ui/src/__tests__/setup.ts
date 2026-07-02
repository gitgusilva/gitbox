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

// Mock i18n
vi.mock('vue-i18n', () => ({
    useI18n: () => ({
        t: (key: string) => key,
    }),
}))
