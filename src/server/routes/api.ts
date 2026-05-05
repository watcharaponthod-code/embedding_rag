import express from "express";
import multer from "multer";
import path from "path";
import { CONFIG } from "../config";
import { ingestionService } from "../services/ingestionService";
import { retrievalService } from "../services/retrievalService";
import { n8nIngestionService } from "../services/n8nIngestionService"; // Import N8N service

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// --- Health Check Endpoint ---
router.get("/health", async (req, res) => {
  try {
    // Check database connection
    const client = await import("../../utils/db").then((m) => m.getClient());
    await client.query("SELECT 1");
    client.release();

    res.status(200).json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      service: "webclient-document-uploader",
      database: "connected"
    });
  } catch (error: any) {
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      service: "webclient-document-uploader",
      database: "disconnected",
      error: error.message
    });
  }
});

// --- Helper: Validate File Signature (Magic Bytes) ---
const validateFileSignature = async (filePath: string): Promise<boolean> => {
  const { open } = await import("fs/promises");
  const handle = await open(filePath, "r");
  const buffer = Buffer.alloc(4);

  try {
    await handle.read(buffer, 0, 4, 0);
  } finally {
    await handle.close();
  }

  const hex = buffer.toString("hex").toUpperCase();

  // Signatures:
  // PDF: 25 50 44 46 (%PDF)
  // JPG: FF D8 FF ...
  // PNG: 89 50 4E 47
  // WEBP: 52 49 46 46 (RIFF) ...
  // OFFICE (ZIP): 50 4B 03 04 (PK..)
  const validSignatures = [
    "25504446", // PDF
    "FFD8FF", // JPG (Partial)
    "89504E47", // PNG
    "52494646", // WEBP
    "504B0304", // Office Open XML (docx, xlsx, pptx)
  ];

  return validSignatures.some((sig) => hex.startsWith(sig));
};

import { logBroadcaster } from "../../utils/logBroadcaster";

// --- System Logs Stream ---
router.get("/logs/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // Send history first
  const history = logBroadcaster.getHistory();
  history.forEach((log) => {
    res.write(`data: ${log}\n\n`);
  });

  const onLog = (logEntry: string) => {
    res.write(`data: ${logEntry}\n\n`);
  };

  const onProgress = (data: any) => {
    // SSE event type: progress
    res.write(`event: progress\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  logBroadcaster.on("log", onLog);
  logBroadcaster.on("progress", onProgress);

  req.on("close", () => {
    logBroadcaster.off("log", onLog);
    logBroadcaster.off("progress", onProgress);
    res.end();
  });
});

// --- Ingestion Routes ---

// N8N Email Ingestion Endpoint
router.post("/ingest/n8n/email", async (req, res) => {
  try {
    // Determine payload (Array vs Object)
    let rawPayload = req.body;
    if (Array.isArray(req.body)) {
      console.log("[N8N API] Received Array Payload. Taking first item.");
      rawPayload = req.body[0];
    }

    console.log("[N8N API] Raw payload keys:", Object.keys(rawPayload || {}));

    // --- SMART PAYLOAD NORMALIZATION ---
    // Handle both Standard Schema and Nested Schema (from n8n auto-map)
    const payload: any = {};

    // 1. Map Email Metadata
    if (rawPayload.email_metadata) {
      payload.email_metadata = rawPayload.email_metadata;
    } else if (rawPayload.metadata?.identity) {
      // Map from nested structure
      const id = rawPayload.metadata.identity;
      payload.email_metadata = {
        subject: id.subject || '(No Subject)',
        from: id.from_address || 'unknown',
        to: id.to_address ? [id.to_address] : [],
        received_date: rawPayload.metadata?.temporal?.sent_at || new Date().toISOString(),
        message_id: `msg_${Date.now()}` // Generate if missing
      };
    }

    // 2. Map Content
    payload.content = rawPayload.content || { body_text: '', body_html: '' };

    // 3. Map Assets
    payload.assets = rawPayload.assets || { attachments: [], inline_images: [] };

    // 4. Map Manual Override / Classification
    if (rawPayload.manual_override) {
      payload.manual_override = rawPayload.manual_override;
    } else if (rawPayload.metadata?.classification) {
      payload.manual_override = {
        project_name: rawPayload.metadata.classification.project_name,
        client_name: rawPayload.metadata.classification.client_name
      };
    } else {
      payload.manual_override = { project_name: 'INBOX_UNCLASSIFIED', client_name: 'UNKNOWN' };
    }

    // 5. Source Info
    payload.source_info = rawPayload.source_info || { workflow: 'n8n-auto' };


    // Validate the *normalized* payload
    if (!payload.email_metadata || !payload.content) {
      console.warn("[N8N API] Normalization failed. keys:", Object.keys(payload));
      return res.status(400).json({ error: "Invalid payload structure", received_keys: Object.keys(rawPayload || {}) });
    }

    const result = await n8nIngestionService.processIncomingEmail(payload);

    if (result.status === 'skipped') {
      return res.status(200).json(result);
    }

    res.status(201).json(result);
  } catch (error: any) {
    console.error("[N8N API] Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post("/upload-v2", upload.single("file"), async (req, res) => {
  req.setTimeout(CONFIG.SERVER.TIMEOUT);
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const filePath = path.resolve(req.file.path);

  try {
    const isValid = await validateFileSignature(filePath);
    if (!isValid) {
      // Security: Delete suspicious file immediately
      const fs = await import("fs");
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return res.status(400).json({
        error: "Invalid file type. Only PDF, Office, and Images are allowed.",
      });
    }

    // Explicitly block Excel files (User Request: Remove Excel completely)
    // if (req.file.originalname.match(/\.(xlsx|xls|csv)$/i)) {
    //   const fs = await import("fs");
    //   if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    //   return res
    //     .status(400)
    //     .json({ error: "Excel files are currently disabled by policy." });
    // }

    const result = await ingestionService.processFile(
      filePath,
      req.file.originalname,
      req.file.mimetype, // Pass mimetype correctly!
      {
        projectName: (req.body.project_name || '').trim(),
        clientName: (req.body.client_name || '').trim(),
        description: (req.body.description || '').trim()
      }
    );
    res.json(result);
  } catch (error: any) {
    // Ensure cleanup on error (e.g. validation failed with exception)
    try {
      const fs = await import("fs");
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[API] Cleaned up file on error: ${filePath}`);
      }
    } catch (cleanupError) {
      console.error(`[API] Failed to delete file ${filePath}:`, cleanupError);
    }
    res.status(500).json({ error: error.message });
  }
});

