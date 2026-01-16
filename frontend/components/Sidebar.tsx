"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  MessageSquare,
  FileText,
  BarChart3,
  Users,
  Server,
  List,
  Settings,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn, getInitials } from "@/lib/utils";
import { api } from "@/lib/api";

const navigation = [
  { name: "Overview", href: "/overview", icon: LayoutGrid },
  { name: "Chat", href: "/chat", icon: MessageSquare },
  { name: "Documents", href: "/documents", icon: FileText },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "Users", href: "/users", icon: Users, adminOnly: true },
  { name: "System", href: "/system", icon: Server, adminOnly: true },
  { name: "Logs", href: "/logs", icon: List, adminOnly: true },
  { name: "Settings", href: "/settings", icon: Settings },
];

type OllamaStatus = "checking" | "running" | "not running" | "offline";

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, isAdmin } = useAuth();
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus>("checking");

  const filteredNavigation = navigation.filter(
    (item) => !item.adminOnly || isAdmin
  );

  // Poll Ollama status every 30 seconds
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const health = await api.getSystemHealth();
        setOllamaStatus(health.ollama as OllamaStatus);
      } catch {
        setOllamaStatus("offline");
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <aside className="fixed left-0 top-0 h-full w-sidebar bg-black/80 backdrop-blur-xl border-r border-white/5 flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center justify-between">
          <Link href="/overview" className="flex items-center gap-3 group" onClick={onClose}>
            <div className="relative w-8 h-8 transition-transform duration-300 group-hover:scale-110">
              <Image
                src="/klyra-icon.png"
                alt="Klyra"
                fill
                className="object-contain drop-shadow-[0_0_8px_rgba(192,192,192,0.3)] group-hover:drop-shadow-[0_0_12px_rgba(192,192,192,0.5)]"
              />
            </div>
            <span className="text-xl font-semibold text-white tracking-tight">
              Klyra Labs
            </span>
          </Link>
          {/* Mobile close button */}
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden p-2 -mr-2 text-text-secondary hover:text-text-primary transition-colors"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {filteredNavigation.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onClose}
              className={cn(
                "nav-item flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300",
                isActive
                  ? "bg-white/5 text-white backdrop-blur-sm"
                  : "text-text-secondary hover:text-white"
              )}
            >
              <Icon className={cn(
                "h-5 w-5 transition-all duration-300",
                isActive && "text-silver drop-shadow-[0_0_8px_rgba(192,192,192,0.5)]"
              )} />
              <span className="text-nav-item">{item.name}</span>
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-silver shadow-[0_0_8px_rgba(192,192,192,0.8)]" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* AI Status Indicator */}
      <div className="px-4 py-3 border-t border-white/5">
        <div className={cn(
          "flex items-center gap-3 px-4 py-2.5 rounded-xl",
          ollamaStatus === "running" ? "bg-status-green/10" : "bg-status-red/10"
        )}>
          {ollamaStatus === "running" ? (
            <Wifi className="h-4 w-4 text-status-green" />
          ) : (
            <WifiOff className="h-4 w-4 text-status-red" />
          )}
          <div className="flex-1 min-w-0">
            <p className={cn(
              "text-xs font-medium",
              ollamaStatus === "running" ? "text-status-green" : "text-status-red"
            )}>
              {ollamaStatus === "checking" && "Checking AI..."}
              {ollamaStatus === "running" && "AI Online"}
              {ollamaStatus === "not running" && "AI Offline"}
              {ollamaStatus === "offline" && "Server Offline"}
            </p>
          </div>
          <div className={cn(
            "w-2 h-2 rounded-full",
            ollamaStatus === "running"
              ? "bg-status-green animate-pulse shadow-[0_0_8px_rgba(0,255,136,0.5)]"
              : "bg-status-red shadow-[0_0_8px_rgba(255,68,68,0.5)]"
          )} />
        </div>
      </div>

      {/* User Profile */}
      {user && (
        <div className="p-4 border-t border-white/5">
          <div className="flex items-center gap-3 p-3 rounded-xl transition-all duration-300 hover:bg-white/5 cursor-pointer group">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-silver/20 to-navy/40 flex items-center justify-center border border-white/10 group-hover:border-white/20 transition-all">
                <span className="text-sm font-semibold text-silver">
                  {getInitials(user.name)}
                </span>
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-status-green border-2 border-black shadow-[0_0_8px_rgba(0,255,136,0.5)]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user.name}
              </p>
              <p className="text-xs text-text-muted capitalize">{user.role}</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
