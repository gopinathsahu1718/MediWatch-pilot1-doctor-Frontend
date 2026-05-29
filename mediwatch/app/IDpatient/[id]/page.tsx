"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import {
  ArrowLeft, User, Phone, MapPin, Calendar, Activity,
  AlertTriangle, CheckCircle2, Clock, ChevronDown, ChevronUp,
  TrendingUp, TrendingDown, Minus, AlertCircle, Info,
  Heart, Shield, FileText, BarChart2, List, ChevronRight,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PatientDetail {
  id: string;
  facility_id: string;
  disease_id: string;
  name: string;
  age: number;
  gender: string;
  phone: string;
  relative_phone: string;
  state: string;
  district: string;
  address_line: string;
  diagnosis: string;
  condition_type: string;
  risk_category: "low" | "medium" | "high";
  monitoring_days: number;
  monitoring_start: string;
  monitoring_end: string;
  consent_given: boolean;
  status: string;
  first_login_at: string;
  last_submission_at: string;
  created_at: string;
  updated_at: string;
  readable_id: string;
  triage_status: string;
  resolved_reason: string | null;
  disease_name: string;
  department_name: string;
  basic_registered_by_name: string;
  medical_registered_by_name: string;
}

interface OverrideQuestion {
  question_key: string;
  question_text: string;
  display_order: number;
}

interface LatestSubmission {
  day_number: number;
  trend_status: string;
  disease_score: number;
  priority_value: number;
  submitted_at: string;
}

interface Question {
  question_key: string;
  question_text: string;
  question_type: string;
  display_order: number;
  min_value: number;
  max_value: number;
}

interface Submission {
  id: string;
  day_number: number;
  answers: Record<string, number>;
  override_answers: Record<string, boolean>;
  disease_score: number;
  trend_status: string;
  priority_value: number;
  override_triggered: boolean;
  images: string[];
  submitted_at: string;
}

interface BasdaiPoint {
  dayNumber: number;
  date: string;
  diseaseScore: number;
  trendStatus: string;
}

interface OverridePoint {
  dayNumber: number;
  date: string;
  overrideTriggered: boolean;
  overrideAnswers: Record<string, boolean>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("doctor_token") ?? "";
}

function fmt(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function monitoringProgress(start: string, end: string, totalDays: number) {
  const now = Date.now();
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  const elapsed = Math.max(0, Math.min(now - s, e - s));
  const daysPassed = Math.ceil(elapsed / 86400000);
  const pct = Math.min(100, Math.round((daysPassed / totalDays) * 100));
  return { daysPassed: Math.min(daysPassed, totalDays), pct };
}

const RISK_META = {
  high:   { label: "High Risk",   color: "#ff6b6b", bg: "rgba(255,107,107,0.15)", border: "rgba(255,107,107,0.3)" },
  medium: { label: "Medium Risk", color: "#ffd93d", bg: "rgba(255,217,61,0.15)",  border: "rgba(255,217,61,0.3)"  },
  low:    { label: "Low Risk",    color: "#6bcb77", bg: "rgba(107,203,119,0.15)", border: "rgba(107,203,119,0.3)" },
};

const TREND_META: Record<string, { color: string; bg: string; label: string }> = {
  red:    { color: "#dc2626", bg: "#fee2e2", label: "Critical" },
  yellow: { color: "#a16207", bg: "#fef9c3", label: "Warning"  },
  green:  { color: "#15803d", bg: "#dcfce7", label: "Stable"   },
};

const STATUS_META: Record<string, { color: string; bg: string; label: string; dot: string }> = {
  active:        { color: "#15803d", bg: "rgba(107, 203, 120, 0.8)", label: "Active",        dot: "#00ff22" },
  inactive:      { color: "#a16207", bg: "rgba(255,217,61,0.2)",  label: "Inactive",      dot: "#ffd93d" },
  completed:     { color: "#378ADD", bg: "rgba(55,138,221,0.2)",  label: "Completed",     dot: "#378ADD" },
  incomplete:    { color: "#ff6b6b", bg: "rgba(255,107,107,0.2)", label: "Incomplete",    dot: "#ff6b6b" },
  pending_login: { color: "#c084fc", bg: "rgba(192,132,252,0.2)", label: "Pending Login", dot: "#c084fc" },
};

function ScoreBar({ value, max = 10 }: { value: number; max?: number }) {
  const pct = Math.min(100, (value / max) * 100);
  const color = pct >= 70 ? "#dc2626" : pct >= 40 ? "#a16207" : "#15803d";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ flex: 1, height: 8, borderRadius: 99, background: "#f1f5f9", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 99, background: color, transition: "width 0.6s ease" }} />
      </div>
      <span style={{ fontWeight: 700, fontSize: 13, color, minWidth: 24, textAlign: "right" }}>{value}</span>
    </div>
  );
}

