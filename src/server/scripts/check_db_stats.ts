import * as dotenv from 'dotenv';
import path from 'path';

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { getClient } from '../utils/db';

async function checkStats() {
    console.log('[CheckDB] Connecting to database...');
    let client;
    try {
        client = await getClient();

        const docRes = await client.query('SELECT COUNT(*) FROM documents');
        const chunkRes = await client.query('SELECT COUNT(*) FROM document_chunks');
        const latestDocs = await client.query('SELECT document_name, created_at FROM documents ORDER BY created_at DESC LIMIT 5');

        console.log('\n==========================================');
        console.log('       📊 DATABASE STATISTICS 📊        ');
        console.log('==========================================');
        console.log(`📄 Total Documents:  ${docRes.rows[0].count}`);
        console.log(`🧩 Total Chunks:     ${chunkRes.rows[0].count}`);
        console.log('------------------------------------------');
        console.log('🕒 Latest Documents:');
        if (latestDocs.rows.length === 0) {
            console.log('   (No documents found)');
        } else {
            latestDocs.rows.forEach(d => {
                console.log(`   - ${d.document_name} (${new Date(d.created_at).toLocaleString()})`);
            });
        }
        console.log('==========================================\n');

    } catch (error: any) {
        console.error('❌ Database Check Failed:', error.message);
    } finally {
        if (client) client.release();
        process.exit();
    }
}

checkStats();
