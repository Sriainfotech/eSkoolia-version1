"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthProvider, apiForgotPassword, apiResetPassword, apiVerifyResetCode } from "@/lib/auth-context";

// â”€â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const SCHOOL_NAME = process.env.NEXT_PUBLIC_SCHOOL_NAME ?? "eSkoolia";

const ESKOOLIA_LOGO =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBMkE47tearngJgRuiZoTvnI_40bttDEPwdQy6orbI-d0rXKaVxcGyFLvUo-FJJyRnx4G1VlTYeFcbUnSHhPmM88oda_5SN99u6dkF56FAmJ6XuisV_O0H5Y7KbqUJ5u-HEnd0KQTdRPqrZpOELy1r9IAMq9TB7344-04IjSwbCiFIHwf2dWiJ4JhWHnED6-NSzU8ixZeE2Lcez08_SZEwC1wPQRS8wbuIvQSI2-Xqruig2KaO4XKkEguCFLF7oSWdFZq1mr6RHM30";

const ATRIUM_IMAGE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDqx1Y0SKCz99hTU92XCkXI-9ONCnfIdPjXXtppIdzo96nr4-4YqyQlBpVeyItDhC3LtQI9DNFl3gjdAFKw8qAa8nhawv5Z80NXrYCe2H4SI6RtDcmhdVHavnqmEq78eOztQePmFdYTLnq3p_mjWGXGStOoZAcLF-St_0J8KPPe6rJNlE_BVjbpuxAghVLrp_4K81zaScaGr84I955o_v2ZgJGjs8zlRn54U-Yx27JNJT7OWK4n7lXrNHs3YHJysBmDu6NCCYKdLOc";

// â”€â”€â”€ Password strength helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Root export â€” must wrap Suspense here for useSearchParams â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function ResetPasswordPageWrapper() {
  return (
    <AuthProvider>
      <Suspense fallback={<div className="reset-shell" />}>
        <ResetPasswordPage />
      </Suspense>
    </AuthProvider>
  );
}

