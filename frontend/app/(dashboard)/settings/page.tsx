"use client";

import React, { useState } from "react";
import { User, Lock, LogOut, Shield, Mail, Calendar, Settings as SettingsIcon, Bell, Palette } from "lucide-react";
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
    <div className="space-y-8">
      {/* Header with Account Overview */}
      <div className="glass-card p-6 lg:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="w-20 h-20 lg:w-24 lg:h-24 rounded-2xl bg-gradient-to-br from-accent/40 to-accent/10 flex items-center justify-center border border-accent/30 shadow-lg shadow-accent/10">
              <span className="text-2xl lg:text-3xl font-bold text-accent">
                {getInitials(user?.name || "U")}
              </span>
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-status-green border-3 border-page-bg shadow-sm" />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-text-primary">{user?.name}</h1>
                <div className="flex flex-wrap items-center gap-3 mt-3">
                  <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card-bg border border-card-border text-sm text-text-secondary">
                    <Mail className="h-4 w-4 text-accent" />
                    {user?.email}
                  </span>
                  <span className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium capitalize",
                    user?.role === "admin"
                      ? "bg-accent/10 text-accent border border-accent/20"
                      : "bg-card-bg text-text-secondary border border-card-border"
                  )}>
                    <Shield className="h-4 w-4" />
                    {user?.role}
                  </span>
                  <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card-bg border border-card-border text-sm text-text-muted">
                    <Calendar className="h-4 w-4" />
                    Joined {user?.created_at ? formatDate(user.created_at) : "recently"}
                  </span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium border border-status-red/30 text-status-red hover:bg-status-red/10 hover:border-status-red/50 transition-all duration-200 self-start"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile Section */}
        <div className="glass-card overflow-hidden">
          <div className="flex items-center gap-3 p-5 border-b border-card-border bg-gradient-to-r from-accent/5 to-transparent">
            <div className="p-2.5 rounded-xl bg-accent/10 border border-accent/20">
              <User className="h-5 w-5 text-accent" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Profile Information</h2>
              <p className="text-sm text-text-muted">Update your personal details</p>
            </div>
          </div>

          <div className="p-5 lg:p-6">
            {profileMessage && (
              <div
                className={cn(
                  "p-3 mb-5 rounded-lg border text-sm flex items-center gap-2",
                  profileMessage.type === "success"
                    ? "bg-status-green/10 border-status-green/20 text-status-green"
                    : "bg-status-red/10 border-status-red/20 text-status-red"
                )}
              >
                {profileMessage.text}
              </div>
            )}

            <form onSubmit={handleProfileSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-page-bg border border-card-border rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-all duration-200"
                  placeholder="Enter your name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={profileEmail}
                  onChange={(e) => setProfileEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-page-bg border border-card-border rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-all duration-200"
                  placeholder="Enter your email"
                />
              </div>

              <button
                type="submit"
                disabled={profileLoading}
                className="w-full px-5 py-3 bg-accent text-page-bg rounded-xl font-medium hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-accent/20 hover:shadow-accent/30"
              >
                {profileLoading ? "Saving..." : "Save Changes"}
              </button>
            </form>
          </div>
        </div>

        {/* Security Section */}
        <div className="glass-card overflow-hidden">
          <div className="flex items-center gap-3 p-5 border-b border-card-border bg-gradient-to-r from-status-yellow/5 to-transparent">
            <div className="p-2.5 rounded-xl bg-status-yellow/10 border border-status-yellow/20">
              <Lock className="h-5 w-5 text-status-yellow" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Security</h2>
              <p className="text-sm text-text-muted">Change your password</p>
            </div>
          </div>

          <div className="p-5 lg:p-6">
            {passwordMessage && (
              <div
                className={cn(
                  "p-3 mb-5 rounded-lg border text-sm flex items-center gap-2",
                  passwordMessage.type === "success"
                    ? "bg-status-green/10 border-status-green/20 text-status-green"
                    : "bg-status-red/10 border-status-red/20 text-status-red"
                )}
              >
                {passwordMessage.text}
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Current Password
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-page-bg border border-card-border rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-all duration-200"
                  placeholder="Enter current password"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-page-bg border border-card-border rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-all duration-200"
                  placeholder="Enter new password"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-page-bg border border-card-border rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-all duration-200"
                  placeholder="Confirm new password"
                />
              </div>

              <button
                type="submit"
                disabled={passwordLoading}
                className="w-full px-5 py-3 bg-accent text-page-bg rounded-xl font-medium hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-accent/20 hover:shadow-accent/30"
              >
                {passwordLoading ? "Updating..." : "Update Password"}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Additional Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Preferences Card */}
        <div className="glass-card p-5 lg:p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-xl bg-accent/10 border border-accent/20">
              <SettingsIcon className="h-5 w-5 text-accent" />
            </div>
            <div>
              <h3 className="font-semibold text-text-primary">Preferences</h3>
              <p className="text-xs text-text-muted">App settings</p>
            </div>
          </div>
          <p className="text-sm text-text-secondary">
            Customize your Klyra experience with personalized settings and preferences.
          </p>
          <div className="mt-4 pt-4 border-t border-card-border">
            <span className="text-xs text-text-muted">Coming soon</span>
          </div>
        </div>

        {/* Notifications Card */}
        <div className="glass-card p-5 lg:p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-xl bg-status-green/10 border border-status-green/20">
              <Bell className="h-5 w-5 text-status-green" />
            </div>
            <div>
              <h3 className="font-semibold text-text-primary">Notifications</h3>
              <p className="text-xs text-text-muted">Alert settings</p>
            </div>
          </div>
          <p className="text-sm text-text-secondary">
            Manage how and when you receive notifications and updates.
          </p>
          <div className="mt-4 pt-4 border-t border-card-border">
            <span className="text-xs text-text-muted">Coming soon</span>
          </div>
        </div>

        {/* Appearance Card */}
        <div className="glass-card p-5 lg:p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20">
              <Palette className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <h3 className="font-semibold text-text-primary">Appearance</h3>
              <p className="text-xs text-text-muted">Theme options</p>
            </div>
          </div>
          <p className="text-sm text-text-secondary">
            Choose your preferred theme and visual settings for the interface.
          </p>
          <div className="mt-4 pt-4 border-t border-card-border">
            <span className="text-xs text-text-muted">Coming soon</span>
          </div>
        </div>
      </div>
    </div>
  );
}
