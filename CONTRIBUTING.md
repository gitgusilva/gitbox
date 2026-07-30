# Contributing to GitBox

Thank you for your interest in contributing to GitBox! This project is built with Vue 3, Electron, and a custom C++ addon with libgit2.

## How to Contribute

### Reporting Bugs
- Search existing issues before opening a new one.
- Provide a clear and descriptive title.
- List steps to reproduce the issue.
- Include information about your environment (OS, Node.js version).

### Suggesting Enhancements
- Open an issue to discuss the enhancement before implementation.
- Explain why the enhancement would be useful.

### Pull Requests
1. Fork the repository.
2. Create a new branch for your feature or bug fix (`git checkout -b feature/amazing-feature`).
3. Commit your changes with clear, descriptive messages.
4. Push your branch to your fork (`git push origin feature/amazing-feature`).
5. Open a Pull Request against the `main` branch.

## Development Setup

### Build Requirements
- Node.js 20+
- npm
- C++ compiler (gcc/clang or MSVC), CMake, Ninja and Perl
- libgit2 is not a system dependency: it is built statically from `core/addon/vendor`

### Architecture
- `app/ui`: Vue 3 frontend.
- `ui/electron`: Main process and IPC.
- `core/addon`: C++ binding for libgit2.

Follow the instructions in README.md to build and run the project locally.

## Coding Standards
- Use TypeScript for all new frontend and service logic.
- Follow existing project patterns for IPC and state management.
- Ensure no emojis are used in documentation or commits.

## Code of Conduct
This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). By participating, you are expected to uphold it.

## Security
Do not report vulnerabilities in a public issue. [SECURITY.md](SECURITY.md) explains the private channel and what to include.

## License
By contributing, you agree that your contributions will be licensed under the GNU Lesser General Public License, version 3 or later ([LICENSE](LICENSE)). The project moved from MIT to LGPL-3.0-or-later after v1.2.0; contributions merged before that were made under MIT and keep their original notices.
