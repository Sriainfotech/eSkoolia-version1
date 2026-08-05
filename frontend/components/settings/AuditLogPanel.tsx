"use client";

import { useEffect, useState } from "react";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import { buildPaginationQuery, extractListData, extractPaginationMeta, type ListApiResponse } from "@/lib/pagination";
import { PaginationControls } from "@/components/common/PaginationControls";

interface AuditLogEntry {
  id: number;
  actor_name: string;
  action: string;
  object_type: string;
  object_id: string;
  ip_address: string | null;
  created_at: string;
}

export function AuditLogPanel() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [moduleFilter, setModuleFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [actorFilter, setActorFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const load = async (targetPage = page) => {
    setLoading(true);
    setError(null);
    try {
      const query = buildPaginationQuery(targetPage, pageSize, {
        module: moduleFilter,
        action: actionFilter,
        actor: actorFilter,
        date_from: dateFrom,
        date_to: dateTo,
      });
      const data = await apiRequestWithRefresh<ListApiResponse<AuditLogEntry>>(`/api/v1/settings/audit-log/?${query}`);
      setEntries(extractListData(data));
      setTotalCount(extractPaginationMeta(data)?.count ?? extractListData(data).length);
      setPage(targetPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load audit log.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ background: "var(--bg-1)", border: "1px solid var(--bd)", borderRadius: 18, boxShadow: "var(--sh-1)", padding: "28px 30px" }}>
      <h1 style={{ fontSize: 34, fontWeight: 600, color: "var(--ink-1)", margin: "0 0 5px", lineHeight: 1.05, letterSpacing: "-0.03em", display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        Audit{" "}
        <em style={{ fontFamily: "var(--font-instrument-serif,'Instrument Serif',Georgia,serif)", fontWeight: 400, fontStyle: "italic", color: "var(--pu)", fontSize: 38, letterSpacing: "-0.02em" }}>
          Log
        </em>
      </h1>
      <p style={{ margin: 0, fontSize: 13, color: "var(--ink-2)", marginTop: 10, lineHeight: 1.55 }}>
        Every change made through the Settings module — leave policy, holidays, SMTP, documents, attendance rules.
      </p>

      <div style={{ marginTop: 20, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input placeholder="Module (e.g. LeaveType)" value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} style={{ border: "1px solid var(--bd)", borderRadius: 10, padding: "8px 10px", fontSize: 13 }} />
        <input placeholder="Action contains…" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} style={{ border: "1px solid var(--bd)", borderRadius: 10, padding: "8px 10px", fontSize: 13 }} />
        <input placeholder="Actor username" value={actorFilter} onChange={(e) => setActorFilter(e.target.value)} style={{ border: "1px solid var(--bd)", borderRadius: 10, padding: "8px 10px", fontSize: 13 }} />
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ border: "1px solid var(--bd)", borderRadius: 10, padding: "8px 10px", fontSize: 13 }} />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ border: "1px solid var(--bd)", borderRadius: 10, padding: "8px 10px", fontSize: 13 }} />
        <button onClick={() => void load(1)} style={{ background: "var(--pu)", color: "#fff", border: "none", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          Filter
        </button>
        <button
          onClick={() => { setModuleFilter(""); setActionFilter(""); setActorFilter(""); setDateFrom(""); setDateTo(""); void load(1); }}
          style={{ background: "transparent", border: "1px solid var(--bd)", borderRadius: 10, padding: "8px 16px", fontSize: 13, cursor: "pointer", color: "var(--ink-2)" }}
        >
          Clear
        </button>
      </div>

      {error && <div style={{ marginTop: 16, color: "var(--err)", fontSize: 13 }}>{error}</div>}
      {loading && <div style={{ marginTop: 24, color: "var(--ink-2)", fontSize: 14 }}>Loading…</div>}

      {!loading && (
        <>
          <table style={{ width: "100%", marginTop: 20, borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--ink-2)", borderBottom: "1px solid var(--bd)" }}>
                <th style={{ padding: "8px 6px" }}>When</th>
                <th style={{ padding: "8px 6px" }}>Actor</th>
                <th style={{ padding: "8px 6px" }}>Action</th>
                <th style={{ padding: "8px 6px" }}>Object</th>
                <th style={{ padding: "8px 6px" }}>IP</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} style={{ borderBottom: "1px solid var(--bd)" }}>
                  <td style={{ padding: "8px 6px", color: "var(--ink-2)" }}>{new Date(e.created_at).toLocaleString()}</td>
                  <td style={{ padding: "8px 6px", color: "var(--ink-1)" }}>{e.actor_name}</td>
                  <td style={{ padding: "8px 6px", color: "var(--ink-1)" }}>{e.action}</td>
                  <td style={{ padding: "8px 6px", color: "var(--ink-2)" }}>{e.object_type} {e.object_id && `#${e.object_id}`}</td>
                  <td style={{ padding: "8px 6px", color: "var(--ink-2)" }}>{e.ip_address ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {entries.length === 0 && <div style={{ marginTop: 16, color: "var(--ink-2)", fontSize: 14 }}>No matching audit entries.</div>}

          <div style={{ marginTop: 16 }}>
            <PaginationControls
              currentPage={page}
              totalPages={Math.max(1, Math.ceil(totalCount / pageSize))}
              totalItems={totalCount}
              pageSize={pageSize}
              loading={loading}
              onPageChange={(p) => void load(p)}
              onPageSizeChange={() => {}}
              pageSizeOptions={[pageSize]}
            />
          </div>
        </>
      )}
    </div>
  );
}
