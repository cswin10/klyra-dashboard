"use client";

import { useEffect, useCallback, useRef } from "react";

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  alt?: boolean;
  shift?: boolean;
  action: () => void;
  description?: string;
  enabled?: boolean;
}

interface UseKeyboardShortcutsOptions {
  shortcuts: KeyboardShortcut[];
  enabled?: boolean;
}

/**
 * A hook for handling keyboard shortcuts across the application.
 *
 * @example
 * ```tsx
 * useKeyboardShortcuts({
 *   shortcuts: [
 *     { key: "k", meta: true, action: openCommandPalette, description: "Open command palette" },
 *     { key: "n", meta: true, action: createNewChat, description: "New chat" },
 *     { key: "Escape", action: closeModal, description: "Close modal" },
 *   ],
 * });
 * ```
 */
export function useKeyboardShortcuts({
  shortcuts,
  enabled = true,
}: UseKeyboardShortcutsOptions) {
  // Use ref to avoid recreating the handler on every render
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Don't trigger shortcuts when typing in inputs/textareas
      const target = event.target as HTMLElement;
      const isTyping =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      for (const shortcut of shortcutsRef.current) {
        // Skip disabled shortcuts
        if (shortcut.enabled === false) continue;

        // Check modifiers
        const ctrlMatch = shortcut.ctrl ? event.ctrlKey : !event.ctrlKey;
        const metaMatch = shortcut.meta ? event.metaKey : !event.metaKey;
        const altMatch = shortcut.alt ? event.altKey : !event.altKey;
        const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;

        // For shortcuts with modifiers, allow them even when typing
        // For shortcuts without modifiers, don't trigger when typing
        const hasModifier = shortcut.ctrl || shortcut.meta || shortcut.alt;
        if (!hasModifier && isTyping) continue;

        // Check if this shortcut matches
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();

        if (keyMatch && ctrlMatch && metaMatch && altMatch && shiftMatch) {
          event.preventDefault();
          event.stopPropagation();
          shortcut.action();
          return;
        }
      }
    },
    [enabled]
  );

  useEffect(() => {
    if (!enabled) return;

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown, enabled]);
}

/**
 * Common keyboard shortcuts configuration for the app
 */
export const COMMON_SHORTCUTS = {
  COMMAND_PALETTE: { key: "k", meta: true, description: "Open command palette" },
  NEW_CHAT: { key: "n", meta: true, shift: true, description: "New chat" },
  SEARCH: { key: "/", description: "Focus search" },
  ESCAPE: { key: "Escape", description: "Close/cancel" },
  SUBMIT: { key: "Enter", meta: true, description: "Submit" },
} as const;

/**
 * Get platform-specific modifier key label
 */
export function getModifierKey(): "⌘" | "Ctrl" {
  if (typeof window === "undefined") return "⌘";
  return navigator.platform.toLowerCase().includes("mac") ? "⌘" : "Ctrl";
}

/**
 * Format shortcut for display
 */
export function formatShortcut(shortcut: Omit<KeyboardShortcut, "action">): string {
  const parts: string[] = [];
  const modKey = getModifierKey();

  if (shortcut.ctrl || shortcut.meta) parts.push(modKey);
  if (shortcut.alt) parts.push("Alt");
  if (shortcut.shift) parts.push("Shift");
  parts.push(shortcut.key.toUpperCase());

  return parts.join("+");
}
