"use client";
import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import { DUMMY_PATIENTS } from "@/lib/dummyData";
import { Search, Hospital, HeartPulse, PauseCircle, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default function PatientsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const total = DUMMY_PATIENTS.length;
  const active = DUMMY_PATIENTS.filter(p => p.status === "Active").length;
  const inactive = DUMMY_PATIENTS.filter(p => p.status === "Inactive").length;
  const completed = DUMMY_PATIENTS.filter(p => p.status === "Completed").length;

  const filtered = DUMMY_PATIENTS.filter(p => {
    const matchS = p.name.toLowerCase().includes(search.toLowerCase()) || p.id.includes(search) || p.diagnosis.toLowerCase().includes(search.toLowerCase());
    const matchF = statusFilter === "All" || p.status === statusFilter;
    return matchS && matchF;
  });

  const statusColor = (s: string) => {
    if (s === "Active") return { bg: "#f0fdf4", color: "#15803d" };
    if (s === "Completed") return { bg: "#eff6ff", color: "#1d4ed8" };
    return { bg: "#fef9c3", color: "#a16207" };
  };

  const riskColor = (r: string) => {
    if (r === "High") return "#dc2626";
    if (r === "Medium") return "#d97706";
    return "#15803d";
  };

  return (
    <div className="page-shell">
      <Sidebar />
      <main className="main-content" style={{ padding: 32 }}>
        <div style={{ marginBottom: 28 }}>
          <h1 className="heading-font" style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", margin: 0 }}>Patient Details</h1>
          <p style={{ color: "#94a3b8", fontSize: 14, marginTop: 4 }}>Complete patient registry with history</p>
        </div>

        {/* Stats */}
        <div className="responsive-grid-4" style={{ marginBottom: 28 }}>
          {[
            { label: "Total Patients", value: total, color: "#0f172a", bg: "#f8fafc", icon: Hospital },
            { label: "Active", value: active, color: "#15803d", bg: "#f0fdf4", icon: HeartPulse },
            { label: "Inactive", value: inactive, color: "#a16207", bg: "#fefce8", icon: PauseCircle },
            { label: "Completed", value: completed, color: "#1d4ed8", bg: "#eff6ff", icon: CheckCircle2 },
          ].map(c => (
            <div key={c.label} className="stat-card" style={{ background: c.bg }}>
              <div style={{ fontSize: 26, marginBottom: 8 }}><c.icon size={26} /></div>
              <div className="heading-font" style={{ fontSize: 34, fontWeight: 800, color: c.color }}>{c.value}</div>
              <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>{c.label}</div>
            </div>
          ))}
        </div>

        {/* Filter Row */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
          <div style={{ position: "relative", flex: 1, minWidth: 240 }}>
            <span style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" }}><Search size={16} /></span>
            <input className="mw-input" style={{ paddingLeft: 44 }} placeholder="Search patients..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {["All", "Active", "Inactive", "Completed"].map(f => (
            <button key={f} onClick={() => setStatusFilter(f)} style={{
              padding: "12px 20px", borderRadius: 14, border: "1.5px solid",
              borderColor: statusFilter === f ? "#1D9E75" : "#e2e8f0",
              background: statusFilter === f ? "rgba(29,158,117,0.08)" : "white",
              color: statusFilter === f ? "#1D9E75" : "#64748b",
              fontWeight: 600, fontSize: 13, cursor: "pointer", transition: "all 0.2s"
            }}>{f}</button>
          ))}
        </div>

        {/* Table */}
        <div className="table-responsive" style={{ background: "white", borderRadius: 20, overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
          <div className="responsive-table-grid responsive-table-grid-7 header" style={{ padding: "16px 24px", borderBottom: "1px solid #f1f5f9" }}>
            {["Patient", "Age/Gender", "Diagnosis", "Risk", "Status", "Registered", ""].map(h => (
              <div key={h} style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</div>
            ))}
          </div>
          {filtered.map(p => {
            const sc = statusColor(p.status);
            return (
              <div key={p.id} className="responsive-table-grid responsive-table-grid-7 row" style={{
                padding: "16px 24px", borderBottom: "1px solid #f8fafc",
                gap: 16, alignItems: "center"
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "#fafafa")}
              onMouseLeave={e => (e.currentTarget.style.background = "white")}
              >
                <div>
                  <div style={{ fontWeight: 600, color: "#0f172a", fontSize: 14 }}>{p.name}</div>
                  <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 2 }}>{p.id}</div>
                </div>
                <div style={{ fontSize: 14, color: "#475569" }}>{p.age}y • {p.gender}</div>
                <div style={{ fontSize: 13, color: "#475569" }}>{p.diagnosis}</div>
                <div style={{ color: riskColor(p.risk), fontWeight: 600, fontSize: 13 }}>{p.risk}</div>
                <div>
                  <span style={{ ...sc, padding: "4px 12px", borderRadius: 99, fontSize: 12, fontWeight: 600 }}>{p.status}</span>
                </div>
                <div style={{ fontSize: 13, color: "#64748b" }}>{p.registeredOn}</div>
                <div>
                  <Link href={`/patients/${p.id}`}>
                    <button style={{
                      padding: "7px 14px", borderRadius: 10, border: "1.5px solid #378ADD",
                      color: "#378ADD", background: "transparent", fontSize: 12, fontWeight: 600, cursor: "pointer"
                    }}>View</button>
                  </Link>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div style={{ padding: 48, textAlign: "center", color: "#94a3b8" }}>No patients found</div>
          )}
        </div>
      </main>
    </div>
  );
}
