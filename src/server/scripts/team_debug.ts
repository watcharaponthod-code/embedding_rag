import * as dotenv from 'dotenv';
import path from 'path';
import { Pool } from 'pg';

// Setup Environment
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || '10.0.1.159',
    database: process.env.DB_NAME || 'sycapt_vector_db',
    password: process.env.DB_PASSWORD || 'sycapt_vector_db',
    port: parseInt(process.env.DB_PORT || '5432'),
});

async function runTeamDebug() {
    console.log('\n🕵️‍♂️ === TEAM DEBUG REPORT (10 POINTS) === 🕵️‍♂️\n');

    let client;
    try {
        console.log('1. [Connectivity] Attempting to connect to DB...');
        client = await pool.connect();
        console.log('   ✅ Connected successfully to ' + process.env.DB_HOST);

        console.log('2. [Schema] Checking table "documents"...');
        const tableCheck = await client.query(`
            SELECT exists (
                SELECT FROM information_schema.tables 
                WHERE  table_schema = 'public'
                AND    table_name   = 'documents'
            );
        `);
        if (tableCheck.rows[0].exists) {
            console.log('   ✅ Table "documents" exists.');
        } else {
            console.error('   ❌ Table "documents" DOES NOT EXIST! (CRITICAL)');
            return;
        }

        console.log('3. [Schema] Checking columns in "documents"...');
        const colCheck = await client.query(`
             SELECT column_name FROM information_schema.columns WHERE table_name = 'documents';
        `);
        const cols = colCheck.rows.map((r: any) => r.column_name);
        console.log('   ℹ️  Columns found:', cols.join(', '));
        if (!cols.includes('document_name') || !cols.includes('created_at') || !cols.includes('id')) {
            console.error('   ❌ Missing critical columns (id, document_name, created_at)');
        } else {
            console.log('   ✅ Critical columns present.');
        }

        console.log('4. [Data] Counting rows in "documents"...');
        const countRes = await client.query('SELECT COUNT(*) FROM documents');
        const count = parseInt(countRes.rows[0].count);
        console.log(`   ℹ️  Total Documents: ${count}`);

        if (count === 0) {
            console.warn('   ⚠️  Table is empty. This explains "No documents found".');
        } else {
            console.log('   ✅ Data exists.');
        }

        console.log('5. [Data] Sample Data (First 3 rows)...');
        const sampleRes = await client.query('SELECT * FROM documents LIMIT 3');
        console.table(sampleRes.rows);

        console.log('6. [Logic] Simulating API Query (Step 1: Count)...');
        // This matches the exact logic in api.ts
        const queryCount = `
            SELECT COUNT(*) FROM (
                SELECT id, document_name, created_at, 
                   (SELECT COUNT(*) FROM document_chunks WHERE doc_id = documents.id) as chunk_count
                FROM documents
                WHERE 1=1
            ) as sub
        `;
        const simCount = await client.query(queryCount);
        console.log(`   ℹ️  API Count Query returned: ${simCount.rows[0].count}`);

        console.log('7. [Logic] Simulating API Query (Step 2: Fetch Data)...');
        const queryFetch = `
            SELECT id, document_name, created_at, 
                   (SELECT COUNT(*) FROM document_chunks WHERE doc_id = documents.id) as chunk_count
            FROM documents
            WHERE 1=1
            ORDER BY created_at DESC LIMIT 50 OFFSET 0
        `;
        const simFetch = await client.query(queryFetch);
        console.log(`   ℹ️  API Fetch Query returned ${simFetch.rows.length} rows.`);

        console.log('8. [Consistency] Checking document_chunks orphans...');
        const orphanCheck = await client.query('SELECT COUNT(*) FROM document_chunks WHERE doc_id NOT IN (SELECT id FROM documents)');
        console.log(`   ℹ️  Orphan chunks (chunks with no parent doc): ${orphanCheck.rows[0].count}`);

        console.log('\n✅ CHECK COMPLETE. Please analyze the output above.');

    } catch (error: any) {
        console.error('\n❌ FATAL ERROR DURING DIAGNOSTICS:');
        console.error(error);
    } finally {
        if (client) client.release();
        await pool.end();
    }
}

runTeamDebug();
