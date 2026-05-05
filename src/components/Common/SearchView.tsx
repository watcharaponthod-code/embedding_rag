import React, { useState, useEffect } from 'react';
import { Search, ArrowRight, FileText, Database, Sparkles, Layers, Hash, Zap, Trash2, Eye, ChevronLeft, ChevronRight, File, Mail, Edit2, Check, X } from 'lucide-react';
import { searchDocuments } from '../../server/services/apiService';
import { SearchResult } from '../../types';
import { useDocuments } from '../contexts/DocumentContext';
import { CONFIG } from '../../config';

interface SearchViewProps {
  onSelectDocument: (id: string) => void;
}

interface DocItem {
  id: string;
  document_name: string;
  created_at: string;
  chunk_count: number;
  file_type?: string;
}

export const SearchView: React.FC<SearchViewProps> = ({ onSelectDocument }) => {
  // Search State
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempClient, setTempClient] = useState('');
  const [tempProject, setTempProject] = useState('');

  // Batch Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBatchEdit, setShowBatchEdit] = useState(false);
  const [batchClient, setBatchClient] = useState('');
  const [batchProject, setBatchProject] = useState('');

  // Use Global Document Context
  const {
    documents, loading: docLoading, page, totalPages,
    filterType, selectedClient, selectedProject, filterOptions,
    setPage, setFilterType, setSelectedClient, setSelectedProject,
    sortBy, sortOrder, setSortBy, setSortOrder,
    fetchDocuments, deleteDocument, updateDocumentMetadata,
    deleteDocuments, updateDocumentsMetadata
  } = useDocuments();

  // --- Search Logic ---
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setSearching(true);
    setSearched(true);
    setResults([]);

    // 1. Perform Filename Search (using document list endpoint)
    try {
      const queryParams = new URLSearchParams({
        search: query,
        limit: '5',
        clientName: selectedClient,
        projectName: selectedProject
      });
      const res = await fetch(`/api/documents?${queryParams.toString()}`);
      const data = await res.json();

      if (data && data.data) {
        // Map DocItem to SearchResult format for compatibility
        const mappedResults: SearchResult[] = data.data.map((doc: any) => ({
          id: doc.id,
          doc_id: doc.id,
          document_name: doc.document_name,
          content: '', // No content preview for filename search
          chunk_header: 'Document Match',
          score: 1,
          similarity: 1
        }));
        setResults(mappedResults);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSearching(false);
    }
  };

  // --- Single Edit Logic ---
  const handleStartEdit = (doc: any) => {
    setEditingId(doc.id);
    setTempClient(doc.client_name || '');
    setTempProject(doc.project_name || '');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setTempClient('');
    setTempProject('');
  };

  const handleSaveEdit = async (docId: string) => {
    if (!docId) return;
    const success = await updateDocumentMetadata(docId, tempClient, tempProject);
    if (success) {
      setEditingId(null);
    }
  };

  // --- Batch Logic ---
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allIds = new Set(documents.map(d => d.id));
      setSelectedIds(allIds);
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBatchDelete = async () => {
    const ids = Array.from(selectedIds);
    const success = await deleteDocuments(ids);
    if (success) setSelectedIds(new Set());
  };

  const handleBatchUpdate = async () => {
    const ids = Array.from(selectedIds);
    const success = await updateDocumentsMetadata(ids, batchClient, batchProject);
    if (success) {
      setSelectedIds(new Set());
      setShowBatchEdit(false);
      setBatchClient('');
      setBatchProject('');
    }
  };


  const getFileIcon = (filename: string, type?: string) => {
    if (type === 'EMAIL' || filename.startsWith('Email:')) return <Mail size={20} className="text-purple-500" />;
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return <FileText size={20} className="text-red-500" />;
    if (ext === 'docx' || ext === 'doc') return <FileText size={20} className="text-blue-600" />;
    if (ext === 'xlsx' || ext === 'xls') return <FileText size={20} className="text-green-600" />;
    if (ext === 'pptx' || ext === 'ppt') return <FileText size={20} className="text-orange-500" />;
    return <File size={20} className="text-gray-400" />;
  };

  return (
    <div className="w-full h-full overflow-y-auto bg-gradient-to-b from-gray-50 to-white relative">

      {/* Batch Edit Modal */}
      {showBatchEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md border border-gray-100">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-800">Batch Update Metadata</h3>
                <p className="text-sm text-gray-500 mt-1">Updating {selectedIds.size} selected documents.</p>
              </div>
              <button onClick={() => setShowBatchEdit(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6">
              <div className="relative group">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">New Client Name</label>
                <input
                  type="text"
                  value={batchClient}
                  onChange={(e) => setBatchClient(e.target.value)}
                  list="batch-clients"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sycapt-red/20 focus:border-sycapt-red outline-none text-sm font-medium transition-all"
                  placeholder="Select or enter Client..."
                />
                <datalist id="batch-clients">
                  {filterOptions.clients.map(client => (
                    <option key={client} value={client} />
                  ))}
                </datalist>
              </div>
              <div className="relative group">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">New Project Name</label>
                <input
                  type="text"
                  value={batchProject}
                  onChange={(e) => setBatchProject(e.target.value)}
                  list="batch-projects"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sycapt-red/20 focus:border-sycapt-red outline-none text-sm font-medium transition-all"
                  placeholder="Select or enter Project..."
                />
                <datalist id="batch-projects">
                  {/* Deduplicate and filter projects based on entered/selected batchClient if possible, or show all */}
                  {Array.from(new Set(
                    filterOptions.projects
                      .filter(p => !batchClient || p.client_name === batchClient)
                      .map(p => p.project_name)
                  )).map((projectName, idx) => (
                    <option key={`${projectName}-${idx}`} value={projectName} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setShowBatchEdit(false)}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold rounded-xl text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBatchUpdate}
                disabled={!batchClient && !batchProject}
                className="flex-1 py-3 bg-sycapt-red hover:bg-red-700 text-white font-bold rounded-xl text-sm shadow-lg shadow-red-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Check size={18} /> Update All
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto space-y-12 animate-fade-in pb-20 px-6">

        {/* === Header Section === */}
        <div className="text-center space-y-6 pt-12">
          {/* ... Header Content ... */}
          <div className="inline-flex items-center justify-center p-3 bg-gradient-to-br from-red-50 to-red-100 rounded-2xl shadow-sm mb-2 ring-1 ring-red-100">
            <Sparkles size={28} className="text-sycapt-red" />
          </div>
          <h2 className="text-5xl font-extrabold text-gray-900 tracking-tight leading-tight">
            Document <span className="text-transparent bg-clip-text bg-gradient-to-r from-sycapt-red to-red-600">Search</span>
          </h2>
          <p className="text-gray-500 text-xl max-w-2xl mx-auto font-light">
            Find relevant files using natural language or keywords
          </p>
        </div>

        {/* === Search Section === */}
        <form onSubmit={handleSearch} className="relative group max-w-3xl mx-auto z-20">
          <div className="absolute inset-y-0 left-0 pl-8 flex items-center pointer-events-none z-10">
            <Search className="h-6 w-6 text-gray-400 group-focus-within:text-sycapt-red transition-colors duration-300" />
          </div>
          <input
            type="text"
            className="block w-full pl-20 pr-20 py-6 bg-white border-2 border-gray-100 rounded-full text-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-sycapt-red/40 focus:ring-8 focus:ring-red-500/10 shadow-lg shadow-gray-100/50 transition-all duration-300 hover:border-gray-200"
            placeholder="Search documents by content or name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            type="submit"
            className="absolute inset-y-2.5 right-2.5 w-14 h-14 bg-gradient-to-br from-sycapt-red to-red-600 text-white rounded-full flex items-center justify-center hover:shadow-lg hover:shadow-red-500/30 hover:scale-105 active:scale-95 transition-all duration-300"
            disabled={searching}
          >
            {searching ? (
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <ArrowRight size={24} strokeWidth={2.5} />
            )}
          </button>
        </form>

        {/* ... Search Results (Existing Code) ... */}
        {searching && (
          <div className="text-center py-10"><div className="animate-pulse text-sycapt-red font-semibold">Searching knowledge base...</div></div>
        )}

        {!searching && searched && results.length > 0 && (
          <div className="max-w-4xl mx-auto space-y-6">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Sparkles size={18} className="text-yellow-500" /> Found Documents</h3>
            <div className="space-y-3">
              {results.map((result, idx) => (
                <div key={idx} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer group flex items-center justify-between" onClick={() => onSelectDocument(String(result.doc_id || result.id))}>
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-gray-50 rounded-lg group-hover:bg-red-50 transition-colors">
                      {getFileIcon(result.document_name)}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-800 text-sm group-hover:text-sycapt-red transition-colors">
                        {result.document_name}
                      </h4>
                      <span className="text-xs text-green-600 font-medium">Relevance Match</span>
                    </div>
                  </div>
                  <ArrowRight size={18} className="text-gray-300 group-hover:text-sycapt-red transition-colors" />
                </div>
              ))}
            </div>
          </div>
        )}

        {!searching && searched && results.length === 0 && (
          <div className="text-center text-gray-400 py-10">No relevant documents found for your search.</div>
        )}


        {/* === Divider === */}
        <div className="border-t border-gray-100 my-12 w-full"></div>


        {/* === Document Library Section === */}
        <div className="max-w-7xl mx-auto bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">

          {/* Batch Toolbar (Conditional) */}
          {selectedIds.size > 0 && (
            <div className="bg-sycapt-red/5 p-4 border-b border-red-100 flex items-center justify-between animate-fade-in">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-sycapt-red text-white flex items-center justify-center font-bold text-sm shadow-sm ring-2 ring-white">
                  {selectedIds.size}
                </div>
                <span className="text-sm font-bold text-gray-700">Documents Selected</span>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowBatchEdit(true)}
                  className="px-4 py-2 bg-white hover:bg-red-50 text-gray-700 hover:text-sycapt-red font-bold rounded-lg text-sm border border-gray-200 hover:border-red-200 transition-all shadow-sm flex items-center gap-2"
                >
                  <Edit2 size={16} /> Edit Metadata
                </button>
                <button
                  onClick={handleBatchDelete}
                  className="px-4 py-2 bg-white hover:bg-red-50 text-red-500 hover:text-red-700 font-bold rounded-lg text-sm border border-gray-200 hover:border-red-200 transition-all shadow-sm flex items-center gap-2"
                >
                  <Trash2 size={16} /> Delete Selected
                </button>
              </div>
            </div>
          )}

          {/* Library Header & Filters (Hidden if batch selecting? No, keep visible usually) */}
          {selectedIds.size === 0 && (
            <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-lg border border-gray-200 shadow-sm">
                  <Database size={20} className="text-sycapt-red" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Document Library</h3>
                  <p className="text-xs text-gray-500">Manage your knowledge base</p>
                </div>
              </div>

              {/* Filter Controls */}
              <div className="flex flex-wrap items-center gap-3">
                {/* File Type Dropdown */}
                <div className="relative">
                  <select
                    value={filterType}
                    onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
                    className="appearance-none bg-gray-50 border border-gray-200 text-gray-700 text-xs font-bold py-2 pl-3 pr-8 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-sycapt-red transition-all cursor-pointer"
                  >
                    <option value="ALL">All Types</option>
                    <option value="EMAIL">Emails</option>
                    <option value="PDF">PDF Documents</option>
                    <option value="DOCX">Word Documents</option>
                    <option value="XLSX">Excel Sheets</option>
                    <option value="PPTX">Presentations</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                  </div>
                </div>

                {/* Client Dropdown */}
                <div className="relative">
                  <select
                    value={selectedClient}
                    onChange={(e) => {
                      setSelectedClient(e.target.value);
                      setSelectedProject(''); // Reset project when client changes
                      setPage(1);
                    }}
                    className="appearance-none bg-gray-50 border border-gray-200 text-gray-700 text-xs font-bold py-2 pl-3 pr-8 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-sycapt-red transition-all cursor-pointer min-w-[140px]"
                  >
                    <option value="">All Clients</option>
                    {filterOptions.clients.map(client => (
                      <option key={client} value={client}>{client}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                  </div>
                </div>

                {/* Project Dropdown */}
                <div className="relative">
                  <select
                    value={selectedProject}
                    onChange={(e) => { setSelectedProject(e.target.value); setPage(1); }}
                    className="appearance-none bg-gray-50 border border-gray-200 text-gray-700 text-xs font-bold py-2 pl-3 pr-8 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-sycapt-red transition-all cursor-pointer min-w-[140px] max-w-[200px] truncate"
                  >
                    <option value="">All Projects</option>
                    {/* Deduplicate Projects (Unique by Name) if No Client Selected, else filter by Client */}
                    {Array.from(new Set(
                      filterOptions.projects
                        .filter(p => !selectedClient || p.client_name === selectedClient)
                        .map(p => p.project_name)
                    )).map((projectName, idx) => (
                      <option key={`${projectName}-${idx}`} value={projectName}>{projectName}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                  </div>
                </div>

                {/* Sort Controls */}
                <div className="flex items-center gap-2 border-l border-gray-200 pl-4 ml-2">
                  <div className="relative">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="appearance-none bg-gray-50 border border-gray-200 text-gray-700 text-xs font-bold py-2 pl-3 pr-8 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-sycapt-red transition-all cursor-pointer"
                    >
                      <option value="created_at">Date</option>
                      <option value="document_name">Name</option>
                      <option value="chunk_count">Size</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                      <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                    </div>
                  </div>

                  <button
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="p-2 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors text-gray-600"
                    title={sortOrder === 'asc' ? "Ascending (A-Z, Oldest)" : "Descending (Z-A, Newest)"}
                  >
                    {sortOrder === 'asc' ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M7 12h10" /><path d="M10 18h4" /></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 18h18" /><path d="M7 12h10" /><path d="M10 6h4" /></svg>
                    )}
                  </button>
                </div>

              </div>
            </div>
          )}

          {/* Document Table */}
          <div className="overflow-x-auto min-h-[300px]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 font-semibold">
                  <th className="px-6 py-4 w-[50px]">
                    <input
                      type="checkbox"
                      onChange={handleSelectAll}
                      checked={documents.length > 0 && selectedIds.size === documents.length}
                      className="w-4 h-4 rounded border-gray-300 text-sycapt-red focus:ring-sycapt-red"
                    />
                  </th>
                  <th className="px-6 py-4">Document Name</th>
                  <th className="px-4 py-4">Client</th>
                  <th className="px-4 py-4">Project</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4 text-center">Chunks</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {docLoading ? (
                  <tr><td colSpan={8} className="p-12 text-center text-gray-400">Loading documents...</td></tr>
                ) : documents.length === 0 ? (
                  <tr><td colSpan={8} className="p-12 text-center text-gray-400">No documents found.</td></tr>
                ) : (
                  documents.map((doc) => {
                    const isSelected = selectedIds.has(doc.id);
                    return (
                      <tr key={doc.id} className={`transition-colors group ${isSelected ? 'bg-red-50/30' : 'hover:bg-gray-50/80'}`}>
                        {/* Checkbox */}
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleSelectOne(doc.id)}
                            className="w-4 h-4 rounded border-gray-300 text-sycapt-red focus:ring-sycapt-red"
                          />
                        </td>

                        {/* Name Column */}
                        <td className="px-6 py-4 max-w-[250px]">
                          <div className="flex items-center gap-3">
                            {getFileIcon(doc.document_name)}
                            <span className="font-medium text-gray-700 text-sm group-hover:text-gray-900 truncate" title={doc.document_name}>
                              {doc.document_name}
                            </span>
                          </div>
                        </td>

                        {/* Client Column */}
                        <td className="px-4 py-4 max-w-[150px]">
                          {editingId === doc.id ? (
                            <input
                              type="text"
                              value={tempClient}
                              onChange={(e) => setTempClient(e.target.value)}
                              className="w-full px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-sycapt-red/20 focus:border-sycapt-red outline-none"
                              placeholder="Client"
                            />
                          ) : (
                            <span className="text-sm text-gray-600 truncate block" title={doc.client_name}>{doc.client_name || '-'}</span>
                          )}
                        </td>

                        {/* Project Column */}
                        <td className="px-4 py-4 max-w-[150px]">
                          {editingId === doc.id ? (
                            <input
                              type="text"
                              value={tempProject}
                              onChange={(e) => setTempProject(e.target.value)}
                              className="w-full px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-sycapt-red/20 focus:border-sycapt-red outline-none"
                              placeholder="Project"
                            />
                          ) : (
                            <span className="text-sm text-gray-600 truncate block" title={doc.project_name}>{doc.project_name || '-'}</span>
                          )}
                        </td>

                        {/* Other Columns */}
                        <td className="px-6 py-4 text-xs font-bold text-gray-400">
                          {doc.file_type || doc.document_name.split('.').pop()?.toUpperCase()}
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-500 whitespace-nowrap">
                          {new Date(doc.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-mono">{doc.chunk_count}</span>
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2 items-center">
                            {editingId === doc.id ? (
                              <>
                                <button
                                  onClick={() => handleSaveEdit(doc.id)}
                                  className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                  title="Save Changes"
                                >
                                  <Check size={16} />
                                </button>
                                <button
                                  onClick={handleCancelEdit}
                                  className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                                  title="Cancel Edit"
                                >
                                  <X size={16} />
                                </button>
                              </>
                            ) : (
                              <>
                                {/* View Code needs 'onSelectDocument' - User said 'Cannot adjust Reader View but can select multiple...' 
                                  Assume clicking name or eye icon opens Reader View (Read Only). 
                              */}
                                <button
                                  onClick={() => handleStartEdit(doc)}
                                  className="p-1.5 text-gray-400 hover:text-sycapt-red hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                  title="Edit Metadata"
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button
                                  onClick={() => onSelectDocument(doc.id)}
                                  className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                  title="Read Document"
                                >
                                  <Eye size={16} />
                                </button>
                                <button
                                  onClick={() => deleteDocument(doc.id, doc.document_name)}
                                  className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                  title="Delete Document"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-4 border-t border-gray-100 flex justify-between items-center bg-gray-50/30">
            <span className="text-xs text-gray-500 font-medium">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="p-2 border border-gray-200 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={16} className="text-gray-600" />
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="p-2 border border-gray-200 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={16} className="text-gray-600" />
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};