import { describe, it, expect, vi, beforeEach } from 'vitest'
import { loadRepoData, repoPath, status } from '../gitService'

describe('gitService', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        repoPath.value = '/test/repo'
    })

    it('should load repository data successfully', async () => {
        const mockStatus = [{ path: 'file.ts', status: 'modified' }]

        // Mocking window.gitbox response
        const gitbox = (window as any).gitbox
        gitbox.status.mockResolvedValue(mockStatus)
        gitbox.branches.mockResolvedValue([])
        gitbox.remotes.mockResolvedValue([])
        gitbox.tags.mockResolvedValue([])
        gitbox.stashes.mockResolvedValue([])
        gitbox.getSubmodules.mockResolvedValue([])
        gitbox.getConfig.mockResolvedValue({ userName: 'Test', userEmail: 'test@example.com' })
        gitbox.log.mockResolvedValue([])

        await loadRepoData(true)

        expect(status.value).toEqual(mockStatus)
        expect(gitbox.status).toHaveBeenCalledWith('/test/repo')
    })

    it('should handle repository not found error', async () => {
        const gitbox = (window as any).gitbox
        gitbox.status.mockRejectedValue(new Error('failed to resolve path'))

        await loadRepoData(true)

        // Error handling logic in gitService might update some state
        // Here we just check if it caught the error (service has internal try/catch)
        // We could assert on `error` ref if it was exported/reactive
    })
})
