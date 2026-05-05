
import pool from '../utils/db';

async function runMigration() {
    const client = await pool.connect();
    try {
        console.log('Adding columns project_name and client_name to documents table...');

        await client.query(`
            ALTER TABLE documents 
            ADD COLUMN IF NOT EXISTS project_name TEXT DEFAULT '',
            ADD COLUMN IF NOT EXISTS client_name TEXT DEFAULT '';
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
