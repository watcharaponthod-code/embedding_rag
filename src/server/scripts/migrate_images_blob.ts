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
        console.log("Migrating document_images table to support BLOB storage...");

        // Add image_data column if not exists
        await pool.query(`
            ALTER TABLE document_images 
            ADD COLUMN IF NOT EXISTS image_data BYTEA;
        `);

        console.log("Column image_data added successfully.");
    } catch (e) {
        console.error("Migration error:", e);
    } finally {
        await pool.end();
        process.exit();
    }
}

migrate();
