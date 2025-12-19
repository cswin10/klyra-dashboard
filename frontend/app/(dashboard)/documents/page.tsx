"use client";

import React, { useEffect, useState } from "react";
import { Trash2, Upload, FileText, Building2, Users, Mail, Shield, Package, FolderOpen } from "lucide-react";
import { StatusBadge } from "@/components";
import { api, Document, DocumentCategory, DOCUMENT_CATEGORIES } from "@/lib/api";
import { formatBytes, formatDate, cn } from "@/lib/utils";

const CATEGORY_ICONS: Record<DocumentCategory, React.ReactNode> = {
  company_info: <Building2 className="h-5 w-5" />,
  team: <Users className="h-5 w-5" />,
  templates: <Mail className="h-5 w-5" />,
  policies: <Shield className="h-5 w-5" />,
  products: <Package className="h-5 w-5" />,
  general: <FolderOpen className="h-5 w-5" />,
};

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory>("general");
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const docs = await api.getDocuments();
      setDocuments(docs);
    } catch (err) {
      console.error("Failed to fetch documents:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setError(null);

    try {
      for (const file of Array.from(files)) {
        const newDoc = await api.uploadDocument(file, selectedCategory);
        setDocuments((prev) => [newDoc, ...prev]);
      }

      // Poll for status updates
      const pollStatus = async () => {
        const docs = await api.getDocuments();
        setDocuments(docs);

        const hasProcessing = docs.some((d) => d.status === "processing");
        if (hasProcessing) {
          setTimeout(pollStatus, 2000);
        }
      };

      setTimeout(pollStatus, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload document");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (documentId: string) => {
    if (!confirm("Are you sure you want to delete this document?")) return;

    try {
      await api.deleteDocument(documentId);
      setDocuments((prev) => prev.filter((d) => d.id !== documentId));
    } catch (err) {
      console.error("Failed to delete document:", err);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleUpload(e.dataTransfer.files);
  };

  // Group documents by category
  const documentsByCategory = DOCUMENT_CATEGORIES.map((cat) => ({
    ...cat,
    documents: documents.filter((d) => d.category === cat.value),
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-page-title text-text-primary">Knowledge Base</h1>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-status-red/10 border border-status-red/20 rounded-card text-status-red text-sm">
          {error}
        </div>
      )}

      {/* Upload Section */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Upload Documents</h2>

        {/* Category Selection */}
        <div className="mb-4">
          <label className="block text-sm text-text-secondary mb-2">Select Category</label>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            {DOCUMENT_CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setSelectedCategory(cat.value)}
                className={cn(
                  "flex flex-col items-center gap-2 p-3 rounded-lg border transition-all",
                  selectedCategory === cat.value
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-card-border bg-card-bg text-text-secondary hover:border-accent/50"
                )}
              >
                {CATEGORY_ICONS[cat.value]}
                <span className="text-xs font-medium">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Drop Zone */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={cn(
            "relative border-2 border-dashed rounded-lg p-8 text-center transition-colors",
            dragActive
              ? "border-accent bg-accent/10"
              : "border-card-border hover:border-accent/50",
            isUploading && "opacity-50 pointer-events-none"
          )}
        >
          <input
            type="file"
            multiple
            accept=".pdf,.docx,.doc,.txt,.md"
            onChange={(e) => handleUpload(e.target.files)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={isUploading}
          />
          <Upload className="h-8 w-8 mx-auto mb-3 text-text-muted" />
          <p className="text-text-primary font-medium">
            {isUploading ? "Uploading..." : "Drop files here or click to upload"}
          </p>
          <p className="text-sm text-text-muted mt-1">
            PDF, DOCX, TXT, MD files supported
          </p>
        </div>
      </div>

      {/* Documents by Category */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
        </div>
      ) : documents.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <FileText className="h-12 w-12 mx-auto mb-4 text-text-muted" />
          <p className="text-text-secondary">No documents uploaded yet</p>
          <p className="text-sm text-text-muted mt-1">Upload documents to build your knowledge base</p>
        </div>
      ) : (
        <div className="space-y-6">
          {documentsByCategory
            .filter((cat) => cat.documents.length > 0)
            .map((cat) => (
              <div key={cat.value} className="glass-card overflow-hidden">
                {/* Category Header */}
                <div className="flex items-center gap-3 p-4 border-b border-card-border bg-card-bg/50">
                  <span className="text-accent">{CATEGORY_ICONS[cat.value]}</span>
                  <div>
                    <h3 className="font-semibold text-text-primary">{cat.label}</h3>
                    <p className="text-xs text-text-muted">{cat.description}</p>
                  </div>
                  <span className="ml-auto px-2 py-1 rounded-full bg-accent/10 text-accent text-xs font-medium">
                    {cat.documents.length} {cat.documents.length === 1 ? "doc" : "docs"}
                  </span>
                </div>

                {/* Documents List */}
                <div className="divide-y divide-card-border">
                  {cat.documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center gap-4 p-4 hover:bg-card-bg/30 transition-colors"
                    >
                      <FileText className="h-5 w-5 text-text-muted flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-text-primary truncate">{doc.name}</p>
                        <p className="text-xs text-text-muted">
                          {doc.file_type.toUpperCase()} • {formatBytes(doc.file_size)} • {formatDate(doc.uploaded_at)}
                          {doc.chunk_count > 0 && ` • ${doc.chunk_count} chunks`}
                        </p>
                      </div>
                      <StatusBadge status={doc.status} />
                      <button
                        onClick={() => handleDelete(doc.id)}
                        className="p-2 rounded-lg text-text-secondary hover:text-status-red hover:bg-status-red/10 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
