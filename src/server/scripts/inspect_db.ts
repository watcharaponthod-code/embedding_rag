import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT || '5432'),
});

async function checkSchema(tableName: string) {
    const client = await pool.connect();
    try {
        console.log(`--- Schema for '${tableName}' ---`);
        const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = $1;
        `, [tableName]);

        if (res.rows.length === 0) {
            console.log(`Table '${tableName}' not found or has no columns.`);
        } else {
            console.table(res.rows);
        }
    } catch (err) {
        console.error(`Error checking ${tableName}:`, err);
    } finally {
        client.release();
    }
}

async function run() {
    await checkSchema('documents');
    await checkSchema('user');
    await checkSchema('content_nodes');
    await pool.end();
    process.exit();
}

run();
