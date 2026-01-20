import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat().format(num);
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const then = new Date(date);
  const diff = now.getTime() - then.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "Just now";
}

export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts = [];
  if (days > 0) parts.push(`${days} day${days !== 1 ? "s" : ""}`);
  if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? "s" : ""}`);
  if (minutes > 0 && days === 0) parts.push(`${minutes} min${minutes !== 1 ? "s" : ""}`);

  return parts.join(", ") || "Less than a minute";
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + "...";
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export interface DocumentFreshness {
  level: "fresh" | "recent" | "aging" | "stale";
  daysOld: number;
  label: string;
  color: string;
  bgColor: string;
}

export function getDocumentFreshness(uploadedAt: string): DocumentFreshness {
  const now = new Date();
  const uploaded = new Date(uploadedAt);
  const daysOld = Math.floor((now.getTime() - uploaded.getTime()) / (1000 * 60 * 60 * 24));

  if (daysOld <= 7) {
    return { level: "fresh", daysOld, label: "Fresh", color: "text-status-green", bgColor: "bg-status-green" };
  } else if (daysOld <= 30) {
    return { level: "recent", daysOld, label: "Recent", color: "text-accent", bgColor: "bg-accent" };
  } else if (daysOld <= 90) {
    return { level: "aging", daysOld, label: "Aging", color: "text-status-yellow", bgColor: "bg-status-yellow" };
  } else {
    return { level: "stale", daysOld, label: "Needs Review", color: "text-status-red", bgColor: "bg-status-red" };
  }
}
