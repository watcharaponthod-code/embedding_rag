import { n8nIngestionService, N8NPayload } from '../services/n8nIngestionService';
import { getClient } from '../utils/db'; // Ensure DB connection works

const mockPayload: N8NPayload = {
    source_info: {
        workflow_id: "test-workflow-001",
        execution_id: "exec-123",
        triggered_at: new Date().toISOString()
    },
    email_metadata: {
        message_id: `<test-${Date.now()}@example.com>`,
        subject: "Test Project Beta: Deployment Plan",
        from: { name: "Test User", address: "test@example.com" },
        to: [{ name: "Dev Team", address: "dev@sycapt.com" }],
        received_date: new Date().toISOString()
    },
    content: {
        body_text: "Hi Team, please find the attached deployment plan for Project Beta.",
        body_html: "<div>Hi Team, please find the attached <b>deployment plan</b> for Project Beta.</div>"
    },
    assets: {
        attachments: [
            {
                filename: "deployment_plan.txt",
                mime_type: "text/plain",
                size_bytes: 12,
                content_base64: Buffer.from("Plan: Go Live").toString('base64')
            }
        ],
        inline_images: []
    },
    manual_override: {
        project_name: "Project Beta",
        client_name: "Internal"
    }
};

async function testIngestion() {
    console.log("Starting N8N Ingestion Test...");
    try {
        const result = await n8nIngestionService.processIncomingEmail(mockPayload);
        console.log("Ingestion Result:", result);

        if (result.status === 'success') {
            const client = await getClient();
            try {
                const emailRes = await client.query("SELECT * FROM email_attributes WHERE node_id = $1", [result.id]);
                console.log("Email Attributes Found:", emailRes.rows.length > 0);
                console.log("Subject:", emailRes.rows[0].subject);

                const attachRes = await client.query(`
            SELECT f.* FROM file_attributes f
            JOIN content_relationships r ON f.node_id = r.target_node_id
            WHERE r.source_node_id = $1
        `, [result.id]);
                console.log("Attachments Found:", attachRes.rows.length);
                console.log("First Attachment:", attachRes.rows[0].original_filename);

            } finally {
                client.release();
            }
        }
    } catch (error) {
        console.error("Test Failed:", error);
    }
}

testIngestion().catch(console.error);
