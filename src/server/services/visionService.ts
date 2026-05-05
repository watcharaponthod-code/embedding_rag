import axios from 'axios';
import { CONFIG } from '../config';
import sharp from 'sharp';

const ollamaClient = axios.create({
    baseURL: CONFIG.OLLAMA.HOST,
    timeout: 120000 // 2 minutes
});

export class VisionService {

    shouldProcess(base64Image: string): boolean {
        const sizeInBytes = (base64Image.length * 3) / 4;
        return sizeInBytes > 20 * 1024; // Aggressive Filter: > 20KB (Cut out Logos/Icons)
    }

    /**
     * Resizes and compresses image to be under ~100KB (Vision Optimized)
     */
    async resizeImage(base64Image: string): Promise<string> {
        try {
            const buffer = Buffer.from(base64Image, 'base64');

            // Resize to max 800x800 and moderate quality
            const resizedBuffer = await sharp(buffer)
                .resize({ width: 800, height: 800, fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 60, progressive: true })
                .toBuffer();

            const newBase64 = resizedBuffer.toString('base64');
            const oldSize = Math.round(base64Image.length / 1024);
            const newSize = Math.round(newBase64.length / 1024);

            console.log(`[Vision] Resized image: ${oldSize}KB -> ${newSize}KB`);
            return newBase64;
        } catch (err: any) {
            console.error("[Vision] Resize failed:", err.message);
            return base64Image; // Fallback to original
        }
    }

    async describeImage(base64Image: string): Promise<{ description: string, resizedImage: string }> {
        try {
            if (!CONFIG.OLLAMA.MODEL_VISION) return { description: "", resizedImage: base64Image };

            // 1. OPTIMIZE: Resize image first
            const processedImage = await this.resizeImage(base64Image);

            console.log(`[Vision] Analyzing optimized image type...`);

            const response = await ollamaClient.post('/api/generate', {
                model: CONFIG.OLLAMA.MODEL_VISION,
                // Universal Prompt: Concise but descriptive for ALL images
                prompt: `Describe this image concisely. Summarize the main visuals, charts, or visible text. Keep it short and factual.`,
                images: [processedImage],
                stream: false,
                options: {
                    temperature: 0.1,
                    num_ctx: 1024, // Limited context for speed
                }
            });

            let description = response.data.response;
            console.log(`[Vision Debug] Raw Response: "${description}" (Type: ${typeof description}, Len: ${description?.length})`);

            // FALLBACK: If Empty, Whitespace, or very short (< 5 chars)
            if (!description || description.trim().length < 5) {
                console.warn("[Vision] Smart prompt logic failed. Retrying with OCR/Fallback mode...");
                const simpleResponse = await ollamaClient.post('/api/generate', {
                    model: CONFIG.OLLAMA.MODEL_VISION,
                    // FORCE OCR: If description failed, it's likely a text slide or abstract image
                    prompt: `Read the text in this image strictly. Transcribe it. If no text, describe colors.`,
                    images: [processedImage],
                    stream: false,
                    options: { temperature: 0.1, num_ctx: 512 }
                });
                description = simpleResponse.data.response;
                console.log(`[Vision Debug] Fallback Response: "${description}"`);
            }

            console.log(`[Vision] Result: ${description ? description.substring(0, 50) : "EMPTY"}...`);
            return { description, resizedImage: processedImage };

        } catch (error: any) {
            console.error(`[Vision] Error:`, error.message);
            return { description: "", resizedImage: base64Image };
        }
    }
}

export const visionService = new VisionService();
