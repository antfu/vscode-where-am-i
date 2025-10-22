import type { Disposable, ExtensionContext, TextEditor } from 'vscode'
import path from 'node:path'
import { defineExtension } from 'reactive-vscode'
import { commands, ConfigurationTarget, StatusBarAlignment, window, workspace } from 'vscode'
import { config } from './config'
import icons from './icons'

type ProjectSetting = Record<string, {
  color?: string
  name?: string
  icon?: string
}>

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

function alignPriority(): number {
  return +config.alignPriority
}

function getProjectSetting(): ProjectSetting {
  return config.projectSetting as ProjectSetting
}

function setProjectSetting(v: ProjectSetting) {
  config.$update('projectSetting', v, ConfigurationTarget.Global)
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

function stringToColor(str: string) {
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
  if (!config.colorful)
    return

  if (!projectName)
    return config.color || undefined

  return config.color || stringToColor(projectName)
}

const textTransforms: Record<string, (t: string) => string> = {
  uppercase: (t: string) => t.toUpperCase(),
  lowercase: (t: string) => t.toLowerCase(),
  capitalize: (t: string) => t.trim().split(/-|_/g).map(capitalize).join(' '),
}

function getProjectName(projectPath: string) {
  const projectName = path.basename(projectPath)
  const transform = config.textTransfrom

  if (textTransforms[transform])
    return textTransforms[transform](projectName)
  return projectName
}

const { activate, deactivate } = defineExtension((context: ExtensionContext) => {
  let onDidChangeWorkspaceFoldersDisposable: Disposable | undefined
  let onDidChangeActiveTextEditorDisposable: Disposable | undefined
  const statusBarItem = window.createStatusBarItem(getAlign(), alignPriority())
  let projectPath: string | undefined
  let projectName = ''
  let statusBarName = ''
  let statusBarColor: string | undefined
  let statusBarIcon: string | undefined

  function updateStatusBarItem() {
    projectPath = getProjectPath()
    if (!projectPath) {
      statusBarItem.text = ''
      statusBarItem.hide()
      return
    }

    const projectSetting = getProjectSetting()[projectPath]
    projectName = projectSetting?.name || getProjectName(projectPath)
    statusBarIcon = projectSetting?.icon || config.icon
    statusBarName = config.template
      .replace(/\{project-name\}/, projectName)
      .replace(/\{icon\}/, `$(${statusBarIcon})`)
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

  commands.registerCommand('where-am-i.config', async () => {
    if (!projectName || !projectPath)
      return

    projectName = await window.showInputBox({
      value: projectName,
      prompt: 'Project Name',
    }) ?? projectName

    if (config.colorful) {
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
})

export { activate, deactivate }
