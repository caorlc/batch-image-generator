# Repository Guidelines

## Project Structure & Module Organization
- `src/app` contains App Router layouts, pages, and API handlers; `app/api/*` proxies NanoBanana, GPT-4o, Seedream, and TinyPNG.
- `src/components` houses Tailwind-ready UI parts, `src/hooks` state utilities, `src/lib/services` vendor clients, and `src/utils` shared helpers. Reference `docs/architecture.md` for flow details.
- Keep unit specs under `test/unit` and end-to-end or reducer flows in `test/integration`; mirror file paths from `src`.
- Static assets belong in `public/`, automation in `scripts/`, and prefer the `@/` alias defined in `tsconfig.json`.

## Build, Test, and Development Commands
- `npm run dev` launches the hot-reload server on `localhost:3000`.
- `npm run build` compiles the production bundle; run before any release or major PR.
- `npm run start` serves the built output for manual verification with real credentials.
- `npm run lint` runs the Next.js lint suite; resolve warnings before pushing.
- When adding tests, expose them through `npm test` so CI and reviewers can run a single command.

## Coding Style & Naming Conventions
- Stick with TypeScript strict mode, explicit exports, and `async/await` error handling.
- Name components in PascalCase, hooks/utilities in camelCase, and environment variables in SCREAMING_SNAKE_CASE.
- Surface user-facing errors via reducer or hook state instead of `console.log`.
- Rely on ESLint auto-fix (2-space indent, double quotes); avoid new `eslint-disable` blocks without a comment explaining why.

## Testing Guidelines
- Test reducer transitions, provider fallbacks, and negative API paths (TinyPNG throttles, Seedream/GPT failures).
- Mock network calls so specs stay deterministic; commit fixtures alongside the test file.
- Share runner details (Vitest, Jest, etc.) in the PR description until a canonical harness is agreed, and wire the command into `package.json`.
- Target ≥80% coverage for impacted modules and justify any intentional gaps.

## Commit & Pull Request Guidelines
- Use Conventional Commit prefixes (`feat:`, `fix:`, `chore:`, `docs:`) and keep changes scoped.
- A PR should include a short summary, linked issues, manual verification steps (`dev`, `build`, `lint`, tests), and screenshots for UI tweaks.
- Flag new env vars, migrations, or scripts so deployment owners can mirror them.

## Security & Configuration Tips
- Store provider keys (`GPT4O_API_KEY`, `SEEDREAM_API_KEY`, `TINIFY_API_KEY`, `NANOBANANA_API_KEY`) in `.env.local`; never commit secrets.
- The services fall back to mock responses when keys are missing—note which mode you exercised during review.
- Record architecture or provider additions in `docs/`, and keep helper scripts idempotent with usage comments.

用中文来回复我
