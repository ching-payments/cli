import http from "node:http"
import crypto from "node:crypto"
import { theme } from "@/ui/theme"

export interface LoopbackResult {
  token: string
}

export interface LoopbackHandle {
  // The fully-qualified callback URL the browser should be redirected
  // back to after authorization (e.g. http://127.0.0.1:54321/cb).
  callbackUrl: string
  // Random base64url state string. The CLI compares this to whatever
  // ching-front echoes back; mismatches throw.
  state: string
  // Resolves when ching-front redirects to /cb with token + state. Rejects
  // on cancel, state mismatch, malformed query, or timeout.
  result: Promise<LoopbackResult>
  // Tear down the local server. Safe to call multiple times.
  close: () => void
}

const TIMEOUT_MS = 5 * 60 * 1000

const SUCCESS_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>CHING CLI - Signed in</title>
  <meta name="referrer" content="no-referrer" />
  <style>
    html, body { margin: 0; padding: 0; height: 100%; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Helvetica, Arial; background: #f8fafc; color: #0f172a; }
    .card { max-width: 420px; margin: 96px auto; padding: 32px; background: white; border: 1px solid #e2e8f0; border-radius: 12px; text-align: center; box-shadow: 0 1px 1px rgba(0,0,0,0.02); }
    h1 { font-size: 18px; margin: 0 0 8px; }
    p { font-size: 13px; color: #475569; margin: 0; line-height: 1.55; }
    .check { display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: 999px; background: #ecfdf5; color: #16a34a; font-size: 22px; margin-bottom: 16px; }
  </style>
  <script>
    // Drop the token from the URL the moment the page renders, so it never
    // hits the user's browser history.
    history.replaceState(null, "", "/cb");
  </script>
</head>
<body>
  <div class="card">
    <div class="check">&#10003;</div>
    <h1>You are signed in</h1>
    <p>You can close this tab and return to your terminal.</p>
  </div>
</body>
</html>`

const ERROR_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>CHING CLI - Authorization cancelled</title>
  <meta name="referrer" content="no-referrer" />
  <style>
    html, body { margin: 0; padding: 0; height: 100%; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Helvetica, Arial; background: #f8fafc; color: #0f172a; }
    .card { max-width: 420px; margin: 96px auto; padding: 32px; background: white; border: 1px solid #e2e8f0; border-radius: 12px; text-align: center; }
    h1 { font-size: 18px; margin: 0 0 8px; }
    p { font-size: 13px; color: #475569; margin: 0; line-height: 1.55; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Authorization cancelled</h1>
    <p>Return to your terminal to try again.</p>
  </div>
</body>
</html>`

export async function startLoopback(): Promise<LoopbackHandle> {
  const state = crypto.randomBytes(32).toString("base64url")

  let resolve!: (v: LoopbackResult) => void
  let reject!: (e: Error) => void
  const result = new Promise<LoopbackResult>((res, rej) => {
    resolve = res
    reject = rej
  })

  let settled = false
  let timer: NodeJS.Timeout | null = null

  const server = http.createServer((req, res) => {
    if (settled) {
      res.statusCode = 410
      res.end("CLI loopback server has shut down.")
      return
    }
    if (!req.url) {
      res.statusCode = 400
      res.end("Bad request")
      return
    }

    let parsed: URL
    try {
      parsed = new URL(req.url, `http://${req.headers.host}`)
    } catch {
      res.statusCode = 400
      res.end("Bad request")
      return
    }

    if (parsed.pathname !== "/cb") {
      res.statusCode = 404
      res.end("Not found")
      return
    }

    const gotState = parsed.searchParams.get("state")
    const gotError = parsed.searchParams.get("error")
    const gotToken = parsed.searchParams.get("token")

    if (!gotState || gotState !== state) {
      res.statusCode = 400
      res.setHeader("Content-Type", "text/html; charset=utf-8")
      res.end(ERROR_HTML)
      finalize(new Error("Authorization rejected: state mismatch"))
      return
    }

    if (gotError) {
      res.statusCode = 200
      res.setHeader("Content-Type", "text/html; charset=utf-8")
      res.end(ERROR_HTML)
      finalize(new Error(`Authorization cancelled (${gotError})`))
      return
    }

    if (!gotToken) {
      res.statusCode = 400
      res.setHeader("Content-Type", "text/html; charset=utf-8")
      res.end(ERROR_HTML)
      finalize(new Error("Authorization response missing token"))
      return
    }

    res.statusCode = 200
    res.setHeader("Content-Type", "text/html; charset=utf-8")
    res.end(SUCCESS_HTML)
    finalize(null, { token: gotToken })
  })

  server.on("error", (err) => {
    if (!settled) finalize(err)
  })

  function finalize(err: Error | null, value?: LoopbackResult) {
    if (settled) return
    settled = true
    if (timer) clearTimeout(timer)
    setImmediate(() => server.close())
    if (err) reject(err)
    else if (value) resolve(value)
    else reject(new Error("Authorization aborted"))
  }

  // Bind to 127.0.0.1 only - never 0.0.0.0. This is non-negotiable for
  // a loopback flow; binding to all interfaces would expose the freshly
  // minted token to anyone on the LAN.
  await new Promise<void>((res, rej) => {
    server.once("error", rej)
    server.listen(0, "127.0.0.1", () => {
      server.off("error", rej)
      res()
    })
  })

  const address = server.address()
  if (!address || typeof address === "string") {
    server.close()
    throw new Error("Could not bind loopback server")
  }
  const callbackUrl = `http://127.0.0.1:${address.port}/cb`

  timer = setTimeout(() => {
    finalize(
      new Error(
        "Timed out waiting for browser authorization. Re-run `ching login` to try again.",
      ),
    )
  }, TIMEOUT_MS)

  return {
    callbackUrl,
    state,
    result,
    close: () => {
      if (settled) return
      finalize(new Error("Loopback closed"))
    },
  }
}

// Helper for `ching login` to print the URL nicely if `open` fails.
export function manualPasteHint(authorizeUrl: string): string {
  return `${theme.muted("If your browser did not open, paste this URL:")}\n  ${theme.underline(authorizeUrl)}`
}
