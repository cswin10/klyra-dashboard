"use client";

import React, { useEffect } from "react";
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export type PopupType = "error" | "success" | "warning" | "info";

interface PopupProps {
  isOpen: boolean;
  onClose: () => void;
  type?: PopupType;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}

const POPUP_STYLES: Record<PopupType, { icon: React.ReactNode; iconBg: string; iconColor: string; buttonBg: string }> = {
  error: {
    icon: <AlertCircle className="h-6 w-6" />,
    iconBg: "bg-status-red/10",
    iconColor: "text-status-red",
    buttonBg: "bg-status-red hover:bg-status-red/90",
  },
  success: {
    icon: <CheckCircle className="h-6 w-6" />,
    iconBg: "bg-status-green/10",
    iconColor: "text-status-green",
    buttonBg: "bg-status-green hover:bg-status-green/90",
  },
  warning: {
    icon: <AlertTriangle className="h-6 w-6" />,
    iconBg: "bg-status-yellow/10",
    iconColor: "text-status-yellow",
    buttonBg: "bg-status-yellow hover:bg-status-yellow/90",
  },
  info: {
    icon: <Info className="h-6 w-6" />,
    iconBg: "bg-accent/10",
    iconColor: "text-accent",
    buttonBg: "bg-accent hover:bg-accent/90",
  },
};

export function Popup({
  isOpen,
  onClose,
  type = "info",
  title,
  message,
  actionLabel = "OK",
  onAction,
  secondaryLabel,
  onSecondary,
}: PopupProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const styles = POPUP_STYLES[type];

  const handleAction = () => {
    if (onAction) {
      onAction();
    }
    onClose();
  };

  const handleSecondary = () => {
    if (onSecondary) {
      onSecondary();
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Popup Content */}
      <div className="relative bg-card-bg rounded-card border border-card-border p-6 w-full max-w-sm shadow-xl mx-4 animate-in fade-in zoom-in-95 duration-200">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-icon-bg transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className={cn("p-3 rounded-full", styles.iconBg, styles.iconColor)}>
            {styles.icon}
          </div>
        </div>

        {/* Content */}
        <div className="text-center mb-6">
          <h3 className="text-lg font-semibold text-text-primary mb-2">{title}</h3>
          <p className="text-text-secondary text-sm">{message}</p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <button
            onClick={handleAction}
            className={cn(
              "w-full px-4 py-2.5 rounded-lg text-white font-medium transition-colors",
              styles.buttonBg
            )}
          >
            {actionLabel}
          </button>
          {secondaryLabel && (
            <button
              onClick={handleSecondary}
              className="w-full px-4 py-2.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-card-bg transition-colors"
            >
              {secondaryLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
