"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Cpu, HardDrive, Clock, RefreshCw, Server } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api, SystemStats } from "@/lib/api";
import { formatBytes, formatUptime } from "@/lib/utils";

export default function SystemPage() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [stats, setStats] = useState<SystemStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRestarting, setIsRestarting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.push("/overview");
    }
  }, [isAdmin, authLoading, router]);

  useEffect(() => {
    if (isAdmin) {
      fetchStats();
    }
  }, [isAdmin]);

  const fetchStats = async () => {
    try {
      const systemStats = await api.getSystemStats();
      setStats(systemStats);
    } catch (err) {
      console.error("Failed to fetch system stats:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestartOllama = async () => {
    if (!confirm("Are you sure you want to restart Ollama?")) return;

    setIsRestarting(true);
    setMessage(null);

    try {
      await api.restartOllama();
      setMessage({ type: "success", text: "Ollama restart initiated successfully" });
      // Refresh stats after a delay
      setTimeout(fetchStats, 5000);
    } catch (err) {
      setMessage({ type: "error", text: "Failed to restart Ollama" });
    } finally {
      setIsRestarting(false);
    }
  };

  if (authLoading || (!isAdmin && !authLoading)) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  const gpuUsagePercent = stats?.gpu_memory_total
    ? ((stats.gpu_memory_used || 0) / stats.gpu_memory_total) * 100
    : 0;

  const storageUsagePercent = stats?.storage_total
    ? (stats.storage_used / stats.storage_total) * 100
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-page-title text-text-primary">System</h1>
        <button
          onClick={fetchStats}
          className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-card-bg transition-colors"
        >
          <RefreshCw className="h-5 w-5" />
        </button>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`p-4 rounded-card border ${
            message.type === "success"
              ? "bg-status-green/10 border-status-green/20 text-status-green"
              : "bg-status-red/10 border-status-red/20 text-status-red"
          }`}
        >
          {message.text}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Model Card */}
            <div className="bg-card-bg rounded-card border border-card-border p-card-padding">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-icon-bg">
                  <Server className="h-5 w-5 text-text-secondary" />
                </div>
                <span className="text-sm text-text-secondary">Current Model</span>
              </div>
              <p className="text-2xl font-bold text-text-primary">
                {stats?.current_model || "Unknown"}
              </p>
            </div>

            {/* GPU Card */}
            <div className="bg-card-bg rounded-card border border-card-border p-card-padding">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-icon-bg">
                  <Cpu className="h-5 w-5 text-text-secondary" />
                </div>
                <span className="text-sm text-text-secondary">GPU</span>
              </div>
              <p className="text-2xl font-bold text-text-primary mb-2">
                {stats?.gpu_name || "N/A"}
              </p>
              {stats?.gpu_memory_total && (
                <>
                  <div className="flex justify-between text-sm text-text-secondary mb-2">
                    <span>VRAM Usage</span>
                    <span>
                      {stats.gpu_memory_used} MB / {stats.gpu_memory_total} MB
                    </span>
                  </div>
                  <div className="h-2 bg-icon-bg rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full transition-all"
                      style={{ width: `${gpuUsagePercent}%` }}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Storage Card */}
            <div className="bg-card-bg rounded-card border border-card-border p-card-padding">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-icon-bg">
                  <HardDrive className="h-5 w-5 text-text-secondary" />
                </div>
                <span className="text-sm text-text-secondary">Storage</span>
              </div>
              <p className="text-2xl font-bold text-text-primary mb-2">
                {formatBytes(stats?.storage_used || 0)} / {formatBytes(stats?.storage_total || 0)}
              </p>
              <div className="h-2 bg-icon-bg rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all"
                  style={{ width: `${storageUsagePercent}%` }}
                />
              </div>
            </div>

            {/* Uptime Card */}
            <div className="bg-card-bg rounded-card border border-card-border p-card-padding">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-icon-bg">
                  <Clock className="h-5 w-5 text-text-secondary" />
                </div>
                <span className="text-sm text-text-secondary">System Uptime</span>
              </div>
              <p className="text-2xl font-bold text-text-primary">
                {formatUptime(stats?.uptime_seconds || 0)}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-card-bg rounded-card border border-card-border p-card-padding">
            <h3 className="text-lg font-semibold text-text-primary mb-4">Actions</h3>
            <button
              onClick={handleRestartOllama}
              disabled={isRestarting}
              className="flex items-center gap-2 px-4 py-2.5 border border-status-yellow text-status-yellow rounded-lg hover:bg-status-yellow/10 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isRestarting ? "animate-spin" : ""}`} />
              {isRestarting ? "Restarting..." : "Restart Ollama"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
