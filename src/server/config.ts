import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const CONFIG = {
    COMPANY: {
        NAME: process.env.COMPANY_NAME || 'Sycapt',
    },
    SERVER: {
        PORT: parseInt(process.env.PORT || '3001'),
        TIMEOUT: 600000,
    },
    DB: {
        HOST: process.env.DB_HOST || '10.0.1.159',
        USER: process.env.DB_USER || 'admin',
        PASSWORD: process.env.DB_PASSWORD || 'ปิดไว้นะจ๊ะ',
        NAME: process.env.DB_NAME || 'docsvt',
        AUTH_NAME: process.env.DB_AUTH_NAME || 'sycapt_chatai',
        PORT: parseInt(process.env.DB_PORT || '30104'),
    },
    OLLAMA: {
        HOST: process.env.OLLAMA_HOST || 'http://10.0.2.191:11434',
        MODEL_EMBEDDING: process.env.OLLAMA_MODEL || 'bge-m3',
        MODEL_CHAT: process.env.OLLAMA_CHAT_MODEL || 'gpt-oss:20b',
        MODEL_RERANKER: process.env.OLLAMA_MODEL_RERANKER || 'qllama/bge-reranker-v2-m3:f16',
        MODEL_VISION: process.env.OLLAMA_VISION_MODEL || 'qwen3-vl:2b',
        TIMEOUT_EMBED: 60000,
        TIMEOUT_CHAT: 180000,
        TIMEOUT_RERANK: 60000, // Explicit timeout for reranking
    },
    PATHS: {
        // Centralized Python Path
        PYTHON_EXEC: process.env.PYTHON_PATH || 'C:\\Users\\Watcharapon\\AppData\\Local\\Programs\\Python\\Python311\\python.exe',
        SCRIPTS_DIR: path.resolve(__dirname, 'scripts'),
    },
    PROCESSING: {
        CHUNK_SIZE: 500,
        CHUNK_OVERLAP: 100,
        BATCH_SIZE_EMBED: 1,
    },
    SEARCH: {
        TOP_K_VECTOR: 50,
        TOP_K_FTS: 50,
        RERANK_TOP_K: 12, // Reduced from 20 to prevent timeout
        MAX_CHAT_CONTEXT_DOCS: 15,
        DEFAULT_SEARCH_LIMIT: 5,
        RRF_K_CONSTANT: 60,
        WEIGHT_VECTOR: 1.0,
        WEIGHT_FTS: 1.0,
    }
};
