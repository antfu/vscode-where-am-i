import path from 'path'
import { ConfigurationTarget, workspace, StatusBarAlignment, TextEditor, window, ExtensionContext, Disposable, commands } from 'vscode'

type ProjectSetting = Record<string, {
  color?: string
  name?: string
}>

function getSource(): string {
  return workspace.getConfiguration('where-am-i').get('source') as string
}

function getTextStyle(): string {
  return workspace.getConfiguration('where-am-i').get('textStyle') as string
}

function alignPriority(): number {
  return +(workspace.getConfiguration('where-am-i').get('alignPriority') as string)
}

function getTemplate(): string {
  return workspace.getConfiguration('where-am-i').get('template') as string
}

function getColorful(): boolean {
  return workspace.getConfiguration('where-am-i').get('colorful') as boolean
}

function getProjectSetting(): ProjectSetting {
  return workspace.getConfiguration('where-am-i').get('projectSetting') as ProjectSetting
}

function setProjectSetting(v: ProjectSetting) {
  workspace.getConfiguration('where-am-i').update('projectSetting', v, ConfigurationTarget.Global)
}

function getAlign(): StatusBarAlignment {
  const align: string = workspace.getConfiguration('where-am-i').get('align') as string
  switch (align) {
    case 'left':
      return StatusBarAlignment.Left
    case 'right':
      return StatusBarAlignment.Right
    default:
      return StatusBarAlignment.Left
  }
}

function getProjectPath(): string | undefined {
  if (Array.isArray(workspace.workspaceFolders)) {
    if (workspace.workspaceFolders.length === 1) {
      return workspace.workspaceFolders[0].uri.path
    }
    else if (workspace.workspaceFolders.length > 1) {
      const activeTextEditor: TextEditor | undefined = window.activeTextEditor
      if (activeTextEditor) {
        const workspaceFolder = workspace.workspaceFolders.find(folder =>
          activeTextEditor.document.uri.path.startsWith(folder.uri.path),
        )
        if (workspaceFolder)
          return workspaceFolder.uri.path
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

function getProjectColor(projectName: string) {
  if (!projectName || !getColorful())
    return undefined

  return stringToColour(projectName)
}

function getProjectName(projectPath: string) {
  const projectName = path.basename(projectPath)

  switch (getTextStyle()) {
    case 'uppercase':
      return projectName.toUpperCase()
    case 'lowercase':
      return projectName.toLowerCase()
    default:
      return projectName
  }
}

export function activate(context: ExtensionContext) {
  let onDidChangeWorkspaceFoldersDisposable: Disposable | undefined
  let onDidChangeActiveTextEditorDisposable: Disposable | undefined
  const statusBarItem = window.createStatusBarItem(getAlign(), alignPriority())
  let projectPath: string |undefined
  let projectName = ''
  let statusBarName = ''
  let statusBarColor: string |undefined

  function updateStatusBarItem() {
    projectPath = getProjectPath()
    if (!projectPath) {
      statusBarItem.text = ''
      statusBarItem.hide()
      return
    }

    const projectSetting = getProjectSetting()[projectPath]
    projectName = projectSetting?.name || getProjectName(projectPath)
    statusBarName = getTemplate().replace(/{project-name}/, projectName)
    statusBarColor = projectSetting?.color || getProjectColor(projectPath)
    statusBarItem.text = statusBarName
    statusBarItem.color = statusBarColor
    statusBarItem.show()
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
                && (onDidChangeWorkspaceFoldersDisposable = workspace.onDidChangeWorkspaceFolders(() => {
                  updateSubscription()
                  updateStatusBarItem()
                }))

      Array.isArray(workspace.workspaceFolders) && (workspace.workspaceFolders.length > 1)
        ? !onDidChangeActiveTextEditorDisposable && (onDidChangeActiveTextEditorDisposable
                    = window.onDidChangeActiveTextEditor(() => updateStatusBarItem()))
        : onDidChangeActiveTextEditorDisposable && onDidChangeActiveTextEditorDisposable.dispose()
    }
  }

  context.subscriptions.push(statusBarItem)

  commands.registerCommand('where-am-i.config', async() => {
    if (!projectName || !projectPath)
      return

    projectName = await window.showInputBox({
      value: projectName,
      prompt: 'Project Name',
    }) ?? projectName

    if (getColorful()) {
      statusBarColor = await window.showInputBox({
        value: statusBarColor,
        prompt: 'Project Color',
      }) ?? statusBarColor
    }

    const settings = getProjectSetting()
    if (!settings[projectPath])
      settings[projectPath] = {}

    const projectSetting = settings[projectPath]
    projectSetting.name = projectName
    projectSetting.color = statusBarColor

    setProjectSetting(settings)
    updateStatusBarItem()
  })

  workspace.onDidChangeConfiguration(() => {
    updateSubscription()
    updateStatusBarItem()
  })

  updateSubscription()
  updateStatusBarItem()
}
