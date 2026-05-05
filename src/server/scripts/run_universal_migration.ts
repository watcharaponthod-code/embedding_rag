import fs from 'fs';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';

import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from root
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

const pool = new pg.Pool({
    host: process.env.DB_HOST || '10.0.1.159',
    user: process.env.DB_USER || 'admin',
    password: process.env.DB_PASSWORD || 'ปิดไว้นะจ๊ะ',
    database: process.env.DB_NAME || 'docsvt',
    port: parseInt(process.env.DB_PORT || '30104'),
    max: 20,
    idleTimeoutMillis: 30000,
});

const getClient = () => pool.connect();


async function runMigration() {
    const client = await getClient();
    try {
        const sqlPath = path.join(__dirname, 'migration_universal_content_graph.sql');
        if (!fs.existsSync(sqlPath)) {
            console.error('Migration file not found:', sqlPath);
            return;
        }

        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Running Universal Content Graph Migration...');
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');
        console.log('Migration completed successfully!');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', error);
    } finally {
        client.release();
    }
}

runMigration().catch(console.error);
