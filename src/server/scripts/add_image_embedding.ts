import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

// Direct config
const DB_CONFIG = {
    HOST: process.env.DB_HOST || '10.0.1.159',
    USER: process.env.DB_USER || 'admin',
    PASSWORD: process.env.DB_PASSWORD || 'ปิดไว้นะจ๊ะ',
    NAME: process.env.DB_NAME || 'docsvt',
    PORT: parseInt(process.env.DB_PORT || '30104'),
};

async function migrate() {
    const pool = new pg.Pool({
        host: DB_CONFIG.HOST,
        user: DB_CONFIG.USER,
        password: DB_CONFIG.PASSWORD,
        database: DB_CONFIG.NAME,
        port: DB_CONFIG.PORT,
    });

    try {
        console.log("Migrating document_images table to support Embeddings & Description...");

        // Add embedding and description columns
        await pool.query(`
            ALTER TABLE document_images 
            ADD COLUMN IF NOT EXISTS description TEXT,
            ADD COLUMN IF NOT EXISTS embedding vector(1024);
        `);
        // Note: vector(1024) for bge-m3. If using nornal bge-m3 it IS 1024. 
        // If it was different, we'd need to know. 
        // bge-m3 dense embedding is 1024 dim. 
        // user said "bge3", presuming bge-m3.

        console.log("Columns description and embedding added successfully.");
    } catch (e) {
        console.error("Migration error:", e);
    } finally {
        await pool.end();
        process.exit();
    }
}

migrate();
