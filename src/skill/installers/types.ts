// Each AI agent we support exposes one Installer. Keeping the interface
// tiny makes it easy to add new agents later without growing the install
// command's surface.

export type InstallScope = "global" | "project"

export interface InstallContext {
  // Path to the freshly-extracted skill directory (contains SKILL.md +
  // references/ + scripts/). Caller cleans this up after all installers run.
  sourceDir: string
  scope: InstallScope
  // Working directory for project-scoped installs. Ignored when scope = global.
  cwd: string
  force: boolean
}

export interface InstallResult {
  // Where the skill ended up on disk. Used for the "removed/installed" line
  // we print to the user.
  installedPath: string
  // True when the installer overwrote an existing install.
  overwrote: boolean
}

export interface Installer {
  // Stable identifier shown in flags (e.g. `--target=claude`). Lower-case,
  // no spaces.
  id: string
  // Human-readable label used in prompts and output.
  label: string
  // Resolves the destination path for the given scope. Pure - does not touch
  // the filesystem. Used by the install command to print where the skill
  // would land before the user confirms.
  resolveTarget(ctx: { scope: InstallScope; cwd: string }): string
  // Returns true if we found a strong signal that this agent is in use on
  // this machine (e.g. the agent's config dir exists). Used to pre-select
  // installers in the interactive prompt.
  detect(ctx: { scope: InstallScope; cwd: string }): boolean
  // Performs the install. Throws on unrecoverable errors.
  install(ctx: InstallContext): Promise<InstallResult>
  // Inverse of install. Returns false if nothing was there to remove.
  uninstall(ctx: { scope: InstallScope; cwd: string }): Promise<boolean>
}
