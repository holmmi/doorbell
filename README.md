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

## User login and authentication

Send a JSON request to `POST /api/user/login`:

```json
{
  "email": "user@example.com",
  "password": "your registered password"
}
```

A successful login returns HTTP 200 with `{ "token": "..." }`. Tokens use
HS256, expire after one hour, and identify the user through the `sub` claim.
Invalid credential fields return HTTP 400 with validation errors. Unknown
emails and incorrect passwords both return HTTP 401 with
`{ "error": "error.login.invalidCredentials" }`.

Send the token as `Authorization: Bearer <token>` when calling a protected
endpoint. Backend routers can protect individual routes with the
`authenticate` middleware exported from `src/middlewares/authenticate.ts`.
Authenticated handlers receive the string user ID through
`request.auth.userId`. Missing, invalid, and expired tokens return HTTP 401
with `{ "error": "error.authentication.unauthorized" }`.

## Building, linting, and testing

Run `npm run lint` to lint both workspaces, and `npm run build` to build both workspaces.

Run the backend authentication tests from the repository root:

```shell
npm test --workspace=doorbell-backend
```

The tests use Node's test runner with `tsx`, real bcrypt/JWT verification, and
HTTP requests against the Express app. Database queries are mocked, so a
running PostgreSQL database is not required. CI runs these tests alongside
linting and building.

Application Docker images can be built with the following commands, for example:

```shell
docker build -f doorbell-backend/Dockerfile -t doorbell-backend:local .
docker build -f doorbell-frontend/Dockerfile -t doorbell-frontend:local .
```

Both runtime images include `curl` for future container health checks.
