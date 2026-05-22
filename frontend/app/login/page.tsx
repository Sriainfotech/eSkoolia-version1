"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { API_BASE_URL } from "@/lib/api";

// ─── Constants ────────────────────────────────────────────────────────────────

const SCHOOL_NAME = process.env.NEXT_PUBLIC_SCHOOL_NAME ?? "eSkoolia";
const SCHOOL_EMAIL_DOMAIN = process.env.NEXT_PUBLIC_SCHOOL_EMAIL_DOMAIN ?? "school.edu.in";

// ─── Subdomain helper ─────────────────────────────────────────────────────────

/** Returns the tenant subdomain from the current hostname, or null.
 *  e.g. "springdale.eskoolia.com" → "springdale"
 *       "localhost:3000"          → null
 */
function getSubdomainFromHost(): string | null {
  if (typeof window === "undefined") return null;
  const hostname = window.location.hostname;  // e.g. "springdale.eskoolia.com"
  const parts = hostname.split(".");
  // Valid tenant: at least 3 parts and the second part is "eskoolia"
  if (parts.length >= 3 && parts[1] === "eskoolia") {
    const sub = parts[0];
    if (!["www", "admin", "api", "app", "mail", ""].includes(sub)) return sub;
  }
  return null;
}

const MANDALA_IMAGE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAs0iss4Nb-47Ty-FMzbmeTvANKZGL49QmIltz2KqUSaZ2RfYqr7QEuLFKbMPmAHH5uVw-fRU7gmHxDk10F6OhF5OSICU-m2vZOlWzRJ5JVa6cVbnyuT5oqi3Iif7ofYPCFDSuHp0D73s9os187aLZSyCwqhP9YNYUK0-q-Rn3NcCu_hz9sgeDxdg6T8eJzL-qbegjI7ZCl9Y7tBPcrMknDATqVweE_Eil-L6lSWiVaJQWd_SzsskD1ksq9izhrMBJ8Xk3jpaYYIi4";

const CAMPUS_IMAGE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCX6Cr2E0KWnc6ky1i4cIZ53q1vjniOS0c1IRe9xSGIVRkZUeuopkc_-MUdgIRLKHmcKJVG2ZyjbjmEGGsM7jcs18fnD8BARdt4IWkkXfbRHsRezqKyiRu1gVGZi7yuUhWWKKj4DnGjopRYZxlSJI2-X6yFaTfHG1clZp5Fu_5EC2dgZJv-yESQ5uFGmTjXtyEDNXO-Q-y_GX2hQjCVeTkX7nRaxsZGd3Jb8wULk7b-2TBdn0Zz0z5oyXYyUPTftsiBm0cLvvOBY0Q";

const ESKOOLIA_LOGO =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBMkE47tearngJgRuiZoTvnI_40bttDEPwdQy6orbI-d0rXKaVxcGyFLvUo-FJJyRnx4G1VlTYeFcbUnSHhPmM88oda_5SN99u6dkF56FAmJ6XuisV_O0H5Y7KbqUJ5u-HEnd0KQTdRPqrZpOELy1r9IAMq9TB7344-04IjSwbCiFIHwf2dWiJ4JhWHnED6-NSzU8ixZeE2Lcez08_SZEwC1wPQRS8wbuIvQSI2-Xqruig2KaO4XKkEguCFLF7oSWdFZq1mr6RHM30";

const FACULTY_IMAGES = [
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDaLN6ApEnq-6_WvjugxXKoixkJnonExeFb2b6xwsWY6tTWRhDuMWVfJHqfxYFMlTTuWZc_Nhhbz8rhKJkA5fLXo6WeMAha9yua4TtMoF7APaq2GK47do48BMCe0A8g-LNlcl2oOvgxFQx2V07jBGX7l0_OXVKyTQXTIsNso0Dxhcs9tRS265IFLQ82Eb0zpFkmGdK3gEFhj1EzGKNM5fGW9bITZ2wLc6K0ZBpXXKyDB6ovrV5Ne0aNlGeFLeacVP9EjRPJdWSXgCA",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBN0yZBp5kY5IW4IkfFI30cg6AexMmNRCpjHyeGeT5sErNoMGBi1f-hiT_nDTTXYnZkBQZfbwTKgVj12f5oVrFkSOOZWHubVeRM0GlJaEPSvGVjMlvhyyTgulAduEsEfAjwcYcqvmDfveLBS7qDoeWhNO6RAFo7iWT4_2rLZwcF7uIpU4NoaaYpuZubqK-UhQUE1Z_tmdXXF_JQjLbiPmS4HxUb24o7gkrU3uQTPmO26I1m7xhwm9m0v2qMV6-G6AqL7MuNTU5G0Xc",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDiDWftYcQNwR1ZIq3hpQoIeNVt8I72AL5fQfbnhPDcsfeQzguJZqzkCT70r070zcqaY3Vy8WH_eNER1j15HBMiVLlIDvIy93bssvyKQuzPR5_P4VvFQG0Qan_rdybRGvIhFia5tHtIRM3BeKLfY2hVTuSY4enwqrjxRrUjFwPdLf_KBOOsQ-snmvEDt_8bRcBK7xb6txjd9tyHJ7ta5KN0iiJJTYft3ULRJaPU6hiBwnXRNfOH2s69hh0iNhdftBYLgxN-iWRgrzU",
];

