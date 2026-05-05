import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const pool = new pg.Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT || '5432'),
});

async function migrate() {
    const client = await pool.connect();
    try {
        console.log("Checking for 'username' column in 'user' table...");
        const checkRes = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'user' AND column_name = 'username';
        `);

        if (checkRes.rows.length === 0) {
            console.log("Adding 'username' column...");
            await client.query('BEGIN');

            // Add column
            await client.query('ALTER TABLE "user" ADD COLUMN username TEXT;');

            // Populate column using email prefix
            await client.query(`
                UPDATE "user" 
                SET username = split_part(email, '@', 1) 
                WHERE username IS NULL;
            `);

            // Make unique
            await client.query('ALTER TABLE "user" ADD CONSTRAINT user_username_unique UNIQUE (username);');

            await client.query('COMMIT');
            console.log("Column 'username' added and populated successfully.");
        } else {
            console.log("'username' column already exists.");
        }
    } catch (err) {
        console.error("Migration failed:", err);
        if (client) await client.query('ROLLBACK');
    } finally {
        client.release();
        await pool.end();
        process.exit();
    }
}

migrate();
