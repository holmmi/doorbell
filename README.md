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

Database:

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

The backend loads PostgreSQL and JWT settings from
`doorbell-backend/.env`. Create the `.env` file with the following
content in the root of `doorbell-backend` directory to use the local
development database:

```dotenv
DB_HOST=localhost
DB_PORT=5432
DB_NAME=doorbell
DB_USER=doorbell
DB_PASSWORD=doorbell
JWT_SECRET=
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

## Building, linting, and testing

Run `npm run lint` to lint both workspaces, and `npm run build` to build both workspaces.

Run the backend tests from the repository root:

```shell
npm test --workspace=doorbell-backend
```

Application Docker images can be built with the following commands, for example:

```shell
docker build -f doorbell-backend/Dockerfile -t doorbell-backend:local .
docker build -f doorbell-frontend/Dockerfile -t doorbell-frontend:local .
```

Both runtime images include `curl` for future container health checks.
