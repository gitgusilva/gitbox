# GitBox

![GitBox](https://raw.githubusercontent.com/gitgusilva/gitbox/main/logo.png) (Coming soon)

[![stars](https://img.shields.io/github/stars/gitgusilva/gitbox.svg)](https://github.com/gitgusilva/gitbox/stargazers)
[![forks](https://img.shields.io/github/forks/gitgusilva/gitbox.svg)](https://github.com/gitgusilva/gitbox/forks)
[![license](https://img.shields.io/github/license/gitgusilva/gitbox.svg)](LICENSE)
[![latest](https://img.shields.io/github/v/release/gitgusilva/gitbox.svg)](https://github.com/gitgusilva/gitbox/releases/latest)
[![downloads](https://img.shields.io/github/downloads/gitgusilva/gitbox/total)](https://github.com/gitgusilva/gitbox/releases)

GitBox is a lightweight, high-performance GUI client for Git, built with **Vue 3**, **Electron**, and a custom **C++ Addon** powered by **libgit2**. It focuses on speed, memory efficiency, and a premium developer experience.

## Features

- **High Performance**: Native Git operations via a specialized C++ addon and libgit2.
- **Premium UI**: Modern, glassmorphic design with full Dark Mode support and smooth micro-animations.
- **Visual History**: Integrated commit graph with a virtualized list for handling thousands of commits instantaneously.
- **Keyboard Centric**: Native global shortcuts for almost every action (Terminal, Settings, Search, navigation).
- **Integrated Terminal**: Fully-featured terminal sessions (xterm.js + node-pty) integrated directly into your workspace.
- **Tabbed Workspace**: Manage multiple repositories simultaneously with a native-feel tab interface.
- **Monaco Editor**: High-fidelity diff viewing and code inspection powered by the Monaco Editor.
- **Localization**: Multi-language support (English, Brazilian Portuguese, Spanish).
- **Optimized Refresh**: Smart background polling that hibernates when the app is in the background to save CPU and RAM.

## Installation

GitBox is currently in active development. Pre-built binaries for Windows and Linux will be available in the [Releases](https://github.com/gitgusilva/gitbox/releases) section soon.

### Requirements
- **Self-contained**: GitBox uses `libgit2` internally and does not require a local Git installation.
- **Linux**: Build tools (gcc/clang) and `libgit2` development headers are only required when building from source.

For a full list of legal notices and third-party software used in this project, please see [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).

## Building from Source

If you want to contribute or build GitBox yourself, follow these steps:

### 1. Prerequisites
Ensure you have **Node.js** (v18+), **npm**, and a **C++ compiler** (gcc/clang or MSVC) installed.

### 2. Build the C++ Addon
```bash
cd core/addon
npm install
npm run build
```

### 3. Run the Application
```bash
cd ui/electron
npm install
npm run dev
```

## Shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl + J` | Toggle Integrated Terminal |
| `Ctrl + /` | Open Keyboard Shortcuts Map |
| `Ctrl + ,` | Open Application Settings |
| `Ctrl + F` | Search (UI context dependent) |
| `Arrow Up/Down` | Navigate Commits/Files |

## Third-party Components

GitBox is made possible by several incredible open-source projects. For a full list of dependencies and their respective licenses, please refer to [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).

## Contributing

We welcome contributions from the community! To get started, please read our [CONTRIBUTING.md](CONTRIBUTING.md) guide for details on our workflow, coding standards, and how to submit pull requests.

## Contributors

Thank you to all the people who have contributed to this project!

[![Contributors](https://contrib.rocks/image?repo=gitgusilva/gitbox&columns=20)](https://github.com/gitgusilva/gitbox/graphs/contributors)

## License

GitBox is licensed under the MIT License. See the [LICENSE](LICENSE) file for the full text.
