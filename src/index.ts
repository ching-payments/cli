import { Command } from "commander"
import { loginCommand } from "./commands/login"
import { logoutCommand } from "./commands/logout"
import { whoamiCommand } from "./commands/whoami"
import { useCommand } from "./commands/use"
import { openCommand } from "./commands/open"
import { productsListCommand } from "./commands/products/list"
import { productsGetCommand } from "./commands/products/get"
import { productsCreateCommand } from "./commands/products/create"
import { productsUpdateCommand } from "./commands/products/update"
import { pricesListCommand } from "./commands/prices/list"
import { pricesGetCommand } from "./commands/prices/get"
import { pricesCreateCommand } from "./commands/prices/create"
import { customersListCommand } from "./commands/customers/list"
import { customersGetCommand } from "./commands/customers/get"
import { customersCreateCommand } from "./commands/customers/create"
import { chargesListCommand } from "./commands/charges/list"
import { chargesGetCommand } from "./commands/charges/get"
import { chargesCaptureCommand } from "./commands/charges/capture"
import { chargesCancelCommand } from "./commands/charges/cancel"
import {
  maybeRefreshVersionCacheInBackground,
  printUpdateBannerIfAvailable,
} from "./api/versionCheck"
import { projectsListCommand } from "./commands/projects/list"
import { projectsCreateCommand } from "./commands/projects/create"
import { skillInstallCommand } from "./commands/skill/install"
import { skillUninstallCommand } from "./commands/skill/uninstall"
import { skillListCommand } from "./commands/skill/list"
import { skillUpdateCommand } from "./commands/skill/update"
import { webhooksCreateCommand } from "./commands/webhooks/create"
import { webhooksListCommand } from "./commands/webhooks/list"
import { webhooksDeleteCommand } from "./commands/webhooks/delete"
import { apiKeysCreateCommand } from "./commands/api-keys/create"
import { apiKeysListCommand } from "./commands/api-keys/list"
import { apiKeysRenameCommand } from "./commands/api-keys/rename"
import { apiKeysDeleteCommand } from "./commands/api-keys/delete"

interface PackageJson {
  version?: string
}

// __dirname-equivalent for ESM. tsup --shims polyfills __dirname so this
// works in the bundled output as well.
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const here = dirname(fileURLToPath(import.meta.url))
let pkgVersion = "0.0.0"
try {
  const pkg = JSON.parse(
    readFileSync(resolve(here, "..", "package.json"), "utf8"),
  ) as PackageJson
  pkgVersion = pkg.version ?? pkgVersion
} catch {
  // dev runs may not have package.json adjacent; not fatal.
}

const program = new Command()

program
  .name("ching")
  .description("CHING command-line interface. Manage products, prices, and customers from your terminal.")
  .version(pkgVersion, "-v, --version")
  .helpOption("-h, --help", "Show help")
  // Global flags. Subcommands inherit via `program.opts()` -> we copy into
  // each command's flags object below.
  .option("--json", "Output JSON instead of human-friendly format")
  .option("--project <id>", "Override active project (numeric id) for this call")
  .option("--live", "Override active mode to LIVE for this call")
  .option("--test", "Override active mode to TEST for this call")
  .option("--yes", "Skip the confirm prompt for live writes")
  .showHelpAfterError()

// Helper: merge global flags down into the subcommand's options. commander
// keeps global options on the root program; we hoist them so each command
// sees them in `flags`.
function mergeGlobals<T extends object>(local: T): T {
  const root = program.opts()
  return { ...root, ...local }
}

// auth
program
  .command("login")
  .description("Sign in via the browser (or paste an API key with --with-key)")
  .option("--with-key", "Skip the browser flow and paste an API key instead")
  .action(async (opts) => {
    await loginCommand(mergeGlobals(opts))
  })

program
  .command("logout")
  .description("Sign out and remove local credentials")
  .option("--revoke", "Also revoke the server-side CLI session (browser flow only)")
  .action(async (opts) => {
    await logoutCommand(mergeGlobals(opts))
  })

program
  .command("whoami")
  .description("Show the current session: user, project, mode, masked credentials")
  .action(async (opts) => {
    await whoamiCommand(mergeGlobals(opts))
  })

program
  .command("use [project]")
  .description("Switch active project and/or mode (--live | --test)")
  .action(async (project: string | undefined, opts) => {
    await useCommand(project, mergeGlobals(opts))
  })

program
  .command("open [page]")
  .description("Open a dashboard page in the browser")
  .action(async (page: string | undefined, opts) => {
    await openCommand(page, mergeGlobals(opts))
  })

// skill
const skill = program
  .command("skill")
  .description("Install the CHING skill into your AI tools (Claude Code, Cursor)")
