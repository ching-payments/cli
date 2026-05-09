# @ching-payments/cli

The CHING command-line interface. Sign in once via your browser and manage your CHING catalog from your terminal.

```sh
npx @ching-payments/cli login
```

## What it does

- Browser-based sign in (no copy-pasting API keys)
- Switch projects and test/live mode without re-logging in
- Manage products, prices, and customers from the terminal
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
```

Add `--json` for machine-readable output. By default, lists print as tables.

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
| `ching products list/get/create/update` | Manage products |
| `ching prices list/get/create` | Manage prices |
| `ching customers list/get/create` | Manage customers |

Run `ching <command> --help` for full flag listings.

## Global flags

These work on every command:

- `--json` raw JSON output instead of styled tables
- `--project <id>` override the active project for one call (numeric id)
- `--live` / `--test` override the active mode for one call
- `--yes` skip the confirm prompt for live writes

## Where credentials live

`~/.ching/config.json` (mode `0600`). Browser sign-in stores a JWT-style session token; `--with-key` stores an API key in the same file. You can revoke browser sessions any time from the [API keys page](https://app.ching.co.il/api-keys) on the dashboard.

## License

MIT
