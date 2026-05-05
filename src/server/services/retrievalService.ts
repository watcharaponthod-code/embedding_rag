import { CONFIG } from "../config";
import {
  getEmbedding,
  generateAnswer,
  generateAnswerStream,
  rerank,
  rewriteQuery,
} from "./llmService";
import { getClient } from "../../utils/db"; // Singleton
import { searchCache } from "../../utils/cache";

export class RetrievalService {
  /**
   * Weighted Reciprocal Rank Fusion (RRF)
   */
  private rrfMerge(vectorResults: any[], ftsResults: any[]) {
    const scores = new Map<number, { score: number; doc: any }>();
    const k = CONFIG.SEARCH.RRF_K_CONSTANT;
    const VECTOR_WEIGHT = CONFIG.SEARCH.WEIGHT_VECTOR;
    const FTS_WEIGHT = CONFIG.SEARCH.WEIGHT_FTS;

    vectorResults.forEach((item, index) => {
      const score = (1 / (k + index + 1)) * VECTOR_WEIGHT;
      if (scores.has(item.id)) {
        scores.get(item.id)!.score += score;
      } else {
        scores.set(item.id, { score, doc: item });
      }
    });

    ftsResults.forEach((item, index) => {
      const score = (1 / (k + index + 1)) * FTS_WEIGHT;
      if (scores.has(item.id)) {
        scores.get(item.id)!.score += score;
      } else {
        scores.set(item.id, { score, doc: item });
      }
    });

    return Array.from(scores.values())
      .sort((a, b) => b.score - a.score)
      .map((item) => ({
        ...item.doc,
        rrf_score: item.score,
      }));
  }

  /**
   * Executes Hybrid Search (Vector + FTS)
   */
  async search(
    query: string,
    topK: number = 20,
    history?: { role: string; content: string }[],
    options: { useReranker?: boolean; clientName?: string; projectName?: string } = { useReranker: true }
  ) {
    let effectiveQuery = query;

    // Contextual Rewriting using History (if available)
    if (history && history.length > 0) {
      effectiveQuery = await rewriteQuery(query, history);
      if (!effectiveQuery || effectiveQuery.trim().length < 2) {
        console.warn(
          "[Search] Rewritten query is empty. Falling back to original query."
        );
        effectiveQuery = query;
      }
    }

    // 1. Check Cache (Use rewritten query as key + filters)
    // Cache key needs to include filters to avoid wrong results
    const cacheKey = `${effectiveQuery.trim()}_${topK}_${options.useReranker}_${options.clientName || ''}_${options.projectName || ''}`;
    const cachedResults = searchCache.get(cacheKey);
    if (cachedResults) {
      console.log(`[Search] Cache Hit: "${effectiveQuery}"`);
      return cachedResults;
    }

    console.log(
      `[Search] Cache Miss: "${effectiveQuery}" - Executing DB Search...`
    );
    const client = await getClient();
    try {
      const embedding = await getEmbedding(effectiveQuery);
      if (!embedding || embedding.length === 0) {
        console.error(
          "[Search] Failed to generate embedding for query:",
          effectiveQuery
        );
        return []; // Return empty results safely
      }
      const vectorStr = `[${embedding.join(",")}]`;

      const filterParams = [options.clientName || null, options.projectName || null];

      const [vectorRes, ftsRes] = await Promise.all([
        client.query(
          `SELECT dc.id, dc.doc_id, dc.content, dc.metadata 
                     FROM document_chunks dc
                     JOIN documents d ON dc.doc_id = d.id
                     WHERE d.document_name NOT ILIKE '%.xlsx' AND d.document_name NOT ILIKE '%.xls' AND d.document_name NOT ILIKE '%.csv'
                     AND ($3::text IS NULL OR d.client_name = $3)
                     AND ($4::text IS NULL OR d.project_name = $4)
                     ORDER BY dc.embedding <=> $1 LIMIT $2`,
          [vectorStr, CONFIG.SEARCH.TOP_K_VECTOR, ...filterParams]
        ),
        client.query(
          `SELECT dc.id, dc.doc_id, dc.content, dc.metadata 
                     FROM document_chunks dc
                     JOIN documents d ON dc.doc_id = d.id
                     WHERE dc.fts @@ plainto_tsquery('simple', $1) 
                     AND d.document_name NOT ILIKE '%.xlsx' AND d.document_name NOT ILIKE '%.xls' AND d.document_name NOT ILIKE '%.csv'
                     AND ($3::text IS NULL OR d.client_name = $3)
                     AND ($4::text IS NULL OR d.project_name = $4)
                     LIMIT $2`,
          [effectiveQuery, CONFIG.SEARCH.TOP_K_FTS, ...filterParams]
        ),
      ]);

      const candidates = this.rrfMerge(vectorRes.rows, ftsRes.rows);

      // --- Precision Reranking (Phase 3) ---
      let finalRanked = candidates;
      if (CONFIG.OLLAMA.MODEL_RERANKER && options.useReranker !== false) {
        const RERANK_TOP_K = CONFIG.SEARCH.RERANK_TOP_K;
        const subset = candidates.slice(0, RERANK_TOP_K);
        // Map to format required by rerank function
        const docsToRank = subset.map((c) => ({
          id: c.doc_id,
          content: c.content,
        }));

        const reranked = await rerank(effectiveQuery, docsToRank);
        const rerankedMap = new Map(reranked.map((r) => [r.id, r.score]));

        // Apply new scores. Reranked items get 0-10. Others keep small RRF score.
        finalRanked = candidates.map((c) => {
          if (rerankedMap.has(c.doc_id)) {
            return { ...c, rrf_score: rerankedMap.get(c.doc_id) };
          }
          return c;
        });

        finalRanked.sort((a, b) => b.rrf_score - a.rrf_score);
      }

      const topResults = finalRanked.slice(0, topK);

      const docIds = [...new Set(topResults.map((d) => d.doc_id))];
      let docNameMap = new Map();
      if (docIds.length > 0) {
        const docNamesRes = await client.query(
          "SELECT id, document_name FROM documents WHERE id = ANY($1)",
          [docIds]
        );
        docNameMap = new Map(
          docNamesRes.rows.map((d: any) => [d.id, d.document_name])
        );
      }

      const finalResults = topResults.map((r) => ({
        ...r,
        document_name: docNameMap.get(r.doc_id),
        score: r.rrf_score,
      }));

      // Save to Cache
      searchCache.set(cacheKey, finalResults);

      return finalResults;
    } finally {
      client.release();
    }
  }

