"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronLeft,
  LayoutGrid,
  MessageSquare,
  FileText,
  Users,
  Server,
  List,
  Settings,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn, getInitials } from "@/lib/utils";

const navigation = [
  { name: "Overview", href: "/overview", icon: LayoutGrid },
  { name: "Chat", href: "/chat", icon: MessageSquare },
  { name: "Documents", href: "/documents", icon: FileText },
  { name: "Users", href: "/users", icon: Users, adminOnly: true },
  { name: "System", href: "/system", icon: Server, adminOnly: true },
  { name: "Logs", href: "/logs", icon: List, adminOnly: true },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, isAdmin } = useAuth();

  const filteredNavigation = navigation.filter(
    (item) => !item.adminOnly || isAdmin
  );

  return (
    <aside className="fixed left-0 top-0 h-full w-sidebar bg-black/80 backdrop-blur-xl border-r border-white/5 flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-white/5">
        <Link href="/overview" className="flex items-center gap-2 group">
          <div className="relative">
            <ChevronLeft className="h-5 w-5 text-silver transition-all duration-300 group-hover:-translate-x-1 group-hover:text-white" />
          </div>
          <span className="text-xl font-semibold text-white tracking-tight glow-text">
            Klyra Labs
          </span>
        </Link>
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
