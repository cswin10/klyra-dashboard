const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Types
export interface User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
  created_at: string;
  last_active: string;
}

export interface Chat {
  id: string;
  user_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  messages: Message[];
}

export interface ChatExport {
  id: string;
  title: string;
  created_at: string;
  messages: {
    role: "user" | "assistant";
    content: string;
    sources: string[] | null;
    created_at: string;
  }[];
}

export interface ChatListItem {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  chat_id: string;
  role: "user" | "assistant";
  content: string;
  sources: string[] | null;
  created_at: string;
}

export interface RagConfidence {
  confidence_level: "high" | "medium" | "low" | "none";
  confidence_score?: number;
  used_general_knowledge?: boolean;
  is_ambiguous?: boolean;
  ambiguous_docs?: string[];
  doc_count?: number;
}

export type DocumentCategory =
  | "sales"
  | "company"
  | "legal"
  | "technical"
  | "other";

export const DOCUMENT_CATEGORIES: { value: DocumentCategory; label: string; description: string }[] = [
  { value: "sales", label: "Sales & Marketing", description: "Sales materials, marketing content" },
  { value: "company", label: "Company Info", description: "Company ethos, values, mission" },
  { value: "legal", label: "Legal & Compliance", description: "Legal documents, policies" },
  { value: "technical", label: "Technical", description: "Technical documentation" },
  { value: "other", label: "Other", description: "General documents" },
];

export interface Document {
  id: string;
  name: string;
  original_filename: string | null;
  file_type: string;
  file_size: number;
  category: DocumentCategory;
  status: "processing" | "ready" | "error";
  chunk_count: number;
  uploaded_by: string;
  uploaded_at: string;
  owner_id: string | null;  // null = company-wide, user_id = personal
  is_company_wide: boolean;
  version: number;
  parent_id: string | null;
  is_latest: boolean;
}

export interface DocumentUploadOptions {
  name: string;
  category: DocumentCategory;
  is_company_wide: boolean;
}

export interface MyDocumentCount {
  count: number;
  limit: number;
}

export interface DocumentVersion {
  id: string;
  name: string;
  file_type: string;
  file_size: number;
  version: number;
  uploaded_by: string;
  uploaded_at: string;
  status: "processing" | "ready" | "error";
}

export interface DocumentSearchResult {
  document_name: string;
  document_id: string | null;
  category: DocumentCategory | null;
  excerpt: string;
  relevance_score: number;
}

export interface DocumentSearchResponse {
  query: string;
  results: DocumentSearchResult[];
  total: number;
}

export interface Log {
  id: string;
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  query: string;
  response_time_ms: number;
  created_at: string;
}

export interface LogsResponse {
  logs: Log[];
  total: number;
  limit: number;
  offset: number;
}

export interface DailyQueryCount {
  date: string;
  count: number;
}

export interface DashboardStats {
  queries_today: number;
  queries_today_change: number;
  queries_this_week: number;
  queries_this_week_change: number;
  active_users: number;
  active_users_change: number;
  document_count: number;
  document_count_change: number;
  queries_over_time: DailyQueryCount[];
}

export interface UserAnalytics {
  total_queries: number;
  queries_today: number;
  queries_this_week: number;
  queries_this_month: number;
  avg_response_time_ms: number;
  total_chats: number;
  total_messages: number;
  queries_by_day: DailyQueryCount[];
  top_documents: { name: string; queries: number }[];
  recent_activity: { query: string; response_time_ms: number; created_at: string }[];
}

export interface SystemStats {
  current_model: string;
  gpu_name: string | null;
  gpu_memory_used: number | null;
  gpu_memory_total: number | null;
  storage_used: number;
  storage_total: number;
  uptime_seconds: number;
}

export type FeedbackType = "positive" | "negative";

export interface Feedback {
  id: string;
  message_id: string;
  user_id: string;
  feedback_type: FeedbackType;
  comment: string | null;
  created_at: string;
}

export interface FeedbackStats {
  total_positive: number;
  total_negative: number;
  recent_negative: Feedback[];
}

export type AuditAction =
  | "user_created"
  | "user_deleted"
  | "user_role_changed"
  | "document_uploaded"
  | "document_deleted"
  | "settings_changed"
  | "login"
  | "logout";

export interface AuditLog {
  id: string;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  action: AuditAction;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export interface AuditLogResponse {
  logs: AuditLog[];
  total: number;
  limit: number;
  offset: number;
}

export interface PromptTemplate {
  id: string;
  title: string;
  description: string | null;
  prompt: string;
  category: string | null;
  icon: string | null;
  is_system: boolean;
  created_by: string | null;
  created_at: string;
}

// API Client
class ApiClient {
  private isRefreshing = false;
  private refreshPromise: Promise<boolean> | null = null;

