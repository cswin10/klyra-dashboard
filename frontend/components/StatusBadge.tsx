"use client";

import React from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "success" | "warning" | "error" | "default";

interface StatusBadgeProps {
  status: string;
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, string> = {
  success: "bg-status-green/10 text-status-green border-status-green/20",
  warning: "bg-status-yellow/10 text-status-yellow border-status-yellow/20",
  error: "bg-status-red/10 text-status-red border-status-red/20",
  default: "bg-text-secondary/10 text-text-secondary border-text-secondary/20",
};

const statusVariantMap: Record<string, BadgeVariant> = {
  ready: "success",
  processing: "warning",
  error: "error",
  admin: "success",
  user: "default",
};

export function StatusBadge({ status, variant }: StatusBadgeProps) {
  const resolvedVariant = variant || statusVariantMap[status.toLowerCase()] || "default";

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize",
        variantStyles[resolvedVariant]
      )}
    >
      {status}
    </span>
  );
}
