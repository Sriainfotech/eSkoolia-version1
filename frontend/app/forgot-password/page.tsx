"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthProvider, apiForgotPassword } from "@/lib/auth-context";

// ─── Constants ────────────────────────────────────────────────────────────────

const SCHOOL_NAME = process.env.NEXT_PUBLIC_SCHOOL_NAME ?? "eSkoolia";

const ESKOOLIA_LOGO =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBMkE47tearngJgRuiZoTvnI_40bttDEPwdQy6orbI-d0rXKaVxcGyFLvUo-FJJyRnx4G1VlTYeFcbUnSHhPmM88oda_5SN99u6dkF56FAmJ6XuisV_O0H5Y7KbqUJ5u-HEnd0KQTdRPqrZpOELy1r9IAMq9TB7344-04IjSwbCiFIHwf2dWiJ4JhWHnED6-NSzU8ixZeE2Lcez08_SZEwC1wPQRS8wbuIvQSI2-Xqruig2KaO4XKkEguCFLF7oSWdFZq1mr6RHM30";

const RECOVERY_IMAGE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCX6Cr2E0KWnc6ky1i4cIZ53q1vjniOS0c1IRe9xSGIVRkZUeuopkc_-MUdgIRLKHmcKJVG2ZyjbjmEGGsM7jcs18fnD8BARdt4IWkkXfbRHsRezqKyiRu1gVGZi7yuUhWWKKj4DnGjopRYZxlSJI2-X6yFaTfHG1clZp5Fu_5EC2dgZJv-yESQ5uFGmTjXtyEDNXO-Q-y_GX2hQjCVeTkX7nRaxsZGd3Jb8wULk7b-2TBdn0Zz0z5oyXYyUPTftsiBm0cLvvOBY0Q";

// ─── Root export ──────────────────────────────────────────────────────────────

export default function ForgotPasswordPageWrapper() {
  return (
    <AuthProvider>
      <ForgotPasswordPage />
    </AuthProvider>
  );
}

// ─── Inner page ───────────────────────────────────────────────────────────────

function ForgotPasswordPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setError("Please enter your institutional email address.");
      return;
    }

    setSubmitting(true);
    try {
      await apiForgotPassword(trimmed);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send recovery email. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-flow-shell">
      {/* Ambient background blobs */}
      <div className="flow-aura flow-aura-teal" />
      <div className="flow-aura flow-aura-purple" />

      {/* Compact header */}
      <header className="compact-header">
        <div className="compact-header-inner">
          <div className="compact-brand">
            <strong>
              {SCHOOL_NAME} <span>School</span>
            </strong>
            <i />
            <small>Account Recovery</small>
          </div>
          <div className="compact-status">
            <div className="compact-pill">
              <span className="material-symbols-outlined">lock_reset</span>
              <i />
              <b>Password Reset</b>
            </div>
            <div className="compact-powered">
              <span>Powered by</span>
              <img alt="eSkoolia" src={ESKOOLIA_LOGO} />
            </div>
          </div>
        </div>
      </header>

      {/* Main split layout */}
      <div className="recovery-layout">
        {/* Left: visual / hero */}
        <div className="recovery-visual">
          <img alt="Account recovery" src={RECOVERY_IMAGE} />
          <div className="recovery-visual-scrim" />
          <div className="recovery-copy">
            <div className="mini-badge">
              <span className="material-symbols-outlined">support_agent</span>
              <span>Institutional Support</span>
            </div>
            <span className="flow-eyebrow">Account Recovery</span>
            <h1>
              Recover Your <em>Digital Identity</em>
            </h1>
            <p>
              Don&apos;t worry — it happens to the best of us. Enter the email address
              linked to your institutional profile and we&apos;ll send you a secure
              recovery link.
            </p>
          </div>
        </div>

        {/* Right: form panel */}
        <div className="recovery-form-panel">
          <div className="typo-bleed">RESET</div>

          <div className="flow-form-card">
            <div className="form-rule" />
            <h2>
              <span>Recover</span>
              <em>Access</em>
            </h2>
            <p>
              Enter your institutional email and we&apos;ll send a password reset link
              to your inbox.
            </p>

            {sent ? (
              <div
                style={{
                  background: "rgba(0, 104, 95, 0.06)",
                  border: "1px solid rgba(0, 104, 95, 0.2)",
                  borderRadius: 16,
                  padding: "32px 24px",
                  textAlign: "center",
                }}
              >
                <span
                  className="material-symbols-outlined filled"
                  style={{
                    color: "#006a61",
                    fontSize: 56,
                    marginBottom: 16,
                    display: "block",
                  }}
                >
                  mark_email_read
                </span>
                <p
                  style={{
                    color: "#312e81",
                    fontWeight: 800,
                    fontSize: 20,
                    margin: "0 0 12px",
                  }}
                >
                  Check your inbox
                </p>
                <p style={{ color: "#3d4947", margin: "0 0 24px", lineHeight: 1.6 }}>
                  We&apos;ve sent a 6-digit reset code to{" "}
                  <strong>{email}</strong>. Enter the code on the next screen to set a new password.
                </p>
                <button
                  type="button"
                  className="primary-flow-button"
                  onClick={() => router.push(`/reset-password?email=${encodeURIComponent(email)}`)}
                >
                  Enter Reset Code
                  <span className="material-symbols-outlined">arrow_forward</span>
                </button>
              </div>
            ) : (
              <form className="editorial-form" onSubmit={handleSubmit} noValidate>
                <label>
                  <span>Institutional Email Address</span>
                  <div>
                    <span className="material-symbols-outlined">alternate_email</span>
                    <input
                      type="email"
                      placeholder="your.name@school.edu.in"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      autoFocus
                    />
                  </div>
                </label>

                {error && (
                  <p className="form-error" role="alert">
                    {error}
                  </p>
                )}

                <button type="submit" disabled={submitting}>
                  {submitting ? "Sending…" : "Send Recovery Link"}
                  <span className="material-symbols-outlined">
                    {submitting ? "hourglass_top" : "send"}
                  </span>
                </button>
              </form>
            )}

            <button
              type="button"
              className="return-button"
              style={{ marginTop: 32 }}
              onClick={() => router.push("/login")}
            >
              <span className="material-symbols-outlined">arrow_back</span>
              Back to Digital Atrium
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="compact-footer">
        <p>
          © 2024 <strong>{SCHOOL_NAME} Institutional Node</strong>.{" "}
          <span>eSkoolia Infrastructure</span>
        </p>
        <nav>
          <a href="#">Privacy</a>
          <i />
          <a href="#">Terms</a>
          <i />
          <a href="#">
            Support <span className="material-symbols-outlined">support_agent</span>
          </a>
        </nav>
      </footer>
    </div>
  );
}
