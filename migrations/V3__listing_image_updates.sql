-- Defer uniqueness only during a complete image-set update, allowing swaps.
DROP INDEX rental_listing_image_listing_display_order_idx;

ALTER TABLE rental_listing_image
    ADD CONSTRAINT rental_listing_image_listing_display_order_key
        UNIQUE (rental_listing_id, display_order) DEFERRABLE INITIALLY IMMEDIATE,
    ADD CONSTRAINT rental_listing_image_display_order_check
        CHECK (display_order >= 0);

-- Only keys issued by the backend can be finalized. Uploads are staged for
-- 24 hours and do not change the currently committed image set.
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
