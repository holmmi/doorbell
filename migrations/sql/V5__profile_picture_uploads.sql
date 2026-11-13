-- The account keeps the selected key after its temporary upload record is consumed.
ALTER TABLE "user" RENAME COLUMN picture_path TO picture_key;

-- Keep abandoned uploads discoverable even if the account is deleted.
CREATE TABLE user_picture_upload (
    object_key TEXT PRIMARY KEY,
    user_id BIGINT,
    content_type TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (clock_timestamp() + INTERVAL '24 hours'),

    CONSTRAINT user_picture_upload_user_id_fk
        FOREIGN KEY (user_id)
        REFERENCES "user"(id)
        ON DELETE SET NULL
);

CREATE INDEX user_picture_upload_expires_at_idx ON user_picture_upload (expires_at);

-- The existing durable image cleanup queue also handles profile pictures.
-- Use wall-clock time so a long-running save cannot shorten the upload grace period.
ALTER TABLE listing_image_cleanup ALTER COLUMN available_after
    SET DEFAULT (clock_timestamp() + INTERVAL '15 minutes');
