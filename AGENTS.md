# AGENTS

When using developer: or research: skills, use the folder `.agents/` instead of `docs`, as `docs` is used for the static deployment.

This project runs TypeScript directly on Node (`"engines": { "node": ">=24" }`). Node 24 strips TypeScript types by default. Do NOT add `--experimental-strip-types` to `node` invocations in scripts or commands. Invoke `.ts` files as `node script.ts`.

Node is provisioned by mise from the root `mise.toml`, not NVM. Run `mise trust && mise install` once per clone; afterward `node` resolves through mise (e.g. `mise exec -- node script.ts`) in non-interactive shells without NVM. The package.json scripts are mirrored as `[tasks]` in `mise.toml`, so `mise run check` / `mise run test` delegate to `npm run <script>`.

Visual verification uses `playwright-cli`. It runs Playwright commands from the shell, so no MCP plugin is required. The bundled usage guide is at `$(brew --prefix)/Cellar/playwright-cli/*/libexec/lib/node_modules/@playwright/cli/node_modules/playwright-core/lib/tools/cli-client/skill/SKILL.md`. The core loop is `open <url>`, `goto`, `snapshot` (returns `eN` element refs to target), interact, `screenshot --full-page --filename=...`, `close`. Pass `--raw` to strip page status and snapshot sections when piping output.

The static site links CSS with absolute paths (`/global.css`), so open pages through a server rooted at `docs/`, never as `file://`. Serve with `node scripts/serve.ts --port 8080 --watch`, but beware that `--watch` rebuilds `docs/` from `src`. Since you're only touching `src`, this should be OK, but the loaded page will live reload. Then point the browser at `http://127.0.0.1:8080/<clean-url>` (e.g. `/trips/hvar/`). If port 8080 is already taken, a server is likely running already; reuse it rather than starting another.
