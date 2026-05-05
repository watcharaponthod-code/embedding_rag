import axios from "axios";
import { CONFIG } from "../config";

const ollamaClient = axios.create({
  baseURL: CONFIG.OLLAMA.HOST,
});

export const getEmbedding = async (text: string): Promise<number[]> => {
  try {
    // Sanitize: Remove null bytes and excessive repetitions that might trigger NaN
    const cleanText = text.replace(/\0/g, "").substring(0, 8000);

    const response = await ollamaClient.post(
      "/api/embeddings",
      {
        model: CONFIG.OLLAMA.MODEL_EMBEDDING,
        prompt: cleanText,
      },
      { timeout: CONFIG.OLLAMA.TIMEOUT_EMBED }
    );

    return response.data.embedding;
  } catch (error: any) {
    console.error("Embedding Error (Attempt 1):", error);
    console.warn(`[LLM] Embedding failed. Retrying with aggressive truncation/sanitization in 2s...`);

    // Wait 2 seconds for GPU to recover
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Retry with aggressive cleanup & truncation
    const cleanText = text.replace(/[^\w\s\u0E00-\u0E7F.,-]/g, '').substring(0, 1500);

    try {
      console.log("Retrying with truncated text...");
      const response = await ollamaClient.post(
        "/api/embeddings",
        {
          model: CONFIG.OLLAMA.MODEL_EMBEDDING,
          prompt: text.substring(0, 2000), // Aggressive truncation
        },
        { timeout: CONFIG.OLLAMA.TIMEOUT_EMBED }
      );
      return response.data.embedding;
    } catch (retryError) {
      console.error("Embedding Final Fail:", retryError);
      throw retryError;
    }
  }
};

