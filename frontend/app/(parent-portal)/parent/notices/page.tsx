"use client";

import { useEffect, useState } from "react";
import { Bell, ChevronDown, ChevronUp } from "lucide-react";
import { fetchParentNotices, type NoticeItem } from "@/lib/api/parent";

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ h = 16 }: { h?: number }) {
  return (
    <div style={{ height: h, width: "100%", borderRadius: 8, backgroundImage: "linear-gradient(90deg,var(--line,#dbe4f0) 25%,var(--bg-2,#f5f5fb) 50%,var(--line,#dbe4f0) 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s ease-in-out infinite" }} />
  );
}

// ── Notice card ───────────────────────────────────────────────────────────────

function NoticeCard({ notice }: { notice: NoticeItem }) {
  const [expanded, setExpanded] = useState(false);

  const publishDate = new Date(notice.publish_on + "T00:00:00").toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });

  const isNew = (() => {
    const diff = (new Date().getTime() - new Date(notice.publish_on + "T00:00:00").getTime()) / 86400000;
    return diff <= 3;
  })();

  return (
    <div style={{ border: "1px solid var(--bd)", borderRadius: 14, overflow: "hidden", transition: "box-shadow 0.15s" }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{ width: "100%", display: "flex", alignItems: "flex-start", gap: 14, padding: "16px 18px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
      >
        {/* Icon */}
        <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(2,132,199,0.1)", display: "grid", placeItems: "center", flexShrink: 0, marginTop: 1 }}>
          <Bell size={16} color="#0284C7" strokeWidth={1.8} />
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-1)", lineHeight: 1.3 }}>{notice.title}</span>
            {isNew && (
              <span style={{ padding: "2px 8px", borderRadius: 20, background: "rgba(2,132,199,0.12)", color: "#0284C7", fontSize: 10, fontWeight: 700 }}>NEW</span>
            )}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{publishDate}</div>
          {!expanded && (
            <div style={{ fontSize: 12.5, color: "var(--ink-2)", marginTop: 6, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
              {notice.message}
            </div>
          )}
        </div>

        {/* Toggle */}
        <div style={{ flexShrink: 0, color: "var(--ink-3)", paddingTop: 2 }}>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {expanded && (
        <div style={{ borderTop: "1px solid var(--bd)", padding: "14px 18px 18px", background: "var(--bg-2)" }}>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-1)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
            {notice.message}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NoticesPage() {
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetchParentNotices()
      .then(setNotices)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ background: "var(--bg-1)", border: "1px solid var(--bd)", borderRadius: 18, boxShadow: "var(--sh-1)", padding: "28px 30px" }}>

      {/* Header */}
      <div style={{ marginBottom: 24, paddingBottom: 20, borderBottom: "1px solid var(--bd)", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 34, fontWeight: 600, color: "var(--ink-1)", margin: "0 0 5px", lineHeight: 1.05, letterSpacing: "-0.03em", display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            School{" "}
            <em style={{ fontFamily: "var(--font-instrument-serif,'Instrument Serif',Georgia,serif)", fontWeight: 400, fontStyle: "italic", color: "var(--pu)", fontSize: 38, letterSpacing: "-0.02em" }}>
              Notices
            </em>
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "var(--ink-2)", marginTop: 10, lineHeight: 1.55 }}>
            Announcements and circulars from your child's school.
          </p>
        </div>
        {notices.length > 0 && (
          <div style={{ padding: "6px 14px", borderRadius: 20, border: "1px solid var(--bd)", background: "var(--bg-2)", fontSize: 12.5, color: "var(--ink-2)", fontWeight: 500, flexShrink: 0 }}>
            {notices.length} notice{notices.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "12px 16px", color: "#B91C1C", fontSize: 13, marginBottom: 20 }}>
          Could not load notices. Please refresh.
        </div>
      )}

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[1, 2, 3, 4].map(i => <Skeleton key={i} h={88} />)}
        </div>
      ) : notices.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {notices.map((n) => <NoticeCard key={n.id} notice={n} />)}
        </div>
      ) : !error && (
        <div style={{ background: "var(--bg-2)", border: "1px solid var(--bd)", borderRadius: 12, padding: "40px 32px", textAlign: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(2,132,199,0.1)", display: "grid", placeItems: "center", margin: "0 auto 12px" }}>
            <Bell size={22} color="#0284C7" strokeWidth={1.5} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-2)", marginBottom: 4 }}>No notices yet</div>
          <div style={{ fontSize: 12.5, color: "var(--ink-3)" }}>School notices and announcements will appear here.</div>
        </div>
      )}
    </div>
  );
}
