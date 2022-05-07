import path from 'path'
import { ConfigurationTarget, workspace, StatusBarAlignment, TextEditor, window, ExtensionContext, Disposable, commands } from 'vscode'
import icons from './icons'

type ProjectSetting = Record<string, {
  color?: string
  name?: string
  icon?: string
}>

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

function getTextTransform(): string {
  return workspace.getConfiguration('where-am-i').get('textTransfrom') as string
}

function getIcon(): string {
  return workspace.getConfiguration('where-am-i').get('icon') as string
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

function getColour(): string {
  return workspace.getConfiguration('where-am-i').get('colour') as string
}

function getProjectSetting(): ProjectSetting {
  return workspace.getConfiguration('where-am-i').get('projectSetting') as ProjectSetting
}

function setProjectSetting(v: ProjectSetting) {
  workspace.getConfiguration('where-am-i').update('projectSetting', v, ConfigurationTarget.Global)
}

async function selectIcon(value?: string) {
  const items = icons.map(i => ({
    label: `$(${i})`,
    description: i,
  }))
  const result = await window.showQuickPick(items, {
    placeHolder: value,
    matchOnDetail: true,
    matchOnDescription: true,
  })
  return result?.description || value
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
        const workspaceFolder = workspace.workspaceFolders.find((folder: any) =>
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

function getProjectColor(projectName: string): string | undefined {
  let projectColor: string | undefined 

  if (getColorful()) {
    const defaultColor = getColour()
    if (/^#[0-9A-F]{6}$/i.test(defaultColor)) {
      projectColor =  defaultColor
    } else if (projectName) {
      projectColor = stringToColour(projectName)
    }
  }

  return projectColor
}

const textTransforms: Record<string, (t: string) => string> = {
  uppercase: (t: string) => t.toUpperCase(),
  lowercase: (t: string) => t.toLowerCase(),
  capitalize: (t: string) => t.trim().split(/-|_/g).map(capitalize).join(' '),
}

function getProjectName(projectPath: string) {
  const projectName = path.basename(projectPath)
  const transform = getTextTransform()

  if (textTransforms[transform])
    return textTransforms[transform](projectName)
  return projectName
}

export function activate(context: ExtensionContext) {
  let onDidChangeWorkspaceFoldersDisposable: Disposable | undefined
  let onDidChangeActiveTextEditorDisposable: Disposable | undefined
  const statusBarItem = window.createStatusBarItem(getAlign(), alignPriority())
  let projectPath: string |undefined
  let projectName = ''
  let statusBarName = ''
  let statusBarColor: string |undefined
  let statusBarIcon: string |undefined

  function updateStatusBarItem() {
    projectPath = getProjectPath()
    if (!projectPath) {
      statusBarItem.text = ''
      statusBarItem.hide()
      return
    }

    const projectSetting = getProjectSetting()[projectPath]
    projectName = projectSetting?.name || getProjectName(projectPath)
    statusBarIcon = projectSetting?.icon || getIcon()
    statusBarName = getTemplate()
      .replace(/{project-name}/, projectName)
      .replace(/{icon}/, `$(${statusBarIcon})`)
    statusBarColor = projectSetting?.color || getProjectColor(projectPath)
    statusBarItem.text = statusBarName
    statusBarItem.color = statusBarColor
    statusBarItem.command = 'workbench.action.quickSwitchWindow'
    statusBarItem.show()
  }

  function updateSubscription() {
    if (!onDidChangeWorkspaceFoldersDisposable) {
      (onDidChangeWorkspaceFoldersDisposable = workspace.onDidChangeWorkspaceFolders(() => {
        updateSubscription()
        updateStatusBarItem()
      }))
    }

    if (Array.isArray(workspace.workspaceFolders)) {
      if (workspace.workspaceFolders.length > 1) {
        if (!onDidChangeActiveTextEditorDisposable)
          onDidChangeActiveTextEditorDisposable = window.onDidChangeActiveTextEditor(() => updateStatusBarItem())
      }
      else {
        if (onDidChangeActiveTextEditorDisposable)
          onDidChangeActiveTextEditorDisposable.dispose()
      }
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

    statusBarIcon = await selectIcon(statusBarIcon)

    const settings = getProjectSetting()
    if (!settings[projectPath])
      settings[projectPath] = {}

    const projectSetting = settings[projectPath]
    projectSetting.name = projectName
    projectSetting.color = statusBarColor
    projectSetting.icon = statusBarIcon

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