skill
  .command("install")
  .description("Download and install the CHING skill")
  .option("--target <ids>", "Comma-separated subset of: claude, cursor (default: all detected)")
  .option("--global", "Install in your home directory (~/.claude, ~/.cursor)")
  .option("--project", "Install in the current project (./.claude, ./.cursor)")
  .option("--force", "Overwrite an existing install")
  .action(async (opts) => {
    await skillInstallCommand(mergeGlobals(opts))
  })
skill
  .command("update")
  .description("Fetch the latest skill from GitHub and refresh existing installs")
  .option("--target <ids>", "Comma-separated subset of: claude, cursor (default: all installed)")
  .option("--global", "Update the install in your home directory")
  .option("--project", "Update the install in the current project")
  .action(async (opts) => {
    await skillUpdateCommand(mergeGlobals(opts))
  })
skill
  .command("uninstall")
  .description("Remove the CHING skill from your AI tools")
  .option("--target <ids>", "Comma-separated subset of: claude, cursor (default: all)")
  .option("--global", "Remove from your home directory")
  .option("--project", "Remove from the current project")
  .action(async (opts) => {
    await skillUninstallCommand(mergeGlobals(opts))
  })
skill
  .command("list")
  .description("Show where the skill is currently installed")
  .action(async (opts) => {
    await skillListCommand(mergeGlobals(opts))
  })

// projects
const projects = program.command("projects").description("Manage projects on your account")
projects
  .command("list")
  .description("List projects you have access to (active project is marked)")
  .action(async (opts) => {
    await projectsListCommand(mergeGlobals(opts))
  })
projects
  .command("create")
  .description("Create a new project")
  .option("--name <name>", "Project name")
  .option("--business-identity-id <id>", "Attach an existing business identity (numeric id)")
  .option("--switch", "Set the new project as active even if you already have one")
  .option("--no-switch", "Do not switch to the new project even if you have none active")
  .action(async (opts) => {
    await projectsCreateCommand(mergeGlobals(opts))
  })

// products
const products = program.command("products").description("Manage products")
products
  .command("list")
  .option("--limit <n>", "Maximum number of products to return")
  .action(async (opts) => {
    await productsListCommand(mergeGlobals(opts))
  })
products
  .command("get <id>")
  .action(async (id: string, opts) => {
    await productsGetCommand(id, mergeGlobals(opts))
  })
products
  .command("create")
  .option("--name <name>", "Product name")
  .option("--description <text>", "Product description")
  .option("--feature <feature...>", "Repeatable: 'Title|Subtitle' or just 'Title'")
  .option("--unlisted", "Hide from public catalog")
  .action(async (opts) => {
    await productsCreateCommand(mergeGlobals(opts))
  })
products
  .command("update <id>")
  .option("--name <name>")
  .option("--description <text>")
  .option("--add-feature <feature...>", "Repeatable: append a 'Title|Subtitle' feature")
  .option("--clear-features", "Remove all features")
  .option("--unlisted", "Mark as unlisted")
  .option("--no-unlisted", "Mark as listed")
  .action(async (id: string, opts) => {
    await productsUpdateCommand(id, mergeGlobals(opts))
  })

// prices
const prices = program.command("prices").description("Manage prices")
prices
  .command("list")
  .option("--product <id>", "Filter to a specific product")
  .option("--limit <n>", "Maximum number of prices to return")
  .action(async (opts) => {
    await pricesListCommand(mergeGlobals(opts))
  })
prices
  .command("get <id>")
  .action(async (id: string, opts) => {
    await pricesGetCommand(id, mergeGlobals(opts))
  })
prices
  .command("create")
  .option("--product <id>", "Product visible id (prod_...)")
  .option("--amount <agorot>", "Unit amount in agorot (₪49.90 -> 4990)")
  .option("--currency <code>", "Currency, default ils", "ils")
  .option("--type <type>", "one_time | recurring")
  .option("--interval <interval>", "day | week | month | year (recurring)")
  .option("--interval-count <n>", "How many intervals between charges, default 1")
  .option("--trial-days <n>", "Free trial in days (recurring)")
  .option("--tax-mode <mode>", "inclusive | exclusive")
  .action(async (opts) => {
    await pricesCreateCommand(mergeGlobals(opts))
  })

// charges - mostly for runtime J4J5 manual-capture flows where a
// fulfilment script needs to capture or cancel held charges from the
// terminal. Day-to-day chargeable use still lives in the dashboard.
const charges = program.command("charges").description("Inspect and manage charges (incl. J4J5 manual capture)")
charges
  .command("list")
  .description("List the most recent charges on the active project")
  .option("--customer <id>", "Filter to a single customer (cus_*)")
  .option("--requires-capture", "Show only charges currently awaiting capture (J4J5 holds)")
  .action(async (opts) => {
    await chargesListCommand(mergeGlobals(opts))
  })
