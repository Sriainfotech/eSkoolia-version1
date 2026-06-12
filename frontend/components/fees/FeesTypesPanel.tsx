"use client";

import { FormEvent, useEffect, useState } from "react";
import { feesApi, FeesGroup, FeesType, listData, AcademicYear } from "@/lib/fees-api";

function field() {
  return { width: "100%", height: 36, border: "1px solid var(--line)", borderRadius: 8, padding: "0 10px" } as const;
}

function btn(color = "var(--primary)") {
  return { height: 34, border: `1px solid ${color}`, background: color, color: "#fff", borderRadius: 8, padding: "0 10px", cursor: "pointer" } as const;
}

export default function FeesTypesPanel() {
  const [rows, setRows] = useState<FeesType[]>([]);
  const [groups, setGroups] = useState<FeesGroup[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [yearId, setYearId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const load = async () => {
    const [typeData, groupData, yearsData] = await Promise.all([feesApi.listTypes(), feesApi.listGroups(), feesApi.listAcademicYears()]);
    const y = listData(yearsData);
    setRows(listData(typeData));
    setGroups(listData(groupData));
    setYears(y);
    if (!yearId) {
      const current = y.find((it) => it.is_current) || y[0];
      if (current) setYearId(String(current.id));
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!yearId || !groupId || !name.trim() || !amount) {
      setError("Academic year, group, name and amount are required.");
      return;
    }
    try {
      setError("");
      const payload = { academic_year: Number(yearId), fees_group: Number(groupId), name: name.trim(), amount, description };
      if (editingId) {
        await feesApi.updateType(editingId, payload);
      } else {
        await feesApi.createType(payload);
      }
      setEditingId(null);
      setName("");
      setAmount("");
      setDescription("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operation failed.");
    }
  };

  return (
    <div className="legacy-panel">
      <section className="sms-breadcrumb mb-20"><div className="container-fluid"><h1 style={{ margin: 0, fontSize: 24 }}>Fees Type</h1></div></section>
      <section className="admin-visitor-area up_st_admin_visitor"><div className="container-fluid p-0">
        <div className="white-box" style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: 16, marginBottom: 12 }}>
          <h3 style={{ marginTop: 0, marginBottom: 12 }}>{editingId ? "Edit Fees Type" : "Add Fees Type"}</h3>
          <form onSubmit={submit} style={{ display: "grid", gridTemplateColumns: "150px 180px 1fr 120px 1fr auto", gap: 8 }}>
            <select value={yearId} onChange={(e) => setYearId(e.target.value)} style={field()}>
              <option value="">Academic year</option>
              {years.map((it) => <option key={it.id} value={it.id}>{it.name}</option>)}
            </select>
            <select value={groupId} onChange={(e) => setGroupId(e.target.value)} style={field()}>
              <option value="">Fees group</option>
              {groups.map((it) => <option key={it.id} value={it.id}>{it.name}</option>)}
            </select>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Type name" style={field()} />
            <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" type="number" min="0" step="0.01" style={field()} />
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" style={field()} />
            <button type="submit" style={btn()}>{editingId ? "Update" : "Save"}</button>
          </form>
          {error && <p style={{ color: "var(--warning)", marginTop: 8 }}>{error}</p>}
        </div>

        <div className="white-box" style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: 16 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Name</th><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Group</th><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Amount</th><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Action</th></tr></thead>
            <tbody>
              {rows.map((row) => {
                const group = groups.find((g) => g.id === row.fees_group);
                return (
                  <tr key={row.id}>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.name}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{group?.name || row.fees_group}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.amount}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button type="button" style={btn("#0ea5e9")} onClick={() => { setEditingId(row.id); setYearId(String(row.academic_year)); setGroupId(String(row.fees_group)); setName(row.name); setAmount(row.amount || ""); setDescription(row.description || ""); }}>Edit</button>
                        <button type="button" style={btn("#dc2626")} onClick={() => void feesApi.deleteType(row.id).then(load).catch((e) => setError(e instanceof Error ? e.message : "Delete failed."))}>Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div></section>
    </div>
  );
}
