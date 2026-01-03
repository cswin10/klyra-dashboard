"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html>
      <body className="bg-gray-900 min-h-screen">
        <div className="flex flex-col items-center justify-center min-h-screen p-8">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 max-w-lg text-center">
            <div className="flex justify-center mb-4">
              <AlertTriangle className="w-16 h-16 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">
              Application Error
            </h1>
            <p className="text-gray-400 mb-6">
              A critical error occurred. Please try refreshing the page.
            </p>
            {error.message && (
              <div className="bg-gray-900 rounded-lg p-3 mb-6 text-left">
                <p className="text-sm text-gray-500 font-mono break-all">
                  {error.message}
                </p>
              </div>
            )}
            <button
              onClick={reset}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
