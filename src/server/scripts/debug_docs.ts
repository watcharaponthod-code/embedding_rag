
import { getClient } from '../../utils/db';
import dotenv from 'dotenv';
dotenv.config();

async function checkDocs() {
    const client = await getClient();
    try {
        console.log("Checking documents table...");

        // Check ALL documents to see what we have
        const res = await client.query(`
            SELECT id, document_name, file_type 
            FROM documents 
            LIMIT 20
        `);

        console.table(res.rows);

        // Check specifically for what looks like an image but has UNKNOWN type
        const imgRes = await client.query(`
            SELECT id, document_name, file_type 
            FROM documents 
            WHERE (file_type IS NULL OR file_type = 'UNKNOWN')
            AND (document_name ILIKE '%.jpg' OR document_name ILIKE '%.png')
        `);
        console.log("\nPotential Matches (that should have updated):", imgRes.rows.length);
        if (imgRes.rows.length > 0) console.table(imgRes.rows);

    } catch (e) {
        console.error(e);
    } finally {
        client.release();
    }
}

checkDocs();
