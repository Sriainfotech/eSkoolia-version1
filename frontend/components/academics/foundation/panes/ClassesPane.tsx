"use client";
import { useEffect, useState } from "react";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import type { SchoolClass, Stream, Toast } from "../types";
import ConfirmDeleteDialog from "../ConfirmDeleteDialog";

interface Props {
  classes: SchoolClass[];
  loading: boolean;
  onRefresh: () => void;
  showToast: (msg: string, tone?: Toast["tone"]) => void;
  onBack: () => void;
  onNext: () => void;
}

const LEVEL_OPTS = [
  { value: "pre",       label: "Pre-Primary",     hint: "Nursery / LKG / UKG" },
  { value: "primary",   label: "Primary",         hint: "Grade 1 – 5"          },
  { value: "middle",    label: "Middle School",   hint: "Grade 6 – 8"          },
  { value: "secondary", label: "Secondary",       hint: "Grade 9 – 10"         },
  { value: "senior",    label: "Senior Secondary",hint: "Grade 11 – 12"        },
];

const NAMES_BY_LEVEL: Record<string, string[]> = {
  pre:       ["Nursery", "LKG", "UKG"],
  primary:   Array.from({ length: 5  }, (_, i) => `Grade ${i + 1}`),
  middle:    Array.from({ length: 3  }, (_, i) => `Grade ${i + 6}`),
  secondary: Array.from({ length: 2  }, (_, i) => `Grade ${i + 9}`),
  senior:    Array.from({ length: 2  }, (_, i) => `Grade ${i + 11}`),
};

const VALID_NAMES = ["Nursery", "LKG", "UKG", ...Array.from({ length: 12 }, (_, i) => `Grade ${i + 1}`)];

const LEVEL_DEFAULTS: { name: string; level: string; strength: number }[] = [
  { name: "Nursery", level: "pre",       strength: 25 },
  { name: "LKG",     level: "pre",       strength: 25 },
  { name: "UKG",     level: "pre",       strength: 25 },
  ...Array.from({ length: 5  }, (_, i) => ({ name: `Grade ${i + 1}`,  level: "primary",   strength: 40 })),
  ...Array.from({ length: 3  }, (_, i) => ({ name: `Grade ${i + 6}`,  level: "middle",    strength: 40 })),
  ...Array.from({ length: 2  }, (_, i) => ({ name: `Grade ${i + 9}`,  level: "secondary", strength: 40 })),
  ...Array.from({ length: 2  }, (_, i) => ({ name: `Grade ${i + 11}`, level: "senior",    strength: 35 })),
];

function flatErrors(body: unknown): string {
  if (!body || typeof body !== "object") return "Failed to save.";
  const p = body as Record<string, unknown>;
  const src = (p.errors ?? p) as Record<string, unknown>;
  return Object.values(src).flatMap((v) => (Array.isArray(v) ? v : [v])).join(" ") || "Failed to save.";
}

function levelLabel(lvl: string): string {
  return LEVEL_OPTS.find((o) => o.value === lvl)?.label ?? lvl;
}

function normalizeClassName(raw: string): string {
  const cleaned = (raw || "").trim();
  if (!cleaned) return cleaned;
  const upper = cleaned.toUpperCase();
  if (upper === "NURSERY") return "Nursery";
  if (upper === "LKG") return "LKG";
  if (upper === "UKG") return "UKG";
  const m = /^(?:GRADE\s*)?(1[0-2]|[1-9])$/.exec(upper);
  if (m) return `Grade ${parseInt(m[1], 10)}`;
  return cleaned;
}

const MIN_CAPACITY = 1;
const MAX_CAPACITY = 200;
const CLASSES_PER_PAGE = 10;

function inferLevel(className: string): string {
  if (["Nursery", "LKG", "UKG"].includes(className)) return "pre";
  const num = parseInt(className.replace("Grade ", ""));
  if (num >= 11) return "senior";
  if (num >= 9)  return "secondary";
  if (num >= 6)  return "middle";
  if (num >= 1)  return "primary";
  return "";
}

