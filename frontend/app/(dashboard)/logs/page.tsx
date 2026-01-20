"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DataTable, Modal } from "@/components";
import { useAuth } from "@/lib/auth";
import { api, Log, User } from "@/lib/api";
import { formatDateTime, truncate } from "@/lib/utils";

export default function LogsPage() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [logs, setLogs] = useState<Log[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedLog, setSelectedLog] = useState<Log | null>(null);

  const limit = 20;

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.push("/overview");
    }
  }, [isAdmin, authLoading, router]);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      fetchLogs();
    }
  }, [isAdmin, offset, selectedUserId]);

  const fetchUsers = async () => {
    try {
      const userList = await api.getUsers();
      setUsers(userList);
    } catch (err) {
      console.error("Failed to fetch users:", err);
    }
  };

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const response = await api.getLogs({
        user_id: selectedUserId || undefined,
        limit,
        offset,
      });
      setLogs(response.logs);
      setTotal(response.total);
    } catch (err) {
      console.error("Failed to fetch logs:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrevPage = () => {
    setOffset(Math.max(0, offset - limit));
  };

  const handleNextPage = () => {
    if (offset + limit < total) {
      setOffset(offset + limit);
    }
  };

  const handleUserFilter = (userId: string) => {
    setSelectedUserId(userId);
    setOffset(0);
  };

  if (authLoading || (!isAdmin && !authLoading)) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  const columns: Array<{
    key: string;
    header: string;
    render: (row: Log) => React.ReactNode;
  }> = [
    {
      key: "created_at",
      header: "Timestamp",
      render: (log) => (
        <span className="text-text-secondary text-sm">
          {formatDateTime(log.created_at)}
        </span>
      ),
    },
    {
      key: "user",
      header: "User",
      render: (log) => (
        <div>
          <p className="font-medium text-text-primary">{log.user_name || "Unknown"}</p>
          <p className="text-xs text-text-muted">{log.user_email}</p>
        </div>
      ),
    },
    {
      key: "query",
      header: "Query",
      render: (log) => (
        <span className="text-text-secondary">{truncate(log.query, 60)}</span>
      ),
    },
    {
      key: "response_time_ms",
      header: "Response Time",
      render: (log) => (
        <span className="text-text-secondary">{log.response_time_ms}ms</span>
      ),
    },
  ];

  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-page-title text-text-primary">Logs</h1>

        {/* User Filter */}
        <select
          value={selectedUserId}
          onChange={(e) => handleUserFilter(e.target.value)}
          className="px-4 py-2 bg-input-bg border border-input-border rounded-lg text-text-primary focus:border-accent transition-colors"
        >
          <option value="">All Users</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>
      </div>

      {/* Logs Table */}
      <DataTable<Log>
        columns={columns}
        data={logs}
        isLoading={isLoading}
        emptyMessage="No logs found"
        onRowClick={(log) => setSelectedLog(log)}
      />

      {/* Pagination */}
      {total > limit && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-text-secondary">
            Showing {offset + 1} to {Math.min(offset + limit, total)} of {total} logs
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevPage}
              disabled={offset === 0}
              className="p-2 rounded-lg border border-card-border text-text-secondary hover:text-text-primary hover:bg-card-bg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm text-text-secondary px-3">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={handleNextPage}
              disabled={offset + limit >= total}
              className="p-2 rounded-lg border border-card-border text-text-secondary hover:text-text-primary hover:bg-card-bg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Log Detail Modal */}
      <Modal
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title="Log Details"
        className="max-w-2xl"
      >
        {selectedLog && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Timestamp
              </label>
              <p className="text-text-primary">{formatDateTime(selectedLog.created_at)}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                User
              </label>
              <p className="text-text-primary">
                {selectedLog.user_name} ({selectedLog.user_email})
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Response Time
              </label>
              <p className="text-text-primary">{selectedLog.response_time_ms}ms</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Query
              </label>
              <div className="p-4 bg-input-bg border border-input-border rounded-lg">
                <p className="text-text-primary whitespace-pre-wrap">{selectedLog.query}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
