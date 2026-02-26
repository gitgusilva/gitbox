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
- Node.js 18+
- npm
- C++ compiler (gcc/clang or MSVC)
- libgit2 development headers (for Linux source builds)

### Architecture
- `app/ui`: Vue 3 frontend.
- `ui/electron`: Main process and IPC.
- `core/addon`: C++ binding for libgit2.

Follow the instructions in README.md to build and run the project locally.

## Coding Standards
- Use TypeScript for all new frontend and service logic.
- Follow existing project patterns for IPC and state management.
- Ensure no emojis are used in documentation or commits.

## License
By contributing, you agree that your contributions will be licensed under the MIT License.
