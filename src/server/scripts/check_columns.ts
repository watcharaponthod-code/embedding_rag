import pool, { getClient } from '../../utils/db.ts';

async function checkColumns() {
    console.log('Checking columns...');
    const client = await getClient();
    try {
        await client.query('SELECT project_name, client_name FROM documents LIMIT 1');
        console.log('Columns exist!');
    } catch (err: any) {
        if (err.message.includes('column "project_name" does not exist')) {
            console.log('Columns MISSING.');
        } else {
            console.error('Error checking:', err.message);
        }
    } finally {
        client.release();
        await pool.end();
    }
}

checkColumns();
