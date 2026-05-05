import { Bot, ExternalLink, FileText, Loader2, Send } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { PreBlock } from "./PreBlock";

interface Source {
  id: string;
  document_name: string;
  chunk_header: string;
  content: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  isSearching?: boolean;
}

const NEGATIVE_PHRASES = [
  "ขออภัย",
  "ไม่พบข้อมูล",
  "ข้อมูลไม่เพียงพอ",
  "ไม่สามารถตอบ",
  "ฐานข้อมูลของบริษัทไม่มีข้อมูล",
  "sorry",
  "don't have enough",
  "doesn't contain",
  "unable to answer",
];

/**
 * Smartly decides if sources should be shown based on AI response.
 * If AI says "I don't know" or "Not found", hiding sources reduces confusion.
 */
const shouldShowSources = (content: string) => {
  const lower = content.toLowerCase();
  return !NEGATIVE_PHRASES.some((phrase) => lower.includes(phrase));
};

export const ChatView: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (messages.length > 0 || loading) {
      scrollToBottom();
    }
  }, [messages, loading]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: "user", content: input };
    const userQuery = input;

    // 1. Add User Message
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    // 2. Add Placeholder Assistant Message
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: "",
        isSearching: true,
        sources: [],
      },
    ]);

    try {
      // Use NON-STREAMING endpoint to get full text at once for perfect Markdown rendering
      // Send recent history (last 5 messages) for context awareness
      const history = messages
        .slice(-5)
        .map((m) => ({ role: m.role, content: m.content }));

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: userQuery, history }),
      });

      const data = await response.json();

      if (data.error) throw new Error(data.error);

      setMessages((prev) => {
        const last = prev[prev.length - 1];
        return [
          ...prev.slice(0, -1),
          {
            ...last,
            role: "assistant",
            content: data.answer,
            sources: data.sources,
            isSearching: false,
          },
        ];
      });
    } catch (error) {
      console.error("Chat Error:", error);
      setMessages((prev) => [
        ...prev.slice(0, -1), // Remove the loading placeholder
        {
          role: "assistant",
          content: "Sorry, I can't connect to the server right now.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Filter sources to only those explicitly cited in the content.
   * Matches [Source: filename] patterns.
   */
  const filterSourcesByContent = (sources: Source[], content: string) => {
    if (!sources || sources.length === 0) return [];

    // Extract all [Source: ...] tags (case insensitive, supporting 'Source:' or 'Sources:')
    const matches = content.match(/\[Sources?:\s*(.*?)\]/gi);
    if (!matches) return [];

    const citations = matches.map((m) =>
      m
        .replace(/^\[Sources?:\s*/i, "")
        .replace(/\]$/, "")
        .trim()
        .toLowerCase()
    );

    return sources.filter((src) => {
      const name = src.document_name.toLowerCase();
      // Check for partial match/inclusion
      return citations.some(
        (citation) => citation.includes(name) || name.includes(citation)
      );
    });
  };

  const getUniqueSources = (sources: Source[]) => {
    if (!sources || sources.length === 0) return [];
    const unique = new Map<string, Source>();

    sources.forEach((src) => {
      const key = src.document_name;

      if (!unique.has(key)) {
        unique.set(key, src);
      }
    });

    return Array.from(unique.values());
  };

  return (
    <div className="w-full h-full flex flex-col bg-white overflow-hidden font-sans">
      {/* Header Removed for Full Immersion */}

      {/* Messages Area */}
      <div className="flex-grow overflow-y-auto p-6 space-y-8 bg-gradient-to-b from-gray-50 to-white scroll-smooth">
        {messages.length === 0 && (
          <div
            className="flex flex-col items-center justify-center h-full text-center space-y-6 animate-fade-in"
            style={{ animationDelay: "0.2s", animationFillMode: "both" }}
          >
            <div className="w-20 h-20 bg-sycapt-light-gray rounded-full flex items-center justify-center mb-4 ring-1 ring-sycapt-border shadow-soft">
              <Bot className="h-10 w-10 text-sycapt-gray" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-sycapt-dark mb-2">
                How can I help you today?
              </h2>
              <p className="text-gray-400 max-w-xs mx-auto">
                I can analyze your uploaded documents and answer complex
                questions about them.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 max-w-sm w-full">
              {[
                "Summarize the latest report",
                "Find technical specifications",
                "What are the key risks?",
              ].map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setInput(suggestion);
                  }}
                  className="px-4 py-3 bg-white border border-sycapt-border rounded-xl text-sm text-sycapt-gray hover:border-sycapt-red hover:text-sycapt-red hover:shadow-soft transition-all text-left"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`animate-slide-up ${msg.role === "user"
              ? "flex justify-end"
              : "flex flex-col items-start"
              }`}
          >
            {/* Buปิดไว้นะจ๊ะe */}
            <div
              className={`max-w-[85%] rounded-xl px-6 py-5 shadow-sm text-sm leading-relaxed relative ${msg.role === "user"
                ? "bg-gradient-to-br from-sycapt-red to-red-600 text-white ml-auto shadow-lg shadow-red-100" // User: Enhanced gradient
                : "bg-white text-gray-800 border border-gray-100 shadow-sm" // Assistant: Clean
                }`}
            >
              {/* Bot Loading Animation */}
              {msg.isSearching ? (
                <div className="flex items-center space-x-3 text-gray-500 py-1">
                  <Loader2 size={18} className="animate-spin text-sycapt-red" />
                  <span className="font-medium text-gray-600">
                    Analyzing documents & thinking...
                  </span>
                </div>
              ) : (
                <div
                  className="prose prose-sm max-w-none 
                                    prose-headings:font-bold prose-headings:text-gray-900 
                                    prose-p:text-gray-700 prose-p:leading-7 
                                    prose-a:text-sycapt-red prose-a:font-semibold prose-a:no-underline hover:prose-a:underline
                                    prose-strong:text-gray-900 prose-strong:font-bold
                                    prose-ul:my-4 prose-li:my-1
                                    prose-code:text-sycapt-red prose-code:bg-red-50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:before:content-none prose-code:after:content-none
                                    prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-pre:rounded-xl prose-pre:p-4 prose-pre:shadow-inner
                                "
                >
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      img: ({ node, ...props }) => (
                        <div className="my-4">
                          <img
                            {...props}
                            className="rounded-lg border border-gray-200 shadow-sm max-w-full h-auto object-contain mx-auto hover:shadow-md transition-all"
                            style={{ maxHeight: "400px" }}
                          />
                          {props.alt && props.alt !== "Image" && (
                            <p className="text-center text-xs text-gray-500 mt-2 italic">
                              {props.alt}
                            </p>
                          )}
                        </div>
                      ),
                      h1: ({ node, ...props }) => (
                        <h1
                          className={`text-2xl font-extrabold mb-4 pb-2 border-b border-gray-100 ${msg.role === "user"
                            ? "text-white border-white/20"
                            : "text-gray-900"
                            }`}
                          {...props}
                        />
                      ),
                      h2: ({ node, ...props }) => (
                        <h2
                          className={`text-xl font-bold mb-3 mt-6 ${msg.role === "user" ? "text-white" : "text-gray-800"
                            }`}
                          {...props}
                        />
                      ),
                      h3: ({ node, ...props }) => (
                        <h3
                          className={`text-lg font-bold mb-2 mt-4 ${msg.role === "user" ? "text-white" : "text-gray-800"
                            }`}
                          {...props}
                        />
                      ),
                      p: ({ node, ...props }) => (
                        <p
                          className={`mb-3 last:mb-0 leading-relaxed tracking-wide ${msg.role === "user"
                            ? "text-white/90"
                            : "text-gray-700"
                            }`}
                          {...props}
                        />
                      ),
                      ul: ({ node, ...props }) => (
                        <ul
                          className={`list-disc list-outside ml-4 space-y-1 mb-4 ${msg.role === "user"
                            ? "text-white/90 marker:text-white/50"
                            : "text-gray-700 marker:text-sycapt-red"
                            }`}
                          {...props}
                        />
                      ),
                      ol: ({ node, ...props }) => (
                        <ol
                          className={`list-decimal list-outside ml-4 space-y-1 mb-4 ${msg.role === "user"
                            ? "text-white/90 marker:text-white/50"
                            : "text-gray-700 marker:text-sycapt-red"
                            }`}
                          {...props}
                        />
                      ),
                      code: ({ node, ...props }) => (
                        <code
                          className={`font-mono text-xs px-1.5 py-0.5 rounded border ${msg.role === "user"
                            ? "bg-white/20 text-white border-white/20"
                            : "bg-gray-100 text-pink-600 border-gray-200"
                            }`}
                          {...props}
                        />
                      ),
                      pre: PreBlock,
                      blockquote: ({ node, ...props }) => (
                        <blockquote
                          className={`border-l-4 pl-4 italic my-4 py-1.5 ${msg.role === "user"
                            ? "border-white/40 text-white/80"
                            : "border-sycapt-red/40 text-gray-600 bg-gray-50 rounded-r-lg"
                            }`}
                          {...props}
                        />
                      ),
                      table: ({ node, ...props }) => (
                        <div className="overflow-x-auto my-6 rounded-xl border border-gray-200 shadow-sm bg-white">
                          <table
                            className="min-w-full divide-y divide-gray-100"
                            {...props}
                          />
                        </div>
                      ),
                      th: ({ node, ...props }) => (
                        <th
                          className="px-6 py-4 bg-gray-50/80 text-left text-xs font-bold text-gray-500 uppercase tracking-wider sticky top-0"
                          {...props}
                        />
                      ),
                      tr: ({ node, ...props }) => (
                        <tr
                          className="group hover:bg-red-50/30 transition-colors even:bg-gray-50/30"
                          {...props}
                        />
                      ),
                      td: ({ node, ...props }) => (
                        <td
                          className="px-6 py-4 text-sm text-gray-600 border-b border-gray-100 last:border-0 align-top leading-relaxed group-hover:text-gray-900 transition-colors"
                          {...props}
                        />
                      ),
                      a: ({ node, ...props }) => (
                        <a
                          className={`inline-flex items-center gap-1 font-semibold transition-all border-b border-dashed border-opacity-50 hover:border-opacity-100 ${msg.role === "user"
                            ? "text-white border-white hover:border-white"
                            : "text-sycapt-red border-sycapt-red hover:bg-red-50 px-1 py-0.5 rounded -mx-1"
                            }`}
                          target="_blank"
                          rel="noopener noreferrer"
                          {...props}
                        >
                          {props.children}
                          <ExternalLink size={12} className="opacity-70" />
                        </a>
                      ),
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              )}
            </div>

            {/* Sources List - Conditionally Rendered */}
            {!msg.isSearching &&
              msg.sources &&
              msg.sources.length > 0 &&
              shouldShowSources(msg.content) && (
                <div className="mt-4 ml-6 w-full max-w-[85%] animate-fade-in delay-300">
                  <div className="flex items-center space-x-2 mb-3">
                    <div className="h-px bg-gray-200 w-8"></div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-white px-2">
                      Sources Referenced
                    </span>
                    <div className="h-px bg-gray-200 flex-grow max-w-[100px]"></div>
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    {getUniqueSources(
                      filterSourcesByContent(msg.sources, msg.content)
                    ).map((src, i) => (
                      <div
                        key={i}
                        className="group flex items-center space-x-2.5 bg-white px-3 py-2 rounded-xl border border-gray-200 hover:border-sycapt-red/40 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 cursor-help"
                        title={`Source: ${src.document_name}`}
                      >
                        <div className="p-1.5 bg-gray-50 rounded-lg group-hover:bg-red-50 transition-colors">
                          <FileText
                            size={14}
                            className="text-gray-400 group-hover:text-sycapt-red transition-colors"
                          />
                        </div>
                        <div>
                          <p className="text-[11px] font-bold text-gray-700 group-hover:text-gray-900 transition-colors max-w-[150px] truncate">
                            {src.document_name}
                          </p>
                          {/* <p className="text-[10px] text-gray-400 truncate max-w-[150px]">{src.chunk_header}</p> */}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form
        onSubmit={handleSend}
        className="p-3 bg-white border-t border-gray-100 relative z-20"
      >
        <div className="relative flex items-center group max-w-4xl mx-auto">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything about your documents..."
            className="w-full pl-5 pr-12 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-sycapt-red/30 focus:ring-2 focus:ring-red-500/5 transition-all shadow-sm"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="absolute right-2.5 p-2 bg-gradient-to-br from-sycapt-red to-red-600 text-white rounded-xl shadow-md shadow-red-200 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 disabled:shadow-none transition-all duration-200"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Send size={20} />
            )}
          </button>
        </div>
        <div className="text-center mt-3">
          <p className="text-[10px] text-gray-300 font-medium tracking-wide">
            AI-GENERATED CONTENT • CHECK FOR ACCURACY
          </p>
        </div>
      </form>
    </div>
  );
};
