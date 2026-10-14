ALTER TABLE rental_listing
    ADD COLUMN published BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE rental_listing_image
    ADD COLUMN display_order INTEGER;

WITH ordered_images AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY rental_listing_id
            ORDER BY id
        ) - 1 AS display_order
    FROM rental_listing_image
)
UPDATE rental_listing_image AS image
SET display_order = ordered_images.display_order
FROM ordered_images
WHERE image.id = ordered_images.id;

ALTER TABLE rental_listing_image
    ALTER COLUMN display_order SET NOT NULL;

CREATE UNIQUE INDEX rental_listing_image_listing_display_order_idx
    ON rental_listing_image (rental_listing_id, display_order);

CREATE UNIQUE INDEX rental_listing_image_listing_image_path_idx
    ON rental_listing_image (rental_listing_id, image_path);
