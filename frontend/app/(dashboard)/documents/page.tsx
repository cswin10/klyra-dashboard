"use client";

import React, { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { DocumentUpload, DataTable, StatusBadge } from "@/components";
import { api, Document } from "@/lib/api";
import { formatBytes, formatDate } from "@/lib/utils";

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    setError(null);

    try {
      const newDoc = await api.uploadDocument(file);
      setDocuments((prev) => [newDoc, ...prev]);

      // Poll for status updates
      const pollStatus = async () => {
        const docs = await api.getDocuments();
        setDocuments(docs);

        const doc = docs.find((d) => d.id === newDoc.id);
        if (doc && doc.status === "processing") {
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

  const columns = [
    {
      key: "name",
      header: "Name",
      render: (doc: Document) => (
        <span className="font-medium">{doc.name}</span>
      ),
    },
    {
      key: "file_type",
      header: "Type",
      render: (doc: Document) => (
        <span className="uppercase text-text-secondary">{doc.file_type}</span>
      ),
    },
    {
      key: "file_size",
      header: "Size",
      render: (doc: Document) => (
        <span className="text-text-secondary">{formatBytes(doc.file_size)}</span>
      ),
    },
    {
      key: "uploaded_at",
      header: "Uploaded",
      render: (doc: Document) => (
        <span className="text-text-secondary">{formatDate(doc.uploaded_at)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (doc: Document) => <StatusBadge status={doc.status} />,
    },
    {
      key: "actions",
      header: "Actions",
      render: (doc: Document) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDelete(doc.id);
          }}
          className="p-2 rounded-lg text-text-secondary hover:text-status-red hover:bg-status-red/10 transition-colors"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-page-title text-text-primary">Documents</h1>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-status-red/10 border border-status-red/20 rounded-card text-status-red text-sm">
          {error}
        </div>
      )}

      {/* Upload Zone */}
      <DocumentUpload onUpload={handleUpload} isUploading={isUploading} />

      {/* Documents Table */}
      <DataTable
        columns={columns}
        data={documents}
        isLoading={isLoading}
        emptyMessage="No documents uploaded yet"
      />
    </div>
  );
}
