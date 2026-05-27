"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/lib/auth-context";

// ─── Constants ────────────────────────────────────────────────────────────────

const SCHOOL_NAME = process.env.NEXT_PUBLIC_SCHOOL_NAME ?? "eSkoolia";

const ESKOOLIA_LOGO =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBMkE47tearngJgRuiZoTvnI_40bttDEPwdQy6orbI-d0rXKaVxcGyFLvUo-FJJyRnx4G1VlTYeFcbUnSHhPmM88oda_5SN99u6dkF56FAmJ6XuisV_O0H5Y7KbqUJ5u-HEnd0KQTdRPqrZpOELy1r9IAMq9TB7344-04IjSwbCiFIHwf2dWiJ4JhWHnED6-NSzU8ixZeE2Lcez08_SZEwC1wPQRS8wbuIvQSI2-Xqruig2KaO4XKkEguCFLF7oSWdFZq1mr6RHM30";

const ACTIVATION_IMAGE =
  "https://lh3.googleusercontent.com/aida/ADBb0uhNqdsVkO5hg7b6G-tLd4rpFSoRDA9YGi-uEw2tf29v31H7nT1Fdw9h6B1gGxwXOt4HF50yRIj0D2rJ4p6qdnslFHrVZevqZzbnHh5H8dco2Vmk-0DJwnSttujsegaWuic7VaR26g2paki9EymrKfh02wFX_jlZS65D-wic4n9iHr0Tx9Q0pZ4A6zwsQqm0mnM5tNkAwRW5t7baDMiry8XJRv0AjmFXiAtukjRmrpDXi39zz-pyCjuaPw";

// ─── Root export ──────────────────────────────────────────────────────────────

export default function ChangePasswordPageWrapper() {
  return (
    <AuthProvider>
      <ChangePasswordPage />
    </AuthProvider>
  );
}

// ─── Password strength helper ─────────────────────────────────────────────────

function getStrength(pw: string): number {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score;
}

const STRENGTH_LABELS = ["", "Weak", "Fair", "Strong", "Secure"];
const STRENGTH_COLORS = ["", "#dc2626", "#f59e0b", "#22c55e", "#006a61"];

// ─── Inner page ───────────────────────────────────────────────────────────────

