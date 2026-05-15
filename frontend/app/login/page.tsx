"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/lib/api";
import { setAuthTokens } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/login/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        let message = "Invalid credentials";
        try {
          const errorData = await response.json();
          message =
            errorData?.error?.message ||
            errorData?.detail ||
            errorData?.message ||
            message;
        } catch {
          // Keep the generic message when the response body is not JSON.
        }
        throw new Error(message);
      }

      const data = (await response.json()) as { access: string; refresh: string };
      setAuthTokens(data.access, data.refresh);

      // Check if user must change password on first login
      try {
        const meRes = await fetch(`${API_BASE_URL}/api/v1/auth/me/`, {
          headers: { Authorization: `Bearer ${data.access}` },
        });
        if (meRes.ok) {
          const me = (await meRes.json()) as { must_change_password?: boolean };
          if (me.must_change_password) {
            router.push('/change-password');
            return;
          }
        }
      } catch { /* non-blocking, fall through to /home */ }

      router.push("/home");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed. Verify credentials and backend availability.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "linear-gradient(180deg, #f9fbff 0%, #f3f6fb 100%)",
        padding: 16,
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 420,
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius)",
          padding: 20,
        }}
      >
        <h1 style={{ marginTop: 0, marginBottom: 6, fontSize: 24 }}>Sign in</h1>
        <p style={{ marginTop: 0, marginBottom: 16, color: "var(--text-muted)" }}>
          Use username, email, or phone with your school ERP password.
        </p>

        <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Username / Email / Phone"
            style={{ height: 40, borderRadius: 8, border: "1px solid var(--line)", padding: "0 10px" }}
          />
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            type="password"
            style={{ height: 40, borderRadius: 8, border: "1px solid var(--line)", padding: "0 10px" }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              height: 40,
              border: "1px solid var(--primary)",
              background: "var(--primary)",
              color: "#fff",
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        {error && <div style={{ marginTop: 12, color: "var(--danger)", fontSize: 14 }}>{error}</div>}
      </section>
    </main>
  );
}
