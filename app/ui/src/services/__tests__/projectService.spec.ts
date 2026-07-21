import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import {
    projects,
    activeProjectId,
    activeProjectColor,
    ensureProject,
    createProject,
    removeProject,
    saveTabsToProject,
    DEFAULT_PROJECT_COLOR
} from '../projectService'
import {
    workspaces,
    activeWorkspaceId,
    switchProject,
    createAndSwitchProject,
    deleteProject,
    openRepository
} from '../workspaceService'

vi.mock('../storageService', () => ({
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
}))

const tab = (id: string, path: string) => ({ id, name: id, path, color: '#fff' })

function reset() {
    projects.value = []
    activeProjectId.value = null
    workspaces.value = []
    activeWorkspaceId.value = null
}

describe('projectService', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        reset()
    })

    it('creates a single nameless project on bootstrap, adopting existing tabs', () => {
        const adopted = [tab('a', '/repo/a')]
        const p = ensureProject(adopted, 'a')

        expect(projects.value).toHaveLength(1)
        expect(p.name).toBe('')
        expect(p.color).toBe(DEFAULT_PROJECT_COLOR)
        expect(p.tabs).toEqual(adopted)
        expect(activeProjectId.value).toBe(p.id)

        // Idempotent: a second call must not create another project.
        ensureProject([tab('b', '/repo/b')])
        expect(projects.value).toHaveLength(1)
    })

    it('never deletes the last project', () => {
        const p = ensureProject()
        expect(removeProject(p.id)).toBeNull()
        expect(projects.value).toHaveLength(1)
    })

    it('returns the neighbour to activate when the active project is deleted', () => {
        const first = ensureProject()
        const second = createProject('Second', '#123456')
        activeProjectId.value = second.id

        expect(removeProject(second.id)).toBe(first.id)
        expect(projects.value).toHaveLength(1)
    })

    it('drops empty placeholder tabs when saving and repairs a dangling active tab', () => {
        const p = ensureProject()
        saveTabsToProject(p.id, [tab('a', '/repo/a'), tab('blank', '')], 'blank')

        expect(p.tabs.map(t => t.id)).toEqual(['a'])
        expect(p.activeTabId).toBe('a')
    })
})

describe('project ↔ tab integration', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        reset()
    })

    it('swaps the tab bar when switching projects and restores it on the way back', () => {
        const first = ensureProject([tab('a', '/repo/a'), tab('b', '/repo/b')], 'b')
        workspaces.value = [...first.tabs]
        activeWorkspaceId.value = 'b'

        const second = createAndSwitchProject('Second', '#123456')
        expect(activeProjectId.value).toBe(second.id)
        expect(workspaces.value).toEqual([])
        expect(activeWorkspaceId.value).toBeNull()

        switchProject(first.id)
        expect(workspaces.value.map(t => t.id)).toEqual(['a', 'b'])
        expect(activeWorkspaceId.value).toBe('b')
    })

    it('files a newly opened repo under the active project, in its colour', async () => {
        ensureProject()
        const p = createAndSwitchProject('Work', '#D81B60')

        openRepository('/repo/new', 'new')

        expect(activeProjectColor.value).toBe('#D81B60')
        expect(workspaces.value[0].color).toBe('#D81B60')

        // The tabs→project mirror is a watcher, so it lands on the next tick.
        await nextTick()
        expect(p.tabs.map(t => t.path)).toEqual(['/repo/new'])
    })

    it('moves to a sibling project when the active one is deleted', () => {
        const first = ensureProject([tab('a', '/repo/a')], 'a')
        workspaces.value = [...first.tabs]
        const second = createAndSwitchProject('Second', '#123456')

        deleteProject(second.id)

        expect(activeProjectId.value).toBe(first.id)
        expect(workspaces.value.map(t => t.id)).toEqual(['a'])
    })
})
