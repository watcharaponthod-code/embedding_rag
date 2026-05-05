import axios from "axios";
import { CONFIG } from '../config';

const ollamaClient = axios.create({
    baseURL: CONFIG.OLLAMA.HOST,
});

export interface ClassificationResult {
    project: string;
    client: string;
    confidence: number;
    reasoning?: string;
    is_new_project?: boolean;
}

export interface ClassifyInput {
    text: string;
    candidates: { project_name: string; client_name: string }[];
    timeout?: number;
}

export const aiClassificationService = {
    /**
     * Classifies content into a Project and Client based on text and existing candidates.
     */
    async classifyContent(input: ClassifyInput): Promise<ClassificationResult> {
        const TIMEOUT = input.timeout || 30000; // Increased to 30s
        const FALLBACK = {
            project: 'INBOX_UNCLASSIFIED',
            client: 'UNKNOWN',
            confidence: 0.0,
            reasoning: 'Fallback due to AI error'
        };

        try {
            // Format candidates for prompt
            const candidatesList = input.candidates
                .map(c => `- Project: "${c.project_name}", Client: "${c.client_name}"`)
                .join("\n");

            // Truncate text to avoid token limits
            const truncatedText = input.text.slice(0, 3000);

            const prompt = `
SYSTEM: You are an intelligent assistant that classifies email content into "Project Name" and "Client Name".
SYSTEM: You must output ONLY valid JSON. No conversational text.

USER:
Existing Candidates:
${candidatesList}

Content to Analyze:
"""
${truncatedText}
"""

Instructions:
1. If content matches an existing candidate, return it.
2. If it is a NEW project, infer a descriptive Project Name and Client Name.
3. Return JSON format: {"project": "...", "client": "...", "confidence": 0.9, "is_new": boolean}

ASSISTANT:
{
`;

            console.log(`[AI Classification] Sending request to ${CONFIG.OLLAMA.HOST} (Model: ${CONFIG.OLLAMA.MODEL_CHAT})...`);

            const response = await ollamaClient.post(
                "/api/generate",
                {
                    model: CONFIG.OLLAMA.MODEL_CHAT,
                    prompt: prompt,
                    stream: false,
                    options: {
                        temperature: 0.1,
                        num_predict: 200,
                    },
                },
                { timeout: TIMEOUT }
            );

            console.log("[AI Classification] Raw Response:", response.data.response); // Debug Log

            // Helper to clean JSON
            const cleanJson = (text: string) => {
                try {
                    // Treat input as partial JSON if it starts with property/quote but lacks brace because we pre-filled it in prompt
                    let jsonStr = text.trim();
                    if (!jsonStr.startsWith('{')) jsonStr = '{' + jsonStr; // Add brace if missing (due to prompt injection)

                    const firstBrace = jsonStr.indexOf('{');
                    const lastBrace = jsonStr.lastIndexOf('}');
                    if (firstBrace !== -1 && lastBrace !== -1) {
                        return JSON.parse(jsonStr.substring(firstBrace, lastBrace + 1));
                    }
                    return JSON.parse(jsonStr);
                } catch (e) {
                    throw new Error("Failed to extract JSON from response: " + text);
                }
            };

            const result = cleanJson(response.data.response);

            // Basic validation
            if (!result.project || !result.client) {
                throw new Error("Invalid JSON structure from AI");
            }

            return {
                project: result.project,
                client: result.client,
                confidence: typeof result.confidence === 'number' ? result.confidence : 0.5,
                reasoning: result.reasoning
            };

        } catch (error: any) {
            console.error("[AI Classification] Failed:", error.message);
            if (error.code === 'ECONNABORTED') console.error("[AI Classification] Request Timed out.");
            return FALLBACK;
        }
    }
};
