export interface DocRecord {
  id: string;
  filename: string;
  uploadDate: Date;
  status: 'indexed' | 'processing' | 'error';
  vectorId?: string;
}

export interface ProcessingLog {
  timestamp: string;
  message: string;
  step: 'upload' | 'ocr' | 'embed' | 'db' | 'complete' | 'error';
}

export interface SearchResult {
  id?: string; // Added ID for navigation
  document_name: string;
  filename?: string; // Alias for document_name
  group_name: string;
  chunk_header: string;
  short_description?: string; // Alias for chunk_header
  content: string;
  keywords: string[];
  similarity: number;
  score: number; // For compatibility with UI that uses .score
  doc_id?: number; // Document ID for navigation
}

export interface SearchResponse {
  answer: string;
  sources: SearchResult[];
}

export interface DocumentDetail {
  id: string;
  filename: string;
  content: string;
  uploadDate: string;
  vectorId: string;
  tags: string[];
  shortDescription?: string;
  keywords?: string[];
  projectName?: string;
  clientName?: string;
  relatedDocuments?: { id: string; filename: string; file_type: string }[];
}

export enum AppView {
  UPLOAD = 'UPLOAD',
  SEARCH = 'SEARCH',
  CHAT = 'CHAT',
  SETTINGS = 'SETTINGS',
  DETAILS = 'DETAILS',
  LOGIN = 'LOGIN',
  REGISTER = 'REGISTER'
}