# Changelog
All notable changes to this project will be documented in this file.

## v1.1.0
### Added
- Projects: group repositories into colour-coded projects, each with its own set of tabs
- Project switcher in the toolbar, with search once the list grows past 8 projects
- Keyboard shortcuts for projects: Ctrl+Shift+P (menu), Alt+PageUp/PageDown (cycle), Alt+1..9 (jump)
- Command Log: expanded entries now say when a command produced no output

### Improved
- Keyboard shortcuts sheet: grouped by category, two columns, searchable and fully translated
- Project and repository colours share the same palette; new repos inherit their project's colour
- Modals, menus and the new UI follow the active theme's design tokens

### Fixed
- Command Log list did not render at all, and never scrolled with large entries
- Command Log showed every git command twice (two listeners on the same IPC event)
- Command Log reopened on the "Error" tab instead of the last one used
- Branches included in the history filter were dimmed in the graph as if unfiltered
- The "hide icon labels" setting had no effect on toolbar actions

## v0.1.0
### Added
- Initial release of GitBox
- Integrated AI powered commit message generation
- Advanced diff viewer with side-by-side and inline modes
- High-performance history view with virtual scrolling
- Integrated terminal for advanced Git operations
- Beautiful dark mode UI with glassmorphism effects
- Support for multiple repositories and branch management

### Improved
- Optimized repository loading speed
- Refined UI layout for better accessibility
- Improved search functionality in commit history
