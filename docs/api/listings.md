# Rental listings

For tenant preferences, landlord applicant decisions and tenant matches, see
[Preferences, applicants and matches](interactions.md).

Write routes (`POST` and `PUT`) are under `/api/listing` and require
`Authorization: Bearer <access-token>` from a current `LANDLORD` account.
Missing/invalid authentication returns 401; accounts without the landlord role
return 403. Writes to missing listings or listings owned by another user return
404 with `{"error":"error.listing.notFound"}`. Read access is described below.
IDs are decimal strings to preserve PostgreSQL `BIGINT` precision.

## Listing feed

`GET /api/listing` returns published listings for the swipe experience. Without
an `Authorization` header, it returns at most 2 listings. With a valid bearer
token, it returns at most 10 listings, excludes the current user's own
listings, and excludes every listing with an existing preference for that user,
whether the preference is a like or a dislike. Listings are returned in
ascending ID order.

An invalid bearer token returns HTTP 401. Authenticated requests may use any
valid user role; this endpoint is not restricted to landlords.

Each listing includes its finalized images. `imageUrl` is a pre-signed S3 GET
URL that can be used directly as an HTML image `src`, together with the image
ID and display order. These URLs expire after 900 seconds and must be
requested again when they expire. Internal S3 object keys are not included in
listing responses.

```json
[
  {
    "id": "42",
    "ownerId": "7",
    "createdAt": "2026-10-15",
    "monthlyPrice": "1250.00",
    "squareMeters": "42.50",
    "neighborhood": "Kallio",
    "city": "Helsinki",
    "availableFrom": "2026-11-01",
    "extraCosts": "Water 25 EUR/month",
    "rooms": "ONE_ROOM_AND_KITCHEN",
    "published": true,
    "images": [
      {
        "id": "100",
        "displayOrder": 1,
        "imageUrl": "<pre-signed S3 GET URL>"
      }
    ]
  }
]
```

## Database migration

Apply migration `V3__listing_image_updates.sql` before running the updated
backend (`docker compose run --rm flyway`). Existing finalized images are
preserved and renumbered from 1 in their existing display order; request a new
pre-signed URL for any upload that was started before this migration.

## Create and read

`POST /api/listing` accepts the basic fields below and returns HTTP 201 with
`{"id":"42"}`. Creation requires a current `LANDLORD` account. New listings
are unpublished.

`GET /api/listing/42` returns a published listing to everyone, including
anonymous visitors, tenants and other landlords. Authentication is optional;
send `Authorization: Bearer <access-token>` to also access your own unpublished
listing while your account has the `LANDLORD` role. Missing listings and
unpublished listings that the caller cannot access return HTTP 404 with
`{"error":"error.listing.notFound"}`. An invalid bearer token returns HTTP 401,
even for a published listing. Invalid path IDs return HTTP 400.

The response includes the listing details, computed `ready` state and finalized
images sorted by persisted `displayOrder`, with the same pre-signed image URLs
as the feed. Retrieve the listing again to refresh expired image URLs. Feed
exclusions do not apply to this endpoint: a tenant can retrieve a published
listing by ID even after liking or disliking it.

## Update details

`PUT /api/listing/42` replaces **all editable basic fields**. Required fields
are the same as creation. Omitting `extraCosts` clears it to an empty string.
Omitting `images` preserves the current photos and their order.

```json
{
  "neighborhood": "Kallio",
  "city": "Helsinki",
  "availableFrom": "2026-11-01",
  "rent": 1250,
  "squareMeters": 42.5,
  "rooms": "ONE_ROOM_AND_KITCHEN",
  "extraCosts": "Water 25 EUR/month"
}
```

`neighborhood` and `city` are nonempty strings. `availableFrom` is a real
calendar date in `YYYY-MM-DD` format. `rent` is a number from 0.01 to
99,999,999.99 and `squareMeters` is a number from 0.01 to 999,999.99; PostgreSQL
stores both to two decimal places. `rooms` is one of `STUDIO`,
`ONE_ROOM_AND_KITCHEN`, `TWO_ROOMS_AND_KITCHEN`, or `THREE_PLUS_ROOMS`.
`extraCosts` is an optional string, not `null`.

