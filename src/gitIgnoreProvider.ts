import type { GitIgnoreManager } from './gitIgnoreManager'
import * as path from 'node:path'
import * as vscode from 'vscode'

export class GitIgnoreProvider implements vscode.TreeDataProvider<GitIgnoreItem>, vscode.TreeDragAndDropController<GitIgnoreItem> {
  dropMimeTypes = ['application/vnd.code.tree.explorer', 'text/uri-list']
  dragMimeTypes = ['text/uri-list']

  private _onDidChangeTreeData: vscode.EventEmitter<GitIgnoreItem | undefined | null | void> = new vscode.EventEmitter<GitIgnoreItem | undefined | null | void>()
  readonly onDidChangeTreeData: vscode.Event<GitIgnoreItem | undefined | null | void> = this._onDidChangeTreeData.event

  constructor(private gitIgnoreManager: GitIgnoreManager) {}

  refresh(): void {
    this._onDidChangeTreeData.fire()
  }

  getTreeItem(element: GitIgnoreItem): vscode.TreeItem {
    return element
  }

  getChildren(element?: GitIgnoreItem): Thenable<GitIgnoreItem[]> {
    if (!element) {
      // Root level - return all ignored files
      const ignoredFiles = this.gitIgnoreManager.getIgnoredFiles()
      return Promise.resolve(ignoredFiles.map(file => new GitIgnoreItem(file, vscode.TreeItemCollapsibleState.None)))
    }
    return Promise.resolve([])
  }

  async handleDrop(_target: GitIgnoreItem | undefined, sources: vscode.DataTransfer, _token: vscode.CancellationToken): Promise<void> {
    // Handle text/uri-list (direct file drops)
    const uriListTransfer = sources.get('text/uri-list')
    if (uriListTransfer) {
      const uriList = uriListTransfer.value
      const uris = uriList.split('\r\n').filter((uri: string) => uri.trim().length > 0)

      for (const uriString of uris) {
        try {
          const uri = vscode.Uri.parse(uriString)
          await this.gitIgnoreManager.addToIgnoreList(uri.fsPath)
        }
        catch (error) {
          console.error('Error parsing URI:', uriString, error)
        }
      }

      this.refresh()
      return
    }

    // Handle application/vnd.code.tree.explorer (tree item drops)
    const transferItem = sources.get('application/vnd.code.tree.explorer')
    if (!transferItem) {
      return
    }

    try {
      const data = transferItem.value

      // Handle file drops from explorer
      for (const item of data) {
        if (item && item.resourceUri) {
          await this.gitIgnoreManager.addToIgnoreList(item.resourceUri.fsPath)
        }
      }

      this.refresh()
    }
    catch (error) {
      console.error('Error handling drop:', error)
      vscode.window.showErrorMessage('Failed to add files to ignore list')
    }
  }

  async handleDrag(source: readonly GitIgnoreItem[], treeDataTransfer: vscode.DataTransfer, _token: vscode.CancellationToken): Promise<void> {
    // Allow dragging items out of the list
    const uris = source.map(item => item.resourceUri).filter(uri => uri !== undefined)
    treeDataTransfer.set('text/uri-list', new vscode.DataTransferItem(uris.map(uri => uri.toString()).join('\r\n')))
  }
}

export class GitIgnoreItem extends vscode.TreeItem {
  constructor(
    public readonly filePath: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
  ) {
    super(path.basename(filePath), collapsibleState)

    this.tooltip = filePath
    this.description = path.dirname(filePath) === '.' ? '' : path.dirname(filePath)
    this.contextValue = 'gitIgnoreItem'

    // Set the resource URI for the file
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
    if (workspaceRoot) {
      this.resourceUri = vscode.Uri.file(path.join(workspaceRoot, filePath))
    }

    // Set appropriate icon
    this.iconPath = new vscode.ThemeIcon('file')

    // Add command to open file when clicked
    this.command = {
      command: 'vscode.open',
      title: 'Open File',
      arguments: [this.resourceUri],
    }
  }
}
