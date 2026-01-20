"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  isLoading?: boolean;
}

export function DataTable<T extends object>({
  columns,
  data,
  onRowClick,
  emptyMessage = "No data available",
  isLoading = false,
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="bg-card-bg rounded-card border border-card-border overflow-hidden">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card-bg rounded-card border border-card-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-card-border">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    "px-6 py-4 text-left text-sm font-medium text-text-secondary",
                    column.className
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-6 py-12 text-center text-text-secondary"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  onClick={() => onRowClick?.(row)}
                  className={cn(
                    "border-b border-card-border last:border-0 transition-colors",
                    onRowClick && "cursor-pointer hover:bg-icon-bg/50"
                  )}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        "px-6 py-4 text-sm text-text-primary",
                        column.className
                      )}
                    >
                      {column.render
                        ? column.render(row)
                        : ((row as Record<string, unknown>)[column.key] as React.ReactNode)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