function SectionCard({ title, icon: Icon, children, accent = "#378ADD" }: {
  title: string; icon: React.ElementType; children: React.ReactNode; accent?: string;
}) {
  return (
    <div style={{
      background: "white", borderRadius: 20, padding: 28,
      boxShadow: "0 2px 16px rgba(0,0,0,0.06)", marginBottom: 24,
      border: "1px solid #f1f5f9",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22, paddingBottom: 16, borderBottom: "1px solid #f1f5f9" }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${accent}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={18} color={accent} />
        </div>
        <h2 className="heading-font" style={{ fontSize: 17, fontWeight: 700, color: "#0f172a", margin: 0 }}>{title}</h2>
      </div>
      {children}
    </div>
  );
}

// Custom tooltip for BASDAI chart
function BasdaiTooltip({ active, payload }: { active?: boolean; payload?: Array<{ value: number; payload: BasdaiPoint }>; label?: string }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const tm = TREND_META[d.trendStatus] ?? TREND_META.green;
  return (
    <div style={{
      background: "white", border: "1.5px solid #e2e8f0", borderRadius: 14,
      padding: "12px 16px", boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
    }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a", marginBottom: 6 }}>Day {d.dayNumber}</div>
      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>{fmt(d.date)}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 22, fontWeight: 800, color: tm.color }}>{d.diseaseScore}</span>
        <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 99, background: tm.bg, color: tm.color }}>{tm.label}</span>
      </div>
    </div>
  );
}

