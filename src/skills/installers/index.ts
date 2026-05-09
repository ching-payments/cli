import { claudeInstaller } from "./claude"
import { cursorInstaller } from "./cursor"
import type { Installer } from "./types"

// Order here is the order users see in the interactive prompt + in
// summary output. We keep it stable.
export const INSTALLERS: Installer[] = [claudeInstaller, cursorInstaller]

export function installerById(id: string): Installer | undefined {
  return INSTALLERS.find((i) => i.id === id)
}

export type { Installer, InstallContext, InstallResult, InstallScope } from "./types"
