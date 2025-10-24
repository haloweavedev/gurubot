# Repository Guidelines

## Project Structure & Module Organization
- App Router in `app/`. Two surfaces: `app/admin/...` (Admin Portal) and `app/learner/...` (Learner Portal) as described in IDEA.md.
- Components in `app/components/{admin,learner}/` (create as needed). Example: `app/components/learner/MicButton.tsx`.
- Domain modules in `lib/`: `lib/voice/` (Vapi/ElevenLabs), `lib/stt/` (Whisper/Deepgram), `lib/ai/` (LLM flow + scoring), `lib/db/` (Supabase), `lib/pdf/` (report export).
- Styling via Tailwind v4 in `app/globals.css`. Assets in `public/`. Config in `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`. Alias `@/*` maps to repo root.

## Build, Test, and Development Commands
- `pnpm dev` — Run local dev at `http://localhost:3000`.
- `pnpm build` — Create production build into `.next/`.
- `pnpm start` — Serve the production build.
- `pnpm lint` — ESLint (Core Web Vitals + TS). Use `--fix` to autofix.
Environment: create `.env.local` with keys as needed: `VAPI_API_KEY` or `ELEVENLABS_API_KEY`; `OPENAI_API_KEY` or `DEEPGRAM_API_KEY`; `SUPABASE_URL` and `SUPABASE_ANON_KEY`.

## Coding Style & Naming Conventions
- TypeScript in `strict` mode, 2‑space indentation. Follow ESLint; fix warnings before PR.
- React Server Components by default. Use `'use client'` only for browser APIs (mic, audio playback, canvas).
- Names: Components PascalCase (`UserCard.tsx`); hooks `useX.ts`; route segments lowercase. Prefer named exports; pages/layouts use default export.

## Testing Guidelines
- No runner configured yet. When adding tests, use Vitest + React Testing Library + MSW to mock voice/STT/LLM and Supabase.
- Name tests `*.test.ts(x)`, colocated or in `__tests__/`. Target ~80% coverage for new code and deterministic tests.

## Commit & Pull Request Guidelines
- Use Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`.
- PRs include: problem/approach, affected areas, env keys used, screenshots or a short clip of the voice flow, and verification steps.
- Keep PRs focused (<300 changed lines); separate refactors from features.

## Architecture Overview (ExamBot)
- Flow (see IDEA.md): Admin creates exam + rubric → stored (Supabase) → Learner starts voice exam → STT transcript → LLM asks/assesses → scores + feedback → PDF export.
- Keep secrets server-side (server actions/route handlers); never expose non‑public keys to the client.

## Security & Configuration Tips
- Store secrets in `.env.local`; `.env*` is gitignored. Never commit audio samples with PII.
- Only use `NEXT_PUBLIC_*` for non‑sensitive values. Validate file uploads and limit size/type. Consider basic rate limiting for APIs.

## Agent‑Specific Instructions
- Use `pnpm`. Run `pnpm lint` and `pnpm build` before requesting review.
- Prefer minimal, scoped diffs. Avoid reformatting unrelated files.
- Update this guide and `README.md` if you add modules, commands, or env requirements.
