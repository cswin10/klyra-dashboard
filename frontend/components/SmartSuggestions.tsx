"use client";

import React, { useMemo } from "react";
import {
  Lightbulb,
  FileSearch,
  RefreshCw,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SmartSuggestionsProps {
  lastAssistantMessage?: string;
  sources?: string[] | null;
  onSuggestionClick: (suggestion: string) => void;
  disabled?: boolean;
}

interface Suggestion {
  id: string;
  label: string;
  prompt: string;
  icon: React.ReactNode;
}

export function SmartSuggestions({
  lastAssistantMessage,
  sources,
  onSuggestionClick,
  disabled = false,
}: SmartSuggestionsProps) {
  // Generate contextual suggestions based on the last response
  const suggestions: Suggestion[] = useMemo(() => {
    const items: Suggestion[] = [];

    // If there was a response with sources, offer to dig deeper
    if (sources && sources.length > 0) {
      items.push({
        id: "elaborate",
        label: "Tell me more",
        prompt: "Can you elaborate on that with more details?",
        icon: <Sparkles className="h-3.5 w-3.5" />,
      });

      // Suggest exploring specific sources
      if (sources.length === 1) {
        items.push({
          id: "source-detail",
          label: `More from ${sources[0]}`,
          prompt: `What else does ${sources[0]} say about this topic?`,
          icon: <FileSearch className="h-3.5 w-3.5" />,
        });
      } else {
        items.push({
          id: "compare",
          label: "Compare sources",
          prompt: "How do the different sources compare on this topic?",
          icon: <FileSearch className="h-3.5 w-3.5" />,
        });
      }
    }

    // Always offer these contextual actions
    if (lastAssistantMessage && lastAssistantMessage.length > 100) {
      items.push({
        id: "simplify",
        label: "Simplify this",
        prompt: "Can you explain that in simpler terms?",
        icon: <Lightbulb className="h-3.5 w-3.5" />,
      });
    }

    // If the response mentions processes or steps
    if (lastAssistantMessage &&
        (lastAssistantMessage.toLowerCase().includes("step") ||
         lastAssistantMessage.toLowerCase().includes("process") ||
         lastAssistantMessage.toLowerCase().includes("procedure"))) {
      items.push({
        id: "example",
        label: "Show example",
        prompt: "Can you provide a specific example of how this works?",
        icon: <ArrowRight className="h-3.5 w-3.5" />,
      });
    }

    // If response is short, suggest expanding
    if (lastAssistantMessage && lastAssistantMessage.length < 200) {
      items.push({
        id: "expand",
        label: "Expand on this",
        prompt: "Can you provide more detail about this?",
        icon: <Sparkles className="h-3.5 w-3.5" />,
      });
    }

    // Always offer rephrase option
    if (lastAssistantMessage) {
      items.push({
        id: "rephrase",
        label: "Rephrase",
        prompt: "Can you rephrase that in a different way?",
        icon: <RefreshCw className="h-3.5 w-3.5" />,
      });
    }

    // Limit to 4 suggestions max
    return items.slice(0, 4);
  }, [lastAssistantMessage, sources]);

  if (suggestions.length === 0 || disabled) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-card-border/30 animate-fade-in-up">
      <span className="text-xs text-text-muted flex items-center gap-1.5 mr-2">
        <Lightbulb className="h-3.5 w-3.5 text-accent/70" />
        <span className="font-medium">Continue with:</span>
      </span>
      {suggestions.map((suggestion, index) => (
        <button
          key={suggestion.id}
          onClick={() => onSuggestionClick(suggestion.prompt)}
          disabled={disabled}
          style={{ animationDelay: `${index * 0.1}s` }}
          className={cn(
            "inline-flex items-center gap-2 px-3.5 py-2 text-xs rounded-full animate-fade-in",
            "bg-card-bg/80 border border-card-border/50 backdrop-blur-sm",
            "text-text-secondary hover:text-text-primary",
            "hover:border-accent/40 hover:bg-accent/5 hover:shadow-lg hover:shadow-accent/5",
            "transform hover:scale-[1.02] active:scale-[0.98]",
            "transition-all duration-200",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <span className="text-accent transition-transform group-hover:scale-110">{suggestion.icon}</span>
          <span className="font-medium">{suggestion.label}</span>
        </button>
      ))}
    </div>
  );
}
