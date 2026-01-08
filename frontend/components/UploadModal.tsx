"use client";

import React, { useState, useEffect } from "react";
import { X, Upload, FileText, Building2, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { DocumentCategory, DOCUMENT_CATEGORIES } from "@/lib/api";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: File | null;
  onUpload: (options: { name: string; category: DocumentCategory; is_company_wide: boolean }) => void;
  isUploading?: boolean;
  isAdmin?: boolean;
  personalDocCount?: number;
  personalDocLimit?: number;
}

export function UploadModal({
  isOpen,
  onClose,
  file,
  onUpload,
  isUploading = false,
  isAdmin = false,
  personalDocCount = 0,
  personalDocLimit = 10,
}: UploadModalProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<DocumentCategory>("other");
  const [isCompanyWide, setIsCompanyWide] = useState(isAdmin); // Default to company-wide for admins

  // Reset form when file changes
  useEffect(() => {
    if (file) {
      // Use filename without extension as default name
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
      setName(nameWithoutExt);
      setCategory("other");
      setIsCompanyWide(isAdmin);
    }
  }, [file, isAdmin]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen || !file) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onUpload({ name: name.trim(), category, is_company_wide: isCompanyWide });
  };

  const canUploadPersonal = personalDocCount < personalDocLimit;
  const mustBeCompanyWide = isAdmin && !canUploadPersonal;

  // Format file size
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={!isUploading ? onClose : undefined}
      />

      {/* Modal Content */}
      <div className="relative bg-card-bg rounded-card border border-card-border w-full max-w-md shadow-xl mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-card-border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent/10">
              <Upload className="h-5 w-5 text-accent" />
            </div>
            <h2 className="text-lg font-semibold text-text-primary">Upload Document</h2>
          </div>
          <button
            onClick={onClose}
            disabled={isUploading}
            className="p-1 rounded-lg text-text-secondary hover:text-text-primary hover:bg-icon-bg transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* File Info */}
          <div className="flex items-center gap-3 p-3 bg-page-bg rounded-lg">
            <FileText className="h-5 w-5 text-text-muted flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">{file.name}</p>
              <p className="text-xs text-text-muted">{formatSize(file.size)}</p>
            </div>
          </div>

          {/* Document Name */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              Document Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter document name"
              className="w-full px-3 py-2 bg-page-bg border border-card-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50"
              disabled={isUploading}
              required
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              Category
            </label>
            <div className="grid grid-cols-2 gap-2">
              {DOCUMENT_CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(cat.value)}
                  disabled={isUploading}
                  className={cn(
                    "flex flex-col items-start p-2.5 rounded-lg border text-left transition-all",
                    category === cat.value
                      ? "border-accent bg-accent/10"
                      : "border-card-border bg-page-bg hover:border-accent/50",
                    isUploading && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <span className={cn(
                    "text-sm font-medium",
                    category === cat.value ? "text-accent" : "text-text-primary"
                  )}>
                    {cat.label}
                  </span>
                  <span className="text-xs text-text-muted line-clamp-1">{cat.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Company-wide Toggle (Admin only) */}
          {isAdmin && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-text-secondary">
                Visibility
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsCompanyWide(true)}
                  disabled={isUploading}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border transition-all",
                    isCompanyWide
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-card-border bg-page-bg text-text-secondary hover:border-accent/50",
                    isUploading && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <Building2 className="h-4 w-4" />
                  <span className="text-sm font-medium">Company-wide</span>
                </button>
                <button
                  type="button"
                  onClick={() => canUploadPersonal && setIsCompanyWide(false)}
                  disabled={isUploading || !canUploadPersonal}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border transition-all",
                    !isCompanyWide
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-card-border bg-page-bg text-text-secondary hover:border-accent/50",
                    (isUploading || !canUploadPersonal) && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <User className="h-4 w-4" />
                  <span className="text-sm font-medium">Personal</span>
                </button>
              </div>
              {!canUploadPersonal && (
                <p className="text-xs text-status-yellow">
                  Personal document limit reached ({personalDocLimit}/{personalDocLimit})
                </p>
              )}
              {isCompanyWide && (
                <p className="text-xs text-text-muted">
                  Company-wide documents are visible to all users
                </p>
              )}
              {!isCompanyWide && (
                <p className="text-xs text-text-muted">
                  Personal documents are only visible to you ({personalDocCount}/{personalDocLimit})
                </p>
              )}
            </div>
          )}

          {/* Non-admin personal limit warning */}
          {!isAdmin && (
            <div className="flex items-center gap-2 p-3 bg-page-bg rounded-lg">
              <User className="h-4 w-4 text-text-muted" />
              <p className="text-xs text-text-muted">
                Personal document ({personalDocCount}/{personalDocLimit} used)
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="flex-1 px-4 py-2.5 rounded-lg border border-card-border text-text-secondary hover:text-text-primary hover:bg-page-bg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploading || !name.trim()}
              className="flex-1 px-4 py-2.5 rounded-lg bg-accent text-white font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isUploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Upload
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