// --- Retrieval Routes ---
router.post("/search", async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: "Query is required" });

  try {
    // Disable Reranker for Search Page as per user request (issues with short vs long docs)
    const results = await retrievalService.search(
      query,
      50,
      undefined,
      {
        useReranker: false,
        clientName: req.body.clientName,
        projectName: req.body.projectName
      }
    );
    const answer = await retrievalService.generateChatResponse(
      query,
      results.slice(0, 5)
    );

    res.json({
      answer,
      sources: results, // Already ranked by RRF
    });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// --- Duplicate Check Route ---
router.post("/documents/check-duplicate", async (req, res) => {
  const { filename } = req.body;
  if (!filename) return res.status(400).json({ error: "Filename is required" });

  const client = await import("../../utils/db").then((m) => m.getClient());
  try {
    const result = await client.query(
      "SELECT id FROM documents WHERE document_name = $1 LIMIT 1",
      [filename]
    );

    res.json({ exists: result.rows.length > 0 });
  } catch (error: any) {
    console.error("Duplicate check error:", error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

router.post("/chat", async (req, res) => {
  // ... Legacy Non-Streaming Route (Keep for backward compatibility)
  const { query, history } = req.body;
  if (!query) return res.status(400).json({ error: "Query is required" });

  try {
    const results = await retrievalService.search(query, undefined, history);

    const contextDocs = results.slice(0, CONFIG.SEARCH.MAX_CHAT_CONTEXT_DOCS);
    let answer = await retrievalService.generateChatResponse(
      query,
      contextDocs,
      history
    );

    console.log("--- CHAT DEBUG ---");
    // ... (Logs remain same)

    // --- FILTER SOURCES BASED ON LLM CITATION ---
    const processed = retrievalService.processResponseAndSources(
      answer,
      contextDocs
    );
    answer = processed.answer;
    const filteredDocs = processed.sources;
    // ---------------------------------------------

    res.json({
      answer,
      sources: contextDocs.map((d) => {
        const headers = d.metadata?.header_path
          ? d.metadata.header_path.join(" > ")
          : "";
        const page = d.metadata?.page ? `Page ${d.metadata.page}` : "";
        return {
          id: d.doc_id,
          document_name: d.document_name,
          chunk_header: headers || page || "Section",
          content: d.content,
          score: d.score,
        };
      }),
    });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/chat/stream", async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: "Query is required" });

  // Set SSE Headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const results = await retrievalService.search(query);
    const contextDocs = results.slice(0, CONFIG.SEARCH.MAX_CHAT_CONTEXT_DOCS);

    // Send sources first
    const sources = contextDocs.map((d) => {
      const headers = d.metadata?.header_path
        ? d.metadata.header_path.join(" > ")
        : "";
      const page = d.metadata?.page ? `Page ${d.metadata.page}` : "";
      return {
        id: d.doc_id,
        document_name: d.document_name,
        chunk_header: headers || page || "Section",
        content: d.content,
        score: d.score,
      };
    });
    res.write(`data: ${JSON.stringify({ sources })}\n\n`);

    // Stream answer
    await retrievalService.generateChatResponseStream(
      query,
      contextDocs,
      (token) => {
        res.write(`data: ${JSON.stringify({ token })}\n\n`);
      }
    );

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error: any) {
    console.error(error);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

// --- Image Serving Route ---
// --- Image Serving Route ---
router.get("/images/:id", async (req, res) => {
  const { id } = req.params;
  const client = await import("../../utils/db").then((m) => m.getClient());
  try {
    const result = await client.query(
      "SELECT image_data, image_path FROM document_images WHERE id = $1",
      [id]
    );

    if (result.rows.length === 0) return res.status(404).send("Image not found");

    const row = result.rows[0];

    // Priority 1: Serve from DB BLOB
    if (row.image_data) {
      // Simple signature check for PNG vs JPEG
      const buf = row.image_data;
      let mime = "image/png";
      if (buf.length > 3 && buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) {
        mime = "image/jpeg";
      }

      // Log only if needed (verbose) or kept specifically for debugging
      // console.log(`[API] Serving Image ${id} from DB (${buf.length} bytes, ${mime})`);

      res.setHeader("Content-Type", mime);
      res.setHeader("Cache-Control", "public, max-age=31536000"); // Cache forever (immutable ID)
      return res.send(buf);
    }

    // Priority 2: Fallback to File (Legacy)
    if (row.image_path && !row.image_path.startsWith('virtual/')) {
      const fs = await import("fs");
      const fullPath = path.resolve(process.cwd(), row.image_path);
      if (fs.existsSync(fullPath)) {
        return res.sendFile(fullPath);
      }
    }

    res.status(404).send("Image content missing");
  } catch (error) {
    console.error("Error serving image:", error);
    res.status(500).send("Error serving image");
  } finally {
    client.release();
  }
});

// --- Simple Document Fetch (Added for 100% Feature Parity) ---
router.get("/documents/:id", async (req, res) => {
  const { id } = req.params;

  if (!id || id === "undefined" || isNaN(Number(id))) {
    return res.status(400).json({ error: "Invalid ID provided" });
  }

  try {
    const docDetails = await retrievalService.getDocumentDetails(id);
    if (!docDetails) return res.status(404).json({ error: "Not found" });

    res.json(docDetails);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// --- Document Management Routes ---

// List Documents (Pagination + Filter)
// List Documents (Pagination + Filter)
router.get("/documents", async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = (page - 1) * limit;

  const type = ((req.query.type as string) || "ALL").toUpperCase();
  const search = (req.query.search as string) || "";
  const clientName = (req.query.clientName as string) || "";
  const projectName = (req.query.projectName as string) || "";

  const client = await import("../../utils/db").then((m) => m.getClient());

  try {
    let query = `
            SELECT d.id, d.document_name, d.created_at, d.file_type, d.project_name, d.client_name, d.description,
                   (SELECT COUNT(*) FROM document_chunks WHERE doc_id = d.id) as chunk_count
            FROM documents d
            WHERE 1=1 AND d.document_name NOT ILIKE '%.xlsx' AND d.document_name NOT ILIKE '%.xls' AND d.document_name NOT ILIKE '%.csv'
        `;
    const params: any[] = [];
    let paramIndex = 1;

    // Filter by Type
    if (type !== 'ALL') {
      if (type === 'EMAIL') {
        query += ` AND d.file_type = $${paramIndex++}`;
        params.push('EMAIL');
      } else {
        const extMap: Record<string, string[]> = {
          'PDF': ['.pdf'],
          'DOCX': ['.docx', '.doc'],
          'XLSX': ['.xlsx', '.xls', '.csv'],
          'PPTX': ['.pptx', '.ppt']
        };
        const exts = extMap[type];
        if (exts) {
          query += ` AND (`;
          query += exts.map((ext) => {
            params.push(`%${ext}`);
            return `LOWER(d.document_name) LIKE $${paramIndex++}`;
          }).join(' OR ');
          query += `)`;
        }
      }
    }

    // Filter by Search (Filename)
    if (search && search.trim()) {
      query += ` AND d.document_name ILIKE $${paramIndex++}`;
      params.push(`%${search.trim()}%`);
    }

    // Filter by Client
    if (clientName) {
      query += ` AND TRIM(d.client_name) = $${paramIndex++}`;
      params.push(clientName);
    }

    // Filter by Project
    if (projectName) {
      query += ` AND TRIM(d.project_name) = $${paramIndex++}`;
      params.push(projectName);
    }

    // --- COUNT QUERY ---
    // Make a separate count query using similar logic
    let countQuery = `SELECT COUNT(*) FROM documents d WHERE 1=1 AND d.document_name NOT ILIKE '%.xlsx' AND d.document_name NOT ILIKE '%.xls' AND d.document_name NOT ILIKE '%.csv'`;
    const countParams: any[] = [];
    let countParamIndex = 1;

    if (type !== 'ALL') {
      if (type === 'EMAIL') {
        countQuery += ` AND d.file_type = $${countParamIndex++}`;
        countParams.push('EMAIL');
      } else {
        const extMap: Record<string, string[]> = {
          'PDF': ['.pdf'],
          'DOCX': ['.docx', '.doc'],
          'XLSX': ['.xlsx', '.xls', '.csv'],
          'PPTX': ['.pptx', '.ppt']
        };
        const exts = extMap[type];
        if (exts) {
          countQuery += ` AND (`;
          countQuery += exts.map((ext) => {
            countParams.push(`%${ext}`);
            return `LOWER(d.document_name) LIKE $${countParamIndex++}`;
          }).join(' OR ');
          countQuery += `)`;
        }
      }
    }
    if (search && search.trim()) {
      countQuery += ` AND d.document_name ILIKE $${countParamIndex++}`;
      countParams.push(`%${search.trim()}%`);
    }
    if (clientName) {
      countQuery += ` AND TRIM(d.client_name) = $${countParamIndex++}`;
      countParams.push(clientName);
    }
    if (projectName) {
      countQuery += ` AND TRIM(d.project_name) = $${countParamIndex++}`;
      countParams.push(projectName);
    }

    const countRes = await client.query(countQuery, countParams);
    const totalDocs = parseInt(countRes.rows[0].count);

    // Apply Sort, Limit, Offset
    const sortBy = (req.query.sortBy as string) || 'created_at';
    const sortOrder = (req.query.sortOrder as string || 'desc').toUpperCase();

    // Prevent SQL Injection on Sort Column
    const validSortFields: Record<string, string> = {
      'created_at': 'd.created_at',
      'document_name': 'd.document_name',
      'chunk_count': 'chunk_count' // This is an alias, safe to use in ORDER BY if supported by DB (Postgres supports alias in ORDER BY)
    };
    const dbSortField = validSortFields[sortBy] || 'd.created_at';
    const dbSortOrder = ['ASC', 'DESC'].includes(sortOrder) ? sortOrder : 'DESC';

    query += ` ORDER BY ${dbSortField} ${dbSortOrder} LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    const result = await client.query(query, params);

    res.json({
      data: result.rows,
      pagination: {
        page,
        limit,
        totalDocs,
        totalPages: Math.ceil(totalDocs / limit),
      },
    });

  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch documents" });
  } finally {
    client.release();
  }
});

// Update Document
router.put("/documents/:id", async (req, res) => {
  const { id } = req.params;
  const { content, filename, projectName, clientName } = req.body;

  // Lazy load ingestion service to avoid circular dependency issues if any
  const { ingestionService } = await import("../services/ingestionService");

  try {
    await ingestionService.updateDocumentContent(
      id,
      content,
      filename,
      { projectName, clientName }
    );
    res.json({ success: true });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Delete Document
router.delete("/documents/:id", async (req, res) => {
  const { id } = req.params;
  const client = await import("../../utils/db").then((m) => m.getClient());
  try {
    await client.query("BEGIN");

    // Delete Chunks (Cascade usually handles this, but explicit is safer)
    await client.query("DELETE FROM document_chunks WHERE doc_id = $1", [id]);

    // 4. Delete Assoc Images from Disk (Clean up)
    try {
      const imgRes = await client.query("SELECT image_path FROM document_images WHERE doc_id = $1", [id]);
      if (imgRes.rows.length > 0) {
        const fs = await import("fs");
        imgRes.rows.forEach(row => {
          // image_path is relative or absolute? In ingestion it was saved as `uploads/images/...` (relative to root?) 
          // In ingestion: `image_path` in DB was `uploads/images/${imageFilename}`.
          // So we need to resolve it relative to CWD.
          if (row.image_path) {
            const fullPath = path.resolve(process.cwd(), row.image_path);
            if (fs.existsSync(fullPath)) {
              try {
                fs.unlinkSync(fullPath);
              } catch (e) { console.error("Failed to delete image file", fullPath); }
            }
          }
        });
        console.log(`[API] Deleted ${imgRes.rows.length} image files for doc ${id}`);
      }
    } catch (err) {
      console.error("Error cleaning up image files:", err);
    }

    // Delete Document Record
    const delRes = await client.query(
      "DELETE FROM documents WHERE id = $1 RETURNING document_name",
      [id]
    );

    await client.query("COMMIT");

    if (delRes.rowCount === 0) {
      return res.status(404).json({ error: "Document not found" });
    }

    res.json({
      success: true,
      message: `Deleted ${delRes.rows[0].document_name}`,
    });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// --- Batch Operations ---

router.post("/documents/batch/update", async (req, res) => {
  const { ids, clientName, projectName } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "No document IDs provided" });
  }

  const client = await import("../../utils/db").then((m) => m.getClient());

  try {
    await client.query('BEGIN');

    // 1. Update Documents Table
    await client.query(
      `UPDATE documents 
       SET client_name = $1, project_name = $2 
       WHERE id = ANY($3::int[])`,
      [clientName, projectName, ids]
    );

    // 2. Prepare Metadata Update JSON
    const metaUpdate = JSON.stringify({
      client_name: clientName,
      project_name: projectName
    });

    // 3. Update Chunks Metadata
    await client.query(
      `UPDATE document_chunks 
       SET metadata = metadata::jsonb || $1::jsonb 
       WHERE doc_id = ANY($2::int[])`,
      [metaUpdate, ids]
    );

    // 4. Update Images Metadata
    await client.query(
      `UPDATE document_images 
       SET metadata = metadata::jsonb || $1::jsonb 
       WHERE doc_id = ANY($2::int[])`,
      [metaUpdate, ids]
    );

    await client.query('COMMIT');
    res.json({ success: true, count: ids.length });

  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error("Batch Update Error:", error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

router.post("/documents/batch/delete", async (req, res) => {
  const { ids } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "No document IDs provided" });
  }

  const client = await import("../../utils/db").then((m) => m.getClient());

  try {
    await client.query('BEGIN');

    // 1. Delete Chunks
    await client.query(
      `DELETE FROM document_chunks WHERE doc_id = ANY($1::int[])`,
      [ids]
    );

    // 2. Cleanup Images (Files + DB)
    // First get paths to delete files
    try {
      const imgRes = await client.query(
        `SELECT image_path FROM document_images WHERE doc_id = ANY($1::int[])`,
        [ids]
      );

      if (imgRes.rows.length > 0) {
        const fs = await import("fs");
        imgRes.rows.forEach(row => {
          if (row.image_path && !row.image_path.startsWith('virtual/')) {
            const fullPath = path.resolve(process.cwd(), row.image_path);
            if (fs.existsSync(fullPath)) {
              try { fs.unlinkSync(fullPath); } catch (e) { }
            }
          }
        });
      }
    } catch (err) {
      console.warn("Batch delete image cleanup error (non-fatal):", err);
    }

    // Delete Image Records
    await client.query(
      `DELETE FROM document_images WHERE doc_id = ANY($1::int[])`,
      [ids]
    );

    // 3. Delete Documents
    await client.query(
      `DELETE FROM documents WHERE id = ANY($1::int[])`,
      [ids]
    );

    await client.query('COMMIT');
    res.json({ success: true, count: ids.length });

  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error("Batch Delete Error:", error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Get Filter Options (Distinct Clients & Projects)
router.get("/filters/options", async (req, res) => {
  const client = await import("../../utils/db").then((m) => m.getClient());
  try {
    const clientRes = await client.query(`
            SELECT DISTINCT TRIM(client_name) as client_name 
            FROM documents 
            WHERE client_name IS NOT NULL AND TRIM(client_name) <> '' 
            ORDER BY 1
        `);

    const projectRes = await client.query(`
            SELECT DISTINCT TRIM(project_name) as project_name, TRIM(client_name) as client_name 
            FROM documents 
            WHERE project_name IS NOT NULL AND TRIM(project_name) <> '' 
            ORDER BY 1
        `);

    res.json({
      clients: clientRes.rows.map(r => r.client_name),
      projects: projectRes.rows
    });
  } catch (error) {
    console.error("Filter Options Error:", error);
    res.status(500).json({ clients: [], projects: [] });
  } finally {
    client.release();
  }
});

export default router;
