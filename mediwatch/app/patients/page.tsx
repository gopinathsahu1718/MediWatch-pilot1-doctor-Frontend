"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import {
  Search, Users, Activity, PauseCircle, CheckCircle2,
  Clock, UserX, SlidersHorizontal, ChevronDown, X, ArrowUpDown,
} from "lucide-react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

type ApiStatus = "active" | "inactive" | "completed" | "incomplete" | "pending_login";
type SortOption = "none" | "az" | "za" | "risk_high" | "risk_low";

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
  last_trend?: string | null;
  last_score?: number | null;
  last_submitted?: string | null;
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

interface DiseaseOption {
  id: string;
  name: string;
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

const RISK_META: Record<string, { label: string; color: string; bg: string; weight: number }> = {
  high:   { label: "High",   color: "#dc2626", bg: "#fee2e2", weight: 3 },
  medium: { label: "Medium", color: "#a16207", bg: "#fef9c3", weight: 2 },
  low:    { label: "Low",    color: "#15803d", bg: "#dcfce7", weight: 1 },
};

const TREND_META: Record<string, { label: string; color: string; bg: string }> = {
  red:    { label: "Red",    color: "#dc2626", bg: "#fee2e2" },
  yellow: { label: "Yellow", color: "#a16207", bg: "#fef9c3" },
  green:  { label: "Green",  color: "#15803d", bg: "#dcfce7" },
};

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "none",      label: "Default order" },
  { value: "az",        label: "Name: A → Z" },
  { value: "za",        label: "Name: Z → A" },
  { value: "risk_high", label: "Risk: High first" },
  { value: "risk_low",  label: "Risk: Low first" },
];

const STATUS_FILTERS = [
  { value: "all",           label: "All Statuses" },
  { value: "active",        label: "Active" },
  { value: "inactive",      label: "Inactive" },
  { value: "completed",     label: "Completed" },
  { value: "incomplete",    label: "Incomplete" },
  { value: "pending_login", label: "Pending Login" },
];

