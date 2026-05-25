"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import {
  Search, Users, Activity, PauseCircle, CheckCircle2,
  Clock, UserX, SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

type ApiStatus = "active" | "inactive" | "completed" | "incomplete" | "pending_login";

interface ApiPatient {
  id: string;
  name: string;
  phone: string;
  status: ApiStatus;
  risk_category: "low" | "medium" | "high";
  monitoring_days: number;
  registration_step: string;
  created_at: string;
  monitoring_start: string | null;
  monitoring_end: string | null;
  disease_name: string;
  day_number: number | null;
}

interface PatientsStats {
  active: string | number;
  inactive: string | number;
  completed: string | number;
  incomplete: string | number;
  pending_login: string | number;
  total: string | number;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("doctor_token") ?? "";
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

const STATUS_META: Record<ApiStatus, { label: string; bg: string; color: string }> = {
  active:        { label: "Active",        bg: "#f0fdf4", color: "#15803d" },
  inactive:      { label: "Inactive",      bg: "#fefce8", color: "#a16207" },
  completed:     { label: "Completed",     bg: "#eff6ff", color: "#1d4ed8" },
  incomplete:    { label: "Incomplete",    bg: "#fef2f2", color: "#dc2626" },
  pending_login: { label: "Pending Login", bg: "#f5f3ff", color: "#7c3aed" },
};

const RISK_META: Record<string, { label: string; color: string; bg: string }> = {
  high:   { label: "High",   color: "#dc2626", bg: "#fee2e2" },
  medium: { label: "Medium", color: "#a16207", bg: "#fef9c3" },
  low:    { label: "Low",    color: "#15803d", bg: "#dcfce7" },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function PatientsPage() {
  const router = useRouter();

  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page,         setPage]         = useState(1);
  const LIMIT = 20;

  const [stats,      setStats]      = useState<PatientsStats | null>(null);
  const [patients,   setPatients]   = useState<ApiPatient[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);

  const [filterOpen, setFilterOpen] = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  // routerRef avoids adding router to deps (router identity changes on navigation)
  const routerRef = useRef(router);
  useEffect(() => { routerRef.current = router; }, [router]);

  async function fetchPatients(search: string, status: string, page: number) {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      if (!token) { routerRef.current.replace("/login"); return; }

      const params = new URLSearchParams();
      if (status !== "all") params.set("status", status);
      if (search.trim())    params.set("search", search.trim());
      params.set("page",  String(page));
      params.set("limit", String(LIMIT));

      const res = await fetch(
        `https://api.mediwatch.in/api/v1/doctor/patients?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.status === 401) {
        localStorage.removeItem("doctor_token");
        document.cookie = "doctor_token=; path=/; max-age=0; SameSite=Strict";
        routerRef.current.replace("/login");
        return;
      }
      if (!res.ok) throw new Error(`Server error (${res.status})`);

      const raw = await res.json();
      const data = raw?.data;
      setStats(data?.stats ?? null);
      setPatients(Array.isArray(data?.patients) ? data.patients : []);
      setPagination(data?.pagination ?? null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  // Only re-fetch when search/filter/page actually changes — no fetchPatients in deps
  useEffect(() => {
    const t = setTimeout(() => {
      fetchPatients(search, statusFilter, page);
    }, search ? 400 : 0); // debounce only for search typing, instant for filter/page
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter, page]);

  const handleSearch = (v: string) => { setSearch(v);       setPage(1); };
  const handleStatus = (v: string) => { setStatusFilter(v); setPage(1); };


  // ── Pagination ─────────────────────────────────────────────────────────────
  const totalPages = pagination?.totalPages ?? 1;
  const getPageNumbers = (): (number | "…")[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "…")[] = [1];
    if (page > 3) pages.push("…");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push("…");
    pages.push(totalPages);
    return pages;
  };

  const n = (v: string | number | undefined) => Number(v ?? 0);

  const STATUS_FILTERS = [
    { value: "all",           label: "All" },
    { value: "active",        label: "Active" },
    { value: "inactive",      label: "Inactive" },
    { value: "completed",     label: "Completed" },
    { value: "incomplete",    label: "Incomplete" },
    { value: "pending_login", label: "Pending Login" },
  ];

  const COL_HEADERS = [
    "Patient", "Disease", "Risk", "Status", "Monitoring", "Registered", "",
  ];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="page-shell">
      <Sidebar />
      <main className="main-content">

        {/* ── Page Header — with total patients on the right ── */}
        <div style={{
          background: "#378ADD",
          padding: "20px 24px", borderRadius: 16, marginBottom: 28,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
        }}>
          <div>
            <h1 className="heading-font" style={{ fontSize: 28, fontWeight: 800, color: "white", margin: 0 }}>
              All Patients
            </h1>
            <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 14, marginTop: 4, marginBottom: 0 }}>
              Complete patient registry across all statuses
            </p>
          </div>

          {/* Total patients pill — top-right of header */}
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            background: "rgba(255,255,255,0.15)",
            border: "1.5px solid rgba(255,255,255,0.25)",
            borderRadius: 16, padding: "12px 20px",
            flexShrink: 0,
          }}>
            <Users size={22} color="white" />
            <div style={{ textAlign: "right" }}>
              <div className="heading-font" style={{ fontSize: 28, fontWeight: 800, color: "white", lineHeight: 1 }}>
                {loading ? "—" : n(stats?.total)}
              </div>
              <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: 500, marginTop: 2 }}>
                Total Patients
              </div>
            </div>
          </div>
        </div>

        {/* ── 5 Status Stat Cards ── */}
        <div className="patients-stat-grid" style={{ marginBottom: 28 }}>
          {[
            { key: "active",        label: "Active",        icon: Activity,     color: "#15803d", bg: "#f0fdf4", border: "#15803d22" },
            { key: "inactive",      label: "Inactive",      icon: PauseCircle,  color: "#a16207", bg: "#fefce8", border: "#a1620722" },
            { key: "completed",     label: "Completed",     icon: CheckCircle2, color: "#1d4ed8", bg: "#eff6ff", border: "#1d4ed822" },
            { key: "incomplete",    label: "Incomplete",    icon: UserX,        color: "#dc2626", bg: "#fef2f2", border: "#dc262622" },
            { key: "pending_login", label: "Pending Login", icon: Clock,        color: "#7c3aed", bg: "#f5f3ff", border: "#7c3aed22" },
          ].map(card => (
            <div
              key={card.key}
              className="stat-card"
              style={{
                background: card.bg, border: `1px solid ${card.border}`,
                cursor: "pointer",
                outline: statusFilter === card.key ? `2px solid ${card.color}` : "none",
                outlineOffset: 2,
              }}
              onClick={() => handleStatus(statusFilter === card.key ? "all" : card.key)}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                <card.icon size={24} color={card.color} />
                <div className="heading-font" style={{ fontSize: 32, fontWeight: 800, color: card.color }}>
                  {loading ? "—" : n(stats?.[card.key as keyof PatientsStats])}
                </div>
              </div>
              <div style={{ color: "#64748b", fontSize: 12, fontWeight: 500 }}>{card.label}</div>
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
              onClick={() => fetchPatients(search, statusFilter, page)}
              style={{ background: "none", border: "none", color: "#dc2626", fontWeight: 700, cursor: "pointer", fontSize: 13 }}
            >Retry</button>
          </div>
        )}

        {/* ── Search + Filter bar ── */}
        <div className="dashboard-search-bar" style={{ marginBottom: 16 }}>
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
              placeholder="Search by name or phone…"
              value={search}
              onChange={e => handleSearch(e.target.value)}
            />
          </div>

          {/* Desktop filter chips */}
          <div className="filter-chips-desktop" style={{ flexWrap: "wrap" }}>
            {STATUS_FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => handleStatus(f.value)}
                style={{
                  padding: "10px 16px", borderRadius: 12, border: "1.5px solid",
                  borderColor: statusFilter === f.value ? "#1D9E75" : "#e2e8f0",
                  background: statusFilter === f.value ? "rgba(29,158,117,0.08)" : "white",
                  color: statusFilter === f.value ? "#1D9E75" : "#64748b",
                  fontWeight: 600, fontSize: 12, cursor: "pointer",
                  transition: "all 0.2s", whiteSpace: "nowrap",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Mobile filter toggle – hidden on tablet/desktop via globals, shown only on mobile */}
          <button
            className="filter-toggle-mobile"
            onClick={() => setFilterOpen(v => !v)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "12px 16px", borderRadius: 14, border: "1.5px solid",
              borderColor: statusFilter !== "all" ? "#1D9E75" : "#e2e8f0",
              background: statusFilter !== "all" ? "rgba(29,158,117,0.08)" : "white",
              color: statusFilter !== "all" ? "#1D9E75" : "#64748b",
              fontWeight: 600, fontSize: 13, cursor: "pointer", flexShrink: 0,
            }}
          >
            <SlidersHorizontal size={15} />
            {statusFilter !== "all"
              ? STATUS_FILTERS.find(f => f.value === statusFilter)?.label ?? "Filter"
              : "Filter"}
          </button>
        </div>

        {/* Mobile filter drawer */}
        {filterOpen && (
          <div style={{
            display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16,
            padding: "14px 16px", background: "white",
            borderRadius: 16, boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
          }}>
            {STATUS_FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => { handleStatus(f.value); setFilterOpen(false); }}
                style={{
                  padding: "9px 16px", borderRadius: 99, border: "1.5px solid",
                  borderColor: statusFilter === f.value ? "#1D9E75" : "#e2e8f0",
                  background: statusFilter === f.value ? "rgba(29,158,117,0.08)" : "#f8fafc",
                  color: statusFilter === f.value ? "#1D9E75" : "#64748b",
                  fontWeight: 600, fontSize: 12, cursor: "pointer",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {/* ── Patient Table ── */}
        <div style={{
          background: "white", borderRadius: 20, overflow: "hidden",
          boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
        }}>

          {/* Desktop table header */}
          <div
            className="patient-table-header patients-grid"
            style={{ padding: "14px 24px", borderBottom: "1px solid #f1f5f9" }}
          >
            {COL_HEADERS.map((label, i) => (
              <div
                key={i}
                style={{
                  fontSize: 11, fontWeight: 700, color: "#94a3b8",
                  textTransform: "uppercase", letterSpacing: "0.06em",
                }}
              >
                {label}
              </div>
            ))}
          </div>

          {/* Loading spinner */}
          {loading && (
            <div style={{ padding: "48px", textAlign: "center", color: "#94a3b8" }}>
              <div style={{
                width: 32, height: 32, border: "3px solid #e2e8f0",
                borderTop: "3px solid #1D9E75", borderRadius: "50%",
                animation: "spin 0.7s linear infinite", margin: "0 auto 12px",
              }} />
              Loading patients…
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* Patient rows */}
          {!loading && patients.map(p => {
            const sm = STATUS_META[p.status] ?? STATUS_META.inactive;
            const rm = RISK_META[p.risk_category] ?? RISK_META.low;
            const initials = p.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

            return (
              <div key={p.id}>
                {/* Desktop row */}
                <div
                  className="patient-desktop-row patients-grid"
                  style={{
                    padding: "14px 24px", borderBottom: "1px solid #f1f5f9",
                    alignItems: "center", cursor: "pointer", transition: "background 0.15s",
                  }}
                  onClick={() => router.push(``)}
                  onMouseEnter={e => (e.currentTarget.style.background = "#fafafa")}
                  onMouseLeave={e => (e.currentTarget.style.background = "white")}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: "#0f172a", fontSize: 14 }}>{p.name}</div>
                    <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 2 }}>{p.phone}</div>
                  </div>
                  <div style={{ fontSize: 13, color: "#475569" }}>{p.disease_name || "—"}</div>
                  <div>
                    <span style={{ padding: "3px 10px", borderRadius: 99, fontSize: 12, fontWeight: 600, background: rm.bg, color: rm.color }}>
                      {rm.label}
                    </span>
                  </div>
                  <div>
                    <span style={{ padding: "3px 10px", borderRadius: 99, fontSize: 12, fontWeight: 600, background: sm.bg, color: sm.color }}>
                      {sm.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: "#475569" }}>
                    {p.monitoring_days ? `${p.monitoring_days}d` : "—"}
                    {p.day_number !== null && (
                      <span style={{ color: "#94a3b8", fontSize: 12, display: "block" }}>Day {p.day_number}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: "#64748b" }}>{formatDate(p.created_at)}</div>
                  <div>
                    <Link href={``}>
                      <button
                        onClick={e => e.stopPropagation()}
                        style={{
                          padding: "6px 14px", borderRadius: 10,
                          border: "1.5px solid #378ADD", color: "#378ADD",
                          background: "transparent", fontSize: 12, fontWeight: 600, cursor: "pointer",
                        }}
                      >View</button>
                    </Link>
                  </div>
                </div>

                {/* Mobile card */}
                <div
                  className="patient-mobile-card"
                  style={{ display: "none" }}
                  onClick={() => router.push(`#`)}
                >
                  <div style={{
                    position: "absolute", left: 0, top: 0, bottom: 0,
                    width: 4, borderRadius: "0 4px 4px 0", background: rm.color,
                  }} />
                  <div style={{ paddingLeft: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: 14, flexShrink: 0,
                        background: rm.bg, display: "flex", alignItems: "center", justifyContent: "center",
                        fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 15, color: rm.color,
                      }}>
                        {initials}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                        <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 2 }}>{p.phone}</div>
                      </div>
                      <span style={{ padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600, background: rm.bg, color: rm.color, flexShrink: 0 }}>{rm.label}</span>
                    </div>
                    <div style={{ height: 1, background: "#f1f5f9", marginBottom: 12 }} />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
                      {[
                        { label: "Disease",    value: (p.disease_name || "—").split(" ").slice(0, 2).join(" ") },
                        { label: "Status",     value: sm.label, valueColor: sm.color },
                        { label: "Monitoring", value: p.monitoring_days ? `${p.monitoring_days}d` : "—" },
                      ].map(stat => (
                        <div key={stat.label} style={{ background: "#f8fafc", borderRadius: 10, padding: "8px 10px" }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{stat.label}</div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: stat.valueColor ?? "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{stat.value}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }} onClick={e => e.stopPropagation()}>
                      <div style={{ fontSize: 12, color: "#94a3b8" }}>
                        Registered: <span style={{ color: "#64748b", fontWeight: 500 }}>{formatDate(p.created_at)}</span>
                      </div>
                      <Link href={`#`}>
                        <button style={{ padding: "8px 18px", borderRadius: 10, border: "none", background: "#eff6ff", color: "#378ADD", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>View</button>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Empty state */}
          {!loading && patients.length === 0 && (
            <div style={{ padding: "56px 24px", textAlign: "center" }}>
              <Users size={40} style={{ color: "#e2e8f0", marginBottom: 12 }} />
              <div style={{ color: "#94a3b8", fontWeight: 500 }}>No patients found</div>
              {(search || statusFilter !== "all") && (
                <button
                  onClick={() => { setSearch(""); setStatusFilter("all"); setPage(1); }}
                  style={{
                    marginTop: 12, padding: "8px 20px", borderRadius: 10,
                    border: "1.5px solid #e2e8f0", background: "white",
                    color: "#64748b", fontSize: 13, fontWeight: 600, cursor: "pointer",
                  }}
                >Clear filters</button>
              )}
            </div>
          )}

          {/* Pagination */}
          {!loading && patients.length > 0 && pagination && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "16px 24px", borderTop: "1px solid #f1f5f9",
              flexWrap: "wrap", gap: 12,
            }}>
              <div style={{ fontSize: 13, color: "#94a3b8", whiteSpace: "nowrap" }}>
                Showing{" "}
                <span style={{ fontWeight: 600, color: "#374151" }}>
                  {(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)}
                </span>{" "}
                of{" "}
                <span style={{ fontWeight: 600, color: "#374151" }}>{pagination.total}</span>{" "}
                patients
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{
                    width: 36, height: 36, borderRadius: 10, border: "1.5px solid #e2e8f0",
                    background: page === 1 ? "#f8fafc" : "white",
                    color: page === 1 ? "#cbd5e1" : "#374151",
                    fontWeight: 700, fontSize: 16, cursor: page === 1 ? "default" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >‹</button>

                {getPageNumbers().map((pg, idx) =>
                  pg === "…" ? (
                    <span key={`e${idx}`} style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#94a3b8" }}>…</span>
                  ) : (
                    <button
                      key={pg}
                      onClick={() => setPage(pg as number)}
                      style={{
                        width: 36, height: 36, borderRadius: 10, border: "1.5px solid",
                        borderColor: page === pg ? "#1D9E75" : "#e2e8f0",
                        background: page === pg ? "rgba(29,158,117,0.08)" : "white",
                        color: page === pg ? "#1D9E75" : "#374151",
                        fontWeight: page === pg ? 700 : 500, fontSize: 13,
                        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                    >{pg}</button>
                  )
                )}

                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  style={{
                    width: 36, height: 36, borderRadius: 10, border: "1.5px solid #e2e8f0",
                    background: page === totalPages ? "#f8fafc" : "white",
                    color: page === totalPages ? "#cbd5e1" : "#374151",
                    fontWeight: 700, fontSize: 16, cursor: page === totalPages ? "default" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >›</button>
              </div>
            </div>
          )}
        </div>

        {/* Responsive styles */}
        <style>{`
          .patients-grid {
            display: grid;
            gap: 16px;
            align-items: center;
            grid-template-columns: minmax(140px,1.8fr) 1.2fr 0.7fr 0.9fr 0.7fr 0.8fr 80px;
          }
          .patients-stat-grid {
            display: grid;
            gap: 16px;
            grid-template-columns: repeat(5, minmax(0,1fr));
          }
          /* Ensure filter chips visible on tablet, toggle button hidden */
          @media (min-width:768px) {
            .filter-chips-desktop { display: flex !important; }
            .filter-toggle-mobile { display: none !important; }
          }
          @media (min-width:1024px) and (max-width:1300px) {
            .patients-grid { grid-template-columns: minmax(130px,1.6fr) 1fr 0.6fr 0.85fr 0.6fr 0.75fr 70px; gap: 12px; }
            .patients-stat-grid { gap: 12px; }
          }
          @media (max-width:1023px) and (min-width:768px) {
            .patients-grid { grid-template-columns: minmax(130px,1.6fr) 1fr 0.6fr 0.85fr 0.6fr 0.75fr 70px; gap: 10px; }
            .patients-stat-grid { grid-template-columns: repeat(3, minmax(0,1fr)); }
          }
          @media (max-width:767px) {
            .patients-stat-grid { grid-template-columns: repeat(2, minmax(0,1fr)); gap: 10px; }
            .patient-table-header { display: none !important; }
            .patient-desktop-row  { display: none !important; }
            .patient-mobile-card  {
              display: block !important;
              position: relative;
              padding: 16px 16px 16px 20px;
              border-bottom: 1px solid #f1f5f9;
              cursor: pointer;
              transition: background 0.15s;
              background: white;
            }
            .patient-mobile-card:hover { background: #fafafa; }
          }
        `}</style>
      </main>
    </div>
  );
}