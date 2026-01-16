"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  MessageSquare,
  FileText,
  Settings,
  LayoutGrid,
  Users,
  Server,
  List,
  Plus,
  LogOut,
  BarChart3,
  Command,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  keywords?: string[];
  category: "navigation" | "action" | "settings";
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const { logout, isAdmin } = useAuth();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const commands: CommandItem[] = useMemo(() => {
    const items: CommandItem[] = [
      // Navigation
      {
        id: "overview",
        label: "Go to Overview",
        description: "View dashboard overview",
        icon: <LayoutGrid className="h-4 w-4" />,
        action: () => router.push("/overview"),
        keywords: ["home", "dashboard", "main"],
        category: "navigation",
      },
      {
        id: "chat",
        label: "Go to Chat",
        description: "Start or continue a conversation",
        icon: <MessageSquare className="h-4 w-4" />,
        action: () => router.push("/chat"),
        keywords: ["conversation", "ask", "message"],
        category: "navigation",
      },
      {
        id: "documents",
        label: "Go to Documents",
        description: "Manage knowledge base",
        icon: <FileText className="h-4 w-4" />,
        action: () => router.push("/documents"),
        keywords: ["files", "upload", "knowledge"],
        category: "navigation",
      },
      {
        id: "analytics",
        label: "Go to Analytics",
        description: "View usage statistics",
        icon: <BarChart3 className="h-4 w-4" />,
        action: () => router.push("/analytics"),
        keywords: ["stats", "usage", "metrics"],
        category: "navigation",
      },
      {
        id: "settings",
        label: "Go to Settings",
        description: "Manage your account",
        icon: <Settings className="h-4 w-4" />,
        action: () => router.push("/settings"),
        keywords: ["profile", "account", "preferences"],
        category: "navigation",
      },
      // Actions
      {
        id: "new-chat",
        label: "New Chat",
        description: "Start a new conversation",
        icon: <Plus className="h-4 w-4" />,
        action: () => router.push("/chat"),
        keywords: ["create", "start"],
        category: "action",
      },
      {
        id: "logout",
        label: "Sign Out",
        description: "Log out of your account",
        icon: <LogOut className="h-4 w-4" />,
        action: () => {
          logout();
          router.push("/login");
        },
        keywords: ["exit", "logout"],
        category: "action",
      },
    ];

    // Admin-only commands
    if (isAdmin) {
      items.push(
        {
          id: "users",
          label: "Go to Users",
          description: "Manage user accounts",
          icon: <Users className="h-4 w-4" />,
          action: () => router.push("/users"),
          keywords: ["accounts", "team", "members"],
          category: "navigation",
        },
        {
          id: "system",
          label: "Go to System",
          description: "View system status",
          icon: <Server className="h-4 w-4" />,
          action: () => router.push("/system"),
          keywords: ["health", "status", "server"],
          category: "navigation",
        },
        {
          id: "logs",
          label: "Go to Logs",
          description: "View activity logs",
          icon: <List className="h-4 w-4" />,
          action: () => router.push("/logs"),
          keywords: ["activity", "history", "audit"],
          category: "navigation",
        }
      );
    }

    return items;
  }, [router, logout, isAdmin]);

  // Filter commands based on search query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;

    const lowerQuery = query.toLowerCase();
    return commands.filter((cmd) => {
      const matchLabel = cmd.label.toLowerCase().includes(lowerQuery);
      const matchDescription = cmd.description?.toLowerCase().includes(lowerQuery);
      const matchKeywords = cmd.keywords?.some((k) => k.toLowerCase().includes(lowerQuery));
      return matchLabel || matchDescription || matchKeywords;
    });
  }, [commands, query]);

  // Reset selection when filtered results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredCommands]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((i) => (i + 1) % filteredCommands.length);
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((i) => (i - 1 + filteredCommands.length) % filteredCommands.length);
          break;
        case "Enter":
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action();
            onClose();
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [isOpen, filteredCommands, selectedIndex, onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Palette */}
      <div className="relative bg-card-bg border border-card-border rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-card-border">
          <Search className="h-5 w-5 text-text-muted" />
          <input
            type="text"
            placeholder="Search commands..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-text-primary placeholder:text-text-muted outline-none"
            autoFocus
          />
          <kbd className="hidden sm:flex items-center gap-1 px-2 py-1 bg-icon-bg rounded text-xs text-text-muted">
            <Command className="h-3 w-3" />K
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto p-2">
          {filteredCommands.length === 0 ? (
            <div className="py-8 text-center text-text-muted text-sm">
              No commands found
            </div>
          ) : (
            <>
              {/* Group by category */}
              {["navigation", "action", "settings"].map((category) => {
                const categoryItems = filteredCommands.filter((c) => c.category === category);
                if (categoryItems.length === 0) return null;

                return (
                  <div key={category} className="mb-2">
                    <div className="px-3 py-1.5 text-xs font-medium text-text-muted uppercase tracking-wider">
                      {category}
                    </div>
                    {categoryItems.map((cmd) => {
                      const index = filteredCommands.indexOf(cmd);
                      return (
                        <button
                          key={cmd.id}
                          onClick={() => {
                            cmd.action();
                            onClose();
                          }}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                            index === selectedIndex
                              ? "bg-accent/10 text-text-primary"
                              : "text-text-secondary hover:bg-card-bg hover:text-text-primary"
                          )}
                        >
                          <span className={cn(
                            "flex-shrink-0",
                            index === selectedIndex ? "text-accent" : ""
                          )}>
                            {cmd.icon}
                          </span>
                          <div className="flex-1 text-left">
                            <div className="text-sm font-medium">{cmd.label}</div>
                            {cmd.description && (
                              <div className="text-xs text-text-muted">{cmd.description}</div>
                            )}
                          </div>
                          {index === selectedIndex && (
                            <span className="text-xs text-text-muted">Enter ↵</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-card-border bg-card-bg/50 flex items-center justify-between text-xs text-text-muted">
          <span>↑↓ Navigate</span>
          <span>↵ Select</span>
          <span>Esc Close</span>
        </div>
      </div>
    </div>
  );
}
