"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Trash2, Upload, FileText, Building2, User, Search, X, History, RefreshCw, Download, ExternalLink } from "lucide-react";
import { StatusBadge, Popup, UploadModal } from "@/components";
import { api, Document, DocumentCategory, DOCUMENT_CATEGORIES, DocumentSearchResult, DocumentVersion, MyDocumentCount } from "@/lib/api";
import { formatBytes, formatDate, cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

type TabType = "company" | "personal";

export default function DocumentsPage() {
  const { user, isAdmin } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("company");
  const [dragActive, setDragActive] = useState(false);

  // Upload modal state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [docCount, setDocCount] = useState<MyDocumentCount>({ count: 0, limit: 10 });

  // Error popup state
  const [popup, setPopup] = useState<{
    isOpen: boolean;
    type: "error" | "success" | "warning" | "info";
    title: string;
    message: string;
  }>({ isOpen: false, type: "info", title: "", message: "" });

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    doc: Document | null;
  }>({ isOpen: false, doc: null });

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<DocumentSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  // Version history state
  const [versionModalDoc, setVersionModalDoc] = useState<Document | null>(null);
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [uploadVersionDoc, setUploadVersionDoc] = useState<Document | null>(null);

  useEffect(() => {
    fetchDocuments();
    fetchDocumentCount();
  }, []);

  // Debounced search
  const handleSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await api.searchDocuments(query);
      setSearchResults(response.results);
    } catch (err) {
      console.error("Search failed:", err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        handleSearch(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

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

  const fetchDocumentCount = async () => {
    try {
      const count = await api.getMyDocumentCount();
      setDocCount(count);
    } catch (err) {
      console.error("Failed to fetch document count:", err);
    }
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];

    // For non-admin users, check limit before showing modal
    if (!isAdmin && docCount.count >= docCount.limit) {
      setPopup({
        isOpen: true,
        type: "warning",
        title: "Document Limit Reached",
        message: `You have reached your personal document limit of ${docCount.limit} documents. Please delete some documents before uploading more.`,
      });
      return;
    }

    setUploadFile(file);
    setShowUploadModal(true);
  };

  const handleUpload = async (options: { name: string; category: DocumentCategory; is_company_wide: boolean }) => {
    if (!uploadFile) return;

    setIsUploading(true);

    try {
      const newDoc = await api.uploadDocument(uploadFile, options);
      setDocuments((prev) => [newDoc, ...prev]);
      setShowUploadModal(false);
      setUploadFile(null);

      // Refresh document count
      fetchDocumentCount();

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

      setPopup({
        isOpen: true,
        type: "success",
        title: "Document Uploaded",
        message: `"${options.name}" has been uploaded and is being processed.`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to upload document";
      setPopup({
        isOpen: true,
        type: "error",
        title: "Upload Failed",
        message,
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = (doc: Document) => {
    // Check permissions
    if (!isAdmin && doc.is_company_wide) {
      setPopup({
        isOpen: true,
        type: "error",
        title: "Permission Denied",
        message: "Only administrators can delete company-wide documents.",
      });
      return;
    }

    // Show confirmation popup
    setDeleteConfirm({ isOpen: true, doc });
  };

  const confirmDelete = async () => {
    const doc = deleteConfirm.doc;
    if (!doc) return;

    setDeleteConfirm({ isOpen: false, doc: null });

    try {
      await api.deleteDocument(doc.id);
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      fetchDocumentCount();
      setPopup({
        isOpen: true,
        type: "success",
        title: "Document Deleted",
        message: `"${doc.name}" has been deleted.`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete document";
      setPopup({
        isOpen: true,
        type: "error",
        title: "Delete Failed",
        message,
      });
    }
  };

  const handleDownload = async (doc: Document) => {
    try {
      const blob = await api.downloadDocument(doc.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.original_filename || doc.name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to download document";
      setPopup({
        isOpen: true,
        type: "error",
        title: "Download Failed",
        message,
      });
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
    handleFileSelect(e.dataTransfer.files);
  };

  // Filter documents by tab
  const companyDocs = documents.filter((d) => d.is_company_wide);
  const personalDocs = documents.filter((d) => !d.is_company_wide);
  const displayDocs = activeTab === "company" ? companyDocs : personalDocs;

  // Group by category
  const documentsByCategory = DOCUMENT_CATEGORIES.map((cat) => ({
    ...cat,
    documents: displayDocs.filter((d) => d.category === cat.value),
  })).filter((cat) => cat.documents.length > 0);

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    setShowSearch(false);
  };

  const handleViewVersions = async (doc: Document) => {
    setVersionModalDoc(doc);
    setIsLoadingVersions(true);
    try {
      const versionList = await api.getDocumentVersions(doc.id);
      setVersions(versionList);
    } catch (err) {
      console.error("Failed to fetch versions:", err);
      setVersions([]);
    } finally {
      setIsLoadingVersions(false);
    }
  };

  const handleUploadNewVersion = async (files: FileList | null) => {
    if (!files || files.length === 0 || !uploadVersionDoc) return;

    setIsUploading(true);

    try {
      await api.uploadNewVersion(uploadVersionDoc.id, files[0]);
      await fetchDocuments();
      setUploadVersionDoc(null);

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
      const message = err instanceof Error ? err.message : "Failed to upload new version";
      setPopup({
        isOpen: true,
        type: "error",
        title: "Upload Failed",
        message,
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRevertToVersion = async (versionId: string) => {
    if (!versionModalDoc) return;
    if (!confirm("Revert to this version? The current version will be archived.")) return;

    try {
      await api.revertToVersion(versionModalDoc.id, versionId);
      await fetchDocuments();
      setVersionModalDoc(null);
    } catch (err) {
      console.error("Failed to revert:", err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-page-title text-text-primary">Knowledge Base</h1>
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <input
            type="text"
            placeholder="Search within documents..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSearch(true);
            }}
            onFocus={() => setShowSearch(true)}
            className="w-full pl-10 pr-10 py-2.5 bg-card-bg border border-card-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Search Results */}
      {showSearch && searchQuery && (
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-text-primary">
              Search Results {searchResults.length > 0 && `(${searchResults.length})`}
            </h3>
            <button
              onClick={clearSearch}
              className="text-sm text-text-muted hover:text-text-primary"
            >
              Clear
            </button>
          </div>

          {isSearching ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent"></div>
            </div>
          ) : searchResults.length === 0 ? (
            <p className="text-text-muted text-sm py-4 text-center">
              {searchQuery.length < 2 ? "Type at least 2 characters to search" : "No results found"}
            </p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {searchResults.map((result, index) => (
                <div
                  key={index}
                  className="p-3 bg-card-bg/50 rounded-lg border border-card-border"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4 text-accent" />
                    <span className="font-medium text-text-primary text-sm">
                      {result.document_name}
                    </span>
                    {result.category && (
                      <span className="px-2 py-0.5 rounded-full bg-accent/10 text-accent text-xs">
                        {DOCUMENT_CATEGORIES.find(c => c.value === result.category)?.label || result.category}
                      </span>
                    )}
                    <span className="ml-auto text-xs text-text-muted">
                      {Math.round(result.relevance_score * 100)}% match
                    </span>
                  </div>
                  <p className="text-sm text-text-secondary line-clamp-3">
                    {result.excerpt}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Processing Banner */}
      {documents.some((d) => d.status === "processing") && (
        <div className="flex items-center gap-3 p-4 bg-status-yellow/10 border border-status-yellow/20 rounded-card">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-status-yellow border-t-transparent"></div>
          <div className="flex-1">
            <p className="text-status-yellow font-medium">
              Processing documents...
            </p>
            <p className="text-sm text-status-yellow/80">
              {documents.filter((d) => d.status === "processing").length} document(s) being indexed. This page updates automatically.
            </p>
          </div>
        </div>
      )}

      {/* Upload Section */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary">Upload Documents</h2>
          {!isAdmin && (
            <span className="text-sm text-text-muted">
              {docCount.count}/{docCount.limit} personal documents
            </span>
          )}
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
            accept=".pdf,.docx,.doc,.txt,.md"
            onChange={(e) => handleFileSelect(e.target.files)}
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

      {/* Tabs */}
      <div className="flex gap-2 border-b border-card-border">
        <button
          onClick={() => setActiveTab("company")}
          className={cn(
            "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px",
            activeTab === "company"
              ? "border-accent text-accent"
              : "border-transparent text-text-muted hover:text-text-primary"
          )}
        >
          <Building2 className="h-4 w-4" />
          Company Documents
          <span className={cn(
            "px-2 py-0.5 rounded-full text-xs",
            activeTab === "company" ? "bg-accent/10" : "bg-card-bg"
          )}>
            {companyDocs.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("personal")}
          className={cn(
            "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px",
            activeTab === "personal"
              ? "border-accent text-accent"
              : "border-transparent text-text-muted hover:text-text-primary"
          )}
        >
          <User className="h-4 w-4" />
          My Documents
          <span className={cn(
            "px-2 py-0.5 rounded-full text-xs",
            activeTab === "personal" ? "bg-accent/10" : "bg-card-bg"
          )}>
            {personalDocs.length}
          </span>
        </button>
      </div>

      {/* Documents List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
        </div>
      ) : displayDocs.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <FileText className="h-12 w-12 mx-auto mb-4 text-text-muted" />
          <p className="text-text-secondary">
            {activeTab === "company"
              ? "No company documents yet"
              : "No personal documents yet"}
          </p>
          <p className="text-sm text-text-muted mt-1">
            Upload documents to build your knowledge base
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {documentsByCategory.map((cat) => (
            <div key={cat.value} className="glass-card overflow-hidden">
              {/* Category Header */}
              <div className="flex items-center gap-3 p-4 border-b border-card-border bg-card-bg/50">
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
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-text-primary truncate">{doc.name}</p>
                        {doc.version > 1 && (
                          <span className="px-1.5 py-0.5 rounded bg-accent/10 text-accent text-xs font-medium">
                            v{doc.version}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-text-muted">
                        {doc.file_type.toUpperCase()} • {formatBytes(doc.file_size)} • {formatDate(doc.uploaded_at)}
                        {doc.chunk_count > 0 && ` • ${doc.chunk_count} chunks`}
                      </p>
                    </div>
                    <StatusBadge status={doc.status} />

                    {/* Download Button */}
                    <button
                      onClick={() => handleDownload(doc)}
                      className="p-2 rounded-lg text-text-secondary hover:text-accent hover:bg-accent/10 transition-colors"
                      title="Download document"
                    >
                      <Download className="h-4 w-4" />
                    </button>

                    {/* Version Controls (only for admins or own personal docs) */}
                    {(isAdmin || !doc.is_company_wide) && (
                      <>
                        <button
                          onClick={() => setUploadVersionDoc(doc)}
                          className="p-2 rounded-lg text-text-secondary hover:text-accent hover:bg-accent/10 transition-colors"
                          title="Upload new version"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleViewVersions(doc)}
                          className="p-2 rounded-lg text-text-secondary hover:text-accent hover:bg-accent/10 transition-colors"
                          title="View version history"
                        >
                          <History className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(doc)}
                          className="p-2 rounded-lg text-text-secondary hover:text-status-red hover:bg-status-red/10 transition-colors"
                          title="Delete document"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      <UploadModal
        isOpen={showUploadModal}
        onClose={() => {
          setShowUploadModal(false);
          setUploadFile(null);
        }}
        file={uploadFile}
        onUpload={handleUpload}
        isUploading={isUploading}
        isAdmin={isAdmin}
        personalDocCount={docCount.count}
        personalDocLimit={docCount.limit}
      />

      {/* Error/Success Popup */}
      <Popup
        isOpen={popup.isOpen}
        onClose={() => setPopup((p) => ({ ...p, isOpen: false }))}
        type={popup.type}
        title={popup.title}
        message={popup.message}
      />

      {/* Delete Confirmation Popup */}
      <Popup
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, doc: null })}
        type="warning"
        title="Delete Document"
        message={`Are you sure you want to delete "${deleteConfirm.doc?.name}"? This action cannot be undone.`}
        actionLabel="Delete"
        onAction={confirmDelete}
        secondaryLabel="Cancel"
        onSecondary={() => setDeleteConfirm({ isOpen: false, doc: null })}
      />

      {/* Version History Modal */}
      {versionModalDoc && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-page-bg rounded-card border border-card-border shadow-xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between p-4 border-b border-card-border">
              <div>
                <h3 className="font-semibold text-text-primary">Version History</h3>
                <p className="text-sm text-text-muted truncate">{versionModalDoc.name}</p>
              </div>
              <button
                onClick={() => setVersionModalDoc(null)}
                className="p-2 rounded-lg hover:bg-card-bg transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 max-h-96 overflow-y-auto">
              {isLoadingVersions ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent"></div>
                </div>
              ) : versions.length === 0 ? (
                <p className="text-center text-text-muted py-8">No version history available</p>
              ) : (
                <div className="space-y-2">
                  {versions.map((version) => (
                    <div
                      key={version.id}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border",
                        version.id === versionModalDoc.id
                          ? "border-accent bg-accent/5"
                          : "border-card-border bg-card-bg/50"
                      )}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-text-primary">
                            Version {version.version}
                          </span>
                          {version.id === versionModalDoc.id && (
                            <span className="px-1.5 py-0.5 rounded bg-accent/20 text-accent text-xs">
                              Current
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-text-muted">
                          {formatDate(version.uploaded_at)} • {formatBytes(version.file_size)}
                        </p>
                      </div>
                      {version.id !== versionModalDoc.id && (
                        <button
                          onClick={() => handleRevertToVersion(version.id)}
                          className="px-3 py-1.5 text-sm bg-accent/10 text-accent rounded-lg hover:bg-accent/20 transition-colors"
                        >
                          Revert
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upload New Version Modal */}
      {uploadVersionDoc && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-page-bg rounded-card border border-card-border shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-card-border">
              <div>
                <h3 className="font-semibold text-text-primary">Upload New Version</h3>
                <p className="text-sm text-text-muted truncate">{uploadVersionDoc.name}</p>
              </div>
              <button
                onClick={() => setUploadVersionDoc(null)}
                className="p-2 rounded-lg hover:bg-card-bg transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4">
              <p className="text-sm text-text-secondary mb-4">
                Current version: <span className="text-accent font-medium">v{uploadVersionDoc.version}</span>
              </p>

              <div
                className={cn(
                  "relative border-2 border-dashed rounded-lg p-6 text-center transition-colors",
                  "border-card-border hover:border-accent/50",
                  isUploading && "opacity-50 pointer-events-none"
                )}
              >
                <input
                  type="file"
                  accept=".pdf,.docx,.doc,.txt,.md"
                  onChange={(e) => handleUploadNewVersion(e.target.files)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={isUploading}
                />
                <Upload className="h-6 w-6 mx-auto mb-2 text-text-muted" />
                <p className="text-sm text-text-primary">
                  {isUploading ? "Uploading..." : "Click to select file"}
                </p>
                <p className="text-xs text-text-muted mt-1">
                  This will create version {uploadVersionDoc.version + 1}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-4 border-t border-card-border">
              <button
                onClick={() => setUploadVersionDoc(null)}
                className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
