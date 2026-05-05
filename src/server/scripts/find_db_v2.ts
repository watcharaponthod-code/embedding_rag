import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const config = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
};

async function testConnection(dbName: string) {
    console.log(`\nTesting connection to: ${dbName}`);
    const pool = new pg.Pool({ ...config, database: dbName });
    try {
        const client = await pool.connect();
        console.log(`Successfully connected to ${dbName}`);

        const res = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public';
        `);
        console.log(`Tables in ${dbName}:`, res.rows.map(r => r.table_name).join(', '));

        // If documents table exists, show its columns
        if (res.rows.some(r => r.table_name === 'documents')) {
            const colRes = await client.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'documents';
            `);
            console.log(`Columns of 'documents' in ${dbName}:`);
            console.table(colRes.rows);
        }

        client.release();
    } catch (err: any) {
        console.error(`Failed to connect to ${dbName}: ${err.message}`);
    } finally {
        await pool.end();
    }
}

async function run() {
    await testConnection('sycapt_chatai');
    await testConnection('docvt');
    await testConnection('docsvt');
    process.exit();
}

run();
