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
    <aside className="fixed left-0 top-0 h-full w-sidebar bg-sidebar-bg border-r border-card-border flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-card-border">
        <Link href="/overview" className="flex items-center gap-2 group">
          <ChevronLeft className="h-5 w-5 text-accent transition-transform group-hover:-translate-x-1" />
          <span className="text-xl font-semibold text-text-primary">
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
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-fast",
                isActive
                  ? "bg-card-bg text-text-primary border-l-2 border-accent"
                  : "text-text-secondary hover:text-text-primary hover:bg-card-bg/50"
              )}
            >
              <Icon className={cn("h-5 w-5", isActive && "text-accent")} />
              <span className="text-nav-item">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Profile */}
      {user && (
        <div className="p-4 border-t border-card-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center">
              <span className="text-sm font-semibold text-page-bg">
                {getInitials(user.name)}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">
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
