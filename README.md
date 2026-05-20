# @ching-payments/cli

The CHING command-line interface. Sign in once via your browser and manage your CHING catalog from your terminal.

```sh
npx @ching-payments/cli login
```

## What it does

- Browser-based sign in (no copy-pasting API keys)
- Switch projects and test/live mode without re-logging in
- Manage products, prices, and customers from the terminal
- Create webhook endpoints and API keys, surfacing the secret once
- Open dashboard pages with `ching open`

## Install

You can run it without installing:

```sh
npx @ching-payments/cli <command>
```

Or install globally for a shorter `ching` invocation:

```sh
npm install -g @ching-payments/cli
ching <command>
```

## Sign in

```sh
ching login
```

This opens your browser to `https://app.ching.co.il/cli/authorize`. After you click Authorize, the CLI captures a long-lived session token (180 days), picks your active project, and defaults to test mode.

If you can't open a browser (CI, SSH, headless container), you can paste an API key instead:

```sh
ching login --with-key
```

## Common flows

### Create a product and a price

```sh
ching products create \
  --name "Pro plan" \
  --description "Full access to everything" \
  --feature "Unlimited usage|No throttling" \
  --feature "Priority support"

ching prices create \
  --product prod_abc123 \
  --amount 4990 \
  --type recurring \
  --interval month
```

Amounts are always in **agorot** (the smallest ILS unit). `₪49.90` → `--amount=4990`. The CLI rejects decimals with a clear error.

### Install the CHING AI skill

Teach Claude Code and Cursor everything they need to know about CHING in one command. The skill ships from [`github.com/ching-payments/skill`](https://github.com/ching-payments/skill).

```sh
ching skill install
```

The installer asks whether to install **globally** (`~/.claude/skills`, `~/.cursor/rules` - available in every project) or **for the current project only** (`./.claude/skills`, `./.cursor/rules` - shipped to teammates via git). Pre-selects only the AI tools it detects on your machine.

When the upstream skill changes, refresh your install with:

```sh
ching skill update              # asks: global vs current project
```

`update` only touches AI tools where the skill is already installed at the chosen scope - it never silently expands to new tools.

To skip the prompts in scripts:

```sh
ching skill install --global --target=claude,cursor --force
ching skill install --project --target=claude
ching skill update   --global
ching skill uninstall --global
ching skill list
```

### List or create projects

```sh
ching projects list              # active project is marked with a green ✓
ching projects create --name "My new shop"
```

A new project becomes active automatically if you didn't have one. Pass `--switch` to make it active even when you already have one, or `--no-switch` to keep your current selection.

### Switch projects or modes

```sh
ching use proj_mystore           # by visible id
ching use --live                 # flip the active session to live mode
ching use --test                 # back to test mode
```

You can also override per command without changing your active session:

```sh
ching prices list --live
ching products create --name=test --project 42
```

### List things

```sh
ching products list
ching prices list --product prod_abc123
ching customers list --limit 20
ching charges list                              # all charges
ching charges list --requires-capture           # only J4J5 holds
```

### Capture or cancel J4J5 holds from a fulfilment script

When you use `capture_method: 'manual'` on a checkout session, the customer's
card is authorized but not charged. Your warehouse/fulfilment software can
then drive the final outcome:

```sh
# Capture the full authorized amount (the typical case).
ching charges capture ch_AbCdEf

# Or capture less - useful for variable-weight goods. The unused balance
# is auto-released to the customer's card.
ching charges capture ch_AbCdEf --amount=13400

# Or cancel the hold entirely. (CHING-side release is immediate; the
# customer's bank may take up to 10 days to remove the hold.)
ching charges cancel ch_AbCdEf --reason=abandoned
```

Add `--json` for machine-readable output. By default, lists print as tables.

### Webhooks

Webhooks are scoped to the active mode - a webhook you create in test mode
only fires for test events. The signing secret (`whsec_...`) is printed
**once** at creation and can never be retrieved again; copy it immediately.

```sh
ching webhooks create \
  --url https://example.com/webhooks/ching \
  --events charge.succeeded charge.failed     # or: --events 'charge.succeeded,charge.failed'

ching webhooks list                            # current mode only; secrets never shown
ching webhooks delete 42                       # by numeric id
```

### API keys

The active mode decides which kind of key you get: in test mode you get a
`ck_test_...` key, in live mode a `ck_live_...` key. Live keys require a
linked business identity and an active payment provider. The full key is
shown **once** at creation - copy it immediately; afterwards only a masked
preview is available.

```sh
ching api-keys create --name "CI deploy key"   # uses the active mode (--live / --test to override)
ching api-keys list                            # shows test + live keys, masked preview only
ching api-keys rename 7 --name "Renamed key"
ching api-keys delete 7                         # the key stops working immediately
```

Creating a key needs a browser session (`ching login`), because the key is
tied to your user. If you signed in with `--with-key`, `api-keys create`
will tell you to run `ching login` first. Listing, renaming, and deleting
work with either sign-in method.

### Sign out

```sh
ching logout                     # forget local credentials
ching logout --revoke            # also revoke the server-side session
```

## Commands

| Command | What it does |
|---|---|
| `ching login [--with-key]` | Sign in (browser flow, or paste an API key) |
| `ching logout [--revoke]` | Sign out locally (and optionally revoke the server-side session) |
| `ching whoami` | Print current session: user, project, mode, masked credentials |
| `ching use <project>` | Switch active project (visible id or numeric id) |
| `ching use --live \| --test` | Switch active mode |
| `ching open [page]` | Open a dashboard page in the browser |
| `ching skill install/update/uninstall/list` | Install, refresh, or remove the CHING AI skill in Claude Code / Cursor |
| `ching projects list/create` | List your projects or create a new one |
| `ching products list/get/create/update` | Manage products |
| `ching prices list/get/create` | Manage prices |
| `ching customers list/get/create` | Manage customers |
| `ching charges list/get` | Inspect charges. `--requires-capture` filters to J4J5 holds awaiting capture |
| `ching charges capture <ch_*>` | Capture a manual-capture (J4J5) hold. `--amount=<agorot>` for partial; defaults to full |
| `ching charges cancel <ch_*>` | Cancel (void) a J4J5 hold. `--reason=requested_by_customer\|fraudulent\|abandoned` |
| `ching webhooks create/list/delete` | Manage webhook endpoints (mode-scoped). `create` prints the signing secret once |
| `ching api-keys create/list/rename/delete` | Manage API keys. `create` prints the key once; mode picks test vs live |

Run `ching <command> --help` for full flag listings.

## Global flags

These work on every command:

- `--json` raw JSON output instead of styled tables
- `--project <id>` override the active project for one call (numeric id)
- `--live` / `--test` override the active mode for one call
- `--yes` skip the confirm prompt for live writes

## Where credentials live

`~/.ching/config.json` (mode `0600`). Browser sign-in stores a JWT-style session token; `--with-key` stores an API key in the same file. You can revoke browser sessions any time from the [API keys page](https://app.ching.co.il/api-keys) on the dashboard.

## Update checks

After each command the CLI prints a one-line banner when a newer version of `@ching-payments/cli` is available on npm. The check runs against `registry.npmjs.org` at most once every 24h and caches the result in `~/.ching/version-cache.json`. Suppressed automatically in `--json` mode and when `CI=true`. To disable entirely, set `CHING_DISABLE_UPDATE_CHECK=1`.

## License

MIT
