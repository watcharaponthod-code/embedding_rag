-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Documents Table
CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    document_name TEXT NOT NULL,
    file_type TEXT DEFAULT 'UNKNOWN',
    project_name TEXT DEFAULT '',
    client_name TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Document Chunks Table
CREATE TABLE IF NOT EXISTS document_chunks (
    id BIGSERIAL PRIMARY KEY,
    doc_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
    content TEXT,
    metadata JSONB,
    fts TSVECTOR,
    embedding vector(1024) 
);

-- Indexes (Optimized for Performance)
-- 1. HNSW Index for Vector Search (Cosine Distance)
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON document_chunks USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- 2. GIN Index for Full-Text Search
CREATE INDEX IF NOT EXISTS idx_chunks_fts ON document_chunks USING GIN (fts);

-- 3. GIN Index for Metadata Filtering
CREATE INDEX IF NOT EXISTS idx_chunks_metadata ON document_chunks USING GIN (metadata);

-- Document Images Table
CREATE TABLE IF NOT EXISTS document_images (
    id SERIAL PRIMARY KEY,
    doc_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
    page_number INTEGER,
    image_index INTEGER,
    image_path TEXT,
    image_data BYTEA,
    description TEXT,
    embedding vector(1024),
    metadata JSONB DEFAULT '{}'::jsonb,
    fts TSVECTOR
);

CREATE INDEX IF NOT EXISTS idx_images_embedding ON document_images USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_images_fts ON document_images USING GIN (fts);
CREATE INDEX IF NOT EXISTS idx_images_metadata ON document_images USING GIN (metadata);





-- 0. เปิดใช้งาน pgvector (สำคัญมากสำหรับ Vector Search)
CREATE EXTENSION IF NOT EXISTS vector;

-- ==========================================
-- 1. [ตารางหลัก] - สำหรับระบบ Core RAG ปัจจุบัน
-- ==========================================

-- ตาราง Documents
CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    document_name TEXT NOT NULL,
    file_type TEXT DEFAULT 'UNKNOWN',
    project_name TEXT DEFAULT '',
    client_name TEXT DEFAULT '',
    source_id TEXT, -- เพิ่มรองรับ ID จากระบบภายนอก
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ตาราง Document Chunks (เก็บเนื้อหาที่ย่อยแล้ว)
CREATE TABLE IF NOT EXISTS document_chunks (
    id BIGSERIAL PRIMARY KEY,
    doc_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
    content TEXT,
    metadata JSONB,
    fts TSVECTOR,
    embedding vector(1024) 
);

-- ตาราง Document Images (เก็บไฟล์รูปและผลวิเคราะห์รูป)
CREATE TABLE IF NOT EXISTS document_images (
    id SERIAL PRIMARY KEY,
    doc_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
    page_number INTEGER,
    image_index INTEGER,
    image_path TEXT,
    image_data BYTEA,
    description TEXT,
    embedding vector(1024),
    metadata JSONB DEFAULT '{}'::jsonb,
    fts TSVECTOR
);

-- Index สำหรับการค้นหาของตารางหลัก
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON document_chunks USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_chunks_fts ON document_chunks USING GIN (fts);
CREATE INDEX IF NOT EXISTS idx_chunks_metadata ON document_chunks USING GIN (metadata);
CREATE INDEX IF NOT EXISTS idx_images_embedding ON document_images USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_images_fts ON document_images USING GIN (fts);

-- ==========================================
-- 2. [ตาราง Graph/Attributes] - ตามรูปภาพระบบใหม่
-- ==========================================

-- ตารางรวมศูนย์ข้อมูล (Nodes)
CREATE TABLE IF NOT EXISTS content_nodes (
    id BIGSERIAL PRIMARY KEY,
    node_type TEXT NOT NULL,
    title TEXT,
    content TEXT,
    content_hash TEXT UNIQUE,
    metadata JSONB DEFAULT '{}',
    embedding VECTOR(1024),
    fts TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, ''))) STORED,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ตารางความสัมพันธ์ (Relationships)
CREATE TABLE IF NOT EXISTS content_relationships (
    id BIGSERIAL PRIMARY KEY,
    source_node_id BIGINT REFERENCES content_nodes(id) ON DELETE CASCADE,
    target_node_id BIGINT REFERENCES content_nodes(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ตารางคุณลักษณะอีเมล
CREATE TABLE IF NOT EXISTS email_attributes (
    node_id BIGINT PRIMARY KEY REFERENCES content_nodes(id) ON DELETE CASCADE,
    subject TEXT,
    from_address TEXT,
    to_addresses TEXT[],
    email_date TIMESTAMP,
    message_id TEXT UNIQUE,
    thread_id TEXT
);

-- ตารางคุณลักษณะไฟล์
CREATE TABLE IF NOT EXISTS file_attributes (
    node_id BIGINT PRIMARY KEY REFERENCES content_nodes(id) ON DELETE CASCADE,
    original_filename TEXT,
    file_type TEXT,
    storage_url TEXT,
    processing_status TEXT DEFAULT 'pending'
);

-- ตารางคุณลักษณะรูปภาพ (ในระบบ Graph)
CREATE TABLE IF NOT EXISTS image_attributes (
    node_id BIGINT PRIMARY KEY REFERENCES content_nodes(id) ON DELETE CASCADE,
    image_path TEXT,
    description TEXT,
    ocr_text TEXT,
    page_number INTEGER
);

-- ตารางจัดการคิวงาน
CREATE TABLE IF NOT EXISTS processing_jobs (
    id BIGSERIAL PRIMARY KEY,
    node_id BIGINT REFERENCES content_nodes(id) ON DELETE CASCADE,
    job_type TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    progress FLOAT DEFAULT 0.0,
    error_message TEXT,
    started_at TIMESTAMP
);


ALTER TABLE documents ADD COLUMN IF NOT EXISTS source_id TEXT;