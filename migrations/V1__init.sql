CREATE TYPE user_role AS ENUM (
    'LANDLORD',
    'TENANT'
);

CREATE TYPE room AS ENUM (
    'STUDIO',
    'ONE_ROOM_AND_KITCHEN',
    'TWO_ROOMS_AND_KITCHEN',
    'THREE_PLUS_ROOMS'
);

CREATE TABLE "user" (
    id BIGSERIAL PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    password TEXT NOT NULL,
    role user_role NOT NULL,
    picture_path TEXT
);

CREATE TABLE rental_listing (
    id BIGSERIAL PRIMARY KEY,
    owner_id BIGINT NOT NULL,
    created_at DATE NOT NULL DEFAULT CURRENT_DATE,
    monthly_price NUMERIC(10, 2) NOT NULL,
    square_meters NUMERIC(8, 2) NOT NULL,
    neighborhood TEXT NOT NULL,
    city TEXT NOT NULL,
    available_from DATE NOT NULL,
    extra_costs TEXT NOT NULL,
    rooms room NOT NULL,

    CONSTRAINT rental_listing_owner_id_fk
        FOREIGN KEY (owner_id)
        REFERENCES "user"(id)
        ON DELETE CASCADE
);

CREATE TABLE rental_listing_image (
    id BIGSERIAL PRIMARY KEY,
    rental_listing_id BIGINT NOT NULL,
    image_path TEXT NOT NULL,

    CONSTRAINT rental_listing_image_rental_listing_id_fk
        FOREIGN KEY (rental_listing_id)
        REFERENCES rental_listing(id)
        ON DELETE CASCADE
);

CREATE TABLE rental_listing_preference (
    tenant_user_id BIGINT NOT NULL,
    rental_listing_id BIGINT NOT NULL,
    liked BOOLEAN NOT NULL,

    PRIMARY KEY (tenant_user_id, rental_listing_id),

    CONSTRAINT rental_listing_preference_tenant_user_id_fk
        FOREIGN KEY (tenant_user_id)
        REFERENCES "user"(id)
        ON DELETE CASCADE,

    CONSTRAINT rental_listing_preference_rental_listing_id_fk
        FOREIGN KEY (rental_listing_id)
        REFERENCES rental_listing(id)
        ON DELETE CASCADE
);

CREATE TABLE "match" (
    tenant_user_id BIGINT NOT NULL,
    landlord_user_id BIGINT NOT NULL,
    rental_listing_id BIGINT NOT NULL,

    PRIMARY KEY (
        tenant_user_id,
        landlord_user_id,
        rental_listing_id
    ),

    CONSTRAINT match_tenant_user_id_fk
        FOREIGN KEY (tenant_user_id)
        REFERENCES "user"(id)
        ON DELETE CASCADE,

    CONSTRAINT match_landlord_user_id_fk
        FOREIGN KEY (landlord_user_id)
        REFERENCES "user"(id)
        ON DELETE CASCADE,

    CONSTRAINT match_rental_listing_id_fk
        FOREIGN KEY (rental_listing_id)
        REFERENCES rental_listing(id)
        ON DELETE CASCADE
);
