"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Sidebar, ErrorBoundary, CommandPalette } from "@/components";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { useKeyboardShortcuts } from "@/lib/useKeyboardShortcuts";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    shortcuts: [
      {
        key: "k",
        meta: true,
        action: () => setIsCommandPaletteOpen((prev) => !prev),
        description: "Open command palette",
      },
      {
        key: "k",
        ctrl: true,
        action: () => setIsCommandPaletteOpen((prev) => !prev),
        description: "Open command palette (Windows)",
      },
      {
        key: "Escape",
        action: () => {
          if (isCommandPaletteOpen) {
            setIsCommandPaletteOpen(false);
          } else if (isMobileMenuOpen) {
            setIsMobileMenuOpen(false);
          }
        },
        description: "Close modal/menu",
      },
      {
        key: "g",
        meta: true,
        action: () => router.push("/chat"),
        description: "Go to chat",
      },
    ],
    enabled: isAuthenticated,
  });

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-page-bg">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-page-bg">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-sidebar-bg/95 backdrop-blur-lg border-b border-card-border px-4 py-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 -ml-2 text-text-secondary hover:text-text-primary transition-colors"
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6" />
          </button>
          <span className="text-lg font-semibold text-text-primary">Klyra</span>
          <div className="w-10" /> {/* Spacer for alignment */}
        </div>
      </header>

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - hidden on mobile, shown on lg+ */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-in-out lg:translate-x-0",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <Sidebar onClose={() => setIsMobileMenuOpen(false)} />
      </div>

      {/* Main Content */}
      <main className={cn(
        "min-h-screen transition-all duration-300",
        "pt-16 lg:pt-0", // Account for mobile header
        "lg:ml-sidebar",
        "p-4 sm:p-6 lg:p-page-padding"
      )}>
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>

      {/* Command Palette - Cmd+K / Ctrl+K */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />
    </div>
  );
}
