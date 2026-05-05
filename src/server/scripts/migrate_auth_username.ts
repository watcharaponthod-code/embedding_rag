import { getAuthClient } from '../utils/db';
import dotenv from 'dotenv';
dotenv.config();

async function migrate() {
    console.log("Starting username migration on Auth DB...");
    let client;
    try {
        client = await getAuthClient();
        console.log("Connected to Auth DB. Checking for 'username' column...");

        const checkRes = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'user' AND column_name = 'username';
        `);

        if (checkRes.rows.length === 0) {
            console.log("Adding 'username' column to 'user' table...");
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
            console.log("Migration successful: 'username' column added.");
        } else {
            console.log("'username' column already exists in Auth DB.");
        }
    } catch (err) {
        console.error("Migration failed:", err);
        if (client) await client.query('ROLLBACK');
    } finally {
        if (client) client.release();
        process.exit();
    }
}

migrate();
