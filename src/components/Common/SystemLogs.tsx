import React, { useEffect, useRef, useState } from 'react';

interface LogEntry {
    timestamp: string;
    level: 'log' | 'error' | 'warn';
    message: string;
}

export const SystemLogs: React.FC = () => {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Connect to SSE
        const eventSource = new EventSource('http://localhost:3000/api/logs/stream');

        eventSource.onmessage = (event) => {
            try {
                const newLog = JSON.parse(event.data);
                setLogs(prev => [...prev.slice(-499), newLog]); // Keep last 500
            } catch (e) {
                // Ignore parse errors
            }
        };

        eventSource.onerror = () => {
            eventSource.close();
        };

        return () => {
            eventSource.close();
        };
    }, []);

    // Auto-scroll logic
    useEffect(() => {
        if (isOpen && bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, isOpen]);

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-4 right-4 z-50 bg-gray-800 text-white p-2 rounded-full shadow-lg hover:bg-gray-700 transition flex items-center gap-2 border border-gray-600"
                title="Open System Logs"
            >
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-xs font-mono">System Logs</span>
            </button>
        );
    }

    return (
        <div className="fixed bottom-0 left-0 right-0 h-1/3 bg-black/90 backdrop-blur-sm z-50 flex flex-col border-t border-gray-700 shadow-2xl transition-all duration-300">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-300">Terminal Output</span>
                    <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">{logs.length} lines</span>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setLogs([])}
                        className="text-xs text-gray-400 hover:text-white px-2 py-1"
                    >
                        Clear
                    </button>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="text-gray-400 hover:text-white"
                    >
                        ▼
                    </button>
                </div>
            </div>

            {/* Logs Area */}
            <div
                ref={containerRef}
                className="flex-grow overflow-y-auto p-4 font-mono text-xs space-y-1"
            >
                {logs.length === 0 && (
                    <div className="text-gray-600 italic">Waiting for connection...</div>
                )}

                {logs.map((log, idx) => (
                    <div key={idx} className="flex gap-2 hover:bg-white/5 p-0.5 rounded">
                        <span className="text-gray-500 shrink-0 select-none">
                            {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <span className={`break-words whitespace-pre-wrap ${log.level === 'error' ? 'text-red-400' :
                                log.level === 'warn' ? 'text-yellow-400' :
                                    'text-green-400'
                            }`}>
                            {log.message}
                        </span>
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>
        </div>
    );
};
