"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  sources?: string[] | null;
  isStreaming?: boolean;
}

export function ChatMessage({ role, content, sources, isStreaming }: ChatMessageProps) {
  const isUser = role === "user";
  const isThinking = isStreaming && !content;

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-3",
          isUser
            ? "bg-accent text-page-bg rounded-br-md"
            : "bg-card-bg border border-card-border text-text-primary rounded-bl-md"
        )}
      >
        <div className="text-sm whitespace-pre-wrap break-words">
          {isThinking ? (
            <span className="flex items-center gap-2 text-text-secondary italic">
              <span className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </span>
              Klyra is thinking...
            </span>
          ) : (
            <>
              {content}
              {isStreaming && (
                <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse" />
              )}
            </>
          )}
        </div>

        {sources && sources.length > 0 && (
          <div className="mt-2 pt-2 border-t border-card-border/50">
            <p className="text-xs text-text-muted">
              Sources: {sources.join(", ")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
