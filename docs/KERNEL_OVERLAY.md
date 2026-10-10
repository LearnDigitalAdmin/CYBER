# Desk kernel overlay — install

The overlay holds **only** the desk kernel files (listed in `docs/KERNEL_MANIFEST.txt`). It does not depend on any git commit, so it works on whatever state the repo is in, and it never touches generator work outside those files.

```
# from the repo root
tar -xzf desk-kernel-overlay.tar.gz
node scripts/patch-root-config.mjs      # idempotent: package.json scripts, firebase.json codebase + emulator
npm install && (cd functions-desk && npm install)
npm run desk:test && npx tsc -p tsconfig.app.json --noEmit
```

- Re-running is safe. If you have local edits to a kernel file, `git diff` before extracting.
- If `patch-root-config.mjs` reports the `/desk` route mount is missing, add the two lines it prints to `src/routes/AppRoutes.tsx`.
- After merging any other work, re-run `npm run desk:check-contract` (the frontend contract is generated from `functions-desk/src/contract.ts`).
