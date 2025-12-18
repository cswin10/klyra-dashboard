"use client";

import React, { useEffect, useState } from "react";
import { MessageSquare, BarChart3, Users, FileText, CheckCircle } from "lucide-react";
import { StatCard, QueryChart } from "@/components";
import { api, DashboardStats } from "@/lib/api";
import { Search } from "lucide-react";

export default function OverviewPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [systemStatus, setSystemStatus] = useState<string>("checking");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsData, healthData] = await Promise.all([
          api.getDashboardStats(),
          api.getSystemHealth(),
        ]);
        setStats(statsData);
        setSystemStatus(healthData.status);
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-page-title text-text-primary">Overview</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <input
            type="text"
            placeholder="Search..."
            className="pl-10 pr-4 py-2 bg-input-bg border border-input-border rounded-lg text-sm text-text-primary placeholder:text-text-muted w-64 focus:border-accent transition-colors"
          />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          label="Queries Today"
          value={stats?.queries_today || 0}
          change={stats?.queries_today_change || 0}
          changeLabel="from yesterday"
          icon={MessageSquare}
          isPositive={(stats?.queries_today_change || 0) >= 0}
        />
        <StatCard
          label="Queries This Week"
          value={stats?.queries_this_week || 0}
          change={stats?.queries_this_week_change || 0}
          changeLabel="from last week"
          icon={BarChart3}
          isPositive={(stats?.queries_this_week_change || 0) >= 0}
        />
        <StatCard
          label="Active Users"
          value={stats?.active_users || 0}
          change={`${(stats?.active_users_change || 0) >= 0 ? "+" : ""}${stats?.active_users_change || 0}`}
          changeLabel="this month"
          icon={Users}
          isPositive={(stats?.active_users_change || 0) >= 0}
        />
        <StatCard
          label="Documents"
          value={stats?.document_count || 0}
          change={`+${stats?.document_count_change || 0}`}
          changeLabel="this week"
          icon={FileText}
          isPositive={true}
        />
      </div>

      {/* Chart */}
      <QueryChart data={stats?.queries_over_time || []} />

      {/* System Status */}
      <div className="bg-card-bg rounded-card border border-card-border p-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-3 h-3 rounded-full ${
              systemStatus === "healthy" ? "bg-status-green" : "bg-status-yellow"
            }`}
          />
          <span className="text-sm text-text-primary">
            {systemStatus === "healthy"
              ? "All Systems Operational"
              : "System Status: " + systemStatus}
          </span>
          <CheckCircle className="h-4 w-4 text-status-green ml-auto" />
        </div>
      </div>
    </div>
  );
}
