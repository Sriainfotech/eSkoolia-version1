"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { clearAuthTokens } from "@/lib/auth";

/**
 * Platform-admin login — deliberately separate from the regular /login page
 * school staff/parents/students use. Same underlying account system
 * (is_superuser on the Django User model), but its own URL and its own form,
 * so platform admins never see or use the same login screen as school users.
 */
export default function SuperAdminLoginPage() {
  return (
    <AuthProvider>
      <LoginForm />
    </AuthProvider>
  );
}

function LoginForm() {
  const router = useRouter();
  const { login, isLoading } = useAuth();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!identifier.trim() || !password) {
      setError("Enter both a username/email and a password.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await login(identifier.trim(), password);
      if (!result.is_super_admin) {
        clearAuthTokens();
        setError("This account doesn't have platform administrator access.");
        return;
      }
      router.push("/super-admin/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0B0B14",
        padding: 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32, justifyContent: "center" }}>
          <img src="/image1.png" alt="" style={{ width: 32, height: 32, borderRadius: 8, objectFit: "contain" }} />
          <span style={{ fontWeight: 700, fontSize: 17, color: "#fff", letterSpacing: "-0.02em" }}>School ERP</span>
          <span
            style={{
              fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
              color: "#C4B5FD", background: "rgba(124,58,237,0.25)",
              padding: "3px 7px", borderRadius: 4,
            }}
          >
            SUPER
          </span>
        </div>

        <div
          style={{
            background: "#15151F",
            border: "1px solid #26263A",
            borderRadius: 14,
            padding: "32px 28px",
          }}
        >
          <h1 style={{ fontSize: 18, fontWeight: 600, color: "#fff", margin: "0 0 4px" }}>
            Platform administrator sign-in
          </h1>
          <p style={{ fontSize: 13, color: "#8B8BA3", margin: "0 0 24px" }}>
            Manage schools, billing, and platform-wide settings.
          </p>

          <form onSubmit={handleSubmit} noValidate>
            <label style={{ display: "block", marginBottom: 16 }}>
              <span style={{ display: "block", fontSize: 12, color: "#B4B4C9", marginBottom: 6 }}>
                Username or email
              </span>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
                autoFocus
                style={inputStyle}
              />
            </label>

            <label style={{ display: "block", marginBottom: 8 }}>
              <span style={{ display: "block", fontSize: 12, color: "#B4B4C9", marginBottom: 6 }}>
                Password
              </span>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  style={{ ...inputStyle, paddingRight: 40 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  style={{
                    position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", color: "#8B8BA3", cursor: "pointer", fontSize: 12,
                  }}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </label>

            {error && (
              <p style={{ color: "#F87171", fontSize: 13, margin: "12px 0 0" }} role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting || isLoading}
              style={{
                width: "100%", marginTop: 20, height: 42, borderRadius: 8, border: "none",
                background: "#7C3AED", color: "#fff", fontSize: 14, fontWeight: 600,
                cursor: submitting ? "default" : "pointer", opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        <p style={{ textAlign: "center", fontSize: 12, color: "#5C5C74", marginTop: 20 }}>
          Looking for your school instead?{" "}
          <a href="https://eskoolia.com" style={{ color: "#8B8BA3" }}>
            Go to eskoolia.com
          </a>
        </p>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 40,
  borderRadius: 8,
  border: "1px solid #2E2E44",
  background: "#0F0F18",
  color: "#fff",
  fontSize: 14,
  padding: "0 12px",
  outline: "none",
  boxSizing: "border-box",
};
