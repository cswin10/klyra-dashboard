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

export interface Document {
  id: string;
  name: string;
  file_type: string;
  file_size: number;
  status: "processing" | "ready" | "error";
  chunk_count: number;
  uploaded_by: string;
  uploaded_at: string;
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

export interface SystemStats {
  current_model: string;
  gpu_name: string | null;
  gpu_memory_used: number | null;
  gpu_memory_total: number | null;
  storage_used: number;
  storage_total: number;
  uptime_seconds: number;
}

// API Client
class ApiClient {
  private getToken(): string | null {
    if (typeof window !== "undefined") {
      return localStorage.getItem("token");
    }
    return null;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
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

  async createChat(): Promise<Chat> {
    return this.request("/api/chats", { method: "POST", body: JSON.stringify({}) });
  }

  async getChat(chatId: string): Promise<Chat> {
    return this.request(`/api/chats/${chatId}`);
  }

  async deleteChat(chatId: string): Promise<void> {
    await this.request(`/api/chats/${chatId}`, { method: "DELETE" });
  }

  async sendMessage(
    chatId: string,
    content: string,
    onToken: (token: string) => void,
    onComplete: (sources: string[]) => void,
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
              onComplete(data.sources || []);
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

  async uploadDocument(file: File): Promise<Document> {
    const token = this.getToken();
    const formData = new FormData();
    formData.append("file", file);

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

  async deleteDocument(documentId: string): Promise<void> {
    await this.request(`/api/documents/${documentId}`, { method: "DELETE" });
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

  // System (admin)
  async getSystemStats(): Promise<SystemStats> {
    return this.request("/api/system/stats");
  }

  async restartOllama(): Promise<void> {
    await this.request("/api/system/restart-ollama", { method: "POST" });
  }

  async getSystemHealth(): Promise<{ status: string; ollama: string }> {
    return this.request("/api/system/health");
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
}

export const api = new ApiClient();
