import { pool } from '../config/database.js'

export const cleanUpListingImages = async (
  deleteObject: (objectKey: string) => Promise<void>
): Promise<void> => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`
      WITH expired AS (
        DELETE FROM rental_listing_image_upload
        WHERE expires_at <= CURRENT_TIMESTAMP RETURNING object_key
      )
      INSERT INTO listing_image_cleanup (object_key, available_after)
      SELECT object_key, CURRENT_TIMESTAMP FROM expired
      ON CONFLICT DO NOTHING
    `)
    const result = await client.query<{ objectKey: string }>(`
      SELECT object_key AS "objectKey" FROM listing_image_cleanup
      WHERE available_after <= CURRENT_TIMESTAMP
      ORDER BY available_after, object_key
      LIMIT 100 FOR UPDATE SKIP LOCKED
    `)
    for (const { objectKey } of result.rows) {
      try {
        await deleteObject(objectKey)
      } catch (error) {
        console.error('Listing image cleanup failed', {
          error: error instanceof Error ? error.message : String(error),
        })
        await client.query(
          `UPDATE listing_image_cleanup
           SET available_after = CURRENT_TIMESTAMP + INTERVAL '5 minutes'
           WHERE object_key = $1`,
          [objectKey]
        )
        continue
      }
      await client.query(
        'DELETE FROM listing_image_cleanup WHERE object_key = $1',
        [objectKey]
      )
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
