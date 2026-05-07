"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AreaChart, Area, XAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import {
  BarChart2,
  Download,
  TrendingUp,
  Users,
  Phone,
  GraduationCap,
  RefreshCw,
  CheckCircle2,
  Trophy,
  Target,
  Activity,
} from "lucide-react";
import { apiRequestWithRefresh } from "@/lib/api-auth";

/* ─────────────────────── types ─────────────────────── */
type AnalyticsData = {
  total: number;
  contacted: number;
  visited: number;
  enrolled: number;
  declined: number;
  contact_rate_pct: number;
  visit_rate_pct: number;
  enroll_rate_pct: number;
  monthly_trend: { month: string; inquiries: number; enrolled: number }[];
  by_status: { status: string; count: number }[];
  by_source: { "source__name": string | null; count: number; enrolled: number }[];
  by_grade: { "school_class__name": string | null; count: number }[];
  counsellor_stats: {
    assigned: string;
    total: number;
    enrolled: number;
    contacted: number;
    conversion_pct: number;
  }[];
  channel_breakdown: { channel: string; count: number }[];
};

type Period = "month" | "quarter" | "year" | "all";

/* ─────────────────────── helpers ─────────────────────── */
const PERIOD_LABELS: Record<Period, string> = {
  month: "This Month",
  quarter: "Last 90 Days",
  year: "This Year",
  all: "All Time",
};

const STATUS_COLORS: Record<string, string> = {
  new: "#6366f1",
  contacted: "#0ea5e9",
  visited: "#f59e0b",
  enrolled: "#10b981",
  declined: "#ef4444",
};

function pct(n: number, total: number) {
  return total ? Math.round((n / total) * 100) : 0;
}

function fmtMonth(iso: string) {
  const [y, m] = iso.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(m) - 1]} ${y.slice(2)}`;
}

/* ─── count-up animation hook ─── */
function useCountUp(target: number): number {
  const [val, setVal] = React.useState(0);
  React.useEffect(() => {
    if (!target) { setVal(0); return; }
    const start = Date.now();
    const tick = () => {
      const p = Math.min((Date.now() - start) / 1000, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(target * eased));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target]);
  return val;
}

/* ─── inline SVG sparkline ─── */
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data.length) return <div className="h-8 w-20" />;
  const W = 80, H = 32, pad = 2;
  const max = Math.max(...data, 1);
  const xs = data.map((_, i) =>
    data.length === 1 ? W / 2 : pad + (i / (data.length - 1)) * (W - pad * 2)
  );
  const ys = data.map((v) => pad + (1 - v / max) * (H - pad * 2));
  const linePath = xs.map((x, i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${xs[xs.length - 1].toFixed(1)} ${(H - pad).toFixed(1)} L ${pad} ${(H - pad).toFixed(1)} Z`;
  return (
    <svg width={80} height={32} viewBox={`0 0 ${W} ${H}`}>
      <path d={areaPath} fill={color} opacity={0.15} />
      <path d={linePath} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/* ─── premium KPI card with count-up ─── */
function KPICard({
  icon: Icon,
  label,
  value,
  isPercent,
  sub,
  iconBg,
  iconColor,
  sparkData,
  sparkColor,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  isPercent?: boolean;
  sub?: string;
  iconBg: string;
  iconColor: string;
  sparkData: number[];
  sparkColor: string;
}) {
  const animated = useCountUp(value);
  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex flex-col gap-1">
      <div className="flex items-start justify-between mb-2">
        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: iconBg }}>
          <Icon size={18} color={iconColor} strokeWidth={1.8} />
        </div>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-600">↑ live</span>
      </div>
      <div className="text-4xl font-bold text-gray-900 leading-none tabular-nums">
        {animated}{isPercent ? "%" : ""}
      </div>
      <div className="text-sm text-gray-500">{label}</div>
      <div className="mt-1">
        <Sparkline data={sparkData} color={sparkColor} />
      </div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

