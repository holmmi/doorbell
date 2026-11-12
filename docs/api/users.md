# Users and authentication

All routes are under `/api/user`. Send JSON request bodies with
`Content-Type: application/json`.

| Method | Path                 | Authentication | Purpose                    |
| ------ | -------------------- | -------------- | -------------------------- |
| POST   | `/api/user/register` | Public         | Create an account          |
| POST   | `/api/user/login`    | Public         | Obtain an access token     |
| GET    | `/api/user/info`     | Bearer token   | Read the current account   |
| PATCH  | `/api/user/info`     | Bearer token   | Update the current profile |

## Register

`POST /api/user/register` accepts:

```json
{
  "firstName": "Ada",
  "lastName": "Example",
  "email": "ada@example.com",
  "role": "TENANT",
  "password": "example-password"
}
```

All five fields are required. `firstName` and `lastName` must be nonempty
strings, `email` must be a valid email address, and `role` must be `TENANT`
or `LANDLORD`. The password must contain at least eight characters and at
most 72 UTF-8 bytes. Multibyte characters count toward that byte limit.
Unknown request fields are stripped by the request schema. Registration
leaves `phone` and `picturePath` unset (`null`).

Success returns HTTP 201 with the plain text body `Created`. Log in to obtain
an access token. An email address that is already registered returns HTTP 409
with `{"error":"error.registration.userAlreadyExists"}`.

## Log in

`POST /api/user/login` accepts:

```json
{
  "email": "ada@example.com",
  "password": "example-password"
}
```

Both fields are required strings. `email` must be a valid email address;
`password` must be nonempty and at most 72 UTF-8 bytes. Unknown request fields
are stripped by the request schema.

Success returns HTTP 200:

```json
{
  "token": "<access-token>"
}
```

The access token is an HS256 JWT that expires six hours after it is issued.
Its subject (`sub`) is the account ID as a decimal string. Authenticate
protected requests with:

```http
Authorization: Bearer <access-token>
```

An unknown email address or incorrect password returns HTTP 401 with the same
response: `{"error":"error.login.invalidCredentials"}`.

## Read the current account

`GET /api/user/info` requires a bearer token and accepts either account role.
The token subject selects the account; query parameters and body fields cannot
select a different account. The response reflects the current database values.

Success returns HTTP 200 with this top-level object:

```json
{
  "id": "7",
  "role": "TENANT",
  "firstName": "Ada",
  "lastName": "Example",
  "email": "ada@example.com",
  "phone": null,
  "picturePath": null
}
```

`id` is a decimal string to preserve PostgreSQL `BIGINT` precision. `role` is
`TENANT` or `LANDLORD`. `phone` and `picturePath` are always present and are
either their stored string values or `null`. `picturePath` is a stored image
reference. The response contains only these seven public account fields.

To retrieve the current landlord's published and unpublished listings, use
[`GET /api/listing/mine`](listings.md#my-listings) with the same bearer token.
Listings are not included in the account response.

Missing, invalid or expired tokens return HTTP 401 with
`{"error":"error.authentication.unauthorized"}`. A valid token for an account
that no longer exists returns the same response.

## Update the current profile

`PATCH /api/user/info` requires a bearer token and accepts either account role.
Send a JSON object with at least one of these optional fields:

```json
{
  "firstName": "Ada",
  "lastName": "Lovelace",
  "phone": "+358401234567",
  "picturePath": null
}
```

`firstName` and `lastName` must be nonempty strings. `phone` and `picturePath`
must be nonempty strings or `null`. Omitted fields remain unchanged; explicit
`null` clears the phone number or picture reference. `picturePath` is a stored
image reference; this endpoint does not upload or delete images.

Unknown fields are stripped. The token subject exclusively selects the account;
body fields and query parameters cannot select another account or change its
ID, role, email, or password. An empty object or a body containing only unknown
or protected fields returns HTTP 400 with an `errors` array of Zod issues.
Invalid supported fields use the same validation error format.

Success returns HTTP 200 with the updated seven-field object documented for
`GET /api/user/info`. Updates persist and appear in subsequent GET responses.
For example, sending only `{"phone":null}` clears the phone number and preserves
all other account fields.

Missing, invalid or expired tokens and tokens for deleted accounts return
HTTP 401 with `{"error":"error.authentication.unauthorized"}`. Invalid JSON,
including a JSON `null` body, returns HTTP 400 with
`{"error":"error.request.invalid"}`.

## Errors

Request schema validation failures return HTTP 400 with an `errors` array of
Zod issues: `{ "errors": [...] }`. Each issue includes its `code`, `path`
and `message`; additional fields depend on the validation rule. This applies
to missing or invalid registration/login fields, including password limits,
and invalid profile updates or updates without supported changes.

Other errors use `{ "error": "<translation-key>" }`:

| Status | Error                                  | Meaning                                          |
| ------ | -------------------------------------- | ------------------------------------------------ |
| 400    | `error.request.invalid`                | Invalid JSON body, including a JSON `null` body  |
| 401    | `error.login.invalidCredentials`       | Unknown email address or incorrect password      |
| 401    | `error.authentication.unauthorized`    | Missing/invalid/expired token or missing account |
| 409    | `error.registration.userAlreadyExists` | Email address is already registered              |
| 500    | `error.server.unexpected`              | Unexpected server or database failure            |
