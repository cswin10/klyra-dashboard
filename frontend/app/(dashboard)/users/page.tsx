"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Upload, X, CheckCircle, AlertCircle, SkipForward } from "lucide-react";
import { DataTable, StatusBadge, Modal } from "@/components";
import { api, User } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/utils";

interface UserFormData {
  name: string;
  email: string;
  password: string;
  role: "admin" | "user";
}

export default function UsersPage() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<UserFormData>({
    name: "",
    email: "",
    password: "",
    role: "user",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bulk import state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResults, setImportResults] = useState<{
    summary: { total_processed: number; created: number; skipped: number; errors: number };
    details: {
      created: { row: number; email: string; name: string; role: string }[];
      skipped: { row: number; email: string; reason: string }[];
      errors: { row: number; email: string; error: string }[];
    };
  } | null>(null);

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

  const fetchUsers = async () => {
    try {
      const userList = await api.getUsers();
      setUsers(userList);
    } catch (err) {
      console.error("Failed to fetch users:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        name: user.name,
        email: user.email,
        password: "",
        role: user.role,
      });
    } else {
      setEditingUser(null);
      setFormData({ name: "", email: "", password: "", role: "user" });
    }
    setError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
    setFormData({ name: "", email: "", password: "", role: "user" });
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (editingUser) {
        const updateData: Parameters<typeof api.updateUser>[1] = {
          name: formData.name,
          email: formData.email,
          role: formData.role,
        };
        if (formData.password) {
          updateData.password = formData.password;
        }
        const updated = await api.updateUser(editingUser.id, updateData);
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      } else {
        const newUser = await api.createUser(formData);
        setUsers((prev) => [newUser, ...prev]);
      }
      handleCloseModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save user");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;

    try {
      await api.deleteUser(userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (err) {
      console.error("Failed to delete user:", err);
    }
  };

  const handleBulkImport = async (file: File) => {
    setIsImporting(true);
    setImportResults(null);

    try {
      const result = await api.bulkImportUsers(file);
      setImportResults({
        summary: result.summary,
        details: result.details,
      });

      // Refresh users list
      if (result.summary.created > 0) {
        fetchUsers();
      }
    } catch (err) {
      setImportResults({
        summary: { total_processed: 0, created: 0, skipped: 0, errors: 1 },
        details: {
          created: [],
          skipped: [],
          errors: [{ row: 0, email: "N/A", error: err instanceof Error ? err.message : "Import failed" }],
        },
      });
    } finally {
      setIsImporting(false);
    }
  };

  if (authLoading || (!isAdmin && !authLoading)) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  const columns = [
    {
      key: "name",
      header: "Name",
      render: (user: User) => <span className="font-medium">{user.name}</span>,
    },
    {
      key: "email",
      header: "Email",
      render: (user: User) => (
        <span className="text-text-secondary">{user.email}</span>
      ),
    },
    {
      key: "role",
      header: "Role",
      render: (user: User) => <StatusBadge status={user.role} />,
    },
    {
      key: "last_active",
      header: "Last Active",
      render: (user: User) => (
        <span className="text-text-secondary">{formatDate(user.last_active)}</span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (user: User) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleOpenModal(user);
            }}
            className="p-2 rounded-lg text-text-secondary hover:text-accent hover:bg-accent/10 transition-colors"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(user.id);
            }}
            className="p-2 rounded-lg text-text-secondary hover:text-status-red hover:bg-status-red/10 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-page-title text-text-primary">Users</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 border border-card-border text-text-secondary rounded-lg font-medium hover:bg-card-bg transition-colors"
          >
            <Upload className="h-4 w-4" />
            Import CSV
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-page-bg rounded-lg font-medium hover:bg-accent-hover transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add User
          </button>
        </div>
      </div>

      {/* Users Table */}
      <DataTable
        columns={columns}
        data={users}
        isLoading={isLoading}
        emptyMessage="No users found"
      />

      {/* Add/Edit User Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingUser ? "Edit User" : "Add User"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-status-red/10 border border-status-red/20 rounded-lg text-status-red text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full px-4 py-2.5 bg-input-bg border border-input-border rounded-lg text-text-primary placeholder:text-text-muted focus:border-accent transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              className="w-full px-4 py-2.5 bg-input-bg border border-input-border rounded-lg text-text-primary placeholder:text-text-muted focus:border-accent transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Password {editingUser && "(leave blank to keep current)"}
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required={!editingUser}
              className="w-full px-4 py-2.5 bg-input-bg border border-input-border rounded-lg text-text-primary placeholder:text-text-muted focus:border-accent transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Role
            </label>
            <select
              value={formData.role}
              onChange={(e) =>
                setFormData({ ...formData, role: e.target.value as "admin" | "user" })
              }
              className="w-full px-4 py-2.5 bg-input-bg border border-input-border rounded-lg text-text-primary focus:border-accent transition-colors"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleCloseModal}
              className="flex-1 px-4 py-2.5 border border-card-border rounded-lg text-text-secondary hover:text-text-primary hover:bg-card-bg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2.5 bg-accent text-page-bg rounded-lg font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Bulk Import Modal */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => {
          setIsImportModalOpen(false);
          setImportResults(null);
        }}
        title="Import Users from CSV"
      >
        <div className="space-y-4">
          {!importResults ? (
            <>
              <p className="text-text-secondary text-sm">
                Upload a CSV file with the following columns: <strong>name, email, password, role</strong>
                <br />
                <span className="text-text-muted">The role column is optional (defaults to &quot;user&quot;).</span>
              </p>

              <div className="p-4 bg-card-bg rounded-lg border border-card-border">
                <p className="text-xs text-text-muted mb-2">Example CSV format:</p>
                <code className="text-xs text-text-secondary">
                  name,email,password,role<br />
                  John Doe,john@example.com,password123,user<br />
                  Jane Admin,jane@example.com,securepass,admin
                </code>
              </div>

              <div className="relative">
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      handleBulkImport(e.target.files[0]);
                    }
                  }}
                  disabled={isImporting}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex items-center justify-center gap-2 p-6 border-2 border-dashed border-card-border rounded-lg text-text-secondary hover:border-accent transition-colors">
                  {isImporting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-accent"></div>
                      <span>Importing...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-5 w-5" />
                      <span>Click or drag CSV file here</span>
                    </>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Import Results */}
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-3 bg-green-500/10 rounded-lg">
                  <p className="text-2xl font-bold text-green-500">{importResults.summary.created}</p>
                  <p className="text-xs text-text-muted">Created</p>
                </div>
                <div className="p-3 bg-yellow-500/10 rounded-lg">
                  <p className="text-2xl font-bold text-yellow-500">{importResults.summary.skipped}</p>
                  <p className="text-xs text-text-muted">Skipped</p>
                </div>
                <div className="p-3 bg-red-500/10 rounded-lg">
                  <p className="text-2xl font-bold text-red-500">{importResults.summary.errors}</p>
                  <p className="text-xs text-text-muted">Errors</p>
                </div>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-2">
                {importResults.details.created.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 bg-green-500/10 rounded text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-text-primary">{item.name}</span>
                    <span className="text-text-muted">({item.email})</span>
                  </div>
                ))}
                {importResults.details.skipped.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 bg-yellow-500/10 rounded text-sm">
                    <SkipForward className="h-4 w-4 text-yellow-500" />
                    <span className="text-text-primary">{item.email}</span>
                    <span className="text-text-muted">- {item.reason}</span>
                  </div>
                ))}
                {importResults.details.errors.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 bg-red-500/10 rounded text-sm">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <span className="text-text-primary">{item.email}</span>
                    <span className="text-text-muted">- {item.error}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportResults(null);
                }}
                className="w-full px-4 py-2.5 bg-accent text-page-bg rounded-lg font-medium hover:bg-accent-hover transition-colors"
              >
                Done
              </button>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