export default function ClassesPane({ classes, loading, onRefresh, showToast, onBack, onNext }: Props) {
  const [level, setLevel]         = useState("primary");
  const [name, setName]           = useState("");
  const [capacity, setCapacity]   = useState("40");
  const [stream, setStream]       = useState("");
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState("");
  const [loadingDef, setLoadDef]  = useState(false);
  const [deletingId, setDelId]    = useState<number | null>(null);
  const [togglingId, setTogId]    = useState<number | null>(null);
  const [editingClassId, setEditCls] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SchoolClass | null>(null);
  const [classesPage, setClassesPage] = useState(0);

  // ── Stream state (Senior Secondary only) ──
  const [streamsList, setStreamsList] = useState<Stream[]>([]);
  const [streamsLoading, setStreamsLoading] = useState(false);
  const [selectedStreams, setSelectedStreams] = useState<Set<number>>(new Set());
  const [streamCapacities, setStreamCapacities] = useState<Record<number, string>>({});
  const [showAddStream, setShowAddStream] = useState(false);
  const [newStreamName, setNewStreamName] = useState("");
  const [addingStream, setAddingStream] = useState(false);

  async function loadStreams() {
    setStreamsLoading(true);
    try {
      const data = await apiRequestWithRefresh("/api/v1/core/streams/") as unknown;
      const list: Stream[] = Array.isArray(data) ? data : ((data as { results?: Stream[] })?.results ?? []);
      setStreamsList(list);
    } catch {
      // silent — UI still functional with empty list
    } finally { setStreamsLoading(false); }
  }

  useEffect(() => {
    void loadStreams();
  }, []);

  function toggleStream(id: number) {
    setSelectedStreams((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setStreamCapacities((prev) => {
      const next = { ...prev };
      if (next[id] === undefined) next[id] = "35";
      return next;
    });
  }

  function setStreamCapacity(id: number, value: string) {
    setStreamCapacities((prev) => ({ ...prev, [id]: value.replace(/[^0-9]/g, "").slice(0, 3) }));
  }

  async function addStream() {
    const trimmed = newStreamName.trim();
    if (!trimmed) {
      showToast("Stream name is required.", "error");
      return;
    }
    if (!/^[A-Za-z][A-Za-z0-9 /&.\-]{0,49}$/.test(trimmed)) {
      showToast("Stream name must start with a letter and use only letters, numbers, spaces, / & . -.", "error");
      return;
    }
    if (streamsList.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
      showToast(`Stream "${trimmed}" already exists.`, "error");
      return;
    }
    setAddingStream(true);
    try {
      const created = await apiRequestWithRefresh("/api/v1/core/streams/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const createdStream: Stream | undefined = created && typeof created === "object" ? (created as Stream) : undefined;
      if (createdStream?.id) {
        setStreamsList((prev) => [...prev, createdStream].sort((a, b) => a.name.localeCompare(b.name)));
        setSelectedStreams((prev) => new Set(prev).add(createdStream.id));
      } else {
        await loadStreams();
      }
      setNewStreamName("");
      setShowAddStream(false);
      showToast(`Stream "${trimmed}" added.`);
    } catch (err: unknown) {
      let msg = "Failed to add stream.";
      if (err instanceof Error) {
        try { msg = flatErrors(JSON.parse(err.message) as unknown) || err.message; }
        catch { msg = err.message; }
      }
      showToast(msg, "error");
    } finally { setAddingStream(false); }
  }

  function handleLevelChange(newLevel: string) {
    setLevel(newLevel);
    setName("");
    setStream("");
    setSelectedStreams(new Set());
    setStreamCapacities({});
    setShowAddStream(false);
    setNewStreamName("");
    // auto-set sensible default capacity by level
    const caps: Record<string, string> = {
      pre: "25", primary: "40", middle: "40", secondary: "40", senior: "35",
    };
    setCapacity(caps[newLevel] ?? "40");
  }

  async function addClass() {
    if (!name) { setError("Class name is required."); return; }
    const isSenior = level === "senior";

    if (classes.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      const msg = `Class "${name}" already exists. Please choose a different name.`;
      setError(msg);
      showToast(msg, "error");
      return;
    }

    let body: Record<string, unknown> = { name };

    if (isSenior) {
      if (selectedStreams.size === 0) {
        const msg = "Select at least one stream for Senior Secondary classes.";
        setError(msg); showToast(msg, "error"); return;
      }
      const streamCaps: { stream: number; capacity: number }[] = [];
      for (const sid of Array.from(selectedStreams)) {
        const raw = streamCapacities[sid] ?? "";
        const capInt = parseInt(raw, 10);
        const sName = streamsList.find((s) => s.id === sid)?.name ?? `Stream ${sid}`;
        if (!Number.isFinite(capInt) || capInt < MIN_CAPACITY || capInt > MAX_CAPACITY) {
          const msg = `${sName} capacity must be between ${MIN_CAPACITY} and ${MAX_CAPACITY}.`;
          setError(msg); showToast(msg, "error"); return;
        }
        streamCaps.push({ stream: sid, capacity: capInt });
      }
      body.stream_capacities = streamCaps;
    } else {
      const capInt = parseInt(capacity, 10);
      if (!Number.isFinite(capInt) || capInt < MIN_CAPACITY || capInt > MAX_CAPACITY) {
        const msg = `Capacity must be between ${MIN_CAPACITY} and ${MAX_CAPACITY} students per section.`;
        setError(msg); showToast(msg, "error"); return;
      }
      body.capacity = capInt;
    }

    setSaving(true); setError("");
    try {
      await apiRequestWithRefresh("/api/v1/core/classes/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      showToast(`Class "${name}" created.`);
      setName("");
      setSelectedStreams(new Set());
      setStreamCapacities({});
      onRefresh();
    } catch (err: unknown) {
      let msg = "Failed to save class.";
      if (err instanceof Error) {
        try {
          const parsed = JSON.parse(err.message) as unknown;
          msg = flatErrors(parsed) || err.message;
        } catch { msg = err.message; }
      }
      if (/already exists|unique|duplicate/i.test(msg)) {
        msg = `Class "${name}" already exists. Please choose a different name.`;
      }
      setError(msg);
      showToast(msg, "error");
    } finally { setSaving(false); }
  }

  async function loadDefaults() {
    setLoadDef(true);
    let created = 0;
    for (const c of LEVEL_DEFAULTS) {
      const alreadyExists = classes.some((cls) => cls.name.toLowerCase() === c.name.toLowerCase());
      if (alreadyExists) continue;
      try {
        await apiRequestWithRefresh("/api/v1/core/classes/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: c.name }),
        });
        created++;
      } catch { /* skip duplicates */ }
    }
    showToast(`${created > 0 ? `${created} classes` : "All classes already exist"} — done ✓`);
    onRefresh();
    setLoadDef(false);
  }

  async function deleteClass(cls: SchoolClass) {
    setPendingDelete(cls);
  }

  async function confirmDeleteClass() {
    const cls = pendingDelete;
    if (!cls) return;
    setDelId(cls.id);
    try {
      await apiRequestWithRefresh(`/api/v1/core/classes/${cls.id}/`, { method: "DELETE" });
      showToast(`"${cls.name}" deleted.`);
      setPendingDelete(null);
      onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (/\b404\b|not[_ ]?found|No Class matches/i.test(msg)) {
        showToast("This class no longer exists. Refreshing the list\u2026", "error");
        setPendingDelete(null);
        onRefresh();
      } else {
        showToast("Failed to delete.", "error");
      }
    }
    finally { setDelId(null); }
  }

  async function toggleClassActive(cls: SchoolClass) {
    setTogId(cls.id);
    try {
      await apiRequestWithRefresh(`/api/v1/core/classes/${cls.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !cls.is_active }),
      });
      showToast(`"${cls.name}" marked ${!cls.is_active ? "active" : "inactive"}.`);
      onRefresh();
    } catch { showToast("Failed to update.", "error"); }
    finally { setTogId(null); }
  }

  function openEditClass(cls: SchoolClass) {
    const lvl = inferLevel(cls.name);
    setLevel(lvl || "primary");
    setName(cls.name);
    setStream("");
    setCapacity("40");
    setEditCls(cls.id);
    setError("");
    const initial = new Set<number>();
    const caps: Record<number, string> = {};
    (cls.stream_details ?? []).forEach((s) => {
      if (typeof s.id === "number") {
        initial.add(s.id);
        caps[s.id] = String(s.capacity ?? 35);
      }
    });
    setSelectedStreams(initial);
    setStreamCapacities(caps);
    setShowAddStream(false);
    setNewStreamName("");
  }

  function cancelEditClass() {
    setEditCls(null);
    setName("");
    setLevel("primary");
    setCapacity("40");
    setStream("");
    setSelectedStreams(new Set());
    setStreamCapacities({});
    setShowAddStream(false);
    setNewStreamName("");
    setError("");
  }

  async function updateClass() { // Fix #2F — PATCH the class being edited (editingClassId is set by openEditClass)
    if (!name || !editingClassId) return;
    const isSenior = level === "senior";
    setSaving(true); setError("");
    try {
      const body: Record<string, unknown> = { name };
      if (isSenior) {
        if (selectedStreams.size === 0) {
          const msg = "Select at least one stream for Senior Secondary classes.";
          setError(msg); showToast(msg, "error"); setSaving(false); return;
        }
        const streamCaps: { stream: number; capacity: number }[] = [];
        for (const sid of Array.from(selectedStreams)) {
          const raw = streamCapacities[sid] ?? "";
          const capInt = parseInt(raw, 10);
          const sName = streamsList.find((s) => s.id === sid)?.name ?? `Stream ${sid}`;
          if (!Number.isFinite(capInt) || capInt < MIN_CAPACITY || capInt > MAX_CAPACITY) {
            const msg = `${sName} capacity must be between ${MIN_CAPACITY} and ${MAX_CAPACITY}.`;
            setError(msg); showToast(msg, "error"); setSaving(false); return;
          }
          streamCaps.push({ stream: sid, capacity: capInt });
        }
        body.stream_capacities = streamCaps;
      } else {
        body.stream_capacities = [];
      }
      await apiRequestWithRefresh(`/api/v1/core/classes/${editingClassId}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      showToast(`Class updated to "${name}".`);
      cancelEditClass();
      onRefresh();
    } catch (err: unknown) {
      if (err instanceof Error) {
        // 404 → row was deleted server-side; refresh and bail out cleanly.
        if (/\b404\b|not[_ ]?found|No Class matches/i.test(err.message)) {
          const msg = "This class no longer exists. Refreshing the list…";
          showToast(msg, "error");
          cancelEditClass();
          onRefresh();
          return;
        }
        try { setError(flatErrors(JSON.parse(err.message) as unknown)); return; } catch { /**/ }
        setError(err.message);
      } else setError("Failed to update.");
    } finally { setSaving(false); }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* ── Left: form ── */}
      <div className="bg-white rounded-xl border border-[#E8ECEF] shadow-[0_1px_4px_rgba(0,0,0,.08)] p-5">
        {/* Card header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-[14px] font-bold text-[#1A1D1F]">
              {editingClassId ? "Edit Class" : "Add Class / Grade"}
            </div>
            <div className="text-[11px] text-[#6F767E] mt-0.5">
              {editingClassId ? "Update this class name" : "Configure each academic level and its classes"}
            </div>
          </div>
          {editingClassId && (
            <button
              onClick={cancelEditClass}
              className="text-[11px] text-[#6F767E] hover:text-[#1A1D1F] px-2 py-1 rounded border border-[#E8ECEF] hover:bg-[#F0F2F5] transition-colors"
            >
              ✕ Cancel
            </button>
          )}
        </div>

        {/* ── Step 1: Academic Level ── */}
        <div className="mb-1">
          <label className="text-[11px] font-semibold text-[#6F767E] uppercase tracking-wide block mb-1.5">
            Academic Level <span className="text-[#EF4444]">*</span>
          </label>
          <div className="grid grid-cols-1 gap-1.5">
            {LEVEL_OPTS.map((o) => (
              <label
                key={o.value}
                className={[
                  "flex items-center gap-3 px-3 py-2 rounded-[10px] border-[1.5px] cursor-pointer transition-all",
                  level === o.value
                    ? "border-[#5B4FCF] bg-[#F5F3FF]"
                    : "border-[#E8ECEF] bg-[#F0F2F5] hover:border-[#C7C3F0] hover:bg-white",
                ].join(" ")}
              >
                <input
                  type="radio"
                  name="level"
                  value={o.value}
                  checked={level === o.value}
                  onChange={() => handleLevelChange(o.value)}
                  className="accent-[#5B4FCF] w-3.5 h-3.5 flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <span className={[
                    "text-[13px] font-semibold",
                    level === o.value ? "text-[#5B4FCF]" : "text-[#1A1D1F]",
                  ].join(" ")}>
                    {o.label}
                  </span>
                  <span className="ml-2 text-[11px] text-[#9FA6AD]">{o.hint}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* ── Divider ── */}
        <div className="border-t border-dashed border-[#E8ECEF] my-3.5" />

        {/* ── Step 2: Class / Grade Name ── */}
        <div className="mb-3">
          <label className="text-[11px] font-semibold text-[#6F767E] uppercase tracking-wide block mb-1">
            Class / Grade Name <span className="text-[#EF4444]">*</span>
          </label>
          <select
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-[#F0F2F5] border-[1.5px] border-[#E8ECEF] rounded-[10px] px-2.5 py-2 text-[13px] text-[#1A1D1F] outline-none focus:border-[#5B4FCF] focus:bg-white transition-colors"
          >
            <option value="">— select class —</option>
            {(NAMES_BY_LEVEL[level] ?? VALID_NAMES).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <p className="text-[11px] text-[#9FA6AD] mt-1">
            Only names valid for <span className="font-semibold">{LEVEL_OPTS.find((o) => o.value === level)?.label}</span> are shown.
          </p>
        </div>

        {/* ── Stream (Senior Secondary only) ── */}
        {level === "senior" && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold text-[#6F767E] uppercase tracking-wide">
                Streams
              </label>
              <button
                type="button"
                onClick={() => { setShowAddStream((v) => !v); setNewStreamName(""); }}
                className="text-[11px] font-semibold text-[#5B4FCF] hover:text-[#4A3FBF] px-2 py-0.5 rounded-md hover:bg-[#EEF0FF] transition-colors"
              >
                {showAddStream ? "× Cancel" : "+ Add Stream"}
              </button>
            </div>

            <div className="bg-[#F0F2F5] border-[1.5px] border-[#E8ECEF] rounded-[10px] p-2.5 min-h-[44px]">
              {streamsLoading ? (
                <span className="text-[12px] text-[#9FA6AD] italic">Loading streams…</span>
              ) : streamsList.length === 0 ? (
                <span className="text-[12px] text-[#9FA6AD] italic">No streams yet — use “+ Add Stream”.</span>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {streamsList.map((s) => {
                    const sel = selectedStreams.has(s.id);
                    return (
                      <label
                        key={s.id}
                        className={[
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold border cursor-pointer transition-all select-none",
                          sel
                            ? "bg-[#5B4FCF] text-white border-[#5B4FCF]"
                            : "bg-white text-[#6F767E] border-[#D2D7DC] hover:border-[#5B4FCF] hover:text-[#5B4FCF]",
                        ].join(" ")}
                      >
                        <input
                          type="checkbox"
                          checked={sel}
                          onChange={() => toggleStream(s.id)}
                          className="w-3 h-3 accent-white"
                        />
                        {s.name}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {selectedStreams.size > 0 && (
              <div className="mt-2.5 space-y-1.5">
                <div className="text-[11px] font-semibold text-[#6F767E] uppercase tracking-wide">
                  Stream Capacities
                </div>
                <div className="bg-white border-[1.5px] border-[#E8ECEF] rounded-[10px] divide-y divide-[#E8ECEF]">
                  {streamsList
                    .filter((s) => selectedStreams.has(s.id))
                    .map((s) => (
                      <div key={s.id} className="flex items-center justify-between gap-2 px-3 py-2">
                        <span className="text-[13px] font-semibold text-[#1A1D1F]">{s.name}</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={MIN_CAPACITY}
                            max={MAX_CAPACITY}
                            value={streamCapacities[s.id] ?? ""}
                            onChange={(e) => setStreamCapacity(s.id, e.target.value)}
                            placeholder="35"
                            className="w-20 bg-[#F0F2F5] border-[1.5px] border-[#E8ECEF] rounded-[10px] px-2 py-1.5 text-[13px] text-[#1A1D1F] outline-none focus:border-[#5B4FCF] focus:bg-white transition-colors text-center"
                          />
                          <span className="text-[11px] text-[#9FA6AD]">students</span>
                        </div>
                      </div>
                    ))}
                </div>
                <p className="text-[11px] text-[#9FA6AD]">
                  Capacity is set per stream (1–{MAX_CAPACITY}). Default {35}.
                </p>
              </div>
            )}

            {showAddStream && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  autoFocus
                  value={newStreamName}
                  onChange={(e) => setNewStreamName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void addStream(); } if (e.key === "Escape") { setShowAddStream(false); setNewStreamName(""); } }}
                  placeholder="e.g. Science with CS"
                  maxLength={50}
                  className="flex-1 bg-white border-[1.5px] border-[#5B4FCF] rounded-[10px] px-2.5 py-1.5 text-[13px] text-[#1A1D1F] outline-none"
                />
                <button
                  type="button"
                  onClick={() => void addStream()}
                  disabled={addingStream}
                  className="px-3 py-1.5 rounded-[10px] bg-[#5B4FCF] text-white text-[12px] font-semibold hover:bg-[#4A3FBF] disabled:opacity-50 transition-colors"
                >
                  {addingStream ? "Adding…" : "Save"}
                </button>
              </div>
            )}

            <p className="text-[11px] text-[#9FA6AD] mt-1">
              Tick one or more streams for this class. Applies to Grade 11 &amp; 12 only.
            </p>
          </div>
        )}

        {/* ── Maximum Student Capacity (hidden for Senior Secondary — use per-stream capacities instead;
             also hidden in edit mode since capacity is write-only in the API and cannot be pre-populated) ── */}  {/* Fix #W3 */}
        {level !== "senior" && !editingClassId && (
          <div className="mb-3.5">
            <label className="text-[11px] font-semibold text-[#6F767E] uppercase tracking-wide block mb-1">Maximum Student Capacity</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={capacity}
                min={MIN_CAPACITY}
                max={MAX_CAPACITY}
                onChange={(e) => setCapacity(e.target.value)}
                className="w-24 bg-[#F0F2F5] border-[1.5px] border-[#E8ECEF] rounded-[10px] px-2.5 py-2 text-[13px] text-[#1A1D1F] outline-none focus:border-[#5B4FCF] focus:bg-white transition-colors text-center"
              />
              <span className="text-[12px] text-[#9FA6AD]">students per section · max {MAX_CAPACITY}</span>
            </div>
          </div>
        )}

        {error && (
          <p className="text-[12px] text-[#B91C1C] bg-[#FEE2E2] border border-[#FCA5A5] rounded-[10px] px-3 py-2 mb-3">
            {error}
          </p>
        )}

        <div className="flex gap-2 flex-wrap">
          {editingClassId ? (
            <>
              <button
                onClick={() => void updateClass()}
                disabled={saving}
                className="flex items-center gap-1.5 px-3.5 py-[7px] rounded-[10px] bg-[#5B4FCF] text-white text-[13px] font-semibold hover:bg-[#4A3FBF] disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving…" : "Update Class"}
              </button>
              <button
                onClick={cancelEditClass}
                className="px-3.5 py-[7px] rounded-[10px] border border-[#E8ECEF] text-[13px] text-[#6F767E] hover:bg-[#F0F2F5] transition-colors"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => void addClass()}
                disabled={saving}
                className="flex items-center gap-1.5 px-3.5 py-[7px] rounded-[10px] bg-[#5B4FCF] text-white text-[13px] font-semibold hover:bg-[#4A3FBF] disabled:opacity-50 transition-colors"
              >
                {saving ? "Adding…" : "+ Add Class"}
              </button>
              <button
                onClick={() => void loadDefaults()}
                disabled={loadingDef}
                className="flex items-center gap-1.5 px-3.5 py-[7px] rounded-[10px] bg-[#EEF0FF] text-[#5B4FCF] text-[13px] font-semibold hover:bg-[#DDD9F5] disabled:opacity-50 transition-colors"
              >
                {loadingDef ? "Loading…" : "📋 Load All (Nursery–12)"}
              </button>
            </>
          )}
        </div>

        <div className="flex gap-2 mt-3">
          <button onClick={onBack} className="px-3 py-[7px] rounded-[10px] border border-[#E8ECEF] text-[13px] text-[#6F767E] hover:bg-[#F0F2F5] transition-colors">← Back</button>
          <button onClick={onNext} className="px-3 py-[7px] rounded-[10px] border border-[#E8ECEF] text-[13px] text-[#6F767E] hover:bg-[#F0F2F5] transition-colors">Next: Sections →</button>
        </div>
      </div>

      {/* ── Right: classes table ── */}
      <div className="bg-white rounded-xl border border-[#E8ECEF] shadow-[0_1px_4px_rgba(0,0,0,.08)] p-5">
        <div className="flex items-center justify-between mb-3.5">
          <div className="text-[14px] font-bold text-[#1A1D1F]">Classes Defined</div>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-[#EEF0FF] text-[#5B4FCF] text-[11px] font-bold">
            {classes.length} classes
          </span>
        </div>
        {loading ? (
          <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-10 rounded-lg bg-[#F0F2F5] animate-pulse" />)}</div>
        ) : classes.length === 0 ? (
          <div className="text-center py-10 text-[#9FA6AD]">
            <p className="text-2xl mb-2">🏫</p>
            <p className="text-[13px] font-medium">No classes yet</p>
            <p className="text-[11px] mt-1">Use the form or load all defaults.</p>
          </div>
        ) : (() => {
          const totalPages = Math.ceil(classes.length / CLASSES_PER_PAGE);
          const safePage   = Math.min(classesPage, totalPages - 1);
          const pageClasses = classes.slice(safePage * CLASSES_PER_PAGE, (safePage + 1) * CLASSES_PER_PAGE);
          return (
          <>
          <div className="overflow-x-auto rounded-[10px] border border-[#E8ECEF]">
            <table className="w-full border-collapse text-[13px]">
              <thead className="bg-[#F0F2F5]">
                <tr>
                  {["Class", "Level", "Status", ""].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-[11px] font-bold text-[#6F767E] uppercase tracking-wide border-b border-[#E8ECEF] whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageClasses.map((cls) => (
                  <tr
                    key={cls.id}
                    className={[
                      "hover:bg-[#FAFBFC] transition-colors",
                      !cls.is_active ? "opacity-50" : "",
                      editingClassId === cls.id ? "bg-[#F5F3FF]" : "",
                    ].join(" ")}
                  >
                    <td className="px-3 py-2.5 border-b border-[#E8ECEF] font-semibold text-[#1A1D1F]">{normalizeClassName(cls.name)}</td>
                    <td className="px-3 py-2.5 border-b border-[#E8ECEF] text-[#6F767E]">{levelLabel(inferLevel(normalizeClassName(cls.name)))}</td>
                    {/* Active / Inactive toggle */}
                    <td className="px-3 py-2.5 border-b border-[#E8ECEF]">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={cls.is_active}
                          disabled={togglingId === cls.id}
                          onClick={() => void toggleClassActive(cls)}
                          title={cls.is_active ? "Active — click to deactivate" : "Inactive — click to activate"}
                          className={[
                            "relative inline-flex h-[18px] w-[30px] flex-shrink-0 rounded-full border border-transparent transition-colors duration-200 focus:outline-none hover:opacity-90",
                            cls.is_active ? "bg-[#5B4FCF]" : "bg-[#D2D7DC]",
                            togglingId === cls.id ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
                          ].join(" ")}
                        >
                          <span className={[
                            "pointer-events-none inline-block h-[14px] w-[14px] mt-px transform rounded-full bg-white shadow-sm transition duration-200",
                            cls.is_active ? "translate-x-[13px]" : "translate-x-px",
                          ].join(" ")} />
                        </button>
                        <span className={`text-[10px] font-semibold ${cls.is_active ? "text-[#15803D]" : "text-[#9FA6AD]"}`}>
                          {cls.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </td>
                    {/* Edit + Delete actions */}
                    <td className="px-3 py-2.5 border-b border-[#E8ECEF]">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditClass(cls)}
                          title="Edit class"
                          className="p-1 rounded text-[#6F767E] hover:bg-[#EEF0FF] hover:text-[#5B4FCF] transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                        <button
                          onClick={() => void deleteClass(cls)}
                          disabled={deletingId === cls.id}
                          title="Delete class"
                          className="p-1 rounded text-[#9FA6AD] hover:bg-[#FEE2E2] hover:text-[#B91C1C] disabled:opacity-40 transition-colors"
                        >
                          {deletingId === cls.id
                            ? <span className="text-[11px]">…</span>
                            : <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                              </svg>
                          }
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-[#F0F2F5]">
              <span className="text-[10px] text-[#9FA6AD]">
                {safePage * CLASSES_PER_PAGE + 1}–{Math.min((safePage + 1) * CLASSES_PER_PAGE, classes.length)} of {classes.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setClassesPage((p) => Math.max(0, p - 1))}
                  disabled={safePage === 0}
                  className="w-6 h-6 flex items-center justify-center rounded-[6px] border border-[#E8ECEF] text-[#6F767E] hover:bg-[#EEF0FF] hover:text-[#5B4FCF] hover:border-[#C7C2F0] disabled:opacity-30 disabled:cursor-not-allowed transition-all text-[13px] font-bold"
                  title="Previous page"
                >&lt;</button>
                <span className="text-[10px] text-[#6F767E] min-w-[40px] text-center">{safePage + 1} / {totalPages}</span>
                <button
                  onClick={() => setClassesPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={safePage === totalPages - 1}
                  className="w-6 h-6 flex items-center justify-center rounded-[6px] border border-[#E8ECEF] text-[#6F767E] hover:bg-[#EEF0FF] hover:text-[#5B4FCF] hover:border-[#C7C2F0] disabled:opacity-30 disabled:cursor-not-allowed transition-all text-[13px] font-bold"
                  title="Next page"
                >&gt;</button>
              </div>
            </div>
          )}
          </>
          );
        })()}
      </div>

      <ConfirmDeleteDialog
        open={!!pendingDelete}
        title="Delete Class"
        message={
          <>
            Are you sure you want to delete <strong>“{pendingDelete?.name}”</strong>? All sections,
            stream links and other related records under this class will be removed.
          </>
        }
        loading={deletingId === pendingDelete?.id}
        onConfirm={() => void confirmDeleteClass()}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
