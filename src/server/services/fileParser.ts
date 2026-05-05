import fs from 'fs';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import officeParser from 'officeparser';

/**
 * Universal File Parser Service
 * Handles extraction of text from DOCX, PPTX, and PDF.
 * (Excel/XLSX is strictly unsupported/blocked)
 */
export const parseFile = async (filePath: string, mimeType: string): Promise<string> => {
    const ext = filePath.split('.').pop()?.toLowerCase();

    console.log(`[FileParser] Parsing file: ${filePath} (${mimeType})`);

    try {
        if (mimeType === 'application/pdf' || ext === 'pdf') {
            return await parsePdf(filePath);
        }
        else if (
            mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            ext === 'docx'
        ) {
            return await parseDocx(filePath);
        }
        else if (
            mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
            ext === 'pptx'
        ) {
            return await parseOffice(filePath);
        }
        else if (mimeType === 'text/plain' || ext === 'txt') {
            return fs.readFileSync(filePath, 'utf-8');
        }
        else if (
            mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            mimeType === 'application/vnd.ms-excel' ||
            mimeType === 'text/csv' ||
            ext === 'xlsx' || ext === 'xls' || ext === 'csv'
        ) {
            // Excel/CSV Strategy: Truncate if too large
            // User Rule: "If text is too much for excel, cut it off"
            const EXCEL_CHAR_LIMIT = 50000;
            let rawText = "";

            if (ext === 'csv' || mimeType === 'text/csv') {
                rawText = fs.readFileSync(filePath, 'utf-8');
            } else {
                rawText = await parseOffice(filePath);
            }

            if (rawText.length > EXCEL_CHAR_LIMIT) {
                console.warn(`[FileParser] Excel/CSV content exceeded limit (${rawText.length} > ${EXCEL_CHAR_LIMIT}). Truncating...`);
                return rawText.substring(0, EXCEL_CHAR_LIMIT) + "\n...[Content Truncated due to size limit]";
            }
            return rawText;
        }
        else {
            throw new Error(`Unsupported file type: ${mimeType}`);
        }
    } catch (error: any) {
        console.error(`[FileParser] Error parsing ${ext} file:`, error);
        throw new Error(`Failed to parse file: ${error.message}`);
    }
};

const parsePdf = async (filePath: string): Promise<string> => {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);
    // Basic cleanup
    return data.text.replace(/\n\s*\n/g, '\n\n').trim();
};

const parseDocx = async (filePath: string): Promise<string> => {
    const buffer = fs.readFileSync(filePath);

    // Define style map to ensure headers are correctly identified
    const options = {
        styleMap: [
            "p[style-name='Heading 1'] => h1:fresh",
            "p[style-name='Heading 2'] => h2:fresh",
            "p[style-name='Heading 3'] => h3:fresh",
            "p[style-name='Heading 4'] => h4:fresh",
            "p[style-name='Title'] => h1:fresh",
            "p[style-name='Subtitle'] => h2:fresh",
            "b => strong",
            "i => em"
        ]
    };

    const result = await mammoth.convertToHtml({ buffer: buffer }, options);
    const html = result.value;

    // Convert HTML to Markdown manually (lightweight, no extra deps)
    let markdown = html
        // Headers
        .replace(/<h1>(.*?)<\/h1>/g, '\n# $1\n\n')
        .replace(/<h2>(.*?)<\/h2>/g, '\n## $1\n\n')
        .replace(/<h3>(.*?)<\/h3>/g, '\n### $1\n\n')
        .replace(/<h4>(.*?)<\/h4>/g, '\n#### $1\n\n')
        // Bold / Italic
        .replace(/<strong>(.*?)<\/strong>/g, '**$1**')
        .replace(/<em>(.*?)<\/em>/g, '*$1*')
        // Lists (Basic map)
        .replace(/<ul>(.*?)<\/ul>/g, '$1')
        .replace(/<li>(.*?)<\/li>/g, '\n- $1')
        // Paragraphs
        .replace(/<p>(.*?)<\/p>/g, '$1\n\n')
        // Clean up remaining tags (optional but good for safety)
        .replace(/<[^>]*>/g, '')
        // Decode HTML entities
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        // Fix excessive newlines
        .replace(/\n\s*\n/g, '\n\n')
        .trim();

    // Check Messages/Warnings
    if (result.messages && result.messages.length > 0) {
        console.log("[FileParser] Word Doc Messages:", result.messages);
    }

    return markdown;
};

const parseOffice = async (filePath: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        officeParser.parseOffice(filePath, (data: string, err: any) => {
            if (err) reject(err);
            else resolve(data.trim());
        });
    });
};

