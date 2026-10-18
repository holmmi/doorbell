-- Defer uniqueness only during a complete image-set update, allowing swaps.
DROP INDEX rental_listing_image_listing_display_order_idx;

-- Convert existing positions to start at 1 while preserving each listing's order.
WITH ordered_images AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY rental_listing_id
            ORDER BY display_order, id
        ) AS display_order
    FROM rental_listing_image
)
UPDATE rental_listing_image AS image
SET display_order = ordered_images.display_order
FROM ordered_images
WHERE image.id = ordered_images.id;

ALTER TABLE rental_listing_image
    ADD CONSTRAINT rental_listing_image_listing_display_order_key
        UNIQUE (rental_listing_id, display_order) DEFERRABLE INITIALLY IMMEDIATE,
    ADD CONSTRAINT rental_listing_image_display_order_check
        CHECK (display_order >= 1);

-- Track pending uploads so only keys issued for this listing can be finalized.
-- Presigning inserts the key, listing ID and expected MIME type before the
-- client uploads the file directly to object storage; a row does not prove
-- that the file has been uploaded and does not count as a listing image.
-- Finalization consumes an unexpired row, verifies the stored object, and
-- inserts/updates rental_listing_image in the same transaction. A failure
-- rolls back consumption so the upload can be retried.
-- After 24 hours, cleanup removes unused rows and queues their object keys
-- in listing_image_cleanup to delete abandoned files from object storage.
CREATE TABLE rental_listing_image_upload (
    object_key TEXT PRIMARY KEY,
    rental_listing_id BIGINT NOT NULL
        REFERENCES rental_listing(id) ON DELETE CASCADE,
    content_type TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours')
);

CREATE INDEX rental_listing_image_upload_expires_at_idx
    ON rental_listing_image_upload (expires_at);

-- Storage deletion cannot participate in a PostgreSQL transaction. Retire keys
-- in that transaction and retry deletion after commit. Wait until any original
-- 15-minute upload URL has expired before removing the object.
CREATE TABLE listing_image_cleanup (
    object_key TEXT PRIMARY KEY,
    available_after TIMESTAMPTZ NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '15 minutes')
);

CREATE INDEX listing_image_cleanup_available_after_idx
    ON listing_image_cleanup (available_after);