function ChangePasswordPage() {
  const router = useRouter();
  const { user, isLoading, isAuthenticated, changePassword } = useAuth();

  const [tempPassword, setTempPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showTemp, setShowTemp] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // If not authenticated after loading, send to login.
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  // If user has already set a password, redirect to home.
  useEffect(() => {
    if (!isLoading && isAuthenticated && user && !user.must_change_password) {
      router.replace("/home");
    }
  }, [isLoading, isAuthenticated, user, router]);

  const strength = useMemo(() => getStrength(newPassword), [newPassword]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!tempPassword) {
      setError("Please enter your temporary password.");
      return;
    }
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword === tempPassword) {
      setError("New password must be different from your current password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      // Pass old password to backend — it verifies it with check_password() before changing.
      await changePassword(tempPassword, newPassword);
      setSuccess(true);
      setTimeout(() => router.replace("/home"), 1600);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update password. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="activation-shell">
      {/* Compact floating header */}
      <header className="compact-header">
        <div className="compact-header-inner">
          <div className="compact-brand">
            <strong>
              {SCHOOL_NAME} <span>School</span>
            </strong>
            <i />
            <small>Secure Activation</small>
          </div>
          <div className="compact-status">
            <div className="compact-pill">
              <span className="material-symbols-outlined">lock_person</span>
              <i />
              <b>First Login</b>
            </div>
            <div className="compact-powered">
              <span>Powered by</span>
              <img alt="eSkoolia" src={ESKOOLIA_LOGO} />
            </div>
          </div>
        </div>
      </header>

      <div className="activation-main">
        <div className="activation-card">
          {/* Left: visual panel */}
          <div className="activation-visual">
            <img alt="Activation" src={ACTIVATION_IMAGE} />
            <div className="activation-scrim" />
            <div className="activation-glass">
              <h1>
                Activate Your <em>Digital Identity</em>
              </h1>
              <p>
                Your institutional profile has been created. Set a secure password to
                unlock your full access to the {SCHOOL_NAME} Digital Atrium.
              </p>
              <div className="step-dots">
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>

          {/* Right: form panel */}
          <div className="activation-form-panel">
            <div className="flow-form-card">
              <div className="form-rule" />
              <h2>
                <span>Set Your</span>
                <em>Access Key</em>
              </h2>
              <p>
                Create a strong, memorable password to secure your institutional
                account and protect your academic data.
              </p>

              {success ? (
                <div
                  style={{
                    background: "rgba(0, 104, 95, 0.08)",
                    border: "1px solid rgba(0, 104, 95, 0.2)",
                    borderRadius: 16,
                    padding: "24px",
                    textAlign: "center",
                  }}
                >
                  <span
                    className="material-symbols-outlined filled"
                    style={{ color: "#006a61", fontSize: 48, marginBottom: 12, display: "block" }}
                  >
                    check_circle
                  </span>
                  <p
                    style={{
                      color: "#006a61",
                      fontWeight: 800,
                      fontSize: 18,
                      margin: "0 0 8px",
                    }}
                  >
                    Access key activated!
                  </p>
                  <p style={{ color: "#3d4947", margin: 0 }}>
                    Redirecting you to the dashboard…
                  </p>
                </div>
              ) : (
                <form className="activation-form" onSubmit={handleSubmit} noValidate>
                  {/* Temporary password */}
                  <div className="activation-field">
                    <span>Temporary Password</span>
                    <div>
                      <span className="material-symbols-outlined">key</span>
                      <input
                        type={showTemp ? "text" : "password"}
                        placeholder="Enter your temporary password"
                        value={tempPassword}
                        onChange={(e) => setTempPassword(e.target.value)}
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        aria-label={showTemp ? "Hide password" : "Show password"}
                        onClick={() => setShowTemp((v) => !v)}
                      >
                        <span className="material-symbols-outlined">
                          {showTemp ? "visibility_off" : "visibility"}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* New password */}
                  <div className="activation-field">
                    <span>New Password</span>
                    <div>
                      <span className="material-symbols-outlined">lock</span>
                      <input
                        type={showNew ? "text" : "password"}
                        placeholder="Create a strong password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        aria-label={showNew ? "Hide password" : "Show password"}
                        onClick={() => setShowNew((v) => !v)}
                      >
                        <span className="material-symbols-outlined">
                          {showNew ? "visibility_off" : "visibility"}
                        </span>
                      </button>
                    </div>
                    {newPassword && (
                      <div className="activation-meter">
                        <div>
                          {[1, 2, 3, 4].map((level) => (
                            <span
                              key={level}
                              className={strength >= level ? "active" : ""}
                              style={strength >= level ? { background: STRENGTH_COLORS[strength] } : {}}
                            />
                          ))}
                        </div>
                        <p>
                          <strong style={{ color: STRENGTH_COLORS[strength] }}>
                            {STRENGTH_LABELS[strength]}
                          </strong>
                          <span>Min 8 chars, mixed case, numbers & symbols</span>
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Confirm password */}
                  <div className="activation-field">
                    <span>Confirm Password</span>
                    <div>
                      <span className="material-symbols-outlined">lock_reset</span>
                      <input
                        type={showConfirm ? "text" : "password"}
                        placeholder="Re-enter your new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        aria-label={showConfirm ? "Hide password" : "Show password"}
                        onClick={() => setShowConfirm((v) => !v)}
                      >
                        <span className="material-symbols-outlined">
                          {showConfirm ? "visibility_off" : "visibility"}
                        </span>
                      </button>
                    </div>
                  </div>

                  {error && (
                    <p className="form-error" role="alert">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    className="primary-flow-button"
                    disabled={submitting}
                  >
                    {submitting ? "Activating…" : "Activate My Access Key"}
                    <span className="material-symbols-outlined">
                      {submitting ? "hourglass_top" : "arrow_forward"}
                    </span>
                  </button>
                </form>
              )}

              <div className="compact-security" style={{ marginTop: 32 }}>
                <div>
                  <span className="material-symbols-outlined filled">shield_person</span>
                </div>
                <div>
                  <p>End-to-End Encrypted</p>
                  <span>Your password is hashed and never stored in plain text.</span>
                </div>
              </div>
            </div>
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
