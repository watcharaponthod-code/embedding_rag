-- Universal Content Graph Migration Script

-- 1. Content Nodes (Base Table)
CREATE TABLE IF NOT EXISTS content_nodes (
  id BIGSERIAL PRIMARY KEY,
  node_type TEXT NOT NULL, -- 'email', 'document', 'image', 'file', 'chunk'
  title TEXT,
  content TEXT,
  content_hash TEXT, -- deduplication
  metadata JSONB DEFAULT '{}',
  
  -- Versioning
  version INTEGER DEFAULT 1,
  parent_version_id BIGINT REFERENCES content_nodes(id),
  
  -- Taxonomy
  project_name TEXT,
  client_name TEXT,
  tags TEXT[],
  
  -- Search & AI
  embedding VECTOR(1024),
  fts TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, ''))
  ) STORED,
  
  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by TEXT,
  
  -- Soft delete
  deleted_at TIMESTAMP,

  UNIQUE(content_hash)
);

CREATE INDEX IF NOT EXISTS idx_content_nodes_type ON content_nodes(node_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_content_nodes_project ON content_nodes(project_name, client_name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_content_nodes_hash ON content_nodes(content_hash) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_content_nodes_fts ON content_nodes USING GIN(fts);
CREATE INDEX IF NOT EXISTS idx_content_nodes_embedding ON content_nodes USING ivfflat(embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_content_nodes_metadata ON content_nodes USING GIN(metadata jsonb_path_ops);


-- 2. Content Relationships (Edges)
CREATE TABLE IF NOT EXISTS content_relationships (
  id BIGSERIAL PRIMARY KEY,
  source_node_id BIGINT NOT NULL REFERENCES content_nodes(id) ON DELETE CASCADE,
  target_node_id BIGINT NOT NULL REFERENCES content_nodes(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL,
  
  metadata JSONB DEFAULT '{}',
  order_index INTEGER,
  strength FLOAT DEFAULT 1.0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(source_node_id, target_node_id, relationship_type)
);

CREATE INDEX IF NOT EXISTS idx_rel_source ON content_relationships(source_node_id, relationship_type);
CREATE INDEX IF NOT EXISTS idx_rel_target ON content_relationships(target_node_id, relationship_type);
CREATE INDEX IF NOT EXISTS idx_rel_type ON content_relationships(relationship_type);


-- 3. Email Attributes
CREATE TABLE IF NOT EXISTS email_attributes (
  node_id BIGINT PRIMARY KEY REFERENCES content_nodes(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  from_address TEXT NOT NULL,
  to_addresses TEXT[] NOT NULL,
  cc_addresses TEXT[],
  bcc_addresses TEXT[],
  reply_to TEXT,
  email_date TIMESTAMP NOT NULL,
  message_id TEXT UNIQUE,
  in_reply_to TEXT,
  thread_id TEXT,
  
  body_text TEXT,
  body_html TEXT,
  body_preview TEXT,
  
  headers JSONB,
  priority TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  is_flagged BOOLEAN DEFAULT FALSE,
  
  n8n_workflow_id TEXT,
  raw_email JSONB
);

CREATE INDEX IF NOT EXISTS idx_email_message_id ON email_attributes(message_id);
CREATE INDEX IF NOT EXISTS idx_email_thread ON email_attributes(thread_id);
CREATE INDEX IF NOT EXISTS idx_email_date ON email_attributes(email_date DESC);


-- 4. File Attributes
CREATE TABLE IF NOT EXISTS file_attributes (
  node_id BIGINT PRIMARY KEY REFERENCES content_nodes(id) ON DELETE CASCADE,
  original_filename TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  file_path TEXT,
  storage_type TEXT DEFAULT 'local',
  storage_url TEXT,
  checksum TEXT,
  
  processing_status TEXT DEFAULT 'pending', 
  extracted_text TEXT,
  extracted_metadata JSONB,
  
  thumbnail_path TEXT,
  preview_available BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_file_type ON file_attributes(file_type);
CREATE INDEX IF NOT EXISTS idx_file_status ON file_attributes(processing_status);


-- 5. Image Attributes
CREATE TABLE IF NOT EXISTS image_attributes (
  node_id BIGINT PRIMARY KEY REFERENCES content_nodes(id) ON DELETE CASCADE,
  image_path TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  format TEXT,
  file_size BIGINT,
  
  description TEXT,
  alt_text TEXT,
  ocr_text TEXT,
  detected_objects JSONB,
  
  page_number INTEGER,
  image_index INTEGER,
  content_id TEXT 
);


-- 6. Processing Jobs
CREATE TABLE IF NOT EXISTS processing_jobs (
  id BIGSERIAL PRIMARY KEY,
  node_id BIGINT REFERENCES content_nodes(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL, 
  status TEXT DEFAULT 'pending',
  progress FLOAT DEFAULT 0.0,
  
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  error_message TEXT,
  
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_jobs_node ON processing_jobs(node_id, job_type);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON processing_jobs(status, job_type);
