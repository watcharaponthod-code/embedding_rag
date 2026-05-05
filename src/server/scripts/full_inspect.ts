import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const config = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
};

async function inspect(dbName: string) {
    console.log(`\n=== INSPECTING DATABASE: ${dbName} ===`);
    const pool = new pg.Pool({ ...config, database: dbName });
    const client = await pool.connect();
    try {
        const tablesRes = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        const tables = tablesRes.rows.map(r => r.table_name);
        console.log(`Tables: ${tables.join(', ')}`);

        for (const table of tables) {
            console.log(`\n--- TABLE: ${table} ---`);
            const colsRes = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1", [table]);
            colsRes.rows.forEach(col => {
                console.log(`Column: ${col.column_name} (${col.data_type})`);
            });
        }
    } catch (err: any) {
        console.error(`Error in ${dbName}:`, err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

async function run() {
    await inspect('sycapt_chatai');
    await inspect('docsvt');
    process.exit();
}

run();
