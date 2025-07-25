import { exec } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { promisify } from 'node:util'
import * as vscode from 'vscode'

const execAsync = promisify(exec)

export class GitIgnoreManager {
  private ignoredFiles: Set<string> = new Set()
  private workspaceRoot: string | undefined
  private gitInfoExcludePath: string | undefined

  constructor() {
    this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
    if (this.workspaceRoot) {
      this.gitInfoExcludePath = path.join(this.workspaceRoot, '.git', 'info', 'exclude')
      this.loadIgnoredFiles()
    }
  }

  private async loadIgnoredFiles() {
    if (!this.gitInfoExcludePath || !fs.existsSync(this.gitInfoExcludePath)) {
      return
    }

    try {
      const content = await fs.promises.readFile(this.gitInfoExcludePath, 'utf-8')
      const lines = content.split('\n')

      // Find our section in the file
      const startMarker = '# Git Ignore Helper - Start'
      const endMarker = '# Git Ignore Helper - End'
      const startIndex = lines.findIndex(line => line.trim() === startMarker)
      const endIndex = lines.findIndex(line => line.trim() === endMarker)

      if (startIndex !== -1 && endIndex !== -1) {
        for (let i = startIndex + 1; i < endIndex; i++) {
          const line = lines[i].trim()
          if (line && !line.startsWith('#')) {
            this.ignoredFiles.add(line)
          }
        }
      }
    }
    catch (error) {
      console.error('Failed to load ignored files:', error)
    }
  }

  private async saveIgnoredFiles() {
    if (!this.gitInfoExcludePath || !this.workspaceRoot) {
      return
    }

    try {
      // Ensure .git/info directory exists
      const infoDir = path.dirname(this.gitInfoExcludePath)
      if (!fs.existsSync(infoDir)) {
        await fs.promises.mkdir(infoDir, { recursive: true })
      }

      let content = ''
      if (fs.existsSync(this.gitInfoExcludePath)) {
        content = await fs.promises.readFile(this.gitInfoExcludePath, 'utf-8')
      }

      const lines = content.split('\n')
      const startMarker = '# Git Ignore Helper - Start'
      const endMarker = '# Git Ignore Helper - End'

      // Remove existing section
      const startIndex = lines.findIndex(line => line.trim() === startMarker)
      const endIndex = lines.findIndex(line => line.trim() === endMarker)

      let newLines: string[]
      if (startIndex !== -1 && endIndex !== -1) {
        newLines = [...lines.slice(0, startIndex), ...lines.slice(endIndex + 1)]
      }
      else {
        newLines = lines
      }

      // Add our section
      if (this.ignoredFiles.size > 0) {
        newLines.push('')
        newLines.push(startMarker)
        for (const file of this.ignoredFiles) {
          newLines.push(file)
        }
        newLines.push(endMarker)
      }

      await fs.promises.writeFile(this.gitInfoExcludePath, newLines.join('\n'))
    }
    catch (error) {
      console.error('Failed to save ignored files:', error)
      vscode.window.showErrorMessage(`Failed to save ignored files: ${error}`)
    }
  }

  private async isFileTrackedByGit(filePath: string): Promise<boolean> {
    if (!this.workspaceRoot) {
      return false
    }

    try {
      const relativePath = path.relative(this.workspaceRoot, filePath)
      const { stdout } = await execAsync(`git ls-files "${relativePath}"`, {
        cwd: this.workspaceRoot,
      })
      return stdout.trim().length > 0
    }
    catch {
      // Error is expected if file is not tracked
      return false
    }
  }

  private async skipWorktreeFile(filePath: string): Promise<void> {
    if (!this.workspaceRoot) {
      return
    }

    try {
      const relativePath = path.relative(this.workspaceRoot, filePath)
      await execAsync(`git update-index --skip-worktree "${relativePath}"`, {
        cwd: this.workspaceRoot,
      })
    }
    catch (error) {
      console.error('Error applying skip-worktree:', error)
      throw error
    }
  }

  private async removeFromIndex(filePath: string): Promise<void> {
    if (!this.workspaceRoot) {
      return
    }

    try {
      const relativePath = path.relative(this.workspaceRoot, filePath)
      await execAsync(`git reset HEAD "${relativePath}"`, {
        cwd: this.workspaceRoot,
      })
    }
    catch (error) {
      // Ignore error if file is not in index
      vscode.window.showErrorMessage(`Failed to reset file from index: ${error}`)
    }
  }

