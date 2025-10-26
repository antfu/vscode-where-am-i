import type { ProjectSetting } from './types'
import { defineConfigObject } from 'reactive-vscode'
import { ConfigurationTarget, StatusBarAlignment } from 'vscode'
import * as Meta from './generated/meta'

export const config = defineConfigObject<Meta.ScopedConfigKeyTypeMap>(
  Meta.scopedConfigs.scope,
  Meta.scopedConfigs.defaults,
)

export function alignPriority(): number {
  return +config.alignPriority
}

export function getProjectSetting(): ProjectSetting {
  return config.projectSetting as ProjectSetting
}

export function setProjectSetting(v: ProjectSetting) {
  config.$update('projectSetting', v, ConfigurationTarget.Global)
}

export function getAlign(): StatusBarAlignment {
  switch (config.align) {
    case 'left':
      return StatusBarAlignment.Left
    case 'right':
      return StatusBarAlignment.Right
    default:
      return StatusBarAlignment.Left
  }
}
