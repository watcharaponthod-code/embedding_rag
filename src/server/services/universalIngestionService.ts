import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { getClient } from '../../utils/db';
import { ingestionService } from './ingestionService';
import { aiClassificationService } from './aiClassificationService';

/**
 * โครงสร้างข้อมูลกลางที่รองรับอนาคต (Standardized Content Package)
 */
export interface ContentPackage {
    sourceType: 'email' | 'web' | 'chat' | 'manual' | 'api';
    sourceId: string; // เช่น message_id, url_hash, chat_id
    title: string;
    content: {
        text: string;
        html?: string;
        raw_json?: any;
    };
    files: Array<{
        path: string;
        name: string;
        mime: string;
    }>;
    context?: {
        projectName?: string;
        clientName?: string;
        author?: string;
        timestamp?: Date;
        labels?: string[];
    };
}

export class UniversalIngestionService {

    /**
     * ฟังก์ชันหลักในการนำข้อมูลเข้าสู่ระบบ
     */
    async ingest(pkg: ContentPackage) {
        console.log(`[Unifying Ingest] Starting ingestion for: ${pkg.title} (${pkg.sourceType})`);

        // 1. วิเคราะห์ Project/Client ด้วย AI (Intelligence Layer)
        const { projectName, clientName } = await this._resolveMetadata(pkg);
        console.log(`[Universal Ingest] Metadata Resolved -> Project: ${projectName}, Client: ${clientName}`);

        // --- Email Attachment Handling Logic ---
        const imageAttachments: string[] = [];
        const otherFiles = [];

        for (const file of pkg.files) {
            if (file.mime.startsWith('image/')) {
                console.log(`[Universal Ingest] Found image attachment: ${file.name}`);
                const imageBuffer = fs.readFileSync(file.path);
                imageAttachments.push(imageBuffer.toString('base64'));
                // Don't delete the file yet, ingestionService will do it
            } else {
                otherFiles.push(file);
            }
        }

        // 2. ประมวลผลเนื้อหาหลัก (Body/Text) พร้อมรูปภาพแนบ ผ่าน Legacy Pipeline
        console.log(`[Universal Ingest] Processing main content text (${pkg.content.text.length} chars) with ${imageAttachments.length} images...`);
        const bodyResult = await this._ingestTextViaLegacy(pkg, projectName, clientName, pkg.sourceId, imageAttachments);

        // 3. ประมวลผลไฟล์แนบอื่นๆ (ที่ไม่ใช่รูปภาพ)
        const fileResults = [];
        for (const file of otherFiles) {
            console.log(`[Universal Ingest] Processing other file: ${file.name} (${file.mime})`);
            const result = await ingestionService.processFile(file.path, file.name, file.mime, {
                projectName: projectName,
                clientName: clientName,
                sourceId: pkg.sourceId
            });
            fileResults.push({ ...result, filename: file.name });
        }

        // 4. บันทึกลง Universal Content Graph (Relationship Layer)
        console.log(`[Universal Ingest] Saving to Content Graph...`);
        const graphId = await this._saveToGraph(pkg, projectName, clientName, bodyResult, fileResults);

        return {
            status: 'success',
            graphId,
            projectName,
            clientName,
            bodyProcessed: !!bodyResult,
            filesProcessed: fileResults.length
        };
    }

