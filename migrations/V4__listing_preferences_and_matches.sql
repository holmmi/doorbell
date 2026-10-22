-- Legacy matches imply acceptance. Refuse contradictory data rather than
-- rewriting a tenant's browsing history or silently dropping a match.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM "match" m
        JOIN rental_listing l ON l.id = m.rental_listing_id
        JOIN "user" tenant ON tenant.id = m.tenant_user_id
        JOIN "user" landlord ON landlord.id = m.landlord_user_id
        LEFT JOIN rental_listing_preference p
          ON p.tenant_user_id = m.tenant_user_id
         AND p.rental_listing_id = m.rental_listing_id
        WHERE l.owner_id <> m.landlord_user_id
           OR tenant.role <> 'TENANT' OR landlord.role <> 'LANDLORD'
           OR p.liked = FALSE
    ) OR EXISTS (
        SELECT 1 FROM "match"
        GROUP BY tenant_user_id, rental_listing_id HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Cannot migrate contradictory legacy matches';
    END IF;
END $$;

ALTER TABLE rental_listing_preference
    ADD CONSTRAINT rental_listing_preference_like_key
        UNIQUE (tenant_user_id, rental_listing_id, liked);

CREATE TABLE rental_listing_applicant_decision (
    tenant_user_id BIGINT NOT NULL,
    rental_listing_id BIGINT NOT NULL,
    decision TEXT NOT NULL CHECK (decision IN ('ACCEPTED', 'DECLINED')),
    -- A checked discriminator lets the FK require an actual like.
    liked BOOLEAN NOT NULL DEFAULT TRUE CHECK (liked),
    PRIMARY KEY (tenant_user_id, rental_listing_id),
    UNIQUE (tenant_user_id, rental_listing_id, decision),
    FOREIGN KEY (tenant_user_id, rental_listing_id, liked)
        REFERENCES rental_listing_preference (tenant_user_id, rental_listing_id, liked)
        ON DELETE CASCADE
);

INSERT INTO rental_listing_preference (tenant_user_id, rental_listing_id, liked)
SELECT tenant_user_id, rental_listing_id, TRUE FROM "match"
ON CONFLICT (tenant_user_id, rental_listing_id) DO NOTHING;

INSERT INTO rental_listing_applicant_decision (tenant_user_id, rental_listing_id, decision)
SELECT tenant_user_id, rental_listing_id, 'ACCEPTED' FROM "match";

ALTER TABLE rental_listing ADD CONSTRAINT rental_listing_owner_key UNIQUE (id, owner_id);

ALTER TABLE "match"
    ADD COLUMN created_at TIMESTAMPTZ,
    ADD COLUMN decision TEXT NOT NULL DEFAULT 'ACCEPTED' CHECK (decision = 'ACCEPTED'),
    ADD CONSTRAINT match_tenant_listing_key UNIQUE (tenant_user_id, rental_listing_id),
    ADD CONSTRAINT match_accepted_decision_fk
        FOREIGN KEY (tenant_user_id, rental_listing_id, decision)
        REFERENCES rental_listing_applicant_decision (tenant_user_id, rental_listing_id, decision)
        ON DELETE CASCADE,
    ADD CONSTRAINT match_listing_owner_fk
        FOREIGN KEY (rental_listing_id, landlord_user_id)
        REFERENCES rental_listing (id, owner_id)
        ON DELETE CASCADE;

-- The original creation time is unknown; all legacy rows use migration time.
UPDATE "match" SET created_at = CURRENT_TIMESTAMP;
ALTER TABLE "match"
    ALTER COLUMN created_at SET NOT NULL,
    ALTER COLUMN created_at SET DEFAULT clock_timestamp();

CREATE INDEX match_tenant_created_at_idx
    ON "match" (tenant_user_id, created_at DESC, rental_listing_id DESC);
CREATE INDEX rental_listing_preference_applicants_idx
    ON rental_listing_preference (rental_listing_id, tenant_user_id) WHERE liked;
