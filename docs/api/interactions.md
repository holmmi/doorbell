# Preferences, applicants and matches

These endpoints use `Authorization: Bearer <access-token>`. Preferences and
matches require a current `TENANT` account; applicant operations require a
current `LANDLORD` account that owns the listing. Acting account IDs always come
from authentication, not request bodies or query parameters.

All successful requests return HTTP 200, including identical POST retries.
Invalid path IDs return HTTP 400.

## Record a preference

`POST /api/listing-interaction/42/preference`

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

`GET /api/listing-interaction/42/applicants`

```json
[
  {
    "tenantId": "9",
    "firstName": "Ada",
    "lastName": "Tenant"
  }
]
```

Only likes without a landlord decision appear, ordered by tenant ID. No
applicants returns `[]`; the frontend can use the array length for a count.
Owners can read applicants while unpublished.

Tenant contact details and passwords are not exposed. Profile images, age,
occupation and introduction can be added when profile management supports them.
Profile images will use presigned URLs.

## Accept or decline an applicant

`POST /api/listing-interaction/42/applicants/9/decision`

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
decisions remove the applicant from the pending list.

Identical retries succeed without changing the original match timestamp.
Reversing a decision returns 409. Competing requests serialize on the listing:
the first committed decision wins, and an opposing decision returns 409.
Database failures roll back the entire operation so the request can be retried.

## Retrieve tenant matches

`GET /api/listing-interaction/matches`

```json
[
  {
    "createdAt": "2026-10-21T12:30:00.000Z",
    "listing": {
      "id": "42",
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

`createdAt` is the match creation timestamp in UTC ISO format. The listing
summary contains the fields used by the Matches view and its details dialog:
ID, rent, area, location, availability, extra costs, room type, publication status
and photos. Prices and area are decimal strings. Listing images are ordered by
`displayOrder`, with presigned URLs valid for 900 seconds.
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