charges
  .command("get <id>")
  .description("Retrieve a single charge (ch_*)")
  .action(async (id: string, opts) => {
    await chargesGetCommand(id, mergeGlobals(opts))
  })
charges
  .command("capture <id>")
  .description("Capture a manual-capture hold. Full capture by default; pass --amount for partial.")
  .option("--amount <agorot>", "Capture amount in agorot (must be ≤ original authorized amount)")
  .action(async (id: string, opts) => {
    await chargesCaptureCommand(id, mergeGlobals(opts))
  })
charges
  .command("cancel <id>")
  .description("Cancel (void) a manual-capture hold and release it on the CHING side")
  .option(
    "--reason <reason>",
    "requested_by_customer | fraudulent | abandoned (default: requested_by_customer)",
  )
  .action(async (id: string, opts) => {
    await chargesCancelCommand(id, mergeGlobals(opts))
  })

// customers
const customers = program.command("customers").description("Manage customers")
customers
  .command("list")
  .option("--limit <n>", "Maximum number of customers to return")
  .action(async (opts) => {
    await customersListCommand(mergeGlobals(opts))
  })
customers
  .command("get <id>")
  .action(async (id: string, opts) => {
    await customersGetCommand(id, mergeGlobals(opts))
  })
customers
  .command("create")
  .option("--email <email>", "Customer email")
  .option("--name <name>", "Customer name")
  .option("--phone <phone>", "Customer phone")
  .action(async (opts) => {
    await customersCreateCommand(mergeGlobals(opts))
  })

// webhooks
const webhooks = program
  .command("webhooks")
  .description("Manage webhook endpoints (scoped to the active test/live mode)")
webhooks
  .command("create")
  .description("Register a webhook endpoint. Prints the signing secret once - copy it now.")
  .option("--url <url>", "Endpoint URL (https://...)")
  .option("--events <event...>", "Repeatable or comma-separated, e.g. charge.succeeded charge.failed")
  .action(async (opts) => {
    await webhooksCreateCommand(mergeGlobals(opts))
  })
webhooks
  .command("list")
  .description("List webhook endpoints in the active mode (secrets are never shown)")
  .action(async (opts) => {
    await webhooksListCommand(mergeGlobals(opts))
  })
webhooks
  .command("delete <id>")
  .description("Delete a webhook endpoint by numeric id")
  .action(async (id: string, opts) => {
    await webhooksDeleteCommand(id, mergeGlobals(opts))
  })

// api-keys
const apiKeys = program
  .command("api-keys")
  .description("Manage API keys. Mode (--test/--live) decides which kind a new key is.")
apiKeys
  .command("create")
  .description("Issue a new API key. Prints the key once - copy it now. (Requires browser login.)")
  .option("--name <name>", "Optional label for the key")
  .action(async (opts) => {
    await apiKeysCreateCommand(mergeGlobals(opts))
  })
apiKeys
  .command("list")
  .description("List API keys (both test and live; only the masked preview is shown)")
  .action(async (opts) => {
    await apiKeysListCommand(mergeGlobals(opts))
  })
apiKeys
  .command("rename <id>")
  .description("Rename an API key by numeric id")
  .option("--name <name>", "New label for the key")
  .action(async (id: string, opts) => {
    await apiKeysRenameCommand(id, mergeGlobals(opts))
  })
apiKeys
  .command("delete <id>")
  .description("Delete an API key by numeric id (the key stops working immediately)")
  .action(async (id: string, opts) => {
    await apiKeysDeleteCommand(id, mergeGlobals(opts))
  })

// Update-check is opt-out per-command. `--version` / `--help` exit before
// any command runs, so the banner would never reach them anyway; `logout`
// is excluded so a user removing creds doesn't get an upsell on the way
// out. JSON output is suppressed inside printUpdateBannerIfAvailable so
// machine-readable callers stay clean.
const SKIP_UPDATE_CHECK_FOR = new Set(["logout"])
const invokedSubcommand = process.argv[2]
const skipUpdateCheck =
  !invokedSubcommand || SKIP_UPDATE_CHECK_FOR.has(invokedSubcommand)

if (!skipUpdateCheck) {
  // Kick off the background refresh BEFORE parseAsync so the fetch and the
  // command run concurrently. Fire-and-forget; if the registry is slow we
  // just keep showing yesterday's cached answer.
  maybeRefreshVersionCacheInBackground()
}

program
  .parseAsync(process.argv)
  .then(() => {
    if (skipUpdateCheck) return
    // Read --json off the root program at exit so script consumers stay
    // clean. The banner uses cached data only - never blocks on the
    // background fetch.
    const rootJson = !!program.opts().json
    printUpdateBannerIfAvailable(pkgVersion, rootJson)
  })
  .catch((err) => {
    process.stderr.write(
      err instanceof Error ? `Error: ${err.message}\n` : `Error: ${String(err)}\n`,
    )
    process.exit(1)
  })
