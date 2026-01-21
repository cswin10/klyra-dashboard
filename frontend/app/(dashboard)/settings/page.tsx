"use client";

import React, { useState } from "react";
import { User, Lock, LogOut, Shield, Mail, Calendar } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { getInitials, formatDate, cn } from "@/lib/utils";

export default function SettingsPage() {
  const { user, refreshUser, logout } = useAuth();

  // Profile form state
  const [profileName, setProfileName] = useState(user?.name || "");
  const [profileEmail, setProfileEmail] = useState(user?.email || "");
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Password form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileMessage(null);

    try {
      await api.updateProfile({ name: profileName, email: profileEmail });
      await refreshUser();
      setProfileMessage({ type: "success", text: "Profile updated successfully" });
    } catch (err) {
      setProfileMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to update profile",
      });
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordLoading(true);
    setPasswordMessage(null);

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: "error", text: "Passwords do not match" });
      setPasswordLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      setPasswordMessage({
        type: "error",
        text: "Password must be at least 6 characters",
      });
      setPasswordLoading(false);
      return;
    }

    try {
      await api.changePassword(currentPassword, newPassword);
      setPasswordMessage({ type: "success", text: "Password changed successfully" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPasswordMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to change password",
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleLogout = async () => {
    if (confirm("Are you sure you want to log out?")) {
      await logout();
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-page-title text-text-primary">Settings</h1>
        <p className="text-text-muted text-sm mt-1">Manage your account and preferences</p>
      </div>

      {/* Account Overview Card */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-6">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-gradient-to-br from-accent/30 to-accent/10 flex items-center justify-center border border-accent/20">
              <span className="text-xl sm:text-2xl font-bold text-accent">
                {getInitials(user?.name || "U")}
              </span>
            </div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-status-green border-2 border-page-bg" />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h2 className="text-lg sm:text-xl font-semibold text-text-primary mb-2 truncate">{user?.name}</h2>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-secondary">
              <span className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-text-muted" />
                <span className="truncate">{user?.email}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-text-muted" />
                <span className={cn(
                  "capitalize px-2 py-0.5 rounded text-xs font-medium",
                  user?.role === "admin" ? "bg-accent/10 text-accent" : "bg-card-bg text-text-secondary"
                )}>{user?.role}</span>
              </span>
              <span className="flex items-center gap-1.5 text-text-muted">
                <Calendar className="h-3.5 w-3.5" />
                Joined {user?.created_at ? formatDate(user.created_at) : "recently"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Section */}
      <div className="glass-card overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b border-card-border bg-card-bg/50">
          <div className="p-2 rounded-lg bg-accent/10">
            <User className="h-4 w-4 text-accent" />
          </div>
          <div>
            <h2 className="font-semibold text-text-primary">Profile Information</h2>
            <p className="text-xs text-text-muted">Update your personal details</p>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          {profileMessage && (
            <div
              className={cn(
                "p-3 mb-4 rounded-lg border text-sm",
                profileMessage.type === "success"
                  ? "bg-status-green/10 border-status-green/20 text-status-green"
                  : "bg-status-red/10 border-status-red/20 text-status-red"
              )}
            >
              {profileMessage.text}
            </div>
          )}

          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                required
                className="w-full px-3 py-2.5 bg-card-bg border border-card-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-colors"
                placeholder="Enter your name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                value={profileEmail}
                onChange={(e) => setProfileEmail(e.target.value)}
                required
                className="w-full px-3 py-2.5 bg-card-bg border border-card-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-colors"
                placeholder="Enter your email"
              />
            </div>

            <button
              type="submit"
              disabled={profileLoading}
              className="px-5 py-2.5 bg-accent text-page-bg rounded-lg font-medium hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {profileLoading ? "Saving..." : "Save Changes"}
            </button>
          </form>
        </div>
      </div>

      {/* Security Section */}
      <div className="glass-card overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b border-card-border bg-card-bg/50">
          <div className="p-2 rounded-lg bg-status-yellow/10">
            <Lock className="h-4 w-4 text-status-yellow" />
          </div>
          <div>
            <h2 className="font-semibold text-text-primary">Security</h2>
            <p className="text-xs text-text-muted">Change your password</p>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          {passwordMessage && (
            <div
              className={cn(
                "p-3 mb-4 rounded-lg border text-sm",
                passwordMessage.type === "success"
                  ? "bg-status-green/10 border-status-green/20 text-status-green"
                  : "bg-status-red/10 border-status-red/20 text-status-red"
              )}
            >
              {passwordMessage.text}
            </div>
          )}

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">
                Current Password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="w-full px-3 py-2.5 bg-card-bg border border-card-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-colors"
                placeholder="Enter current password"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 bg-card-bg border border-card-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-colors"
                  placeholder="Enter new password"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 bg-card-bg border border-card-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-colors"
                  placeholder="Confirm new password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={passwordLoading}
              className="px-5 py-2.5 bg-accent text-page-bg rounded-lg font-medium hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {passwordLoading ? "Updating..." : "Update Password"}
            </button>
          </form>
        </div>
      </div>

      {/* Logout Section */}
      <div className="glass-card overflow-hidden">
        <div className="flex items-center justify-between p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-status-red/10">
              <LogOut className="h-4 w-4 text-status-red" />
            </div>
            <div>
              <h2 className="font-semibold text-text-primary">Sign Out</h2>
              <p className="text-xs text-text-muted">Log out of your account</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded-lg font-medium border border-status-red/30 text-status-red hover:bg-status-red/10 hover:border-status-red/50 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
