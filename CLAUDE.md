# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a document ingestion and vector search application that processes PDF, PPTX, and DOCX files, extracts text and images, generates embeddings, and provides hybrid search (vector + full-text) with RAG-based chat capabilities.

**Stack:**
- Frontend: React 19 + Vite + TypeScript
- Backend: Node.js + Express + TypeScript
- Database: PostgreSQL with pgvector extension
- AI/ML: Ollama for embeddings, chat, reranking, and vision models
- Python: Used for advanced PDF/PPTX extraction (PyMuPDF, python-pptx)

## Development Commands

### Running the Application

```bash
# Install dependencies
npm install

# Install Python dependencies (required for document processing)
pip install torch transformers pymupdf python-pptx

# Run frontend and backend together (recommended)
npm run dev:all

# Run frontend only (Vite dev server on port 5173)
npm run dev

# Run backend only (Express server on port 3001)
npm run server

# Build frontend for production
npm run build

# Preview production build
npm run preview
```

### Database Operations

Database initialization and migration scripts are located in `server/scripts/`:

```bash
# Initialize database schema
npx tsx server/scripts/init_db.ts

# Create vector indexes (pgvector)
npx tsx server/scripts/init_index.ts

# Create images table
npx tsx server/scripts/create_images_table.ts

# Check database statistics
npx tsx server/scripts/check_db_stats.ts

# Migration scripts for schema changes
npx tsx server/scripts/migration_add_columns.ts
npx tsx server/scripts/migration_add_columns_v2.ts
```

## Architecture

### Ingestion Pipeline (server/services/ingestionService.ts)

The ingestion process follows this flow:

1. **File Upload & Validation** (`server/routes/api.ts`):
   - Magic byte validation for security
   - Excel files (.xlsx, .xls, .csv) are explicitly blocked by policy
   - Multer handles file uploads to `uploads/` directory

2. **Text Extraction** (strategy pattern):
   - **PDF**: Python script (`server/scripts/pdf_extractor.py`) using PyMuPDF for marker-based extraction + image extraction
   - **PPTX**: Python script (`server/scripts/pptx_extractor.py`) for text + image extraction
   - **DOCX**: Node.js native parser (`server/services/fileParser.ts`) using mammoth/officeparser

3. **Vision Processing** (`server/services/visionService.ts`):
   - Extracted images are analyzed using Ollama vision model (llava)
   - Vision descriptions are injected into document text as structured metadata
   - Images stored as BLOBs in `document_images` table

4. **Chunking** (`server/utils/textSplitter.ts`):
   - Recursive character-based chunking with configurable size/overlap
   - Default: 500 chars chunk size, 100 chars overlap (CONFIG.PROCESSING)

5. **Embedding Generation** (`server/services/llmService.ts`):
   - Parallel batch processing using Ollama (bge-m3 model by default)
   - Embeddings stored in PostgreSQL with pgvector

6. **Database Storage** (`server/utils/db.ts`):
   - Transaction-based insert: document record → chunks → images
   - Singleton connection pool pattern

### Retrieval Pipeline (server/services/retrievalService.ts)

**Hybrid Search Architecture:**

1. **Query Processing**:
   - Optional query rewriting using chat history context
   - Client/Project filtering support

2. **Dual Search**:
   - Vector Search: pgvector cosine similarity (`<=>` operator)
   - Full-Text Search: PostgreSQL `to_tsvector` / `to_tsquery`
   - Both searches run in parallel

3. **Reciprocal Rank Fusion (RRF)**:
   - Merges vector and FTS results with configurable weights
   - Default: equal weighting (1.0:1.0), K constant = 60

4. **Optional Reranking** (`server/services/llmService.ts`):
   - Uses Ollama reranker model (bge-reranker-v2-m3)
   - **Important**: Disabled for Search page by default (issues with short vs long docs)
   - Enabled for Chat by default

5. **RAG Response Generation**:
   - Top-K chunks used as context for LLM
   - Streaming and non-streaming endpoints available
   - Citation filtering based on LLM response

### Frontend Structure

**Component Organization:**
- `App.tsx`: Main router, view state management
- `components/`: View components (UploadView, SearchView, ChatView, DocumentDetailView, etc.)
- `contexts/UploadContext.tsx`: Global upload state/logs management
- `services/apiService.ts`: API client wrapper
- `types.ts`: Shared TypeScript interfaces

**Key Features:**
- Real-time system logs via Server-Sent Events (SSE)
- Progress tracking during file ingestion
- Client/Project filtering for multi-tenant support
- Document CRUD operations

