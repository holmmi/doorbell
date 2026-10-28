# Copilot instructions

## Repository overview

Doorbell is a small TypeScript monorepo for a Doorbell application. It currently
contains a React 19 frontend built with Vite and an Express 5 backend. The
repository uses npm workspaces:

- `doorbell-frontend/`: Vite/React client. `src/App.tsx` defines the application
  routes; `/login` and `/registration` render outside `AppShell`. Auth forms use
  React Hook Form with Zod via `@hookform/resolvers`; reusable JSON API clients
  and user auth methods live under `src/api/`.
- `doorbell-backend/`: Express server. `src/app.ts` creates and exports the app;
  `src/index.ts` starts it on port 8001.
- Backend user routes live in `src/routers/userRouter.ts` under `/api/user`.
  Registration and login share Zod validation and repository-based SQL.
  `src/middlewares/authenticate.ts` verifies bearer JWTs and exposes
  `request.auth.userId` to protected handlers. `GET /api/user/info` uses it
  to return the current account's public fields, including nullable phone
  and picture path values. A token for a missing account receives HTTP 401.
- `migrations/`: Flyway SQL migrations for the PostgreSQL database.
- `docker-compose.yml`: starts PostgreSQL 18.6 as `db`, Flyway 13.9.0 to
  apply the migrations, and Adobe S3Mock 5.2.3 as `s3mock` on port 9090.
- `doorbell-backend/Dockerfile`: builds and runs the backend on Node 24.21
  Alpine 3.24.
- `doorbell-frontend/Dockerfile`: builds the frontend and serves it with Nginx
  1.31.6 Alpine 3.24.
- The frontend development server uses port 8000 and proxies `/api` to
  `http://localhost:8001` (`doorbell-frontend/vite.config.ts`).

The root project is private, ESM, and requires Node.js >=24 and npm >=11. TypeScript is
used throughout. Generated `dist/` directories and dependencies are ignored;
do not commit them.

## API documentation

API contracts and request/response examples live in `docs/api/`:

- [Users and authentication](../docs/api/users.md): registration, login,
  bearer tokens and current account information under `/api/user`.
- [Rental listings](../docs/api/listings.md): listing creation, retrieval,
  updates, image uploads, publication and cleanup under `/api/listing`.
- [Preferences, applicants and matches](../docs/api/interactions.md): tenant
  preferences, landlord decisions and accepted matches under `/api/listing-interaction`.

Update the relevant guide whenever an endpoint's request fields, responses,
validation rules, authentication requirements or error behavior changes.
Keep API contracts out of `README.md`; its Documentation section should only
link to these guides. Keep README testing guidance general: commands and
prerequisites, without individual test scenarios or implementation details.

Keep frontend translations in sync with all backend translation keys. When
adding or changing an API error key or a custom validation issue key, update
`doorbell-frontend/src/i18n.ts` for every supported language in the same change,
even if the corresponding frontend screen is not implemented yet. Review keys
across controllers, middleware, services, repositories and schemas, including
all possible values of dynamically constructed keys.

## GitHub workflow

Use the GitHub CLI (`gh`) for GitHub operations, including checking CI,
reviewing pull requests, and creating pull requests. Prefer it over the GitHub
connector or browser automation.

Check CLI availability with `gh --version` and authentication with
`gh auth status`. If `gh` is missing from PATH, check its installed location.
Check for an existing pull request before creating one. For multiline PR
descriptions, write the description to a UTF-8 file and pass `--body-file` to
`gh pr create`.

When asked to review a commit and open a PR if it is ready, complete the review
and required checks, then create the PR if there are no blocking findings.
The request already authorizes creating that PR.

## Required validation workflow

Always run commands from the repository root and always run `npm ci` before
building or linting a fresh checkout. The lockfile is authoritative.

```sh
npm ci
npm run lint
npm test --workspace=doorbell-backend
npm run build
```

This is the CI sequence in `.github/workflows/ci.yml` (Ubuntu, Node 24):
checkout, `npm ci`, `npm run lint`, backend tests including Testcontainers
integration tests, then `npm run build`. The workflow runs on
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
`tsc`; its output is `doorbell-backend/dist/`. Backend tests live in
`tests` directories beside the source files under `doorbell-backend/src/`
and run through Node's test runner with `tsx`. The test command first
type-checks both source and tests using `doorbell-backend/tsconfig.json`.
The tests cover JWT configuration, verification, request validation, and
middleware using an isolated Express app.
`src/routers/tests/userInfo.test.ts` also exercises the actual `/api/user/info`
route with isolated test environment variables and a stubbed PostgreSQL
`pool.query`. It loads database configuration but never connects to PostgreSQL,
so that test file requires no running database.
`src/routers/tests/listingAccess.test.ts` exercises listing read access and
draft privacy with stubbed PostgreSQL queries and transaction clients. It
also runs without a database or object storage service.

