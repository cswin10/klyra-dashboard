"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { Plus, MessageSquare, Trash2 } from "lucide-react";
import { ChatMessage, ChatInput } from "@/components";
import { api, ChatListItem, Message } from "@/lib/api";
import { cn, formatRelativeTime, truncate } from "@/lib/utils";

interface LocalMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources: string[] | null;
  isStreaming?: boolean;
}

export default function ChatPage() {
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [isLoadingChats, setIsLoadingChats] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Load chats on mount
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

    fetchChats();
  }, []);

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
        (sources) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessageId ? { ...m, sources, isStreaming: false } : m
            )
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
    <div className="flex h-[calc(100vh-64px)] -m-page-padding">
      {/* Chat History Sidebar */}
      <div className="w-72 border-r border-card-border bg-sidebar-bg flex flex-col">
        <div className="p-4 border-b border-card-border">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-accent text-page-bg rounded-lg font-medium hover:bg-accent-hover transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {isLoadingChats ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent"></div>
            </div>
          ) : chats.length === 0 ? (
            <div className="text-center py-8 text-text-secondary text-sm">
              No chats yet. Start a new conversation!
            </div>
          ) : (
            chats.map((chat) => (
              <div
                key={chat.id}
                onClick={() => setActiveChatId(chat.id)}
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
                  </p>
                </div>
                <button
                  onClick={(e) => handleDeleteChat(chat.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-status-red/10 hover:text-status-red transition-all"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Interface */}
      <div className="flex-1 flex flex-col">
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
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {isLoadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent"></div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <p className="text-text-secondary text-sm">
                      Send a message to start the conversation
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((message) => (
                  <ChatMessage
                    key={message.id}
                    role={message.role}
                    content={message.content}
                    sources={message.sources}
                    isStreaming={message.isStreaming}
                  />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-card-border bg-page-bg">
              <ChatInput
                onSend={handleSendMessage}
                disabled={isSending || !activeChatId}
                placeholder="Ask Klyra anything..."
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
