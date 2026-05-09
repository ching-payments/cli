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

program.parseAsync(process.argv).catch((err) => {
  process.stderr.write(
    err instanceof Error ? `Error: ${err.message}\n` : `Error: ${String(err)}\n`,
  )
  process.exit(1)
})
