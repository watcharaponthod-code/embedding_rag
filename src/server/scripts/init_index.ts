
import { getClient } from '../utils/db'; // Singleton

async function createIndex() {
    let client;
    try {
        console.log('Connecting to DB...');
        client = await getClient();
        console.log('Creating HNSW index on document_chunks...');
        await client.query(`
            CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx 
            ON document_chunks 
            USING hnsw (embedding vector_cosine_ops);
        `);
        console.log('Index created successfully.');
    } catch (err) {
        console.error('Error creating index:', err);
    } finally {
        if (client) client.release();
        process.exit(0);
    }
}

createIndex();
