"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { Search, Users, ShieldCheck, Activity, AlertTriangle, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Shape returned by GET /api/v1/doctor/dashboard */
interface DashboardStats {
  total_active: number;
  green: number;
  yellow: number;
  red: number;
}

/** One patient entry from activePatients[] in the API response */
interface ApiPatient {
  id: string;
  name: string;
  trend_status: "red" | "yellow" | "green" | null;
  risk_category?: "high" | "medium" | "low";
  day_number: number;
  has_unack_alert: boolean | null;
  age?: number;
  gender?: string;
  diagnosis?: string;
  disease_name?: string;
  monitoring_days?: number;
  contact?: string;
  phone?: string;
  relative_contact?: string;
  relative_phone?: string;
}

interface PendingAlert {
  id: string;
  patient_id: string;
  message: string;
  created_at: string;
}

interface DashboardResponse {
  stats: DashboardStats;
  activePatients: ApiPatient[];
  pendingAlerts: PendingAlert[];
}

/** Normalised patient shape used by the UI */
interface Patient {
  id: string;
  name: string;
  risk: "High" | "Medium" | "Low";
  age: number;
  gender: string;
  diagnosis: string;
  monitoringDays: number;
  dayNumber: number;
  contact: string;
  relativeContact?: string;
  hasUnackAlert: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Maps API trend_status → UI risk label */
const trendToRisk = (trend: NonNullable<ApiPatient["trend_status"]>): Patient["risk"] => {
  if (trend === "red") return "High";
  if (trend === "yellow") return "Medium";
  return "Low";
};

/** Maps API risk_category → UI risk label (fallback when trend_status is null) */
const riskCategoryToRisk = (cat?: string): Patient["risk"] => {
  if (cat === "high") return "High";
  if (cat === "medium") return "Medium";
  return "Low";
};

/** Maps UI risk label → API filter param */
const riskToFilterParam = (risk: string): string | null => {
  if (risk === "High") return "red";
  if (risk === "Medium") return "yellow";
  if (risk === "Low") return "green";
  return null;
};

/** Normalises a raw API patient into the UI shape */
const normalisePatient = (p: ApiPatient): Patient => ({
  id: p.id,
  name: p.name,
  // trend_status may be null — fall back to risk_category
  risk: p.trend_status
    ? trendToRisk(p.trend_status)
    : riskCategoryToRisk(p.risk_category),
  age: p.age ?? 0,
  gender: p.gender ?? "—",
  // API returns disease_name; fall back to diagnosis
  diagnosis: p.disease_name ?? p.diagnosis ?? "—",
  monitoringDays: p.monitoring_days ?? 0,
  dayNumber: p.day_number,
  // API returns phone / relative_phone
  contact: p.phone ?? p.contact ?? "",
  relativeContact: p.relative_phone ?? p.relative_contact,
  hasUnackAlert: p.has_unack_alert ?? false,
});

// ─── Component ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();

