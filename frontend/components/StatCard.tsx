"use client";

import React from "react";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: number | string;
  change?: number | string;
  changeLabel?: string;
  icon: LucideIcon;
  isPositive?: boolean;
}

export function StatCard({
  label,
  value,
  change,
  changeLabel,
  icon: Icon,
  isPositive = true,
}: StatCardProps) {
  const formattedValue = typeof value === "number" ? formatNumber(value) : value;
  const hasChange = change !== undefined && change !== null;

  let changeText = "";
  if (hasChange) {
    if (typeof change === "number") {
      const prefix = change > 0 ? "+" : "";
      changeText = `${prefix}${change}%`;
    } else {
      changeText = change;
    }
  }

  return (
    <div className="bg-card-bg rounded-card border border-card-border p-card-padding shadow-card">
      <div className="flex items-start justify-between mb-4">
        <span className="text-stat-label text-text-secondary">{label}</span>
        <div className="p-2 rounded-lg bg-icon-bg">
          <Icon className="h-5 w-5 text-text-secondary" />
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-stat-number text-text-primary">{formattedValue}</p>
        {hasChange && (
          <div className="flex items-center gap-1">
            {isPositive ? (
              <TrendingUp className="h-3 w-3 text-accent" />
            ) : (
              <TrendingDown className="h-3 w-3 text-status-red" />
            )}
            <span
              className={cn(
                "text-stat-change",
                isPositive ? "text-accent" : "text-status-red"
              )}
            >
              {changeText} {changeLabel}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