  private getToken(): string | null {
    if (typeof window !== "undefined") {
      return localStorage.getItem("token");
    }
    return null;
  }

  private async refreshToken(): Promise<boolean> {
    const token = this.getToken();
    if (!token) return false;

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
      });

      if (!response.ok) return false;

      const data = await response.json();
      if (data.token) {
        localStorage.setItem("token", data.token);
        if (data.user) {
          localStorage.setItem("user", JSON.stringify(data.user));
        }
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    isRetry = false
  ): Promise<T> {
    const token = this.getToken();
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    if (token) {
      (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    // Handle 401 - try to refresh token once
    if (response.status === 401 && !isRetry && token) {
      // Deduplicate refresh requests
      if (!this.isRefreshing) {
        this.isRefreshing = true;
        this.refreshPromise = this.refreshToken();
      }

      const refreshed = await this.refreshPromise;
      this.isRefreshing = false;
      this.refreshPromise = null;

      if (refreshed) {
        // Retry the original request with new token
        return this.request(endpoint, options, true);
      } else {
        // Refresh failed - redirect to login
        if (typeof window !== "undefined") {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          window.location.href = "/login";
        }
      }
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "An error occurred" }));
      throw new Error(error.detail || "An error occurred");
    }

    return response.json();
  }

  // Auth
  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    return this.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  }

  async logout(): Promise<void> {
    await this.request("/api/auth/logout", { method: "POST" });
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    }
  }

  async getMe(): Promise<User> {
    return this.request("/api/auth/me");
  }

  async updateProfile(data: { name?: string; email?: string }): Promise<User> {
    return this.request("/api/auth/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await this.request("/api/auth/password", {
      method: "PUT",
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    });
  }

  // Chats
  async getChats(): Promise<ChatListItem[]> {
    return this.request("/api/chats");
  }

  async searchChats(query: string): Promise<{ id: string; title: string | null; match_type: "title" | "content" }[]> {
    return this.request(`/api/chats/search?q=${encodeURIComponent(query)}`);
  }

  async createChat(): Promise<Chat> {
    return this.request("/api/chats", { method: "POST", body: JSON.stringify({}) });
  }

  async getChat(chatId: string): Promise<Chat> {
    return this.request(`/api/chats/${chatId}`);
  }

  async deleteChat(chatId: string): Promise<void> {
    await this.request(`/api/chats/${chatId}`, { method: "DELETE" });
  }

  async exportChat(chatId: string): Promise<ChatExport> {
    return this.request(`/api/chats/${chatId}/export`);
  }

  async sendMessage(
    chatId: string,
    content: string,
    onToken: (token: string) => void,
    onComplete: (sources: string[], userMessageId?: string, assistantMessageId?: string, confidence?: RagConfidence) => void,
    onError: (error: string) => void
  ): Promise<void> {
    const token = this.getToken();
    const response = await fetch(`${API_BASE_URL}/api/chats/${chatId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ content }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Failed to send message" }));
      onError(error.detail);
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      onError("No response stream");
      return;
    }

    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.token) {
              onToken(data.token);
            }
            if (data.done) {
              onComplete(data.sources || [], data.user_message_id, data.assistant_message_id, data.confidence);
            }
            if (data.error) {
              onError(data.error);
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    }
  }

  // Documents
  async getDocuments(): Promise<Document[]> {
    return this.request("/api/documents");
  }

  async getMyDocumentCount(): Promise<MyDocumentCount> {
    return this.request("/api/documents/my-document-count");
  }

  async uploadDocument(file: File, options: DocumentUploadOptions): Promise<Document> {
    const token = this.getToken();
    const formData = new FormData();
    formData.append("file", file);
    formData.append("name", options.name);
    formData.append("category", options.category);
    formData.append("is_company_wide", String(options.is_company_wide));

    const response = await fetch(`${API_BASE_URL}/api/documents`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Failed to upload document" }));
      throw new Error(error.detail);
    }

    return response.json();
  }

  async downloadDocument(documentId: string): Promise<Blob> {
    const token = this.getToken();
    const response = await fetch(`${API_BASE_URL}/api/documents/${documentId}/download`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Failed to download document" }));
      throw new Error(error.detail);
    }

    return response.blob();
  }

  getDocumentDownloadUrl(documentId: string): string {
    const token = this.getToken();
    return `${API_BASE_URL}/api/documents/${documentId}/download?token=${token}`;
  }

  async deleteDocument(documentId: string): Promise<void> {
    await this.request(`/api/documents/${documentId}`, { method: "DELETE" });
  }

  async searchDocuments(query: string, limit: number = 10): Promise<DocumentSearchResponse> {
    const params = new URLSearchParams({ q: query, limit: limit.toString() });
    return this.request(`/api/documents/search?${params}`);
  }

  async getDocumentVersions(documentId: string): Promise<DocumentVersion[]> {
    return this.request(`/api/documents/${documentId}/versions`);
  }

  async uploadNewVersion(documentId: string, file: File): Promise<Document> {
    const token = this.getToken();
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_BASE_URL}/api/documents/${documentId}/versions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Failed to upload new version" }));
      throw new Error(error.detail);
    }

    return response.json();
  }

  async revertToVersion(documentId: string, versionId: string): Promise<void> {
    await this.request(`/api/documents/${documentId}/revert/${versionId}`, { method: "POST" });
  }

  // Users (admin)
  async getUsers(): Promise<User[]> {
    return this.request("/api/users");
  }

  async createUser(data: { name: string; email: string; password: string; role: "admin" | "user" }): Promise<User> {
    return this.request("/api/users", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateUser(userId: string, data: { name?: string; email?: string; role?: "admin" | "user"; password?: string }): Promise<User> {
    return this.request(`/api/users/${userId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteUser(userId: string): Promise<void> {
    await this.request(`/api/users/${userId}`, { method: "DELETE" });
  }

  async bulkImportUsers(file: File): Promise<{
    success: boolean;
    summary: { total_processed: number; created: number; skipped: number; errors: number };
    details: {
      created: { row: number; email: string; name: string; role: string }[];
      skipped: { row: number; email: string; reason: string }[];
      errors: { row: number; email: string; error: string }[];
    };
  }> {
    const token = this.getToken();
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_BASE_URL}/api/users/bulk-import`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Failed to import users" }));
      throw new Error(error.detail);
    }

    return response.json();
  }

  // System (admin)
  async getSystemStats(): Promise<SystemStats> {
    return this.request("/api/system/stats");
  }

  async restartOllama(): Promise<void> {
    await this.request("/api/system/restart-ollama", { method: "POST" });
  }

  async getSystemHealth(): Promise<{ status: string; ollama: string }> {
    try {
      return await this.request("/api/system/health");
    } catch {
      return { status: "offline", ollama: "not running" };
    }
  }

  // Logs (admin)
  async getLogs(params: { user_id?: string; limit?: number; offset?: number } = {}): Promise<LogsResponse> {
    const searchParams = new URLSearchParams();
    if (params.user_id) searchParams.set("user_id", params.user_id);
    if (params.limit) searchParams.set("limit", params.limit.toString());
    if (params.offset) searchParams.set("offset", params.offset.toString());

    const query = searchParams.toString();
    return this.request(`/api/logs${query ? `?${query}` : ""}`);
  }

  // Stats
  async getDashboardStats(): Promise<DashboardStats> {
    return this.request("/api/stats");
  }

  async getUserAnalytics(): Promise<UserAnalytics> {
    return this.request("/api/stats/me");
  }

  // Feedback
  async submitFeedback(messageId: string, feedbackType: FeedbackType, comment?: string): Promise<Feedback> {
    return this.request("/api/feedback", {
      method: "POST",
      body: JSON.stringify({
        message_id: messageId,
        feedback_type: feedbackType,
        comment: comment || null,
      }),
    });
  }

  async getMessageFeedback(messageId: string): Promise<Feedback | null> {
    try {
      return await this.request(`/api/feedback/message/${messageId}`);
    } catch {
      return null;
    }
  }

  async deleteFeedback(messageId: string): Promise<void> {
    await this.request(`/api/feedback/message/${messageId}`, { method: "DELETE" });
  }

  async getFeedbackStats(): Promise<FeedbackStats> {
    return this.request("/api/feedback/stats");
  }

  // Audit logs (admin)
  async getAuditLogs(params: { user_id?: string; action?: AuditAction; limit?: number; offset?: number } = {}): Promise<AuditLogResponse> {
    const searchParams = new URLSearchParams();
    if (params.user_id) searchParams.set("user_id", params.user_id);
    if (params.action) searchParams.set("action", params.action);
    if (params.limit) searchParams.set("limit", params.limit.toString());
    if (params.offset) searchParams.set("offset", params.offset.toString());

    const query = searchParams.toString();
    return this.request(`/api/audit${query ? `?${query}` : ""}`);
  }

  // Prompt templates
  async getTemplates(): Promise<PromptTemplate[]> {
    return this.request("/api/templates");
  }

  async createTemplate(data: { title: string; description?: string; prompt: string; category?: string; icon?: string }): Promise<PromptTemplate> {
    return this.request("/api/templates", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async deleteTemplate(templateId: string): Promise<void> {
    await this.request(`/api/templates/${templateId}`, { method: "DELETE" });
  }
}

export const api = new ApiClient();