  private async unskipWorktreeFile(filePath: string): Promise<void> {
    if (!this.workspaceRoot) {
      return
    }

    try {
      const relativePath = path.relative(this.workspaceRoot, filePath)
      await execAsync(`git update-index --no-skip-worktree "${relativePath}"`, {
        cwd: this.workspaceRoot,
      })
    }
    catch (error) {
      console.error('Error removing skip-worktree:', error)
      throw error
    }
  }

  private async getAllChangedFiles(): Promise<string[]> {
    if (!this.workspaceRoot) {
      return []
    }

    try {
      const { stdout } = await execAsync('git status --porcelain', {
        cwd: this.workspaceRoot,
      })

      const changedFiles: string[] = []
      const lines = stdout.split('\n').filter(line => line.trim())

      for (const line of lines) {
        // Git status format: XY filename
        // X = staged, Y = unstaged
        if (line.length > 3) {
          const filePath = line.substring(3).trim()
          // Remove quotes if present
          const cleanPath = filePath.replace(/^"(.*)"$/, '$1')
          changedFiles.push(cleanPath)
        }
      }

      return changedFiles
    }
    catch (error) {
      console.error('Error getting changed files:', error)
      return []
    }
  }

  private async getModifiedFiles(): Promise<string[]> {
    if (!this.workspaceRoot) {
      return []
    }

    try {
      const { stdout } = await execAsync('git status --porcelain', {
        cwd: this.workspaceRoot,
      })

      const modifiedFiles: string[] = []
      const lines = stdout.split('\n').filter(line => line.trim())

      for (const line of lines) {
        if (line.length > 3) {
          const status = line.substring(0, 2)
          const filePath = line.substring(3).trim()
          const cleanPath = filePath.replace(/^"(.*)"$/, '$1')

          // Check if file is modified (tracked and changed)
          // Status patterns for modified files:
          // M = modified, D = deleted, R = renamed, C = copied
          const isModified = status.match(/^[ MARC][MD]|^[ MARC] [MD]|^[MDARC]\?/)
          if (isModified && !status.startsWith('??')) {
            modifiedFiles.push(cleanPath)
          }
        }
      }

      return modifiedFiles
    }
    catch (error) {
      console.error('Error getting modified files:', error)
      return []
    }
  }

  private async getUntrackedFiles(): Promise<string[]> {
    if (!this.workspaceRoot) {
      return []
    }

    try {
      const { stdout } = await execAsync('git status --porcelain', {
        cwd: this.workspaceRoot,
      })

      const untrackedFiles: string[] = []
      const lines = stdout.split('\n').filter(line => line.trim())

      for (const line of lines) {
        if (line.length > 3) {
          const status = line.substring(0, 2)
          const filePath = line.substring(3).trim()
          const cleanPath = filePath.replace(/^"(.*)"$/, '$1')

          // Check if file is untracked (?? status)
          if (status === '??') {
            untrackedFiles.push(cleanPath)
          }
        }
      }

      return untrackedFiles
    }
    catch (error) {
      console.error('Error getting untracked files:', error)
      return []
    }
  }

  async addAllChangesToIgnoreList() {
    if (!this.workspaceRoot) {
      vscode.window.showErrorMessage('No workspace folder found')
      return
    }

    try {
      const changedFiles = await this.getAllChangedFiles()

      if (changedFiles.length === 0) {
        return
      }

      for (const relativePath of changedFiles) {
        const fullPath = path.join(this.workspaceRoot, relativePath)

        // Skip if already ignored
        if (this.ignoredFiles.has(relativePath)) {
          continue
        }

        this.ignoredFiles.add(relativePath)

        // Check if file is tracked and apply skip-worktree
        const isTracked = await this.isFileTrackedByGit(fullPath)
        if (isTracked) {
          await this.skipWorktreeFile(fullPath)
        }
        else {
          // For untracked files, ensure they're not in the index
          await this.removeFromIndex(fullPath)
        }
      }

      await this.saveIgnoredFiles()

      // Refresh SCM to update the UI
      vscode.commands.executeCommand('git.refresh')
    }
    catch (error) {
      console.error('Error adding all changes to ignore list:', error)
      vscode.window.showErrorMessage(`Failed to add all changes to ignore list: ${error}`)
    }
  }

