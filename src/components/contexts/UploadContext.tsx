import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { checkDuplicate, processDocument } from "../../server/services/apiService";

interface UploadContextType {
    files: File[];
    isProcessing: boolean;
    progressState: { stage: string; progress: number; message: string } | null;
    uploadStats: { successful: number; failed: number };
    isCompleted: boolean;
    duplicateConflict: { file: File; resolve: (choice: 'skip' | 'proceed') => void } | null;
    addFiles: (newFiles: File[]) => void;
    removeFile: (index: number) => void;
    clearFiles: () => void;
    startProcessing: () => Promise<void>;
    cancelProcessing: () => void;
    recentUploads: any[]; // cached history
    refreshRecentUploads: () => void;
    currentFileIndex: number | null;
    projectName: string;
    setProjectName: (name: string) => void;
    clientName: string;
    setClientName: (name: string) => void;
    description: string;
    setDescription: (desc: string) => void;
}

const UploadContext = createContext<UploadContextType | undefined>(undefined);

export const UploadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [files, setFiles] = useState<File[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [currentFileIndex, setCurrentFileIndex] = useState<number | null>(null);
    const [progressState, setProgressState] = useState<{ stage: string; progress: number; message: string } | null>(null);
    const [uploadStats, setUploadStats] = useState({ successful: 0, failed: 0 });
    const [isCompleted, setIsCompleted] = useState(false);
    const [duplicateConflict, setDuplicateConflict] = useState<{ file: File; resolve: (choice: 'skip' | 'proceed') => void } | null>(null);
    const [recentUploads, setRecentUploads] = useState<any[]>([]);

    const eventSourceRef = useRef<EventSource | null>(null);
    const isCancelledRef = useRef(false);

    const [projectName, setProjectName] = useState(() => localStorage.getItem("sycapt_project_name") || "");
    const [clientName, setClientName] = useState(() => localStorage.getItem("sycapt_client_name") || "");
    const [description, setDescription] = useState(() => localStorage.getItem("sycapt_description") || "");

    useEffect(() => {
        localStorage.setItem("sycapt_project_name", projectName);
    }, [projectName]);

    useEffect(() => {
        localStorage.setItem("sycapt_client_name", clientName);
    }, [clientName]);

    useEffect(() => {
        localStorage.setItem("sycapt_description", description);
    }, [description]);

    const refreshRecentUploads = async () => {
        try {
            const res = await fetch('/api/documents?limit=10'); // Fetch latest 10
            if (res.ok) {
                const data = await res.json();
                setRecentUploads(data.data);
            }
        } catch (err) {
            console.error("Failed to load recent uploads", err);
        }
    };

    useEffect(() => {
        refreshRecentUploads();
    }, []);

    const addFiles = (newFiles: File[]) => {
        setFiles((prev) => [...prev, ...newFiles]);
        setIsCompleted(false);
        setProgressState(null);
    };

    const removeFile = (index: number) => {
        setFiles((prev) => prev.filter((_, i) => i !== index));
    };

    const clearFiles = () => {
        setFiles([]);
        setProjectName("");
        setClientName("");
        setDescription("");
        setIsProcessing(false);
        setIsCompleted(false);
        setProgressState(null);
        setCurrentFileIndex(null);
    };

    const cancelProcessing = () => {
        isCancelledRef.current = true;
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }
    };

    const startProcessing = async () => {
        if (files.length === 0) return;
        setIsProcessing(true);
        setIsCompleted(false);
        setUploadStats({ successful: 0, failed: 0 });
        isCancelledRef.current = false;

        // Setup SSE
        if (eventSourceRef.current) eventSourceRef.current.close();
        const eventSource = new EventSource('/api/logs/stream');
        eventSourceRef.current = eventSource;
        eventSource.addEventListener('progress', (e: any) => {
            try {
                const data = JSON.parse(e.data);
                setProgressState(data);
            } catch (err) { }
        });

        try {
            let successCount = 0;
            let failCount = 0;

            for (let i = 0; i < files.length; i++) {
                if (isCancelledRef.current) {
                    setProgressState({ stage: 'Cancelled', progress: 0, message: 'Upload cancelled by user.' });
                    break;
                }

                setCurrentFileIndex(i);
                const file = files[i];

                // 1. Check Duplicate
                try {
                    const isDuplicate = await checkDuplicate(file.name);
                    if (isDuplicate) {
                        const choice = await new Promise<'skip' | 'proceed'>((resolve) => {
                            setDuplicateConflict({ file, resolve });
                        });

                        setDuplicateConflict(null);

                        // Re-check cancel after waiting for user input
                        if (isCancelledRef.current) break;

                        if (choice === 'skip') {
                            setProgressState({ stage: 'Skipped', progress: 100, message: `Skipped ${file.name}` });
                            await new Promise(r => setTimeout(r, 1000));
                            continue;
                        }
                    }
                } catch (err) {
                    console.error("Error checking duplicate", err);
                }

                if (isCancelledRef.current) break;

                setProgressState({ stage: 'Upload', progress: 0, message: `Starting upload for ${file.name}...` });

                try {
                    const success = await processDocument(file, { projectName, clientName, description }, () => { });
                    if (success) {
                        successCount++;
                        refreshRecentUploads();
                    } else {
                        failCount++;
                    }
                } catch (err) {
                    console.error(`Failed to upload ${file.name}`, err);
                    failCount++;
                }

                await new Promise(r => setTimeout(r, 500));
            }

            setUploadStats({ successful: successCount, failed: failCount });

            if (isCancelledRef.current) {
                setProgressState({ stage: 'Cancelled', progress: 0, message: 'Process was cancelled.' });
            } else {
                setProgressState({ stage: 'Complete', progress: 100, message: `Batch Processing Finished` });
                setIsCompleted(true);
                setFiles([]); // Clear queue only on natural completion
                // We keep project/client name for potentially next batch unless cleared explicitly
            }

        } catch (e) {
            console.error("Batch failed", e);
            setProgressState({ stage: 'Error', progress: 100, message: 'Batch Processing Failed' });
        } finally {
            setIsProcessing(false);
            setCurrentFileIndex(null);
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
                eventSourceRef.current = null;
            }
            if (duplicateConflict) setDuplicateConflict(null);
        }
    };

    return (
        <UploadContext.Provider value={{
            files, isProcessing, progressState, uploadStats, isCompleted,
            duplicateConflict, addFiles, removeFile, clearFiles, startProcessing, cancelProcessing,
            recentUploads, refreshRecentUploads, currentFileIndex,
            projectName, setProjectName, clientName, setClientName,
            description, setDescription
        }}>

            {children}
        </UploadContext.Provider>
    );
};

export const useUpload = () => {
    const context = useContext(UploadContext);
    if (!context) throw new Error("useUpload must be used within UploadProvider");
    return context;
};
