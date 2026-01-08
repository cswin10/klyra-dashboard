"use client";

import React, { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { ThumbsUp, ThumbsDown, FileText } from "lucide-react";
import { api, FeedbackType } from "@/lib/api";

// Strip markdown formatting for clean display
function stripMarkdown(text: string): string {
  return text
    // Remove bold/italic
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    // Remove headers but keep as separate paragraph
    .replace(/^#{1,6}\s+(.+)$/gm, "\n$1\n")
    // Convert bullet points to separate lines with spacing
    .replace(/^\s*[-*+]\s+(.+)$/gm, "$1\n")
    // Convert numbered lists to separate lines with spacing
    .replace(/^\s*\d+\.\s+(.+)$/gm, "$1\n")
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`(.+?)`/g, "$1")
    // Clean up excessive whitespace but keep paragraph breaks
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

interface ChatMessageProps {
  messageId?: string;
  role: "user" | "assistant";
  content: string;
  sources?: string[] | null;
  isStreaming?: boolean;
}

export function ChatMessage({ messageId, role, content, sources, isStreaming }: ChatMessageProps) {
  const isUser = role === "user";
  const isThinking = isStreaming && !content;
  const [feedback, setFeedback] = useState<FeedbackType | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Strip markdown from assistant messages for clean display
  const displayContent = useMemo(() => {
    if (isUser) return content;
    return stripMarkdown(content);
  }, [content, isUser]);

  // Deduplicate and clean sources
  const cleanSources = useMemo(() => {
    if (!sources || sources.length === 0) return [];
    // Remove duplicates (case-insensitive)
    const seen = new Set<string>();
    return sources.filter((source) => {
      const normalized = source.toLowerCase().trim();
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
  }, [sources]);

  // Load existing feedback when message ID is available
  useEffect(() => {
    if (messageId && !isUser && !isStreaming) {
      api.getMessageFeedback(messageId).then((f) => {
        if (f) setFeedback(f.feedback_type);
      });
    }
  }, [messageId, isUser, isStreaming]);

  const handleFeedback = async (type: FeedbackType) => {
    if (!messageId || isSubmitting) return;

    setIsSubmitting(true);
    try {
      if (feedback === type) {
        // Toggle off
        await api.deleteFeedback(messageId);
        setFeedback(null);
      } else {
        // Submit new feedback
        await api.submitFeedback(messageId, type);
        setFeedback(type);
      }
    } catch (error) {
      console.error("Failed to submit feedback:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

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
              {displayContent}
              {isStreaming && (
                <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse" />
              )}
            </>
          )}
        </div>

        {cleanSources.length > 0 && (
          <div className="mt-2 pt-2 border-t border-card-border/50">
            <div className="flex flex-wrap gap-1.5 items-center">
              <FileText className="h-3 w-3 text-text-muted flex-shrink-0" />
              {cleanSources.map((source, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-accent/10 text-accent border border-accent/20"
                >
                  {source}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Feedback buttons for assistant messages */}
        {!isUser && messageId && !isStreaming && content && (
          <div className="mt-2 pt-2 border-t border-card-border/50 flex items-center gap-2">
            <button
              onClick={() => handleFeedback("positive")}
              disabled={isSubmitting}
              className={cn(
                "p-1.5 rounded-md transition-colors",
                feedback === "positive"
                  ? "bg-green-500/20 text-green-500"
                  : "text-text-muted hover:text-green-500 hover:bg-green-500/10"
              )}
              title="Helpful response"
            >
              <ThumbsUp className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleFeedback("negative")}
              disabled={isSubmitting}
              className={cn(
                "p-1.5 rounded-md transition-colors",
                feedback === "negative"
                  ? "bg-red-500/20 text-red-500"
                  : "text-text-muted hover:text-red-500 hover:bg-red-500/10"
              )}
              title="Unhelpful response"
            >
              <ThumbsDown className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
