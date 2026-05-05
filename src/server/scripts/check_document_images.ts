
import { getClient } from '../../utils/db';

async function checkDocumentImages() {
    let client;
    try {
        client = await getClient();
        console.log("Connected to database.");

        const res = await client.query(`
            SELECT id, doc_id, image_index, description, embedding 
            FROM document_images 
            ORDER BY id DESC 
            LIMIT 5
        `);

        if (res.rows.length === 0) {
            console.log("No images found in document_images table.");
            return;
        }

        console.log(`Found ${res.rows.length} recent images:`);
        for (const row of res.rows) {
            let embeddingStatus = "NULL";
            let vectorLength = 0;

            if (row.embedding) {
                // Check if it's a string representation of a vector or the vector itself
                // The DB driver might return it as a string if using pgvector without type parsers, 
                // or as an array/string if it's just a text column.
                // Assuming pgvector or text array logic from ingestionService: `[${vector.join(',')}]`

                try {
                    const cleanVector = row.embedding.replace('[', '').replace(']', '');
                    const vector = cleanVector.split(',').map(Number);
                    vectorLength = vector.length;
                    embeddingStatus = `Present (Length: ${vectorLength})`;
                } catch (e) {
                    embeddingStatus = `Present (Raw: ${row.embedding.substring(0, 20)}...)`;
                }
            }

            console.log(`ID: ${row.id} | Page: ${row.page_number} | DocID: ${row.doc_id} | Index: ${row.image_index}`);
            console.log(`   Description: ${row.description ? row.description.substring(0, 50) + '...' : 'NONE'}`);
            console.log(`   Embedding: ${embeddingStatus}`);
            console.log('---------------------------------------------------');
        }

    } catch (err) {
        console.error("Error executing query:", err);
    } finally {
        if (client) client.release();
    }
}

checkDocumentImages();