  async addAllModifiedToIgnoreList() {
    if (!this.workspaceRoot) {
      vscode.window.showErrorMessage('No workspace folder found')
      return
    }

    try {
      const modifiedFiles = await this.getModifiedFiles()

      if (modifiedFiles.length === 0) {
        return
      }

      for (const relativePath of modifiedFiles) {
        const fullPath = path.join(this.workspaceRoot, relativePath)

        // Skip if already ignored
        if (this.ignoredFiles.has(relativePath)) {
          continue
        }

        this.ignoredFiles.add(relativePath)

        // Modified files are tracked, apply skip-worktree
        await this.skipWorktreeFile(fullPath)
      }

      await this.saveIgnoredFiles()

      // Refresh SCM to update the UI
      vscode.commands.executeCommand('git.refresh')
    }
    catch (error) {
      console.error('Error adding modified files to ignore list:', error)
      vscode.window.showErrorMessage(`Failed to add modified files to ignore list: ${error}`)
    }
  }

  async addAllUntrackedToIgnoreList() {
    if (!this.workspaceRoot) {
      vscode.window.showErrorMessage('No workspace folder found')
      return
    }

    try {
      const untrackedFiles = await this.getUntrackedFiles()

      if (untrackedFiles.length === 0) {
        return
      }

      for (const relativePath of untrackedFiles) {
        const fullPath = path.join(this.workspaceRoot, relativePath)

        // Skip if already ignored
        if (this.ignoredFiles.has(relativePath)) {
          continue
        }

        this.ignoredFiles.add(relativePath)

        // Untracked files are not tracked, ensure they're not in the index
        await this.removeFromIndex(fullPath)
      }

      await this.saveIgnoredFiles()

      // Refresh SCM to update the UI
      vscode.commands.executeCommand('git.refresh')
    }
    catch (error) {
      console.error('Error adding untracked files to ignore list:', error)
      vscode.window.showErrorMessage(`Failed to add untracked files to ignore list: ${error}`)
    }
  }

  async addToIgnoreList(filePath: string) {
    if (!this.workspaceRoot) {
      vscode.window.showErrorMessage('No workspace folder found')
      return
    }

    try {
      // Convert to relative path
      const relativePath = path.relative(this.workspaceRoot, filePath)
      this.ignoredFiles.add(relativePath)

      // Check if file is already tracked by Git
      const isTracked = await this.isFileTrackedByGit(filePath)

      if (isTracked) {
        // For tracked files, use skip-worktree to ignore local changes
        await this.skipWorktreeFile(filePath)
      }
      else {
        // For untracked files, ensure they're not in the index
        await this.removeFromIndex(filePath)
      }

      await this.saveIgnoredFiles()

      // Refresh SCM to update the UI
      vscode.commands.executeCommand('git.refresh')
    }
    catch (error) {
      console.error('Error adding file to ignore list:', error)
      vscode.window.showErrorMessage(`Failed to add ${path.basename(filePath)} to ignore list: ${error}`)
    }
  }

  async removeFromIgnoreList(filePath: string) {
    if (!this.workspaceRoot) {
      return
    }

    try {
      const relativePath = path.relative(this.workspaceRoot, filePath)
      this.ignoredFiles.delete(relativePath)

      // Check if file was tracked and remove skip-worktree
      const isTracked = await this.isFileTrackedByGit(filePath)
      if (isTracked) {
        await this.unskipWorktreeFile(filePath)
      }

      await this.saveIgnoredFiles()

      // Refresh SCM to update the UI
      vscode.commands.executeCommand('git.refresh')
    }
    catch (error) {
      console.error('Error removing file from ignore list:', error)
      vscode.window.showErrorMessage(`Failed to remove ${path.basename(filePath)} from ignore list: ${error}`)
    }
  }

  async clearIgnoreList() {
    if (!this.workspaceRoot) {
      return
    }

    try {
      // Restore skip-worktree for all tracked files
      for (const relativePath of this.ignoredFiles) {
        const fullPath = path.join(this.workspaceRoot, relativePath)
        const isTracked = await this.isFileTrackedByGit(fullPath)
        if (isTracked) {
          await this.unskipWorktreeFile(fullPath)
        }
      }

      this.ignoredFiles.clear()
      await this.saveIgnoredFiles()

      // Refresh SCM to update the UI
      vscode.commands.executeCommand('git.refresh')
    }
    catch (error) {
      console.error('Error clearing ignore list:', error)
      vscode.window.showErrorMessage(`Failed to clear ignore list: ${error}`)
    }
  }

  getIgnoredFiles(): string[] {
    return Array.from(this.ignoredFiles)
  }

  isIgnored(filePath: string): boolean {
    if (!this.workspaceRoot) {
      return false
    }

    const relativePath = path.relative(this.workspaceRoot, filePath)
    return this.ignoredFiles.has(relativePath)
  }

  dispose() {
    // Clean up if needed
  }
}
