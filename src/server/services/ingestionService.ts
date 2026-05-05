import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { CONFIG } from '../config';
import { getEmbedding } from './llmService';
import { recursiveChunking } from '../../utils/textSplitter';
import { getClient } from '../../utils/db'; // Singleton
import { visionService } from './visionService';
import { logBroadcaster } from '../../utils/logBroadcaster';
import { parseFile } from './fileParser';

const execAsync = promisify(exec);

export class IngestionService {

    async processFile(
        filePath: string,
        filename: string,
        mimeType: string = 'application/octet-stream',
        metadata: { projectName: string; clientName: string; description?: string; sourceId?: string } = { projectName: '', clientName: '' },
        externalImages: string[] = [] // New parameter for attached images (e.g. from Email)
    ) {
        let client;
        try {
            console.log(`[Ingest] Processing ${filename} (${mimeType})...`);

            let full_text = "";
            let images: string[] = [];

            // 1. Extraction Strategy
            if (filename.toLowerCase().endsWith('.pdf')) {
                // PDF Strategy: Use Python for advanced marker & image extraction
                console.log('[Ingest] Using Python PDF Extractor...');
                const result = await this.extractTextWithMarker(filePath);
                full_text = result.full_text;
                images = result.images || [];
            } else if (filename.toLowerCase().endsWith('.pptx')) {
                // PPTX Strategy: Use Python for text & image extraction (Vision support)
                console.log('[Ingest] Using Python PPTX Extractor...');
                const result = await this.extractPptxWithPython(filePath);
                full_text = result.full_text;
                images = result.images || [];
            } else if (filename.toLowerCase().endsWith('.docx')) {
                // DOCX Strategy: Use Python for text & image extraction (Vision support)
                console.log('[Ingest] Using Python DOCX Extractor...');
                try {
                    const result = await this.extractDocxWithPython(filePath);
                    full_text = result.full_text;
                    images = result.images || [];
                } catch (pyErr: any) {
                    console.warn('[Ingest] Python DOCX processing failed (likely missing dependencies), falling back to native parser...', pyErr.message);
                    full_text = await parseFile(filePath, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
                }
            } else if (['png', 'jpg', 'jpeg', 'webp'].includes(filename.split('.').pop()?.toLowerCase() || '')) {
                // Direct Image Strategy
                console.log('[Ingest] Processing single image file...');
                const imageBuffer = fs.readFileSync(filePath);
                const base64Image = imageBuffer.toString('base64');
                images = [base64Image];
                full_text = "Image File"; // Placeholder, will be enriched with description
            } else {
                // Office/Other Strategy: Use Node.js Text Parsers
                console.log('[Ingest] Using Native Text Parser...');
                full_text = await parseFile(filePath, mimeType);
            }

            // Merge external images (e.g. email attachments)
            if (externalImages && externalImages.length > 0) {
                console.log(`[Ingest] Merging ${externalImages.length} external images...`);
                images = [...images, ...externalImages];
            }

            // 2. Vision Processing
            const rawText = full_text; // Capture raw text before enrichment
            logBroadcaster.broadcastProgress({ stage: 'Vision', progress: 0, message: 'Checking for images...' });
            const visionResult = await this._enrichContentWithVision(full_text, images);
            full_text = visionResult.enrichedText;
            const imageDescriptions = visionResult.imageDescriptions;

            // 3. Standard Chunking
            logBroadcaster.broadcastProgress({ stage: 'Chunking', progress: 50, message: 'Splitting text...' });
            const chunks = recursiveChunking(
                full_text,
                CONFIG.PROCESSING.CHUNK_SIZE,
                CONFIG.PROCESSING.CHUNK_OVERLAP
            );

            // 4. Pre-calculate Embeddings (Parallel)
            console.log(`[Ingest] Generating Embeddings for ${chunks.length} chunks...`);
            logBroadcaster.broadcastProgress({ stage: 'Embedding', progress: 0, message: `Starting embedding for ${chunks.length} chunks` });
            const processedChunks = await this._generateEmbeddings(chunks);

            // 5. Database Transaction
            client = await getClient();
            await client.query('BEGIN');

            const fileType = this.determineFileType(filename, mimeType);
            const result = await this._saveToDatabase(client, filename, processedChunks, images, rawText, metadata, imageDescriptions, fileType);

            await client.query('COMMIT');
            console.log(`[Ingest] Completed: ${filename} (Success: ${result.successCount}, Failed: ${result.failedChunks})`);

            return {
                success: result.failedChunks === 0,
                total: chunks.length,
                indexed: result.successCount,
                failed: result.failedChunks,
                message: result.failedChunks > 0 ? 'Completed with some errors' : 'Processed successfully'
            };

        } catch (error) {
            if (client) await client.query('ROLLBACK');
            console.error('[Ingest] Error:', error);
            throw error;
        } finally {
            if (client) client.release();

            // Robust File Deletion with Retry
            if (fs.existsSync(filePath)) {
                try {
                    fs.unlinkSync(filePath);
                    console.log(`[Ingest] Cleaned up file: ${filePath}`);
                } catch (err: any) {
                    console.warn(`[Ingest] Failed to delete file immediately: ${err.message}. Retrying in 1s...`);
                    setTimeout(() => {
                        try {
                            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                            console.log(`[Ingest] Cleaned up file on retry: ${filePath}`);
                        } catch (retryErr: any) {
                            console.error(`[Ingest] Failed to delete file permanently: ${retryErr.message}`);
                        }
                    }, 1000);
                }
            }
        }
    }

    private async _enrichContentWithVision(full_text: string, images: string[]) {
        if (!images || images.length === 0) return { enrichedText: full_text, imageDescriptions: [] };

        console.log(`[Ingest] Found ${images.length} images. Starting Vision analysis...`);
        let enrichedText = full_text;
        const imageDescriptions: string[] = [];

        for (let i = 0; i < images.length; i++) {
            const base64Image = images[i];

            // Broadcast Progress
            const progress = Math.round(((i + 1) / images.length) * 100);
            logBroadcaster.broadcastProgress({
                stage: 'Vision',
                progress: progress,
                message: `Analyzing Image ${i + 1}/${images.length}...`
            });

            const placeholder = `![Image-${i + 1}]`;
            let description = "";

            if (visionService.shouldProcess(base64Image)) {
                // Returns { description, resizedImage }
                const result = await visionService.describeImage(base64Image);

                // RAM SAVE: Overwrite the huge original image with the optimized resized one!
                images[i] = result.resizedImage;

                description = result.description ? result.description.trim() : "";

                if (!description || description.length === 0) {
                    console.warn(`[Ingest] Vision returned empty/whitespace description for Image ${i + 1}.`);
                }
            } else {
                console.log(`[Ingest] Skipping Vision and Optimization for Image ${i + 1}: Image too small.`);
            }

            // Replace placeholder with Image Token + Description
            // Note: For external images (like email attachments), the placeholder might not exist in full_text initially.
            // We should append them if not found.

            if (full_text.indexOf(placeholder) === -1) {
                // Append to end of text if not found (e.g. email attachments)
                const formattedDesc = description
                    ? `\n\n![Image](<<IMG_IDX_${i}>>)\n> [IMAGE ANALYSIS] ${description}\n\n`
                    : `\n\n![Image](<<IMG_IDX_${i}>>)\n\n`;
                enrichedText += formattedDesc;
            } else {
                if (description) {
                    const formattedDesc = `\n\n![Image](<<IMG_IDX_${i}>>)\n> [IMAGE ANALYSIS] ${description}\n\n`;
                    enrichedText = enrichedText.replace(placeholder, formattedDesc);
                } else {
                    // Keep image even without description
                    const formattedDesc = `\n\n![Image](<<IMG_IDX_${i}>>)\n\n`;
                    enrichedText = enrichedText.replace(placeholder, formattedDesc);
                }
            }
            imageDescriptions.push(description);
        }
        return { enrichedText, imageDescriptions };
    }

    private async _generateEmbeddings(chunks: string[]) {
        const processedChunks: any[] = [];
        const BATCH_SIZE_EMBED = CONFIG.PROCESSING.BATCH_SIZE_EMBED || 5;

        for (let i = 0; i < chunks.length; i += BATCH_SIZE_EMBED) {

            // Broadcast Progress
            const progress = Math.round((i / chunks.length) * 100);
            logBroadcaster.broadcastProgress({
                stage: 'Embedding',
                progress: progress,
                message: `Embedding vectors... (${i}/${chunks.length})`
            });

            const batch = chunks.slice(i, i + BATCH_SIZE_EMBED);
            const results = await Promise.all(batch.map(async (content, idx) => {
                const realIdx = i + idx;
                try {
                    const embedding = await getEmbedding(content);
                    return {
                        success: true,
                        content,
                        index: realIdx,
                        embedding
                    };
                } catch (e: any) {
                    console.error(`[Ingest] Embedding failed for chunk ${realIdx}:`, e.message);
                    console.error(`[Ingest] Failed Chunk Content (snippet):`, content.substring(0, 100) + "...");
                    return { success: false, content, index: realIdx, error: e.message };
                }
            }));
            processedChunks.push(...results);
        }
        return processedChunks;
    }

    private async _saveToDatabase(
        client: any,
        filename: string,
        processedChunks: any[],
        images: string[] = [],
        fullText: string = "",
        metadata: { projectName: string; clientName: string; description?: string; sourceId?: string } = { projectName: '', clientName: '' },
        imageDescriptions: string[] = [],
        fileType: string = 'UNKNOWN'
    ) {
        const docRes = await client.query(
            `INSERT INTO documents (document_name, project_name, client_name, description, file_type, source_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [filename, metadata.projectName, metadata.clientName, metadata.description || '', fileType, metadata.sourceId || null]
        );
        const docId = docRes.rows[0].id;

        let failedChunks = 0;
        let successCount = 0;

        for (const chunk of processedChunks) {
            if (!chunk.success) {
                failedChunks++;
                continue;
            }

            await this.insertChunk(client, docId, chunk.content, chunk.index, filename, chunk.embedding, metadata);
            successCount++;
        }

        // --- Handle Image Saving (DB ONLY) ---
        if (images && images.length > 0) {
            try {
                console.log(`[Ingest] Saving ${images.length} images to DB (BLOB)...`);

                for (let i = 0; i < images.length; i++) {
                    const base64Data = images[i];
                    const description = imageDescriptions[i] || "";
                    let embeddingStr = null;

                    if (description && description.trim().length > 0) {
                        try {
                            // Construct Context Block for Embedding
                            // User Request: Title, Description, Project
                            const contextBlock = `
Image Context:
${description}
Project: ${metadata.projectName || 'General'}
Client: ${metadata.clientName || 'Unknown'}
Source: ${filename}
`.trim();

                            console.log(`[Ingest] Generating embedding for Image ${i} description (${description.length} chars)...`);
                            const vector = await getEmbedding(contextBlock);
                            embeddingStr = `[${vector.join(',')}]`;
                            console.log(`[Ingest] Embedding generated for Image ${i}. Vector length: ${vector.length}`);
                        } catch (embedErr) {
                            console.warn(`[Ingest] Failed to embed image description for idx ${i}:`, embedErr);
                        }
                    }

                    // Determine Page Number
                    let pageNum = 1;
                    const imgPlaceholder = `![Image-${i + 1}]`;

                    const placeholderIndex = fullText.indexOf(imgPlaceholder);
                    if (placeholderIndex > -1) {
                        const textBefore = fullText.substring(0, placeholderIndex);
                        const pageMatches = [...textBefore.matchAll(/<<PAGE_(\d+)>>/g)];
                        if (pageMatches.length > 0) {
                            pageNum = parseInt(pageMatches[pageMatches.length - 1][1]);
                        }
                    }

                    const imageFilename = `${docId}_${Date.now()}_img_${i}.png`;
                    const imageBuffer = Buffer.from(base64Data, 'base64');

                    const imageMetadata = {
                        project_name: metadata.projectName,
                        client_name: metadata.clientName,
                        page: pageNum,
                        source: filename
                    };

                    // FINAL STRICT CHECK: If embedding failed (null), DO NOT SAVE to DB.
                    if (!embeddingStr) {
                        console.warn(`[Ingest] Skipping Image ${i}: Embedding is missing/failed.`);
                        continue;
                    }

                    // Store DB Record
                    await client.query(
                        `INSERT INTO document_images (doc_id, page_number, image_index, image_path, image_data, description, embedding, metadata, fts) 
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, to_tsvector('simple', $6))`,
                        [docId, pageNum, i, `virtual/${imageFilename}`, imageBuffer, description, embeddingStr, JSON.stringify(imageMetadata)]
                    );
                }
                console.log(`[Ingest] Saved ${images.length} images to DB.`);
            } catch (err: any) {
                console.error(`[Ingest] Failed to save images: ${err.message}`);
            }
        }

        return { successCount, failedChunks };
    }

    private async insertChunk(
        client: any,
        docId: number,
        content: string,
        index: number,
        source: string,
        embedding: number[],
        extraMetadata: { projectName: string; clientName: string; description?: string } = { projectName: '', clientName: '' }
    ) {
        try {
            const vectorStr = `[${embedding.join(',')}]`;

            // Grade A+ Page Tracking: Find last <<PAGE_X>> marker
            let pageNum = 1;
            const pageMatch = content.match(/<<PAGE_(\d+)>>/g);

            if (pageMatch && pageMatch.length > 0) {
                const lastMarker = pageMatch[pageMatch.length - 1];
                const match = lastMarker.match(/(\d+)/);
                if (match) pageNum = parseInt(match[0]);
            }

            const metadata = {
                page: pageNum,
                source: source,
                chunk_index: index,
                project_name: extraMetadata.projectName,
                client_name: extraMetadata.clientName,
                description: extraMetadata.description || ''
            };

            await client.query(`
                INSERT INTO document_chunks (doc_id, content, metadata, embedding, fts)
                VALUES ($1, $2, $3, $4, to_tsvector('simple', $2))
            `, [docId, content, JSON.stringify(metadata), vectorStr]);
            return true;
        } catch (e) {
            console.error(`Chunk error (idx ${index}):`, e);
            throw e;
        }
    }

    private determineFileType(filename: string, mimeType: string): string {
        // Explicit override for Email
        if (mimeType === 'EMAIL') return 'EMAIL';

        const ext = filename.split('.').pop()?.toLowerCase();

        if (mimeType.includes('pdf') || ext === 'pdf') return 'PDF';
        if (mimeType.includes('word') || mimeType.includes('document') || ext === 'docx' || ext === 'doc') return 'DOCX';
        if (mimeType.includes('sheet') || mimeType.includes('excel') || ext === 'xlsx' || ext === 'xls' || ext === 'csv') return 'XLSX';
        if (mimeType.includes('presentation') || mimeType.includes('powerpoint') || ext === 'pptx' || ext === 'ppt') return 'PPTX';
        if (mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp'].includes(ext || '')) return 'IMAGE';

        return 'UNKNOWN';
    }

    private async extractTextWithMarker(filePath: string) {
        const pythonCommand = `"${CONFIG.PATHS.PYTHON_EXEC}"`;
        const scriptPath = path.resolve(CONFIG.PATHS.SCRIPTS_DIR, 'pdf_extractor.py');

        try {
            const { stdout } = await execAsync(`${pythonCommand} "${scriptPath}" "${filePath}"`, { maxBuffer: 1024 * 1024 * 50 });
            return JSON.parse(stdout);
        } catch (error: any) {
            // Attempt to extract specific error message from Python script output
            if (error.stdout) {
                try {
                    const errObj = JSON.parse(error.stdout.toString());
                    if (errObj.error) {
                        throw new Error(`PDF Extraction Failed: ${errObj.error}`);
                    }
                } catch (e) { /* Ignore JSON parse error of the error output */ }
            }
            throw new Error(`PDF Processing Error: ${error.message}`);
        }
    }

    private async extractPptxWithPython(filePath: string) {
        const pythonCommand = `"${CONFIG.PATHS.PYTHON_EXEC}"`;
        const scriptPath = path.resolve(CONFIG.PATHS.SCRIPTS_DIR, 'pptx_extractor.py');

        try {
            const { stdout } = await execAsync(`${pythonCommand} "${scriptPath}" "${filePath}"`, { maxBuffer: 1024 * 1024 * 50 });
            return JSON.parse(stdout); // Expect { full_text, images, metadata }
        } catch (error: any) {
            // Attempt to extract specific error message from Python script output
            if (error.stdout) {
                try {
                    const errObj = JSON.parse(error.stdout.toString());
                    if (errObj.error) {
                        throw new Error(`PPTX Extraction Failed: ${errObj.error}`);
                    }
                } catch (e) { /* Ignore JSON parse error of the error output */ }
            }
            throw new Error(`PPTX Processing Error: ${error.message}`);
        }
    }

    private async extractDocxWithPython(filePath: string) {
        const pythonCommand = `"${CONFIG.PATHS.PYTHON_EXEC}"`;
        const scriptPath = path.resolve(CONFIG.PATHS.SCRIPTS_DIR, 'docx_extractor.py');

        try {
            const { stdout } = await execAsync(`${pythonCommand} "${scriptPath}" "${filePath}"`, { maxBuffer: 1024 * 1024 * 50 });
            return JSON.parse(stdout); // Expect { full_text, images, metadata }
        } catch (error: any) {
            // Attempt to extract specific error message from Python script output
            if (error.stdout) {
                try {
                    const errObj = JSON.parse(error.stdout.toString());
                    if (errObj.error) {
                        throw new Error(`DOCX Extraction Failed: ${errObj.error}`);
                    }
                } catch (e) { /* Ignore JSON parse error of the error output */ }
            }
            throw new Error(`DOCX Processing Error: ${error.message}`);
        }
    }
    async updateDocumentContent(
        docId: string,
        newContent?: string, // Made optional
        newFilename?: string,
        metadata?: { projectName: string; clientName: string; description?: string }
    ) {
        let client;
        try {
            console.log(`[Update] Updating document ${docId}...`);
            client = await getClient();
            await client.query('BEGIN');

            // 1. Update Document Table
            const updateFields: string[] = [];
            const updateValues: any[] = [];
            let valIdx = 1;

            if (newFilename) {
                updateFields.push(`document_name = $${valIdx++}`);
                updateValues.push(newFilename);
            }
            if (metadata) {
                updateFields.push(`project_name = $${valIdx++}`);
                updateValues.push(metadata.projectName);
                updateFields.push(`client_name = $${valIdx++}`);
                updateValues.push(metadata.clientName);
                if (metadata.description !== undefined) {
                    updateFields.push(`description = $${valIdx++}`);
                    updateValues.push(metadata.description);
                }
            }

            if (updateFields.length > 0) {
                updateValues.push(docId);
                await client.query(
                    `UPDATE documents SET ${updateFields.join(', ')} WHERE id = $${valIdx}`,
                    updateValues
                );
            }

            // 2. If Content Provided -> Full Re-Ingestion
            if (newContent) {
                // Delete Old Chunks
                await client.query('DELETE FROM document_chunks WHERE doc_id = $1', [docId]);
                // Delete Old Images (Metadata only, file cleanup is separate task or complex)
                await client.query('DELETE FROM document_images WHERE doc_id = $1', [docId]);


                // Re-process Content
                // Need to re-chunk and re-embed the new content
                const chunks = recursiveChunking(
                    newContent,
                    CONFIG.PROCESSING.CHUNK_SIZE,
                    CONFIG.PROCESSING.CHUNK_OVERLAP
                );

                // Generate New Embeddings
                console.log(`[Update] Generating new embeddings for ${chunks.length} chunks...`);
                const processedChunks = await this._generateEmbeddings(chunks);

                // Get latest filename/metadata to ensure consistency
                const nameRes = await client.query('SELECT document_name, project_name, client_name, description FROM documents WHERE id = $1', [docId]);
                const filename = nameRes.rows[0]?.document_name || 'Updated Document';
                const currentProject = nameRes.rows[0]?.project_name || '';
                const currentClient = nameRes.rows[0]?.client_name || '';
                const currentDescription = nameRes.rows[0]?.description || '';

                for (const chunk of processedChunks) {
                    if (chunk.success) {
                        await this.insertChunk(
                            client,
                            parseInt(docId),
                            chunk.content,
                            chunk.index,
                            filename,
                            chunk.embedding,
                            {
                                projectName: currentProject,
                                clientName: currentClient,
                                description: currentDescription
                            }
                        );
                    }
                }
            } else if (metadata) {
                // 3. Metadata Only Update -> Update Chunks and Images inplace
                // We use jsonb concatenation to update specific keys without losing others (like page, source)
                // Assuming 'metadata' column is JSONB. If it is JSON, we cast it.

                const metaUpdate: any = {
                    project_name: metadata.projectName,
                    client_name: metadata.clientName
                };
                if (metadata.description !== undefined) {
                    metaUpdate.description = metadata.description;
                }
                const metaUpdateJson = JSON.stringify(metaUpdate);

                // Update document_chunks
                await client.query(
                    `UPDATE document_chunks 
                     SET metadata = metadata::jsonb || $1::jsonb 
                     WHERE doc_id = $2`,
                    [metaUpdateJson, docId]
                );

                // Update document_images
                await client.query(
                    `UPDATE document_images 
                     SET metadata = metadata::jsonb || $1::jsonb 
                     WHERE doc_id = $2`,
                    [metaUpdateJson, docId]
                );

                console.log(`[Update] Metadata updated for DocID ${docId}`);
            }

            await client.query('COMMIT');
            console.log(`[Update] Document ${docId} processing finished.`);
            return true;

        } catch (error) {
            if (client) await client.query('ROLLBACK');
            console.error('[Update] Error:', error);
            throw error;
        } finally {
            if (client) client.release();
        }
    }
}

export const ingestionService = new IngestionService();
