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

### Starting the development servers

Start database, S3Mock and Flyway:

```shell
docker compose up -d
```

PostgreSQL is available at `localhost:5432`. Flyway waits for PostgreSQL to
become healthy, then applies the migrations from `migrations/` before exiting.
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
