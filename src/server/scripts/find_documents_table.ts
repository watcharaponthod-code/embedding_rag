import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const config = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
};

async function checkTable(dbName: string, tableName: string) {
    const pool = new pg.Pool({ ...config, database: dbName });
    const client = await pool.connect();
    try {
        console.log(`\n--- [${dbName}] Table: ${tableName} ---`);
        const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = $1;
        `, [tableName]);

        if (res.rows.length === 0) {
            console.log(`Table '${tableName}' not found in database '${dbName}'.`);
        } else {
            console.table(res.rows);
        }
    } catch (err: any) {
        console.error(`Error checking ${dbName}.${tableName}:`, err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

async function run() {
    // Try both docsvt and docvt names to be sure
    await checkTable('docsvt', 'documents');
    await checkTable('docvt', 'documents');
    await checkTable('sycapt_chatai', 'documents');
    process.exit();
}

run();
