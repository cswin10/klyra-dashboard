"use client";

import React, { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
}

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = "Ask Klyra anything...",
  value,
  onChange,
}: ChatInputProps) {
  const [internalMessage, setInternalMessage] = useState("");

  // Support both controlled and uncontrolled modes
  const message = value !== undefined ? value : internalMessage;
  const setMessage = onChange || setInternalMessage;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [message]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSend(message.trim());
      // Clear both internal and external state
      setInternalMessage("");
      if (onChange) onChange("");
    }
  };

  // Focus the textarea when value changes externally (e.g., template selected)
  useEffect(() => {
    if (value && textareaRef.current) {
      textareaRef.current.focus();
      // Move cursor to end
      textareaRef.current.selectionStart = textareaRef.current.value.length;
    }
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <div className="flex items-end gap-2 p-3 bg-card-bg border border-card-border rounded-xl">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className={cn(
            "flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted resize-none outline-none min-h-[24px] max-h-[150px]",
            disabled && "opacity-50"
          )}
        />
        <button
          type="submit"
          disabled={disabled || !message.trim()}
          className={cn(
            "flex-shrink-0 p-2 rounded-lg transition-all duration-fast",
            message.trim() && !disabled
              ? "bg-accent text-page-bg hover:bg-accent-hover"
              : "bg-icon-bg text-text-muted"
          )}
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}
