
import pool from '../utils/db.js';

async function runMigration() {
    const client = await pool.connect();
    try {
        console.log('Adding columns metadata and fts to document_images table...');

        await client.query(`
            ALTER TABLE document_images 
            ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
            ADD COLUMN IF NOT EXISTS fts TSVECTOR;
        `);

        // Create index for FTS if it doesn't exist
        await client.query(`
            CREATE INDEX IF NOT EXISTS document_images_fts_idx ON document_images USING GIN (fts);
        `);

        // Create index for metadata gin if needed, but simple jsonb support is enough for now.
        // We might want to query by metadata later.
        await client.query(`
            CREATE INDEX IF NOT EXISTS document_images_metadata_idx ON document_images USING GIN (metadata);
        `);

        console.log('Columns added successfully.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration();
