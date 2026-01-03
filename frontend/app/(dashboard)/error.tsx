"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-8">
      <div className="bg-card-bg border border-border rounded-lg p-8 max-w-lg text-center">
        <div className="flex justify-center mb-4">
          <AlertTriangle className="w-16 h-16 text-status-red" />
        </div>
        <h1 className="text-2xl font-bold text-text-primary mb-2">
          Something went wrong
        </h1>
        <p className="text-text-secondary mb-6">
          An error occurred while loading this page. This has been logged and
          we'll look into it.
        </p>
        {error.message && (
          <div className="bg-page-bg rounded-lg p-3 mb-6 text-left">
            <p className="text-sm text-text-muted font-mono break-all">
              {error.message}
            </p>
          </div>
        )}
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
          <Link
            href="/overview"
            className="inline-flex items-center gap-2 px-4 py-2 bg-card-bg border border-border text-text-primary rounded-lg hover:bg-sidebar-bg transition-colors"
          >
            <Home className="w-4 h-4" />
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
