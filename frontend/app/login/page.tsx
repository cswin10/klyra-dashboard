"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Mail, Lock, AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push("/overview");
    }
  }, [isAuthenticated, isLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign in");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-silver"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 bg-black relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-navy/20 via-transparent to-transparent" />
      <div className="absolute top-1/4 -left-32 w-64 h-64 bg-navy/30 rounded-full blur-[100px]" />
      <div className="absolute bottom-1/4 -right-32 w-64 h-64 bg-silver/10 rounded-full blur-[100px]" />

      {/* Login Card */}
      <div className="w-full max-w-md relative z-10">
        <div className="glass-card rounded-2xl p-8 relative overflow-hidden">
          {/* Top gradient line */}
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-silver/30 to-transparent" />

          {/* Logo */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <ChevronLeft className="h-6 w-6 text-silver" />
            <span className="text-2xl font-semibold text-white glow-text tracking-tight">
              Klyra Labs
            </span>
          </div>

          {/* Welcome Text */}
          <div className="text-center mb-8">
            <h1 className="text-xl font-semibold text-white mb-2">
              Welcome back
            </h1>
            <p className="text-sm text-text-secondary">
              Sign in to your account to continue
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 p-3 mb-6 bg-status-red/10 border border-status-red/20 rounded-xl backdrop-blur-sm">
              <AlertCircle className="h-4 w-4 text-status-red flex-shrink-0" />
              <p className="text-sm text-status-red">{error}</p>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-text-secondary mb-2"
              >
                Email
              </label>
              <div className="relative group">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-muted group-focus-within:text-silver transition-colors" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@klyra.io"
                  required
                  autoComplete="email"
                  className="w-full pl-10 pr-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder:text-text-muted focus:border-silver/40 focus:shadow-[0_0_15px_rgba(192,192,192,0.15)] transition-all duration-300 backdrop-blur-sm"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-text-secondary mb-2"
              >
                Password
              </label>
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-muted group-focus-within:text-silver transition-colors" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                  className="w-full pl-10 pr-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder:text-text-muted focus:border-silver/40 focus:shadow-[0_0_15px_rgba(192,192,192,0.15)] transition-all duration-300 backdrop-blur-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 mt-6 bg-gradient-to-r from-silver to-silver/80 text-black font-semibold rounded-xl hover:from-white hover:to-silver transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(192,192,192,0.2)] hover:shadow-[0_0_30px_rgba(192,192,192,0.4)]"
            >
              {isSubmitting ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black"></div>
                  <span>Signing in...</span>
                </div>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          {/* Bottom gradient line */}
          <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-navy/30 to-transparent" />
        </div>

        {/* Footer */}
        <p className="text-center text-text-muted text-sm mt-8">
          Powered by <span className="text-silver">Klyra Labs</span>
        </p>
      </div>
    </div>
  );
}
