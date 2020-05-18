import * as vscode from 'vscode'

function getSource(): string {
  return vscode.workspace.getConfiguration('where-am-i').get('source') as string
}

function getTextStyle(): string {
  return vscode.workspace.getConfiguration('where-am-i').get('textStyle') as string
}

function alignPriority(): number {
  return +(vscode.workspace.getConfiguration('where-am-i').get('alignPriority') as string)
}

function getTemplate(): string {
  return vscode.workspace.getConfiguration('where-am-i').get('template') as string
}

function getAlign(): vscode.StatusBarAlignment {
  const align: string = vscode.workspace.getConfiguration('where-am-i').get('align') as string
  switch (align) {
    case 'left':
      return vscode.StatusBarAlignment.Left
    case 'right':
      return vscode.StatusBarAlignment.Right
    default:
      return vscode.StatusBarAlignment.Left
  }
}

function getProjectNameByFolder(): string | undefined {
  if (Array.isArray(vscode.workspace.workspaceFolders)) {
    if (vscode.workspace.workspaceFolders.length === 1) {
      return vscode.workspace.workspaceFolders[0].name
    }
    else if (vscode.workspace.workspaceFolders.length > 1) {
      const activeTextEditor: vscode.TextEditor | undefined = vscode.window.activeTextEditor
      if (activeTextEditor) {
        const workspaceFolder = vscode.workspace.workspaceFolders.find(folder =>
          activeTextEditor.document.uri.path.startsWith(folder.uri.path),
        )
        if (workspaceFolder)
          return workspaceFolder.name
      }
    }
  }
}

function stringToColour(str: string) {
  let hash = 0
  for (let i = 0; i < str.length; i++)
    hash = str.charCodeAt(i) + ((hash << 5) - hash)

  let colour = '#'
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xFF
    colour += (`00${value.toString(16)}`).substr(-2)
  }
  return colour
}

function getProjectColor() {
  if (Array.isArray(vscode.workspace.workspaceFolders))
    return stringToColour(vscode.workspace.workspaceFolders[0].uri.path)
}

export function activate(context: vscode.ExtensionContext) {
  let onDidChangeWorkspaceFoldersDisposable: vscode.Disposable | undefined
  let onDidChangeActiveTextEditorDisposable: vscode.Disposable | undefined
  const statusBarItem = vscode.window.createStatusBarItem(getAlign(), alignPriority())

  function updateStatusBarItem() {
    let projectName: string | undefined

    switch (getSource()) {
      case 'none':
        break
      case 'folderName':
        projectName = getProjectNameByFolder()
        break
    }

    if (projectName) {
      switch (getTextStyle()) {
        case 'uppercase':
          projectName = projectName.toUpperCase()
          break
        case 'lowercase':
          projectName = projectName.toLowerCase()
          break
      }

      statusBarItem.text = getTemplate().replace(/{project-name}/, projectName)
      statusBarItem.color = getProjectColor()
      statusBarItem.show()
    }
    else {
      statusBarItem.text = ''
      statusBarItem.hide()
    }
  }

  function updateSubscription() {
    if (getSource() === 'none') {
      onDidChangeWorkspaceFoldersDisposable && onDidChangeWorkspaceFoldersDisposable.dispose()
      onDidChangeActiveTextEditorDisposable && onDidChangeActiveTextEditorDisposable.dispose()
      onDidChangeWorkspaceFoldersDisposable = undefined
      onDidChangeActiveTextEditorDisposable = undefined
    }
    else {
      !onDidChangeWorkspaceFoldersDisposable
                && (onDidChangeWorkspaceFoldersDisposable = vscode.workspace.onDidChangeWorkspaceFolders(() => {
                  updateSubscription()
                  updateStatusBarItem()
                }))

      Array.isArray(vscode.workspace.workspaceFolders) && (vscode.workspace.workspaceFolders.length > 1)
        ? !onDidChangeActiveTextEditorDisposable && (onDidChangeActiveTextEditorDisposable
                    = vscode.window.onDidChangeActiveTextEditor(() => updateStatusBarItem()))
        : onDidChangeActiveTextEditorDisposable && onDidChangeActiveTextEditorDisposable.dispose()
    }
  }

  context.subscriptions.push(statusBarItem)

  vscode.workspace.onDidChangeConfiguration(() => {
    updateSubscription()
    updateStatusBarItem()
  })

  updateSubscription()
  updateStatusBarItem()
}
