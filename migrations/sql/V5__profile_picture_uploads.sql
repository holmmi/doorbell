-- Keep abandoned uploads discoverable even if the account is deleted.
CREATE TABLE user_picture_upload (
    object_key TEXT PRIMARY KEY,
    user_id BIGINT REFERENCES "user"(id) ON DELETE SET NULL,
    content_type TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (clock_timestamp() + INTERVAL '24 hours')
);

CREATE INDEX user_picture_upload_expires_at_idx ON user_picture_upload (expires_at);

-- The existing durable image cleanup queue also handles profile pictures.
-- Use wall-clock time so a long-running save cannot shorten the upload grace period.
ALTER TABLE listing_image_cleanup ALTER COLUMN available_after
    SET DEFAULT (clock_timestamp() + INTERVAL '15 minutes');
