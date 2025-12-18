"use client";

import React, { useCallback, useState } from "react";
import { Upload, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface DocumentUploadProps {
  onUpload: (file: File) => Promise<void>;
  isUploading?: boolean;
}

export function DocumentUpload({ onUpload, isUploading = false }: DocumentUploadProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      const file = files[0];
      if (file) {
        await onUpload(file);
      }
    },
    [onUpload]
  );

  const handleFileInput = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        await onUpload(file);
        e.target.value = "";
      }
    },
    [onUpload]
  );

  return (
    <label
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "relative flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-card cursor-pointer transition-all duration-fast",
        isDragging
          ? "border-accent bg-accent/5"
          : "border-card-border hover:border-accent/50 hover:bg-card-bg/50",
        isUploading && "pointer-events-none opacity-60"
      )}
    >
      <input
        type="file"
        className="sr-only"
        onChange={handleFileInput}
        accept=".pdf,.docx,.doc,.txt"
        disabled={isUploading}
      />

      <div className="flex flex-col items-center gap-3">
        {isUploading ? (
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-accent"></div>
        ) : (
          <div className="p-3 rounded-full bg-icon-bg">
            <Upload className={cn("h-6 w-6", isDragging ? "text-accent" : "text-text-secondary")} />
          </div>
        )}

        <div className="text-center">
          <p className="text-sm font-medium text-text-primary">
            {isUploading ? "Uploading..." : "Drag and drop files here"}
          </p>
          <p className="text-xs text-text-secondary mt-1">
            or click to browse
          </p>
        </div>

        <div className="flex items-center gap-2 text-text-muted text-xs">
          <FileText className="h-3 w-3" />
          <span>Supports PDF, DOCX, TXT</span>
        </div>
      </div>
    </label>
  );
}
