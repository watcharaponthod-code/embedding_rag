import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const pool = new pg.Pool({
    host: process.env.DB_HOST || '10.0.1.159',
    user: process.env.DB_USER || 'admin',
    password: process.env.DB_PASSWORD || 'ปิดไว้นะจ๊ะ',
    database: process.env.DB_NAME || 'docsvt',
    port: parseInt(process.env.DB_PORT || '30104'),
});

async function restore() {
    console.log('--- Database Restoration Started ---');
    console.log(`Connecting to: ${process.env.DB_HOST} / Database: ${process.env.DB_NAME}`);

    const client = await pool.connect();
    try {
        const schemaPath = path.resolve(__dirname, '../db/schema.sql');
        console.log(`Reading schema from: ${schemaPath}`);

        if (!fs.existsSync(schemaPath)) {
            throw new Error(`Schema file not found at ${schemaPath}`);
        }

        const sql = fs.readFileSync(schemaPath, 'utf8');

        console.log('Executing SQL commands...');
        // We'll run it in a transaction
        await client.query('BEGIN');

        // Split by semicolon if needed, but pg can handle multiple statements in one query
        await client.query(sql);

        await client.query('COMMIT');
        console.log('✅ Database schema restored successfully!');

        // Verify tables
        const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        console.log('Current tables in public schema:', res.rows.map(r => r.table_name).join(', '));

    } catch (err: any) {
        if (client) await client.query('ROLLBACK');
        console.error('❌ Error during restoration:', err.message);
    } finally {
        if (client) client.release();
        await pool.end();
        process.exit();
    }
}

restore();
