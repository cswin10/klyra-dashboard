"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
  variant?: "text" | "circular" | "rectangular" | "rounded";
  width?: string | number;
  height?: string | number;
  animate?: boolean;
}

export function Skeleton({
  className,
  variant = "text",
  width,
  height,
  animate = true,
}: SkeletonProps) {
  const baseClasses = cn(
    "bg-gradient-to-r from-card-border/50 via-card-border to-card-border/50 bg-[length:200%_100%]",
    animate && "animate-shimmer",
    variant === "text" && "h-4 rounded",
    variant === "circular" && "rounded-full",
    variant === "rectangular" && "rounded-none",
    variant === "rounded" && "rounded-lg",
    className
  );

  const style: React.CSSProperties = {
    width: width,
    height: height,
  };

  return <div className={baseClasses} style={style} />;
}

// Pre-built skeleton patterns
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn("h-4", i === lines - 1 && "w-3/4")}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("bg-card-bg rounded-card border border-card-border p-6 space-y-4", className)}>
      <div className="flex items-center gap-4">
        <Skeleton variant="circular" width={48} height={48} />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <SkeletonText lines={3} />
    </div>
  );
}

export function SkeletonMessage({ isUser = false }: { isUser?: boolean }) {
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-3",
          isUser
            ? "bg-accent/20 rounded-br-md"
            : "bg-card-bg border border-card-border rounded-bl-md"
        )}
      >
        <div className="space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-36" />
          {!isUser && <Skeleton className="h-4 w-24" />}
        </div>
      </div>
    </div>
  );
}

export function SkeletonChatList({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2 p-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 p-3 rounded-lg"
        >
          <Skeleton variant="circular" width={16} height={16} />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-2.5 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonStatCard() {
  return (
    <div className="bg-card-bg rounded-card border border-card-border p-6">
      <div className="flex items-start justify-between mb-4">
        <Skeleton variant="circular" width={40} height={40} />
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="h-8 w-20 mb-2" />
      <Skeleton className="h-4 w-24" />
    </div>
  );
}
