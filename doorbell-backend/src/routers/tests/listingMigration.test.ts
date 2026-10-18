import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

import { PGlite } from '@electric-sql/pglite'

void test('V3 renumbers existing images from 1 and preserves their display order', async () => {
  const db = new PGlite()
  const migrations = new URL('../../../../migrations/', import.meta.url)
  try {
    for (const filename of [
      'V1__init.sql',
      'V2__listing_images_and_readiness.sql',
    ]) {
      await db.exec(await readFile(new URL(filename, migrations), 'utf8'))
    }
    await db.exec(`
      INSERT INTO "user" (first_name, last_name, email, password, role)
        VALUES ('Owner', 'One', 'owner@example.com', 'unused', 'LANDLORD');
      INSERT INTO rental_listing (
        owner_id, monthly_price, square_meters, neighborhood, city,
        available_from, extra_costs, rooms
      ) VALUES
        (1, 1000, 40, 'Kallio', 'Helsinki', '2026-11-01', '', 'STUDIO'),
        (1, 900, 30, 'Other', 'Espoo', '2026-11-01', '', 'STUDIO');
      INSERT INTO rental_listing_image (rental_listing_id, image_path, display_order)
        VALUES (1, 'last.png', 2147483647), (1, 'first.png', 0),
               (1, 'middle.png', 1), (2, 'other.png', 0);
    `)
    await db.exec(
      await readFile(
        new URL('V3__listing_image_updates.sql', migrations),
        'utf8'
      )
    )
    const result = await db.query(`
      SELECT image_path, display_order FROM rental_listing_image
      ORDER BY rental_listing_id, display_order
    `)
    assert.deepEqual(result.rows, [
      { image_path: 'first.png', display_order: 1 },
      { image_path: 'middle.png', display_order: 2 },
      { image_path: 'last.png', display_order: 3 },
      { image_path: 'other.png', display_order: 1 },
    ])
    for (const order of [-1, 0]) {
      await assert.rejects(
        db.query(
          'UPDATE rental_listing_image SET display_order = $1 WHERE id = 2',
          [order]
        ),
        { code: '23514' }
      )
    }
  } finally {
    await db.close()
  }
})
