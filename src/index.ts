import { defineExtension } from 'reactive-vscode'
import * as vscode from 'vscode'
import { GitIgnoreManager } from './gitIgnoreManager'
import { GitIgnoreProvider } from './gitIgnoreProvider'

const { activate, deactivate } = defineExtension(() => {
  const gitIgnoreManager = new GitIgnoreManager()
  const gitIgnoreProvider = new GitIgnoreProvider(gitIgnoreManager)

  // Register the tree data provider
  const treeView = vscode.window.createTreeView('gitIgnoreHelper', {
    treeDataProvider: gitIgnoreProvider,
    showCollapseAll: true,
    canSelectMany: false,
    dragAndDropController: gitIgnoreProvider,
  })

  // Register commands
  const commands = [
    vscode.commands.registerCommand('gitIgnoreHelper.addToIgnoreList', async (resource: any) => {
      let filePath: string | undefined

      // Handle different types of resource objects
      if (resource?.resourceUri) {
        // From SCM resource state
        filePath = resource.resourceUri.fsPath
      }
      else if (resource?.fsPath) {
        // From URI object
        filePath = resource.fsPath
      }
      else if (typeof resource === 'string') {
        // From string path
        filePath = resource
      }
      else if (resource instanceof vscode.Uri) {
        // From vscode.Uri
        filePath = resource.fsPath
      }

      if (!filePath) {
        vscode.window.showErrorMessage('Could not determine file path')
        return
      }

      await gitIgnoreManager.addToIgnoreList(filePath)
      gitIgnoreProvider.refresh()
    }),

    vscode.commands.registerCommand('gitIgnoreHelper.addAllToIgnoreList', async () => {
      await gitIgnoreManager.addAllChangesToIgnoreList()
      gitIgnoreProvider.refresh()
    }),

    vscode.commands.registerCommand('gitIgnoreHelper.removeFromIgnoreList', async (item: any) => {
      if (item?.resourceUri) {
        await gitIgnoreManager.removeFromIgnoreList(item.resourceUri.fsPath)
      }
      else {
        vscode.window.showErrorMessage('Could not determine file path')
        return
      }
      gitIgnoreProvider.refresh()
    }),

    vscode.commands.registerCommand('gitIgnoreHelper.clearIgnoreList', async () => {
      await gitIgnoreManager.clearIgnoreList()
      gitIgnoreProvider.refresh()
    }),
  ]

  return {
    dispose() {
      treeView.dispose()
      commands.forEach(cmd => cmd.dispose())
      gitIgnoreManager.dispose()
    },
  }
})

export { activate, deactivate }
