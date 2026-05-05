import React from 'react';
import { FileText, Calendar, Clock } from 'lucide-react';
import { DocumentDetail } from '../../types';

interface RecentUploadsProps {
    uploads: any[]; // Using any[] for now as types might be loose, should be DocRecord or similar
}

export const RecentUploads: React.FC<RecentUploadsProps> = ({ uploads }) => {
    if (!uploads || uploads.length === 0) return null;

    return (
        <div className="w-full mt-8 animate-fade-in-up">
            <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                <Clock size={20} className="text-sycapt-red" />
                Recent Upload History
            </h3>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Document Name</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Description</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Upload Date</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {uploads.slice(0, 10).map((doc: any) => (
                                <tr key={doc.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-slate-100 rounded-lg text-slate-500">
                                                <FileText size={16} />
                                            </div>
                                            <span className="font-semibold text-slate-700 text-sm">{doc.document_name || doc.filename}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-sm text-slate-500 line-clamp-1 max-w-[200px]" title={doc.description}>
                                            {doc.description || '-'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 text-slate-500 text-sm">
                                            <Calendar size={14} />
                                            <span>{new Date(doc.created_at || doc.uploadDate).toLocaleDateString()}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-100">
                                            Indexed
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