/* ─── conversion funnel with drop-off rates ─── */
function FunnelViz({ total, contacted, visited, enrolled }: {
  total: number; contacted: number; visited: number; enrolled: number;
}) {
  const stages = [
    { label: "Inquiry",   count: total,     color: "#3b82f6" },
    { label: "Contacted", count: contacted, color: "#14b8a6" },
    { label: "Visited",   count: visited,   color: "#f59e0b" },
    { label: "Enrolled",  count: enrolled,  color: "#22c55e" },
  ];
  return (
    <div className="space-y-1">
      {stages.map((s, i) => {
        const pctOfTotal = total ? (s.count / total) * 100 : 0;
        const barW = Math.max(pctOfTotal, 8);
        return (
          <div key={s.label} className="group">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-16 flex-shrink-0">{s.label}</span>
              <div className="flex-1 h-7 bg-gray-100 rounded-lg overflow-hidden relative">
                <div
                  className="h-full rounded-lg flex items-center px-3 transition-all duration-700"
                  style={{ width: `${barW}%`, background: s.color }}
                >
                  <span className="text-white text-xs font-bold">{s.count}</span>
                </div>
              </div>
              <span className="text-xs font-semibold text-gray-600 w-10 text-right">
                {Math.round(pctOfTotal)}%
              </span>
            </div>
            {i < stages.length - 1 && (
              <div className="text-xs text-red-400 pl-20 py-0.5">
                ↓ -{Math.round(((stages[i].count - stages[i + 1].count) / Math.max(stages[i].count, 1)) * 100)}% drop-off
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── semi-circular gauge ─── */
function SemiGauge({ pct: pctVal, color }: { pct: number; color: string }) {
  const r = 34, sw = 7, circ = Math.PI * r;
  const fill = (pctVal / 100) * circ;
  return (
    <svg width={80} height={48} viewBox="0 0 80 48">
      <path d={`M 6,44 A ${r},${r} 0 0 1 74,44`} fill="none" stroke="#e5e7eb" strokeWidth={sw} strokeLinecap="round" />
      <path
        d={`M 6,44 A ${r},${r} 0 0 1 74,44`}
        fill="none"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeDasharray={`${fill} ${circ}`}
        style={{ transition: "stroke-dasharray 0.7s ease-out" }}
      />
    </svg>
  );
}

/* ─── source icon + color config ─── */
const SOURCE_CONFIG: Record<string, { color: string; icon: string }> = {
  instagram:       { color: "#E1306C", icon: "📱" },
  facebook:        { color: "#1877F2", icon: "👤" },
  "word of mouth": { color: "#10b981", icon: "👥" },
  "phone call":    { color: "#6366f1", icon: "📞" },
  google:          { color: "#ea4335", icon: "🔍" },
  newspaper:       { color: "#78716c", icon: "📰" },
};
function getSourceConfig(name: string) {
  const key = (name || "").toLowerCase();
  for (const [k, v] of Object.entries(SOURCE_CONFIG)) {
    if (key.includes(k)) return v;
  }
  return { color: "#9ca3af", icon: "❓" };
}

/* ─── export CSV helper ─── */
function exportCSV(data: AnalyticsData) {
  const rows = [
    ["Metric", "Value"],
    ["Total Inquiries", data.total],
    ["Contacted", data.contacted],
    ["Visited", data.visited],
    ["Enrolled", data.enrolled],
    ["Declined", data.declined],
    ["Contact Rate %", data.contact_rate_pct],
    ["Visit Rate %", data.visit_rate_pct],
    ["Enroll Rate %", data.enroll_rate_pct],
    [],
    ["Source", "Inquiries", "Enrolled"],
    ...data.by_source.map((s) => [s["source__name"] || "Unknown", s.count, s.enrolled]),
    [],
    ["Grade", "Inquiries"],
    ...data.by_grade.map((g) => [g["school_class__name"] || "Unknown", g.count]),
    [],
    ["Counsellor", "Total", "Enrolled", "Conversion %"],
    ...data.counsellor_stats.map((c) => [c.assigned, c.total, c.enrolled, c.conversion_pct]),
  ];
  const csv = rows.map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `admissions-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ─────────────────────── main component ─────────────────────── */
export function AdmissionsAnalytics() {
  const [period, setPeriod] = useState<Period>("all");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load(p: Period) {
    setLoading(true);
    setError("");
    try {
      const res = await apiRequestWithRefresh(`/api/v1/admissions/analytics/overview/?period=${p}`) as { success: boolean; data: AnalyticsData };
      if (res?.success && res.data) setData(res.data);
      else setError("Failed to load analytics data.");
    } catch {
      setError("Failed to load analytics data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(period); }, [period]);

  const monthlyInquiries = useMemo(() => data?.monthly_trend.map((d) => d.inquiries) ?? [], [data]);
  const monthlyEnrolled = useMemo(() => data?.monthly_trend.map((d) => d.enrolled) ?? [], [data]);
  const monthlyLabels = useMemo(() => data?.monthly_trend.map((d) => fmtMonth(d.month)) ?? [], [data]);

  const maxSource = data ? Math.max(...data.by_source.map((s) => s.count), 1) : 1;
  const maxGrade = data ? Math.max(...data.by_grade.map((g) => g.count), 1) : 1;

  const dropContact = data ? pct(data.total - data.contacted, data.total) : 0;
  const dropVisit = data && data.contacted ? pct(data.contacted - data.visited, data.contacted) : 0;
  const dropEnroll = data && data.visited ? pct(data.visited - data.enrolled, data.visited) : 0;

  const trendData = useMemo(() => data?.monthly_trend.map(d => ({
    month: fmtMonth(d.month),
    inquiries: d.inquiries,
    enrolled: d.enrolled,
  })) ?? [], [data]);

  return (
    <div className="px-4 py-6 max-w-7xl mx-auto">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
            <BarChart2 size={20} color="#2563eb" strokeWidth={1.8} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admissions Analytics</h1>
            <p className="text-sm text-gray-500">Conversion insights and pipeline health</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-xl bg-gray-100 p-1 gap-1">
            {(["month", "quarter", "year", "all"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`rounded-lg px-4 py-1.5 text-sm cursor-pointer transition-all
                  ${period === p ? "bg-white text-gray-900 shadow-sm font-medium" : "text-gray-500 hover:text-gray-700"}`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
          <button
            onClick={() => load(period)}
            className="w-8 h-8 border border-gray-200 rounded-lg bg-white flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={14} color="#9ca3af" />
          </button>
          {data && (
            <button
              onClick={() => exportCSV(data)}
              className="h-8 px-3 border border-gray-200 rounded-lg bg-white flex items-center gap-1.5 text-sm text-gray-500 hover:bg-gray-50 cursor-pointer transition-colors"
            >
              <Download size={14} />
              Export CSV
            </button>
          )}
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-5 text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* ── Loading ── */}
      {loading && !data && (
        <div className="flex items-center justify-center gap-2 text-gray-400 py-16">
          <RefreshCw size={16} className="animate-spin" />
          Loading analytics…
        </div>
      )}

      {data && (
        <>
          {/* ── KPI Cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
            <KPICard
              icon={Users}
              label="Total Inquiries"
              value={data.total}
              iconBg="#dbeafe"
              iconColor="#2563eb"
              sparkData={monthlyInquiries}
              sparkColor="#3b82f6"
            />
            <KPICard
              icon={Phone}
              label="Contact Rate"
              value={data.contact_rate_pct}
              isPercent
              sub={`${data.contacted} contacted`}
              iconBg="#ccfbf1"
              iconColor="#0d9488"
              sparkData={monthlyInquiries}
              sparkColor="#14b8a6"
            />
            <KPICard
              icon={Activity}
              label="Visit Rate"
              value={data.visit_rate_pct}
              isPercent
              sub={`${data.visited} campus visits`}
              iconBg="#fef3c7"
              iconColor="#d97706"
              sparkData={monthlyInquiries}
              sparkColor="#f59e0b"
            />
            <KPICard
              icon={CheckCircle2}
              label="Enroll Rate"
              value={data.enroll_rate_pct}
              isPercent
              sub={`${data.enrolled} enrolled`}
              iconBg="#dcfce7"
              iconColor="#16a34a"
              sparkData={monthlyEnrolled}
              sparkColor="#22c55e"
            />
          </div>

          {/* ── Conversion Funnel + Monthly Trend ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            {/* Funnel */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Target size={14} color="#6366f1" />
                <span className="text-sm font-bold text-gray-800">Conversion Funnel</span>
              </div>
              <FunnelViz
                total={data.total}
                contacted={data.contacted}
                visited={data.visited}
                enrolled={data.enrolled}
              />
              <div className={`mt-4 p-3 rounded-xl text-sm font-medium ${
                data.enroll_rate_pct >= 20
                  ? "bg-green-50 text-green-700"
                  : data.enroll_rate_pct >= 10
                  ? "bg-amber-50 text-amber-700"
                  : "bg-red-50 text-red-600"
              }`}>
                Overall conversion: {data.enroll_rate_pct}% of inquiries enroll
              </div>
            </div>

            {/* Monthly Trend */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={14} color="#3b82f6" />
                <span className="text-sm font-bold text-gray-800">6-Month Trend</span>
              </div>
              {monthlyInquiries.length > 1 ? (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={trendData}>
                      <defs>
                        <linearGradient id="inquiriesGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", boxShadow: "0 4px 6px -1px rgba(0,0,0,.1)" }} />
                      <Area type="monotone" dataKey="inquiries" stroke="#3b82f6" fill="url(#inquiriesGrad)" strokeWidth={2} name="Inquiries" />
                      <Area type="monotone" dataKey="enrolled" stroke="#22c55e" fill="none" strokeWidth={2} name="Enrolled" />
                    </AreaChart>
                  </ResponsiveContainer>
                  <div className="flex gap-4 mt-2">
                    <span className="text-xs text-blue-400 flex items-center gap-1.5">
                      <span className="inline-block w-3 h-0.5 bg-blue-400 rounded" /> Inquiries
                    </span>
                    <span className="text-xs text-green-500 flex items-center gap-1.5">
                      <span className="inline-block w-3 h-0.5 bg-green-500 rounded" /> Enrolled
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <BarChart2 size={36} color="#d1d5db" />
                  <p className="text-sm font-medium text-gray-500">Not enough data yet</p>
                  <p className="text-xs text-gray-400">Add 5+ inquiries to see trends</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Source Performance + Grade Demand ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            {/* Source Performance */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Activity size={14} color="#f59e0b" />
                <span className="text-sm font-bold text-gray-800">Source Performance</span>
              </div>
              {data.by_source.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-5">No source data yet.</p>
              ) : (
                <div className="space-y-3">
                  {data.by_source.map((s, i) => {
                    const cfg = getSourceConfig(s["source__name"] || "");
                    const convPct = s.count ? Math.round((s.enrolled / s.count) * 100) : 0;
                    const barW = maxSource ? Math.max((s.count / maxSource) * 100, 4) : 4;
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-lg w-6 flex-shrink-0 text-center">{cfg.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-gray-700 truncate">{s["source__name"] || "Direct / Unknown"}</span>
                            <span className="text-xs text-gray-400 ml-2 flex-shrink-0">{s.count} inq · {s.enrolled} enrolled</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${barW}%`, background: cfg.color }}
                            />
                          </div>
                        </div>
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md flex-shrink-0 ${
                          convPct >= 30 ? "bg-green-50 text-green-600" :
                          convPct >= 15 ? "bg-amber-50 text-amber-600" :
                          "bg-red-50 text-red-500"
                        }`}>{convPct}%</span>
                      </div>
                    );
                  })}
                </div>
              )}
              {data.by_source.length > 0 && (() => {
                const best = [...data.by_source].sort((a, b) => b.enrolled - a.enrolled)[0];
                if (!best) return null;
                return (
                  <div className="mt-4 p-3 bg-amber-50 rounded-xl flex items-center gap-2 text-xs text-amber-700">
                    <span>🏆</span>
                    <span>Best source: <strong>{best["source__name"] || "Unknown"}</strong> with {best.enrolled} enrollments</span>
                  </div>
                );
              })()}
            </div>

            {/* Grade Demand */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <GraduationCap size={14} color="#8b5cf6" />
                <span className="text-sm font-bold text-gray-800">Grade Demand</span>
              </div>
              {data.by_grade.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-5">No grade data yet.</p>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {data.by_grade.map((g, i) => {
                    const gradeColors = ["#8b5cf6","#6366f1","#3b82f6","#0ea5e9","#14b8a6","#10b981","#f59e0b","#ef4444","#ec4899"];
                    const color = gradeColors[i % gradeColors.length];
                    const pctVal = maxGrade ? Math.round((g.count / maxGrade) * 100) : 0;
                    const isHighDemand = pctVal >= 90;
                    return (
                      <div key={i} className="flex flex-col items-center bg-gray-50 rounded-xl p-3 gap-1">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white truncate max-w-full" style={{ background: color }}>
                          {g["school_class__name"] || "?"}
                        </span>
                        <span className="text-xl font-bold text-gray-800">{g.count}</span>
                        <SemiGauge pct={pctVal} color={color} />
                        <span className={`text-xs font-semibold ${isHighDemand ? "text-red-500" : "text-gray-400"}`}>
                          {isHighDemand ? "HIGH DEMAND" : `${pctVal}% of top`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Counsellor Leaderboard ── */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm mb-4">
            <div className="flex items-center gap-2 mb-4">
              <Trophy size={14} color="#f59e0b" />
              <span className="text-sm font-bold text-gray-800">Counsellor Leaderboard</span>
            </div>
            {data.counsellor_stats.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-5">
                No counsellor data yet. Add &quot;Assigned To&quot; when creating inquiries.
              </p>
            ) : (
              <div className="space-y-2">
                {data.counsellor_stats.map((c, i) => {
                  const initials = (c.assigned || "?").split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
                  const avatarColors = ["#6366f1","#0ea5e9","#10b981","#f59e0b","#ef4444","#ec4899","#8b5cf6"];
                  const avatarColor = avatarColors[i % avatarColors.length];
                  const isTop = i === 0;
                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-3 p-3 rounded-xl border shadow-sm ${
                        isTop ? "border-amber-300 bg-amber-50" : "bg-white border-gray-100"
                      }`}
                    >
                      {/* Rank badge */}
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        i === 0 ? "bg-amber-400 text-white" :
                        i === 1 ? "bg-gray-300 text-gray-700" :
                        i === 2 ? "bg-orange-300 text-white" :
                        "bg-gray-100 text-gray-500"
                      }`}>
                        {i === 0 ? "🏆" : i + 1}
                      </div>
                      {/* Avatar */}
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                        style={{ background: avatarColor }}
                      >
                        {initials}
                      </div>
                      {/* Name + count */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-800 truncate">{c.assigned}</div>
                        <div className="text-xs text-gray-400">{c.total} inquiries</div>
                      </div>
                      {/* Stat pills */}
                      <div className="hidden sm:flex gap-1.5">
                        <span className="text-xs bg-gray-100 text-gray-500 rounded-md px-2 py-0.5">Contacted: {c.contacted}</span>
                        <span className="text-xs bg-gray-100 text-gray-500 rounded-md px-2 py-0.5">Enrolled: {c.enrolled}</span>
                      </div>
                      {/* Conversion % */}
                      <div className={`text-lg font-bold flex-shrink-0 tabular-nums ${
                        c.conversion_pct >= 30 ? "text-green-500" :
                        c.conversion_pct >= 15 ? "text-amber-500" :
                        "text-red-400"
                      }`}>
                        {c.conversion_pct}%
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="text-xs text-gray-400 mt-3">Conversion % = enrolled ÷ assigned inquiries</p>
          </div>

          {/* ── Channel Breakdown ── */}
          {data.channel_breakdown.length > 0 && (
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm mb-4">
              <div className="flex items-center gap-2 mb-4">
                <Phone size={14} color="#0ea5e9" />
                <span className="text-sm font-bold text-gray-800">Contact Channels Used</span>
              </div>
              <div className="flex gap-3 flex-wrap">
                {data.channel_breakdown.map((ch, i) => {
                  const colors = ["#6366f1","#0ea5e9","#10b981","#f59e0b","#ef4444"];
                  const color = colors[i % colors.length];
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm"
                      style={{ background: `${color}12`, borderColor: `${color}30` }}
                    >
                      <span className="font-semibold capitalize" style={{ color }}>{ch.channel}</span>
                      <span className="text-gray-500">{ch.count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── 💡 Key Insights ── */}
          {(() => {
            const bestSource = data.by_source.length
              ? [...data.by_source].sort((a, b) => b.enrolled - a.enrolled)[0]
              : null;
            const topGrade = data.by_grade.length
              ? [...data.by_grade].sort((a, b) => b.count - a.count)[0]
              : null;
            const rate = data.enroll_rate_pct;
            return (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                {bestSource && (
                  <div className="border-l-4 border-blue-400 bg-gray-50 rounded-xl p-4 flex gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 text-sm">💡</div>
                    <div>
                      <div className="text-xs font-bold text-gray-700 mb-1">Best Lead Source</div>
                      <div className="text-xs text-gray-500">
                        <strong>{bestSource["source__name"] || "Unknown"}</strong> drives the most enrollments ({bestSource.enrolled}).
                      </div>
                    </div>
                  </div>
                )}
                <div className={`border-l-4 bg-gray-50 rounded-xl p-4 flex gap-3 ${
                  rate >= 20 ? "border-green-400" : rate >= 10 ? "border-amber-400" : "border-red-400"
                }`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm ${
                    rate >= 20 ? "bg-green-100" : rate >= 10 ? "bg-amber-100" : "bg-red-100"
                  }`}>💡</div>
                  <div>
                    <div className="text-xs font-bold text-gray-700 mb-1">Conversion Health</div>
                    <div className="text-xs text-gray-500">
                      {rate >= 20
                        ? `Strong at ${rate}% — keep nurturing leads.`
                        : rate >= 10
                        ? `Moderate at ${rate}% — follow up faster.`
                        : `Low at ${rate}% — review your pipeline.`}
                    </div>
                  </div>
                </div>
                {topGrade && (
                  <div className="border-l-4 border-purple-400 bg-gray-50 rounded-xl p-4 flex gap-3">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 text-sm">💡</div>
                    <div>
                      <div className="text-xs font-bold text-gray-700 mb-1">Top Grade Demand</div>
                      <div className="text-xs text-gray-500">
                        <strong>{topGrade["school_class__name"] || "Unknown"}</strong> has the most inquiries ({topGrade.count}).
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
