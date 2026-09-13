# Agent Guidelines

Rules and conventions for LLM agents working in this repository.

---

## Formatting

All code must be formatted with Prettier before being staged.

```
npm run format
```

Config is in `.prettierrc`. Key settings: single quotes, trailing commas, 100-character print width. Parsers for `.astro` and `.svelte` files are loaded automatically.

Run `npm run format:check` to verify without writing — CI enforces this and will fail on drift.

## Type Checking

The project uses TypeScript in strict mode (`astro/tsconfigs/strict` + `strictNullChecks`). Do not disable or suppress type errors with `// @ts-ignore` or `as any` casts. Fix the root cause.

Run the type checker with:

```
npx --no-install astro check
```

Fix all errors before committing. Warnings that cannot be fixed must be documented with a comment explaining why.

## Code Quality

**DRY.** Before adding a new utility, component, or helper, check whether one already exists. Duplication in UI components, data-fetching logic, and type definitions is not acceptable.

**No dead code.** Do not leave commented-out blocks, unused imports, or unreachable branches. Remove them.

**No unnecessary abstractions.** Do not introduce a shared helper, wrapper, or base class unless at least two distinct call sites already exist. Three similar lines is better than a premature abstraction.

**No speculative features.** Implement only what is asked. Do not add configuration options, escape hatches, or "future-proof" hooks that the task does not require.

**Scope creep.** A bug fix must not silently refactor surrounding code. A new feature must not clean up adjacent files. Keep diffs focused.

## CSRF Protection in Astro

Astro has built-in CSRF middleware that protects POST/PUT/DELETE requests. Be aware of how it works to avoid 403 Forbidden errors:

**The issue:** Bodyless requests (no `Content-Type` or `body`) that come from behind a TLS-terminating proxy hit Astro's strict CSRF origin check and fail. This is because Astro cannot verify the request origin reliably in proxied environments.

**The fix:** Add an explicit `Content-Type: 'application/json'` header to fetch requests. This routes the request through Astro's form-only CSRF check instead, which:
1. Only blocks HTML form submissions, not `fetch()` API calls
2. Does not require a CSRF token for JSON requests
3. Works reliably behind proxies

**Pattern for empty requests:**
```javascript
const resp = await fetch(url, {
  method: 'POST', // or PUT, DELETE
  headers: { 'Content-Type': 'application/json' },
  // No body needed
});
```

**Pattern for requests with data:**
```javascript
const resp = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ key: value }),
});
```

See `src/layouts/Layout.astro` (logout), `src/components/LeavingSoonCard.astro` (keep-requests), and `src/pages/media/[id].astro` (nominations) for working examples.

## Svelte 5 / Astro Conventions

- Use Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props`) — not Svelte 4 reactive syntax.
- Astro components handle routing, data loading, and layout. Svelte components handle interactivity.
- Server-side data fetching belongs in `.astro` files, not in Svelte components.
- Tailwind v4 utility classes only — no inline `style` attributes unless dynamically computed.

## Commits and Authorship

**Commit as yourself.** Any commit that results from LLM-assisted work must be committed under the human developer's own Git identity — not a bot account, not `Claude`, not a generic AI user. The author field must be a real person.

**Attribute LLM use in the commit body.** Add the following trailer line to the commit message when an LLM materially contributed to the change:

```
AI-assisted: true
```

The commit message itself should be written in the developer's voice and describe the change accurately. Do not include model names, session IDs, or prompt text in commit messages.

**Do not amend published commits.** If a follow-up fix is needed, create a new commit.

## Pull Requests

PR descriptions should include a `## AI Assistance` section when relevant, noting that an LLM was used and briefly what for (e.g., "drafted initial implementation, reviewed by human"). This is for transparency, not credit.

## What Agents Should Not Do

- Push to `main` directly.
- Merge pull requests.
- Modify CI/CD pipeline files without explicit instruction.
- Change `package.json` dependencies without explicit instruction.
- Run `npm install` or modify `package-lock.json` unless adding/removing a dependency was the explicit task.
- Commit secrets, tokens, or credentials.
- Commit `.mcp.json` — this is a local sandbox artifact and is in `.prettierignore` for a reason.