### Configuration Management

All configuration is centralized in `server/config/index.ts`:

- **Environment Variables** (`.env`): Database credentials, Ollama endpoints, model names
- **Python Path**: Must be configured in `.env` as `PYTHON_PATH` or defaults to hardcoded path
- **Tunable Parameters**: Chunk sizes, search weights, timeout values, batch sizes

### Database Schema

**Core Tables:**
- `documents`: Document metadata (filename, created_at, file_type, project_name, client_name)
- `document_chunks`: Text chunks with embeddings (vector column with pgvector)
- `document_images`: Extracted images (stored as BLOBs + metadata)

**Indexes:**
- Vector index: `ivfflat` on `document_chunks.embedding` (lists=100)
- FTS index: GIN on `to_tsvector(content)`

### Important Patterns & Conventions

1. **Python Integration**: Backend spawns Python subprocesses for PDF/PPTX extraction. Python executable path must be configured correctly in CONFIG.PATHS.PYTHON_EXEC

2. **Singleton DB Connection**: Always use `getClient()` from `server/utils/db.ts` - never create new pools

3. **Error Handling**: All API routes use try-catch with proper transaction rollback and file cleanup

4. **File Cleanup**: Uploaded files are deleted after processing to prevent disk bloat (includes retry logic)

5. **Caching**: Search results are cached with LRU cache (1-hour TTL, max 100 entries)

6. **SSE for Logs**: System uses `logBroadcaster` event emitter for real-time log streaming to frontend

7. **Security**: Magic byte validation prevents malicious file uploads; Excel explicitly blocked by policy

## Configuration Notes

### Ollama Models Required

Ensure these models are available on your Ollama instance:
- `bge-m3`: Embeddings (default)
- `gpt-oss:20b`: Chat responses (default)
- `qllama/bge-reranker-v2-m3:f16`: Reranking
- `llava:latest`: Vision/image analysis

### Environment Variables

Copy `.env` and configure:
- `DB_*`: PostgreSQL connection details
- `OLLAMA_HOST`: Ollama server URL
- `OLLAMA_*_MODEL`: Model names for each task
- `PYTHON_PATH`: Path to Python executable (Windows default: `C:\\Users\\...\\python.exe`)

### Proxy Configuration

Vite dev server proxies `/api` requests to `http://localhost:3001` (backend Express server). Ensure both servers run on correct ports when using `npm run dev:all`.

## Deployment

### CI/CD Pipeline

GitLab CI/CD pipeline configured in `.gitlab-ci.yml`:

**Pipeline Stages:**
1. **Build**: Multi-stage Docker build, pushes to `registry.sycapt.com:32547`
2. **Deploy**: Kubernetes deployment to dev (automatic) or production (manual approval)

**Setup Instructions:** See `GITLAB_CICD_SETUP.md` for detailed configuration steps.

**Required GitLab Variables:**
- `DOCKER_REGISTRY_USER` / `DOCKER_REGISTRY_PASSWORD`: Docker registry credentials
- `KUBE_CONFIG_DEV` / `KUBE_CONFIG_PROD`: Base64-encoded kubeconfig files

### Local Docker Build

Use the provided build scripts for local testing:

```bash
# Linux/Mac
./build-and-push.sh [tag]

# Windows
build-and-push.bat [tag]
```

### Kubernetes

K8s manifests available in `k8s/` directory:

```bash
# Apply manifests
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml

# Or use kustomize
kubectl apply -k k8s/
```

**Important K8s Configuration:**
- Image: `registry.sycapt.com:32547/webclient-document-uploader:latest`
- Service Type: NodePort (port 32001)
- Health endpoint: `/api/health` (used for liveness/readiness probes)
- Image pull secret: `private-registry-secret`

## Troubleshooting

**Python Scripts Failing:**
- Verify `PYTHON_PATH` in `.env` points to correct Python executable
- Ensure Python dependencies installed: `pip install torch transformers pymupdf python-pptx`

**Database Connection Issues:**
- Check PostgreSQL is running and pgvector extension is installed
- Verify `DB_*` credentials in `.env`

**Ollama Timeout:**
- Increase timeout values in `server/config/index.ts` (OLLAMA.TIMEOUT_*)
- Check Ollama server is accessible at configured `OLLAMA_HOST`

**Reranker Issues:**
- Reranking is disabled for search by default (see `server/routes/api.ts:135`)
- Reduce `SEARCH.RERANK_TOP_K` if timeouts occur
