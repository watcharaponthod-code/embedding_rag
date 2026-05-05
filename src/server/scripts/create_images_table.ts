import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

// Direct config to avoid import issues
const DB_CONFIG = {
    HOST: process.env.DB_HOST || '10.0.1.159',
    USER: process.env.DB_USER || 'admin',
    PASSWORD: process.env.DB_PASSWORD || 'ปิดไว้นะจ๊ะ',
    NAME: process.env.DB_NAME || 'docsvt',
    PORT: parseInt(process.env.DB_PORT || '30104'),
};

async function createTable() {
    // Direct connection without import
    const pool = new pg.Pool({
        host: DB_CONFIG.HOST,
        user: DB_CONFIG.USER,
        password: DB_CONFIG.PASSWORD,
        database: DB_CONFIG.NAME,
        port: DB_CONFIG.PORT,
    });

    try {
        console.log("Creating document_images table...");
        await pool.query(`
            CREATE TABLE IF NOT EXISTS document_images (
                id SERIAL PRIMARY KEY,
                doc_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
                page_number INTEGER DEFAULT 1,
                image_index INTEGER,
                image_path TEXT,
                description TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log("Table created successfully.");
    } catch (e) {
        console.error("Error creating table:", e);
    } finally {
        await pool.end();
        process.exit();
    }
}

createTable();