function sortPatients(patients: ApiPatient[], sort: SortOption): ApiPatient[] {
  if (sort === "none") return patients;
  return [...patients].sort((a, b) => {
    if (sort === "az") return a.name.localeCompare(b.name);
    if (sort === "za") return b.name.localeCompare(a.name);
    const wa = RISK_META[a.risk_category]?.weight ?? 0;
    const wb = RISK_META[b.risk_category]?.weight ?? 0;
    return sort === "risk_high" ? wb - wa : wa - wb;
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PatientsPage() {
  const router = useRouter();

  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortOption,   setSortOption]   = useState<SortOption>("none");
  const [page,         setPage]         = useState(1);
  const LIMIT = 20;

  const [stats,      setStats]      = useState<PatientsStats | null>(null);
  const [patients,   setPatients]   = useState<ApiPatient[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [diseases,   setDiseases]   = useState<DiseaseOption[]>([]);
  const [selectedDisease, setSelectedDisease] = useState<string>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);

  // Filter dropdown state
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ── Fetch ──────────────────────────────────────────────────────────────────
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

  useEffect(() => {
    const t = setTimeout(() => {
      fetchPatients(search, statusFilter, page);
    }, search ? 400 : 0);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter, page]);

  useEffect(() => {
    async function loadDiseases() {
      const token = getToken();
      if (!token) return;
      try {
        const res = await fetch("https://api.mediwatch.in/api/v1/doctor/diseases", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const raw = await res.json();
        const list = Array.isArray(raw?.data?.diseases) ? raw.data.diseases : [];
        setDiseases(list.map((item: any) => ({ id: String(item.id ?? item.disease_id ?? item.name), name: String(item.name ?? "") })));
      } catch {
        // ignore disease fetch failures; filter remains available with empty list
      }
    }

    loadDiseases();
  }, []);

  const handleSearch = (v: string) => { setSearch(v);       setPage(1); };
  const handleStatus = (v: string) => { setStatusFilter(v); setPage(1); };

  const normalizedSearch = search.trim().toLowerCase();
  const filteredPatients = patients.filter((p) => {
    if (selectedDisease !== "all") {
      const diseaseName = (p.disease_name || "").toLowerCase();
      const selectedName = diseases.find(d => d.id === selectedDisease)?.name?.toLowerCase() ?? "";
      const matchesDisease = p.disease_name === selectedDisease || diseaseName.includes(selectedName) || selectedName.includes(diseaseName);
      if (!matchesDisease) return false;
    }

    if (fromDate || toDate) {
      const createdAt = p.created_at;
      if (!createdAt) return false;
      const createdTime = new Date(createdAt).getTime();
      if (Number.isNaN(createdTime)) return false;
      if (fromDate) {
        const fromTime = new Date(`${fromDate}T00:00:00`).getTime();
        if (createdTime < fromTime) return false;
      }
      if (toDate) {
        const toTime = new Date(`${toDate}T23:59:59`).getTime();
        if (createdTime > toTime) return false;
      }
    }

    if (!normalizedSearch) return true;
    return (
      p.name.toLowerCase().includes(normalizedSearch) ||
      p.phone.toLowerCase().includes(normalizedSearch)
    );
  });

  const hasFilters = statusFilter !== "all" || sortOption !== "none" || selectedDisease !== "all" || fromDate !== "" || toDate !== "";
  const filterBadgeCount = (statusFilter !== "all" ? 1 : 0)
    + (sortOption !== "none" ? 1 : 0)
    + (selectedDisease !== "all" ? 1 : 0)
    + (fromDate !== "" ? 1 : 0)
    + (toDate !== "" ? 1 : 0);

  const filteredSortedPatients = sortPatients(filteredPatients, sortOption);
  const isLocalFilterActive = selectedDisease !== "all" || fromDate !== "" || toDate !== "";
  const effectiveTotal = isLocalFilterActive ? filteredSortedPatients.length : pagination?.total ?? 0;
  const effectiveTotalPages = isLocalFilterActive ? Math.max(1, Math.ceil(filteredSortedPatients.length / LIMIT)) : pagination?.totalPages ?? 1;
  const effectivePage = Math.min(page, effectiveTotalPages);
  const displayedPatients = filteredSortedPatients.slice((effectivePage - 1) * LIMIT, effectivePage * LIMIT);

  function clearAllFilters() {
    setStatusFilter("all");
    setSortOption("none");
    setSelectedDisease("all");
    setFromDate("");
    setToDate("");
    setPage(1);
  }

  // ── Pagination ─────────────────────────────────────────────────────────────
  const totalPages = effectiveTotalPages;
  const currentPage = effectivePage;
  const getPageNumbers = (): (number | "…")[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "…")[] = [1];
    if (currentPage > 3) pages.push("…");
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push("…");
    pages.push(totalPages);
    return pages;
  };

  const n = (v: string | number | undefined) => Number(v ?? 0);

  const COL_HEADERS = ["Patient", "Disease", "Trend", "Status", "Monitoring", "Registered", "Action"];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="page-shell">
      <Sidebar />
      <main className="main-content">

        {/* ── Page Header ── */}
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
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            background: "rgba(255,255,255,0.15)",
            border: "1.5px solid rgba(255,255,255,0.25)",
            borderRadius: 16, padding: "12px 20px", flexShrink: 0,
          }}>
            <Users size={22} color="white" />
            <div style={{ textAlign: "center" }}>
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
        <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
          {/* Search input */}
          <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
            <span style={{
              position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)",
              display: "inline-flex", alignItems: "center", color: "#94a3b8",
            }}>
              <Search size={16} />
            </span>
            <input
              className="mw-input"
              style={{ paddingLeft: 44, width: "100%", boxSizing: "border-box" }}
              placeholder="Search by name or phone…"
              value={search}
              onChange={e => handleSearch(e.target.value)}
            />
          </div>

          {/* Filter button + dropdown */}
          <div ref={filterRef} style={{ position: "relative", flexShrink: 0 }}>
            <button
              onClick={() => setFilterOpen(v => !v)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "11px 18px", borderRadius: 14,
                border: "1.5px solid",
                borderColor: hasFilters ? "#1D9E75" : "#e2e8f0",
                background: hasFilters ? "rgba(29,158,117,0.07)" : "white",
                color: hasFilters ? "#1D9E75" : "#374151",
                fontWeight: 600, fontSize: 13, cursor: "pointer",
                transition: "all 0.18s",
                boxShadow: filterOpen ? "0 0 0 3px rgba(29,158,117,0.15)" : "none",
              }}
            >
              <SlidersHorizontal size={15} />
              <span>Filter</span>
              {filterBadgeCount > 0 && (
                <span style={{
                  background: "#1D9E75", color: "white",
                  borderRadius: 99, fontSize: 10, fontWeight: 800,
                  width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center",
                  marginLeft: -2,
                }}>
                  {filterBadgeCount}
                </span>
              )}
              <ChevronDown
                size={14}
                style={{ marginLeft: -2, transition: "transform 0.2s", transform: filterOpen ? "rotate(180deg)" : "none" }}
              />
            </button>

            {/* Dropdown panel */}
            {filterOpen && (
              <div style={{
                position: "absolute", top: "calc(100% + 8px)", right: 0,
                background: "white", borderRadius: 18,
                boxShadow: "0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(142, 27, 27, 0.06), inset 0 1px 2px rgba(255,255,255,0.8), inset 0 -2px 4px rgba(0,0,0,0.03)",
                border: "1px solid #e2e8f0",
                zIndex: 100, minWidth: 260, maxHeight: 320, overflowY: "auto",
                animation: "dropIn 0.18s ease",
              }}>
                {/* Status section */}
                <div style={{ padding: "16px 16px 12px" }}>
                  <div style={{
                    fontSize: 10, fontWeight: 800, color: "#94a3b8",
                    textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10,
                  }}>
                    Status
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {STATUS_FILTERS.map(f => (
                      <button
                        key={f.value}
                        onClick={() => { handleStatus(f.value); }}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "9px 12px", borderRadius: 10, border: "none",
                          background: statusFilter === f.value ? "rgba(29,158,117,0.08)" : "transparent",
                          color: statusFilter === f.value ? "#1D9E75" : "#374151",
                          fontWeight: statusFilter === f.value ? 700 : 500,
                          fontSize: 13, cursor: "pointer", textAlign: "left",
                          transition: "background 0.15s",
                          width: "100%",
                        }}
                        onMouseEnter={e => {
                          if (statusFilter !== f.value)
                            (e.currentTarget as HTMLButtonElement).style.background = "#f8fafc";
                        }}
                        onMouseLeave={e => {
                          if (statusFilter !== f.value)
                            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                        }}
                      >
                        <span>{f.label}</span>
                        {statusFilter === f.value && (
                          <span style={{
                            width: 8, height: 8, borderRadius: "50%",
                            background: "#1D9E75", flexShrink: 0,
                          }} />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Divider */}
                <div style={{ height: 1, background: "#f1f5f9", margin: "0 16px" }} />

                {/* Disease section */}
                <div style={{ padding: "12px 16px 16px" }}>
                  <div style={{
                    fontSize: 10, fontWeight: 800, color: "#94a3b8",
                    textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10,
                  }}>
                    Disease
                  </div>
                  <select
                    value={selectedDisease}
                    onChange={e => { setSelectedDisease(e.target.value); setPage(1); }}
                    style={{
                      width: "100%", padding: "10px 12px", borderRadius: 12,
                      border: "1.5px solid #e2e8f0", background: "white",
                      color: "#374151", fontSize: 13, outline: "none",
                    }}
                  >
                    <option value="all">All diseases</option>
                    {diseases.map(disease => (
                      <option key={disease.id} value={disease.id}>{disease.name}</option>
                    ))}
                  </select>
                </div>

                {/* Date range section */}
                <div style={{ padding: "12px 16px 16px" }}>
                  <div style={{
                    fontSize: 10, fontWeight: 800, color: "#94a3b8",
                    textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10,
                  }}>
                    Registered date range
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 11, color: "#475569" }}>
                      From
                      <input
                        type="date"
                        value={fromDate}
                        onChange={e => { setFromDate(e.target.value); setPage(1); }}
                        style={{ padding: "10px 12px", borderRadius: 12, border: "1.5px solid #e2e8f0", outline: "none", fontSize: 13 }}
                      />
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 11, color: "#475569" }}>
                      To
                      <input
                        type="date"
                        value={toDate}
                        onChange={e => { setToDate(e.target.value); setPage(1); }}
                        style={{ padding: "10px 12px", borderRadius: 12, border: "1.5px solid #e2e8f0", outline: "none", fontSize: 13 }}
                      />
                    </label>
                  </div>
                </div>

                {/* Divider */}
                <div style={{ height: 1, background: "#f1f5f9", margin: "0 16px" }} />

                {/* Sort section */}
                <div style={{ padding: "12px 16px 16px" }}>
                  <div style={{
                    fontSize: 10, fontWeight: 800, color: "#94a3b8",
                    textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10,
                    display: "flex", alignItems: "center", gap: 6,
                  }}>
                    <ArrowUpDown size={11} />
                    Sort
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {SORT_OPTIONS.map(s => (
                      <button
                        key={s.value}
                        onClick={() => setSortOption(s.value)}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "9px 12px", borderRadius: 10, border: "none",
                          background: sortOption === s.value ? "rgba(55,138,221,0.08)" : "transparent",
                          color: sortOption === s.value ? "#378ADD" : "#374151",
                          fontWeight: sortOption === s.value ? 700 : 500,
                          fontSize: 13, cursor: "pointer", textAlign: "left",
                          transition: "background 0.15s", width: "100%",
                        }}
                        onMouseEnter={e => {
                          if (sortOption !== s.value)
                            (e.currentTarget as HTMLButtonElement).style.background = "#f8fafc";
                        }}
                        onMouseLeave={e => {
                          if (sortOption !== s.value)
                            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                        }}
                      >
                        <span>{s.label}</span>
                        {sortOption === s.value && (
                          <span style={{
                            width: 8, height: 8, borderRadius: "50%",
                            background: "#378ADD", flexShrink: 0,
                          }} />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Footer — clear all */}
                {hasFilters && (
                  <>
                    <div style={{ height: 1, background: "#f1f5f9" }} />
                    <div style={{ padding: "10px 16px" }}>
                      <button
                        onClick={() => { clearAllFilters(); setFilterOpen(false); }}
                        style={{
                          width: "100%", padding: "9px", borderRadius: 10,
                          border: "1.5px solid #fca5a5", background: "#fef2f2",
                          color: "#dc2626", fontSize: 12, fontWeight: 700,
                          cursor: "pointer", display: "flex", alignItems: "center",
                          justifyContent: "center", gap: 6,
                        }}
                      >
                        <X size={13} /> Clear all filters
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Active filter chips (pill summary) */}
        {hasFilters && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            {statusFilter !== "all" && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "5px 12px", borderRadius: 99,
                background: "rgba(29,158,117,0.1)", border: "1px solid rgba(29,158,117,0.25)",
                color: "#1D9E75", fontSize: 12, fontWeight: 600,
              }}>
                Status: {STATUS_FILTERS.find(f => f.value === statusFilter)?.label}
                <button
                  onClick={() => handleStatus("all")}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "inline-flex", color: "#1D9E75" }}
                >
                  <X size={11} />
                </button>
              </span>
            )}
            {selectedDisease !== "all" && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "5px 12px", borderRadius: 99,
                background: "rgba(148,163,184,0.1)", border: "1px solid rgba(148,163,184,0.25)",
                color: "#475569", fontSize: 12, fontWeight: 600,
              }}>
                Disease: {diseases.find(d => d.id === selectedDisease)?.name ?? selectedDisease}
                <button
                  onClick={() => { setSelectedDisease("all"); setPage(1); }}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "inline-flex", color: "#475569" }}
                >
                  <X size={11} />
                </button>
              </span>
            )}
            {fromDate !== "" && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "5px 12px", borderRadius: 99,
                background: "rgba(148,163,184,0.1)", border: "1px solid rgba(148,163,184,0.25)",
                color: "#475569", fontSize: 12, fontWeight: 600,
              }}>
                From: {fromDate}
                <button
                  onClick={() => { setFromDate(""); setPage(1); }}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "inline-flex", color: "#475569" }}
                >
                  <X size={11} />
                </button>
              </span>
            )}
            {toDate !== "" && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "5px 12px", borderRadius: 99,
                background: "rgba(148,163,184,0.1)", border: "1px solid rgba(148,163,184,0.25)",
                color: "#475569", fontSize: 12, fontWeight: 600,
              }}>
                To: {toDate}
                <button
                  onClick={() => { setToDate(""); setPage(1); }}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "inline-flex", color: "#475569" }}
                >
                  <X size={11} />
                </button>
              </span>
            )}
            {sortOption !== "none" && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "5px 12px", borderRadius: 99,
                background: "rgba(55,138,221,0.1)", border: "1px solid rgba(55,138,221,0.25)",
                color: "#378ADD", fontSize: 12, fontWeight: 600,
              }}>
                Sort: {SORT_OPTIONS.find(s => s.value === sortOption)?.label}
                <button
                  onClick={() => setSortOption("none")}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "inline-flex", color: "#378ADD" }}
                >
                  <X size={11} />
                </button>
              </span>
            )}
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
          {!loading && displayedPatients.map(p => {
            const sm = STATUS_META[p.status] ?? STATUS_META.inactive;
            const tm = p.last_trend ? (TREND_META[p.last_trend] ?? { label: p.last_trend, color: "#475569", bg: "#f8fafc" }) : { label: "Not submitted", color: "#64748b", bg: "#f8fafc" };
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
                  onClick={() => router.push(`/IDpatient/${p.id}`)}
                  onMouseEnter={e => (e.currentTarget.style.background = "#fafafa")}
                  onMouseLeave={e => (e.currentTarget.style.background = "white")}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: "#0f172a", fontSize: 14 }}>{p.name}</div>
                    <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 2 }}>{p.phone}</div>
                  </div>
                  <div style={{ fontSize: 13, color: "#475569" }}>{p.disease_name || "—"}</div>
                  <div>
                    <span style={{ padding: "3px 10px", borderRadius: 99, fontSize: 12, fontWeight: 600, background: tm.bg, color: tm.color }}>
                      {tm.label}
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
                  {/* Action column */}
                  <div onClick={e => e.stopPropagation()}>
                    <Link href={`/IDpatient/${p.id}`}>
                      <button style={{
                        padding: "6px 16px", borderRadius: 10,
                        border: "1.5px solid #378ADD", color: "#378ADD",
                        background: "transparent", fontSize: 12, fontWeight: 600, cursor: "pointer",
                        transition: "all 0.15s",
                      }}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLButtonElement).style.background = "#378ADD";
                          (e.currentTarget as HTMLButtonElement).style.color = "white";
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                          (e.currentTarget as HTMLButtonElement).style.color = "#378ADD";
                        }}
                      >
                        View
                      </button>
                    </Link>
                  </div>
                </div>

                {/* Mobile card */}
                <div
                  className="patient-mobile-card"
                  style={{ display: "none" }}
                >
                  <div style={{
                    position: "absolute", left: 0, top: 0, bottom: 0,
                    width: 4, borderRadius: "0 4px 4px 0", background: tm.color,
                  }} />
                  <div style={{ paddingLeft: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: 14, flexShrink: 0,
                        background: tm.bg, display: "flex", alignItems: "center", justifyContent: "center",
                        fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 15, color: tm.color,
                      }}>
                        {initials}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                        <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 2 }}>{p.phone}</div>
                      </div>
                      <span style={{ padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600, background: tm.bg, color: tm.color, flexShrink: 0 }}>{tm.label}</span>
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
                      <Link href={`/IDpatient/${p.id}`}>
                        <button style={{ padding: "8px 18px", borderRadius: 10, background: "#eff6ff", color: "#378ADD", fontSize: 13, fontWeight: 700, cursor: "pointer",border: "1px solid #9d9d9d" }}>View</button>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Empty state */}
          {!loading && displayedPatients.length === 0 && (
            <div style={{ padding: "56px 24px", textAlign: "center" }}>
              <Users size={40} style={{ color: "#e2e8f0", marginBottom: 12,margin:"auto" }} />
              <div style={{ color: "#94a3b8", fontWeight: 500 }}>No patients found</div>
              {(search || statusFilter !== "all") && (
                <button
                  onClick={() => { setSearch(""); clearAllFilters(); }}
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
          {!loading && displayedPatients.length > 0 && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "16px 24px", borderTop: "1px solid #f1f5f9",
              flexWrap: "wrap", gap: 12,
            }}>
              <div style={{ fontSize: 13, color: "#94a3b8", whiteSpace: "nowrap" }}>
                Showing{" "}
                <span style={{ fontWeight: 600, color: "#374151" }}>
                  {(currentPage - 1) * LIMIT + 1}–{Math.min(currentPage * LIMIT, effectiveTotal)}
                </span>{" "}
                of{" "}
                <span style={{ fontWeight: 600, color: "#374151" }}>{effectiveTotal}</span>{" "}
                patients
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  style={{
                    width: 36, height: 36, borderRadius: 10, border: "1.5px solid #e2e8f0",
                    background: currentPage === 1 ? "#f8fafc" : "white",
                    color: currentPage === 1 ? "#cbd5e1" : "#374151",
                    fontWeight: 700, fontSize: 16, cursor: currentPage === 1 ? "default" : "pointer",
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
                        borderColor: currentPage === pg ? "#1D9E75" : "#e2e8f0",
                        background: currentPage === pg ? "rgba(29,158,117,0.08)" : "white",
                        color: currentPage === pg ? "#1D9E75" : "#374151",
                        fontWeight: currentPage === pg ? 700 : 500, fontSize: 13,
                        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                    >{pg}</button>
                  )
                )}

                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  style={{
                    width: 36, height: 36, borderRadius: 10, border: "1.5px solid #e2e8f0",
                    background: currentPage === totalPages ? "#f8fafc" : "white",
                    color: currentPage === totalPages ? "#cbd5e1" : "#374151",
                    fontWeight: 700, fontSize: 16, cursor: currentPage === totalPages ? "default" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >›</button>
              </div>
            </div>
          )}
        </div>

        {/* Responsive styles */}
        <style>{`
          @keyframes dropIn {
            from { opacity: 0; transform: translateY(-6px) scale(0.98); }
            to   { opacity: 1; transform: translateY(0)   scale(1); }
          }
          div[style*="maxHeight: 320px"]::-webkit-scrollbar {
            width: 6px;
          }
          div[style*="maxHeight: 320px"]::-webkit-scrollbar-track {
            background: transparent;
          }
          div[style*="maxHeight: 320px"]::-webkit-scrollbar-thumb {
            background: #cbd5e1;
            border-radius: 3px;
          }
          div[style*="maxHeight: 320px"]::-webkit-scrollbar-thumb:hover {
            background: #94a3b8;
          }
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