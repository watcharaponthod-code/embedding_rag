import path from 'path';
import fs from 'fs';
import { getClient } from '../../utils/db';
import { universalIngestionService, ContentPackage } from './universalIngestionService';

// เนื้อหา Spec เดิมของ N8N
export interface N8NPayload {
    source_info: {
        workflow_id: string;
        execution_id?: string;
        triggered_at?: string;
    };
    email_metadata: {
        message_id: string;
        subject: string;
        from: { name: string; address: string } | string;
        to: ({ name: string; address: string } | string)[];
        received_date: string;
    };
    content: {
        body_text: string;
        body_html: string;
    };
    assets: {
        attachments: Array<{
            filename: string;
            mime_type: string;
            size_bytes: number;
            content_base64: string;
        }>;
        inline_images: Array<{
            content_id: string;
            filename: string;
            mime_type: string;
            content_base64: string;
        }>;
    };
    manual_override: {
        project_name?: string;
        client_name?: string;
    };
}

export const n8nIngestionService = {

    async processIncomingEmail(payload: N8NPayload) {
        console.log(`[N8N Webhook] Received request for: "${payload.email_metadata.subject}" from ${typeof payload.email_metadata.from === 'string' ? payload.email_metadata.from : payload.email_metadata.from.address}`);

        const client = await getClient();

        try {
            // 1. Idempotency Check (Removed as per user request - N8N handles this)
            // const existingRes = await client.query(
            //     "SELECT node_id FROM email_attributes WHERE message_id = $1",
            //     [payload.email_metadata.message_id]
            // );
            // if (existingRes.rows.length > 0) {
            //     console.warn(`[N8N Webhook] Skipping duplicate email (Message-ID: ${payload.email_metadata.message_id})`);
            //     return { status: 'skipped', message: 'อีเมลนี้ถูกนำเข้าระบบแล้ว', id: existingRes.rows[0].node_id };
            // }
        } finally {
            client.release();
        }

        console.log(`[N8N Webhook] Processing assets: ${payload.assets.attachments?.length || 0} attachments, ${payload.assets.inline_images?.length || 0} inline images`);

        // 2. จัดการไฟล์และรูปภาพ (แยก Folder Images และ Files)
        const BASE_UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');
        const IMAGES_DIR = path.join(BASE_UPLOAD_DIR, 'images');
        const FILES_DIR = path.join(BASE_UPLOAD_DIR, 'files'); // Changed from 'emails' to 'files' for generic file separation

        // Ensure directories exist
        if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });
        if (!fs.existsSync(FILES_DIR)) fs.mkdirSync(FILES_DIR, { recursive: true });

        const allAssets = [
            ...(payload.assets.attachments || []),
            ...(payload.assets.inline_images || [])
        ];

        const preparedFiles = allAssets.map(att => {
            const safeFilename = `${Date.now()}_${att.filename.replace(/[^a-z0-9.]/gi, '_')}`;
            const isImage = att.mime_type.startsWith('image/');

            // Choose directory based on type
            const targetDir = isImage ? IMAGES_DIR : FILES_DIR;
            const filePath = path.join(targetDir, safeFilename);

            fs.writeFileSync(filePath, Buffer.from(att.content_base64, 'base64'));
            return {
                path: filePath,
                name: att.filename,
                mime: att.mime_type
            };
        });

        // 3. แปลง N8N Payload ให้กลายเป็น Standard Content Package (Universal Format)
        const contentPackage: ContentPackage = {
            sourceType: 'email',
            // Append timestamp to ensure uniqueness since we disabled idempotency check
            sourceId: `${payload.email_metadata.message_id}_${Date.now()}`,
            title: payload.email_metadata.subject,
            content: {
                text: payload.content.body_text,
                html: payload.content.body_html,
                raw_json: {
                    from: typeof payload.email_metadata.from === 'string' ? payload.email_metadata.from : payload.email_metadata.from.address,
                    to: Array.isArray(payload.email_metadata.to)
                        ? payload.email_metadata.to.map(t => typeof t === 'string' ? t : (t as any).text || t.address)
                        : [typeof payload.email_metadata.to === 'string' ? payload.email_metadata.to : (payload.email_metadata.to as any)?.text || (payload.email_metadata.to as any)?.address || JSON.stringify(payload.email_metadata.to)],
                    date: payload.email_metadata.received_date,
                    n8n_info: payload.source_info
                }
            },
            files: preparedFiles,
            context: {
                projectName: payload.manual_override?.project_name?.trim(),
                clientName: payload.manual_override?.client_name?.trim(),
                author: typeof payload.email_metadata.from === 'string' ? payload.email_metadata.from : payload.email_metadata.from.name,
                timestamp: new Date(payload.email_metadata.received_date)
            }
        };

        // 4. ส่งให้ Universal Service จัดการประมวลผลทั้งหมด (Chunking, Embedding, Vision, Graph Link)
        const result = await universalIngestionService.ingest(contentPackage);

        console.log(`[N8N Webhook] ✅ Successfully ingested email. Graph ID: ${result.graphId}, Project: ${result.projectName}`);
        return {
            status: 'success',
            email_id: result.graphId,
            classified_project: result.projectName,
            classified_client: result.clientName,
            attachments_count: result.filesProcessed
        };
    }
};
