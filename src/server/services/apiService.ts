import { ProcessingLog, SearchResult, SearchResponse, DocumentDetail } from '../../types';

export const processDocument = async (
  file: File,
  metadata: { projectName: string; clientName: string; description?: string },
  addLog: (log: ProcessingLog) => void
): Promise<boolean> => {

  const createLog = (msg: string, step: ProcessingLog['step']) => {
    addLog({
      timestamp: new Date().toLocaleTimeString(),
      message: msg,
      step
    });
  };

  try {
    createLog(`Starting upload for ${file.name}...`, 'upload');

    // Create FormData to send the actual file
    const formData = new FormData();
    formData.append('project_name', metadata.projectName);
    formData.append('client_name', metadata.clientName);
    formData.append('description', metadata.description || '');
    formData.append('file', file);

    createLog('Sending PDF to server for Marker processing...', 'upload');

    const response = await fetch('/api/upload-v2', {
      method: 'POST',
      body: formData, // No Content-Type header needed, browser sets it for FormData
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Upload failed');
    }

    const data = await response.json();

    createLog('Document successfully indexed.', 'complete');
    return true;

  } catch (error: any) {
    createLog(`Error: ${error.message}`, 'error');
    console.error(error);
    return false;
  }
};

export const searchDocuments = async (query: string): Promise<SearchResponse> => {
  try {
    const response = await fetch('/api/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error('Search failed');
    }

    return await response.json();
  } catch (error) {
    console.error('Search error:', error);
    // Return empty fallback
    return { answer: "An error occurred during search.", sources: [] };
  }
};

export const getDocumentById = async (id: string): Promise<DocumentDetail | null> => {
  try {
    const response = await fetch(`/api/documents/${id}`);
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error('Failed to fetch document');
    }
    return await response.json();
  } catch (error) {
    console.error('Get document error:', error);
    return null;
  }
};

export const updateDocument = async (
  id: string,
  content: string,
  filename?: string,
  metadata?: { projectName: string; clientName: string; description?: string }
): Promise<boolean> => {
  try {
    const response = await fetch(`/api/documents/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content,
        filename,
        projectName: metadata?.projectName,
        clientName: metadata?.clientName,
        description: metadata?.description
      }),
    });

    if (!response.ok) {
      throw new Error('Update failed');
    }
    return true;
  } catch (error) {
    console.error('Update document error:', error);
    return false;
  }
};

export const deleteDocument = async (id: string): Promise<boolean> => {
  try {
    const response = await fetch(`/api/documents/${id}`, {
      method: 'DELETE',
    });
    return response.ok;
  } catch (error) {
    console.error('Delete document error:', error);
    return false;
  }
};

export const chatWithAssistant = async (query: string): Promise<{ answer: string, sources: any[] }> => {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });

    if (!response.ok) throw new Error('Chat request failed');

    const data = await response.json();
    return {
      answer: data.answer || "No response received.",
      sources: data.sources || []
    };
  } catch (error) {

    console.error("Chat API Error:", error);
    return {
      answer: "Sorry, I couldn't reach the server.",
      sources: []
    };
  }
};

export const checkDuplicate = async (filename: string): Promise<boolean> => {
  try {
    const response = await fetch('/api/documents/check-duplicate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename })
    });
    if (!response.ok) return false;
    const data = await response.json();
    return data.exists;
  } catch (error) {
    console.error("Duplicate check failed:", error);
    return false;
  }
};