Both GET and successful PUT return HTTP 200 with this shape:

```json
{
  "id": "42",
  "ownerId": "7",
  "createdAt": "2026-10-15",
  "monthlyPrice": "1250.00",
  "squareMeters": "42.50",
  "neighborhood": "Kallio",
  "city": "Helsinki",
  "availableFrom": "2026-11-01",
  "extraCosts": "Water 25 EUR/month",
  "rooms": "ONE_ROOM_AND_KITCHEN",
  "published": true,
  "ready": true,
  "images": [
    {
      "id": "100",
      "displayOrder": 1,
      "imageUrl": "<pre-signed S3 GET URL>"
    }
  ]
}
```

Numeric database columns are returned as strings. PostgreSQL `DATE` fields such
as `createdAt` and `availableFrom` are returned as `YYYY-MM-DD` strings.
Unknown/protected input fields such as `ownerId`, `published`, `ready` and
`createdAt` are stripped by the request schema.

## Upload a new or replacement photo

1. Request a listing-scoped upload with `POST /api/listing/42/images/presign`:

   ```json
   { "contentType": "image/png" }
   ```

   PNG, JPG and JPEG MIME types are supported. HTTP 200 returns:

   ```json
   {
     "objectKey": "listings/42/5b5792cf-4f5c-4015-b436-fc373616f1ad.png",
     "uploadUrl": "<pre-signed S3 PUT URL>",
     "expiresIn": 900
   }
   ```

2. Upload the actual file bytes to `uploadUrl` using HTTP PUT and the same
   `Content-Type`. Do not send the API bearer token to object storage.

   ```shell
   curl --fail -X PUT '<uploadUrl>' -H 'Content-Type: image/png' --data-binary @photo.png
   ```

3. After the storage PUT succeeds, finalize using either the existing creation
   endpoint or the atomic listing update below. Finalization checks the stored
   object with HEAD: it must exist, be nonempty and have the requested MIME type.
   Keys must have been issued by this backend for this listing, remain unexpired,
   and not already be finalized. MIME metadata is checked; file bytes are not
   decoded. Pre-signing and uploading alone do not change the committed listing.

For an individual addition, `POST /api/listing/42/images` remains supported:

```json
{
  "objectKey": "listings/42/5b5792cf-4f5c-4015-b436-fc373616f1ad.png",
  "displayOrder": 2
}
```

It returns HTTP 201 with `{id, displayOrder, imageUrl}`. The position must be
a positive integer from 1 to 2,147,483,647 and unused. If adding a photo should
also move existing photos, use the atomic PUT instead. A failed finalization
leaves the staged upload available for retry until 24 hours after pre-signing.
Abandoned uploads are then cleaned up.

## Replace, remove and reorder photos atomically

Include `images` in the same `PUT /api/listing/42` body as the basic fields.
This array is the **complete desired image set**:

| Entry                                | Effect                                          |
| ------------------------------------ | ----------------------------------------------- |
| `id` and `displayOrder`              | Retain an existing image and set its order      |
| `objectKey` and `displayOrder`       | Finalize and add a new upload                   |
| `id`, `objectKey` and `displayOrder` | Replace the image's contents, preserving its ID |
| Existing image omitted               | Remove that image                               |
| `images: []`                         | Remove all photos and unpublish                 |
| `images` omitted                     | Preserve all current photos                     |

For example, this keeps image 101 as the first photo, replaces image 100,
adds a third image and removes every other current image:

```json
{
  "neighborhood": "Kallio",
  "city": "Helsinki",
  "availableFrom": "2026-11-01",
  "rent": 1250,
  "squareMeters": 42.5,
  "rooms": "ONE_ROOM_AND_KITCHEN",
  "images": [
    { "id": "101", "displayOrder": 1 },
    {
      "id": "100",
      "objectKey": "listings/42/5b5792cf-4f5c-4015-b436-fc373616f1ad.png",
      "displayOrder": 2
    },
    {
      "objectKey": "listings/42/697ef789-e416-44d5-a202-791e0ff67089.jpeg",
      "displayOrder": 3
    }
  ]
}
```

