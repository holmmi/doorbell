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

Application images:

```shell
docker build -f doorbell-backend/Dockerfile -t doorbell-backend:local .
docker build -f doorbell-frontend/Dockerfile -t doorbell-frontend:local .
```

Both runtime images include `curl` for future container health checks.

Frontend:

```shell
npm run dev --workspace=doorbell-frontend
```

Backend:

```shell
npm run dev --workspace=doorbell-backend
```

## Building and linting

Run `npm run lint` to lint both workspaces, and `npm run build` to build both workspaces.
