"use client";

import React, { useEffect, useState } from "react";
import {
  BarChart3,
  MessageSquare,
  Clock,
  TrendingUp,
  Calendar,
  FileText,
  Activity,
} from "lucide-react";
import { api, UserAnalytics } from "@/lib/api";
import { cn, formatRelativeTime } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon: React.ElementType;
  trend?: "up" | "down" | "neutral";
}

function StatCard({ label, value, subValue, icon: Icon, trend }: StatCardProps) {
  return (
    <div className="bg-card-bg border border-card-border rounded-card p-card-padding">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-text-muted text-sm mb-1">{label}</p>
          <p className="text-stat-number text-text-primary">{value}</p>
          {subValue && (
            <p
              className={cn(
                "text-sm mt-1",
                trend === "up" && "text-status-green",
                trend === "down" && "text-status-red",
                trend === "neutral" && "text-text-muted"
              )}
            >
              {subValue}
            </p>
          )}
        </div>
        <div className="p-3 bg-icon-bg rounded-lg">
          <Icon className="h-5 w-5 text-accent" />
        </div>
      </div>
    </div>
  );
}

interface QueryChartProps {
  data: { date: string; count: number }[];
}

function QueryChart({ data }: QueryChartProps) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="bg-card-bg border border-card-border rounded-card p-card-padding">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-medium text-text-primary">Query Activity</h3>
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <Calendar className="h-4 w-4" />
          Last 14 days
        </div>
      </div>

      <div className="flex items-end gap-2 h-48">
        {data.map((item, index) => {
          const height = item.count > 0 ? (item.count / maxCount) * 100 : 2;
          return (
            <div
              key={index}
              className="flex-1 flex flex-col items-center gap-2 group"
            >
              <div
                className="w-full bg-accent/20 rounded-t transition-all duration-300 hover:bg-accent/30 relative"
                style={{ height: `${height}%`, minHeight: "4px" }}
              >
                <div
                  className="absolute -top-8 left-1/2 -translate-x-1/2 bg-card-bg border border-card-border px-2 py-1 rounded text-xs text-text-primary opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10"
                >
                  {item.count} queries
                </div>
              </div>
              <span className="text-xs text-text-muted truncate w-full text-center">
                {item.date.split(" ")[1] || item.date}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<UserAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const data = await api.getUserAnalytics();
        setAnalytics(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load analytics");
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        <div className="text-center">
          <p className="text-status-red mb-2">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-accent hover:text-accent-hover"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!analytics) return null;

  const formatMs = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-page-title text-text-primary">Analytics</h1>
          <p className="text-text-muted text-sm mt-1">
            Your personal usage statistics
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 bg-card-bg border border-card-border rounded-lg">
          <Activity className="h-4 w-4 text-status-green" />
          <span className="text-sm text-text-secondary">Live data</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          label="Total Queries"
          value={analytics.total_queries}
          subValue={`${analytics.queries_today} today`}
          icon={MessageSquare}
          trend="neutral"
        />
        <StatCard
          label="This Week"
          value={analytics.queries_this_week}
          subValue={`${analytics.queries_this_month} this month`}
          icon={BarChart3}
          trend="up"
        />
        <StatCard
          label="Avg Response"
          value={formatMs(analytics.avg_response_time_ms)}
          subValue="Response time"
          icon={Clock}
          trend="neutral"
        />
        <StatCard
          label="Conversations"
          value={analytics.total_chats}
          subValue={`${analytics.total_messages} messages`}
          icon={TrendingUp}
          trend="neutral"
        />
      </div>

      {/* Query Activity Chart */}
      <QueryChart data={analytics.queries_by_day} />

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-card-bg border border-card-border rounded-card p-card-padding">
          <h3 className="text-lg font-medium text-text-primary mb-4">
            Recent Activity
          </h3>
          {analytics.recent_activity.length === 0 ? (
            <p className="text-text-muted text-sm text-center py-8">
              No recent activity
            </p>
          ) : (
            <div className="space-y-3">
              {analytics.recent_activity.map((activity, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-3 bg-page-bg rounded-lg"
                >
                  <MessageSquare className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary truncate">
                      {activity.query}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-text-muted">
                      <span>{formatRelativeTime(activity.created_at)}</span>
                      <span>•</span>
                      <span>{formatMs(activity.response_time_ms)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Documents */}
        <div className="bg-card-bg border border-card-border rounded-card p-card-padding">
          <h3 className="text-lg font-medium text-text-primary mb-4">
            Knowledge Base
          </h3>
          {analytics.top_documents.length === 0 ? (
            <p className="text-text-muted text-sm text-center py-8">
              No documents available
            </p>
          ) : (
            <div className="space-y-3">
              {analytics.top_documents.map((doc, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 bg-page-bg rounded-lg"
                >
                  <div className="p-2 bg-icon-bg rounded">
                    <FileText className="h-4 w-4 text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary truncate">
                      {doc.name}
                    </p>
                    <p className="text-xs text-text-muted">
                      Available for queries
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Usage Tips */}
      <div className="bg-navy/10 border border-navy-light/30 rounded-card p-card-padding">
        <h3 className="text-lg font-medium text-text-primary mb-2">
          Tips for Better Results
        </h3>
        <ul className="space-y-2 text-sm text-text-secondary">
          <li className="flex items-start gap-2">
            <span className="text-accent">•</span>
            Ask specific questions for more accurate answers
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent">•</span>
            Reference document names if you want information from specific sources
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent">•</span>
            Use follow-up questions to dig deeper into topics
          </li>
        </ul>
      </div>
    </div>
  );
}