  private async resolveImagePlaceholders(text: string, docId: number) {
    if (!text.includes('<<IMG_IDX_')) return text;

    const client = await getClient();
    try {
      const matches = [...text.matchAll(/<<IMG_IDX_(\d+)>>/g)];
      if (matches.length === 0) return text;
      const indices = [...new Set(matches.map(m => parseInt(m[1])))];

      const res = await client.query(
        "SELECT image_index, id FROM document_images WHERE doc_id = $1 AND image_index = ANY($2)",
        [docId, indices]
      );

      let newText = text;
      res.rows.forEach((row: any) => {
        newText = newText.replace(new RegExp(`<<IMG_IDX_${row.image_index}>>`, 'g'), `/api/images/${row.id}`);
      });

      return newText.replace(/<<IMG_IDX_\d+>>/g, '');
    } catch (e) {
      console.error("Image resolution error:", e);
      return text;
    } finally {
      client.release();
    }
  }

  async generateChatResponse(
    query: string,
    contextDocs: any[],
    history?: { role: string; content: string }[]
  ) {
    if (!contextDocs || contextDocs.length === 0) {
      return "ขออภัยครับ ไม่พบข้อมูลที่เกี่ยวข้องกับคำถามนี้ในฐานข้อมูลเอกสารของบริษัทครับ";
    }

    // Smart Truncation: Add chunks until limit reached to avoid cutting mid-sentence
    let currentLength = 0;
    const MAX_CONTEXT_LEN = 12000;
    const selectedChunks: string[] = [];

    for (const d of contextDocs) {
      if (d.content) d.content = await this.resolveImagePlaceholders(d.content, d.doc_id);
      const chunkText = `Source: [${d.document_name} - Page ${d.metadata?.page || "?"
        }]\nContent: ${d.content}`;
      if (currentLength + chunkText.length > MAX_CONTEXT_LEN) break;

      selectedChunks.push(chunkText);
      currentLength += chunkText.length + 2;
    }

    const contextText = selectedChunks.join("\n\n");

    return await generateAnswer(query, contextText, history);
  }

  async generateChatResponseStream(
    query: string,
    contextDocs: any[],
    onData: (token: string) => void,
    history?: { role: string; content: string }[]
  ) {
    // Smart Truncation for Stream as well
    let currentLength = 0;
    const MAX_CONTEXT_LEN = 12000;
    const selectedChunks: string[] = [];

    for (const d of contextDocs) {
      if (d.content) d.content = await this.resolveImagePlaceholders(d.content, d.doc_id);
      const chunkText = `Source: [${d.document_name} - Page ${d.metadata?.page || "?"
        }]\nContent: ${d.content}`;
      if (currentLength + chunkText.length > MAX_CONTEXT_LEN) break;

      selectedChunks.push(chunkText);
      currentLength += chunkText.length + 2;
    }

    const contextText = selectedChunks.join("\n\n");

    return await generateAnswerStream(query, contextText, onData, history);
  }

