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
    <div className="glass-card glass-card-hover rounded-card p-card-padding relative overflow-hidden group">
      {/* Shimmer effect */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
      </div>

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <span className="text-stat-label text-text-secondary">{label}</span>
          <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 group-hover:border-white/10 group-hover:bg-white/10 transition-all duration-300">
            <Icon className="h-5 w-5 text-silver group-hover:drop-shadow-[0_0_8px_rgba(192,192,192,0.5)] transition-all duration-300" />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-stat-number text-white font-light tracking-tight">{formattedValue}</p>
          {hasChange && (
            <div className="flex items-center gap-1.5">
              {isPositive ? (
                <TrendingUp className="h-3.5 w-3.5 text-status-green drop-shadow-[0_0_4px_rgba(0,255,136,0.5)]" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-status-red drop-shadow-[0_0_4px_rgba(255,68,102,0.5)]" />
              )}
              <span
                className={cn(
                  "text-stat-change",
                  isPositive ? "text-status-green" : "text-status-red"
                )}
              >
                {changeText} {changeLabel}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Decorative corner accent */}
      <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-navy/20 to-transparent rounded-bl-full opacity-50" />
    </div>
  );
}
