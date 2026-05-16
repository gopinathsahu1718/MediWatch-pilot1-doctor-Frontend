
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { DUMMY_PATIENTS, Patient } from "@/lib/dummyData";
import Link from "next/link";

export default function DashboardPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<string>("All");
  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set());
  const [callModal, setCallModal] = useState<Patient | null>(null);

  const activePatients = DUMMY_PATIENTS.filter(p => p.status === "Active");
  const green = activePatients.filter(p => p.risk === "Low");
  const yellow = activePatients.filter(p => p.risk === "Medium");
  const red = activePatients.filter(p => p.risk === "High");

  const sorted = [...activePatients].sort((a, b) => {
    const order: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
    return order[a.risk] - order[b.risk];
  });

  const filtered = sorted.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.id.includes(search);
    const matchRisk = riskFilter === "All" || p.risk === riskFilter;
    return matchSearch && matchRisk;
  });

  const riskBadge = (r: string) => {
    if (r === "High") return "badge badge-red";
    if (r === "Medium") return "badge badge-yellow";
    return "badge badge-green";
  };

  return (
    <div style={{ display: "flex" }}>
      <Sidebar />
      <main className="main-content" style={{ padding: "32px 32px" }}>
        <div style={{ background: "#378ADD", padding: "20px 24px", borderRadius: 16, marginBottom: 28 }}>
          <h1 className="heading-font" style={{ fontSize: 28, fontWeight: 800, color: "white", margin: 0 }}>Dashboard</h1>
          <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 14, marginTop: 4 }}>Overview of active patients and alerts</p>
        </div>

        {/* Stat Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 20, marginBottom: 32 }}>
          {[
            { label: "Total Active", value: activePatients.length, color: "#378ADD", bg: "#eff6ff", icon: "👥" },
            { label: "Low Risk", value: green.length, color: "#15803d", bg: "#f0fdf4", icon: "🟢" },
            { label: "Medium Risk", value: yellow.length, color: "#a16207", bg: "#fefce8", icon: "🟡" },
            { label: "High Risk", value: red.length, color: "#dc2626", bg: "#fef2f2", icon: "🔴" },
          ].map(card => (
            <div key={card.label} className="stat-card" style={{ background: card.bg, border: `1px solid ${card.color}22` }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>{card.icon}</div>
              <div className="heading-font" style={{ fontSize: 36, fontWeight: 800, color: card.color }}>{card.value}</div>
              <div style={{ color: "#64748b", fontSize: 13, fontWeight: 500, marginTop: 4 }}>{card.label}</div>
            </div>
          ))}
        </div>

        {/* Search & Filter */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <span style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", fontSize: 16 }}>🔍</span>
            <input
              className="mw-input"
              style={{ paddingLeft: 44 }}
              placeholder="Search by name or patient ID..."
              value={search} onChange={e => setSearch(e.target.value)}
            />
          </div>
          {["All", "High", "Medium", "Low"].map(f => (
            <button key={f} onClick={() => setRiskFilter(f)} style={{
              padding: "12px 20px", borderRadius: 14, border: "1.5px solid",
              borderColor: riskFilter === f ? "#1D9E75" : "#e2e8f0",
              background: riskFilter === f ? "rgba(29,158,117,0.08)" : "white",
              color: riskFilter === f ? "#1D9E75" : "#64748b",
              fontWeight: 600, fontSize: 13, cursor: "pointer", transition: "all 0.2s"
            }}>{f}</button>
          ))}
        </div>

        {/* Patient List */}
        <div style={{ background: "white", borderRadius: 20, overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
          <div style={{ padding: "16px 24px", borderBottom: "1px solid #f1f5f9", display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1.5fr", gap: 16 }}>
            {["Patient", "Risk", "Diagnosis", "Days Left", "Status", "Actions"].map(h => (
              <div key={h} style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</div>
            ))}
          </div>
          {filtered.map((p) => {
            const isAck = acknowledged.has(p.id);
            return (
              <div key={p.id} style={{
                padding: "16px 24px", borderBottom: "1px solid #f8fafc",
                display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1.5fr",
                gap: 16, alignItems: "center", transition: "background 0.15s", cursor: "pointer"
              }}
              onClick={() => router.push(`/patients/${p.id}`)}
              onMouseEnter={e => (e.currentTarget.style.background = "#fafafa")}
              onMouseLeave={e => (e.currentTarget.style.background = "white")}
              >
                <div>
                  <div style={{ fontWeight: 600, color: "#0f172a", fontSize: 14 }}>{p.name}</div>
                  <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 2 }}>{p.id} • {p.age}y {p.gender}</div>
                </div>
                <div><span className={riskBadge(p.risk)}>{p.risk}</span></div>
                <div style={{ fontSize: 13, color: "#475569" }}>{p.diagnosis.split(" ").slice(0, 2).join(" ")}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>{p.monitoringDays - p.submissions.length}d</div>
                <div>
                  {isAck
                    ? <span style={{ fontSize: 12, color: "#15803d", fontWeight: 600 }}>✓ Acknowledged</span>
                    : <span style={{ fontSize: 12, color: "#94a3b8" }}>Pending</span>
                  }
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <Link href={`/patients/${p.id}`}>
                    <button onClick={e => e.stopPropagation()} style={{
                      padding: "6px 12px", borderRadius: 10, border: "1.5px solid #378ADD",
                      color: "#378ADD", background: "transparent", fontSize: 12, fontWeight: 600, cursor: "pointer"
                    }}>View</button>
                  </Link>
                  <button onClick={e => { e.stopPropagation(); setCallModal(p); }} style={{
                    padding: "6px 12px", borderRadius: 10, border: "1.5px solid #1D9E75",
                    color: "#1D9E75", background: "transparent", fontSize: 12, fontWeight: 600, cursor: "pointer"
                  }}>📞 Call</button>
                  <button onClick={e => { e.stopPropagation(); setAcknowledged(prev => new Set([...prev, p.id])); }} disabled={isAck} style={{
                    padding: "6px 12px", borderRadius: 10, border: "none",
                    background: isAck ? "#f1f5f9" : "#0f172a",
                    color: isAck ? "#94a3b8" : "white", fontSize: 12, fontWeight: 600, cursor: isAck ? "default" : "pointer"
                  }}>Ack</button>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div style={{ padding: "48px", textAlign: "center", color: "#94a3b8" }}>No patients found</div>
          )}
        </div>
      </main>

      {/* Call Modal */}
      {callModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 100
        }} onClick={() => setCallModal(null)}>
          <div style={{ background: "white", borderRadius: 24, padding: 32, width: 360, maxWidth: "90vw" }} onClick={e => e.stopPropagation()}>
            <h3 className="heading-font" style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Contact Patient</h3>
            <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 24 }}>{callModal.name}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <a href={`tel:${callModal.contact}`} style={{ textDecoration: "none" }}>
                <div style={{ padding: "14px 20px", borderRadius: 14, border: "1.5px solid #1D9E75", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 600, color: "#0f172a" }}>Patient</span>
                  <span style={{ color: "#1D9E75", fontWeight: 600 }}>{callModal.contact}</span>
                </div>
              </a>
              {callModal.relativeContact && (
                <a href={`tel:${callModal.relativeContact}`} style={{ textDecoration: "none" }}>
                  <div style={{ padding: "14px 20px", borderRadius: 14, border: "1.5px solid #378ADD", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 600, color: "#0f172a" }}>Relative</span>
                    <span style={{ color: "#378ADD", fontWeight: 600 }}>{callModal.relativeContact}</span>
                  </div>
                </a>
              )}
            </div>
            <button onClick={() => setCallModal(null)} className="btn-outline" style={{ width: "100%", marginTop: 20 }}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
