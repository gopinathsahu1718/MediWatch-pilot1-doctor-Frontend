"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import {
  Search, Users, ShieldCheck, Activity, AlertTriangle,
  SlidersHorizontal, X, CheckCircle, Clock, ClipboardCheck, Bell,
} from "lucide-react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardStats {
  total_active: number;
  green: number;
  yellow: number;
  red: number;
}

interface ApiPatient {
  id: string;
  readable_id: string;
  name: string;
  trend_status: "red" | "yellow" | "green" | null;
  risk_category?: "high" | "medium" | "low";
  day_number: number;
  has_unack_alert: boolean | null;
  alert_id: string | null;
  age?: number;
  gender?: string;
  diagnosis?: string;
  disease_name?: string;
  monitoring_days?: number;
  contact?: string;
  phone?: string;
  relative_contact?: string;
  relative_phone?: string;
  last_submitted?: string;
  triage_status?: string;
}

interface RedAlert {
  alertId: string;
  patientId: string;
  patientReadableId: string;
  patientName: string;
  submissionId: string;
  alertType: string;
  diseaseScore: number;
  lastSubmissionTime: string;
  alertCreatedAt: string;
  reason: string;
}

interface DashboardResponse {
  stats: DashboardStats;
  activePatients: ApiPatient[];
  redAlerts: RedAlert[];
}

/** Normalised patient shape used by the UI */
interface Patient {
  id: string;
  readableId: string;
  name: string;
  trendStatus: "red" | "yellow" | "green";
  age: number;
  gender: string;
  diagnosis: string;
  monitoringDays: number;
  dayNumber: number;
  contact: string;
  relativeContact?: string;
  hasUnackAlert: boolean | null;
  alertId: string | null;
  lastSubmitted: string;
  triageStatus: string;
  // enriched from redAlerts
  diseaseScore?: number;
  alertReason?: string;
  // local UI lifecycle state
  lifecycleStatus: "ack" | "in_progress" | "resolved";
  isAcknowledging: boolean;
  isResolving: boolean;
}

const RESOLUTION_CATEGORIES = [
  "symptom improved",
  "false alert",
  "medication advised",
  "doctor consultation",
  "hospital visit recommended",
] as const;

type ResolutionCategory = (typeof RESOLUTION_CATEGORIES)[number];

interface ResolveModalState {
  alertId: string;
  patientId: string;
  patientName: string;
  category: ResolutionCategory | "";
  note: string;
  isSubmitting: boolean;
  error: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDateTime = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    const month = date.toLocaleDateString("en-US", { month: "short" });
    const day = date.getDate();
    const year = date.getFullYear();
    const time = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
    return `${month} ${day}, ${year} · ${time}`;
  } catch {
    return dateString;
  }
};

const normalisePatient = (p: ApiPatient, alertMap: Record<string, RedAlert>): Patient => {
  const alert = p.alert_id ? alertMap[p.alert_id] : Object.values(alertMap).find(a => a.patientId === p.id);
  const triageStatus = p.triage_status ?? "ack";
  const lifecycleStatus: Patient["lifecycleStatus"] =
    triageStatus === "resolved" ? "resolved"
    : triageStatus === "in_progress" ? "in_progress"
    : "ack";

  return {
    id: p.id,
    readableId: p.readable_id ?? p.id,
    name: p.name,
    trendStatus: p.trend_status ?? "green",
    age: p.age ?? 0,
    gender: p.gender ?? "—",
    diagnosis: p.disease_name ?? p.diagnosis ?? "—",
    monitoringDays: p.monitoring_days ?? 0,
    dayNumber: p.day_number,
    contact: p.phone ?? p.contact ?? "",
    relativeContact: p.relative_phone ?? p.relative_contact,
    hasUnackAlert: p.has_unack_alert,
    alertId: p.alert_id ?? alert?.alertId ?? null,
    lastSubmitted: p.last_submitted ?? new Date().toISOString(),
    triageStatus,
    diseaseScore: alert?.diseaseScore,
    alertReason: alert?.reason,
    lifecycleStatus,
    isAcknowledging: false,
    isResolving: false,
  };
};

const CATEGORY_LABELS: Record<ResolutionCategory, string> = {
  "symptom improved": "Symptom Improved",
  "false alert": "False Alert",
  "medication advised": "Medication Advised",
  "doctor consultation": "Doctor Consultation",
  "hospital visit recommended": "Hospital Visit Recommended",
};

