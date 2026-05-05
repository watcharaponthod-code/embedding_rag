import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { CONFIG } from '../../config';

interface DocItem {
    id: string;
    document_name: string;
    created_at: string;
    chunk_count: number;
    file_type?: string;
    client_name?: string;
    project_name?: string;
}

interface DocumentContextType {
    documents: DocItem[];
    loading: boolean;
    page: number;
    totalPages: number;
    filterType: string;
    selectedClient: string;
    selectedProject: string;
    sortBy: string;
    sortOrder: string;
    filterOptions: { clients: string[], projects: any[] };

    setPage: (page: number) => void;
    setFilterType: (type: string) => void;
    setSelectedClient: (client: string) => void;
    setSelectedProject: (project: string) => void;
    setSortBy: (field: string) => void;
    setSortOrder: (order: string) => void;
    fetchDocuments: (force?: boolean) => Promise<void>;
    deleteDocument: (id: string, name: string) => Promise<boolean>;
    updateDocumentMetadata: (id: string, clientName: string, projectName: string) => Promise<boolean>;
    deleteDocuments: (ids: string[]) => Promise<boolean>;
    updateDocumentsMetadata: (ids: string[], clientName: string, projectName: string) => Promise<boolean>;
    refreshFilters: () => Promise<void>;
}

const DocumentContext = createContext<DocumentContextType | undefined>(undefined);

export const DocumentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [documents, setDocuments] = useState<DocItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [filterType, setFilterType] = useState('ALL');
    const [selectedClient, setSelectedClient] = useState('');
    const [selectedProject, setSelectedProject] = useState('');
    const [sortBy, setSortBy] = useState('created_at');
    const [sortOrder, setSortOrder] = useState('desc');
    const [filterOptions, setFilterOptions] = useState<{ clients: string[], projects: any[] }>({ clients: [], projects: [] });

    // Track if initial load is done to prevent unnecessary refetch on remount
    const [isLoaded, setIsLoaded] = useState(false);

    // Fetch filter options
    const fetchFilters = useCallback(async () => {
        try {
            const res = await fetch('/api/filters/options');
            const data = await res.json();
            setFilterOptions(data);
        } catch (err) {
            console.error("Failed to load filters", err);
        }
    }, []);

    // Initial load of filters
    useEffect(() => {
        fetchFilters();
    }, [fetchFilters]);

    const fetchDocuments = useCallback(async (force = false) => {
        // If already loaded and not forcing, skip (Cache Hit behavior)
        // But if page/filters changed, we usually want to fetch. 
        // We should rely on useEffect dependency in component OR manual call.
        // Here we'll just implement the fetcher.

        setLoading(true);
        try {
            const queryParams = new URLSearchParams({
                page: page.toString(),
                limit: '50',
                type: filterType,
                clientName: selectedClient,
                projectName: selectedProject,
                sortBy: sortBy,
                sortOrder: sortOrder
            });
            const res = await fetch(`/api/documents?${queryParams.toString()}`);
            const data = await res.json();
            if (data.data) {
                setDocuments(data.data);
                setTotalPages(data.pagination.totalPages);
                setIsLoaded(true);
            }
        } catch (error) {
            console.error("Failed to fetch docs:", error);
        } finally {
            setLoading(false);
        }
    }, [page, filterType, selectedClient, selectedProject, sortBy, sortOrder]);

    // Handle deletions globally
    const deleteDocument = async (id: string, name: string): Promise<boolean> => {
        if (!confirm(`Are you sure you want to delete "${name}"? This cannot be undone.`)) return false;

        // Optimistically remove from UI
        setDocuments(prev => prev.filter(d => d.id !== id));

        try {
            const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
            if (!res.ok) {
                alert('Failed to delete document');
                fetchDocuments(true); // Revert on failure
                return false;
            } else {
                // Refresh filters after successful deletion
                fetchFilters();
                return true;
            }
        } catch (error) {
            console.error(error);
            fetchDocuments(true); // Revert on error
            return false;
        }
    };

    // Batch Delete
    const deleteDocuments = async (ids: string[]): Promise<boolean> => {
        if (!confirm(`Are you sure you want to delete ${ids.length} documents? This cannot be undone.`)) return false;

        // Optimistically remove
        setDocuments(prev => prev.filter(d => !ids.includes(d.id)));

        try {
            const res = await fetch(`/api/documents/batch/delete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids })
            });

            if (!res.ok) {
                alert('Failed to delete documents');
                fetchDocuments(true);
                return false;
            }
            fetchFilters();
            return true;
        } catch (error) {
            console.error(error);
            fetchDocuments(true);
            return false;
        }
    };

    // Update Metadata (Single)
    const updateDocumentMetadata = async (id: string, clientName: string, projectName: string): Promise<boolean> => {
        try {
            // Optimistic UI Update
            setDocuments(prev => prev.map(d =>
                d.id === id ? { ...d, client_name: clientName, project_name: projectName } : d
            ));

            const res = await fetch(`/api/documents/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    // No content sent -> triggers metadata-only update in backend
                    clientName,
                    projectName
                })
            });

            if (!res.ok) {
                const err = await res.json();
                console.error("Update failed", err);
                alert("Failed to update document: " + (err.error || "Unknown error"));
                fetchDocuments(true); // Revert
                return false;
            }

            // Success -> Refresh filters as clients/projects might have changed/added
            fetchFilters();
            return true;
        } catch (error) {
            console.error("Update error:", error);
            fetchDocuments(true); // Revert
            return false;
        }
    };

    // Batch Update Metadata
    const updateDocumentsMetadata = async (ids: string[], clientName: string, projectName: string): Promise<boolean> => {
        try {
            // Optimistic Update
            setDocuments(prev => prev.map(d =>
                ids.includes(d.id) ? { ...d, client_name: clientName, project_name: projectName } : d
            ));

            const res = await fetch(`/api/documents/batch/update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids, clientName, projectName })
            });

            if (!res.ok) {
                alert('Failed to batch update documents');
                fetchDocuments(true);
                return false;
            }
            fetchFilters();
            return true;
        } catch (error) {
            console.error("Batch update error:", error);
            fetchDocuments(true);
            return false;
        }
    };

    // Auto-fetch when filters change
    // Note: We move this logic here so it persists across view changes
    useEffect(() => {
        fetchDocuments();
    }, [fetchDocuments]);

    return (
        <DocumentContext.Provider value={{
            documents,
            loading,
            page,
            totalPages,
            filterType,
            selectedClient,
            selectedProject,
            sortBy,
            sortOrder,
            filterOptions,
            setPage,
            setFilterType,
            setSelectedClient,
            setSelectedProject,
            setSortBy,
            setSortOrder,
            fetchDocuments,
            deleteDocument,
            updateDocumentMetadata,
            deleteDocuments,
            updateDocumentsMetadata,
            refreshFilters: fetchFilters
        }}>
            {children}
        </DocumentContext.Provider>
    );
};

export const useDocuments = () => {
    const context = useContext(DocumentContext);
    if (context === undefined) {
        throw new Error('useDocuments must be used within a DocumentProvider');
    }
    return context;
};
