import React, { useRef } from 'react';
import { Upload, FileText, CheckCircle2, Database, Cpu, Play, Loader2, Image as ImageIcon, FileType, Sparkles, ScanLine, X, Trash2, AlertTriangle, SkipForward, CopyPlus, ChevronDown } from 'lucide-react';
import { useUpload } from '../contexts/UploadContext';
import { useDocuments } from '../contexts/DocumentContext';
import { RecentUploads } from './RecentUploads';

export const UploadView: React.FC = () => {
  const {
    files, isProcessing, progressState, uploadStats, isCompleted,
    duplicateConflict, addFiles, removeFile, clearFiles, startProcessing, cancelProcessing,
    recentUploads, currentFileIndex,
    projectName, setProjectName, clientName, setClientName,
    description, setDescription
  } = useUpload();

  const { refreshFilters, filterOptions, fetchDocuments } = useDocuments();

  // Refresh global filters when results change or when upload is completed
  React.useEffect(() => {
    if (isCompleted && uploadStats.successful > 0) {
      refreshFilters();
      fetchDocuments(true);
    }
  }, [isCompleted, uploadStats.successful, refreshFilters, fetchDocuments]);

  const [isDragging, setIsDragging] = React.useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Allowed file types
  const ALLOWED_MIME_TYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  ];
  const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'pptx'];

  // --- Autocomplete Logic ---
  const [activeField, setActiveField] = React.useState<'project' | 'client' | null>(null);

  const getClientSuggestions = () => {
    // If empty input, show ALL clients
    if (!clientName.trim()) return filterOptions.clients;

    // Otherwise filter
    return filterOptions.clients.filter(c =>
      c.toLowerCase().includes(clientName.toLowerCase()) &&
      c.toLowerCase() !== clientName.toLowerCase()
    );
  };

  const getProjectSuggestions = () => {
    // Filter by client first
    const clientProjects = filterOptions.projects.filter(p =>
      !clientName || (p.client_name && p.client_name.toLowerCase() === clientName.toLowerCase())
    );

    // If empty input, show ALL projects for this client
    if (!projectName.trim()) return Array.from(new Set(clientProjects.map(p => p.project_name)));

    const filtered = clientProjects
      .filter(p => {
        const matchesInput = p.project_name.toLowerCase().includes(projectName.toLowerCase());
        const notExact = p.project_name.toLowerCase() !== projectName.toLowerCase();
        return matchesInput && notExact;
      })
      .map(p => p.project_name);

    return Array.from(new Set(filtered));
  };

  const clientSuggestions = getClientSuggestions();
  const projectSuggestions = getProjectSuggestions();

  // --- Drag & Drop ---
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => { setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndAddFiles(Array.from(e.dataTransfer.files));
    }
  };

  const validateAndAddFiles = (newFiles: File[]) => {
    // ... rest of validation logic stays same ...
    const validFiles: File[] = [];
    let invalidCount = 0;

    newFiles.forEach(f => {
      const fileExtension = f.name.split('.').pop()?.toLowerCase();
      const isValidMime = ALLOWED_MIME_TYPES.includes(f.type);
      const isValidExtension = fileExtension && ALLOWED_EXTENSIONS.includes(fileExtension);

      if (isValidMime || isValidExtension) {
        validFiles.push(f);
      } else {
        invalidCount++;
      }
    });

    if (invalidCount > 0) {
      alert(`${invalidCount} file(s) were skipped due to invalid type.Please select PDF, DOCX, or PPTX.`);
    }

    if (validFiles.length > 0) {
      addFiles(validFiles);
    }
  };

  const getFileIcon = (fileName: string) => {
    if (fileName.endsWith('.pptx')) return <FileType size={24} className="text-orange-500" />;
    if (fileName.endsWith('.docx')) return <FileText size={24} className="text-blue-500" />;
    return <FileText size={24} className="text-sycapt-red" />;
  };

  const StepItem = ({ icon: Icon, title, desc, isActive, isDone }: any) => {
    return (
      <div className={`relative flex items-center gap-4 p-4 rounded-xl transition-all duration-500 border ${isActive
        ? 'bg-white/80 border-sycapt-red/30 shadow-lg shadow-red-500/5 scale-[1.02]'
        : isDone
          ? 'bg-white/40 border-green-100 opacity-90'
          : 'bg-white/20 border-transparent opacity-50 grayscale'
        }`}>

        <div className={`p-2.5 rounded-lg transition-all duration-300 ${isActive
          ? 'bg-gradient-to-br from-red-50 to-white text-sycapt-red shadow-sm ring-1 ring-red-100'
          : isDone
            ? 'bg-green-50 text-green-600 ring-1 ring-green-100'
            : 'bg-gray-50 text-gray-400'
          }`}>
          <Icon size={18} className={isActive ? 'animate-pulse' : ''} />
        </div>

        <div className="flex-1 min-w-0">
          <h4 className={`font-bold text-sm tracking-tight ${isActive ? 'text-gray-800' : 'text-gray-600'} `}>{title}</h4>
          <p className="text-[11px] text-gray-400 mt-0.5 font-medium truncate">{desc}</p>
        </div>

        {isActive && <Loader2 size={16} className="text-sycapt-red animate-spin ml-auto" />}
        {isDone && <CheckCircle2 size={16} className="text-emerald-500 ml-auto" />}
      </div>
    );
  };

  return (
    <div className="h-full w-full relative overflow-y-auto custom-scrollbar flex flex-col items-center p-6 bg-[#f8fafc]">

      {/* --- AI Neural Background --- */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none fixed">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] bg-red-500/5 rounded-full blur-[100px] animate-float"></div>
        <div className="absolute bottom-[-10%] right-[10%] w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-[120px] animate-float delay-1000"></div>
      </div>

      <div className="relative z-10 w-full max-w-6xl animate-fade-in-up flex flex-col gap-8">

        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 px-4 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-2 opacity-80">
              <span className="h-px w-8 bg-sycapt-red/50"></span>
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-sycapt-dark">Neural Ingestion</span>
            </div>
            <h1 className="text-4xl font-extrabold text-slate-800 tracking-tight">
              Document <span className="text-transparent bg-clip-text bg-gradient-to-r from-sycapt-red to-orange-500">Vectorization</span>
            </h1>
          </div>
        </div>

        {/* Main Glass Panel */}
        <div className="bg-white/60 backdrop-blur-2xl rounded-3xl border border-white/60 shadow-2xl shadow-slate-200/50 flex flex-col lg:flex-row overflow-hidden flex-1 transition-all duration-500 hover:border-white/80 min-h-[500px]">

          {/* LEFT PANEL: Upload Zone */}
          <div className="flex-1 p-8 lg:p-12 border-b lg:border-b-0 lg:border-r border-gray-100/50 relative flex flex-col overflow-hidden">



            {/* Conflict Overlay Modal */}
            {duplicateConflict && (
              <div className="absolute inset-0 z-50 bg-white/90 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in">
                <div className="bg-white rounded-2xl shadow-2xl border border-red-100 max-w-md w-full p-6 transform scale-100 animate-bounce-short">
                  <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center mb-4 text-amber-500">
                    <AlertTriangle size={28} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Duplicate Found</h3>
                  <p className="text-gray-600 mb-6 text-sm leading-relaxed">
                    A document named <span className="font-bold text-gray-800">"{duplicateConflict.file.name}"</span> already exists in the database.
                    How would you like to proceed?
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => duplicateConflict.resolve('skip')}
                      className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
                    >
                      <SkipForward size={16} /> Skip
                    </button>
                    <button
                      onClick={() => duplicateConflict.resolve('proceed')}
                      className="flex-1 py-3 bg-sycapt-red hover:bg-red-700 text-white font-bold rounded-xl shadow-lg shadow-red-500/20 transition-colors flex items-center justify-center gap-2 text-sm"
                    >
                      <CopyPlus size={16} /> Process Anyway
                    </button>
                  </div>
                </div>
              </div>
            )}

            {files.length === 0 ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                className={`group h-full w-full min-h-[350px] relative rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer flex flex-col items-center justify-center gap-8
                                ${isDragging
                    ? 'border-sycapt-red bg-red-50/30 scale-[0.99]'
                    : 'border-slate-200 hover:border-sycapt-red/30 hover:bg-white/60 hover:shadow-xl hover:shadow-slate-200/40'
                  } `}
              >
                <div className={`w-24 h-24 bg-white rounded-[2rem] shadow-xl shadow-slate-200/60 flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:-rotate-3 ${isDragging ? 'rotate-12 scale-90' : ''} `}>
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-5 rounded-[1.5rem] group-hover:from-red-50 group-hover:to-red-100 transition-colors">
                    <Upload size={32} className={`text-slate-400 group-hover:text-sycapt-red transition-colors ${isDragging ? 'text-sycapt-red animate-bounce' : ''} `} />
                  </div>
                </div>

                <div className="text-center space-y-2 z-10 px-6">
                  <h3 className="text-lg font-bold text-slate-700 font-sans group-hover:text-sycapt-dark transition-colors">
                    Drag & Drop files here
                  </h3>
                  <p className="text-sm text-slate-400 font-medium">
                    or <span className="text-sycapt-red underline underline-offset-2">browse computer for multiple files</span>
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col h-full animate-slide-up">
                {/* File List Header */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-700 text-lg">Selected Documents ({files.length})</h3>
                  {!isProcessing && (
                    <button onClick={() => fileInputRef.current?.click()} className="text-sycapt-red text-sm font-semibold hover:underline flex items-center gap-1">
                      <Upload size={14} /> Add more
                    </button>
                  )}
                </div>

                {/* Metadata Inputs - Custom Autocomplete */}
                <div className="flex flex-col gap-4 mb-4 animate-fade-in relative z-20">
                  <div className="grid grid-cols-2 gap-4">
                    {/* Client Input */}
                    <div className="relative group">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-2">
                        Client / Company <span className="text-red-500 ml-1">*</span>
                        {clientName && clientSuggestions.length > 0 && activeField === 'client' && (
                          <span className="text-[9px] bg-red-50 text-sycapt-red px-1.5 py-0.5 rounded-full">{clientSuggestions.length} matches</span>
                        )}
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="e.g. Acme Corp"
                          value={clientName}
                          onChange={(e) => {
                            setClientName(e.target.value);
                            setActiveField('client');
                          }}
                          onFocus={() => setActiveField('client')}
                          onBlur={() => setTimeout(() => setActiveField(null), 200)}
                          className="w-full px-3 py-2.5 pr-10 rounded-lg bg-white border border-slate-200 focus:border-sycapt-red focus:ring-2 focus:ring-red-50 outline-none transition-all text-sm font-medium text-slate-700 placeholder:text-slate-300"
                        />
                        <button
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-sycapt-red transition-colors"
                          onClick={(e) => {
                            e.preventDefault();
                            const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                            input.focus();
                            setActiveField(prev => prev === 'client' ? null : 'client');
                          }}
                        >
                          <ChevronDown size={16} />
                        </button>
                      </div>

                      {/* Custom Dropdown */}
                      {activeField === 'client' && clientSuggestions.length > 0 && (
                        <div className="absolute top-full left-0 w-full mt-1 bg-white border border-slate-100 rounded-lg shadow-xl max-h-48 overflow-y-auto custom-scrollbar z-50 animate-in fade-in zoom-in-95 duration-200">
                          {clientSuggestions.map((client, idx) => (
                            <div
                              key={idx}
                              className="px-3 py-2 text-sm text-slate-600 hover:bg-red-50 hover:text-sycapt-red cursor-pointer transition-colors border-b border-slate-50 last:border-0"
                              onClick={() => {
                                setClientName(client);
                              }}
                            >
                              {client}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Project Input */}
                    <div className="relative group">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-2">
                        Project Name
                        {projectName && projectSuggestions.length > 0 && activeField === 'project' && (
                          <span className="text-[9px] bg-red-50 text-sycapt-red px-1.5 py-0.5 rounded-full">{projectSuggestions.length} matches</span>
                        )}
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder={clientName ? "Search projects..." : "Enter project name"}
                          value={projectName}
                          onChange={(e) => {
                            setProjectName(e.target.value);
                            setActiveField('project');
                          }}
                          onFocus={() => setActiveField('project')}
                          onBlur={() => setTimeout(() => setActiveField(null), 200)}
                          className="w-full px-3 py-2.5 pr-10 rounded-lg bg-white border border-slate-200 focus:border-sycapt-red focus:ring-2 focus:ring-red-50 outline-none transition-all text-sm font-medium text-slate-700 placeholder:text-slate-300 relative z-10"
                          disabled={!clientName}
                          title={!clientName ? "Please select a client first" : ""}
                        />
                        <button
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-sycapt-red transition-colors z-20"
                          disabled={!clientName}
                          onClick={(e) => {
                            e.preventDefault();
                            const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                            if (input) input.focus();
                            setActiveField(prev => prev === 'project' ? null : 'project');
                          }}
                        >
                          <ChevronDown size={16} />
                        </button>
                      </div>
                      {!clientName && (
                        <div className="absolute inset-0 bg-slate-50/50 z-20 cursor-not-allowed rounded-lg" title="Please select a Client first" />
                      )}

                      {/* Custom Dropdown */}
                      {activeField === 'project' && projectSuggestions.length > 0 && (
                        <div className="absolute top-full left-0 w-full mt-1 bg-white border border-slate-100 rounded-lg shadow-xl max-h-48 overflow-y-auto custom-scrollbar z-50 animate-in fade-in zoom-in-95 duration-200">
                          {projectSuggestions.map((proj, idx) => (
                            <div
                              key={idx}
                              className="px-3 py-2 text-sm text-slate-600 hover:bg-red-50 hover:text-sycapt-red cursor-pointer transition-colors border-b border-slate-50 last:border-0"
                              onClick={() => setProjectName(proj)}
                            >
                              {proj}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Description Input */}
                  <div className="relative group">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-2">
                      Description
                      <span className="text-[9px] font-medium text-slate-400 normal-case">(optional - added to metadata)</span>
                    </label>
                    <textarea
                      placeholder="Enter document description..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg bg-white border border-slate-200 focus:border-sycapt-red focus:ring-2 focus:ring-red-50 outline-none transition-all text-sm font-medium text-slate-700 placeholder:text-slate-300 min-h-[80px] resize-none"
                    />
                  </div>
                </div>

                {/* Scrollable List */}
                <div className="flex-1 overflow-y-auto pr-2 space-y-3 mb-6 custom-scrollbar h-[300px]">
                  {files.map((file, idx) => (
                    <div key={`${file.name}-${idx}`} className={`group flex items-center gap-4 p-4 rounded-xl border transition-all duration-300 ${(currentFileIndex === idx) ? 'bg-orange-50 border-orange-200 shadow-md transform scale-[1.01]' :
                      'bg-white border-slate-100 hover:border-red-100 hover:shadow-sm'
                      } `}>
                      <div className="p-2.5 bg-slate-50 rounded-lg group-hover:bg-white transition-colors">
                        {getFileIcon(file.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-slate-700 text-sm truncate" title={file.name}>{file.name}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </span>
                          {isProcessing && currentFileIndex === idx && (
                            <span className="text-[10px] font-bold text-orange-500 animate-pulse">PROCESSING...</span>
                          )}
                          {isProcessing && (currentFileIndex ?? -1) > idx && (
                            <span className="text-[10px] font-bold text-green-500 flex items-center gap-1"><CheckCircle2 size={10} /> DONE</span>
                          )}
                        </div>
                      </div>
                      {!isProcessing && (
                        <button onClick={() => removeFile(idx)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                          <X size={18} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Footer Actions */}
                <div className="mt-auto border-t border-slate-100 pt-6 flex items-center justify-between gap-4">
                  {!isProcessing ? (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); clearFiles(); }} className="px-6 py-3 rounded-xl border border-slate-200 text-slate-500 font-bold hover:bg-slate-50 transition-colors text-sm flex items-center gap-2">
                        <Trash2 size={16} /> Clear All
                      </button>
                      <button
                        onClick={startProcessing}
                        disabled={!clientName}
                        title={!clientName ? "Please enter Client / Company name before starting." : ""}
                        className={`flex-1 px-6 py-3 rounded-xl font-bold shadow-lg transition-all text-sm flex items-center justify-center gap-2
                          ${!clientName
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                            : 'bg-sycapt-red text-white shadow-red-500/20 hover:shadow-red-500/40 hover:scale-[1.02] active:scale-95'
                          }`}
                      >
                        <Play size={16} fill="currentColor" /> Start Ingestion Process
                      </button>
                    </>
                  ) : (
                    <div className="w-full flex items-center justify-between gap-4 p-2">
                      <span className="text-sm font-bold text-slate-500 animate-pulse flex-1">
                        Processing Batch... {currentFileIndex !== null ? `${currentFileIndex + 1}/${files.length}` : ''}
                      </span >
                      <button
                        onClick={cancelProcessing}
                        className="px-4 py-2 bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 rounded-lg text-xs font-bold border border-slate-200 hover:border-red-200 transition-all flex items-center gap-2"
                      >
                        <X size={14} /> Cancel
                      </button>
                    </div >
                  )}
                </div >
              </div >
            )}
            <input type="file" ref={fileInputRef} className="hidden" multiple accept=".pdf,.docx,.pptx" onChange={(e) => { if (e.target.files) validateAndAddFiles(Array.from(e.target.files)); }} />
          </div >

          {/* RIGHT PANEL: Pipeline Status */}
          {
            (isProcessing || isCompleted || progressState?.stage === 'Cancelled') ? (
              <div className="w-full lg:w-[400px] bg-slate-50/50 backdrop-blur-xl p-8 lg:p-10 flex flex-col animate-slide-left border-l border-white/40">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <ScanLine size={20} className="text-sycapt-red" />
                    Pipeline Activity
                  </h3>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${isCompleted ? 'bg-green-500' : progressState?.stage === 'Cancelled' ? 'bg-orange-500' : 'bg-sycapt-red animate-pulse'}`}></span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                      {isCompleted ? 'IDLE' : progressState?.stage === 'Cancelled' ? 'STOPPED' : 'RUNNING'}
                    </span>
                  </div>
                </div>

                <div className="flex-1 space-y-3 relative">
                  <StepItem icon={ImageIcon} title="Visual Extraction" desc="OCR & Chart Analysis" isActive={progressState?.stage === 'Vision'} isDone={isCompleted || (progressState?.stage !== 'Vision' && progressState?.stage !== 'Upload' && progressState?.stage !== 'Skipped')} />
                  <StepItem icon={FileText} title="Semantic Chunking" desc="Text Splitting strategy" isActive={progressState?.stage === 'Chunking'} isDone={isCompleted || progressState?.stage === 'Embedding' || progressState?.stage === 'Indexing'} />
                  <StepItem icon={Cpu} title="Vector Embedding" desc="1024-dim Vectorization" isActive={progressState?.stage === 'Embedding'} isDone={isCompleted || progressState?.stage === 'Indexing'} />
                  <StepItem icon={Database} title="Database Indexing" desc="PostgreSQL Transaction" isActive={progressState?.stage === 'Indexing'} isDone={isCompleted} />
                </div>

                {/* Live Terminal Log */}
                {(isProcessing || progressState) && (
                  <div className="mt-8">
                    <div className="bg-slate-900 rounded-xl p-4 shadow-xl border border-slate-700/50 font-mono text-[10px] text-green-400 relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-full bg-scanline opacity-10 pointer-events-none"></div>
                      <div className="flex justify-between items-center mb-2 text-slate-500 font-sans font-bold uppercase tracking-wider text-[9px]">
                        <span>Terminal Output</span>
                        <span>{Math.round(progressState?.progress || 0)}%</span>
                      </div>
                      <div className="space-y-1">
                        <p className="opacity-50"> {'>'} System ready...</p>
                        <p className="opacity-70"> {'>'} Processing File {currentFileIndex !== null ? currentFileIndex + 1 : 0} / {files.length}</p>
                        <p className="opacity-70"> {'>'} Stage: {progressState?.stage}</p>
                        <p className={`${progressState?.stage === 'Error' ? 'text-red-500' : progressState?.stage === 'Cancelled' ? 'text-orange-500' : 'text-white'} animate-pulse`}> {'>'} {progressState?.message}</p>
                      </div>
                      <div className="mt-3 h-1 bg-slate-800 rounded-full overflow-hidden">
                        <div className={`h-full ${progressState?.stage === 'Error' ? 'bg-red-500' : progressState?.stage === 'Cancelled' ? 'bg-orange-500' : 'bg-green-500'}`} style={{ width: `${progressState?.progress || 0}%` }}></div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Status Message */}
                {(isCompleted || progressState?.stage === 'Cancelled') && (
                  <div className={`mt-4 flex flew-row items-center justify-center gap-3 w-full border p-3 rounded-xl animate-fade-in ${progressState?.stage === 'Cancelled' ? 'bg-orange-50/50 border-orange-100' : 'bg-green-50/50 border-green-100'}`}>
                    {progressState?.stage === 'Cancelled' ? <AlertTriangle size={18} className="text-orange-500" /> : <CheckCircle2 size={18} className="text-green-500" />}
                    <p className={`text-sm font-bold ${progressState?.stage === 'Cancelled' ? 'text-orange-700' : 'text-green-700'}`}>
                      {progressState?.stage === 'Cancelled' ? 'Upload Cancelled' : `Batch Complete: ${uploadStats.successful} uploaded, ${uploadStats.failed} failed.`}
                    </p>
                    <button onClick={clearFiles} className={`text-xs underline font-semibold ml-2 ${progressState?.stage === 'Cancelled' ? 'text-orange-600' : 'text-green-600'}`}>Dismiss</button>
                  </div>
                )}
              </div>
            ) : (
              <div className="hidden lg:flex w-[350px] bg-gradient-to-br from-slate-50 to-white p-10 flex-col justify-center items-center text-center border-l border-white/60">
                <div className="w-16 h-16 bg-white rounded-2xl shadow-lg border border-slate-100 flex items-center justify-center mb-6 rotate-3">
                  <Sparkles className="text-amber-500" />
                </div>
                <h3 className="font-bold text-slate-800 mb-2">Smart Ingestion</h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Our AI performs OCR, layout analysis, and semantic embedding automatically.
                  <br /><br />
                  Upload multiple documents! They will be queued and processed automatically.
                </p>
              </div>
            )
          }
        </div >

        {/* History Section */}
        < RecentUploads uploads={recentUploads} />

      </div >
    </div >
  );
};
