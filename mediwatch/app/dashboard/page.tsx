"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { DUMMY_PATIENTS, Patient } from "@/lib/dummyData";
import { Search, Users, ShieldCheck, Activity, AlertTriangle, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<string>("All");
  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set());
  const [callModal, setCallModal] = useState<Patient | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  const activePatients = DUMMY_PATIENTS.filter(p => p.status === "Active");
  const green = activePatients.filter(p => p.risk === "Low");
  const yellow = activePatients.filter(p => p.risk === "Medium");
  const red = activePatients.filter(p => p.risk === "High");

  const sorted = [...activePatients].sort((a, b) => {
    const order: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
    return order[a.risk] - order[b.risk];
  });

  const filtered = sorted.filter(p => {
    const matchSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) || p.id.includes(search);
    const matchRisk = riskFilter === "All" || p.risk === riskFilter;
    return matchSearch && matchRisk;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Reset to page 1 when search or filter changes
  const handleSearch = (val: string) => { setSearch(val); setCurrentPage(1); };
  const handleFilter = (val: string) => { setRiskFilter(val); setCurrentPage(1); };

  // Build page number array with ellipsis: e.g. [1, '…', 4, 5, 6, '…', 12]
  const getPageNumbers = (): (number | "…")[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "…")[] = [1];
    if (safePage > 3) pages.push("…");
    for (let i = Math.max(2, safePage - 1); i <= Math.min(totalPages - 1, safePage + 1); i++) {
      pages.push(i);
    }
    if (safePage < totalPages - 2) pages.push("…");
    pages.push(totalPages);
    return pages;
  };

  const riskBadge = (r: string) => {
    if (r === "High") return "badge badge-red";
    if (r === "Medium") return "badge badge-yellow";
    return "badge badge-green";
  };

  return (
    <div className="page-shell">
      <Sidebar />
      <main className="main-content">

        {/* Page Header */}
        <div
          style={{
            background: "#378ADD",
            padding: "20px 24px",
            borderRadius: 16,
            marginBottom: 28,
          }}
        >
          <h1
            className="heading-font"
            style={{ fontSize: 28, fontWeight: 800, color: "white", margin: 0 }}
          >
            Dashboard
          </h1>
          <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 14, marginTop: 4 }}>
            Overview of active patients and alerts
          </p>
        </div>

        {/* Stat Cards */}
        <div className="responsive-grid-4" style={{ marginBottom: 32 }}>
          {[
            { label: "Total Active", value: activePatients.length, color: "#378ADD", bg: "#eff6ff", icon: Users },
            { label: "Low Risk",     value: green.length,          color: "#15803d", bg: "#f0fdf4", icon: ShieldCheck },
            { label: "Medium Risk",  value: yellow.length,         color: "#a16207", bg: "#fefce8", icon: Activity },
            { label: "High Risk",    value: red.length,            color: "#dc2626", bg: "#fef2f2", icon: AlertTriangle },
          ].map(card => (
            <div
              key={card.label}
              className="stat-card"
              style={{ background: card.bg, border: `1px solid ${card.color}22` }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
                <card.icon size={28} color={card.color} />
                <div
                  className="heading-font"
                  style={{ fontSize: 36, fontWeight: 800, color: card.color }}
                >
                  {card.value}
                </div>
              </div>
              <div style={{ color: "#64748b", fontSize: 13, fontWeight: 500, marginTop: 4 }}>
                {card.label}
              </div>
            </div>
          ))}
        </div>

        {/* ── Search + Filter bar ── */}
        <div className="dashboard-search-bar" style={{ marginBottom: 20 }}>
          {/* Search input */}
          <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
            <span
              style={{
                position: "absolute",
                left: 16,
                top: "50%",
                transform: "translateY(-50%)",
                display: "inline-flex",
                alignItems: "center",
                color: "#94a3b8",
              }}
            >
              <Search size={16} />
            </span>
            <input
              className="mw-input"
              style={{ paddingLeft: 44 }}
              placeholder="Search by name or patient ID…"
              value={search}
              onChange={e => handleSearch(e.target.value)}
            />
          </div>

          {/* Desktop filter chips — hidden on mobile */}
          <div className="filter-chips-desktop">
            {["All", "High", "Medium", "Low"].map(f => (
              <button
                key={f}
                onClick={() => handleFilter(f)}
                style={{
                  padding: "12px 20px",
                  borderRadius: 14,
                  border: "1.5px solid",
                  borderColor: riskFilter === f ? "#1D9E75" : "#e2e8f0",
                  background: riskFilter === f ? "rgba(29,158,117,0.08)" : "white",
                  color: riskFilter === f ? "#1D9E75" : "#64748b",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                  transition: "all 0.2s",
                  whiteSpace: "nowrap",
                }}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Mobile filter toggle */}
          <button
            className="filter-toggle-mobile"
            onClick={() => setFilterOpen(v => !v)}
            style={{
              alignItems: "center",
              gap: 6,
              padding: "12px 16px",
              borderRadius: 14,
              border: "1.5px solid",
              borderColor: riskFilter !== "All" ? "#1D9E75" : "#e2e8f0",
              background: riskFilter !== "All" ? "rgba(29,158,117,0.08)" : "white",
              color: riskFilter !== "All" ? "#1D9E75" : "#64748b",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <SlidersHorizontal size={15} />
            {riskFilter !== "All" ? riskFilter : "Filter"}
          </button>
        </div>

        {/* Mobile filter drawer */}
        {filterOpen && (
          <div
            className="mobile-filter-drawer"
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 16,
              padding: "14px 16px",
              background: "white",
              borderRadius: 16,
              boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
            }}
          >
            {["All", "High", "Medium", "Low"].map(f => (
              <button
                key={f}
                onClick={() => { handleFilter(f); setFilterOpen(false); }}
                style={{
                  padding: "9px 18px",
                  borderRadius: 99,
                  border: "1.5px solid",
                  borderColor: riskFilter === f ? "#1D9E75" : "#e2e8f0",
                  background: riskFilter === f ? "rgba(29,158,117,0.08)" : "#f8fafc",
                  color: riskFilter === f ? "#1D9E75" : "#64748b",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                {f}
              </button>
            ))}
          </div>
        )}

        {/* ── Patient List — desktop table / mobile cards ── */}
        <div
          className="table-responsive patient-list-wrap"
          style={{
            background: "white",
            borderRadius: 20,
            overflow: "hidden",
            boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
          }}
        >
          {/* Desktop table header */}
          <div
            className="patient-table-header responsive-table-grid responsive-table-grid-6 header"
            style={{ padding: "16px 24px", borderBottom: "1px solid #f1f5f9" }}
          >
            {["Patient", "Risk", "Diagnosis", "Days Left", "Status", "Actions"].map(h => (
              <div
                key={h}
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#94a3b8",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {h}
              </div>
            ))}
          </div>

          {/* Rows */}
          {paginated.map(p => {
            const isAck = acknowledged.has(p.id);
            return (
              <div key={p.id}>
                {/* ── Desktop row ── */}
                <div
                  className="patient-desktop-row responsive-table-grid responsive-table-grid-6 row"
                  style={{
                    padding: "16px 24px",
                    borderBottom: "1px solid #eef1f4",
                    gap: 16,
                    alignItems: "center",
                    transition: "background 0.15s",
                    cursor: "pointer",
                  }}
                  onClick={() => router.push(`/patients/${p.id}`)}
                  onMouseEnter={e => (e.currentTarget.style.background = "#fafafa")}
                  onMouseLeave={e => (e.currentTarget.style.background = "white")}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: "#0f172a", fontSize: 14 }}>{p.name}</div>
                    <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 2 }}>
                      {p.id} • {p.age}y {p.gender}
                    </div>
                  </div>
                  <div><span className={riskBadge(p.risk)}>{p.risk}</span></div>
                  <div style={{ fontSize: 13, color: "#475569" }}>
                    {p.diagnosis.split(" ").slice(0, 2).join(" ")}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>
                    {p.monitoringDays - p.submissions.length}d
                  </div>
                  <div>
                    {isAck
                      ? <span style={{ fontSize: 12, color: "#15803d", fontWeight: 600 }}>✓ Acknowledged</span>
                      : <span style={{ fontSize: 12, color: "#94a3b8" }}>Pending</span>
                    }
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <Link href={`/patients/${p.id}`}>
                      <button
                        onClick={e => e.stopPropagation()}
                        style={{
                          padding: "6px 12px", borderRadius: 10,
                          border: "1.5px solid #378ADD", color: "#378ADD",
                          background: "transparent", fontSize: 12, fontWeight: 600, cursor: "pointer",
                        }}
                      >View</button>
                    </Link>
                    <button
                      onClick={e => { e.stopPropagation(); setCallModal(p); }}
                      style={{
                        padding: "6px 12px", borderRadius: 10,
                        border: "1.5px solid #1D9E75", color: "#1D9E75",
                        background: "transparent", fontSize: 12, fontWeight: 600, cursor: "pointer",
                      }}
                    >Call</button>
                    <button
                      onClick={e => { e.stopPropagation(); setAcknowledged(prev => new Set([...prev, p.id])); }}
                      disabled={isAck}
                      style={{
                        padding: "6px 12px", borderRadius: 10, border: "none",
                        background: isAck ? "#f1f5f9" : "#0f172a",
                        color: isAck ? "#94a3b8" : "white",
                        fontSize: 12, fontWeight: 600, cursor: isAck ? "default" : "pointer",
                      }}
                    >Ack</button>
                  </div>
                </div>

                {/* ── Mobile card ── */}
                {(() => {
                  const riskAccent: Record<string, { bar: string; avatarBg: string; avatarColor: string }> = {
                    High:   { bar: "#dc2626", avatarBg: "#fee2e2", avatarColor: "#dc2626" },
                    Medium: { bar: "#f59e0b", avatarBg: "#fef9c3", avatarColor: "#a16207" },
                    Low:    { bar: "#1D9E75", avatarBg: "#dcfce7", avatarColor: "#15803d" },
                  };
                  const accent = riskAccent[p.risk] ?? riskAccent.Low;
                  const initials = p.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase();
                  const daysLeft = p.monitoringDays - p.submissions.length;

                  return (
                    <div
                      className="patient-mobile-card"
                      style={{ display: "none" }}
                      onClick={() => router.push(`/patients/${p.id}`)}
                    >
                      {/* Left accent bar */}
                      <div style={{
                        position: "absolute", left: 0, top: 0, bottom: 0,
                        width: 4, borderRadius: "0 4px 4px 0",
                        background: accent.bar,
                      }} />

                      {/* Card body */}
                      <div style={{ paddingLeft: 12 }}>

                        {/* ── Top row: avatar + name + badge ── */}
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                          {/* Avatar */}
                          <div style={{
                            width: 44, height: 44, borderRadius: 14, flexShrink: 0,
                            background: accent.avatarBg,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontFamily: "'Syne', sans-serif", fontWeight: 800,
                            fontSize: 15, color: accent.avatarColor, letterSpacing: "0.04em",
                          }}>
                            {initials}
                          </div>

                          {/* Name + meta */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontWeight: 700, color: "#0f172a", fontSize: 15,
                              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                            }}>{p.name}</div>
                            <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 2 }}>
                              {p.id} · {p.age}y · {p.gender}
                            </div>
                          </div>

                          {/* Risk badge */}
                          <span className={riskBadge(p.risk)} style={{ flexShrink: 0 }}>{p.risk}</span>
                        </div>

                        {/* ── Divider ── */}
                        <div style={{ height: 1, background: "#f1f5f9", marginBottom: 14 }} />

                        {/* ── Stats row ── */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
                          {[
                            {
                              label: "Diagnosis",
                              value: p.diagnosis.split(" ").slice(0, 3).join(" "),
                              wide: true,
                            },
                            {
                              label: "Days Left",
                              value: `${daysLeft}d`,
                              highlight: daysLeft <= 3,
                            },
                            {
                              label: "Status",
                              value: isAck ? "✓ Done" : "Pending",
                              isAck,
                            },
                          ].map(stat => (
                            <div key={stat.label} style={{
                              background: "#f8fafc",
                              borderRadius: 10,
                              padding: "8px 10px",
                            }}>
                              <div style={{
                                fontSize: 10, fontWeight: 700, color: "#94a3b8",
                                textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4,
                              }}>{stat.label}</div>
                              <div style={{
                                fontSize: 13, fontWeight: 600,
                                color: stat.isAck !== undefined
                                  ? (stat.isAck ? "#15803d" : "#f59e0b")
                                  : stat.highlight ? "#dc2626" : "#1e293b",
                                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                              }}>{stat.value}</div>
                            </div>
                          ))}
                        </div>

                        {/* ── Action buttons ── */}
                        <div style={{ display: "flex", gap: 8 }} onClick={e => e.stopPropagation()}>
                          <Link href={`/patients/${p.id}`} style={{ flex: 1 }}>
                            <button style={{
                              width: "100%", padding: "10px 0", borderRadius: 10,
                              border: "none",
                              background: "#eff6ff",
                              color: "#378ADD", fontSize: 13, fontWeight: 700, cursor: "pointer",
                              letterSpacing: "0.01em",
                            }}>View</button>
                          </Link>
                          <button
                            onClick={() => setCallModal(p)}
                            style={{
                              flex: 1, padding: "10px 0", borderRadius: 10,
                              border: "none",
                              background: "#f0fdf4",
                              color: "#1D9E75", fontSize: 13, fontWeight: 700, cursor: "pointer",
                            }}
                          >Call</button>
                          <button
                            onClick={() => setAcknowledged(prev => new Set([...prev, p.id]))}
                            disabled={isAck}
                            style={{
                              flex: 1, padding: "10px 0", borderRadius: 10, border: "none",
                              background: isAck ? "#f1f5f9" : "#0f172a",
                              color: isAck ? "#94a3b8" : "white",
                              fontSize: 13, fontWeight: 700,
                              cursor: isAck ? "default" : "pointer",
                            }}
                          >{isAck ? "✓ Ack'd" : "Ack"}</button>
                        </div>

                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div style={{ padding: "48px", textAlign: "center", color: "#94a3b8" }}>
              No patients found
            </div>
          )}

          {/* ── Pagination footer ── */}
          {filtered.length > 0 && (
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 24px",
              borderTop: "1px solid #f1f5f9",
              flexWrap: "wrap",
              gap: 12,
            }}>
              {/* Result info */}
              <div style={{ fontSize: 13, color: "#94a3b8", whiteSpace: "nowrap" }}>
                Showing{" "}
                <span style={{ fontWeight: 600, color: "#374151" }}>
                  {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)}
                </span>{" "}
                of{" "}
                <span style={{ fontWeight: 600, color: "#374151" }}>{filtered.length}</span>{" "}
                patients
              </div>

              {/* Page controls */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {/* Prev */}
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  style={{
                    width: 36, height: 36, borderRadius: 10,
                    border: "1.5px solid #e2e8f0",
                    background: safePage === 1 ? "#f8fafc" : "white",
                    color: safePage === 1 ? "#cbd5e1" : "#374151",
                    fontWeight: 700, fontSize: 16,
                    cursor: safePage === 1 ? "default" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.15s",
                  }}
                  aria-label="Previous page"
                >‹</button>

                {/* Page numbers */}
                {getPageNumbers().map((pg, idx) =>
                  pg === "…" ? (
                    <span key={`ellipsis-${idx}`} style={{
                      width: 36, height: 36, display: "flex",
                      alignItems: "center", justifyContent: "center",
                      fontSize: 13, color: "#94a3b8",
                    }}>…</span>
                  ) : (
                    <button
                      key={pg}
                      onClick={() => setCurrentPage(pg as number)}
                      style={{
                        width: 36, height: 36, borderRadius: 10,
                        border: "1.5px solid",
                        borderColor: safePage === pg ? "#1D9E75" : "#e2e8f0",
                        background: safePage === pg ? "rgba(29,158,117,0.08)" : "white",
                        color: safePage === pg ? "#1D9E75" : "#374151",
                        fontWeight: safePage === pg ? 700 : 500,
                        fontSize: 13,
                        cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "all 0.15s",
                      }}
                    >{pg}</button>
                  )
                )}

                {/* Next */}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  style={{
                    width: 36, height: 36, borderRadius: 10,
                    border: "1.5px solid #e2e8f0",
                    background: safePage === totalPages ? "#f8fafc" : "white",
                    color: safePage === totalPages ? "#cbd5e1" : "#374151",
                    fontWeight: 700, fontSize: 16,
                    cursor: safePage === totalPages ? "default" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.15s",
                  }}
                  aria-label="Next page"
                >›</button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Call Modal */}
      {callModal && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
            padding: "16px",
          }}
          onClick={() => setCallModal(null)}
        >
          <div
            style={{
              background: "white", borderRadius: 24, padding: 32,
              width: "100%", maxWidth: 360,
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
              <h3 className="heading-font" style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
                Contact Patient
              </h3>
              <button
                onClick={() => setCallModal(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>
            <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 24 }}>{callModal.name}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <a href={`tel:${callModal.contact}`} style={{ textDecoration: "none" }}>
                <div
                  style={{
                    padding: "14px 20px", borderRadius: 14, border: "1.5px solid #1D9E75",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}
                >
                  <span style={{ fontWeight: 600, color: "#0f172a" }}>Patient</span>
                  <span style={{ color: "#1D9E75", fontWeight: 600 }}>{callModal.contact}</span>
                </div>
              </a>
              {callModal.relativeContact && (
                <a href={`tel:${callModal.relativeContact}`} style={{ textDecoration: "none" }}>
                  <div
                    style={{
                      padding: "14px 20px", borderRadius: 14, border: "1.5px solid #378ADD",
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                    }}
                  >
                    <span style={{ fontWeight: 600, color: "#0f172a" }}>Relative</span>
                    <span style={{ color: "#378ADD", fontWeight: 600 }}>{callModal.relativeContact}</span>
                  </div>
                </a>
              )}
            </div>
            <button onClick={() => setCallModal(null)} className="btn-outline" style={{ width: "100%", marginTop: 20 }}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}