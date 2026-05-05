
import pool from '../utils/db';

async function runMigration() {
    const client = await pool.connect();
    try {
        console.log('Adding column description to documents table...');

        await client.query(`
            ALTER TABLE documents 
            ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
        `);

        console.log('Column description added successfully.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration();
