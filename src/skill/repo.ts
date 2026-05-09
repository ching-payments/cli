// Public skill repo. The CLI always pulls the latest `main` branch -
// users get skill updates by re-running `ching skill install`.
export const SKILL_REPO = "ching-payments/skill"
export const SKILL_BRANCH = "main"
export const SKILL_SLUG = "ching-payments-integration"
export const SKILL_TARBALL_URL = `https://codeload.github.com/${SKILL_REPO}/tar.gz/refs/heads/${SKILL_BRANCH}`
// GitHub tar.gz archives wrap their content in a top-level
// `<repo>-<branch>/` directory. We strip that prefix when copying.
export const SKILL_TARBALL_PREFIX = `skill-${SKILL_BRANCH}`
