# Preferences, applicants and matches

These endpoints use `Authorization: Bearer <access-token>`. Preferences and
matches require a current `TENANT` account; applicant operations require a
current `LANDLORD` account that owns the listing. Acting account IDs always come
from authentication, not request bodies or query parameters.

All successful requests return HTTP 200. Path IDs must be canonical positive
decimal strings, from `1` through `9223372036854775807`. They are never converted
to JavaScript numbers. This applies to the interaction endpoints below; existing
listing management routes retain their documented safe-integer restriction.

## Record a preference

`PUT /api/listing/42/preference`

```json
{ "liked": true }
```

Use `false` for a dislike. The response confirms the saved preference:

```json
{ "listingId": "42", "tenantId": "9", "liked": true }
```

Both likes and dislikes mark the listing as reviewed and exclude it from that
tenant's [listing feed](listings.md#listing-feed). There is one preference per
tenant/listing pair. Repeating the same value succeeds; changing it returns 409.

## Retrieve pending applicants

`GET /api/listing/42/applicants`

```json
{
  "applicants": [
    {
      "tenantId": "9",
      "firstName": "Ada",
      "lastName": "Tenant",
      "picturePath": "profiles/9/avatar.png"
    }
  ],
  "count": 1
}
```

Only likes without a landlord decision appear, ordered by tenant ID. `count`
is the length of this unpaginated result. No applicants returns
`{"applicants":[],"count":0}`. Owners can read applicants while unpublished.

`picturePath` is a stored profile image reference, or `null`, consistent with
the [user information API](users.md). Tenant contact details and passwords are
not exposed. Age, occupation and introduction are omitted because profile
management does not yet support them.

## Accept or decline an applicant

`PUT /api/listing/42/applicants/9/decision`

```json
{ "decision": "ACCEPTED" }
```

The other allowed value is `DECLINED`. The response is:

```json
{ "listingId": "42", "tenantId": "9", "decision": "ACCEPTED" }
```

Only a pending like can receive a new decision. Acceptance saves the decision
and creates exactly one match in a single transaction. Declining saves a
separate decision and preserves the tenant's like and browsing history. Both
decisions remove the applicant from the pending list and update its count.

Identical retries succeed without changing the original match timestamp.
Reversing a decision returns 409. Competing requests serialize on the listing:
the first committed decision wins, and an opposing decision returns 409.
Database failures roll back the entire operation so the request can be retried.

## Retrieve tenant matches

`GET /api/match`

```json
[
  {
    "listingId": "42",
    "createdAt": "2026-10-21T12:30:00.000Z",
    "listing": {
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
    },
    "landlord": {
      "firstName": "Sam",
      "lastName": "Landlord",
      "email": "sam@example.com",
      "phone": null
    }
  }
]
```

Only the authenticated tenant's accepted matches are returned, newest first,
with descending listing ID breaking timestamp ties. No matches returns `[]`.
Pending likes, dislikes and declines never appear. A `tenantId` query parameter
cannot select another tenant's matches.

The outer `createdAt` is the match's creation timestamp in UTC ISO format;
`listing.createdAt` remains the listing's creation date. Listing fields use the
same shape as the feed, including decimal strings for prices and area. Listing
images are ordered by `displayOrder`, with presigned URLs valid for 900 seconds.
Retrieve matches again to refresh expired URLs. Internal listing image object
keys are excluded.

Landlord names and contact details come from the matched listing's landlord.
`phone` is always present and may be `null`. The response includes current
listing and contact information, not a snapshot taken at acceptance.

## Lifecycle

- New preferences and decisions require a published listing with at least one
  finalized image. Pending uploads do not count.
- Identical retries return the saved result even after the listing becomes
  unpublished or loses all images. Ownership and role checks still apply.
- Unpublication stops new interactions, but preserves existing matches and
  contact access. Match responses include `published: false`; images may be empty.
- Accepting one applicant does not reject others or unpublish the listing.
  Multiple tenants can have accepted matches for the same listing.
- A like expresses interest; a match permits contacting the landlord. Neither
  constitutes a rental agreement.
- Preference changes, withdrawal, decision reversal and unmatching are not
  supported in this version.
- Deleting a listing, its owner or a tenant cascades to dependent preferences,
  decisions and matches. These APIs do not add deletion endpoints.

## Errors

Invalid JSON returns `{"error":"error.request.invalid"}`. Body validation uses
the existing Zod envelope, `{"errors":[...]}`. `liked` must be a boolean and
`decision` must be exactly `ACCEPTED` or `DECLINED`; strings such as `"true"` and
`"accepted"` are invalid. Unknown body fields are stripped.

Other failures use `{"error":"<translation-key>"}`:

| Status | Error                                   | Meaning                                                                   |
| ------ | --------------------------------------- | ------------------------------------------------------------------------- |
| 400    | `error.request.invalid`                 | Invalid path ID or malformed JSON                                         |
| 401    | `error.authentication.unauthorized`     | Missing/invalid token or deleted account                                  |
| 403    | `error.authorization.forbidden`         | Incorrect current account role                                            |
| 404    | `error.listing.notFound`                | Missing listing, or another landlord's listing for applicant operations   |
| 404    | `error.listing.applicant.notFound`      | Tenant has no preference for this listing                                 |
| 409    | `error.listing.unavailable`             | New interaction on an unpublished listing or one without finalized images |
| 409    | `error.listing.preference.conflict`     | Attempt to change a saved preference                                      |
| 409    | `error.listing.decision.conflict`       | Attempt to reverse a saved decision                                       |
| 409    | `error.listing.applicant.notInterested` | Attempt to decide a dislike                                               |
| 500    | `error.server.unexpected`               | Unexpected database/storage failure                                       |

## Migration

Apply `V4__listing_preferences_and_matches.sql` before starting this backend:

```shell
docker compose run --rm flyway
```

The migration reuses the preference and match tables, adds landlord decisions
and match timestamps, and enforces one match per tenant/listing. Foreign keys
require decisions to reference likes, matches to reference accepted decisions,
and match landlords to own their listings. Cascading deletion is preserved.

Existing valid matches are preserved as accepted decisions. Missing preferences
are backfilled as likes, and existing likes are retained. Historical match times
are unknown, so legacy matches receive the migration timestamp. New matches use
their database insertion time.

The migration fails without modifying data if legacy matches contradict a
stored dislike, reference the wrong landlord, use incorrect account roles or
duplicate a tenant/listing pair. Resolve such legacy data before retrying;
the migration does not silently discard it or rewrite dislikes.
