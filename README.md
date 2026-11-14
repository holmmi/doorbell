# Doorbell

This file includes repository specific instructions. Please keep it up to date.

## Development environment setup

### Prerequisites

The following software and tools are required to run the development environment:

- `Node.js` version 24 or higher
- `NPM` version 11 or higher
- `Docker`

Use [NVM](https://github.com/nvm-sh/nvm) to manage Node versions efficiently.

### Installing dependencies:

```shell
npm ci
```

### Editor configuration

Keep EditorConfig support enabled so the root [`.editorconfig`](.editorconfig)
applies UTF-8 encoding, LF line endings, spaces for indentation and a final
newline to text files, including SQL migrations.

- **VS Code:** install [EditorConfig for VS Code](https://marketplace.visualstudio.com/items?itemName=EditorConfig.EditorConfig).
  For code formatting, install the Prettier extension and use the repository's
  locally installed Prettier and [`.prettierrc`](.prettierrc).
- **WebStorm:** EditorConfig support is built in; keep it enabled and configure
  Prettier to use the repository's local installation and configuration.

The two configurations agree on two-space indentation and LF line endings for
application files. Prettier also adds a final newline. Its existing rules for
quotes, semicolons and trailing commas remain in `.prettierrc`. Explicit
Prettier settings take precedence over values read from EditorConfig; see
[Prettier's EditorConfig documentation](https://prettier.io/docs/configuration#editorconfig).
SQL migrations intentionally use four-space indentation through EditorConfig;
the repository has no Prettier SQL plugin, so Prettier does not format them.

EditorConfig leaves trailing whitespace intact so saving cannot remove
meaningful spaces in string literals or Markdown line breaks. Let Prettier
handle whitespace in the file types it supports. `npm run lint` checks
Prettier formatting for TypeScript files in both workspaces.

### Starting the development servers

Start database, S3Mock and Flyway:

```shell
docker compose up -d
```

PostgreSQL is available at `localhost:5432`. Flyway waits for PostgreSQL to
become healthy, then applies the migrations from `migrations/sql/` before exiting.
Check the migration result with:

```shell
docker compose ps
docker compose logs flyway
```

The Flyway logs should end with a successful migration message. To stop the
services, run `docker compose down`. Add `-v` when stopping if the local
database data should also be removed.

Adobe S3Mock provides the local S3-compatible object store used by the backend.
S3Mock listens on `localhost:9090`, does not require authentication,
and accepts the dummy `test` credentials used by the AWS SDK.

The Compose service creates the `doorbell` bucket automatically with
`COM_ADOBE_TESTING_S3MOCK_STORE_INITIAL_BUCKETS`. To list the buckets through
the S3 API:

```shell
curl http://localhost:9090/
```

S3Mock stores its data in the named `s3mock_data` Docker volume mounted at its
writable `/s3mockroot` directory. The data is retained when the container
stops. To remove the stored objects as well as the containers, use:

```shell
docker compose down -v
```

The backend uses the same S3 client configuration with a production
S3-compatible service. Set `S3_FORCE_PATH_STYLE=false` when the provider does
not require path-style requests.

The backend loads PostgreSQL, JWT and S3 settings from
`doorbell-backend/.env`. Create the `.env` file with the following
content in the root of `doorbell-backend`:

```dotenv
DB_HOST=localhost
DB_PORT=5432
DB_NAME=doorbell
DB_USER=doorbell
DB_PASSWORD=doorbell
DB_SSL=false
JWT_SECRET=
S3_ENDPOINT=http://localhost:9090
S3_REGION=us-east-1
S3_ACCESS_KEY=test
S3_SECRET_KEY=test
S3_BUCKET=doorbell
S3_FORCE_PATH_STYLE=true
```

Generate a secret with the following command, then set `JWT_SECRET` to its
output in `.env`. The backend requires a nonempty secret at startup. Supply
the same environment variable when running the backend Docker image.

```shell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Start frontend:

```shell
npm run dev --workspace=doorbell-frontend
```

Start backend:

```shell
npm run dev --workspace=doorbell-backend
```

## Documentation

- [Users and authentication API](docs/api/users.md)
- [Rental listing API](docs/api/listings.md)
- [Preferences, applicants and matches API](docs/api/interactions.md)

## Building, linting, and testing

Run lint checks, backend tests, and builds from the repository root:

```shell
npm run lint
npm test --workspace=doorbell-backend
npm run build
```

Backend tests require Docker running with Linux container support. Testcontainers
starts isolated PostgreSQL and S3Mock containers and removes them afterward.
Development services and a development `.env` file are not needed. The first run
may take longer while container images download. CI uses the same commands.

On Windows PowerShell, use `npm.cmd` if execution policy blocks `npm.ps1`.

Application Docker images can be built with the following commands, for example:

```shell
docker build -f doorbell-backend/Dockerfile -t doorbell-backend:local .
docker build -f doorbell-frontend/Dockerfile -t doorbell-frontend:local .
```

Both runtime images include `curl` for future container health checks.

## Heroku deployment

Heroku deployment uses [heroku.yml](heroku.yml) with a combined web image and
a separate Flyway release image. The web image builds the frontend, serves it
through Nginx, and runs the backend behind the `/api` reverse proxy.

Create a Heroku app using the container stack and configure these variables in
Heroku. Do not commit them or put them in a Docker build context:

```shell
heroku stack:set container --app YOUR_APP
heroku config:set \
  DB_HOST=... \
  DB_PORT=5432 \
  DB_NAME=... \
  DB_USER=... \
  DB_PASSWORD=... \
  DB_SSL=true \
  JWT_SECRET=... \
  S3_ENDPOINT=https://ACCOUNT_ID.r2.cloudflarestorage.com \
  S3_REGION=auto \
  S3_ACCESS_KEY=... \
  S3_SECRET_KEY=... \
  S3_BUCKET=... \
  S3_FORCE_PATH_STYLE=true \
  FLYWAY_URL=jdbc:postgresql://... \
  FLYWAY_USER=... \
  FLYWAY_PASSWORD=... \
  --app YOUR_APP
```

`S3_ENDPOINT`, `S3_REGION`, and the access credentials are the Cloudflare R2
S3-compatible settings. Use the database provider's SSL parameters in
`FLYWAY_URL` when required. Heroku supplies `PORT` automatically; the web
entrypoint configures both Nginx and the backend for it.

Deploy from the repository root with the Heroku CLI:

```shell
git push heroku main
heroku logs --tail --app YOUR_APP
```

The release phase runs Flyway migrations before the web process starts. A
missing or invalid runtime variable causes startup or release to fail
explicitly. A local `.env` file is not required for the image build or Heroku
deployment: `dotenv` treats it as optional, and Heroku config vars are
available when the processes start. The Docker build also excludes `.env`
files.

After deployment, verify the frontend and API are reachable and exercise an
authenticated image upload to confirm that objects are stored in R2.
