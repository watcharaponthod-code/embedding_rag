import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: 'docsvt',
    port: parseInt(process.env.DB_PORT || '30104'),
});

async function checkSchema() {
    const client = await pool.connect();
    try {
        console.log("--- Schema for 'documents' in 'docsvt' ---");
        const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'documents';
        `);

        if (res.rows.length === 0) {
            console.log("Table 'documents' not found in docsvt. Listing all tables:");
            const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
            console.log(JSON.stringify(tables.rows, null, 2));
        } else {
            console.log(JSON.stringify(res.rows, null, 2));
        }
    } catch (err: any) {
        console.error("Error:", err.message);
    } finally {
        client.release();
        await pool.end();
        process.exit();
    }
}

checkSchema();