export const rewriteQuery = async (
  query: string,
  history: { role: string; content: string }[]
): Promise<string> => {
  try {
    if (!history || history.length === 0) return query;

    const historyText = history
      .slice(-3)
      .map(
        (h) =>
          `${h.role === "user" ? "User" : "Assistant"}: ${h.content.replace(
            /\n/g,
            " "
          )}`
      )
      .join("\n");

    console.log(`[Rewrite] Rewriting query with history...`);
    const response = await ollamaClient.post(
      "/api/generate",
      {
        model: CONFIG.OLLAMA.MODEL_CHAT,
        prompt: `
            Task: Rewrite the last user question to be a standalone search query based on the conversation history.
            
            Conversation History:
            ${historyText}
            
            Last User Question: "${query}"
            
            Instructions:
            1. Replace pronouns (it, they, he, that) with specific entities from history.
            2. Keep it concise.
            3. Output ONLY the rewritten query. No preamble.
            4. If the question is already standalone, output it exactly as is.
            
            Rewritten Query:`,
        stream: false,
        options: {
          temperature: 0.0, // Strict
          num_predict: 50, // Short output
        },
      },
      { timeout: 10000 }
    ); // Fast timeout

    // Create a cleaner rewriting: remove quotes, dots, prefixes
    let rewritten = response.data.response.trim();
    rewritten = rewritten.replace(/^["']|["']$/g, ""); // Remove surrounding quotes
    rewritten = rewritten.replace(/\.$/, ""); // Remove trailing dot

    console.log(`[Rewrite] "${query}" -> "${rewritten}"`);
    return rewritten;
  } catch (error) {
    console.warn("[Rewrite] Failed, using original query.", error);
    return query;
  }
};

export const generateAnswer = async (
  query: string,
  context: string,
  history: { role: string; content: string }[] = []
): Promise<string> => {
  return generateAnswerStream(query, context, undefined, history);
};

export const generateAnswerStream = async (
  query: string,
  context: string,
  onData?: (token: string) => void,
  history: { role: string; content: string }[] = []
): Promise<string> => {
  try {
    const historyText = history
      .slice(-5)
      .map(
        (h) =>
          `${h.role === "user" ? "User" : "Assistant"}: ${h.content.replace(
            /\n/g,
            " "
          )}`
      )
      .join("\n");

    // const prompt = `
    // You are an intelligent, helpful assistant for Sycapt Company.

    // ### GOAL:
    // Answer the user's question **comprehensively and in detail**.
    // Do not be afraid to write a long response if necessary to cover all information found in the context.
    // Ensure every key point from the source is included.
    // **CRITICAL:** If the source data is from a Table/Excel/CSV, you must **SUMMARIZE it as text**.
    // **DO NOT generate a Markdown Table** unless explicitly asked.

    // ### ⚡ IMPORTANT RULES:
    // 1. **PRIORITY**:
    //    - Use information from [CONTEXT] as the **primary source of truth**.
    //    - Use [CONVERSATION HISTORY] only for context (e.g., resolving "it", "that").
    //    - If History contradicts Context, **TRUST THE CONTEXT**.
    // 2. **CONTEXT USAGE & SCOPE**:
    //    - **CASUAL/SMALL TALK**: You can be polite and brief (e.g., "Hello", "Ready to help").
    //    - **IRRELEVANT REQUESTS**: If user asks about non-work topics (e.g., "Food", "General Trivia"), **REFUSE POLITELY & DIPLOMATICALLY**.
    //      - Response: "ขออภัยครับ ในฐานะ AI ผู้ช่วยด้านข้อมูลบริษัท ผมอาจจะไม่ถนัดเรื่องนี้ แต่ถ้าเป็นเรื่องงานหรือเอกสาร ผมพร้อมช่วยเหลือเต็มที่ครับ"
    //    - **NOT FOUND**: If information is missing, state clearly: "จากการสืบค้นในเอกสาร ยังไม่พบข้อมูลดังกล่าวครับ" (Do not hallucinate).
    //    - **RAW DATA**: Synthesize raw rows into summaries.

    // 3. **DATA FORMATTING**:
    //    - **Structured Data?** -> Write a clear summary paragraph.
    //    - **No Tables** (unless user asks for one).

    // 4. **LANGUAGE**:
    //    - **ALWAYS Answer in THAI (ภาษาไทย)** if the user asks in Thai.
    //    - Use polite particles (ครับ/ค่ะ).

    // 5. **STYLE**:
    //    - **Persona**: An **Intelligent & Professional Assistant**.
    //    - Tone: Smart, Crisp, Helpful, and Trustworthy. (Not overly casual, not robotic).

    // 6. **CITATIONS (STRICT)**:
    //    - You MUST cite the source **immediately** after the sentence that uses it.
    //    - Format: "Content ... [Source: filename]"
    //    - Example: "Revenue was 5M [Source: report.pdf]. Expenses were 2M [Source: budget.xlsx]."
    //    - At the very end, list all used sources again as summary: SOURCES_USED: [file1]

    // ### EXAMPLES (Few-Shot):
    // User: ปิดไว้นะจ๊ะ ใช้ทำอะไร?
    // Assistant: จากข้อมูลที่พบ ปิดไว้นะจ๊ะ ถูกใช้งานหลักๆ สำหรับการจัดการสินเชื่อและธุรกรรมการเงินครับ โดยระบบจะช่วยตรวจสอบเอกสารอัตโนมัติ [ปิดไว้นะจ๊ะ Documents]

    // User: API Key อยู่ที่ไหน
    // Assistant: คุณสามารถหา API Key ได้ที่หน้า Settings ของระบบครับ ซึ่งจะอยู่ในเมนู Developer Tools [User Manual]

    // ---
    // [CONTEXT / บริบท] (PRIMARY SOURCE)
    // ${context}
    // ---
    // [CONVERSATION HISTORY] (SECONDARY CONTEXT)
    // ${historyText}
    // ---

    // User Question: ${query}

    // Answer (Natural & Helpful):
    // `;

    const prompt = `
### ROLE
### ROLE
You are a Technical Support Assistant for a Payment System Company. Your primary function is to retrieve and explain information from internal documentation, specifically distinguishing between "Project Documents" (features, architecture, specs) and "Bug Reports" (issues, errors, fixes).

### INSTRUCTIONS
1.  **Analyze the Context:** You will be provided with a set of retrieved documents. Determine if the relevant information comes from a Project Specification or a Bug Report.
2.  **Use History:** Refer to the **CHAT HISTORY** to maintain context if the user refers to previous messages.
3.  **Cite Sources:** For every piece of information you provide, you must indicate the source using the strict format "[Source: filename]" immediately after the relevant sentence.
4.  **Be Accurate & Concise:** Provide direct answers. Avoid marketing fluff. Focus on the technical facts.
5.  **Strict Context Adherence:** Answer ONLY using the information provided in the "Context" section.
6. **Handling Unknowns:** If the answer is not explicitly stated but related information exists in the [CONTEXT], provide the best possible answer based on that information. Only if the context is completely empty or irrelevant, state: "I do not have enough information in the provided documents to answer this question."
7. **Language Policy:** You must answer strictly in either English or Thai, matching the language of the user's question. If answering in Thai, you must keep all technical terms in English (e.g., do not translate "API", "Bug Report", "Latency" into Thai).

### FORMATTING RULES
- **Clean Text Only:** Use standard punctuation and bullet points.
- **Citation Style:** You MUST use "[Source: filename]" for citations. Example: "The revenue is 5M [Source: annual_report.pdf]."
- **Images (CRITICAL):** You MUST include images if they are present in the context.
  - **Combine Text & Image:** Do not choose one. Explain the topic in text AND show the relevant image immediately after.
  - **Output:** Use the exact Markdown tag provided (e.g., \`![Image](/api/images/...)\`).
  - **Never:** Do not suppress images or maintain them as text descriptions. 
- **No Emojis:** Do not use emojis, icons, or non-standard symbols.
- **Structure:** Use clear headings (e.g., "Summary", "Details") to organize your response.
- **Source Listing:** Always end your response with a "Sources" section listing the specific documents used.

---

### CHAT HISTORY
${historyText}

### CONTEXT
${context}

### USER QUESTION
${query}

### YOUR RESPONSE`;

    const isStreaming = !!onData;

    if (isStreaming) {
      const response = await ollamaClient.post(
        "/api/generate",
        {
          model: CONFIG.OLLAMA.MODEL_CHAT,
          prompt: prompt,
          stream: true,
          options: {
            temperature: 0.1, // Strict for Facts (Karpathy's advice)
            num_ctx: 4096,
            num_predict: 4096,
          },
        },
        { responseType: "stream", timeout: CONFIG.OLLAMA.TIMEOUT_CHAT }
      );

      let fullText = "";
      const stream = response.data;

      return new Promise((resolve, reject) => {
        stream.on("data", (chunk: Buffer) => {
          try {
            const lines = chunk
              .toString()
              .split("\n")
              .filter((line) => line.trim() !== "");
            for (const line of lines) {
              const json = JSON.parse(line);
              if (json.response) {
                fullText += json.response;
                if (onData) onData(json.response);
              }
              if (json.done) {
                resolve(fullText);
              }
            }
          } catch (e) {
            // ignore partial chunks
          }
        });

        stream.on("end", () => resolve(fullText));
        stream.on("error", (err: any) => reject(err));
      });
    } else {
      const response = await ollamaClient.post(
        "/api/generate",
        {
          model: CONFIG.OLLAMA.MODEL_CHAT,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.1, // Strict for Facts (Karpathy's advice)
            num_ctx: 4096,
            num_predict: 4096,
          },
        },
        { timeout: CONFIG.OLLAMA.TIMEOUT_CHAT }
      );
      return response.data.response;
    }
  } catch (error: any) {
    console.error("Answer Generation Error:", error.message);
    return "Sorry, I encountered an error while generating the answer.";
  }
};

/**
 * Reranks a list of documents based on relevance to the query.
 * Uses a scoring prompt with the configured reranker model.
 */
export const rerank = async (
  query: string,
  documents: { id: any; content: string }[]
): Promise<{ id: any; score: number; index: number }[]> => {
  try {
    if (!documents || documents.length === 0) return [];

    console.log(
      `[Rerank] Reranking ${documents.length} docs with ${CONFIG.OLLAMA.MODEL_RERANKER}`
    );

    // Serial processing to avoid OOM with heavy models (as per expert panel)
    const scores = [];
    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      try {
        // Cross-Encoder style prompt for relevance scoring
        const response = await ollamaClient.post(
          "/api/generate",
          {
            model: CONFIG.OLLAMA.MODEL_RERANKER,
            prompt: `You are a strict relevance grader.
Query: "${query}"

Document Snippet:
"${doc.content.substring(0, 800)}..."

Task: Rate the relevance of the document to the query on a scale of 0.0 to 10.0.
Criteria:
- 10: Contains the exact answer/data.
- 7-9: Highly relevant, closely related topic.
- 4-6: Vaguely related, different context.
- 0-3: Irrelevant, wrong topic, garbage.

Output ONLY the number (e.g., 8.5). Be critical. If unrelated, give 0.
Score:`,
            stream: false,
            options: {
              temperature: 0.0,
              num_predict: 6,
            },
          },
          { timeout: CONFIG.OLLAMA.TIMEOUT_RERANK }
        );

        const text = response.data.response.trim();
        const match = text.match(/\d+(\.\d+)?/);
        const score = match ? parseFloat(match[0]) : 0;

        // Add a small boost for being earlier in the original list (stability)
        const stabilityBoost = (documents.length - i) * 0.001;

        scores.push({ ...doc, score: score + stabilityBoost, index: i });
      } catch (e) {
        console.warn(`[Rerank] Failed for doc index ${i}, assigning 0 score.`);
        scores.push({ ...doc, score: 0, index: i });
      }
    }

    return scores.sort((a, b) => b.score - a.score);
  } catch (error: any) {
    console.error("[Rerank] System Error:", error.message);
    // Fallback: return original order
    return documents.map((d, i) => ({ ...d, score: 0, index: i }));
  }
};
