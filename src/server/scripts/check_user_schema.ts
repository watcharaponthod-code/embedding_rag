import { getClient } from '../../utils/db';
import dotenv from 'dotenv';
dotenv.config();

async function checkUserInfo() {
    const client = await getClient();
    try {
        console.log("Checking session info...");
        const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'user';
        `);
        console.table(res.rows);
    } catch (err) {
        console.error("Error checking user table:", err);
    } finally {
        client.release();
        process.exit();
    }
}

checkUserInfo();
