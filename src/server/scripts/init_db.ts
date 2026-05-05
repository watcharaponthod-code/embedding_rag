import fs from 'fs';
import path from 'path';
import { getClient } from '../utils/db';
import { CONFIG } from '../../config';

const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');

const initDb = async () => {
    console.log('Using Config:', {
        host: CONFIG.DB.HOST,
        db: CONFIG.DB.NAME
    });

    const client = await getClient();
    try {
        console.log('Reading schema file...');
        const schemaWrapper = fs.readFileSync(schemaPath, 'utf8');

        console.log('Executing schema...');
        await client.query(schemaWrapper);

        console.log('✅ Database initialized successfully.');
    } catch (err) {
        console.error('❌ Error initializing database:', err);
        process.exit(1);
    } finally {
        client.release();
        process.exit(0);
    }
};

initDb();
