"use client";

import React, { useState } from "react";
import { User, Lock, LogOut, Shield, Mail, Calendar } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { getInitials, formatDate } from "@/lib/utils";

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
    <div className="space-y-8 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-text-primary mb-2">Settings</h1>
        <p className="text-text-secondary">Manage your account and preferences</p>
      </div>

      {/* Account Overview Card */}
      <div className="glass-card rounded-2xl p-6 gradient-border">
        <div className="flex items-center gap-6">
          {/* Avatar */}
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-silver/30 to-navy/50 flex items-center justify-center border border-white/10 glow-silver">
              <span className="text-2xl font-bold text-silver glow-text">
                {getInitials(user?.name || "U")}
              </span>
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-status-green border-2 border-black shadow-[0_0_10px_rgba(0,255,136,0.5)]" />
          </div>

          {/* Info */}
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-text-primary mb-1">{user?.name}</h2>
            <div className="flex flex-wrap items-center gap-4 text-sm text-text-secondary">
              <span className="flex items-center gap-1.5">
                <Mail className="h-4 w-4 text-text-muted" />
                {user?.email}
              </span>
              <span className="flex items-center gap-1.5">
                <Shield className="h-4 w-4 text-text-muted" />
                <span className="capitalize">{user?.role}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-text-muted" />
                Joined {user?.created_at ? formatDate(user.created_at) : "recently"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Section */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="flex items-center gap-4 p-5 border-b border-white/5 bg-white/[0.02]">
          <div className="p-3 rounded-xl bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/20">
            <User className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Profile Information</h2>
            <p className="text-sm text-text-muted">Update your personal details</p>
          </div>
        </div>

        <div className="p-6">
          {profileMessage && (
            <div
              className={`p-4 mb-6 rounded-xl border ${
                profileMessage.type === "success"
                  ? "bg-status-green/10 border-status-green/30 text-status-green"
                  : "bg-status-red/10 border-status-red/30 text-status-red"
              }`}
            >
              {profileMessage.text}
            </div>
          )}

          <form onSubmit={handleProfileSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Full Name
              </label>
              <input
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                required
                className="w-full px-4 py-3 input-glass rounded-xl text-text-primary placeholder:text-text-muted focus:border-accent/50"
                placeholder="Enter your name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={profileEmail}
                onChange={(e) => setProfileEmail(e.target.value)}
                required
                className="w-full px-4 py-3 input-glass rounded-xl text-text-primary placeholder:text-text-muted focus:border-accent/50"
                placeholder="Enter your email"
              />
            </div>

            <button
              type="submit"
              disabled={profileLoading}
              className="btn-primary px-6 py-3 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {profileLoading ? "Saving..." : "Save Changes"}
            </button>
          </form>
        </div>
      </div>

      {/* Security Section */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="flex items-center gap-4 p-5 border-b border-white/5 bg-white/[0.02]">
          <div className="p-3 rounded-xl bg-gradient-to-br from-yellow-500/20 to-yellow-500/5 border border-yellow-500/20">
            <Lock className="h-5 w-5 text-yellow-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Security</h2>
            <p className="text-sm text-text-muted">Change your password</p>
          </div>
        </div>

        <div className="p-6">
          {passwordMessage && (
            <div
              className={`p-4 mb-6 rounded-xl border ${
                passwordMessage.type === "success"
                  ? "bg-status-green/10 border-status-green/30 text-status-green"
                  : "bg-status-red/10 border-status-red/30 text-status-red"
              }`}
            >
              {passwordMessage.text}
            </div>
          )}

          <form onSubmit={handlePasswordSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Current Password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="w-full px-4 py-3 input-glass rounded-xl text-text-primary placeholder:text-text-muted focus:border-accent/50"
                placeholder="Enter current password"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 input-glass rounded-xl text-text-primary placeholder:text-text-muted focus:border-accent/50"
                  placeholder="Enter new password"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 input-glass rounded-xl text-text-primary placeholder:text-text-muted focus:border-accent/50"
                  placeholder="Confirm new password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={passwordLoading}
              className="btn-primary px-6 py-3 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {passwordLoading ? "Updating..." : "Update Password"}
            </button>
          </form>
        </div>
      </div>

      {/* Logout Section */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-status-red/20 to-status-red/5 border border-status-red/20">
              <LogOut className="h-5 w-5 text-status-red" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Sign Out</h2>
              <p className="text-sm text-text-muted">Log out of your Klyra account</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="px-6 py-3 rounded-xl font-semibold border-2 border-status-red/50 text-status-red hover:bg-status-red/10 hover:border-status-red transition-all duration-300"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
