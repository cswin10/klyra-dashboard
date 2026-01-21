"use client";

import React, { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { ThumbsUp, ThumbsDown, FileText, Shield, ShieldCheck, ShieldAlert, ShieldQuestion, Brain } from "lucide-react";
import { api, FeedbackType, RagConfidence } from "@/lib/api";

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
  confidence?: RagConfidence;
}

// Confidence level config
const CONFIDENCE_CONFIG = {
  high: {
    icon: ShieldCheck,
    label: "High confidence",
    color: "text-status-green",
    bgColor: "bg-status-green/10",
    borderColor: "border-status-green/20",
  },
  medium: {
    icon: Shield,
    label: "Medium confidence",
    color: "text-status-yellow",
    bgColor: "bg-status-yellow/10",
    borderColor: "border-status-yellow/20",
  },
  low: {
    icon: ShieldAlert,
    label: "Low confidence",
    color: "text-status-red",
    bgColor: "bg-status-red/10",
    borderColor: "border-status-red/20",
  },
  none: {
    icon: Brain,
    label: "General knowledge",
    color: "text-accent",
    bgColor: "bg-accent/10",
    borderColor: "border-accent/20",
  },
};

export function ChatMessage({ messageId, role, content, sources, isStreaming, confidence }: ChatMessageProps) {
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
    <div className={cn(
      "flex",
      isUser ? "justify-end" : "justify-start",
      isUser ? "message-user" : "message-assistant"
    )}>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-3 transition-all duration-200",
          isUser
            ? "bg-accent text-page-bg rounded-br-md hover:shadow-lg hover:shadow-accent/20"
            : "bg-card-bg border border-card-border text-text-primary rounded-bl-md hover:border-card-border/80"
        )}
      >
        <div className="text-sm whitespace-pre-wrap break-words">
          {isThinking ? (
            <span className="flex items-center gap-3 text-text-secondary">
              <span className="flex gap-1.5">
                <span className="typing-dot w-2 h-2 bg-accent rounded-full" />
                <span className="typing-dot w-2 h-2 bg-accent rounded-full" />
                <span className="typing-dot w-2 h-2 bg-accent rounded-full" />
              </span>
              <span className="text-sm">Klyra is thinking...</span>
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

        {/* Sources and Confidence - always show for assistant messages */}
        {!isUser && !isStreaming && content && (
          <div className="mt-3 pt-3 border-t border-card-border/30 space-y-2">
            {/* Confidence Indicator */}
            <div className="flex items-center gap-2">
              {(() => {
                // Check for general knowledge usage - either explicit flag, no sources, or no confidence data
                const isGeneralKnowledge =
                  !confidence ||
                  confidence.used_general_knowledge === true ||
                  confidence.confidence_level === "none" ||
                  (cleanSources.length === 0 && (!confidence.doc_count || confidence.doc_count === 0));

                const level = isGeneralKnowledge ? "none" : (confidence?.confidence_level || "none");
                const config = CONFIDENCE_CONFIG[level as keyof typeof CONFIDENCE_CONFIG] || CONFIDENCE_CONFIG.none;
                const Icon = config.icon;
                return (
                  <div className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium",
                    config.bgColor,
                    config.borderColor,
                    "border"
                  )}>
                    <Icon className={cn("h-4 w-4", config.color)} />
                    <span className={config.color}>{config.label}</span>
                  </div>
                );
              })()}
            </div>

            {/* Document Sources */}
            {cleanSources.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs text-text-muted">
                  <FileText className="h-3 w-3" />
                  <span className="font-medium">Sources ({cleanSources.length})</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {cleanSources.map((source, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-card-bg border border-card-border/50 text-text-secondary hover:border-accent/30 hover:text-text-primary transition-colors cursor-default"
                    >
                      <FileText className="h-3 w-3 text-accent/70" />
                      {source}
                    </span>
                  ))}
                </div>
              </div>
            )}
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
