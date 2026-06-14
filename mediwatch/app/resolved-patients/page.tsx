"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import {
  Search, Users, CheckCircle2,
  SlidersHorizontal, ChevronDown, X, ArrowUpDown,
} from "lucide-react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

type SortOption = "none" | "az" | "za" | "risk_high" | "risk_low" | "score_high" | "score_low";

// Resolved alert from GET /doctor/alerts?status=resolved
interface ResolvedAlert {
  id: string;                        // alert ID
  alert_type: "red" | "yellow";
  alert_status: "resolved";
  created_at: string;
  resolved_at: string | null;
  resolved_at_ist: string | null;
  resolved_by_name: string | null;
  resolution_note: string | null;
  resolution_category: string | null;
  patient_id: string;
  patient_name: string;
  patient_readable_id: string;
  patient_phone: string;
  risk_category: "low" | "medium" | "high";
  day_number: number | null;
  disease_score: number | string | null;
  submission_trend: string | null;
  disease_id?: string;
  disease_name?: string;
  diagnosis?: string;
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

const BASE_URL = "https://api.mediwatch.in";

function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("doctor_token") ?? "";
}

function normalizeName(name: string | null | undefined): string {
  return String(name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatScore(val: number | string | null | undefined): string {
  if (val == null) return "—";
  const n = typeof val === "number" ? val : Number(val);
  if (Number.isNaN(n)) return "—";
  return n.toFixed(1);
}

function getScoreColor(score: number | undefined | null) {
  if (score === undefined || score === null || Number.isNaN(Number(score))) {
    return { color: "#374151", background: "#f8fafc" };
  }
  const n = Number(score);
  if (n < 4) return { color: "#15803d", background: "#dcfce7" };
  if (n < 6) return { color: "#a16207", background: "#fef9c3" };
  return { color: "#dc2626", background: "#fee2e2" };
}


const RISK_META: Record<string, { label: string; color: string; bg: string; weight: number }> = {
  high: { label: "High", color: "#dc2626", bg: "#fee2e2", weight: 3 },
  medium: { label: "Medium", color: "#a16207", bg: "#fef9c3", weight: 2 },
  low: { label: "Low", color: "#15803d", bg: "#dcfce7", weight: 1 },
};

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "none", label: "Default order" },
  { value: "az", label: "Name: A → Z" },
  { value: "za", label: "Name: Z → A" },
  { value: "score_high", label: "Score: High first" },
  { value: "score_low", label: "Score: Low first" },
  { value: "risk_high", label: "Risk: High first" },
  { value: "risk_low", label: "Risk: Low first" },
];

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "red", label: "Red" },
  { value: "yellow", label: "Yellow" },
];

function compareSort(a: ResolvedAlert, b: ResolvedAlert, sort: SortOption): number {
  if (sort === "az") return a.patient_name.localeCompare(b.patient_name);
  if (sort === "za") return b.patient_name.localeCompare(a.patient_name);

  if (sort === "score_high" || sort === "score_low") {
    const aScore = Number(a.disease_score ?? NaN);
    const bScore = Number(b.disease_score ?? NaN);
    if (Number.isNaN(aScore) && Number.isNaN(bScore)) return 0;
    if (Number.isNaN(aScore)) return 1;
    if (Number.isNaN(bScore)) return -1;
    return sort === "score_high" ? bScore - aScore : aScore - bScore;
  }

  const wa = RISK_META[a.risk_category]?.weight ?? 0;
  const wb = RISK_META[b.risk_category]?.weight ?? 0;
  return sort === "risk_high" ? wb - wa : wa - wb;
}

function sortPatients(patients: ResolvedAlert[], sort: SortOption): ResolvedAlert[] {
  if (sort === "none") return patients;
  return [...patients].sort((a, b) => compareSort(a, b, sort));
}

