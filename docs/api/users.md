# Users and authentication

All routes are under `/api/user`. Send JSON request bodies with
`Content-Type: application/json`.

| Method | Path                        | Authentication | Purpose                        |
| ------ | --------------------------- | -------------- | ------------------------------ |
| POST   | `/api/user/register`        | Public         | Create an account              |
| POST   | `/api/user/login`           | Public         | Obtain an access token         |
| GET    | `/api/user/info`            | Bearer token   | Read the current account       |
| PATCH  | `/api/user/info`            | Bearer token   | Update the current profile     |
| POST   | `/api/user/picture/presign` | Bearer token   | Stage a profile picture upload |

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
  "picturePath": null,
  "pictureUrl": null
}
```

`id` is a decimal string to preserve PostgreSQL `BIGINT` precision. `role` is
`TENANT` or `LANDLORD`. `phone` and `picturePath` are always present and are
either their stored string values or `null`. `picturePath` is a stored image
object key. The response extends the previous seven-field contract with
`pictureUrl`: a presigned GET URL valid for 900 seconds, or `null` when there is
no picture. Signed URLs are generated for each GET/PATCH response and are never
stored in the database. Fetch `/api/user/info` again to refresh an expired URL;
do not save `pictureUrl` back as `picturePath`.

Legacy references saved before the upload API are preserved on unrelated
updates, but references outside the account's `users/<id>/` namespace or without
a simple PNG/JPG/JPEG filename receive
`pictureUrl: null` and are never deleted by this flow. Replace them using the
upload flow below or clear them with `picturePath: null`.

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
`null` clears the phone number or picture. A new `picturePath` must be an
unexpired, backend-issued staged upload for the authenticated account, verified
in storage before any profile fields are committed. Keeping the currently saved
key unchanged is a no-op for picture finalization; omitting it preserves the
picture. Clearing or replacing a picture queues its old object for deletion
after the database commit. See the complete upload flow below.

Unknown fields are stripped. The token subject exclusively selects the account;
body fields and query parameters cannot select another account or change its
ID, role, email, or password. An empty object or a body containing only unknown
or protected fields returns HTTP 400 with an `errors` array of Zod issues.
Invalid supported fields use the same validation error format.

Success returns HTTP 200 with the updated eight-field object documented for
`GET /api/user/info`. Updates persist and appear in subsequent GET responses.
For example, sending only `{"phone":null}` clears the phone number and preserves
all other account fields.

Missing, invalid or expired tokens and tokens for deleted accounts return
HTTP 401 with `{"error":"error.authentication.unauthorized"}`. Invalid JSON,
including a JSON `null` body, returns HTTP 400 with
`{"error":"error.request.invalid"}`.

## Upload a new or replacement profile picture

Both tenants and landlords use the same flow. Account identity comes exclusively
from the bearer token. There is no user ID or caller-selected destination key
parameter, and listing images and other users' pictures cannot be attached.

1. Request an upload with the API bearer token:

   ```http
   POST /api/user/picture/presign
   Authorization: Bearer <access-token>
   Content-Type: application/json

   {"contentType":"image/png"}
   ```

   Supported MIME types are `image/png`, `image/jpg` and `image/jpeg`. Unknown
   fields are stripped. HTTP 200 returns:

   ```json
   {
     "objectKey": "users/7/8e952879-0e92-4972-841f-940603b0ead3.png",
     "uploadUrl": "https://storage.example.com/bucket/users/7/8e952879-0e92-4972-841f-940603b0ead3.png?<signed-put-query>",
     "expiresIn": 900
   }
   ```

   Each request creates a unique key. The extension is `png`, `jpg` or `jpeg`
   according to the requested MIME type. The signed PUT URL expires after
   900 seconds and binds the agreed `Content-Type` header.

2. PUT the raw file bytes directly to `uploadUrl` with that exact `Content-Type`.
   **Do not forward the API bearer token to storage.** Neither requesting the
   URL nor uploading the bytes changes the saved profile picture. If the PUT
   URL expires, request a new upload and use its new key.

3. Finalize through profile Save, using the stable `objectKey` as `picturePath`:

   ```http
   PATCH /api/user/info
   Authorization: Bearer <access-token>
   Content-Type: application/json

   {"firstName":"Ada","picturePath":"users/7/8e952879-0e92-4972-841f-940603b0ead3.png"}
   ```

   HTTP 200 returns the complete profile:

   ```json
   {
     "id": "7",
     "role": "TENANT",
     "firstName": "Ada",
     "lastName": "Example",
     "email": "ada@example.com",
     "phone": null,
     "picturePath": "users/7/8e952879-0e92-4972-841f-940603b0ead3.png",
     "pictureUrl": "https://storage.example.com/bucket/users/7/8e952879-0e92-4972-841f-940603b0ead3.png?<signed-get-query>"
   }
   ```

   Staged keys may be finalized for 24 hours after presigning, matching listing
   uploads; the PUT URL itself lasts only 15 minutes. Save checks the staging
   record's account, key and expiry, then verifies that the object exists, is
   nonempty and has matching supported MIME metadata. A namespace prefix alone
   is not sufficient. Arbitrary URLs, fabricated keys, expired uploads and
   previously retired keys are rejected. A failed verification or database save
   preserves all previously committed profile fields and leaves an unexpired
   staged upload available for retry. A successful save consumes the staging
   record. Re-sending the currently saved key is permitted.

Display `pictureUrl` directly and refresh it by reading the profile after its
900-second lifetime. To replace the picture, repeat all three steps with a new
upload. To remove it, send `{"picturePath":null}` to PATCH; the response contains
both `picturePath: null` and `pictureUrl: null`.

Retired objects enter the durable cleanup queue in the same transaction as the
profile update and are deleted only after commit, with at least a 15-minute
grace period so outstanding PUT URLs expire first. Abandoned staged uploads
become eligible for cleanup after 24 hours. The backend worker runs at startup
and every minute; failed storage deletions retry after five minutes. Jobs and
staged uploads survive backend restarts. Cleanup failures do not undo successful
saves. Concurrent saves lock the account row, so a retired key cannot be
reattached and the currently referenced picture is not queued for deletion.

## Errors

Request schema validation failures return HTTP 400 with an `errors` array of
Zod issues: `{ "errors": [...] }`. Each issue includes its `code`, `path`
and `message`; additional fields depend on the validation rule. This applies
to missing or invalid registration/login fields, including password limits,
and invalid profile updates or updates without supported changes. Missing or
unsupported presign `contentType` values also use this validation format.

Other errors use `{ "error": "<translation-key>" }`:

| Status | Error                                   | Meaning                                                                                 |
| ------ | --------------------------------------- | --------------------------------------------------------------------------------------- |
| 400    | `error.request.invalid`                 | Invalid JSON body, including a JSON `null` body                                         |
| 401    | `error.login.invalidCredentials`        | Unknown email address or incorrect password                                             |
| 401    | `error.authentication.unauthorized`     | Missing/invalid/expired token or missing account                                        |
| 409    | `error.registration.userAlreadyExists`  | Email address is already registered                                                     |
| 500    | `error.server.unexpected`               | Unexpected server or database failure                                                   |
| 400    | `error.user.picture.invalidKey`         | Key is foreign, fabricated, expired, retired or otherwise not an eligible staged upload |
| 400    | `error.user.picture.invalidObject`      | Uploaded object is empty or its MIME metadata does not match the staged upload          |
| 409    | `error.user.picture.notUploaded`        | The staged object does not yet exist; finish the PUT and retry Save                     |
| 503    | `error.user.picture.storageUnavailable` | Storage verification or URL signing failed; retry later                                 |
