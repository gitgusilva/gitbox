import { describe, it, expect, vi, beforeEach } from 'vitest'
import { loadRepoData, repoPath, status, reportError, error } from '../gitService'

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

describe('a machine without git', () => {
    // The main process marks the failure it gets when the binary is absent,
    // because only an Error's message survives the IPC boundary.
    const enoent = () => new Error(
        "Error invoking remote method 'gitbox:stageFile': Error: Git was not found on PATH. " +
        'GitBox runs the git command line for staging, diffs, stashes, tags and submodules. ' +
        'Install it with your package manager and reopen GitBox. [gitbox-git-missing]'
    )

    beforeEach(() => { error.value = '' })

    it('answers with the actionable message rather than spawn git ENOENT', () => {
        reportError('Stage file', enoent())

        // The i18n mock echoes keys, so these prove the translated path was taken.
        expect(error.value).toContain('common.git_missing')
        expect(error.value).toContain('common.git_missing_unix')
    })

    it('never lets the marker reach the banner', () => {
        reportError('Stage file', enoent())

        expect(error.value).not.toContain('gitbox-git-missing')
        expect(error.value).not.toContain('ENOENT')
    })

    it('leaves a git that ran and failed exactly as it was', () => {
        reportError('Stage file', new Error("Error invoking remote method 'x': Error: Command failed: git status"))

        expect(error.value).toBe('Command failed: git status')
    })
})
