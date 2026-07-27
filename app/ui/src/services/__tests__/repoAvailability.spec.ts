import { describe, it, expect, vi, beforeEach } from 'vitest'
import { loadRepoData, repoPath, branches, log, error } from '../gitService'
import { workspaces, activeWorkspaceId, recentRepositories } from '../workspaceService'

const REPO = '/gone/repo'

function gitbox() {
    return (window as any).gitbox
}

/** Puts one tab on REPO and pretends a previous repo had already been loaded. */
function seedWorkspace() {
    workspaces.value = [{ id: 'ws1', name: 'repo', path: REPO, color: 'blue' }]
    activeWorkspaceId.value = 'ws1'
    recentRepositories.value = [{ name: 'repo', path: REPO, color: 'blue', lastOpened: 1 }]
    branches.value = [{ name: 'main', is_head: true } as any]
    log.value = [{ id: 'abc' } as any]
    repoPath.value = REPO
}

describe('repository availability', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        const g = gitbox()
        for (const key of ['branches', 'remotes', 'tags', 'stashes', 'getSubmodules']) {
            g[key].mockResolvedValue([])
        }
        g.getConfig.mockResolvedValue({ userName: '', userEmail: '' })
        g.log.mockResolvedValue([])
        g.status.mockRejectedValue(new Error(`could not find repository at '${REPO}'`))
        error.value = ''
        seedWorkspace()
    })

    it('closes the tab and clears the data when the path is gone', async () => {
        gitbox().probeRepo.mockResolvedValue({ exists: false, isRepo: false })

        await loadRepoData(true)

        expect(workspaces.value[0].path).toBe('')
        expect(workspaces.value[0].name).toBe('')
        expect(repoPath.value).toBe('')
        expect(branches.value).toEqual([])
        expect(log.value).toEqual([])
        expect(recentRepositories.value).toEqual([])
        expect(error.value).toBe('repo.missing_body')
    })

    it('keeps the tab but clears the data when the folder is not a repository', async () => {
        gitbox().probeRepo.mockResolvedValue({ exists: true, isRepo: false })

        await loadRepoData(true)

        expect(workspaces.value[0].path).toBe(REPO)
        expect(branches.value).toEqual([])
        expect(log.value).toEqual([])
        expect(recentRepositories.value).toHaveLength(1)
        expect(error.value).toBe('repo.not_a_repo_body')
    })

    it('leaves the workspace alone when the repository is still there', async () => {
        gitbox().probeRepo.mockResolvedValue({ exists: true, isRepo: true })

        await loadRepoData(true)

        expect(workspaces.value[0].path).toBe(REPO)
        expect(repoPath.value).toBe(REPO)
        expect(error.value).toContain('could not find repository')
    })
})