function prioritizeResolvedByDoctor(patients: ResolvedAlert[], doctorName: string, sort: SortOption): ResolvedAlert[] {
  const currentDoctorKey = normalizeName(doctorName);
  if (!currentDoctorKey) {
    return sortPatients(patients, sort);
  }

  return [...patients].sort((a, b) => {
    const aIsCurrent = normalizeName(a.resolved_by_name) === currentDoctorKey ? 0 : 1;
    const bIsCurrent = normalizeName(b.resolved_by_name) === currentDoctorKey ? 0 : 1;
    if (aIsCurrent !== bIsCurrent) return aIsCurrent - bIsCurrent;
    if (sort === "none") return 0;
    return compareSort(a, b, sort);
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ResolvedPatientsPage() {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortOption, setSortOption] = useState<SortOption>("none");
  const [page, setPage] = useState(1);
  const LIMIT = 20;

  const [patients, setPatients] = useState<ResolvedAlert[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentDoctorName, setCurrentDoctorName] = useState("");
  const [diseases, setDiseases] = useState<DiseaseOption[]>([]);
  const [selectedDisease, setSelectedDisease] = useState<string>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

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

  // Load current doctor profile name for ordering resolved patients
  useEffect(() => {
    async function fetchProfile() {
      const token = getToken();
      if (!token) return;
      try {
        const res = await fetch(`${BASE_URL}/api/v1/doctor/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        const profile = data?.data || data?.doctor || data;
        if (profile?.name) setCurrentDoctorName(String(profile.name).trim());
      } catch {
        // ignore profile fetch failures; ordering will fallback gracefully
      }
    }
    fetchProfile();

    async function loadDiseases() {
      const token = getToken();
      if (!token) return;
      try {
        const res = await fetch(`${BASE_URL}/api/v1/doctor/diseases`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const result = await res.json();
        const diseaseList = Array.isArray(result?.data?.diseases) ? result.data.diseases : [];
        setDiseases(diseaseList.map((d: any) => ({ id: d.id, name: d.name })));
      } catch {
        // ignore disease fetch failures; filter remains empty
      }
    }
    loadDiseases();
  }, []);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const routerRef = useRef(router);
  useEffect(() => { routerRef.current = router; }, [router]);

  async function fetchResolvedPatients(_search: string, status: string, page: number) {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      if (!token) { routerRef.current.replace("/login"); return; }

      // Fetch resolved alerts from the real alerts API
      // Frontend search is handled locally by name/readable ID, so do not pass search to the API.
      const params = new URLSearchParams();
      params.set("status", "resolved");
      params.set("page", String(page));
      params.set("limit", String(LIMIT));

      const res = await fetch(
        `https://api.mediwatch.in/api/v1/doctor/alerts?${params}`,
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
      const alerts: ResolvedAlert[] = Array.isArray(data?.alerts) ? data.alerts.map((alert: any) => ({
        ...alert,
        disease_id: alert.disease_id ?? alert.disease?.id ?? alert.patient?.disease_id ?? alert.patient_disease_id ?? undefined,
        disease_name: alert.disease_name ?? alert.disease?.name ?? alert.diagnosis ?? alert.patient?.disease_name ?? alert.patient_disease_name ?? undefined,
      })) : [];
      const pg = data?.pagination;

      setPatients(alerts);
      setPagination(pg ? {
        total: pg.total,
        page: pg.page,
        limit: pg.limit,
        totalPages: pg.totalPages,
      } : { total: alerts.length, page: 1, limit: LIMIT, totalPages: 1 });

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => {
      fetchResolvedPatients(search, statusFilter, page);
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, page]);

  const handleSearch = (v: string) => { setSearch(v); setPage(1); };
  const handleStatus = (v: string) => { setStatusFilter(v); setPage(1); };

  // Derived filtered + sorted list (filtering by alert_type happens on client-side)
  const searchLower = search.trim().toLowerCase();
  const filteredPatients = patients.filter(p => {
    const matchesStatus = statusFilter === "all" || p.alert_type === statusFilter;
    if (!matchesStatus) return false;

    const selectedDiseaseLower = selectedDisease.toLowerCase();
    const selectedDiseaseName = diseases.find(d => d.id === selectedDisease)?.name ?? "";
    const selectedDiseaseNameLower = normalizeName(selectedDiseaseName);
    const diseaseNameLower = normalizeName(p.disease_name ?? p.diagnosis ?? "");
    const matchesDisease = selectedDisease === "all" ||
      String(p.disease_id ?? "").toLowerCase() === selectedDiseaseLower ||
      diseaseNameLower === selectedDiseaseNameLower ||
      diseaseNameLower.includes(selectedDiseaseNameLower);
    if (!matchesDisease) return false;

    if (fromDate || toDate) {
      const resolvedAt = p.resolved_at_ist ?? p.resolved_at;
      if (!resolvedAt) return false;
      const resolvedTime = new Date(resolvedAt).getTime();
      if (Number.isNaN(resolvedTime)) return false;
      if (fromDate) {
        const fromTime = new Date(`${fromDate}T00:00:00`).getTime();
        if (resolvedTime < fromTime) return false;
      }
      if (toDate) {
        const toTime = new Date(`${toDate}T23:59:59`).getTime();
        if (resolvedTime > toTime) return false;
      }
    }

    if (!searchLower) return true;
    return (
      p.patient_name.toLowerCase().includes(searchLower) ||
      p.patient_readable_id.toLowerCase().includes(searchLower)
    );
  });

  const isLocalFilterActive = searchLower.length > 0 || statusFilter !== "all" || selectedDisease !== "all" || fromDate !== "" || toDate !== "";
  const filteredSortedPatients = prioritizeResolvedByDoctor(filteredPatients, currentDoctorName, sortOption);
  const filteredTotal = filteredSortedPatients.length;
  const localTotalPages = Math.max(1, Math.ceil(filteredTotal / LIMIT));
  const effectiveTotalPages = isLocalFilterActive ? localTotalPages : pagination?.totalPages ?? 1;
  const effectiveTotal = isLocalFilterActive ? filteredTotal : pagination?.total ?? 0;
  const effectivePage = Math.min(page, effectiveTotalPages);
  const displayedPatients = filteredSortedPatients.slice((effectivePage - 1) * LIMIT, effectivePage * LIMIT);

  // ── Computed filter label ──────────────────────────────────────────────────
  const hasFilters = statusFilter !== "all" || sortOption !== "none" || search.trim().length > 0 || selectedDisease !== "all" || fromDate !== "" || toDate !== "";
  const filterBadgeCount = (statusFilter !== "all" ? 1 : 0)
    + (sortOption !== "none" ? 1 : 0)
    + (search.trim().length > 0 ? 1 : 0)
    + (selectedDisease !== "all" ? 1 : 0)
    + (fromDate !== "" ? 1 : 0)
    + (toDate !== "" ? 1 : 0);

  function clearAllFilters() {
    setStatusFilter("all");
    setSortOption("none");
    setSearch("");
    setSelectedDisease("all");
    setFromDate("");
    setToDate("");
    setPage(1);
  }

  // ── Pagination ─────────────────────────────────────────────────────────────
  const totalPages = effectiveTotalPages;
  const getPageNumbers = (): (number | "…")[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "…")[] = [1];
    if (effectivePage > 3) pages.push("…");
    for (let i = Math.max(2, effectivePage - 1); i <= Math.min(totalPages - 1, effectivePage + 1); i++) pages.push(i);
    if (effectivePage < totalPages - 2) pages.push("…");
    pages.push(totalPages);
    return pages;
  };

  const COL_HEADERS = ["Patient", "Disease", "Alert Type", "Score", "Resolution", "Resolved", "Action"];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="page-shell">
      <Sidebar />
      <main className="main-content">

        {/* ── Page Header ── */}
        <div style={{
          background: "#1D9E75",
          padding: "20px 24px", borderRadius: 16, marginBottom: 28,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
        }}>
          <div>
            <h1 className="heading-font" style={{ fontSize: 28, fontWeight: 800, color: "white", margin: 0 }}>
              Resolved Patients
            </h1>
            <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 14, marginTop: 4, marginBottom: 0 }}>
              Patients with resolved triage status
            </p>
          </div>
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            background: "rgba(255,255,255,0.15)",
            border: "1.5px solid rgba(255,255,255,0.25)",
            borderRadius: 16, padding: "12px 20px", flexShrink: 0,
          }}>
            <CheckCircle2 size={22} color="white" />
            <div style={{ textAlign: "center" }}>
              <div className="heading-font" style={{ fontSize: 28, fontWeight: 800, color: "white", lineHeight: 1 }}>
                {loading ? "—" : pagination?.total ?? 0}
              </div>
              <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: 500, marginTop: 2 }}>
                Resolved Patients
              </div>
            </div>
          </div>
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
              onClick={() => fetchResolvedPatients(search, statusFilter, page)}
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
              placeholder="Search by name or patient ID…"
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
                boxShadow: "0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(142,27,27,0.06)",
                border: "1px solid #e2e8f0",
                zIndex: 100, minWidth: 260, maxHeight: 320, overflowY: "auto",
                animation: "dropIn 0.18s ease",
              }}>

                

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
                    Resolved date range
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

                {/* Alert section */}
                <div style={{ padding: "16px 16px 12px" }}>
                  <div style={{
                    fontSize: 10, fontWeight: 800, color: "#94a3b8",
                    textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10,
                  }}>
                    Alert Type
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {STATUS_FILTERS.map(f => (
                      <button
                        key={f.value}
                        onClick={() => handleStatus(f.value)}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "9px 12px", borderRadius: 10, border: "none",
                          background: statusFilter === f.value ? "rgba(29,158,117,0.08)" : "transparent",
                          color: statusFilter === f.value ? "#1D9E75" : "#374151",
                          fontWeight: statusFilter === f.value ? 700 : 500,
                          fontSize: 13, cursor: "pointer", textAlign: "left",
                          transition: "background 0.15s", width: "100%",
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

                {/* Divider */}
                <div style={{ height: 1, background: "#f1f5f9", margin: "0 16px" }} />



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

        {/* Active filter chips */}
        {hasFilters && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            {statusFilter !== "all" && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "5px 12px", borderRadius: 99,
                background: "rgba(29,158,117,0.1)", border: "1px solid rgba(29,158,117,0.25)",
                color: "#1D9E75", fontSize: 12, fontWeight: 600,
              }}>
                Alert type: {STATUS_FILTERS.find(f => f.value === statusFilter)?.label}
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
                  onClick={() => setSelectedDisease("all")}
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
                  onClick={() => setFromDate("")}
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
                  onClick={() => setToDate("")}
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
            {search.trim().length > 0 && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "5px 12px", borderRadius: 99,
                background: "rgba(148,163,184,0.1)", border: "1px solid rgba(148,163,184,0.25)",
                color: "#475569", fontSize: 12, fontWeight: 600,
              }}>
                Search: {search}
                <button
                  onClick={() => setSearch("")}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "inline-flex", color: "#475569" }}
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
              Loading resolved patients…
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* Patient rows */}
          {!loading && displayedPatients.map(p => {
            const rm = RISK_META[p.risk_category] ?? RISK_META.low;
            const scoreNum = p.disease_score != null ? Number(p.disease_score) : undefined;
            const scoreColorObj = getScoreColor(scoreNum);
            const scoreBadge = (
              <span style={{ padding: "4px 12px", borderRadius: 99, fontSize: 12, fontWeight: 700, background: scoreColorObj.background, color: scoreColorObj.color }}>
                {formatScore(p.disease_score)}
              </span>
            );
            const initials = p.patient_name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
            const alertTypeBg = p.alert_type === "red" ? "#fee2e2" : "#fef9c3";
            const alertTypeColor = p.alert_type === "red" ? "#dc2626" : "#a16207";
            const resolutionLabel = p.resolution_category ? p.resolution_category.replace(/_/g, " ") : "\u2014";

            return (
              <div key={p.id}>
                {/* Desktop row */}
                <div
                  className="patient-desktop-row patients-grid"
                  style={{
                    padding: "14px 24px", borderBottom: "1px solid #f1f5f9",
                    alignItems: "center", cursor: "pointer", transition: "background 0.15s",
                  }}
                  onClick={() => router.push(`/IDpatient/${p.patient_id}`)}
                  onMouseEnter={e => (e.currentTarget.style.background = "#fafafa")}
                  onMouseLeave={e => (e.currentTarget.style.background = "white")}
                >
                        <div>
                    <div style={{ fontWeight: 600, color: "#0f172a", fontSize: 14 }}>{p.patient_name}</div>
                    <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 2 }}>{p.patient_readable_id} · {p.patient_phone}</div>
                  </div>
                  <div style={{ fontSize: 13, color: "#475569", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={p.disease_name ?? p.diagnosis ?? ""}>
                    {p.disease_name ?? p.diagnosis ?? "—"}
                  </div>
                  <div><span style={{ padding: "3px 10px", borderRadius: 99, fontSize: 12, fontWeight: 700, background: alertTypeBg, color: alertTypeColor, textTransform: "uppercase" }}>{p.alert_type}</span></div>
                  
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{scoreBadge}</div>
                  <div style={{ fontSize: 12, color: "#374151", textTransform: "capitalize" }}>{resolutionLabel}</div>
                  <div style={{ display: "grid", gap: 4 }}>
                    <div style={{ fontSize: 13, color: "#475569", fontWeight: 600 }}>{p.resolved_by_name || "—"}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>{formatDateTime(p.resolved_at_ist ?? p.resolved_at)}</div>
                  </div>
                  <div onClick={e => e.stopPropagation()}>
                    <Link href={`/IDpatient/${p.patient_id}`}>
                      <button
                        style={{
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
                        <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.patient_name}</div>
                        <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 2 }}>{p.patient_readable_id}</div>
                      </div>
                      <span style={{ padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600, background: rm.bg, color: rm.color, flexShrink: 0 }}>{rm.label}</span>
                    </div>
                    <div style={{ height: 1, background: "#f1f5f9", marginBottom: 12 }} />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
                      {[
                        { label: "Alert", value: p.alert_type.toUpperCase(), valueColor: p.alert_type === "red" ? "#dc2626" : "#a16207" },
                        { label: "Resolution", value: resolutionLabel },
                        { label: "Score", value: scoreBadge },
                        { label: "Disease", value: p.disease_name ?? p.diagnosis ?? "—" },
                      ].map(stat => (
                        <div key={stat.label} style={{ background: "#f8fafc", borderRadius: 10, padding: "8px 10px" }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{stat.label}</div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: stat.valueColor ?? "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{stat.value}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }} onClick={e => e.stopPropagation()}>
                      <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>
                        <div>Resolved by <span style={{ color: "#64748b", fontWeight: 500 }}>{p.resolved_by_name || "—"}</span></div>
                        <div><span style={{ color: "#64748b", fontWeight: 500 }}>{formatDateTime(p.resolved_at_ist ?? p.resolved_at)}</span></div>
                      </div>
                      <Link href={`/IDpatient/${p.patient_id}`}>
                        <button style={{ padding: "8px 18px", borderRadius: 10, border: "1px solid #9d9d9d", background: "#eff6ff", color: "#378ADD", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                          View
                        </button>
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
              <Users size={40} style={{ color: "#e2e8f0", marginBottom: 12, margin: "auto" }} />
              <div style={{ color: "#94a3b8", fontWeight: 500 }}>No resolved patients found</div>
              {(search || statusFilter !== "all") && (
                <button
                  onClick={() => { setSearch(""); clearAllFilters(); }}
                  style={{
                    marginTop: 12, padding: "8px 20px", borderRadius: 10,
                    border: "1.5px solid #e2e8f0", background: "white",
                    color: "#64748b", fontSize: 13, fontWeight: 600, cursor: "pointer",
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>
          )}

          {/* Pagination */}
          {!loading && displayedPatients.length > 0 && pagination && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "16px 24px", borderTop: "1px solid #f1f5f9",
              flexWrap: "wrap", gap: 12,
            }}>
              <div style={{ fontSize: 13, color: "#94a3b8", whiteSpace: "nowrap" }}>
                Showing{" "}
                <span style={{ fontWeight: 600, color: "#374151" }}>
                  {(effectivePage - 1) * LIMIT + 1}–{Math.min(effectivePage * LIMIT, effectiveTotal)}
                </span>{" "}
                of{" "}
                <span style={{ fontWeight: 600, color: "#374151" }}>{effectiveTotal}</span>
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

        <style>{`
          @keyframes dropIn {
            from { opacity: 0; transform: translateY(-6px) scale(0.98); }
            to   { opacity: 1; transform: translateY(0) scale(1); }
          }
          .patients-grid {
            display: grid;
            gap: 16px;
            align-items: center;
            grid-template-columns: minmax(140px,1.4fr) 1fr 0.6fr 0.5fr 0.7fr 1.1fr 80px;
          }
          @media (min-width:1024px) and (max-width:1300px) {
            .patients-grid { grid-template-columns: minmax(130px,1.4fr) 1fr 0.6fr 0.5fr 0.7fr 1.1fr 70px; gap: 12px; }
          }
          @media (max-width:1023px) and (min-width:768px) {
            .patients-grid { grid-template-columns: minmax(130px,1.4fr) 1fr 0.6fr 0.5fr 0.7fr 1.1fr 70px; gap: 10px; }
          }
          @media (max-width:767px) {
            .patient-table-header { display: none !important; }
            .patient-desktop-row  { display: none !important; }
            .patient-mobile-card  {
              display: block !important;
              position: relative;
              padding: 16px 16px 16px 20px;
              border-bottom: 1px solid #f1f5f9;
            }
          }
        `}</style>
      </main>
    </div>
  );
}