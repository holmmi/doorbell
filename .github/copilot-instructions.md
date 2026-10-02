# Copilot instructions

## Repository overview

Doorbell is a small TypeScript monorepo for a Doorbell application. It currently
contains a React 19 frontend built with Vite and an Express 5 backend. The
repository uses npm workspaces:

- `doorbell-frontend/`: Vite/React client. The current screen is the starter UI
  in `src/App.tsx`; its entry point is `src/main.tsx`.
- `doorbell-backend/`: Express server. `src/app.ts` creates and exports the app;
  `src/index.ts` starts it on port 8001.
- `migrations/`: Flyway SQL migrations for the PostgreSQL database.
- `docker-compose.yml`: starts PostgreSQL 18.6 as `db` and Flyway 13.9.0 to
  apply the migrations.
- The frontend development server uses port 8000 and proxies `/api` to
  `http://localhost:8001` (`doorbell-frontend/vite.config.ts`).

The root project is private, ESM, and requires Node.js >=24 and npm >=11. TypeScript is
used throughout. Generated `dist/` directories and dependencies are ignored;
do not commit them.

## Required validation workflow

Always run commands from the repository root and always run `npm ci` before
building or linting a fresh checkout. The lockfile is authoritative.

```sh
npm ci
npm run lint
npm run build
```

This is the CI sequence in `.github/workflows/ci.yml` (Ubuntu, Node 24):
checkout, `npm ci`, `npm run lint`, then `npm run build`. The workflow runs on
pushes and pull requests. `npm run lint` runs ESLint in both workspaces. The
root build runs the frontend build followed by the backend build. On the
verified environment, install took about 6 seconds, lint passed, and build
passed; the frontend Vite build took less than a second.

Useful narrower checks are:

```sh
npm run typecheck --workspace=doorbell-backend
npm run build --workspace=doorbell-frontend
npm run lint --workspace=doorbell-frontend
npm run lint --workspace=doorbell-backend
```

The frontend build runs `tsc -b` and `vite build`. The backend build runs
`tsc`; its output is `doorbell-backend/dist/`. There is currently no real test
suite. The backend `npm test --workspace=doorbell-backend` is a placeholder
that intentionally prints `Error: no test specified` and exits 1; do not use
it as a passing validation step or add a claim that tests pass.

For a production smoke check, build first, then run these in separate terminals:

```sh
npm run start --workspace=doorbell-backend
npm run preview --workspace=doorbell-frontend
```

The backend prints that it is listening on 8001. It has no `/` route, so
`curl http://localhost:8001/` returning 404 is expected. The frontend preview
serves the built page at `http://localhost:4173/` and should return 200. Stop
both processes after the check. For development, run instead:

```sh
npm run dev --workspace=doorbell-backend
npm run dev --workspace=doorbell-frontend
```

The backend watch process uses `tsx`; the frontend uses Vite. Docker is listed
in the README prerequisites. To start the local database and run migrations,
use:

```sh
docker compose up -d
docker compose ps
docker compose logs flyway
```

Flyway waits for the `db` healthcheck, mounts `migrations/` read-only, and
exits after applying pending migrations. Use `docker compose down` to stop the
services, or `docker compose down -v` to also remove the local database volume.

## Configuration and conventions

- Root `package.json` defines the workspaces and shared `lint`/`build` scripts;
  `package-lock.json` must be updated with dependency changes.
- Root `eslint.config.js` applies type-aware ESLint to both workspaces and
  React-specific rules to frontend TypeScript. It also enables Prettier rules.
- Root `.prettierrc` uses two-space indentation, no semicolons, single quotes,
  and ES5 trailing commas.
- Backend compiler settings are in `doorbell-backend/tsconfig.json` and emit
  declarations/source maps to `dist/`. Frontend compiler settings are split
  between `tsconfig.app.json` and `tsconfig.node.json`, referenced by
  `tsconfig.json`, with strict unused-code checks and no emit.
- Frontend assets are under `doorbell-frontend/src/assets/`; static public
  files are under `doorbell-frontend/public/`.
- Flyway migration files use the `V<version>__<description>.sql` naming
  convention and are mounted from `migrations/` by Docker Compose.
- Before submitting a change, run the CI sequence. If a change affects only
  one workspace, run its narrower lint/build or backend typecheck as a quick
  feedback loop, then still run root lint and build before finishing.

Keep this instructions file up to date whenever the repository layout,
commands, dependencies, tooling, or validation behavior changes.

Trust these instructions and follow the documented commands before searching
the repository. Search only when this file is incomplete or a command/config
has changed and the documented behavior is no longer accurate.
