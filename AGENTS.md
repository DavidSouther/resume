When using developer: or research: skills, use the folder `.agents/` instead of `docs`, as `docs` is used for the static deployment.

This project runs TypeScript directly on Node (`"engines": { "node": ">=24" }`). Node 24 strips TypeScript types by default. Do NOT add `--experimental-strip-types` to `node` invocations in scripts or commands. Invoke `.ts` files as `node script.ts`.

Node is provisioned by mise from the root `mise.toml`, not NVM. Run `mise trust && mise install` once per clone; afterward `node` resolves through mise (e.g. `mise exec -- node script.ts`) in non-interactive shells without NVM. The package.json scripts are mirrored as `[tasks]` in `mise.toml`, so `mise run check` / `mise run test` delegate to `npm run <script>`.
