import React, { useState, useRef } from 'react';
import { Check, Copy } from 'lucide-react';

export const PreBlock = ({ children, ...props }: any) => {
    const [copied, setCopied] = useState(false);
    const preRef = useRef<HTMLPreElement>(null);

    const handleCopy = async () => {
        if (preRef.current) {
            const text = preRef.current.innerText;
            try {
                await navigator.clipboard.writeText(text);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            } catch (err) {
                console.error('Failed to copy:', err);
            }
        }
    };

    return (
        <div className="relative my-4 group rounded-xl overflow-hidden border border-gray-800 shadow-lg">
            {/* Header / Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 bg-[#2d2d2d] border-b border-gray-700">
                <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">
                    Code
                </span>
                <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-all text-[10px] font-bold uppercase tracking-wider"
                >
                    {copied ? (
                        <>
                            <Check size={12} className="text-green-400" />
                            <span className="text-green-400">Copied!</span>
                        </>
                    ) : (
                        <>
                            <Copy size={12} />
                            <span>Copy</span>
                        </>
                    )}
                </button>
            </div>

            {/* Code Content */}
            <pre
                ref={preRef}
                className="bg-[#1e1e1e] text-gray-100 p-4 overflow-x-auto text-xs leading-relaxed font-mono custom-scrollbar"
                {...props}
            >
                {children}
            </pre>
        </div>
    );
};