Request a separate pre-signed URL for each new/replacement photo. Do not send
an existing object key as `objectKey` to retain it; use its `id` instead.
For a reorder alone, send every existing image ID with its new position and
the complete basic details. IDs, keys and orders must each be unique within
the request. Orders must be integers from 1 to 2,147,483,647; gaps are allowed.
The request array's order does not matter. Responses always sort by display order.

Image IDs must be nonempty strings matching an image ID returned for this listing.
Unknown IDs return 404; empty strings and non-string IDs return 400.

The backend locks the listing, verifies every supplied ID and upload, then
commits details and the complete image set in one transaction. A deferred
unique constraint permits swaps without temporary conflicts. A failed object
check, SQL write or commit leaves the old details, photos, publication status
and staged upload records intact. Old objects are queued for cleanup in the
same transaction; storage deletion never runs ahead of that commit.

Concurrent writes to the same listing are serialized. PUT is a replacement
operation without an optimistic revision check; a later accepted request can
overwrite an earlier edit. Fetch the latest listing before constructing an
image-set replacement.

## Readiness and publication

`ready` means the committed listing has at least one finalized photo. A valid
update preserves publication while at least one photo remains. Unpublished
listings remain unpublished, even when they become ready. Explicitly removing
all photos sets both `ready` and `published` to false. Failed replacements
preserve the old photos and publication state. Pending uploads are staged work,
not part of the committed image set, and never count toward readiness.

`POST /api/listing/42/publish` publishes only a ready listing, returning
`{"id":"42","published":true}` with HTTP 200. It shares the listing lock
with updates and finalization so removal of the last photo cannot race
publication. It returns 409 if there are no finalized photos.

## Errors and cleanup

Validation errors return HTTP 400 with the existing `{ "errors": [...] }`
Zod issue array. An image entry without either `id` or `objectKey` produces
a custom issue at `path: ["images", <index>]` whose `message` is the translation
key `error.listing.image.idOrKeyRequired`. The client can translate that key
using its active language. The response field remains `message` even though
the schema uses Zod's `error` option.

Duplicate image IDs, upload keys and positions produce custom issues at
`path: ["images"]`. Their `message` values are, respectively,
`error.listing.image.duplicate.id`, `error.listing.image.duplicate.objectKey`
and `error.listing.image.duplicate.displayOrder`. These are also translation
keys. Zod's `context.addIssue()` uses the `message` property for these issues.

Other expected failures use `{ "error": "<translation-key>" }`:

| Status | Error                                  | Meaning                                                  |
| ------ | -------------------------------------- | -------------------------------------------------------- |
| 400    | `error.request.invalid`                | Invalid path ID or malformed JSON body                   |
| 400    | `error.listing.image.invalidKey`       | Key is foreign, unissued, expired or retired             |
| 400    | `error.listing.image.invalidObject`    | Object is empty or MIME type does not match              |
| 404    | `error.listing.image.notFound`         | Image ID does not belong to this listing                 |
| 409    | `error.listing.image.notUploaded`      | Object is missing from storage                           |
| 409    | `error.listing.image.alreadyFinalized` | Object is already in the listing                         |
| 409    | `error.listing.image.conflict`         | A persisted order or object key conflicts                |
| 409    | `error.listing.images.incomplete`      | Publication requires a finalized photo                   |
| 500    | `error.server.unexpected`              | Unexpected database/storage failure; no update committed |

The backend processes up to 100 queued deletions at startup and every minute.
Removed/replaced objects wait 15 minutes so any original upload URL expires;
failed deletions retry after five minutes. Expired staged uploads are also
queued and removed. S3 deletion is idempotent, and a database failure after
deletion leaves a durable task for retry. Cleanup failure does not undo a
successful listing edit or leave an image record pointing to a deleted object.

The storage credentials need `PutObject`, `HeadObject`/`GetObject`, and
`DeleteObject` permissions for the configured bucket. Keep at least one backend
instance running to process cleanup. Queue entries survive backend restarts.
