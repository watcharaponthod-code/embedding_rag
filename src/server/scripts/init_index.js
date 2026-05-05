
const { getClient } = require('../utils/db');

async function createIndex() {
    const client = await getClient();
    try {
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
        // We can't easily release the singleton pool client in a standalone script without proper teardown,
        // but for a script it's fine to just exit.
        process.exit(0);
    }
}

createIndex();