// Custom tooltip for question line chart
function QLineTooltip({ active, payload, questionText }: { active?: boolean; payload?: Array<{ value: number }>; label?: string; questionText: string }) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;
  const color = val >= 7 ? "#dc2626" : val >= 4 ? "#a16207" : "#15803d";
  return (
    <div style={{
      background: "white", border: "1.5px solid #e2e8f0", borderRadius: 14,
      padding: "12px 16px", boxShadow: "0 8px 24px rgba(0,0,0,0.12)", maxWidth: 220,
    }}>
      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>{questionText.split("(")[0].trim()}</div>
      <div style={{ fontWeight: 800, fontSize: 20, color }}>{val}<span style={{ fontSize: 12, fontWeight: 500, color: "#94a3b8" }}>/10</span></div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [patient,      setPatient]      = useState<PatientDetail | null>(null);
  const [overrideQs,   setOverrideQs]   = useState<OverrideQuestion[]>([]);
  const [latestSub,    setLatestSub]    = useState<LatestSubmission | null>(null);
  const [questions,    setQuestions]    = useState<Question[]>([]);
  const [submissions,  setSubmissions]  = useState<Submission[]>([]);
  const [basdaiGraph,  setBasdaiGraph]  = useState<BasdaiPoint[]>([]);
  const [overrideGraph, setOverrideGraph] = useState<OverridePoint[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [expandedDay,  setExpandedDay]  = useState<number | null>(null);
  const [selectedQKey, setSelectedQKey] = useState<string>("");

  const routerRef = useRef(router);
  useEffect(() => { routerRef.current = router; }, [router]);

  useEffect(() => {
    if (!id) return;
    async function loadAll() {
      setLoading(true);
      setError(null);
      const token = getToken();
      if (!token) { routerRef.current.replace("/login"); return; }
      const headers = { Authorization: `Bearer ${token}` };
      const BASE = "https://api.mediwatch.in/api/v1";
      try {
        const [detailRes, historyRes] = await Promise.all([
          fetch(`${BASE}/doctor/patients/${id}`, { headers }),
          fetch(`${BASE}/doctor/patients/${id}/history`, { headers }),
        ]);
        if (detailRes.status === 401 || historyRes.status === 401) {
          localStorage.removeItem("doctor_token");
          routerRef.current.replace("/login");
          return;
        }
        if (!detailRes.ok) throw new Error(`Failed to load patient (${detailRes.status})`);
        if (!historyRes.ok) throw new Error(`Failed to load history (${historyRes.status})`);
        const detailJson  = await detailRes.json();
        const historyJson = await historyRes.json();
        const d = detailJson?.data;
        const h = historyJson?.data;
        setPatient(d?.patient ?? null);
        setOverrideQs(d?.overrideQuestions ?? []);
        setLatestSub(d?.latestSubmission ?? null);
        const qs = h?.questions ?? [];
        setQuestions(qs);
        if (qs.length > 0) setSelectedQKey(qs[0].question_key);
        setSubmissions(h?.submissions ?? []);
        setBasdaiGraph(h?.basdaiGraph ?? []);
        setOverrideGraph(h?.overrideGraph ?? []);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      } finally {
        setLoading(false);
      }
    }
    loadAll();
  }, [id]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const rm   = RISK_META[patient?.risk_category ?? "low"];
  const sm   = STATUS_META[patient?.status ?? "active"] ?? STATUS_META.active;
  const tm   = TREND_META[latestSub?.trend_status ?? "green"] ?? TREND_META.green;
  const prog = patient
    ? monitoringProgress(patient.monitoring_start, patient.monitoring_end, patient.monitoring_days)
    : { daysPassed: 0, pct: 0 };

  // Question-wise line chart data for selected question
  const selectedQuestion = questions.find(q => q.question_key === selectedQKey);
  const qLineData = [...submissions]
    .sort((a, b) => a.day_number - b.day_number)
    .map(s => ({
      label: `Day ${s.day_number}`,
      dayNumber: s.day_number,
      value: s.answers[selectedQKey] ?? null,
    }))
    .filter(d => d.value !== null);

  const Q_COLORS = ["#378ADD", "#1D9E75", "#a855f7", "#f59e0b", "#ec4899", "#14b8a6"];
  const selectedQColor = Q_COLORS[questions.findIndex(q => q.question_key === selectedQKey) % Q_COLORS.length] ?? "#378ADD";

  // Sorted submissions descending
  const sortedSubs = [...submissions].sort((a, b) => b.day_number - a.day_number);

  // Triage display
  const isTriageResolved = patient?.triage_status !== "in_progress";

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="page-shell">
        <Sidebar />
        <main className="main-content" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{
              width: 48, height: 48, borderRadius: "50%",
              border: "4px solid #e2e8f0", borderTopColor: "#378ADD",
              animation: "spin 0.8s linear infinite", margin: "0 auto 16px",
            }} />
            <div style={{ color: "#64748b", fontWeight: 500, fontSize: 15 }}>Loading patient details…</div>
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </main>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="page-shell">
        <Sidebar />
        <main className="main-content" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center", maxWidth: 400 }}>
            <AlertCircle size={48} color="#dc2626" style={{ marginBottom: 16 }} />
            <div className="heading-font" style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Failed to load</div>
            <div style={{ color: "#64748b", marginBottom: 20 }}>{error ?? "Patient not found."}</div>
            <button
              onClick={() => router.push("/dashboard")}
              style={{ padding: "10px 24px", borderRadius: 12, background: "#378ADD", color: "white", border: "none", fontWeight: 600, cursor: "pointer", fontSize: 14 }}
            >← Back to Dashboard</button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <Sidebar />
      <main className="main-content" style={{ paddingBottom: 48 }}>

        {/* ── Back Button ── */}
        <button
          onClick={() => router.back()}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "none", border: "none", cursor: "pointer",
            color: "#64748b", fontSize: 14, fontWeight: 600,
            padding: "4px 0", marginBottom: 20,
            transition: "color 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.color = "#378ADD")}
          onMouseLeave={e => (e.currentTarget.style.color = "#64748b")}
        >
          <ArrowLeft size={16} />
          Back
        </button>

        {/* ══════════════════════════════════════════════════════════════
            HEADER — Redesigned
        ══════════════════════════════════════════════════════════════ */}
        <div className="patient-header-bar" style={{
          background: "rgb(55, 138, 221)",
          borderRadius: 20,
          padding: "28px 32px",
          marginBottom: 24,
          boxShadow: "0 8px 32px rgba(55,138,221,0.35)",
          position: "relative",
          overflow: "hidden",
        }}>

          {/* ── Row 1: Identity + Status ── */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 24, position: "relative" }}>
            
            {/* Left: Avatar + Name */}
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <div style={{
                width: 64, height: 64, borderRadius: 18, flexShrink: 0,
                background: "rgba(255,255,255,0.18)",
                border: "2px solid rgba(255,255,255,0.35)",
                display: "flex", alignItems: "center", justifyContent: "center",
                backdropFilter: "blur(8px)",
              }}>
                <span className="heading-font" style={{ fontSize: 26, fontWeight: 800, color: "white" }}>
                  {(patient.name ?? "P").charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
                  <h1 className="heading-font" style={{ fontSize: 26, fontWeight: 800, color: "white", margin: 0, letterSpacing: "-0.02em" }}>
                    {patient.name ?? "—"}
                  </h1>
                  {/* Status badge */}
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 99,
                    background: sm.bg, color: sm.color, letterSpacing: "0.04em", textTransform: "uppercase",
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: sm.dot }} />
                    {sm.label}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{
                    fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.7)",
                    background: "rgba(255,255,255,0.12)", padding: "3px 10px", borderRadius: 6,
                  }}>{patient.readable_id}</span>
                  <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>•</span>
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.8)" }}>
                    {patient.age ? `${patient.age} yrs` : "—"}, {patient.gender ? (patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1)) : "—"}
                  </span>
                  <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>•</span>
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.8)" }}>{patient.department_name ?? "—"}</span>
                </div>
              </div>
            </div>

            {/* Right: Triage badge */}
            <div style={{
              padding: "10px 18px", borderRadius: 14,
              background: isTriageResolved ? "rgba(68, 219, 88, 0.2)" : "rgba(255, 195, 14, 0.5)",
              border: `1.5px solid ${isTriageResolved ? "rgba(255, 255, 255, 0.4)" : "rgba(255, 253, 253, 0.4)"}`,
              display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: isTriageResolved ? "rgba(107,203,119,0.25)" : "rgba(255, 193, 7, 0.65)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {isTriageResolved
                  ? <CheckCircle2 size={16} color="#6bcb77" />
                  : <Activity size={16} color="#ffd83d" />
                }
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,1)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 2 }}>Triage</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: isTriageResolved ? "#6bcb77" : "#ffd93d" }}>
                  {isTriageResolved ? "Resolved" : "In Progress"}
                </div>
                {patient.resolved_reason && (
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 1 }}>{patient.resolved_reason}</div>
                )}
              </div>
            </div>
          </div>

          {/* ── Divider ── */}
          <div style={{ height: 1, background: "rgba(255,255,255,0.15)", marginBottom: 20, position: "relative" }} />

          {/* ── Row 2: Stats Grid ── */}
          <div className="header-stats-grid" style={{ position: "relative" }}>

            {/* Risk */}
            <div className="header-stat-item">
              <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.8)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                Risk Level
              </div>
              {patient.risk_category ? (
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "6px 14px", borderRadius: 10,
                  background: rm.bg, border: `1.5px solid ${rm.border}`,
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: rm.color }} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: rm.color }}>{rm.label}</span>
                </div>
              ) : (
                <span style={{ fontSize: 20, fontWeight: 700, color: "rgba(255,255,255,0.8)" }}>—</span>
              )}
            </div>

            {/* Divider */}
            <div className="header-stat-divider" />

            {/* Diagnosis */}
            <div className="header-stat-item">
              <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.8)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                Diagnosis
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "white", lineHeight: 1.3 }}>
                {patient.diagnosis ?? "—"}
              </div>
              {patient.condition_type && (
                <div style={{
                  marginTop: 5, fontSize: 11, color: "rgba(255,255,255,0.55)",
                  fontWeight: 500,
                }}>{patient.condition_type.charAt(0).toUpperCase() + patient.condition_type.slice(1)} condition</div>
              )}
            </div>

            {/* Divider */}
            <div className="header-stat-divider" />

            {/* Latest Score */}
            <div className="header-stat-item">
              <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.8)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                Latest Score
              </div>
              {latestSub ? (
                <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <span style={{ fontSize: 32, fontWeight: 800, color: tm.color, lineHeight: 1 }}>
                    {latestSub.disease_score}
                  </span>
                  <span style={{
                    padding: "4px 12px", borderRadius: 99, fontSize: 12, fontWeight: 700,
                    background: tm.bg, color: tm.color,
                  }}>{tm.label}</span>
                </div>
              ) : (
                <span style={{ fontSize: 20, fontWeight: 700, color: "rgba(255,255,255,0.4)" }}>—</span>
              )}
              {latestSub && (
                <div style={{ marginTop: 5, display: "flex", alignItems: "center", gap: 5, color: "rgba(255,255,255,0.8)", fontSize: 11 }}>
                  <Clock size={11} />
                  <span>{fmtTime(patient.last_submission_at)}</span>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="header-stat-divider" />

            {/* Monitoring Progress */}
            <div className="header-stat-item" style={{ minWidth: 180 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.8)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                Monitoring Progress
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: "white" }}>
                  {prog.daysPassed}
                  <span style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.8)" }}>/{patient.monitoring_days} days</span>
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>{prog.pct}%</span>
              </div>
              <div style={{ height: 6, background: "rgba(255,255,255,0.15)", borderRadius: 99, overflow: "hidden" }}>
                <div style={{
                  width: `${prog.pct}%`, height: "100%", borderRadius: 99,
                  background: "rgba(255,255,255,0.85)",
                  transition: "width 0.8s ease",
                }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.8)" }}>{fmt(patient.monitoring_start)}</span>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.8)" }}>{fmt(patient.monitoring_end)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════
            SECTION 2 — SYMPTOM QUESTIONS + OVERRIDE QUESTIONS
        ══════════════════════════════════════════════════════════════ */}
        <div className="two-col-grid" style={{ marginBottom: 24 }}>

          {/* Disease Questions */}
          <SectionCard title="Symptom Questions" icon={FileText} accent="#378ADD">
            {questions.length === 0 ? (
              <div style={{ color: "#94a3b8", fontSize: 14, textAlign: "center", padding: "20px 0" }}>No questions loaded.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {questions.map((q, i) => {
                  const latestAnswer = latestSub
                    ? (submissions.find(s => s.day_number === latestSub.day_number)?.answers[q.question_key] ?? null)
                    : null;
                  return (
                    <div key={q.question_key} style={{
                      padding: "14px 16px", borderRadius: 14,
                      background: "#f8fafc", border: "1px solid #f1f5f9",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: latestAnswer !== null ? 10 : 0 }}>
                        <div style={{ flex: 1, paddingRight: 12 }}>
                          <span style={{ fontSize: 10, fontWeight: 800, color: "#378ADD", textTransform: "uppercase", letterSpacing: "0.07em" }}>Q{i + 1}</span>
                          <div style={{ fontSize: 13, color: "#374151", fontWeight: 500, marginTop: 3, lineHeight: 1.5 }}>{q.question_text}</div>
                        </div>
                        {latestAnswer !== null && (
                          <div style={{
                            flexShrink: 0, width: 36, height: 36, borderRadius: 10,
                            background: latestAnswer >= 7 ? "#fee2e2" : latestAnswer >= 4 ? "#fef9c3" : "#dcfce7",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                            <span style={{
                              fontWeight: 800, fontSize: 15,
                              color: latestAnswer >= 7 ? "#dc2626" : latestAnswer >= 4 ? "#a16207" : "#15803d",
                            }}>{latestAnswer}</span>
                          </div>
                        )}
                      </div>
                      {latestAnswer !== null && <ScoreBar value={latestAnswer} max={q.max_value} />}
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>

          {/* Override Questions */}
          <SectionCard title="Override (Alert) Questions" icon={AlertTriangle} accent="#dc2626">
            {overrideQs.length === 0 ? (
              <div style={{ color: "#94a3b8", fontSize: 14, textAlign: "center", padding: "20px 0" }}>No override questions.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {overrideQs.map((q) => {
                  const latestOverrideEntry = overrideGraph.find(og => og.dayNumber === (latestSub?.day_number ?? 0));
                  const triggered = latestOverrideEntry?.overrideAnswers[q.question_key] === true
                    ? true : latestOverrideEntry !== undefined ? false : null;
                  return (
                    <div key={q.question_key} style={{
                      padding: "16px", borderRadius: 14,
                      background: triggered === true ? "#fef2f2" : triggered === false ? "#f0fdf4" : "#f8fafc",
                      border: `1.5px solid ${triggered === true ? "#fca5a5" : triggered === false ? "#86efac" : "#f1f5f9"}`,
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{
                            fontSize: 10, fontWeight: 800, textTransform: "uppercase",
                            letterSpacing: "0.07em", marginBottom: 4,
                            color: triggered === true ? "#dc2626" : "#94a3b8",
                          }}>Override Alert</div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: "#374151", lineHeight: 1.5 }}>{q.question_text}</div>
                        </div>
                        {triggered !== null && (
                          <div style={{
                            flexShrink: 0, padding: "6px 14px", borderRadius: 99,
                            background: triggered ? "#dc2626" : "#15803d",
                            color: "white", fontWeight: 700, fontSize: 12,
                          }}>
                            {triggered ? "🚨 Triggered" : "✓ Clear"}
                          </div>
                        )}
                      </div>
                      <div style={{ marginTop: 14, display: "flex", gap: 6, alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: "#94a3b8", marginRight: 4 }}>History:</span>
                        {overrideGraph.map(og => {
                          const val = og.overrideAnswers[q.question_key];
                          return (
                            <div key={og.dayNumber} title={`Day ${og.dayNumber} (${fmt(og.date)}): ${val ? "Triggered" : "Clear"}`}
                              style={{
                                width: 22, height: 22, borderRadius: "50%",
                                background: val ? "#dc2626" : "#15803d",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 9, fontWeight: 700, color: "white", cursor: "default",
                              }}>D{og.dayNumber}</div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>

        {/* ══════════════════════════════════════════════════════════════
            SECTION 3 — BASDAI RECOVERY GRAPH
        ══════════════════════════════════════════════════════════════ */}
        <SectionCard title="BASDAI Score — Recovery Graph" icon={TrendingUp} accent="#1D9E75">
          {basdaiGraph.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8" }}>No submissions yet.</div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
                {basdaiGraph.map(p => {
                  const ptm = TREND_META[p.trendStatus] ?? TREND_META.green;
                  return (
                    <div key={p.dayNumber} style={{
                      padding: "8px 14px", borderRadius: 12,
                      background: ptm.bg, border: `1.5px solid ${ptm.color}33`,
                      display: "flex", flexDirection: "column", alignItems: "center",
                    }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>Day {p.dayNumber}</span>
                      <span style={{ fontSize: 18, fontWeight: 800, color: ptm.color }}>{p.diseaseScore}</span>
                    </div>
                  );
                })}
                {basdaiGraph.length >= 2 && (() => {
                  const first = basdaiGraph[0].diseaseScore;
                  const last  = basdaiGraph[basdaiGraph.length - 1].diseaseScore;
                  const diff  = last - first;
                  const isDown = diff < 0;
                  return (
                    <div style={{
                      marginLeft: "auto", padding: "8px 16px", borderRadius: 12,
                      background: isDown ? "#dcfce7" : "#fee2e2",
                      border: `1.5px solid ${isDown ? "#86efac" : "#fca5a5"}`,
                      display: "flex", alignItems: "center", gap: 8,
                    }}>
                      {isDown ? <TrendingDown size={16} color="#15803d" /> : <TrendingUp size={16} color="#dc2626" />}
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>Trend</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: isDown ? "#15803d" : "#dc2626" }}>
                          {isDown ? "Improving" : "Worsening"} ({diff > 0 ? "+" : ""}{diff.toFixed(1)})
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
              <div style={{ width: "100%", height: 280, minWidth: 0 }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <LineChart data={basdaiGraph} margin={{ top: 10, right: 20, bottom: 0, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="dayNumber" tickFormatter={v => `Day ${v}`} tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 10]} tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <Tooltip content={<BasdaiTooltip />} />
                    <ReferenceLine y={7} stroke="#dc262640" strokeDasharray="4 4" label={{ value: "High (7)", position: "insideTopRight", fontSize: 11, fill: "#dc2626" }} />
                    <ReferenceLine y={4} stroke="#a1620740" strokeDasharray="4 4" label={{ value: "Moderate (4)", position: "insideTopRight", fontSize: 11, fill: "#a16207" }} />
                    <Line type="monotone" dataKey="diseaseScore" stroke="#378ADD" strokeWidth={3}
                      dot={(props) => {
                        const { cx, cy, payload } = props;
                        const color = TREND_META[payload.trendStatus]?.color ?? "#378ADD";
                        return <circle key={cx} cx={cx} cy={cy} r={6} fill={color} stroke="white" strokeWidth={2} />;
                      }}
                      activeDot={{ r: 8, strokeWidth: 2, stroke: "white" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </SectionCard>

        {/* ══════════════════════════════════════════════════════════════
            SECTION 4 — QUESTION-WISE GRAPH (Dropdown + Line Chart)
        ══════════════════════════════════════════════════════════════ */}
        <SectionCard title="Question-wise Score Graph" icon={BarChart2} accent="#a855f7">
          {questions.length === 0 || submissions.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8" }}>No data available.</div>
          ) : (
            <>
              {/* Dropdown selector */}
              <div style={{ marginBottom: 24, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b", flexShrink: 0 }}>Viewing question:</span>
                <div style={{ position: "relative", flex: 1, maxWidth: 480 }}>
                  <select
                    value={selectedQKey}
                    onChange={e => setSelectedQKey(e.target.value)}
                    style={{
                      width: "100%",
                      appearance: "none",
                      WebkitAppearance: "none",
                      padding: "10px 40px 10px 16px",
                      borderRadius: 12,
                      border: "1.5px solid #e2e8f0",
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#1e293b",
                      background: "white",
                      cursor: "pointer",
                      outline: "none",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                      transition: "border-color 0.15s",
                    }}
                    onFocus={e => (e.currentTarget.style.borderColor = "#a855f7")}
                    onBlur={e => (e.currentTarget.style.borderColor = "#e2e8f0")}
                  >
                    {questions.map((q, i) => (
                      <option key={q.question_key} value={q.question_key}>
                        Q{i + 1} — {q.question_text.split("(")[0].trim()}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} color="#94a3b8" style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                </div>

                {/* Color dot indicator */}
                {selectedQuestion && (
                  <div style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "8px 14px", borderRadius: 10,
                    background: "#f8fafc", border: "1px solid #f1f5f9", flexShrink: 0,
                  }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: selectedQColor }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: selectedQColor }}>
                      {selectedQKey.toUpperCase()}
                    </span>
                    <span style={{ fontSize: 12, color: "#94a3b8" }}>• Scale: 0–{selectedQuestion.max_value}</span>
                  </div>
                )}
              </div>

              {/* Question full text */}
              {selectedQuestion && (
                <div style={{
                  padding: "12px 16px", borderRadius: 12,
                  background: `${selectedQColor}0d`, border: `1px solid ${selectedQColor}22`,
                  marginBottom: 20, fontSize: 13, color: "#374151", lineHeight: 1.6,
                }}>
                  <span style={{ fontWeight: 700, color: selectedQColor }}>Full question: </span>
                  {selectedQuestion.question_text}
                </div>
              )}

              {/* Line Chart */}
              {qLineData.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8", fontSize: 14 }}>
                  No data for this question yet.
                </div>
              ) : (
                <div style={{ width: "100%", height: 300, minWidth: 0 }}>
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <LineChart data={qLineData} margin={{ top: 10, right: 20, bottom: 0, left: -10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, selectedQuestion?.max_value ?? 10]} tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <Tooltip content={<QLineTooltip questionText={selectedQuestion?.question_text ?? ""} />} />
                      <ReferenceLine y={7} stroke="#dc262635" strokeDasharray="4 4" label={{ value: "High (7)", position: "insideTopRight", fontSize: 11, fill: "#dc2626" }} />
                      <ReferenceLine y={4} stroke="#a1620735" strokeDasharray="4 4" label={{ value: "Moderate (4)", position: "insideTopRight", fontSize: 11, fill: "#a16207" }} />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke={selectedQColor}
                        strokeWidth={3}
                        dot={(props) => {
                          const { cx, cy, payload } = props;
                          const v = payload.value ?? 0;
                          const dotColor = v >= 7 ? "#dc2626" : v >= 4 ? "#a16207" : "#15803d";
                          return <circle key={cx} cx={cx} cy={cy} r={6} fill={dotColor} stroke="white" strokeWidth={2} />;
                        }}
                        activeDot={{ r: 8, strokeWidth: 2, stroke: "white", fill: selectedQColor }}
                        connectNulls
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* All questions quick legend */}
              <div style={{ marginTop: 20, display: "flex", flexWrap: "wrap", gap: 8 }}>
                {questions.map((q, i) => (
                  <button
                    key={q.question_key}
                    onClick={() => setSelectedQKey(q.question_key)}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "5px 12px", borderRadius: 99,
                      background: selectedQKey === q.question_key ? `${Q_COLORS[i % Q_COLORS.length]}18` : "#f8fafc",
                      border: `1.5px solid ${selectedQKey === q.question_key ? Q_COLORS[i % Q_COLORS.length] : "#f1f5f9"}`,
                      fontSize: 12, cursor: "pointer", transition: "all 0.15s",
                    }}
                  >
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: Q_COLORS[i % Q_COLORS.length], flexShrink: 0 }} />
                    <span style={{ fontWeight: 700, color: Q_COLORS[i % Q_COLORS.length] }}>{q.question_key.toUpperCase()}</span>
                    <span style={{ color: "#64748b" }}>{q.question_text.split("(")[0].trim().split(" ").slice(0, 4).join(" ")}…</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </SectionCard>

        {/* ══════════════════════════════════════════════════════════════
            SECTION 5 — PREVIOUS DAY HISTORY (Accordion)
        ══════════════════════════════════════════════════════════════ */}
        <SectionCard title="Previous Day History" icon={List} accent="#f59e0b">
          {sortedSubs.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8" }}>No submissions recorded yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {sortedSubs.map((sub) => {
                const isOpen = expandedDay === sub.day_number;
                const stm = TREND_META[sub.trend_status] ?? TREND_META.green;
                const hasOverride = sub.override_triggered;
                return (
                  <div key={sub.id} style={{
                    borderRadius: 16, border: `1.5px solid ${isOpen ? "#378ADD33" : "#f1f5f9"}`,
                    overflow: "hidden", transition: "border-color 0.2s",
                  }}>
                    <button
                      onClick={() => setExpandedDay(isOpen ? null : sub.day_number)}
                      style={{
                        width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "16px 20px", background: isOpen ? "#f0f7ff" : "#f8fafc",
                        border: "none", cursor: "pointer", transition: "background 0.15s", gap: 12,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <div className="heading-font" style={{ fontSize: 16, fontWeight: 800, color: isOpen ? "#378ADD" : "#0f172a" }}>Day {sub.day_number}</div>
                        <span style={{ fontSize: 11, color: "#94a3b8" }}>{fmtTime(sub.submitted_at)}</span>
                        {hasOverride && (
                          <span style={{ padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 700, background: "#fee2e2", color: "#dc2626" }}>🚨 Override</span>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ padding: "4px 12px", borderRadius: 99, fontSize: 12, fontWeight: 700, background: stm.bg, color: stm.color }}>
                          {sub.disease_score} — {stm.label}
                        </span>
                        {isOpen ? <ChevronUp size={16} color="#94a3b8" /> : <ChevronDown size={16} color="#94a3b8" />}
                      </div>
                    </button>
                    {isOpen && (
                      <div style={{ padding: "20px", borderTop: "1px solid #f1f5f9", background: "white" }}>
                        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
                          {[
                            { label: "Disease Score", value: sub.disease_score, color: stm.color, bg: stm.bg },
                            { label: "Priority Value", value: sub.priority_value, color: "#a855f7", bg: "#faf5ff" },
                          ].map(stat => (
                            <div key={stat.label} style={{ padding: "12px 20px", borderRadius: 14, background: stat.bg, display: "flex", flexDirection: "column", alignItems: "center" }}>
                              <span style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>{stat.label}</span>
                              <span className="heading-font" style={{ fontSize: 24, fontWeight: 800, color: stat.color, marginTop: 2 }}>{stat.value}</span>
                            </div>
                          ))}
                        </div>
                        {Object.keys(sub.answers).length > 0 && (
                          <>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>Symptom Answers</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                              {questions.filter(q => sub.answers[q.question_key] !== undefined).map((q, i) => (
                                <div key={q.question_key} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                  <span style={{ fontSize: 11, fontWeight: 700, color: Q_COLORS[i % Q_COLORS.length], width: 28, flexShrink: 0 }}>{q.question_key.toUpperCase()}</span>
                                  <span style={{ fontSize: 12, color: "#64748b", flex: 1 }}>{q.question_text.split("(")[0].trim()}</span>
                                  <div style={{ width: 160, flexShrink: 0 }}><ScoreBar value={sub.answers[q.question_key]} max={q.max_value} /></div>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                        {Object.keys(sub.override_answers).length > 0 && (
                          <>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#dc2626", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>Override Alerts</div>
                            {overrideQs.filter(q => sub.override_answers[q.question_key] !== undefined).map(q => (
                              <div key={q.question_key} style={{
                                padding: "10px 14px", borderRadius: 10,
                                background: sub.override_answers[q.question_key] ? "#fef2f2" : "#f0fdf4",
                                border: `1px solid ${sub.override_answers[q.question_key] ? "#fca5a5" : "#86efac"}`,
                                display: "flex", justifyContent: "space-between", alignItems: "center",
                                fontSize: 13, marginBottom: 8,
                              }}>
                                <span style={{ color: "#374151" }}>{q.question_text}</span>
                                <span style={{ fontWeight: 700, color: sub.override_answers[q.question_key] ? "#dc2626" : "#15803d" }}>
                                  {sub.override_answers[q.question_key] ? "🚨 Triggered" : "✓ Clear"}
                                </span>
                              </div>
                            ))}
                          </>
                        )}
                        {sub.images && sub.images.length > 0 && (
                          <div style={{ marginTop: 12 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginBottom: 10 }}>Attached Images</div>
                            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                              {sub.images.map((img, idx) => (
                                <img key={idx} src={img} alt={`Submission image ${idx + 1}`}
                                  style={{ width: 80, height: 80, borderRadius: 10, objectFit: "cover", border: "1px solid #e2e8f0" }} />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        {/* ══════════════════════════════════════════════════════════════
            SECTION 6 — PERSONAL INFORMATION
        ══════════════════════════════════════════════════════════════ */}
        <SectionCard title="Personal Information" icon={User} accent="#1D9E75">
          <div className="personal-info-grid">
            {[
              { label: "Full Name",         value: patient.name ?? "—" },
              { label: "Patient ID",        value: patient.readable_id ?? "—" },
              { label: "Age",               value: patient.age ? `${patient.age} years` : "—" },
              { label: "Gender",            value: patient.gender ? (patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1)) : "—" },
              { label: "Phone",             value: patient.phone ?? "—" },
              { label: "Relative's Phone",  value: patient.relative_phone ?? "—" },
              { label: "State",             value: patient.state ?? "—" },
              { label: "District",          value: patient.district ?? "—" },
              { label: "Address",           value: patient.address_line ?? "—" },
              { label: "Department",        value: patient.department_name ?? "—" },
              { label: "Diagnosis",         value: patient.diagnosis ?? "—" },
              { label: "Condition Type",    value: patient.condition_type ? (patient.condition_type.charAt(0).toUpperCase() + patient.condition_type.slice(1)) : "—" },
              { label: "Risk Category",     value: patient.risk_category ? rm.label : "—" },
              { label: "Consent Given",     value: patient.consent_given ? "Yes" : "No" },
              { label: "Monitoring Days",   value: patient.monitoring_days ? `${patient.monitoring_days} days` : "—" },
              { label: "Monitoring Start",  value: fmt(patient.monitoring_start) },
              { label: "Monitoring End",    value: fmt(patient.monitoring_end) },
              { label: "Registered On",     value: fmtTime(patient.created_at) },
              { label: "First Login",       value: fmtTime(patient.first_login_at) },
              { label: "Last Submission",   value: fmtTime(patient.last_submission_at) },
              { label: "Registered By",     value: patient.basic_registered_by_name ?? "—" },
              { label: "Medically Reg. By", value: patient.medical_registered_by_name ?? "—" },
            ].map(item => (
              <div key={item.label} style={{ padding: "14px 16px", borderRadius: 14, background: "#f8fafc", border: "1px solid #f1f5f9" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>{item.label}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>{item.value ?? "—"}</div>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Responsive styles */}
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }

          .patient-header-bar {
            border-radius: 14px;
            padding: 14px 16px !important;
            margin-bottom: 12px !important;
          }
          .header-stats-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 12px;
          }
          .header-stat-item {
            padding: 0;
          }
          .header-stat-divider {
            display: none;
            width: 1px;
            background: rgba(255,255,255,0.15);
            align-self: stretch;
          }
          .two-col-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 16px;
          }
          .personal-info-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
          }
          
          .patient-header-bar h1 {
            font-size: 18px !important;
          }
          
          .patient-header-bar > div:first-child > div:first-child {
            gap: 12px !important;
          }
          
          .patient-header-bar .heading-font {
            font-size: 16px !important;
          }
          
          .header-stat-item > div:first-child {
            font-size: 9px !important;
          }
          
          .personal-info-grid > div > div:first-child {
            font-size: 10px !important;
          }
          
          .personal-info-grid > div > div:last-child {
            font-size: 13px !important;
          }

          @media (min-width: 640px) {
            .patient-header-bar {
              border-radius: 18px;
              padding: 18px 20px !important;
              margin-bottom: 16px !important;
            }
            .header-stats-grid {
              grid-template-columns: 1fr 1fr;
              gap: 16px;
            }
            .personal-info-grid {
              grid-template-columns: repeat(2, 1fr);
              gap: 10px;
            }
            .patient-header-bar h1 {
              font-size: 20px !important;
            }
            .patient-header-bar .heading-font {
              font-size: 17px !important;
            }
            .header-stat-item > div:first-child {
              font-size: 10px !important;
            }
            .personal-info-grid > div > div:first-child {
              font-size: 11px !important;
            }
            .personal-info-grid > div > div:last-child {
              font-size: 14px !important;
            }
          }

          @media (min-width: 1024px) {
            .patient-header-bar {
              border-radius: 20px;
              padding: 28px 32px !important;
              margin-bottom: 24px !important;
            }
            .header-stats-grid {
              grid-template-columns: auto 1px auto 1px auto 1px 1fr;
              gap: 0;
              align-items: start;
            }
            .header-stat-item {
              padding: 0 28px;
            }
            .header-stat-item:first-child {
              padding-left: 0;
            }
            .header-stat-item:last-child {
              padding-right: 0;
            }
            .header-stat-divider {
              display: block;
            }
            .two-col-grid {
              grid-template-columns: 1fr 1fr;
              gap: 20px;
            }
            .personal-info-grid {
              grid-template-columns: repeat(3, 1fr);
              gap: 12px;
            }
            .patient-header-bar h1 {
              font-size: 26px !important;
            }
            .patient-header-bar .heading-font {
              font-size: 17px !important;
            }
            .header-stat-item > div:first-child {
              font-size: 10px !important;
            }
            .personal-info-grid > div > div:first-child {
              font-size: 11px !important;
            }
            .personal-info-grid > div > div:last-child {
              font-size: 14px !important;
            }
          }

          @media (min-width: 1400px) {
            .personal-info-grid {
              grid-template-columns: repeat(4, 1fr);
              gap: 12px;
            }
          }
        `}</style>
      </main>
    </div>
  );
}