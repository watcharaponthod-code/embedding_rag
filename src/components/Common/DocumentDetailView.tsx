import React, { useEffect, useState } from 'react';
import { ArrowLeft, Save, Trash2, Calendar, FileText, Hash, Tag, Loader2, Check, Edit3, Eye, FileEdit, ChevronDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useDocuments } from '../contexts/DocumentContext';
import { getDocumentById, updateDocument, deleteDocument } from '../../server/services/apiService';
import { DocumentDetail } from '../../types';

interface DocumentDetailViewProps {
    docId: string;
    onBack: () => void;
    onNavigate?: (id: string) => void;
}

export const DocumentDetailView: React.FC<DocumentDetailViewProps> = ({ docId, onBack, onNavigate }) => {
    const { filterOptions, deleteDocument: contextDeleteDocument, refreshFilters } = useDocuments();
    const [doc, setDoc] = useState<DocumentDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [content, setContent] = useState('');
    const [filename, setFilename] = useState('');
    const [projectName, setProjectName] = useState('');
    const [clientName, setClientName] = useState('');
    const [isEditing, setIsEditing] = useState(false);

    // Load data
    useEffect(() => {
        const fetchDoc = async () => {
            if (!docId || docId === 'undefined') {
                setError('Invalid Document ID');
                setLoading(false);
                return;
            }

            try {
                const data = await getDocumentById(docId);
                if (data) {
                    setDoc(data);
                    setContent(data.content || '');
                    setFilename(data.filename || 'Untitled Document');
                    setProjectName(data.projectName || '');
                    setClientName(data.clientName || '');
                } else {
                    setError('Document not found');
                }
            } catch (err) {
                setError('Failed to load document details');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchDoc();
    }, [docId]);

    const handleSave = async () => {
        if (!doc) return;
        setSaving(true);
        try {
            // Use updateDocument(id, content, filename, metadata) signature
            const success = await updateDocument(doc.id, content, filename, { projectName, clientName });
            if (success) {
                const updatedDoc = await getDocumentById(doc.id);
                if (updatedDoc) setDoc(updatedDoc);
                alert('Document updated successfully! Content re-embedded.');
                setIsEditing(false);
                // Refresh global filters in case client/project name changed
                refreshFilters();
            } else {
                alert('Failed to update document.');
            }
        } catch (e) {
            console.error(e);
            alert('Error updating document.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!doc) return;
        // Use context deletion so library list and filters are updated
        const success = await contextDeleteDocument(doc.id, filename);
        // If deletion was successful, go back
        if (success) {
            onBack();
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-96 text-gray-400">
                <Loader2 size={48} className="animate-spin mb-4 text-sycapt-red" />
                <p className="font-medium animate-pulse">Loading document...</p>
            </div>
        );
    }

    if (error || !doc) {
        return (
            <div className="flex flex-col items-center justify-center h-96">
                <div className="bg-red-50 p-6 rounded-2xl border border-red-100 text-center max-w-md">
                    <div className="bg-white w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-sm text-red-500">
                        <FileText size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-red-900 mb-2">Error Loading Document</h3>
                    <p className="text-red-600 mb-6">{error || 'Document not found'}</p>
                    <button
                        onClick={onBack}
                        className="px-6 py-2 bg-white border border-red-200 text-red-600 rounded-xl font-bold hover:bg-red-50 transition-colors shadow-sm"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-fade-in-up h-full flex flex-col overflow-y-auto custom-scrollbar">
            {/* Header - Sticky */}
            <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-gray-100 py-4 px-8 mb-8 flex justify-between items-center shadow-sm">
                <button
                    onClick={onBack}
                    className="flex items-center text-gray-500 hover:text-gray-900 transition-colors font-semibold group"
                >
                    <div className="p-2 bg-gray-100 rounded-lg group-hover:bg-gray-200 mr-3 transition-colors">
                        <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                    </div>
                    Back to Library
                </button>

                <div className="flex items-center space-x-3">
                    <button
                        onClick={handleDelete}
                        className="flex items-center px-5 py-2.5 border border-red-100 text-red-500 bg-red-50/50 rounded-xl hover:bg-red-100 hover:border-red-200 transition-colors font-semibold text-sm"
                    >
                        <Trash2 size={18} className="mr-2" />
                        Delete Document
                    </button>

                    <div className="h-8 w-px bg-gray-200 mx-2"></div>

                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className={`flex items-center px-6 py-2.5 rounded-xl text-white font-bold shadow-lg shadow-red-500/20 transition-all transform active:scale-95 ${saving ? 'bg-gray-400 cursor-not-allowed' : 'bg-sycapt-red hover:bg-red-700 hover:shadow-red-600/30'
                            }`}
                    >
                        {saving ? (
                            <>
                                <Loader2 size={18} className="animate-spin mr-2" />
                                Saving Changes...
                            </>
                        ) : (
                            <>
                                <Save size={20} className="mr-2" />
                                Save Changes
                            </>
                        )}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 px-8 pb-10">

                {/* Main Editor */}
                <div className="lg:col-span-8 space-y-8">
                    <div className="group">
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 ml-1">Document Filename</label>
                        <div className="relative">
                            <input
                                type="text"
                                value={filename}
                                onChange={(e) => setFilename(e.target.value)}
                                className="w-full text-3xl font-extrabold text-gray-900 border-b-2 border-transparent hover:border-gray-200 focus:border-sycapt-red focus:outline-none bg-transparent py-2 transition-all placeholder-gray-300"
                                placeholder="Enter filename..."
                            />
                            <Edit3 size={20} className="absolute right-2 top-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                        </div>
                    </div>

                    <div className="relative">
                        <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden min-h-[600px] flex flex-col">
                            {/* Toolbar */}
                            <div className="flex justify-between items-center px-6 py-4 bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                                <div className="flex items-center space-x-2">
                                    <FileText size={18} className="text-sycapt-red" />
                                    <span className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                                        {isEditing ? 'Editor Mode' : 'Reader View'}
                                    </span>
                                </div>
                                <div className="flex bg-white rounded-lg p-1 border border-gray-200 shadow-sm">
                                    <button
                                        onClick={() => setIsEditing(false)}
                                        className={`flex items-center px-3 py-1.5 rounded-md text-xs font-bold transition-all ${!isEditing
                                            ? 'bg-gray-100 text-sycapt-red shadow-sm'
                                            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                                            }`}
                                    >
                                        <Eye size={14} className="mr-1.5" />
                                        Preview
                                    </button>
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        className={`flex items-center px-3 py-1.5 rounded-md text-xs font-bold transition-all ${isEditing
                                            ? 'bg-gray-100 text-sycapt-red shadow-sm'
                                            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                                            }`}
                                    >
                                        <FileEdit size={14} className="mr-1.5" />
                                        Edit
                                    </button>
                                </div>
                            </div>

                            {/* Content Area */}
                            <div className="relative flex-grow">
                                {isEditing ? (
                                    <>
                                        <div className="absolute top-0 left-0 w-1.5 h-full bg-sycapt-red z-10"></div>
                                        <textarea
                                            value={content}
                                            onChange={(e) => setContent(e.target.value)}
                                            className="w-full h-full p-8 pl-10 bg-white text-gray-700 leading-relaxed font-mono text-sm focus:outline-none resize-none overflow-y-auto custom-scrollbar selection:bg-red-100 selection:text-red-900"
                                            spellCheck={false}
                                            placeholder="Enter your content here..."
                                        />
                                    </>
                                ) : (
                                    <div className="w-full h-full bg-gray-50 flex justify-center overflow-y-auto custom-scrollbar p-6">
                                        <div className="bg-white shadow-sm border border-gray-200 w-full max-w-4xl min-h-[800px] p-12 rounded-xl">
                                            <article className="prose prose-lg prose-slate max-w-none prose-headings:font-bold prose-headings:text-gray-900 prose-p:text-gray-700 prose-p:leading-8 prose-p:mb-6 prose-a:text-sycapt-red prose-a:no-underline hover:prose-a:underline prose-img:rounded-xl prose-li:text-gray-700">
                                                {content ? (
                                                    <ReactMarkdown
                                                        remarkPlugins={[remarkGfm]}
                                                        components={{
                                                            h1: ({ node, ...props }) => <h1 className="text-4xl font-extrabold text-gray-900 border-b-2 border-gray-100 pb-4 mb-8 mt-2 tracking-tight" {...props} />,
                                                            h2: ({ node, ...props }) => <h2 className="text-2xl font-bold text-gray-800 mt-10 mb-5 flex items-center border-l-4 border-sycapt-red pl-4" {...props} />,
                                                            h3: ({ node, ...props }) => <h3 className="text-xl font-bold mt-8 mb-4 text-gray-800" {...props} />,
                                                            ul: ({ node, ...props }) => <ul className="list-disc pl-6 space-y-3 my-6 text-gray-700" {...props} />,
                                                            ol: ({ node, ...props }) => <ol className="list-decimal pl-6 space-y-3 my-6 text-gray-700" {...props} />,
                                                            li: ({ node, ...props }) => <li className="pl-1 leading-7" {...props} />,
                                                            p: ({ node, ...props }) => <p className="leading-8 mb-6 text-gray-700 text-lg" {...props} />,
                                                            strong: ({ node, ...props }) => <strong className="font-bold text-gray-900" {...props} />,
                                                            blockquote: ({ node, ...props }) => (
                                                                <div className="flex my-8">
                                                                    <div className="w-1.5 bg-sycapt-red rounded-full mr-6 self-stretch opacity-70"></div>
                                                                    <blockquote className="italic text-gray-600 text-lg leading-relaxed py-2" {...props} />
                                                                </div>
                                                            ),
                                                            code({ node, inline, className, children, ...props }: any) {
                                                                return !inline ? (
                                                                    <div className="relative my-6 rounded-xl overflow-hidden bg-gray-900 shadow-md">
                                                                        <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/10">
                                                                            <div className="flex space-x-1.5">
                                                                                <div className="w-3 h-3 rounded-full bg-red-400/80"></div>
                                                                                <div className="w-3 h-3 rounded-full bg-yellow-400/80"></div>
                                                                                <div className="w-3 h-3 rounded-full bg-green-400/80"></div>
                                                                            </div>
                                                                            <span className="text-xs font-mono text-gray-400">Code Block</span>
                                                                        </div>
                                                                        <pre className="p-4 overflow-x-auto text-sm text-gray-300 font-mono scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                                                                            <code className={className} {...props}>
                                                                                {children}
                                                                            </code>
                                                                        </pre>
                                                                    </div>
                                                                ) : (
                                                                    <code className="px-1.5 py-0.5 bg-gray-100 text-sycapt-red rounded-md font-mono text-sm border border-gray-200" {...props}>
                                                                        {children}
                                                                    </code>
                                                                );
                                                            },
                                                            table: ({ node, ...props }) => (
                                                                <div className="overflow-x-auto my-6 rounded-xl border border-gray-200 shadow-sm">
                                                                    <table className="min-w-full divide-y divide-gray-200" {...props} />
                                                                </div>
                                                            ),
                                                            thead: ({ node, ...props }) => <thead className="bg-gray-50" {...props} />,
                                                            th: ({ node, ...props }) => <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider" {...props} />,
                                                            tbody: ({ node, ...props }) => <tbody className="bg-white divide-y divide-gray-200" {...props} />,
                                                            tr: ({ node, ...props }) => <tr className="hover:bg-gray-50 transition-colors" {...props} />,
                                                            td: ({ node, ...props }) => <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600" {...props} />,
                                                        }}
                                                    >
                                                        {content}
                                                    </ReactMarkdown>
                                                ) : (
                                                    <div className="flex flex-col items-center justify-center h-full text-gray-400 py-20">
                                                        <FileText size={48} className="mb-4 opacity-20" />
                                                        <p className="font-medium">No content to display.</p>
                                                        <button onClick={() => setIsEditing(true)} className="mt-4 text-sycapt-red hover:underline text-sm font-bold">
                                                            Start Writing
                                                        </button>
                                                    </div>
                                                )}
                                            </article>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Metadata Sidebar */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-soft">
                        <h3 className="font-bold text-gray-900 mb-6 flex items-center text-lg">
                            <div className="p-2 bg-red-50 rounded-lg mr-3">
                                <Hash size={20} className="text-sycapt-red" />
                            </div>
                            Metadata
                        </h3>

                        <div className="space-y-4">
                            <div className="flex flex-col p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                <span className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Document ID</span>
                                <span className="text-sm font-mono font-bold text-gray-800 break-all">{doc.id}</span>
                            </div>

                            <div className="flex flex-col p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                <span className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Vector ID</span>
                                <span className="text-sm font-mono font-bold text-gray-800 break-all">{doc.vectorId}</span>
                            </div>

                            <div className="flex flex-col p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                <span className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Upload Date</span>
                                <div className="flex items-center mt-1">
                                    <Calendar size={16} className="text-gray-400 mr-2" />
                                    <span className="text-sm font-bold text-gray-800">
                                        {new Date(doc.uploadDate).toLocaleDateString('en-US', {
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* New Project & Client Context Section */}
                    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-soft">
                        <h3 className="font-bold text-gray-900 mb-6 flex items-center text-lg">
                            <div className="p-2 bg-blue-50 rounded-lg mr-3">
                                <Hash size={20} className="text-blue-500" />
                            </div>
                            Project Context
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Project Name</label>
                                {isEditing ? (
                                    <div className="relative">
                                        <select
                                            value={projectName}
                                            onChange={(e) => setProjectName(e.target.value)}
                                            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 appearance-none"
                                        >
                                            <option value="">Select or Type...</option>
                                            {/* Deduplicate Project Names */}
                                            {Array.from(new Set(filterOptions.projects.map(p => p.project_name))).map((p, idx) => (
                                                <option key={`${p}-${idx}`} value={p}>{p}</option>
                                            ))}
                                        </select>
                                        <div className="pointer-events-none absolute right-3 top-3.5 text-gray-400">
                                            <ChevronDown size={14} />
                                        </div>
                                        <input
                                            type="text"
                                            value={projectName}
                                            onChange={(e) => setProjectName(e.target.value)}
                                            placeholder="Or type custom name..."
                                            className="mt-2 w-full p-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 outline-none focus:border-blue-500"
                                        />
                                    </div>
                                ) : (
                                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 font-bold text-gray-800 text-sm">
                                        {projectName || 'Not Assigned'}
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Client / Company</label>
                                {isEditing ? (
                                    <div className="relative">
                                        <select
                                            value={clientName}
                                            onChange={(e) => setClientName(e.target.value)}
                                            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 appearance-none"
                                        >
                                            <option value="">Select or Type...</option>
                                            {filterOptions.clients.map((c, idx) => (
                                                <option key={`${c}-${idx}`} value={c}>{c}</option>
                                            ))}
                                        </select>
                                        <div className="pointer-events-none absolute right-3 top-3.5 text-gray-400">
                                            <ChevronDown size={14} />
                                        </div>
                                        <input
                                            type="text"
                                            value={clientName}
                                            onChange={(e) => setClientName(e.target.value)}
                                            placeholder="Or type custom name..."
                                            className="mt-2 w-full p-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 outline-none focus:border-blue-500"
                                        />
                                    </div>
                                ) : (
                                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 font-bold text-gray-800 text-sm">
                                        {clientName || 'Not Assigned'}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-soft">
                        <h3 className="font-bold text-gray-900 mb-6 flex items-center text-lg">
                            <div className="p-2 bg-red-50 rounded-lg mr-3">
                                <Tag size={20} className="text-sycapt-red" />
                            </div>
                            Tags
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {doc.tags && doc.tags.length > 0 ? doc.tags.map(tag => (
                                <span key={tag} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-200 cursor-pointer transition-colors border border-gray-200">
                                    #{tag}
                                </span>
                            )) : (
                                <span className="text-sm text-gray-400 italic">No tags assigned</span>
                            )}
                            <button className="px-3 py-1.5 border border-dashed border-gray-300 text-gray-400 rounded-lg text-xs font-bold hover:border-sycapt-red hover:text-sycapt-red transition-colors flex items-center">
                                + Add Tag
                            </button>
                        </div>
                    </div>

                    {/* Extracted Images */}
                    {(doc as any).images && (doc as any).images.length > 0 && (
                        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-soft">
                            <h3 className="font-bold text-gray-900 mb-6 flex items-center text-lg">
                                <div className="p-2 bg-red-50 rounded-lg mr-3">
                                    <FileEdit size={20} className="text-sycapt-red" />
                                </div>
                                Start Visuals
                            </h3>
                            <div className="grid grid-cols-2 gap-3">
                                {(doc as any).images.map((img: any, idx: number) => (
                                    <div key={idx} className="relative group rounded-xl overflow-hidden border border-gray-200 cursor-pointer shadow-sm hover:shadow-md transition-all" onClick={() => window.open(img.src, '_blank')}>
                                        <div className="aspect-square bg-gray-100">
                                            <img src={img.src} alt={`Page ${img.page}`} className="w-full h-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
                                        </div>
                                        <div className="absolute top-2 right-2 bg-black/60 text-white text-[9px] px-2 py-0.5 rounded-full font-bold backdrop-blur-md border border-white/20">
                                            PG {img.page}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Related Documents (Email Context) */}
                    {doc.relatedDocuments && doc.relatedDocuments.length > 0 && (
                        <div className="bg-white p-6 rounded-3xl border border-purple-100 shadow-soft">
                            <h3 className="font-bold text-gray-900 mb-6 flex items-center text-lg">
                                <div className="p-2 bg-purple-50 rounded-lg mr-3">
                                    <FileText size={20} className="text-purple-500" />
                                </div>
                                Related Content (Email)
                            </h3>
                            <div className="space-y-3">
                                {doc.relatedDocuments.map((rd) => (
                                    <div
                                        key={rd.id}
                                        onClick={() => onNavigate ? onNavigate(rd.id) : null}
                                        className={`flex items-center p-3 rounded-xl border border-gray-100 hover:bg-purple-50 hover:border-purple-200 transition-all cursor-pointer group ${!onNavigate ? 'opacity-70 pointer-events-none' : ''}`}
                                    >
                                        <div className="p-2 bg-gray-100 rounded-lg mr-3 group-hover:bg-white transition-colors">
                                            <FileText size={16} className="text-gray-500 group-hover:text-purple-500" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-gray-700 truncate group-hover:text-purple-700">{rd.filename}</p>
                                            <p className="text-xs text-gray-400 font-mono mt-0.5">{rd.file_type || 'FILE'}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="p-5 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl border border-blue-100 shadow-sm">
                        <div className="flex items-start">
                            <div className="flex-shrink-0 mt-0.5">
                                <div className="p-1 bg-blue-100 rounded-full">
                                    <Check size={16} className="text-blue-600" />
                                </div>
                            </div>
                            <div className="ml-4">
                                <h3 className="text-sm font-bold text-blue-900">Vector Index Active</h3>
                                <p className="text-xs text-blue-700 mt-2 leading-relaxed opacity-80">
                                    This document is fully indexed in <span className="font-mono font-semibold">pgvector</span>.
                                    Any changes to the content will automatically trigger a re-embedding process in the background to ensure search accuracy.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