const CATEGORY_ICONS: Record<ResolutionCategory, string> = {
  "symptom improved": "✅",
  "false alert": "🔕",
  "medication advised": "💊",
  "doctor consultation": "🩺",
  "hospital visit recommended": "🏥",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [callModal, setCallModal] = useState<Patient | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  const [stats, setStats] = useState<DashboardStats>({ total_active: 0, green: 0, yellow: 0, red: 0 });
  const [redPatients, setRedPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolveModal, setResolveModal] = useState<ResolveModalState | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);

  // ── Fetch dashboard ───────────────────────────────────────────────────────

  const fetchDashboard = useCallback(async (search: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
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
      const data = raw?.data ?? raw;

      const statsRaw = data?.stats ?? {};
      setStats({
        total_active: Number(statsRaw.total_active ?? 0),
        green:        Number(statsRaw.green        ?? 0),
        yellow:       Number(statsRaw.yellow       ?? 0),
        red:          Number(statsRaw.red          ?? 0),
      });

      // Build alertMap from redAlerts for enrichment
      const alertMap: Record<string, RedAlert> = {};
      (Array.isArray(data?.redAlerts) ? data.redAlerts : []).forEach((a: RedAlert) => {
        alertMap[a.alertId] = a;
      });

      // Only red trend patients
      const list: ApiPatient[] = Array.isArray(data?.activePatients) ? data.activePatients : [];
      const red = list
        .filter(p => p.trend_status === "red")
        .map(p => normalisePatient(p, alertMap));

      setRedPatients(prev => {
        // Preserve local lifecycle state on re-fetch
        return red.map(p => {
          const existing = prev.find(e => e.id === p.id);
          if (existing) {
            return {
              ...p,
              lifecycleStatus: existing.lifecycleStatus,
              isAcknowledging: existing.isAcknowledging,
              isResolving: existing.isResolving,
            };
          }
          return p;
        });
      });

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchDashboard(search);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, fetchDashboard]);

  // ── Acknowledge: ack → in_progress ───────────────────────────────────────

  const acknowledgePatient = async (patientId: string) => {
    setRedPatients(prev =>
      prev.map(p => p.id === patientId ? { ...p, isAcknowledging: true } : p)
    );

    try {
      const res = await fetch(
        `https://api.mediwatch.in/api/v1/doctor/patients/${patientId}/triage`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${getToken()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ triageStatus: "in_progress" }),
        }
      );

      if (!res.ok) throw new Error(`Failed to acknowledge (${res.status})`);

      setRedPatients(prev =>
        prev.map(p =>
          p.id === patientId
            ? { ...p, lifecycleStatus: "in_progress", isAcknowledging: false }
            : p
        )
      );

    } catch {
      setRedPatients(prev =>
        prev.map(p => p.id === patientId ? { ...p, isAcknowledging: false } : p)
      );
    }
  };

  // ── Open resolve modal ────────────────────────────────────────────────────

  const openResolveModal = (patient: Patient) => {
    setResolveModal({
      alertId: patient.alertId ?? "",
      patientId: patient.id,
      patientName: patient.name,
      category: "",
      note: "",
      isSubmitting: false,
      error: null,
    });
  };

  // ── Submit resolve: in_progress → resolved ────────────────────────────────

  const submitResolve = async () => {
    if (!resolveModal) return;

    if (!resolveModal.category) {
      setResolveModal(prev => prev ? { ...prev, error: "Please select a resolution category." } : null);
      return;
    }
    if (!resolveModal.note.trim()) {
      setResolveModal(prev => prev ? { ...prev, error: "Resolution note cannot be empty." } : null);
      return;
    }

    setResolveModal(prev => prev ? { ...prev, isSubmitting: true, error: null } : null);
    setRedPatients(prev =>
      prev.map(p => p.id === resolveModal.patientId ? { ...p, isResolving: true } : p)
    );

    try {
      // Step 1: Resolve the alert
      if (resolveModal.alertId) {
        const resolveRes = await fetch(
          `https://api.mediwatch.in/api/v1/doctor/alerts/${resolveModal.alertId}/resolve`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${getToken()}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              resolutionCategory: resolveModal.category,
              resolutionNote: resolveModal.note.trim(),
            }),
          }
        );

        if (!resolveRes.ok) {
          const errBody = await resolveRes.json().catch(() => ({}));
          throw new Error(errBody?.message ?? `Failed to resolve alert (${resolveRes.status})`);
        }
      }

      // Step 2: Update triage status to resolved
      const triageRes = await fetch(
        `https://api.mediwatch.in/api/v1/doctor/patients/${resolveModal.patientId}/triage`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${getToken()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ triageStatus: "resolved" }),
        }
      );

      if (!triageRes.ok) throw new Error(`Failed to update triage status (${triageRes.status})`);

      setRedPatients(prev =>
        prev.map(p =>
          p.id === resolveModal.patientId
            ? { ...p, lifecycleStatus: "resolved", isResolving: false }
            : p
        )
      );

      setResolveModal(null);

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setResolveModal(prev => prev ? { ...prev, isSubmitting: false, error: msg } : null);
      setRedPatients(prev =>
        prev.map(p => p.id === resolveModal.patientId ? { ...p, isResolving: false } : p)
      );
    }
  };

  // ── Pagination ────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(redPatients.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = redPatients.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const getPageNumbers = (): (number | "…")[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "…")[] = [1];
    if (safePage > 3) pages.push("…");
    for (let i = Math.max(2, safePage - 1); i <= Math.min(totalPages - 1, safePage + 1); i++) pages.push(i);
    if (safePage < totalPages - 2) pages.push("…");
    pages.push(totalPages);
    return pages;
  };

  const pendingCount   = redPatients.filter(p => p.lifecycleStatus === "ack").length;
  const inProgCount    = redPatients.filter(p => p.lifecycleStatus === "in_progress").length;
  const resolvedCount  = redPatients.filter(p => p.lifecycleStatus === "resolved").length;

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

        <style>{`
          @keyframes mw-shimmer {
            0%   { background-position: -600px 0; }
            100% { background-position:  600px 0; }
          }
          .mw-skeleton {
            background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
            background-size: 600px 100%;
            animation: mw-shimmer 1.4s infinite linear;
            border-radius: 8px;
          }
          .patient-row-ack {
            background: white;
            transition: background 0.15s;
          }
          .patient-row-ack:hover { background: #fafafa; }
          .patient-row-inprogress {
            background: #f8fffe;
            transition: background 0.15s;
          }
          .patient-row-inprogress:hover { background: #f0fdf9; }
          .patient-row-resolved {
            background: #f8fafc;
            opacity: 0.7;
          }
          .resolve-category-btn {
            display: flex;
            align-items: center;
            gap: 10px;
            width: 100%;
            padding: 11px 16px;
            border-radius: 12px;
            border: 1.5px solid #e2e8f0;
            background: white;
            color: #374151;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            text-align: left;
            transition: all 0.15s;
          }
          .resolve-category-btn:hover {
            border-color: #1D9E75;
            background: #f0fdf4;
            color: #15803d;
          }
          .resolve-category-btn.selected {
            border-color: #1D9E75;
            background: rgba(29,158,117,0.08);
            color: #15803d;
          }
          .resolve-note-textarea {
            width: 100%;
            padding: 12px 14px;
            border-radius: 12px;
            border: 1.5px solid #e2e8f0;
            font-size: 13px;
            font-family: inherit;
            resize: vertical;
            min-height: 90px;
            color: #374151;
            transition: border-color 0.15s;
            box-sizing: border-box;
          }
          .resolve-note-textarea:focus {
            outline: none;
            border-color: #1D9E75;
          }
          @keyframes resolve-slide-in {
            from { opacity: 0; transform: translateY(12px) scale(0.97); }
            to   { opacity: 1; transform: translateY(0) scale(1); }
          }
          .resolve-modal-card {
            animation: resolve-slide-in 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
          }
          @media (max-width: 768px) {
            .patient-desktop-row, .patient-table-header { display: none !important; }
            .patient-mobile-card { display: block !important; position: relative; padding: 16px; border-bottom: 1px solid #f1f5f9; }
          }
          @media (min-width: 769px) {
            .patient-mobile-card { display: none !important; }
          }
        `}</style>

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
              style={{ background: loading ? "#f8fafc" : card.bg, border: `1px solid ${loading ? "#e2e8f0" : card.color + "22"}` }}
            >
              {loading ? (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
                    <div className="mw-skeleton" style={{ width: 28, height: 28, borderRadius: 6, flexShrink: 0 }} />
                    <div className="mw-skeleton" style={{ width: 56, height: 36 }} />
                  </div>
                  <div className="mw-skeleton" style={{ width: 80, height: 13 }} />
                </>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
                    <card.icon size={28} color={card.color} />
                    <div className="heading-font" style={{ fontSize: 36, fontWeight: 800, color: card.color }}>
                      {card.value}
                    </div>
                  </div>
                  <div style={{ color: "#64748b", fontSize: 13, fontWeight: 500, marginTop: 4 }}>
                    {card.label}
                  </div>
                </>
              )}
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
              onClick={() => fetchDashboard(search)}
              style={{ background: "none", border: "none", color: "#dc2626", fontWeight: 700, cursor: "pointer", fontSize: 13 }}
            >Retry</button>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            RED TREND PATIENTS — with inline ack → in_progress → resolved
        ════════════════════════════════════════════════════════════════════ */}
        <div style={{ marginBottom: 16 }}>

          {/* Section header */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Bell size={18} color="#dc2626" />
              <h2 className="heading-font" style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", margin: 0 }}>
                Red Alert Patients
              </h2>
            </div>
            {pendingCount > 0 && (
              <div style={{
                background: "#dc2626", color: "white",
                borderRadius: 99, padding: "2px 10px", fontSize: 12, fontWeight: 700,
              }}>{pendingCount} pending</div>
            )}
            {inProgCount > 0 && (
              <div style={{
                background: "#fef9c3", color: "#a16207",
                borderRadius: 99, padding: "2px 10px", fontSize: 12, fontWeight: 700,
              }}>{inProgCount} in review</div>
            )}
            {resolvedCount > 0 && pendingCount === 0 && inProgCount === 0 && (
              <div style={{
                background: "#dcfce7", color: "#15803d",
                borderRadius: 99, padding: "2px 10px", fontSize: 12, fontWeight: 700,
              }}>All resolved</div>
            )}
          </div>

          {/* Search bar */}
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
                onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
              />
            </div>
          </div>
        </div>

        {/* Patient table */}
        <div style={{
          background: "white", borderRadius: 20, overflow: "hidden",
          boxShadow: "0 4px 20px rgba(220,38,38,0.08)",
          border: "1.5px solid #fca5a5",
          marginBottom: 32,
        }}>
          {/* Desktop table header */}
          <div
            className="patient-table-header"
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 0.8fr 0.8fr 2fr 1.2fr 1.5fr 2fr",
              gap: 16, padding: "14px 24px",
              borderBottom: "1px solid #fef2f2",
              background: "#fff5f5",
            }}
          >
            {["Patient", "Score", "Trend", "Alert Reason", "Status", "Last Submitted", "Actions"].map(h => (
              <div key={h} style={{
                fontSize: 11, fontWeight: 700, color: "#b91c1c",
                textTransform: "uppercase", letterSpacing: "0.07em",
              }}>{h}</div>
            ))}
          </div>

          {/* Loading skeleton */}
          {loading && [1, 2, 3].map(i => (
            <div key={i} style={{ padding: "20px 24px", borderBottom: "1px solid #fef2f2", display: "flex", gap: 20 }}>
              <div className="mw-skeleton" style={{ width: 140, height: 40 }} />
              <div className="mw-skeleton" style={{ width: 44, height: 44, borderRadius: 12 }} />
              <div className="mw-skeleton" style={{ flex: 1, height: 40 }} />
              <div className="mw-skeleton" style={{ width: 120, height: 40 }} />
            </div>
          ))}

          {/* Rows */}
          {!loading && paginated.map((p, idx) => {
            const isInProgress = p.lifecycleStatus === "in_progress";
            const isResolved   = p.lifecycleStatus === "resolved";
            const isPending    = p.lifecycleStatus === "ack";

            const rowClass = isResolved
              ? "patient-row-resolved"
              : isInProgress
              ? "patient-row-inprogress"
              : "patient-row-ack";

            const scoreBg    = isResolved ? "#f1f5f9" : isInProgress ? "#f0fdf4" : "#fee2e2";
            const scoreColor = isResolved ? "#94a3b8" : isInProgress ? "#15803d" : "#dc2626";

            return (
              <div key={p.id}>
                {/* ── Desktop row ── */}
                <div
                  className={`patient-desktop-row ${rowClass}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 0.8fr 0.8fr 2fr 1.2fr 1.5fr 2fr",
                    gap: 16,
                    padding: "16px 24px",
                    borderBottom: idx < paginated.length - 1 ? "1px solid #fef2f2" : "none",
                    alignItems: "center",
                  }}
                >
                  {/* Patient info */}
                  <div>
                    <div style={{ fontWeight: 700, color: isResolved ? "#94a3b8" : "#0f172a", fontSize: 14 }}>
                      {p.name}
                    </div>
                    <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 2 }}>
                      {p.readableId}
                      {p.age ? ` · ${p.age}y` : ""}
                      {p.gender !== "—" ? ` ${p.gender}` : ""}
                    </div>
                    {p.diagnosis !== "—" && (
                      <div style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}>
                        {p.diagnosis.split(" ").slice(0, 3).join(" ")}
                      </div>
                    )}
                  </div>

                  {/* Disease Score */}
                  <div>
                    {p.diseaseScore != null ? (
                      <div style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        width: 44, height: 44, borderRadius: 12,
                        background: scoreBg, color: scoreColor,
                        fontWeight: 800, fontSize: 16,
                        fontFamily: "'Syne', sans-serif",
                      }}>
                        {p.diseaseScore}
                      </div>
                    ) : (
                      <span style={{ color: "#cbd5e1", fontSize: 13 }}>—</span>
                    )}
                  </div>

                  {/* Trend badge */}
                  <div>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      padding: "3px 10px", borderRadius: 99,
                      fontSize: 12, fontWeight: 600,
                      background: "#fee2e2", color: "#dc2626",
                    }}>↓ Red</span>
                  </div>

                  {/* Alert Reason */}
                  <div style={{
                    fontSize: 13,
                    color: isResolved ? "#94a3b8" : isInProgress ? "#64748b" : "#7f1d1d",
                    lineHeight: "1.4", fontWeight: 500,
                  }}>
                    {p.alertReason ?? "—"}
                  </div>

                  {/* Status badge */}
                  <div>
                    {isResolved ? (
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        padding: "4px 10px", borderRadius: 99,
                        background: "#f1f5f9", color: "#64748b",
                        fontSize: 11, fontWeight: 700,
                      }}>
                        <CheckCircle size={12} /> Resolved
                      </span>
                    ) : isInProgress ? (
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        padding: "4px 10px", borderRadius: 99,
                        background: "#dcfce7", color: "#15803d",
                        fontSize: 11, fontWeight: 700,
                      }}>
                        <CheckCircle size={12} /> In Review
                      </span>
                    ) : (
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        padding: "4px 10px", borderRadius: 99,
                        background: "#fee2e2", color: "#dc2626",
                        fontSize: 11, fontWeight: 700,
                      }}>
                        <Clock size={12} /> Pending
                      </span>
                    )}
                  </div>

                  {/* Last submitted */}
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>
                    {formatDateTime(p.lastSubmitted)}
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {/* View */}
                    <Link href={`/IDpatient/${p.id}`}>
                      <button style={{
                        padding: "6px 12px", borderRadius: 10,
                        border: "1.5px solid #378ADD", color: "#378ADD",
                        background: "transparent", fontSize: 12, fontWeight: 600, cursor: "pointer",
                      }}>View</button>
                    </Link>

                    {/* Call */}
                    <button
                      onClick={() => setCallModal(p)}
                      style={{
                        padding: "6px 12px", borderRadius: 10,
                        border: "1.5px solid #1D9E75", color: "#1D9E75",
                        background: "transparent", fontSize: 12, fontWeight: 600, cursor: "pointer",
                      }}
                    >Call</button>

                    {/* Acknowledge: ack → in_progress */}
                    {isPending && (
                      <button
                        disabled={p.isAcknowledging}
                        onClick={() => acknowledgePatient(p.id)}
                        style={{
                          padding: "6px 12px", borderRadius: 10,
                          border: "1.5px solid #dc2626",
                          color: p.isAcknowledging ? "#94a3b8" : "white",
                          background: p.isAcknowledging ? "#f1f5f9" : "#dc2626",
                          fontSize: 12, fontWeight: 600,
                          cursor: p.isAcknowledging ? "not-allowed" : "pointer",
                          transition: "all 0.2s",
                          opacity: p.isAcknowledging ? 0.7 : 1,
                        }}
                      >
                        {p.isAcknowledging ? "…" : "Acknowledge"}
                      </button>
                    )}

                    {/* Resolve: in_progress → resolved */}
                    {isInProgress && (
                      <button
                        disabled={p.isResolving}
                        onClick={() => openResolveModal(p)}
                        style={{
                          padding: "6px 12px", borderRadius: 10,
                          border: "1.5px solid #1D9E75",
                          color: "white",
                          background: p.isResolving ? "#94a3b8" : "#1D9E75",
                          fontSize: 12, fontWeight: 600,
                          cursor: p.isResolving ? "not-allowed" : "pointer",
                          transition: "all 0.2s",
                          display: "flex", alignItems: "center", gap: 4,
                        }}
                      >
                        <ClipboardCheck size={12} />
                        {p.isResolving ? "…" : "Resolve"}
                      </button>
                    )}

                    {/* Resolved static */}
                    {isResolved && (
                      <div style={{
                        padding: "6px 12px", borderRadius: 10,
                        border: "1.5px solid #cbd5e1",
                        color: "#94a3b8", background: "#f8fafc",
                        fontSize: 12, fontWeight: 600,
                        display: "flex", alignItems: "center", gap: 4,
                      }}>
                        <CheckCircle size={12} /> Resolved
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Mobile card ── */}
                <div
                  className="patient-mobile-card"
                  style={{
                    background: isResolved ? "#f8fafc" : isInProgress ? "#f8fffe" : "white",
                    opacity: isResolved ? 0.72 : 1,
                    position: "relative",
                  }}
                >
                  {/* Status bar */}
                  <div style={{
                    position: "absolute", left: 0, top: 0, bottom: 0, width: 4,
                    borderRadius: "0 4px 4px 0",
                    background: isResolved ? "#94a3b8" : isInProgress ? "#1D9E75" : "#dc2626",
                  }} />
                  <div style={{ paddingLeft: 12 }}>
                    {/* Header */}
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                        background: scoreBg,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontFamily: "'Syne', sans-serif", fontWeight: 800,
                        fontSize: 16, color: scoreColor,
                      }}>
                        {p.diseaseScore ?? "—"}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: isResolved ? "#94a3b8" : "#0f172a", fontSize: 15 }}>
                          {p.name}
                        </div>
                        <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 2 }}>{p.readableId}</div>
                      </div>
                      {isResolved ? (
                        <span style={{ padding: "3px 8px", borderRadius: 99, background: "#f1f5f9", color: "#64748b", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>Resolved</span>
                      ) : isInProgress ? (
                        <span style={{ padding: "3px 8px", borderRadius: 99, background: "#dcfce7", color: "#15803d", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>In Review</span>
                      ) : (
                        <span style={{ padding: "3px 8px", borderRadius: 99, background: "#fee2e2", color: "#dc2626", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>Pending</span>
                      )}
                    </div>

                    {/* Reason */}
                    <div style={{
                      background: isResolved ? "#f8fafc" : isInProgress ? "#f0fdf4" : "#fff5f5",
                      borderRadius: 10, padding: "10px 12px", marginBottom: 12,
                      border: `1px solid ${isResolved ? "#e2e8f0" : isInProgress ? "#bbf7d0" : "#fca5a5"}`,
                    }}>
                      <div style={{
                        fontSize: 10, fontWeight: 700, marginBottom: 4,
                        color: isResolved ? "#94a3b8" : isInProgress ? "#15803d" : "#b91c1c",
                        textTransform: "uppercase", letterSpacing: "0.06em",
                      }}>Alert Reason</div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: isResolved ? "#94a3b8" : isInProgress ? "#374151" : "#7f1d1d", lineHeight: "1.5" }}>
                        {p.alertReason ?? "—"}
                      </div>
                    </div>

                    {/* Diagnosis + time */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                      <div style={{ background: "#f8fafc", borderRadius: 10, padding: "8px 10px" }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Diagnosis</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {p.diagnosis.split(" ").slice(0, 3).join(" ")}
                        </div>
                      </div>
                      <div style={{ background: "#f8fafc", borderRadius: 10, padding: "8px 10px" }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Last Submitted</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#1e293b" }}>
                          {new Date(p.lastSubmitted).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </div>
                      </div>
                    </div>

                    {/* Mobile actions */}
                    <div style={{ display: "flex", gap: 8 }}>
                      <Link href={`/IDpatient/${p.id}`} style={{ flex: 1 }}>
                        <button style={{
                          width: "100%", padding: "10px 0", borderRadius: 10, border: "none",
                          background: "#eff6ff", color: "#378ADD", fontSize: 13, fontWeight: 700, cursor: "pointer",
                        }}>View</button>
                      </Link>

                      <button
                        onClick={() => setCallModal(p)}
                        style={{
                          flex: 1, padding: "10px 0", borderRadius: 10, border: "none",
                          background: "#f0fdf4", color: "#1D9E75", fontSize: 13, fontWeight: 700, cursor: "pointer",
                        }}
                      >Call</button>

                      {isPending && (
                        <button
                          disabled={p.isAcknowledging}
                          onClick={() => acknowledgePatient(p.id)}
                          style={{
                            flex: 1, padding: "10px 0", borderRadius: 10, border: "none",
                            background: p.isAcknowledging ? "#f1f5f9" : "#dc2626",
                            color: p.isAcknowledging ? "#94a3b8" : "white",
                            fontSize: 13, fontWeight: 700,
                            cursor: p.isAcknowledging ? "not-allowed" : "pointer",
                          }}
                        >
                          {p.isAcknowledging ? "…" : "Acknowledge"}
                        </button>
                      )}

                      {isInProgress && (
                        <button
                          disabled={p.isResolving}
                          onClick={() => openResolveModal(p)}
                          style={{
                            flex: 1, padding: "10px 0", borderRadius: 10, border: "none",
                            background: p.isResolving ? "#f1f5f9" : "#1D9E75",
                            color: p.isResolving ? "#94a3b8" : "white",
                            fontSize: 13, fontWeight: 700,
                            cursor: p.isResolving ? "not-allowed" : "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                          }}
                        >
                          <ClipboardCheck size={14} />
                          {p.isResolving ? "…" : "Resolve"}
                        </button>
                      )}

                      {isResolved && (
                        <div style={{
                          flex: 1, padding: "10px 0", borderRadius: 10,
                          background: "#f8fafc", color: "#94a3b8",
                          fontSize: 13, fontWeight: 700, textAlign: "center",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        }}>
                          <CheckCircle size={14} /> Resolved
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {!loading && redPatients.length === 0 && (
            <div style={{ padding: "48px", textAlign: "center", color: "#94a3b8" }}>
              No red alert patients found
            </div>
          )}

          {/* Pagination */}
          {!loading && redPatients.length > PAGE_SIZE && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "16px 24px", borderTop: "1px solid #fef2f2",
              flexWrap: "wrap", gap: 12,
            }}>
              <div style={{ fontSize: 13, color: "#94a3b8" }}>
                Showing{" "}
                <span style={{ fontWeight: 600, color: "#374151" }}>
                  {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, redPatients.length)}
                </span>{" "}
                of <span style={{ fontWeight: 600, color: "#374151" }}>{redPatients.length}</span> patients
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
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >‹</button>
                {getPageNumbers().map((pg, idx) =>
                  pg === "…" ? (
                    <span key={`e-${idx}`} style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#94a3b8" }}>…</span>
                  ) : (
                    <button
                      key={pg}
                      onClick={() => setCurrentPage(pg as number)}
                      style={{
                        width: 36, height: 36, borderRadius: 10, border: "1.5px solid",
                        borderColor: safePage === pg ? "#dc2626" : "#e2e8f0",
                        background: safePage === pg ? "#fee2e2" : "white",
                        color: safePage === pg ? "#dc2626" : "#374151",
                        fontWeight: safePage === pg ? 700 : 500, fontSize: 13,
                        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
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
                    fontWeight: 700, fontSize: 16, cursor: safePage === totalPages ? "default" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >›</button>
              </div>
            </div>
          )}
        </div>

      </main>

      {/* ═══════════════════════════════════════════════════════════════════
          CALL MODAL
      ════════════════════════════════════════════════════════════════════ */}
      {callModal && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16,
          }}
          onClick={() => setCallModal(null)}
        >
          <div
            style={{ background: "white", borderRadius: 24, padding: 32, width: "100%", maxWidth: 360 }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
              <h3 className="heading-font" style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Contact Patient</h3>
              <button onClick={() => setCallModal(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 4 }}>
                <X size={20} />
              </button>
            </div>
            <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 24 }}>{callModal.name}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {callModal.contact && (
                <a href={`tel:${callModal.contact}`} style={{ textDecoration: "none" }}>
                  <div style={{ padding: "14px 20px", borderRadius: 14, border: "1.5px solid #1D9E75", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 600, color: "#0f172a" }}>Patient</span>
                    <span style={{ color: "#1D9E75", fontWeight: 600 }}>{callModal.contact}</span>
                  </div>
                </a>
              )}
              {callModal.relativeContact && (
                <a href={`tel:${callModal.relativeContact}`} style={{ textDecoration: "none" }}>
                  <div style={{ padding: "14px 20px", borderRadius: 14, border: "1.5px solid #378ADD", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 600, color: "#0f172a" }}>Relative</span>
                    <span style={{ color: "#378ADD", fontWeight: 600 }}>{callModal.relativeContact}</span>
                  </div>
                </a>
              )}
              {!callModal.contact && !callModal.relativeContact && (
                <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center" }}>No contact info available.</p>
              )}
            </div>
            <button onClick={() => setCallModal(null)} className="btn-outline" style={{ width: "100%", marginTop: 20 }}>Close</button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          RESOLVE MODAL
      ════════════════════════════════════════════════════════════════════ */}
      {resolveModal && (
        <div
          style={{
            position: "fixed", inset: 0,
            background: "rgba(15,23,42,0.55)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 200, padding: 16,
          }}
          onClick={() => { if (!resolveModal.isSubmitting) setResolveModal(null); }}
        >
          <div
            className="resolve-modal-card"
            style={{
              background: "white", borderRadius: 24, padding: "28px 28px 24px",
              width: "100%", maxWidth: 460,
              boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: 12, background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ClipboardCheck size={18} color="#1D9E75" />
                </div>
                <h3 className="heading-font" style={{ fontSize: 19, fontWeight: 700, margin: 0, color: "#0f172a" }}>Resolve Alert</h3>
              </div>
              <button
                disabled={resolveModal.isSubmitting}
                onClick={() => setResolveModal(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 4, borderRadius: 8 }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ color: "#64748b", fontSize: 13, marginBottom: 20, marginLeft: 48 }}>
              {resolveModal.patientName}
            </p>

            <div style={{ height: 1, background: "#f1f5f9", marginBottom: 20 }} />

            {/* Category selection */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
                Resolution Category <span style={{ color: "#dc2626" }}>*</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {RESOLUTION_CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    className={`resolve-category-btn${resolveModal.category === cat ? " selected" : ""}`}
                    disabled={resolveModal.isSubmitting}
                    onClick={() => setResolveModal(prev => prev ? { ...prev, category: cat, error: null } : null)}
                  >
                    <span style={{ fontSize: 15 }}>{CATEGORY_ICONS[cat]}</span>
                    <span>{CATEGORY_LABELS[cat]}</span>
                    {resolveModal.category === cat && (
                      <span style={{ marginLeft: "auto" }}><CheckCircle size={14} color="#1D9E75" /></span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Note */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
                Resolution Note <span style={{ color: "#dc2626" }}>*</span>
              </div>
              <textarea
                className="resolve-note-textarea"
                placeholder="Describe the steps taken, observations, or follow-up instructions…"
                value={resolveModal.note}
                disabled={resolveModal.isSubmitting}
                onChange={e => setResolveModal(prev => prev ? { ...prev, note: e.target.value, error: null } : null)}
              />
            </div>

            {resolveModal.error && (
              <div style={{
                padding: "10px 14px", borderRadius: 10,
                background: "#fef2f2", border: "1px solid #fca5a5",
                color: "#dc2626", fontSize: 13, fontWeight: 500, marginBottom: 16,
              }}>
                {resolveModal.error}
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button
                disabled={resolveModal.isSubmitting}
                onClick={() => setResolveModal(null)}
                style={{
                  flex: 1, padding: "12px 0", borderRadius: 12,
                  border: "1.5px solid #e2e8f0", background: "white", color: "#64748b",
                  fontSize: 14, fontWeight: 600,
                  cursor: resolveModal.isSubmitting ? "not-allowed" : "pointer",
                  opacity: resolveModal.isSubmitting ? 0.5 : 1,
                }}
              >Cancel</button>
              <button
                disabled={resolveModal.isSubmitting || !resolveModal.category || !resolveModal.note.trim()}
                onClick={submitResolve}
                style={{
                  flex: 2, padding: "12px 0", borderRadius: 12, border: "none",
                  background: resolveModal.isSubmitting || !resolveModal.category || !resolveModal.note.trim()
                    ? "#e2e8f0" : "#1D9E75",
                  color: resolveModal.isSubmitting || !resolveModal.category || !resolveModal.note.trim()
                    ? "#94a3b8" : "white",
                  fontSize: 14, fontWeight: 700,
                  cursor: resolveModal.isSubmitting || !resolveModal.category || !resolveModal.note.trim()
                    ? "not-allowed" : "pointer",
                  transition: "all 0.2s",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}
              >
                {resolveModal.isSubmitting
                  ? <>Resolving…</>
                  : <><ClipboardCheck size={15} /> Mark as Resolved</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("doctor_token") ?? "";
}