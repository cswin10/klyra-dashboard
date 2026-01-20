"use client";

import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { Plus, MessageSquare, Trash2, Download, FileText, Mail, HelpCircle, GitCompare, Search, List, X, PanelLeftClose, PanelLeft, Sparkles } from "lucide-react";
import { ChatMessage, ChatInput, SmartSuggestions, SkeletonChatList, SkeletonMessage } from "@/components";
import { api, ChatListItem, Message, PromptTemplate } from "@/lib/api";
import { cn, formatRelativeTime, truncate } from "@/lib/utils";

interface LocalMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources: string[] | null;
  isStreaming?: boolean;
}

// Icon map for templates
const TEMPLATE_ICONS: Record<string, React.ReactNode> = {
  "file-text": <FileText className="h-5 w-5" />,
  "mail": <Mail className="h-5 w-5" />,
  "help-circle": <HelpCircle className="h-5 w-5" />,
  "git-compare": <GitCompare className="h-5 w-5" />,
  "search": <Search className="h-5 w-5" />,
  "list": <List className="h-5 w-5" />,
};

export default function ChatPage() {
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [isLoadingChats, setIsLoadingChats] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [draftMessage, setDraftMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ chatId: string; matchType: "title" | "content" }[]>([]);
  const [isChatSidebarOpen, setIsChatSidebarOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Load chats and templates on mount
  useEffect(() => {
    const fetchChats = async () => {
      try {
        const chatList = await api.getChats();
        setChats(chatList);
      } catch (error) {
        console.error("Failed to fetch chats:", error);
      } finally {
        setIsLoadingChats(false);
      }
    };

    const fetchTemplates = async () => {
      try {
        const templateList = await api.getTemplates();
        setTemplates(templateList);
      } catch (error) {
        console.error("Failed to fetch templates:", error);
      }
    };

    fetchChats();
    fetchTemplates();
  }, []);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const results = await api.searchChats(searchQuery);
        setSearchResults(results.map((r: { id: string; match_type: "title" | "content" }) => ({
          chatId: r.id,
          matchType: r.match_type
        })));
      } catch (error) {
        // Fallback to client-side filtering if API not available
        const filtered = chats.filter(chat =>
          chat.title?.toLowerCase().includes(searchQuery.toLowerCase())
        );
        setSearchResults(filtered.map(c => ({ chatId: c.id, matchType: "title" as const })));
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, chats]);

  // Filter chats based on search
  const displayedChats = useMemo(() => {
    if (!searchQuery.trim()) return chats;
    const matchedIds = new Set(searchResults.map(r => r.chatId));
    return chats.filter(chat => matchedIds.has(chat.id));
  }, [chats, searchQuery, searchResults]);

  // Load messages when active chat changes
  useEffect(() => {
    if (!activeChatId) {
      setMessages([]);
      return;
    }

    const fetchMessages = async () => {
      setIsLoadingMessages(true);
      try {
        const chat = await api.getChat(activeChatId);
        setMessages(
          chat.messages.map((m: Message) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            sources: m.sources,
          }))
        );
      } catch (error) {
        console.error("Failed to fetch messages:", error);
      } finally {
        setIsLoadingMessages(false);
      }
    };

    fetchMessages();
  }, [activeChatId]);

  const handleNewChat = async () => {
    try {
      const newChat = await api.createChat();
      setChats((prev) => [
        { id: newChat.id, title: null, created_at: newChat.created_at, updated_at: newChat.updated_at },
        ...prev,
      ]);
      setActiveChatId(newChat.id);
      setMessages([]);
    } catch (error) {
      console.error("Failed to create chat:", error);
    }
  };

  const handleDeleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.deleteChat(chatId);
      setChats((prev) => prev.filter((c) => c.id !== chatId));
      if (activeChatId === chatId) {
        setActiveChatId(null);
        setMessages([]);
      }
    } catch (error) {
      console.error("Failed to delete chat:", error);
    }
  };

  const handleExportChat = async () => {
    if (!activeChatId) return;

    try {
      const exportData = await api.exportChat(activeChatId);

      // Create HTML content for printing/PDF
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>${exportData.title} - Klyra Chat Export</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; }
            h1 { font-size: 24px; margin-bottom: 8px; }
            .date { color: #666; font-size: 14px; margin-bottom: 32px; }
            .message { margin: 16px 0; padding: 12px 16px; border-radius: 12px; }
            .user { background: #3b82f6; color: white; margin-left: 20%; text-align: right; }
            .assistant { background: #f3f4f6; color: #1f2937; margin-right: 20%; }
            .role { font-weight: 600; font-size: 12px; margin-bottom: 4px; }
            .content { white-space: pre-wrap; }
            .sources { font-size: 12px; color: #666; margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(0,0,0,0.1); }
            .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #666; font-size: 12px; text-align: center; }
          </style>
        </head>
        <body>
          <h1>${exportData.title}</h1>
          <p class="date">Exported on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
          ${exportData.messages.map(msg => `
            <div class="message ${msg.role}">
              <div class="role">${msg.role === 'user' ? 'You' : 'Klyra'}</div>
              <div class="content">${msg.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
              ${msg.sources && msg.sources.length > 0 ? `<div class="sources">Sources: ${msg.sources.join(', ')}</div>` : ''}
            </div>
          `).join('')}
          <div class="footer">Generated by Klyra - Your Private AI Assistant</div>
        </body>
        </html>
      `;

      // Open in new window for printing
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.print();
      }
    } catch (error) {
      console.error("Failed to export chat:", error);
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!activeChatId || isSending) return;

    setIsSending(true);

    // Add user message
    const userMessageId = `temp-user-${Date.now()}`;
    const assistantMessageId = `temp-assistant-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      { id: userMessageId, role: "user", content, sources: null },
      { id: assistantMessageId, role: "assistant", content: "", sources: null, isStreaming: true },
    ]);

    // Update chat title if first message
    setChats((prev) =>
      prev.map((c) =>
        c.id === activeChatId && !c.title
          ? { ...c, title: truncate(content, 50), updated_at: new Date().toISOString() }
          : c
      )
    );

    try {
      await api.sendMessage(
        activeChatId,
        content,
        (token) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessageId ? { ...m, content: m.content + token } : m
            )
          );
        },
        (sources, userMsgId, assistantMsgId) => {
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id === assistantMessageId) {
                return { ...m, id: assistantMsgId || m.id, sources, isStreaming: false };
              }
              if (m.id === userMessageId && userMsgId) {
                return { ...m, id: userMsgId };
              }
              return m;
            })
          );
          setIsSending(false);
        },
        (error) => {
          console.error("Message error:", error);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessageId
                ? { ...m, content: "Sorry, an error occurred. Please try again.", isStreaming: false }
                : m
            )
          );
          setIsSending(false);
        }
      );
    } catch (error) {
      console.error("Failed to send message:", error);
      setIsSending(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-64px)] lg:h-[calc(100vh-64px)] -m-4 sm:-m-6 lg:-m-page-padding relative">
      {/* Mobile overlay when sidebar is open */}
      {isChatSidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-20"
          onClick={() => setIsChatSidebarOpen(false)}
        />
      )}

      {/* Chat History Sidebar - collapsible on mobile */}
      <div className={cn(
        "fixed md:relative inset-y-0 left-0 z-30 md:z-auto",
        "w-72 border-r border-card-border bg-sidebar-bg flex flex-col",
        "transition-transform duration-300 ease-in-out md:translate-x-0",
        isChatSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-4 border-b border-card-border space-y-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleNewChat}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-accent text-page-bg rounded-lg font-medium hover:bg-accent-hover transition-colors"
            >
              <Plus className="h-4 w-4" />
              New Chat
            </button>
            {/* Mobile close button */}
            <button
              onClick={() => setIsChatSidebarOpen(false)}
              className="md:hidden p-2.5 bg-card-bg border border-card-border rounded-lg text-text-secondary hover:text-text-primary"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
            <input
              type="text"
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-input-bg border border-input-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-primary"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {isLoadingChats ? (
            <SkeletonChatList count={6} />
          ) : displayedChats.length === 0 ? (
            <div className="text-center py-8 text-text-secondary text-sm">
              {searchQuery ? "No matching chats found" : "No chats yet. Start a new conversation!"}
            </div>
          ) : (
            displayedChats.map((chat) => {
              const searchMatch = searchResults.find(r => r.chatId === chat.id);
              return (
                <div
                  key={chat.id}
                  onClick={() => {
                    setActiveChatId(chat.id);
                    setIsChatSidebarOpen(false);
                  }}
                  className={cn(
                    "group flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                    activeChatId === chat.id
                      ? "bg-card-bg text-text-primary"
                      : "text-text-secondary hover:bg-card-bg/50 hover:text-text-primary"
                  )}
                >
                  <MessageSquare className="h-4 w-4 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">
                      {chat.title || "New Chat"}
                    </p>
                    <p className="text-xs text-text-muted">
                      {formatRelativeTime(chat.updated_at)}
                      {searchMatch?.matchType === "content" && (
                        <span className="ml-1 text-accent">• in messages</span>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={(e) => handleDeleteChat(chat.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-status-red/10 hover:text-status-red transition-all"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Chat Interface */}
      <div className="flex-1 flex flex-col md:ml-0">
        {!activeChatId ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="h-12 w-12 text-text-muted mx-auto mb-4" />
              <h2 className="text-lg font-medium text-text-primary mb-2">
                Welcome to Klyra
              </h2>
              <p className="text-text-secondary text-sm max-w-sm">
                Start a new chat or select an existing conversation to continue.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat Header with Export */}
            <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-card-border bg-card-bg/50">
              <div className="flex items-center gap-3 min-w-0">
                {/* Mobile sidebar toggle */}
                <button
                  onClick={() => setIsChatSidebarOpen(true)}
                  className="md:hidden p-1.5 text-text-secondary hover:text-text-primary transition-colors"
                  aria-label="Open chat history"
                >
                  <PanelLeft className="h-5 w-5" />
                </button>
                <h2 className="font-medium text-text-primary truncate">
                  {chats.find(c => c.id === activeChatId)?.title || "New Chat"}
                </h2>
              </div>
              <button
                onClick={handleExportChat}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary hover:bg-card-bg rounded-lg transition-colors"
                title="Export to PDF"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Export</span>
              </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
              {isLoadingMessages ? (
                <div className="space-y-4 animate-fade-in">
                  <SkeletonMessage isUser={false} />
                  <SkeletonMessage isUser={true} />
                  <SkeletonMessage isUser={false} />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full animate-fade-in-up">
                  <div className="relative mb-6">
                    <div className="absolute inset-0 bg-accent/20 blur-2xl rounded-full" />
                    <div className="relative p-4 bg-card-bg/50 backdrop-blur-sm border border-card-border rounded-2xl">
                      <Sparkles className="h-8 w-8 text-accent" />
                    </div>
                  </div>
                  <h3 className="text-lg font-medium text-text-primary mb-2">Start a conversation</h3>
                  <p className="text-text-secondary text-sm mb-8 text-center max-w-md">
                    Ask Klyra anything or try a quick prompt below
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-w-2xl stagger-children">
                    {templates.slice(0, 6).map((template, index) => (
                      <button
                        key={template.id}
                        onClick={() => setDraftMessage(template.prompt)}
                        disabled={isSending}
                        style={{ animationDelay: `${index * 0.05}s` }}
                        className="flex items-start gap-3 p-4 bg-card-bg/80 backdrop-blur-sm border border-card-border rounded-xl text-left hover:border-accent/50 hover:bg-card-bg hover:shadow-lg hover:shadow-accent/5 transition-all duration-200 group card-lift animate-fade-in-up"
                      >
                        <span className="text-accent group-hover:text-accent-hover group-hover:scale-110 transition-all duration-200">
                          {TEMPLATE_ICONS[template.icon || "file-text"] || <FileText className="h-5 w-5" />}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-text-primary text-sm truncate">
                            {template.title}
                          </p>
                          <p className="text-xs text-text-muted line-clamp-2">
                            {template.description}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((message) => (
                    <ChatMessage
                      key={message.id}
                      messageId={message.id.startsWith("temp-") ? undefined : message.id}
                      role={message.role}
                      content={message.content}
                      sources={message.sources}
                      isStreaming={message.isStreaming}
                    />
                  ))}
                  {/* Smart Suggestions after last assistant message */}
                  {messages.length > 0 &&
                    messages[messages.length - 1].role === "assistant" &&
                    !messages[messages.length - 1].isStreaming && (
                      <SmartSuggestions
                        lastAssistantMessage={messages[messages.length - 1].content}
                        sources={messages[messages.length - 1].sources}
                        onSuggestionClick={(prompt) => {
                          setDraftMessage(prompt);
                        }}
                        disabled={isSending}
                      />
                    )}
                </>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-card-border bg-page-bg">
              {draftMessage.includes("[") && draftMessage.includes("]") && (
                <p className="text-xs text-text-muted mb-2 px-1">
                  Replace the [bracketed text] with your specific details, then press Enter to send.
                </p>
              )}
              <ChatInput
                onSend={handleSendMessage}
                disabled={isSending || !activeChatId}
                placeholder="Ask Klyra anything..."
                value={draftMessage}
                onChange={setDraftMessage}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
