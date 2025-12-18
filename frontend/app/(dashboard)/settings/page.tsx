"use client";

import React, { useState } from "react";
import { User, Lock, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";

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
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <h1 className="text-page-title text-text-primary">Settings</h1>

      {/* Profile Section */}
      <div className="bg-card-bg rounded-card border border-card-border p-card-padding">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-icon-bg">
            <User className="h-5 w-5 text-text-secondary" />
          </div>
          <h2 className="text-lg font-semibold text-text-primary">Profile</h2>
        </div>

        {profileMessage && (
          <div
            className={`p-3 mb-4 rounded-lg border ${
              profileMessage.type === "success"
                ? "bg-status-green/10 border-status-green/20 text-status-green"
                : "bg-status-red/10 border-status-red/20 text-status-red"
            }`}
          >
            {profileMessage.text}
          </div>
        )}

        <form onSubmit={handleProfileSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Name
            </label>
            <input
              type="text"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              required
              className="w-full px-4 py-2.5 bg-input-bg border border-input-border rounded-lg text-text-primary placeholder:text-text-muted focus:border-accent transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Email
            </label>
            <input
              type="email"
              value={profileEmail}
              onChange={(e) => setProfileEmail(e.target.value)}
              required
              className="w-full px-4 py-2.5 bg-input-bg border border-input-border rounded-lg text-text-primary placeholder:text-text-muted focus:border-accent transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={profileLoading}
            className="px-6 py-2.5 bg-accent text-page-bg rounded-lg font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            {profileLoading ? "Saving..." : "Save Changes"}
          </button>
        </form>
      </div>

      {/* Security Section */}
      <div className="bg-card-bg rounded-card border border-card-border p-card-padding">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-icon-bg">
            <Lock className="h-5 w-5 text-text-secondary" />
          </div>
          <h2 className="text-lg font-semibold text-text-primary">Security</h2>
        </div>

        {passwordMessage && (
          <div
            className={`p-3 mb-4 rounded-lg border ${
              passwordMessage.type === "success"
                ? "bg-status-green/10 border-status-green/20 text-status-green"
                : "bg-status-red/10 border-status-red/20 text-status-red"
            }`}
          >
            {passwordMessage.text}
          </div>
        )}

        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Current Password
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="w-full px-4 py-2.5 bg-input-bg border border-input-border rounded-lg text-text-primary placeholder:text-text-muted focus:border-accent transition-colors"
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
              className="w-full px-4 py-2.5 bg-input-bg border border-input-border rounded-lg text-text-primary placeholder:text-text-muted focus:border-accent transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full px-4 py-2.5 bg-input-bg border border-input-border rounded-lg text-text-primary placeholder:text-text-muted focus:border-accent transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={passwordLoading}
            className="px-6 py-2.5 bg-accent text-page-bg rounded-lg font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            {passwordLoading ? "Changing..." : "Change Password"}
          </button>
        </form>
      </div>

      {/* Logout Section */}
      <div className="bg-card-bg rounded-card border border-card-border p-card-padding">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-icon-bg">
              <LogOut className="h-5 w-5 text-text-secondary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Logout</h2>
              <p className="text-sm text-text-secondary">
                Sign out of your account
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="px-6 py-2.5 border border-status-red text-status-red rounded-lg font-medium hover:bg-status-red/10 transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
