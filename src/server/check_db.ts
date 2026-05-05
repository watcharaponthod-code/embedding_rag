
import { getClient } from './utils/db';

async function checkDocs() {
    const client = await getClient();
    try {
        console.log("--- Checking Documents ---");
        const res = await client.query("SELECT id, document_name, created_at FROM documents ORDER BY created_at DESC LIMIT 10");
        console.table(res.rows);

        if (res.rows.length > 0) {
            const lastDocId = res.rows[0].id;
            console.log(`\n--- Checking Chunks for Doc ID ${lastDocId} (${res.rows[0].document_name}) ---`);
            const chunkRes = await client.query("SELECT id, left(content, 100) as preview FROM document_chunks WHERE doc_id = $1 LIMIT 5", [lastDocId]);
            console.table(chunkRes.rows);
        }
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        process.exit(0);
    }
}

checkDocs();
