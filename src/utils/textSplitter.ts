import { CONFIG } from '../config';

/**
 * Standard Recursive Character Text Splitter (similar to LangChain)
 * Splits text by list of separators, trying to keep chunks within size limit.
 * Support strict overlap to preserve context at boundaries.
 */
export function recursiveChunking(
    text: string,
    chunkSize: number = CONFIG.PROCESSING.CHUNK_SIZE,
    chunkOverlap: number = CONFIG.PROCESSING.CHUNK_OVERLAP,
    separators: string[] = ["\n\n", "\n", " ", ""]
): string[] {
    const finalChunks: string[] = [];

    // Optimization: If text fits, return immediately
    if (text.length <= chunkSize) {
        return [text];
    }

    let _separator = "";
    let nextSeparators: string[] = [];

    // 1. Find separator
    let found = false;
    for (let i = 0; i < separators.length; i++) {
        const s = separators[i];
        if (s === "" || text.includes(s)) {
            _separator = s;
            nextSeparators = separators.slice(i + 1); // Descent: Only use lower priority separators next time
            found = true;
            break;
        }
    }

    // If no separator found (shouldn't happen if "" is in list), just return text
    if (!found) {
        return [text];
    }

    // 2. Split
    let splits: string[];
    if (_separator) {
        splits = text.split(_separator);
    } else {
        splits = text.split("");
    }

    // 3. Merge splits into chunks with overlap
    let currentDoc: string[] = [];
    let totalCurrentLength = 0;
    const separatorLen = _separator.length;

    for (const d of splits) {
        const len = d.length;

        // Check if adding this piece exceeds chunk size
        if (totalCurrentLength + len + (currentDoc.length > 0 ? separatorLen : 0) > chunkSize) {

            // Flush current buffer if it has content
            if (currentDoc.length > 0) {
                const doc = currentDoc.join(_separator);
                if (doc.trim()) finalChunks.push(doc);

                // Sliding window: Remove items from start until overlap is satisfied
                while (totalCurrentLength > chunkOverlap || (totalCurrentLength > 0 && !(totalCurrentLength < chunkOverlap))) {
                    if (currentDoc.length === 0) break;
                    const popped = currentDoc.shift();
                    totalCurrentLength -= (popped?.length || 0) + (currentDoc.length > 0 ? separatorLen : 0);
                }
            }
        }

        currentDoc.push(d);
        totalCurrentLength += len + (currentDoc.length > 1 ? separatorLen : 0);
    }

    // Add the last chunk
    const lastDoc = currentDoc.join(_separator);
    if (lastDoc.trim()) {
        finalChunks.push(lastDoc);
    }

    // 4. Recurse on chunks that are still too big (using restricted separators)
    const validChunks: string[] = [];
    for (const chunk of finalChunks) {
        // Only recurse if chunk is too big AND we have smaller separators to try
        if (chunk.length > chunkSize && nextSeparators.length > 0) {
            const subChunks = recursiveChunking(chunk, chunkSize, chunkOverlap, nextSeparators);
            // safe push without spread to avoid max call stack size on large arrays
            for (const sub of subChunks) {
                validChunks.push(sub);
            }
        } else {
            validChunks.push(chunk);
        }
    }

    return validChunks;
}
