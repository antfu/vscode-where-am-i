import type { TextEditor } from 'vscode'
import path from 'node:path'
import { useLogger } from 'reactive-vscode'
import { window, workspace } from 'vscode'
import { config } from './config'
import { displayName } from './generated/meta'

export const logger = useLogger(displayName)

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

const textTransforms: Record<string, (t: string) => string> = {
  uppercase: (t: string) => t.toUpperCase(),
  lowercase: (t: string) => t.toLowerCase(),
  capitalize: (t: string) => t.trim().split(/-|_/g).map(capitalize).join(' '),
}

export function getProjectPath(): string | undefined {
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

function stringToColor(str: string, isDark: boolean = false) {
  let hash = 0
  for (let i = 0; i < str.length; i++)
    hash = str.charCodeAt(i) + ((hash << 5) - hash)

  const hue = Math.abs(hash) % 360

  const saturation = 65
  const lightness = isDark ? 60 : 40

  const result = hslToHex(hue, saturation, lightness)
  logger.info(`stringToColor: ${str} -> ${result}`)
  return result
}

function hslToHex(h: number, s: number, l: number) {
  const [r, g, b] = hslToRgb(h, s, l)
  return `#${r.toString(16).padStart(2, '0').slice(0, 2)}${g.toString(16).padStart(2, '0').slice(0, 2)}${b.toString(16).padStart(2, '0').slice(0, 2)}`
}

function hslToRgb(h: number, s: number, l: number) {
  h = h % 360
  h /= 360
  s /= 100
  l /= 100
  let r, g, b

  if (s === 0) {
    r = g = b = l // achromatic
  }
  else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0)
        t += 1
      if (t > 1)
        t -= 1
      if (t < 1 / 6)
        return p + (q - p) * 6 * t
      if (t < 1 / 2)
        return q
      if (t < 2 / 3)
        return p + (q - p) * (2 / 3 - t) * 6
      return p
    }

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }

  return [
    Math.max(0, Math.round(r * 255)),
    Math.max(0, Math.round(g * 255)),
    Math.max(0, Math.round(b * 255)),
  ]
}

export function getProjectColor(projectName: string, isDark: boolean): string | undefined {
  if (!config.colorful)
    return

  if (!projectName)
    return config.color || undefined

  return config.color || stringToColor(projectName, isDark)
}

export function getProjectName(projectPath: string) {
  const projectName = path.basename(projectPath)
  const transform = config.textTransfrom

  if (textTransforms[transform])
    return textTransforms[transform](projectName)
  return projectName
}
