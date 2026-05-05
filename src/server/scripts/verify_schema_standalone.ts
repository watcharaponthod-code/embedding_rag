
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

// Load .env explicitly
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'docsvt',
});

async function checkSchema() {
    const client = await pool.connect();
    try {
        console.log('Checking Schema for table "documents"...');

        // Check existing columns
        const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'documents'
    `);

        console.log('Existing Columns:', res.rows.map(r => r.column_name).join(', '));

        const columns = res.rows.map(r => r.column_name);

        // Check specifically for source_id (The Link!)
        if (!columns.includes('source_id')) {
            console.log('❌ "source_id" column is MISSING. This is needed to link email parts together.');
            console.log('Adding "source_id" column now...');

            await client.query(`ALTER TABLE documents ADD COLUMN source_id TEXT;`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_documents_source_id ON documents(source_id);`);

            console.log('✅ "source_id" column ADDED successfully.');
        } else {
            console.log('✅ "source_id" column EXISTS. Metadata linkage is possible.');
        }

    } catch (err: any) {
        console.error('Error:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

checkSchema();