  // UI state
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<string>("All");
  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set());
  const [callModal, setCallModal] = useState<Patient | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  // Data state
  const [stats, setStats] = useState<DashboardStats>({ total_active: 0, green: 0, yellow: 0, red: 0 });
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Fetch dashboard data ──────────────────────────────────────────────────
  const fetchDashboard = useCallback(async (search: string, riskFilter: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      const filterParam = riskToFilterParam(riskFilter);
      if (filterParam) params.set("filter", filterParam);
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(
        `https://api.mediwatch.in/api/v1/doctor/dashboard${params.toString() ? `?${params}` : ""}`,
        {
          headers: {
            Authorization: `Bearer ${getToken()}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (res.status === 401) throw new Error("Unauthorised — please log in again.");
      if (!res.ok) throw new Error(`Server error (${res.status})`);

      const raw = await res.json();
      console.log("[Dashboard API response]", raw);

      const data = raw?.data ?? raw;

      // Stats — API returns values as strings, coerce to numbers
      const statsRaw = data?.stats ?? {};
      setStats({
        total_active: Number(statsRaw.total_active ?? 0),
        green:        Number(statsRaw.green        ?? 0),
        yellow:       Number(statsRaw.yellow       ?? 0),
        red:          Number(statsRaw.red          ?? 0),
      });

      // Patient list
      const list: ApiPatient[] = Array.isArray(data?.activePatients)
        ? data.activePatients
        : Array.isArray(data?.data)
        ? data.data
        : [];
      setPatients(list.map(normalisePatient));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchDashboard(search, riskFilter);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, riskFilter, fetchDashboard]);

  // ── Pagination ────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(patients.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = patients.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleSearch = (val: string) => { setSearch(val); setCurrentPage(1); };
  const handleFilter = (val: string) => { setRiskFilter(val); setCurrentPage(1); };

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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="page-shell">
      <Sidebar />
      <main className="main-content">

        {/* Page Header */}
        <div style={{ background: "#378ADD", padding: "20px 24px", borderRadius: 16, marginBottom: 28 }}>
          <h1 className="heading-font" style={{ fontSize: 28, fontWeight: 800, color: "white", margin: 0 }}>
            Dashboard
          </h1>
          <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 14, marginTop: 4 }}>
            Overview of active patients and alerts
          </p>
        </div>

        {/* Stat Cards */}
        <div className="responsive-grid-4" style={{ marginBottom: 32 }}>
          {[
            { label: "Total Active", value: stats.total_active, color: "#378ADD", bg: "#eff6ff",  icon: Users },
            { label: "Low Risk",     value: stats.green,        color: "#15803d", bg: "#f0fdf4",  icon: ShieldCheck },
            { label: "Medium Risk",  value: stats.yellow,       color: "#a16207", bg: "#fefce8",  icon: Activity },
            { label: "High Risk",    value: stats.red,          color: "#dc2626", bg: "#fef2f2",  icon: AlertTriangle },
          ].map(card => (
            <div
              key={card.label}
              className="stat-card"
              style={{ background: card.bg, border: `1px solid ${card.color}22` }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
                <card.icon size={28} color={card.color} />
                <div className="heading-font" style={{ fontSize: 36, fontWeight: 800, color: card.color }}>
                  {loading ? "—" : card.value}
                </div>
              </div>
              <div style={{ color: "#64748b", fontSize: 13, fontWeight: 500, marginTop: 4 }}>
                {card.label}
              </div>
            </div>
          ))}
        </div>

        {/* Error banner */}
        {error && (
          <div style={{
            marginBottom: 16, padding: "12px 20px", borderRadius: 12,
            background: "#fef2f2", border: "1px solid #fca5a5",
            color: "#dc2626", fontSize: 13, fontWeight: 500,
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            {error}
            <button
              onClick={() => fetchDashboard(search, riskFilter)}
              style={{ background: "none", border: "none", color: "#dc2626", fontWeight: 700, cursor: "pointer", fontSize: 13 }}
            >Retry</button>
          </div>
        )}

        {/* Search + Filter bar */}
        <div className="dashboard-search-bar" style={{ marginBottom: 20 }}>
          <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
            <span style={{
              position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)",
              display: "inline-flex", alignItems: "center", color: "#94a3b8",
            }}>
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

          {/* Desktop filter chips */}
          <div className="filter-chips-desktop">
            {["All", "High", "Medium", "Low"].map(f => (
              <button
                key={f}
                onClick={() => handleFilter(f)}
                style={{
                  padding: "12px 20px", borderRadius: 14, border: "1.5px solid",
                  borderColor: riskFilter === f ? "#1D9E75" : "#e2e8f0",
                  background: riskFilter === f ? "rgba(29,158,117,0.08)" : "white",
                  color: riskFilter === f ? "#1D9E75" : "#64748b",
                  fontWeight: 600, fontSize: 13, cursor: "pointer",
                  transition: "all 0.2s", whiteSpace: "nowrap",
                }}
              >{f}</button>
            ))}
          </div>

          {/* Mobile filter toggle */}
          <button
            className="filter-toggle-mobile"
            onClick={() => setFilterOpen(v => !v)}
            style={{
              alignItems: "center", gap: 6, padding: "12px 16px", borderRadius: 14,
              border: "1.5px solid",
              borderColor: riskFilter !== "All" ? "#1D9E75" : "#e2e8f0",
              background: riskFilter !== "All" ? "rgba(29,158,117,0.08)" : "white",
              color: riskFilter !== "All" ? "#1D9E75" : "#64748b",
              fontWeight: 600, fontSize: 13, cursor: "pointer", flexShrink: 0,
            }}
          >
            <SlidersHorizontal size={15} />
            {riskFilter !== "All" ? riskFilter : "Filter"}
          </button>
        </div>

        {/* Mobile filter drawer */}
        {filterOpen && (
          <div className="mobile-filter-drawer" style={{
            display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16,
            padding: "14px 16px", background: "white",
            borderRadius: 16, boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
          }}>
            {["All", "High", "Medium", "Low"].map(f => (
              <button
                key={f}
                onClick={() => { handleFilter(f); setFilterOpen(false); }}
                style={{
                  padding: "9px 18px", borderRadius: 99, border: "1.5px solid",
                  borderColor: riskFilter === f ? "#1D9E75" : "#e2e8f0",
                  background: riskFilter === f ? "rgba(29,158,117,0.08)" : "#f8fafc",
                  color: riskFilter === f ? "#1D9E75" : "#64748b",
                  fontWeight: 600, fontSize: 13, cursor: "pointer",
                }}
              >{f}</button>
            ))}
          </div>
        )}

        {/* Patient List */}
        <div className="table-responsive patient-list-wrap" style={{
          background: "white", borderRadius: 20, overflow: "hidden",
          boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
        }}>
          {/* Desktop table header */}
          <div
            className="patient-table-header responsive-table-grid responsive-table-grid-6 header"
            style={{ padding: "16px 24px", borderBottom: "1px solid #f1f5f9" }}
          >
            {["Patient", "Risk", "Diagnosis", "Days Left", "Status", "Actions"].map(h => (
              <div key={h} style={{
                fontSize: 12, fontWeight: 700, color: "#94a3b8",
                textTransform: "uppercase", letterSpacing: "0.05em",
              }}>{h}</div>
            ))}
          </div>

          {/* Loading skeleton */}
          {loading && (
            <div style={{ padding: "48px", textAlign: "center", color: "#94a3b8" }}>
              Loading patients…
            </div>
          )}

          {/* Rows */}
          {!loading && paginated.map(p => {
            const isAck = acknowledged.has(p.id) || !p.hasUnackAlert;
            const daysLeft = p.monitoringDays > 0 ? p.monitoringDays - p.dayNumber : p.dayNumber;

            return (
              <div key={p.id}>
                {/* Desktop row */}
                <div
                  className="patient-desktop-row responsive-table-grid responsive-table-grid-6 row"
                  style={{
                    padding: "16px 24px", borderBottom: "1px solid #eef1f4",
                    gap: 16, alignItems: "center", transition: "background 0.15s", cursor: "pointer",
                  }}
                  onClick={() => router.push(`#`)}
                  onMouseEnter={e => (e.currentTarget.style.background = "#fafafa")}
                  onMouseLeave={e => (e.currentTarget.style.background = "white")}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: "#0f172a", fontSize: 14 }}>{p.name}</div>
                    <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 2 }}>
                      {p.id}{p.age ? ` • ${p.age}y` : ""}{p.gender !== "—" ? ` ${p.gender}` : ""}
                    </div>
                  </div>
                  <div><span className={riskBadge(p.risk)}>{p.risk}</span></div>
                  <div style={{ fontSize: 13, color: "#475569" }}>
                    {p.diagnosis.split(" ").slice(0, 3).join(" ")}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>
                    {daysLeft > 0 ? `${daysLeft}d` : "—"}
                  </div>
                  <div>
                    {isAck
                      ? <span style={{ fontSize: 12, color: "#15803d", fontWeight: 600 }}>✓ Acknowledged</span>
                      : <span style={{ fontSize: 12, color: "#94a3b8" }}>Pending</span>
                    }
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <Link href={`#`}>
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
                      onClick={e => {
                        e.stopPropagation();
                        setAcknowledged(prev => new Set([...prev, p.id]));
                      }}
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

                {/* Mobile card */}
                {(() => {
                  const riskAccent: Record<string, { bar: string; avatarBg: string; avatarColor: string }> = {
                    High:   { bar: "#dc2626", avatarBg: "#fee2e2", avatarColor: "#dc2626" },
                    Medium: { bar: "#f59e0b", avatarBg: "#fef9c3", avatarColor: "#a16207" },
                    Low:    { bar: "#1D9E75", avatarBg: "#dcfce7", avatarColor: "#15803d" },
                  };
                  const accent = riskAccent[p.risk] ?? riskAccent.Low;
                  const initials = p.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase();

                  return (
                    <div
                      className="patient-mobile-card"
                      style={{ display: "none" }}
                      onClick={() => router.push(`#`)}
                    >
                      <div style={{
                        position: "absolute", left: 0, top: 0, bottom: 0,
                        width: 4, borderRadius: "0 4px 4px 0", background: accent.bar,
                      }} />

                      <div style={{ paddingLeft: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                          <div style={{
                            width: 44, height: 44, borderRadius: 14, flexShrink: 0,
                            background: accent.avatarBg,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontFamily: "'Syne', sans-serif", fontWeight: 800,
                            fontSize: 15, color: accent.avatarColor, letterSpacing: "0.04em",
                          }}>
                            {initials}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontWeight: 700, color: "#0f172a", fontSize: 15,
                              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                            }}>{p.name}</div>
                            <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 2 }}>
                              {p.id}{p.age ? ` · ${p.age}y` : ""}{p.gender !== "—" ? ` · ${p.gender}` : ""}
                            </div>
                          </div>
                          <span className={riskBadge(p.risk)} style={{ flexShrink: 0 }}>{p.risk}</span>
                        </div>

                        <div style={{ height: 1, background: "#f1f5f9", marginBottom: 14 }} />

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
                          {[
                            { label: "Diagnosis", value: p.diagnosis.split(" ").slice(0, 3).join(" ") },
                            { label: "Days Left",  value: daysLeft > 0 ? `${daysLeft}d` : "—", highlight: daysLeft <= 3 && daysLeft > 0 },
                            { label: "Status",     value: isAck ? "✓ Done" : "Pending", isAck },
                          ].map(stat => (
                            <div key={stat.label} style={{ background: "#f8fafc", borderRadius: 10, padding: "8px 10px" }}>
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

                        <div style={{ display: "flex", gap: 8 }} onClick={e => e.stopPropagation()}>
                          <Link href={`#`} style={{ flex: 1 }}>
                            <button style={{
                              width: "100%", padding: "10px 0", borderRadius: 10, border: "none",
                              background: "#eff6ff", color: "#378ADD",
                              fontSize: 13, fontWeight: 700, cursor: "pointer", letterSpacing: "0.01em",
                            }}>View</button>
                          </Link>
                          <button
                            onClick={() => setCallModal(p)}
                            style={{
                              flex: 1, padding: "10px 0", borderRadius: 10, border: "none",
                              background: "#f0fdf4", color: "#1D9E75",
                              fontSize: 13, fontWeight: 700, cursor: "pointer",
                            }}
                          >Call</button>
                          <button
                            onClick={() => setAcknowledged(prev => new Set([...prev, p.id]))}
                            disabled={isAck}
                            style={{
                              flex: 1, padding: "10px 0", borderRadius: 10, border: "none",
                              background: isAck ? "#f1f5f9" : "#0f172a",
                              color: isAck ? "#94a3b8" : "white",
                              fontSize: 13, fontWeight: 700, cursor: isAck ? "default" : "pointer",
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

          {!loading && patients.length === 0 && (
            <div style={{ padding: "48px", textAlign: "center", color: "#94a3b8" }}>
              No patients found
            </div>
          )}

          {/* Pagination */}
          {!loading && patients.length > 0 && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "16px 24px", borderTop: "1px solid #f1f5f9",
              flexWrap: "wrap", gap: 12,
            }}>
              <div style={{ fontSize: 13, color: "#94a3b8", whiteSpace: "nowrap" }}>
                Showing{" "}
                <span style={{ fontWeight: 600, color: "#374151" }}>
                  {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, patients.length)}
                </span>{" "}
                of{" "}
                <span style={{ fontWeight: 600, color: "#374151" }}>{patients.length}</span>{" "}
                patients
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  style={{
                    width: 36, height: 36, borderRadius: 10, border: "1.5px solid #e2e8f0",
                    background: safePage === 1 ? "#f8fafc" : "white",
                    color: safePage === 1 ? "#cbd5e1" : "#374151",
                    fontWeight: 700, fontSize: 16, cursor: safePage === 1 ? "default" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s",
                  }}
                  aria-label="Previous page"
                >‹</button>

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
                        width: 36, height: 36, borderRadius: 10, border: "1.5px solid",
                        borderColor: safePage === pg ? "#1D9E75" : "#e2e8f0",
                        background: safePage === pg ? "rgba(29,158,117,0.08)" : "white",
                        color: safePage === pg ? "#1D9E75" : "#374151",
                        fontWeight: safePage === pg ? 700 : 500, fontSize: 13,
                        cursor: "pointer", display: "flex", alignItems: "center",
                        justifyContent: "center", transition: "all 0.15s",
                      }}
                    >{pg}</button>
                  )
                )}

                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  style={{
                    width: 36, height: 36, borderRadius: 10, border: "1.5px solid #e2e8f0",
                    background: safePage === totalPages ? "#f8fafc" : "white",
                    color: safePage === totalPages ? "#cbd5e1" : "#374151",
                    fontWeight: 700, fontSize: 16,
                    cursor: safePage === totalPages ? "default" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s",
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
            style={{ background: "white", borderRadius: 24, padding: 32, width: "100%", maxWidth: 360 }}
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
              {callModal.contact && (
                <a href={`tel:${callModal.contact}`} style={{ textDecoration: "none" }}>
                  <div style={{
                    padding: "14px 20px", borderRadius: 14, border: "1.5px solid #1D9E75",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                    <span style={{ fontWeight: 600, color: "#0f172a" }}>Patient</span>
                    <span style={{ color: "#1D9E75", fontWeight: 600 }}>{callModal.contact}</span>
                  </div>
                </a>
              )}
              {callModal.relativeContact && (
                <a href={`tel:${callModal.relativeContact}`} style={{ textDecoration: "none" }}>
                  <div style={{
                    padding: "14px 20px", borderRadius: 14, border: "1.5px solid #378ADD",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                    <span style={{ fontWeight: 600, color: "#0f172a" }}>Relative</span>
                    <span style={{ color: "#378ADD", fontWeight: 600 }}>{callModal.relativeContact}</span>
                  </div>
                </a>
              )}
              {!callModal.contact && !callModal.relativeContact && (
                <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center" }}>No contact info available.</p>
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

// ─── Token helper ─────────────────────────────────────────────────────────────
function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("doctor_token") ?? "";
}