import pg from 'pg';
import { CONFIG } from '../server/config';

// Singleton Pool Instance
// Pool for Documents (Core Data)
const pool = new pg.Pool({
    host: CONFIG.DB.HOST,
    user: CONFIG.DB.USER,
    password: CONFIG.DB.PASSWORD,
    database: CONFIG.DB.NAME,
    port: CONFIG.DB.PORT,
    max: 20,
    idleTimeoutMillis: 30000,
});
console.log(`[DB] Document Pool initialized with DB: ${CONFIG.DB.NAME}`);

// Pool for Authentication (User Data)
const authPool = new pg.Pool({
    host: CONFIG.DB.HOST,
    user: CONFIG.DB.USER,
    password: CONFIG.DB.PASSWORD,
    database: CONFIG.DB.AUTH_NAME,
    port: CONFIG.DB.PORT,
    max: 10,
    idleTimeoutMillis: 30000,
});
console.log(`[DB] Auth Pool initialized with DB: ${CONFIG.DB.AUTH_NAME}`);

pool.on('error', (err) => {
    console.error('Unexpected error on idle document client', err);
});

authPool.on('error', (err) => {
    console.error('Unexpected error on idle auth client', err);
});

export const dbPromise = (text: string, params?: any[]) => pool.query(text, params);
export const getClient = () => pool.connect();
export const getAuthClient = () => authPool.connect();

export default pool;