// ─── Root export: wraps auth context ─────────────────────────────────────────

export default function LoginPageWrapper() {
  return (
    <AuthProvider>
      <LoginPage />
    </AuthProvider>
  );
}

// ─── Inner page ───────────────────────────────────────────────────────────────

function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading, user } = useAuth();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [rememberDevice, setRememberDevice] = useState(false);
  const [blobOffset, setBlobOffset] = useState({ x: 0, y: 0 });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Subdomain-based school branding
  const [subdomain] = useState<string | null>(() => getSubdomainFromHost());
  const [schoolInfo, setSchoolInfo] = useState<{
    name: string;
    logo_url: string | null;
    brand_color: string;
  } | null>(null);

  // Fetch school name + branding from the public API when on a tenant subdomain.
  useEffect(() => {
    if (!subdomain) return;
    fetch(`${API_BASE_URL}/api/v1/tenancy/school-info/?subdomain=${encodeURIComponent(subdomain)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setSchoolInfo(data); })
      .catch(() => { /* silently ignore — fall back to env var */ });
  }, [subdomain]);

  // Derive display name: use full name from backend, or fall back to env var constant.
  const displaySchoolName = schoolInfo?.name ?? SCHOOL_NAME;

  // Redirect already-authenticated users away from login.
  useEffect(() => {
    if (!isLoading && isAuthenticated && user && !user.must_change_password) {
      router.replace("/home");
    }
  }, [isLoading, isAuthenticated, user, router]);

  // Subtle parallax effect on background blobs.
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      setBlobOffset({
        x: (e.clientX / window.innerWidth - 0.5) * 80,
        y: (e.clientY / window.innerHeight - 0.5) * 80,
      });
    };
    window.addEventListener("mousemove", onMouseMove);
    return () => window.removeEventListener("mousemove", onMouseMove);
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!identifier.trim()) {
      setError("Email or username is required.");
      return;
    }
    if (!password) {
      setError("Password is required.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await login(identifier.trim(), password);
      if (result.must_change_password) {
        router.push("/change-password");
      } else {
        router.push("/home");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="gateway-shell">
      {/* Background layers */}
      <div className="mandala-bg" style={{ backgroundImage: `url(${MANDALA_IMAGE})` }} />
      <div
        className="aura-blob aura-teal-blob"
        style={{ transform: `translate(${blobOffset.x}px, ${blobOffset.y}px)` }}
      />
      <div
        className="aura-blob aura-saffron-blob"
        style={{ transform: `translate(${-blobOffset.x}px, ${-blobOffset.y}px)` }}
      />

      {/* Decorative floating symbols */}
      <div className="floating-symbol left-symbol">
        <span className="material-symbols-outlined">temple_hindu</span>
      </div>
      <div className="floating-symbol right-symbol">
        <span className="material-symbols-outlined">auto_stories</span>
      </div>

      {/* Top navigation bar */}
      <header className="site-header">
        <div className="glass-panel header-panel">
          <div className="brand-stack">
            <h1 className="school-brand">
              {displaySchoolName}
            </h1>
            <div className="header-divider" />
            <p className="header-kicker">Digital Atrium</p>
          </div>
          <div className="header-actions">
            <div className="status-pill">
              <div className="status-group">
                <span className="status-dot" />
                <span>Active</span>
              </div>
              <div className="session-group">
                <span className="material-symbols-outlined">calendar_today</span>
                <span>Session 24/25</span>
              </div>
            </div>
            <div className="partner-brand">
              <span>Powered by</span>
              <img alt="eSkoolia" src={ESKOOLIA_LOGO} />
            </div>
          </div>
        </div>
      </header>

      {/* Main card */}
      <main className="gateway-main">
        <section className="glass-card command-hub">
          {/* Left: identity / hero panel */}
          <div className="identity-panel">
            <div className="campus-image-wrap">
              <img alt={`${displaySchoolName} campus`} src={CAMPUS_IMAGE} />
            </div>

            <div className="identity-content">
              <div className="gateway-badge">
                <span className="material-symbols-outlined filled">verified</span>
                <span>Official Digital Gateway</span>
              </div>

              <div className="hero-copy">
                <span className="eyebrow">Excellence Defined</span>
                <h2>
                  The Heart of <br />
                  <span>Educational Mastery.</span>
                </h2>
                <p>
                  Welcome to your unified institutional workspace. Securely access the
                  complete academic ecosystem designed for the modern {displaySchoolName} family.
                </p>
              </div>

              <div className="feature-grid">
                <FeatureCard icon="school" title="Academics" note="Curriculum & Grading" tone="teal" />
                <FeatureCard icon="payments" title="Finances" note="Fee Management" tone="saffron" />
                <FeatureCard icon="how_to_reg" title="Admissions" note="Enrollment Hub" tone="marigold" />
                <FeatureCard icon="forum" title="Connect" note="Parent Portal" tone="indigo" />
              </div>
            </div>

            <div className="trust-strip">
              <div className="avatar-row">
                {FACULTY_IMAGES.map((src, i) => (
                  <img key={i} alt="Faculty" src={src} />
                ))}
              </div>
              <div>
                <p>Built for India&apos;s Future Leaders</p>
                <span>Trusted by India&apos;s top educational institutions.</span>
              </div>
            </div>
          </div>

          {/* Right: login form */}
          <aside className="auth-panel">
            <div className="auth-view">
              <div className="auth-heading">
                <div className="heading-rule teal" />
                <h2>
                  <span>Gateway</span> <em>to Mastery</em>
                </h2>
                <p>
                  Authenticate your institutional identity to enter the command center of
                  academic excellence.
                </p>
              </div>

              <form className="form-stack" onSubmit={handleSubmit} noValidate>
                <label className="input-group teal">
                  <span className="input-label">Institutional Email / Username</span>
                  <span className="input-wrap">
                    <span className="material-symbols-outlined input-icon">alternate_email</span>
                    <input
                      type="text"
                      placeholder={`username@${SCHOOL_EMAIL_DOMAIN}`}
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      autoComplete="username"
                      autoFocus
                    />
                  </span>
                </label>

                <label className="input-group saffron">
                  <span className="input-label">Access Key / Password</span>
                  <span className="input-wrap">
                    <span className="material-symbols-outlined input-icon">key</span>
                    <input
                      type="password"
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                    />
                  </span>
                </label>

                {error && (
                  <p className="form-error" role="alert">
                    {error}
                  </p>
                )}

                <div className="form-options">
                  <label className="remember-control">
                    <span
                      className={`custom-checkbox${rememberDevice ? " checked" : ""}`}
                      aria-hidden="true"
                    >
                      <span className="material-symbols-outlined">check</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={rememberDevice}
                      onChange={(e) => setRememberDevice(e.target.checked)}
                    />
                    <span>Trust this device</span>
                  </label>

                  <button
                    type="button"
                    className="text-action"
                    onClick={() => router.push("/forgot-password")}
                  >
                    Forgot Access Key?
                  </button>
                </div>

                <button
                  type="submit"
                  className="btn-atrium"
                  disabled={submitting || isLoading}
                >
                  {submitting ? "Signing in…" : "Enter the Digital Atrium"}
                  <span className="material-symbols-outlined">arrow_forward</span>
                </button>
              </form>

              <div className="security-panel">
                <div>
                  <span className="material-symbols-outlined filled">shield_person</span>
                </div>
                <div>
                  <p>Secured by eSkoolia</p>
                  <span>Institutional-grade 256-bit AES encryption active.</span>
                </div>
              </div>
            </div>
          </aside>
        </section>
      </main>

      {/* Footer */}
      <footer className="site-footer">
        <p>
          © 2024 <strong>{SCHOOL_NAME} Institutional Node</strong>. Built on{" "}
          <span>eSkoolia Infrastructure v4.8.2</span>
        </p>
        <nav>
          <a href="#">Privacy Hub</a>
          <a href="#">Legal Terms</a>
          <i />
          <a className="support-link" href="#">
            Academic Concierge
            <span className="material-symbols-outlined">support_agent</span>
          </a>
        </nav>
      </footer>
    </div>
  );
}

// ─── Feature card sub-component ───────────────────────────────────────────────

function FeatureCard({
  icon,
  title,
  note,
  tone,
}: {
  icon: string;
  title: string;
  note: string;
  tone: "teal" | "saffron" | "marigold" | "indigo";
}) {
  return (
    <div className={`feature-card ${tone}`}>
      <div className="feature-icon">
        <span className="material-symbols-outlined">{icon}</span>
      </div>
      <div>
        <strong>{title}</strong>
        <span>{note}</span>
      </div>
    </div>
  );
}

