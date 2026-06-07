When using developer: or research: skills, use the folder `.agents/` instead of `docs`, as `docs` is used for the static deployment.

This project runs TypeScript directly on Node (`"engines": { "node": ">=24" }`). Node 24 strips TypeScript types by default. Do NOT add `--experimental-strip-types` to `node` invocations in scripts or commands. Invoke `.ts` files as `node script.ts`.
