# vscode-git-ignore

<a href="https://marketplace.visualstudio.com/items?itemName=elonehoo.vscode-git-ignore" target="__blank"><img src="https://img.shields.io/visual-studio-marketplace/v/elonehoo.vscode-git-ignore.svg?color=eee&amp;label=VS%20Code%20Marketplace&logo=visual-studio-code" alt="Visual Studio Marketplace Version" /></a>
<a href="https://kermanx.github.io/reactive-vscode/" target="__blank"><img src="https://img.shields.io/badge/made_with-reactive--vscode-%23007ACC?style=flat&labelColor=%23229863"  alt="Made with reactive-vscode" /></a>

A powerful VSCode extension that helps you manage git ignored files with an intuitive drag-and-drop interface. Perfect for managing configuration files like `.env` that you need to modify locally but don't want to commit.

## ✨ Features

- **🎯 Smart File Ignoring**: Automatically handles both tracked and untracked files
  - Uses `git update-index --skip-worktree` for tracked files
  - Uses `.git/info/exclude` for untracked files
- **🖱️ Drag & Drop Interface**: Simply drag files into the ignore panel
- **📝 Multiple Add Methods**: 
  - Drag and drop files from explorer
  - Right-click individual files
  - Batch add all changed files at once
- **🔧 Visual Management**: Dedicated panel in SCM view with custom icons
- **⚡ Real-time Updates**: Changes reflect immediately in Git status
- **🧹 Easy Cleanup**: Remove files from ignore list or clear all at once

## 🚀 Use Cases

Perfect for scenarios where you need to:
- Modify `.env` files with local development settings without committing them
- Work with configuration files that contain internal network addresses
- Temporarily ignore files while working on features
- Manage multiple configuration files across different environments

## 📖 How to Use

### Method 1: Drag and Drop
1. Open the **Source Control** panel in VSCode
2. Find the **Git Ignore Helper** section
3. Drag files from the Explorer or Git changes list into the panel

### Method 2: Right-click Menu
- **Single File**: Right-click on any file → "Add to Ignore List"
- **All Changes**: Right-click on the "Changes" group → "Add All Changes to Ignore List"

### Method 3: Inline Buttons
Click the ignore button next to files in the Git changes list

### Managing Ignored Files
- **View**: All ignored files appear in the Git Ignore Helper panel
- **Remove**: Right-click on files in the panel to remove them
- **Clear All**: Click the trash icon to clear the entire ignore list
- **Open Files**: Click on files in the panel to open them

## 🛠️ Installation

### From VSCode Marketplace
1. Open VSCode
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "Git Ignore Helper"
4. Click Install

### From VSIX File
```bash
# Build the extension
pnpm install
pnpm build
pnpm pack

# Install in VSCode
code --install-extension vscode-git-ignore-*.vsix
```

## ⚙️ Configuration

| Setting | Description | Type | Default |
|---------|-------------|------|---------|
| `gitIgnoreHelper.autoSave` | Automatically save ignore list changes | `boolean` | `true` |

## 📋 Commands

| Command | Title | Description |
|---------|--------|-------------|
| `gitIgnoreHelper.addToIgnoreList` | Add to Ignore List | Add a single file to the ignore list |
| `gitIgnoreHelper.addAllToIgnoreList` | Add All Changes to Ignore List | Add all changed files to the ignore list |
| `gitIgnoreHelper.removeFromIgnoreList` | Remove from Ignore List | Remove a file from the ignore list |
| `gitIgnoreHelper.clearIgnoreList` | Clear Ignore List | Remove all files from the ignore list |

## 🎯 How It Works

### For Tracked Files (e.g., existing `.env` files):
- Uses `git update-index --skip-worktree <file>` to tell Git to ignore local changes
- Files remain in the repository but local modifications won't appear in git status
- Perfect for configuration files that exist in the repo but need local customization

### For Untracked Files:
- Adds files to `.git/info/exclude` (local gitignore that's not committed)
- Files won't appear in git status and won't be accidentally committed
- Only affects your local repository

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

[MIT](./LICENSE.md) License © 2024 [Elone Hoo](https://github.com/elonehoo)
