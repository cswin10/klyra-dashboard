"use client";

import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef } from "react";
import { Send, CornerDownLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
}

export interface ChatInputRef {
  focus: () => void;
}

export const ChatInput = forwardRef<ChatInputRef, ChatInputProps>(function ChatInput({
  onSend,
  disabled = false,
  placeholder = "Ask Klyra anything...",
  value,
  onChange,
}, ref) {
  const [internalMessage, setInternalMessage] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  // Support both controlled and uncontrolled modes
  const message = value !== undefined ? value : internalMessage;
  const setMessage = onChange || setInternalMessage;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Expose focus method to parent
  useImperativeHandle(ref, () => ({
    focus: () => {
      textareaRef.current?.focus();
    }
  }));

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
      // Re-focus after a short delay to ensure the message is sent
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 10);
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

  // Re-focus when disabled changes from true to false (after response completes)
  const prevDisabledRef = useRef(disabled);
  useEffect(() => {
    if (prevDisabledRef.current && !disabled) {
      // Was disabled, now enabled - refocus
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    }
    prevDisabledRef.current = disabled;
  }, [disabled]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <div className={cn(
        "flex items-end gap-2 p-3 bg-card-bg border rounded-xl transition-all duration-200",
        isFocused
          ? "border-accent/50 shadow-lg shadow-accent/5"
          : "border-card-border",
        disabled && "opacity-60"
      )}>
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className={cn(
            "flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted resize-none outline-none min-h-[24px] max-h-[150px]",
            disabled && "cursor-not-allowed"
          )}
        />
        <div className="flex items-center gap-2">
          {/* Keyboard shortcut hints */}
          {isFocused && message.trim() && (
            <div className="hidden sm:flex items-center gap-1 text-xs text-text-muted animate-fade-in">
              <kbd className="px-1.5 py-0.5 bg-icon-bg rounded text-[10px] font-mono">↵</kbd>
              <span>send</span>
              <span className="mx-1 text-card-border">·</span>
              <kbd className="px-1.5 py-0.5 bg-icon-bg rounded text-[10px] font-mono">⇧↵</kbd>
              <span>new line</span>
            </div>
          )}
          <button
            type="submit"
            disabled={disabled || !message.trim()}
            className={cn(
              "flex-shrink-0 p-2.5 rounded-lg transition-all duration-200 btn-press",
              message.trim() && !disabled
                ? "bg-accent text-page-bg hover:bg-accent-hover hover:shadow-md hover:shadow-accent/20"
                : "bg-icon-bg text-text-muted"
            )}
          >
            {message.trim() && !disabled ? (
              <CornerDownLeft className="h-4 w-4" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </form>
  );
});
