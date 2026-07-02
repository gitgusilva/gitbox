import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
    workspaces,
    activeWorkspaceId,
    addWorkspace,
    removeWorkspace,
    openRepository,
    recentRepositories
} from '../workspaceService'

// Mock storageService
vi.mock('../storageService', () => ({
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
}))

describe('workspaceService', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        workspaces.value = []
        activeWorkspaceId.value = null
        recentRepositories.value = []
    })

    it('should add a workspace and set it as active', () => {
        const ws = addWorkspace('Test Repo', '/path/to/repo', '#ff0000')

        expect(workspaces.value).toHaveLength(1)
        expect(workspaces.value[0]).toEqual(ws)
        expect(activeWorkspaceId.value).toBe(ws.id)
    })

    it('should remove a workspace and update active workspace if necessary', () => {
        const ws1 = addWorkspace('Repo 1', '/path/1', '#00ff00')
        const ws2 = addWorkspace('Repo 2', '/path/2', '#0000ff')

        expect(activeWorkspaceId.value).toBe(ws2.id)

        removeWorkspace(ws2.id)

        expect(workspaces.value).toHaveLength(1)
        expect(workspaces.value[0].id).toBe(ws1.id)
        expect(activeWorkspaceId.value).toBe(ws1.id)
    })

    it('should open a repository and update recent repositories', () => {
        openRepository('/test/path', 'Test Repo')

        expect(workspaces.value).toHaveLength(1)
        expect(workspaces.value[0].path).toBe('/test/path')
        expect(recentRepositories.value).toHaveLength(1)
        expect(recentRepositories.value[0].path).toBe('/test/path')
    })

    it('should update existing empty tab when opening a repository', () => {
        const emptyWs = addWorkspace('', '', 'transparent')
        activeWorkspaceId.value = emptyWs.id

        openRepository('/new/path', 'New Repo')

        expect(workspaces.value).toHaveLength(1)
        expect(workspaces.value[0].id).toBe(emptyWs.id)
        expect(workspaces.value[0].path).toBe('/new/path')
    })
})
