import type { Disposable, ExtensionContext } from 'vscode'
import { defineExtension, useIsDarkTheme, watch } from 'reactive-vscode'
import { commands, window, workspace } from 'vscode'
import { alignPriority, config, getAlign, getProjectSetting, setProjectSetting } from './config'
import icons from './icons'
import { getCommand, getProjectColor, getProjectName, getProjectPath } from './utils'

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

const { activate, deactivate } = defineExtension((context: ExtensionContext) => {
  let onDidChangeWorkspaceFoldersDisposable: Disposable | undefined
  let onDidChangeActiveTextEditorDisposable: Disposable | undefined
  const isDark = useIsDarkTheme()
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
    statusBarColor = projectSetting?.color || getProjectColor(projectPath, isDark.value)
    statusBarItem.text = statusBarName
    statusBarItem.color = statusBarColor
    statusBarItem.command = getCommand()
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

  watch(
    () => isDark.value,
    () => {
      updateSubscription()
      updateStatusBarItem()
    },
    { immediate: true },
  )
})

export { activate, deactivate }