// â”€â”€â”€ Inner page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailFromQuery = searchParams.get("email") ?? "";

  // Two steps: "code" â†’ verify OTP first, "password" â†’ set new password
  const [step, setStep] = useState<"code" | "password">("code");

  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [resendCooldown, setResendCooldown] = useState(60);
  const [resendStatus, setResendStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [resending, setResending] = useState(false);

  // Countdown timer — starts at 60s (code was just sent)
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleResend = async () => {
    if (resendCooldown > 0 || resending || !emailFromQuery) return;
    setResending(true);
    setResendStatus(null);
    try {
      await apiForgotPassword(emailFromQuery);
      setResendStatus({ type: "success", msg: `A new code was sent to ${emailFromQuery}.` });
      setResendCooldown(60);
      setCode("");   // clear stale code
      setError(null);
    } catch (err) {
      setResendStatus({
        type: "error",
        msg: err instanceof Error ? err.message : "Failed to resend. Please try again.",
      });
    } finally {
      setResending(false);
    }
  };

  const strength = useMemo(() => getStrength(newPassword), [newPassword]);

  // Step 1 â€” verify the 6-digit code
  const handleVerifyCode = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const trimmed = code.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      setError("Enter the 6-digit code sent to your email.");
      return;
    }
    setSubmitting(true);
    try {
      await apiVerifyResetCode(emailFromQuery, trimmed);
      setStep("password");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid or expired code. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Step 2 â€” set the new password
  const handleReset = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      await apiResetPassword(emailFromQuery, code.trim(), newPassword);
      setSuccess(true);
      setTimeout(() => router.replace("/login"), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="reset-shell">
      {/* Ambient blobs */}
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
            <small>Password Reset</small>
          </div>
          <div className="compact-status">
            <div className="compact-pill">
              <span className="material-symbols-outlined">enhanced_encryption</span>
              <i />
              <b>Secure Reset</b>
            </div>
            <div className="compact-powered">
              <span>Powered by</span>
              <img alt="eSkoolia" src={ESKOOLIA_LOGO} />
            </div>
          </div>
        </div>
      </header>

      {/* Main card */}
      <main className="reset-main">
        <div className="reset-card">
          {/* Left: visual */}
          <div className="reset-visual">
            <img alt="Secure reset" src={ATRIUM_IMAGE} />
            <div className="reset-visual-scrim" />
            <div className="reset-copy">
              <div className="mini-badge">
                <span className="material-symbols-outlined filled">enhanced_encryption</span>
                <span>Verified Reset</span>
              </div>
              <h1>
                New <em>Access Key</em>
              </h1>
              <p>
                {step === "code"
                  ? "Enter the 6-digit code sent to your email to verify your identity."
                  : "Code verified â€” now set your new password to regain access."}
              </p>
            </div>
          </div>

          {/* Right: form */}
          <div className="reset-form-panel">
            <div className="typo-bleed">{step === "code" ? "OTP" : "KEY"}</div>

            <div className="flow-form-card">
              <div className="form-rule" />
              <h2>
                {step === "code" ? (
                  <><span>Verify</span> <em>Code</em></>
                ) : (
                  <><span>New</span> <em>Password</em></>
                )}
              </h2>

              {emailFromQuery && (
                <p>
                  {step === "code" ? "Recovery code sent to " : "Resetting access for "}
                  <strong style={{ color: "#006a61" }}>{emailFromQuery}</strong>
                </p>
              )}

              {/* Step progress bar */}
              <div style={{ display: "flex", gap: 6, margin: "4px 0 20px" }}>
                <div style={{
                  flex: 1, height: 4, borderRadius: 99,
                  background: "#006a61",
                  transition: "background 0.3s",
                }} />
                <div style={{
                  flex: 1, height: 4, borderRadius: 99,
                  background: step === "password" || success ? "#006a61" : "rgba(0,0,0,0.12)",
                  transition: "background 0.3s",
                }} />
              </div>

              {success ? (
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
                    style={{ color: "#006a61", fontSize: 56, marginBottom: 16, display: "block" }}
                  >
                    check_circle
                  </span>
                  <p style={{ color: "#312e81", fontWeight: 800, fontSize: 20, margin: "0 0 12px" }}>
                    Password reset!
                  </p>
                  <p style={{ color: "#3d4947", margin: 0, lineHeight: 1.6 }}>
                    Your access key has been updated. Redirecting to loginâ€¦
                  </p>
                </div>
              ) : step === "code" ? (
                /* â”€â”€ Step 1: verify code â”€â”€ */
                <form className="reset-form" onSubmit={handleVerifyCode} noValidate>
                  <div className="activation-field">
                    <span>6-Digit Verification Code</span>
                    <div>
                      <span className="material-symbols-outlined">pin</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder="_ _ _ _ _ _"
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        autoComplete="one-time-code"
                        autoFocus
                        maxLength={6}
                        style={{ letterSpacing: "0.35em", fontSize: 22, fontWeight: 700, textAlign: "center" }}
                      />
                    </div>
                  </div>

                  {error && (
                    <p className="form-error" role="alert">{error}</p>
                  )}

                  <button
                    type="submit"
                    className="primary-flow-button"
                    disabled={submitting || code.length !== 6}
                  >
                    {submitting ? "Verifyingâ€¦" : "Verify Code"}
                    <span className="material-symbols-outlined">
                      {submitting ? "hourglass_top" : "verified"}
                    </span>
                  </button>

                  <div style={{ marginTop: 12, textAlign: "center" }}>
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={resendCooldown > 0 || resending}
                      style={{
                        background: "none", border: "none",
                        color: resendCooldown > 0 ? "#9ca3af" : "#006a61",
                        fontSize: 13,
                        cursor: resendCooldown > 0 ? "default" : "pointer",
                        textDecoration: resendCooldown > 0 ? "none" : "underline",
                        padding: 0,
                      }}
                    >
                      {resending
                        ? "Sending\u2026"
                        : resendCooldown > 0
                        ? `Resend available in ${resendCooldown}s`
                        : "Didn't receive a code? Resend"}
                    </button>
                    {resendStatus && (
                      <p style={{
                        color: resendStatus.type === "success" ? "#006a61" : "#dc2626",
                        fontSize: 12, margin: "6px 0 0",
                      }}>
                        {resendStatus.msg}
                      </p>
                    )}
                  </div>
                </form>
              ) : (
                /* â”€â”€ Step 2: set new password â”€â”€ */
                <form className="reset-form" onSubmit={handleReset} noValidate>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 8, marginBottom: 4,
                    color: "#006a61", fontSize: 13, fontWeight: 600,
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>check_circle</span>
                    Identity verified â€” set your new password
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
                        autoFocus
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
                      <div className="password-meter">
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
                          <span>Min 8 chars, mixed case, numbers &amp; symbols</span>
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
                    <p className="form-error" role="alert">{error}</p>
                  )}

                  <button
                    type="submit"
                    className="primary-flow-button"
                    disabled={submitting}
                  >
                    {submitting ? "Resettingâ€¦" : "Set New Password"}
                    <span className="material-symbols-outlined">
                      {submitting ? "hourglass_top" : "lock_open"}
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
      </main>

      {/* Footer */}
      <footer className="compact-footer">
        <p>
          Â© 2024 <strong>{SCHOOL_NAME} Institutional Node</strong>.{" "}
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