  /**
   * Fetch document details and full content by ID
   */
  async getDocumentDetails(id: string) {
    const client = await getClient();
    try {
      const docRes = await client.query(
        "SELECT * FROM documents WHERE id = $1",
        [id]
      );
      if (docRes.rows.length === 0) return null;

      const doc = docRes.rows[0];

      // --- Fetch Related Documents (Same Source/Email) ---
      let relatedDocuments: any[] = [];
      if (doc.source_id) {
        try {
          const relatedRes = await client.query(
            "SELECT id, document_name, file_type FROM documents WHERE source_id = $1 AND id != $2 ORDER BY id ASC",
            [doc.source_id, id]
          );
          relatedDocuments = relatedRes.rows.map(r => ({
            id: r.id,
            filename: r.document_name,
            file_type: r.file_type
          }));
        } catch (err) {
          console.warn("Failed to fetch related docs:", err);
        }
      }
      // ---------------------------------------------------

      const chunksRes = await client.query(
        `
                SELECT content, metadata 
                FROM document_chunks 
                WHERE doc_id = $1 
                ORDER BY id ASC
            `,
        [id]
      );

      const fullContent = chunksRes.rows
        .map((c: any) => {
          const headers = c.metadata.header_path
            ? c.metadata.header_path.join(" > ")
            : "";
          return `### ${headers}\n${c.metadata.page ? `[Page ${c.metadata.page}] ` : ""
            }${c.content}`;
        })
        .join("\n\n");

      // Fetch Images
      const imagesRes = await client.query(
        "SELECT id, page_number FROM document_images WHERE doc_id = $1 ORDER BY page_number ASC, image_index ASC",
        [id]
      );

      const images = imagesRes.rows.map((img: any) => ({
        src: `/api/images/${img.id}`,
        page: img.page_number
      }));

      return {
        id: doc.id,
        filename: doc.document_name,
        content: fullContent,
        uploadDate: doc.created_at,
        images: images,
        projectName: doc.project_name,
        clientName: doc.client_name,
        relatedDocuments // New Field
      };
    } finally {
      client.release();
    }
  }
  /**
   * Post-processes the LLM response to extract citations and filter sources.
   * Enforces the rule: "Only show sources that were actually used or strongly relevant."
   */
  processResponseAndSources(
    answer: string,
    contextDocs: any[]
  ): { answer: string; sources: any[] } {
    let filteredDocs = contextDocs;
    let cleanAnswer = answer;

    if (cleanAnswer) {
      // Robust Regex: Case-insensitive, flexible spacing
      const sourceMatch = cleanAnswer.match(/SOURCES_USED:\s*(.*)$/i);

      if (sourceMatch) {
        const usedSourcesStr = sourceMatch[1];

        // Remove the tag from the answer shown to user
        cleanAnswer = cleanAnswer.replace(/SOURCES_USED:[\s\S]*$/, "").trim();

        // FIX: If LLM only returned the source tag and no content, provide a fallback message.
        if (!cleanAnswer) {
          cleanAnswer =
            "พบข้อมูลในเอกสารที่เกี่ยวข้อง แต่ระบบไม่สามารถสร้างบทสรุปที่ชัดเจนได้ครับ (อาจเป็นเพราะข้อมูลเป็นตารางขนาดใหญ่หรือรูปแบบซับซ้อน)";
        }

        // Check for NONE (case insensitive)
        if (/none/i.test(usedSourcesStr)) {
          filteredDocs = [];
        } else {
          // Parse filenames: [file1], [file2]
          const usedFilenames =
            usedSourcesStr
              .match(/\[(.*?)\]/g)
              ?.map((s) => s.replace(/[\[\]]/g, "").trim()) || [];

          if (usedFilenames.length > 0) {
            // Filter contextDocs to only include those in usedFilenames
            filteredDocs = contextDocs.filter((doc) =>
              usedFilenames.some(
                (used) =>
                  doc.document_name.includes(used) ||
                  used.includes(doc.document_name)
              )
            );
          }
        }
      } else {
        // FALLBACK: INTELLIGENT SCORE FILTERING
        // Problem: Simply taking Top 2 might include irrelevant docs if they are rank #2.
        // Solution: Use Relative Score Thresholding with Scale Detection.

        // 1. Find the Max Score (Best Match)
        const maxScore = Math.max(...contextDocs.map((d) => d.score || 0));

        if (maxScore > 0) {
          let minAcceptableScore = 0;

          // Adaptive Thresholding:
          // Detect if we are using Reranker Scores (0-10 scale) or RRF Scores (0-1 scale)
          if (maxScore > 1.0) {
            // Reranker Mode: Stricter absolute threshold.
            // Prompt defines: "0-3: Irrelevant", "4-6: Vaguely related".
            // We strictly filter out explicit garbage (< 2.5).
            const RERANKER_MIN_THRESHOLD = 2.5;
            minAcceptableScore = RERANKER_MIN_THRESHOLD;
          } else {
            // RRF Mode: Relative threshold.
            // Since RRF scores are small and relative, keep docs that are at least 10% as relevant as the best match.
            const RRF_RATIO = 0.1;
            minAcceptableScore = maxScore * RRF_RATIO;
          }

          filteredDocs = contextDocs.filter(
            (d) => (d.score || 0) >= minAcceptableScore
          );

          // Note: We deliberately allow filteredDocs to be empty if all scores are low.
          // This prevents showing irrelevant "best guesses" (e.g. searching for VHQ and getting SBOM).
        } else {
          // If no scores available (pure vector search), careful fallback.
          // Without scores, we can't judge relevance. Safest is to show nothing or just the very top 1 if we trust vector search.
          // Given the constraint "don't show unrelated", showing nothing is safer.
          filteredDocs = [];
        }
      }
    }

    return { answer: cleanAnswer, sources: filteredDocs };
  }
}

export const retrievalService = new RetrievalService();
