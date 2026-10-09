# Implementation plan: authenticated user information

Implement [issue #12](https://github.com/holmmi/doorbell/issues/12): `GET /api/user/info` returns the account belonging to the authenticated user. Follow the steps below in order, implement the endpoint and tests, run the validation commands, and report the results.

## Baseline and prerequisites

This plan was prepared on 2026-10-09 against commit `c146989b58a4daad1420190204f7081c109a14b1`, on branch `9-backend-user-login`.

- Read `README.md`, `.github/copilot-instructions.md`, and any applicable `AGENTS.md` before implementation. Follow the existing TypeScript, ESM `.js` import, and formatting conventions.
- [Registration #8](https://github.com/holmmi/doorbell/issues/8) is closed. [Login #9](https://github.com/holmmi/doorbell/issues/9) is still open on GitHub, but its implementation is present in this checkout. The implementation base must contain the authentication middleware and JWT utilities described below. Recheck the base before starting; do not recreate #9 within this ticket.
- At planning time, there are existing user changes in `doorbell-frontend/src/App.tsx`, `doorbell-frontend/src/main.tsx`, and `doorbell-frontend/vite.config.ts`, plus an untracked `.idea/` directory. Preserve existing work and inspect `git status --short` again before editing.
- Use Node >=24 and npm >=11. Run commands from the repository root. In this Windows PowerShell environment, use `npm.cmd` because execution policy blocks `npm.ps1`.

The existing request flow is:

`src/app.ts` -> `/api/user` router -> controller -> user repository -> PostgreSQL pool.

`authenticate` verifies a bearer JWT and sets `request.auth = { userId: string }`. It already rejects missing, invalid, and expired tokens with HTTP 401. User IDs remain strings throughout the backend, including JWT subjects, because PostgreSQL `BIGSERIAL` IDs may exceed JavaScript's safe integer range.

## Implementation contract

The ticket does not specify the JSON name of the image reference. Use `picturePath`, following the existing camelCase mapping convention and the database column `picture_path`.

The [maintainer's comment](https://github.com/holmmi/doorbell/issues/12#issuecomment-6018690216) defers image selection to profile management. Both `phone` and `picture_path` already exist as nullable columns in `migrations/V1__init.sql`. Return their stored values now, including explicit `null` for unset values. Registration currently leaves both unset. This requires no migration or profile editing functionality.

Request:

```http
GET /api/user/info
Authorization: Bearer <access-token>
```

HTTP 200 returns this top-level object, without a `user` wrapper:

```json
{
  "id": "9007199254740993",
  "role": "TENANT",
  "firstName": "Ada",
  "lastName": "Example",
  "email": "ada@example.com",
  "phone": null,
  "picturePath": null
}
```

| Field         | Type                                | Source                |
| ------------- | ----------------------------------- | --------------------- |
| `id`          | `string`                            | `"user".id`           |
| `role`        | `UserRole` (`LANDLORD` or `TENANT`) | `"user".role`         |
| `firstName`   | `string`                            | `"user".first_name`   |
| `lastName`    | `string`                            | `"user".last_name`    |
| `email`       | `string`                            | `"user".email`        |
| `phone`       | `string \| null`                    | `"user".phone`        |
| `picturePath` | `string \| null`                    | `"user".picture_path` |

Authentication failures and a valid token whose account no longer exists must return exactly:

```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json
```

```json
{ "error": "error.authentication.unauthorized" }
```

Unexpected repository failures flow to the existing error handler, which returns HTTP 500 with `{ "error": "error.server.unexpected" }`.

Only `request.auth.userId` selects the account. Body fields, query parameters, and additional token claims cannot select an account or determine its role. Read current account fields from the database on every successful request.

## Implementation steps

### 1. Add the public account type

Edit `doorbell-backend/src/types/user.ts`.

Add an exported `UserInfo` interface containing exactly the seven response fields and types in the table above. Reuse `UserRole`. Keep `AuthenticatedUser` as the authentication context containing only `userId`; keep credential types separate from the public response type.

### 2. Add the repository lookup

Edit `doorbell-backend/src/repositories/userRepository.ts`.

Add `findUserInfoById(userId: string): Promise<UserInfo | undefined>` and a query constant using the existing repository style:

```sql
SELECT
  id,
  role,
  first_name AS "firstName",
  last_name AS "lastName",
  email,
  phone,
  picture_path AS "picturePath"
FROM "user"
WHERE id = $1
```

Call `pool.query<UserInfo>(query, [userId])` and return `result.rows[0]`.

- Quote the reserved table name `"user"` and camelCase SQL aliases as shown.
- Bind the original string ID as a parameter; do not interpolate it or convert it to a number.
- Select only the listed columns. The password column must never be loaded by this lookup.
- A missing row returns `undefined`. Allow unexpected database errors to propagate.

### 3. Add the controller

Edit `doorbell-backend/src/controllers/userController.ts`.

Add an exported async `getUserInfo: RequestHandler` with this flow:

1. Read `const userId = request.auth?.userId`.
2. If absent, return the standard authentication 401 JSON and stop. This safely handles the optional `Request.auth` type without a non-null assertion.
3. Call `findUserInfoById(userId)`.
4. If the result is `undefined`, return the same 401 JSON and stop.
5. Return HTTP 200 with a newly constructed object that explicitly assigns `id`, `role`, `firstName`, `lastName`, `email`, `phone`, and `picturePath` from the result.

Use an explicit response allowlist even though the repository already selects safe fields. Do not spread or directly serialize the repository row. This prevents a future repository change from exposing additional fields.

Use the existing Express 5 async error flow and `errorHandler`; avoid catching database failures and converting them into authentication failures.

### 4. Register the protected route

Edit `doorbell-backend/src/routers/userRouter.ts`.

Import `authenticate` and `getUserInfo`, then add:

```ts
userRouter.get('/info', authenticate, getUserInfo)
```

Attach authentication to this route so the existing public login and registration routes retain their behavior. `src/app.ts` already mounts the router at `/api/user`. No request body validation or account ID parameter is needed for this endpoint.

### 5. Add endpoint regression tests

Create `doorbell-backend/test/userInfo.test.ts`. Use the existing Node test runner, strict assertions, Express server lifecycle, and JWT helpers from `test/auth.test.ts`. No additional testing dependency is needed.

Test the actual application and route through HTTP, with only `pool.query` stubbed. This exercises routing, authentication, controller behavior, repository parameter binding, response serialization, and error handling together.

Test setup:

1. Before dynamically importing the application, database configuration, or JWT utilities, set explicit test values for `JWT_SECRET`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD`. Point `DOTENV_CONFIG_PATH` at a nonexistent test file so this test does not load a developer's `.env`.
2. Dynamically import the existing `pool`, `app`, and token helper after setting the environment. Pool construction is lazy; stub `pool.query` before sending any requests. The test suite must not connect to PostgreSQL.
3. Listen on `127.0.0.1` and an ephemeral port, as in `auth.test.ts`.
4. Use `t.mock.method(pool, 'query', ...)` for each test, returning a query result with `rows` and suitable result metadata. Record query arguments and call counts. Keep tests sharing this pool serial and use test-scoped mock restoration.
5. Close the HTTP server and call `pool.end()` during teardown. Keep `auth.test.ts` passing without changing its existing coverage.

Required cases:

| Case                                                           | Expected assertions                                                                                                                                                                                   |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tenant account                                                 | HTTP 200; deep equality with the seven-field account object; role is `TENANT`; one lookup with the authenticated ID.                                                                                  |
| Landlord account                                               | HTTP 200; correct `LANDLORD` role and that account's own details.                                                                                                                                     |
| Nullable profile values                                        | Both `phone` and `picturePath` are present and equal to `null` when unset. This can be covered by either role fixture.                                                                                |
| Populated profile values                                       | Stored phone and image reference are returned unchanged. This can be covered by the other role fixture.                                                                                               |
| Large user ID                                                  | Use `9007199254740993` for a successful case and assert exact string identity in the query parameters and JSON response.                                                                              |
| Another ID in query parameters                                 | Request `/api/user/info?id=<other-id>&userId=<other-id>` with user A's token. Query parameters cannot change the lookup or response to user B.                                                        |
| Another ID in a JSON request body                              | Send a GET with a JSON body containing another `id` and `userId`; the lookup and response still belong to token owner A.                                                                              |
| Missing, malformed, invalid-signature, and expired credentials | Each returns the exact 401 JSON; the database query is never called. Use an already-expired token rather than sleeping.                                                                               |
| Valid token for a nonexistent account                          | Stub an empty result; return the exact 401 JSON, with no account fields.                                                                                                                              |
| Extra private fields in the returned row                       | Deliberately include sentinel `password`, `passwordHash`, and another internal property in a stubbed row. The actual HTTP response still has exactly the seven public fields, and no sentinel values. |
| Database failure                                               | Reject the query; assert the generic 500 response without the internal error text. Stub `console.error` for this test to avoid noisy output.                                                          |

For account isolation tests, use distinct A and B fixture data and ensure a lookup of B would actually return B; this makes an incorrect account selection observable. Assert the parameter array is exactly `[authenticatedUserId]` and the SQL uses `$1`. Review that the query has an explicit column list and does not select `password` or use `SELECT *`.

Node's `fetch` rejects GET requests with bodies. Use `node:http.request` with `method: 'GET'`, `Content-Type: application/json`, and an explicit `Content-Length` for that one test. Wait for and parse the complete response. Use `fetch` for the other cases.

Assert complete JSON objects rather than only status codes or the absence of one password property. Preserve the existing exhaustive JWT verification tests rather than duplicating every JWT variation in the new suite.

### 6. Update API and test documentation

- In `README.md`, document `GET /api/user/info`, bearer authentication, the response example, string IDs, nullable profile fields, and 401 behavior for an account that no longer exists.
- Update `.github/copilot-instructions.md` to include the new protected route and accurately describe the new tests. Its current statement that tests do not load database configuration or mock queries will no longer describe the entire suite. Explain that the endpoint tests supply isolated configuration and stub queries, so automated tests still need no running database.

## Scope

Expected application changes are limited to the four existing type/repository/controller/router files, one new test file, and the two documentation files listed above.

Frontend account restoration, role-based navigation, profile editing, file upload/storage, new authentication mechanisms, token revocation, database migrations, and dependency changes are outside this ticket. Treat `picturePath` as a stored reference; do not introduce URL generation or image serving here.

## Validation

From the repository root, run the documented CI sequence after implementation:

```sh
npm ci
npm run lint
npm test --workspace=doorbell-backend
npm run build
```

Use `npm.cmd` in place of `npm` for all four commands in this Windows PowerShell session. The backend test script already type-checks source and tests before running every `test/*.test.ts` file. No package-script or CI changes should be necessary.

When Docker is available, also perform a local PostgreSQL smoke check to verify the SQL against the actual schema; query stubs cannot verify SQL execution:

1. Run `docker compose up -d`, then confirm a successful migration in `docker compose logs flyway`.
2. Configure and start the backend using the README instructions and a local JWT secret.
3. Register uniquely named disposable tenant and landlord accounts, then log in as each.
4. Call `/api/user/info` with each issued token; verify the correct role, account details, string ID, and null profile values.
5. With user A's token, pass user B's ID in query parameters and confirm the response still belongs to A. Confirm an unauthenticated request returns 401.
6. In the local development database only, delete one disposable account by its exact ID, then retry its existing token and confirm 401. Clean up the remaining disposable account and processes started for the check without deleting the database volume.

If Docker or another prerequisite is unavailable, report the unperformed smoke check explicitly. Report any pre-existing validation failures separately and avoid expanding the ticket to fix unrelated frontend work.

## Completion checklist

- [ ] Both supported roles can retrieve their current account through `/api/user/info`.
- [ ] The response contains exactly the seven defined fields, including nullable profile fields.
- [ ] All account IDs remain strings; only the authenticated ID reaches the parameterized lookup.
- [ ] Missing, invalid, and expired credentials, plus a missing account, receive the standard 401 response.
- [ ] Query/body account IDs cannot select another account.
- [ ] Passwords, hashes, and internal row fields are excluded from responses.
- [ ] Unexpected database failures retain the existing generic 500 behavior.
- [ ] New endpoint tests and existing backend tests pass; root lint and build pass, or concrete blockers are reported.
- [ ] API and repository test documentation reflect the implementation.
- [ ] Final implementation report lists changed files, validation results, and any unperformed checks.