    /**
     * นำ Text มาจำลองเป็นไฟล์เพื่อส่งให้ Ingestion Service เดิมประมวลผล
     */
    private async _ingestTextViaLegacy(pkg: ContentPackage, projectName: string, clientName: string, sourceId: string, attachedImages: string[] = []) {
        if (!pkg.content.text) return null;

        const tempFileName = `source_${pkg.sourceType}_${uuidv4()}.txt`;
        const tempPath = path.resolve(process.cwd(), 'uploads', 'temp', tempFileName);

        // ตรวจสอบโฟลเดอร์ชั่วคราว
        if (!fs.existsSync(path.dirname(tempPath))) {
            fs.mkdirSync(path.dirname(tempPath), { recursive: true });
        }

        // เขียนเนื้อหาลงไฟล์ชั่วคราว
        fs.writeFileSync(tempPath, pkg.content.text);

        try {
            // เรียกใช้ความสามารถเดิม (Vision, Chunking, Embedding)
            // Force file_type to be 'EMAIL' instead of 'text/plain' to store in DB correctly
            const result = await ingestionService.processFile(
                tempPath, 
                `Email: ${pkg.title}`, 
                'EMAIL', 
                {
                    projectName,
                    clientName,
                    sourceId
                },
                attachedImages // Pass attached images here
            );
            return result;
        } finally {
            // มั่นใจว่าลบไฟล์ชั่วคราวแน่นอน
            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
            // Also clean up the original image attachment files
            pkg.files.forEach(file => {
                if (file.mime.startsWith('image/') && fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                    console.log(`[Universal Ingest] Cleaned up image attachment: ${file.path}`);
                }
            });
        }
    }

    /**
     * ดึง Metadata หรือใช้ AI วิเคราะห์
     */
    private async _resolveMetadata(pkg: ContentPackage) {
        let projectName = pkg.context?.projectName;
        let clientName = pkg.context?.clientName;

        // Force AI if "Unknown/Unclassified" or empty
        const isInvalid = (val?: string) => !val || val.trim() === '' || val === 'INBOX_UNCLASSIFIED' || val === 'UNKNOWN';

        console.log(`[Metadata Debug] Checking inputs -> Project: '${projectName}', Client: '${clientName}'`);
        const shouldRunAI = isInvalid(projectName) || isInvalid(clientName);
        console.log(`[Metadata Debug] Should run AI? ${shouldRunAI}`);

        if (shouldRunAI) {
            console.log("[Metadata Debug] AI Execution Started...");
            const client = await getClient();
            try {
                const candidatesRes = await client.query("SELECT DISTINCT project_name, client_name FROM documents WHERE project_name IS NOT NULL");
                console.log(`[Metadata Debug] Found ${candidatesRes.rows.length} candidates.`);

                // Construct header text for AI context
                let headerText = `Subject: ${pkg.title}\n`;
                if (pkg.content.raw_json) {
                    headerText += `From: ${pkg.content.raw_json.from}\n`;
                    headerText += `To: ${Array.isArray(pkg.content.raw_json.to) ? pkg.content.raw_json.to.join(', ') : pkg.content.raw_json.to}\n`;
                    headerText += `Date: ${pkg.content.raw_json.date}\n`;
                }

                const aiResult = await aiClassificationService.classifyContent({
                    text: `${headerText}\n---\n${pkg.content.text}`,
                    candidates: candidatesRes.rows
                });

                console.log("[Metadata Debug] AI Result:", aiResult);

                projectName = projectName && !isInvalid(projectName) ? projectName : aiResult.project;
                clientName = clientName && !isInvalid(clientName) ? clientName : aiResult.client;
            } catch (err: any) {
                console.error("[Metadata Debug] Error during AI:", err.message);
            } finally {
                client.release();
            }
        }
        return { projectName, clientName };
    }

    /**
     * เชื่อมโยงข้อมูลทุกอย่างเข้าด้วยกันในตารางใหม่ (Graph)
     */
    /**
     * เชื่อมโยงข้อมูลทุกอย่างเข้าด้วยกันในตารางใหม่ (Graph)
     * [MODIFIED] ไม่บันทึกลง content_nodes / email_attributes ตาม requirement ใหม่
     */
    private async _saveToGraph(pkg: ContentPackage, project: string, client: string, bodyResult: any, fileResults: any[]) {
        // Bypass saving to extra tables. relies solely on documents/document_chunks.
        console.log(`[Universal Ingest] Skipping Cloud Graph (content_nodes/email_attributes) saving as requested.`);
        return 0; // Return dummy Graph ID
    }
}

export const universalIngestionService = new UniversalIngestionService();