`src/routers/tests/listing.integration.test.ts` and
`src/routers/tests/listingInteraction.integration.test.ts` run with the other backend
tests through `npm test --workspace=doorbell-backend`. They require a running
Docker-compatible runtime with Linux containers and fail if none is available.
Pinned `@testcontainers/postgresql` and `@testcontainers/s3mock` packages start
disposable PostgreSQL 18.6 and Adobe S3Mock 5.2.3 containers on random ports.
Their shared `src/routers/tests/helpers/integration.ts` fixture applies the
migration SQL files directly, configures the backend before importing it, and
cleans up containers even after setup/test failures. The suites cover listing
creation, retrieval, updates, image uploads, publication, background cleanup,
preferences, applicants and matches.
Test-only triggers exercise deferred constraint rollback and, with
`pg_blocking_pids`, coordinate concurrent HTTP updates without fixed sleeps.
Each integration suite sets `concurrency: false` so tests sharing its containers
run sequentially; each file has its own containers. Keep the container
image versions aligned with `docker-compose.yml`. No development services or
`.env` are used. S3Mock does not validate presigned URL signatures or expiration.

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
exits after applying pending migrations. S3Mock creates the `doorbell` bucket
automatically, stores data in the `s3mock_data` volume mounted at its writable
`/s3mockroot` path, and exposes its S3-compatible API at
`http://localhost:9090`. Verify it with `docker compose ps s3mock` and
`curl http://localhost:9090/`. Use `docker compose down` to stop the services,
or `docker compose down -v` to also remove the local database and S3Mock
volumes.

Build the application images from the repository root with:

```sh
docker build -f doorbell-backend/Dockerfile -t doorbell-backend:local .
docker build -f doorbell-frontend/Dockerfile -t doorbell-frontend:local .
```

Both runtime images include `curl` for future healthchecks.

## Configuration and conventions

- The backend loads dotenv once at the start of `src/app.ts`, using
  `doorbell-backend/.env` when run through workspace scripts. Set
  `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`,
  `DB_PASSWORD`, `JWT_SECRET`, `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY`,
  `S3_SECRET_KEY`, `S3_BUCKET`, and `S3_FORCE_PATH_STYLE`; database
  configuration and the JWT secret are validated at startup, while object
  storage configuration is validated when an image operation first uses it.
  For local S3Mock, use `S3_ENDPOINT=http://localhost:9090`,
  `S3_REGION=us-east-1`, `S3_ACCESS_KEY=test`, `S3_SECRET_KEY=test`,
  `S3_BUCKET=doorbell`, and `S3_FORCE_PATH_STYLE=true`. `.env` is ignored by
  Git. JWTs use HS256 and a six-hour expiration, with the string user ID in
  `sub`.
- Image object keys are generated by the backend and use separate namespaces:
  `listings/{listingId}/{uuid}.{extension}` for listing images and
  `users/{userId}/{uuid}.{extension}` for profile pictures. Only PNG, JPG, and
  JPEG uploads are supported by the current image service. Publication requires
  at least one image to be finalized successfully.
- Listing updates use complete basic details and an optional complete `images`
  set. Omitting `images` preserves it; an empty set unpublishes. The listing GET
  and PUT responses include sorted images and computed readiness. Published
  listings can be read by anyone; unpublished listings require their current
  landlord owner. Writes remain restricted to the current landlord owner. See
  `docs/api/listings.md` for the API contract and request examples.
- All listing mutations lock the parent row in a transaction. Migration V3
  makes image order uniqueness deferrable for safe swaps, records issued uploads
  for finalization, and adds a durable storage cleanup queue. Uploads expire
  after 24 hours. `src/services/imageCleanupService.ts` starts with the backend
  and retries cleanup every minute; removed images have a 15-minute grace
  period and storage failures retry after five minutes.
- The backend depends on the pinned AWS SDK S3 client and presigner packages;
  update `package-lock.json` whenever those dependencies change.
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
