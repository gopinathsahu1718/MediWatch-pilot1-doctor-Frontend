"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import {
  ArrowLeft, User, Phone, MapPin, Calendar, Activity,
  AlertTriangle, CheckCircle2, Clock, ChevronDown, ChevronUp,
  TrendingUp, TrendingDown, Minus, AlertCircle, Info,
  Heart, Shield, FileText, BarChart2, List, ChevronRight,
} from "lucide-react";

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
  triage_updated_by: string | null;
  triage_updated_at: string | null;
  triage_updated_by_name: string | null;
  triage_updated_by_role: string | null;
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

function fmtShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
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

// ─── Score color helper ───────────────────────────────────────────────────────

interface ScoreColorObj { color: string; background: string; }

const getScoreColor = (score: number | undefined): ScoreColorObj => {
  if (score === undefined || score === null) return { color: "#cbd5e1", background: "#f8fafc" };
  if (score < 4)  return { color: "#21d764", background: "#dcfce7" };
  if (score < 6)  return { color: "#a16207", background: "#fef9c3" };
  return { color: "#dc2626", background: "#fee2e2" };
};

// Dot fill color by score value: 1–3.9 green, 4–5.9 yellow, 6–10 red
const getDotColor = (score: number): string => {
  if (score < 4)  return "#22c55e";
  if (score < 6)  return "#f59e0b";
  return "#ef4444";
};

function ScoreBar({ value, max = 10 }: { value: number; max?: number }) {
  const pct = Math.min(100, (value / max) * 100);
  const scoreColors = getScoreColor(value);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ flex: 1, height: 8, borderRadius: 99, background: "#f1f5f9", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 99, background: scoreColors.color, transition: "width 0.6s ease" }} />
      </div>
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

// ─── Custom SVG Line Chart ────────────────────────────────────────────────────

interface ChartPoint {
  dayNumber: number;
  date: string;
  value: number;
  trendStatus?: string; // for BASDAI: "red" | "green" | "yellow"
  overrideTriggered?: boolean;
}

interface CustomLineChartProps {
  data: ChartPoint[];
  overrideData?: OverridePoint[];
  maxY?: number;
  showOverrideLine?: boolean;
  showViewSelector?: boolean;
  viewMode?: string;
  onViewChange?: (v: string) => void;
  height?: number;
}

function CustomLineChart({
  data,
  overrideData = [],
  maxY = 10,
  showOverrideLine = false,
  height = 300,
}: CustomLineChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; point: ChartPoint } | null>(null);
  const [dims, setDims] = useState({ w: 800, h: height });

  useEffect(() => {
    if (!svgRef.current) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        setDims({ w: e.contentRect.width, h: height });
      }
    });
    ro.observe(svgRef.current.parentElement!);
    return () => ro.disconnect();
  }, [height]);

  if (data.length === 0) return <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8" }}>No submissions yet.</div>;

  const PAD = { top: 30, right: 20, bottom: 48, left: 40 };
  const W = dims.w;
  const H = dims.h;
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const xScale = (i: number) => PAD.left + (i / Math.max(data.length - 1, 1)) * chartW;
  const yScale = (v: number) => PAD.top + chartH - (v / maxY) * chartH;

  // Build segments colored by trend direction
  const segments: Array<{ x1: number; y1: number; x2: number; y2: number; color: string }> = [];
  for (let i = 0; i < data.length - 1; i++) {
    const cur = data[i];
    const next = data[i + 1];
    // Color the segment by WHERE it's going (next trend) or by whether next > cur
    const isWorsening = next.value > cur.value;
    segments.push({
      x1: xScale(i), y1: yScale(cur.value),
      x2: xScale(i + 1), y2: yScale(next.value),
      color: isWorsening ? "#ef4444" : "#22c55e",
    });
  }

  // Override trend line — connect only days that have override=true, shown as dashed purple
  const overridePath = overrideData.length > 0
    ? overrideData.map((op, i) => {
        const idx = data.findIndex(d => d.dayNumber === op.dayNumber);
        if (idx === -1) return null;
        return { x: xScale(idx), y: yScale(op.overrideTriggered ? maxY : 0), triggered: op.overrideTriggered };
      }).filter(Boolean)
    : [];

  // Y-axis grid lines
  const yTicks = [0, 2, 4, 6, 8, 10].filter(t => t <= maxY);

  // X-axis labels
  const xLabels = data.map((d, i) => ({ x: xScale(i), label: fmtShort(d.date) }));

  // Day labels (D1, D2...)
  const dayLabels = data.map((d, i) => ({ x: xScale(i), label: `D${d.dayNumber}` }));

  return (
    <div style={{ position: "relative", width: "100%", userSelect: "none" }}>
      <svg
        ref={svgRef}
        width="100%"
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        style={{ overflow: "visible", display: "block" }}
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Background tinted area */}
        <rect x={PAD.left} y={PAD.top} width={chartW} height={chartH} fill="#f0fdf8" rx={8} />

        {/* Y grid lines */}
        {yTicks.map(tick => (
          <g key={tick}>
            <line
              x1={PAD.left} y1={yScale(tick)} x2={PAD.left + chartW} y2={yScale(tick)}
              stroke={tick === 0 ? "#94a3b8" : "#d1fae5"} strokeWidth={tick === 0 ? 1.5 : 1}
              strokeDasharray={tick > 0 ? "4 4" : "none"}
            />
            <text x={PAD.left - 8} y={yScale(tick) + 4} textAnchor="end" fontSize={11} fill="#94a3b8" fontFamily="sans-serif">{tick}</text>
          </g>
        ))}

        {/* X vertical dashed guides */}
        {data.map((d, i) => (
          <line key={i} x1={xScale(i)} y1={PAD.top} x2={xScale(i)} y2={PAD.top + chartH}
            stroke="#d1fae5" strokeWidth={1} strokeDasharray="3 3" />
        ))}

        {/* Day labels at top */}
        {dayLabels.map((dl, i) => (
          <text key={i} x={dl.x} y={PAD.top - 10} textAnchor="middle" fontSize={11} fill="#94a3b8" fontWeight={600} fontFamily="sans-serif">{dl.label}</text>
        ))}

        {/* Override dashed trend line */}
        {showOverrideLine && overridePath.length >= 2 && (() => {
          const pts = overridePath as Array<{ x: number; y: number; triggered: boolean }>;
          // Draw line from each actual override point at y=maxY (10) with dashes to zero
          return overrideData.map((op, i) => {
            const idx = data.findIndex(d => d.dayNumber === op.dayNumber);
            if (idx === -1) return null;
            const cx = xScale(idx);
            return (
              <g key={i}>
                <line
                  x1={cx} y1={PAD.top}
                  x2={cx} y2={PAD.top + chartH}
                  stroke="#a78bfa" strokeWidth={1.5} strokeDasharray="5 4" opacity={0.6}
                />
              </g>
            );
          });
        })()}

        {/* Colored line segments */}
        {segments.map((seg, i) => (
          <line key={i} x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
            stroke={seg.color} strokeWidth={2.5} strokeLinecap="round" />
        ))}

        {/* Score value label above each dot */}
        {/* {data.map((d, i) => (
          <text
            key={i}
            x={xScale(i)} y={yScale(d.value) - 14}
            textAnchor="middle" fontSize={12} fontWeight={800}
            fill={getDotColor(d.value)} fontFamily="sans-serif"
          >{d.value}</text>
        ))} */}

        {/* Dots */}
        {data.map((d, i) => {
          const cx = xScale(i);
          const cy = yScale(d.value);
          const dotColor = getDotColor(d.value);
          return (
            <g key={i}
              onMouseEnter={() => setTooltip({ x: cx, y: cy, point: d })}
              style={{ cursor: "pointer" }}
            >
              {/* Outer ring */}
              <circle cx={cx} cy={cy} r={13} fill={`${dotColor}22`} />
              <circle cx={cx} cy={cy} r={10} fill="white" stroke={dotColor} strokeWidth={2} />
              <text x={cx} y={cy + 4} textAnchor="middle" fontSize={10} fontWeight={800} fill={dotColor} fontFamily="sans-serif">{d.value}</text>
            </g>
          );
        })}

        {/* Override dots on bottom axis */}
        {showOverrideLine && overrideData.map((op, i) => {
          const idx = data.findIndex(d => d.dayNumber === op.dayNumber);
          if (idx === -1) return null;
          const cx = xScale(idx);
          const cy = PAD.top + chartH + 8;
          return (
            <circle key={i} cx={cx} cy={cy} r={5}
              fill={op.overrideTriggered ? "#a78bfa" : "#22c55e"}
              stroke="white" strokeWidth={1.5}
            />
          );
        })}

        {/* X axis date labels */}
        {xLabels.map((xl, i) => (
          <text key={i} x={xl.x} y={H - 6} textAnchor="middle" fontSize={11} fill="#64748b" fontFamily="sans-serif">{xl.label}</text>
        ))}

        {/* Y axis label */}
        <text x={12} y={PAD.top + chartH / 2} textAnchor="middle" fontSize={11} fill="#94a3b8" transform={`rotate(-90, 12, ${PAD.top + chartH / 2})`} fontFamily="sans-serif">Score</text>
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div style={{
          position: "absolute",
          left: tooltip.x + 16,
          top: tooltip.y - 20,
          background: "white",
          border: "1.5px solid #e2e8f0",
          borderRadius: 12,
          padding: "10px 14px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
          pointerEvents: "none",
          zIndex: 10,
          minWidth: 130,
        }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a", marginBottom: 4 }}>Day {tooltip.point.dayNumber}</div>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>{fmt(tooltip.point.date)}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: getDotColor(tooltip.point.value) }}>{tooltip.point.value}</span>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 99,
              background: getScoreColor(tooltip.point.value).background,
              color: getScoreColor(tooltip.point.value).color,
            }}>
              {tooltip.point.value < 4 ? "Low" : tooltip.point.value < 6 ? "Medium" : "High"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [patient,       setPatient]       = useState<PatientDetail | null>(null);
  const [overrideQs,    setOverrideQs]    = useState<OverrideQuestion[]>([]);
  const [latestSub,     setLatestSub]     = useState<LatestSubmission | null>(null);
  const [questions,     setQuestions]     = useState<Question[]>([]);
  const [submissions,   setSubmissions]   = useState<Submission[]>([]);
  const [basdaiGraph,   setBasdaiGraph]   = useState<BasdaiPoint[]>([]);
  const [overrideGraph, setOverrideGraph] = useState<OverridePoint[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState<string | null>(null);
  const [expandedDay,   setExpandedDay]   = useState<number | null>(null);
  const [selectedQKey,  setSelectedQKey]  = useState<string>("");
  

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

  // BASDAI chart data
  const basdaiChartData: ChartPoint[] = useMemo(() =>
    [...basdaiGraph]
      .sort((a, b) => a.dayNumber - b.dayNumber)
      .map(p => ({ dayNumber: p.dayNumber, date: p.date, value: p.diseaseScore, trendStatus: p.trendStatus })),
    [basdaiGraph]
  );

  // Trend summary
  const basdaiTrend = useMemo(() => {
    if (basdaiChartData.length < 2) return null;
    const first = basdaiChartData[0].value;
    const last  = basdaiChartData[basdaiChartData.length - 1].value;
    const diff  = last - first;
    return { diff, isDown: diff < 0 };
  }, [basdaiChartData]);

  // Question-wise data
  const selectedQuestion = questions.find(q => q.question_key === selectedQKey);
  const qChartData: ChartPoint[] = useMemo(() =>
    [...submissions]
      .sort((a, b) => a.day_number - b.day_number)
      .map(s => ({
        dayNumber: s.day_number,
        date: s.submitted_at,
        value: s.answers[selectedQKey] ?? 0,
      }))
      .filter(d => d.value !== undefined),
    [submissions, selectedQKey]
  );

  const Q_COLORS = ["#22c55e", "#378ADD", "#a855f7", "#f59e0b", "#ec4899", "#14b8a6"];

  // Sorted submissions descending
  const sortedSubs = [...submissions].sort((a, b) => b.day_number - a.day_number);

  const triageStatus = patient?.triage_status ?? "in_progress";
  const isTriageResolved = triageStatus === "resolved";
  const isTriageAcknowledged = triageStatus === "ack";
  const triageLabel = isTriageResolved ? "Resolved" : isTriageAcknowledged ? "Acknowledge" : "In Progress";
  const triagePanelBg = isTriageResolved ? "rgba(68, 219, 88, 0.2)" : isTriageAcknowledged ? "rgba(18, 104, 242, 0.97)" : "rgba(255, 195, 14, 0.5)";
  const triagePanelBorder = isTriageResolved ? "rgba(255,255,255,0.4)" : isTriageAcknowledged ? "rgba(191,219,254,0.4)" : "rgba(255,253,253,0.4)";
  const triageIconColor = isTriageResolved ? "#6bcb77" : isTriageAcknowledged ? "#2563eb" : "#ffd83d";

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
            HEADER
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

          {/* Row 1: Identity + Status */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 24, position: "relative" }}>
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
                  <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.7)", background: "rgba(255,255,255,0.12)", padding: "3px 10px", borderRadius: 6 }}>{patient.readable_id}</span>
                  <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>•</span>
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.8)" }}>{patient.age ? `${patient.age} yrs` : "—"}, {patient.gender ? (patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1)) : "—"}</span>
                  <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>•</span>
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.8)" }}>{patient.department_name ?? "—"}</span>
                </div>
              </div>
            </div>

            <div style={{
              padding: "10px 18px", borderRadius: 14,
              background: triagePanelBg,
              border: `1.5px solid ${triagePanelBorder}`,
              display: "flex", alignItems: "center", gap: 10,
              minWidth: 0,
              maxWidth: "max(420px, 100%)",
              flex: "0 1 auto",
              flexWrap: "wrap",
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: isTriageResolved ? "rgba(107,203,119,0.25)" : isTriageAcknowledged ? "rgba(191,219,254,0.35)" : "rgba(255,193,7,0.65)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                {isTriageResolved ? <CheckCircle2 size={16} color={triageIconColor} /> : isTriageAcknowledged ? <Info size={16} color={triageIconColor} /> : <Activity size={16} color={triageIconColor} />}
              </div>
              <div style={{ minWidth: 0, flex: "1 1 0" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,1)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 2 }}>Triage</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: isTriageResolved ? "#3eff57" : isTriageAcknowledged ? "#fefefe" : "#ffd93d" }}>
                  {triageLabel}
                </div>
                {patient.resolved_reason && <div style={{ fontSize: 12, color: "rgba(255, 255, 255, 1)", marginTop: 1, maxWidth: "100%", overflowWrap: "break-word", wordBreak: "break-word", whiteSpace: "normal" }}>{patient.resolved_reason}</div>}
                {(patient.triage_updated_by_name || patient.triage_updated_at) && (
                  <div style={{ fontSize: 12, color: "rgba(255, 255, 255, 1)", marginTop: 6, lineHeight: 1.4 }}>
                    {patient.triage_updated_by_name ? `Updated by ${patient.triage_updated_by_name}` : patient.triage_updated_by ? `Updated by ${patient.triage_updated_by}` : null}
                    {patient.triage_updated_at ? ` · ${fmtTime(patient.triage_updated_at)}` : null}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ height: 1, background: "rgba(255,255,255,0.15)", marginBottom: 20, position: "relative" }} />

          {/* Row 2: Stats Grid */}
          <div className="header-stats-grid" style={{ position: "relative" }}>
            <div className="header-stat-item">
              <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.8)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Risk Level</div>
              {patient.risk_category ? (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 10, background: rm.bg, border: `1.5px solid ${rm.border}` }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: rm.color }} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: rm.color }}>{rm.label}</span>
                </div>
              ) : <span style={{ fontSize: 20, fontWeight: 700, color: "rgba(255,255,255,0.8)" }}>—</span>}
            </div>
            <div className="header-stat-divider" />
            <div className="header-stat-item">
              <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.8)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Diagnosis</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "white", lineHeight: 1.3 }}>{patient.diagnosis ?? "—"}</div>
              {patient.condition_type && <div style={{ marginTop: 5, fontSize: 11, color: "rgba(255,255,255,0.55)", fontWeight: 500 }}>{patient.condition_type.charAt(0).toUpperCase() + patient.condition_type.slice(1)} condition</div>}
            </div>
            <div className="header-stat-divider" />
            <div className="header-stat-item">
              <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.8)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Latest Score</div>
              {latestSub ? (
                <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <span style={{ fontSize: 32, fontWeight: 800, color: getScoreColor(latestSub.disease_score).color, lineHeight: 1 }}>{latestSub.disease_score}</span>
                  <span style={{ padding: "4px 12px", borderRadius: 99, fontSize: 12, fontWeight: 700, background: getScoreColor(latestSub.disease_score).background, color: getScoreColor(latestSub.disease_score).color }}>
                    {latestSub.disease_score < 4 ? "Low" : latestSub.disease_score < 6 ? "Medium" : "High"}
                  </span>
                </div>
              ) : <span style={{ fontSize: 20, fontWeight: 700, color: "rgba(255,255,255,0.4)" }}>—</span>}
              {latestSub && (
                <div style={{ marginTop: 5, display: "flex", alignItems: "center", gap: 5, color: "rgba(255,255,255,0.8)", fontSize: 11 }}>
                  <Clock size={11} />
                  <span>{fmtTime(patient.last_submission_at)}</span>
                </div>
              )}
            </div>
            <div className="header-stat-divider" />
            <div className="header-stat-item" style={{ minWidth: 180 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.8)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Monitoring Progress</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: "white" }}>
                  {prog.daysPassed}
                  <span style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.8)" }}>/{patient.monitoring_days} days</span>
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>{prog.pct}%</span>
              </div>
              <div style={{ height: 6, background: "rgba(255,255,255,0.15)", borderRadius: 99, overflow: "hidden" }}>
                <div style={{ width: `${prog.pct}%`, height: "100%", borderRadius: 99, background: "rgba(255,255,255,0.85)", transition: "width 0.8s ease" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.8)" }}>{fmt(patient.monitoring_start)}</span>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.8)" }}>{fmt(patient.monitoring_end)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════
            SECTION 2 — SYMPTOM + OVERRIDE QUESTIONS
        ══════════════════════════════════════════════════════════════ */}
        <div className="two-col-grid" style={{ marginBottom: 24 }}>
          <SectionCard title="Symptom Questions" icon={FileText} accent="#378ADD">
            {questions.length === 0 ? (
              <div style={{ color: "#94a3b8", fontSize: 14, textAlign: "center", padding: "20px 0" }}>No questions loaded.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {questions.map((q, i) => {
                  const latestAnswer = latestSub
                    ? (submissions.find(s => s.day_number === latestSub.day_number)?.answers[q.question_key] ?? null)
                    : null;
                  return (
                    <div key={q.question_key} style={{ padding: "10px 12px", borderRadius: 12, background: "#f8fafc", border: "1px solid #f1f5f9" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: latestAnswer !== null ? 6 : 0 }}>
                        <div style={{ flex: 1, paddingRight: 10 }}>
                          <span style={{ fontSize: 10, fontWeight: 800, color: "#378ADD", textTransform: "uppercase", letterSpacing: "0.07em" }}>Q{i + 1}</span>
                          <div style={{ fontSize: 12, color: "#374151", fontWeight: 500, marginTop: 3, lineHeight: 1.3 }}>{q.question_text}</div>
                        </div>
                        {latestAnswer !== null && (
                          <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 8, background: latestAnswer >= 7 ? "#fee2e2" : latestAnswer >= 4 ? "#fef9c3" : "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <span style={{ fontWeight: 800, fontSize: 14, color: latestAnswer >= 7 ? "#dc2626" : latestAnswer >= 4 ? "#a16207" : "#15803d" }}>{latestAnswer}</span>
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
                          <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4, color: triggered === true ? "#dc2626" : "#94a3b8" }}>Override Alert</div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: "#374151", lineHeight: 1.5 }}>{q.question_text}</div>
                        </div>
                        {triggered !== null && (
                          <div style={{ flexShrink: 0, padding: "6px 14px", borderRadius: 99, background: triggered ? "#dc2626" : "#15803d", color: "white", fontWeight: 700, fontSize: 12 }}>
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
                              style={{ width: 22, height: 22, borderRadius: "50%", background: val ? "#dc2626" : "#15803d", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "white", cursor: "default" }}>
                              D{og.dayNumber}
                            </div>
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
            SECTION 3 — BASDAI RECOVERY TIMELINE (Redesigned)
        ══════════════════════════════════════════════════════════════ */}
        <div style={{
          background: "white", borderRadius: 20, padding: 28,
          boxShadow: "0 2px 16px rgba(0,0,0,0.06)", marginBottom: 24,
          border: "1px solid #f1f5f9",
        }}>
          {/* Header row with view selector */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid #f1f5f9", flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "#1D9E7518", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <TrendingUp size={18} color="#1D9E75" />
              </div>
              <h2 className="heading-font" style={{ fontSize: 17, fontWeight: 700, color: "#0f172a", margin: 0 }}>BASDAI Recovery Timeline</h2>
            </div>
            {/* View dropdown removed per request */}
          </div>

          {basdaiChartData.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8" }}>No submissions yet.</div>
          ) : (
            <>
              <div style={{ width: "100%", overflowX: "auto" }}>
                <div style={{ width: "100%", minWidth: 0 }}>
                  <CustomLineChart
                    data={basdaiChartData}
                    overrideData={overrideGraph}
                    maxY={10}
                    showOverrideLine={true}
                    height={320}
                  />
                </div>
              </div>

              {/* Legend */}
              <div style={{ display: "flex", gap: 20, marginTop: 16, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 28, height: 3, background: "#22c55e", borderRadius: 2 }} />
                  <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>BASDAI Improving</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 28, height: 3, background: "#ef4444", borderRadius: 2 }} />
                  <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>BASDAI Worsening</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 28, height: 2, background: "#a78bfa", borderRadius: 2, borderTop: "2px dashed #a78bfa" }} />
                  <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>Override trend</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#a78bfa" }} />
                  <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>Override: Yes</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#22c55e" }} />
                  <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>Override: No</span>
                </div>
                {basdaiTrend && (
                  <div style={{
                    marginLeft: "auto", display: "flex", alignItems: "center", gap: 8,
                    padding: "6px 14px", borderRadius: 10,
                    background: basdaiTrend.isDown ? "#dcfce7" : "#fee2e2",
                    border: `1.5px solid ${basdaiTrend.isDown ? "#86efac" : "#fca5a5"}`,
                  }}>
                    {basdaiTrend.isDown ? <TrendingDown size={14} color="#15803d" /> : <TrendingUp size={14} color="#dc2626" />}
                    <span style={{ fontSize: 12, fontWeight: 700, color: basdaiTrend.isDown ? "#15803d" : "#dc2626" }}>
                      {basdaiTrend.isDown ? "Improving" : "Worsening"} ({basdaiTrend.diff > 0 ? "+" : ""}{basdaiTrend.diff.toFixed(1)})
                    </span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════════
            SECTION 4 — QUESTION-WISE SCORE TRENDS (Redesigned)
        ══════════════════════════════════════════════════════════════ */}
        <div style={{
          background: "white", borderRadius: 20, padding: 28,
          boxShadow: "0 2px 16px rgba(0,0,0,0.06)", marginBottom: 24,
          border: "1px solid #f1f5f9",
        }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, paddingBottom: 16, borderBottom: "1px solid #f1f5f9" }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#a855f718", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <BarChart2 size={18} color="#a855f7" />
            </div>
            <h2 className="heading-font" style={{ fontSize: 17, fontWeight: 700, color: "#0f172a", margin: 0 }}>Question-wise Score Trends</h2>
          </div>

          {questions.length === 0 || submissions.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8" }}>No data available.</div>
          ) : (
            <>
              {/* Tab buttons — Q1, Q2, Q3... */}
              <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                {questions.map((q, i) => {
                  const isSelected = selectedQKey === q.question_key;
                  const color = Q_COLORS[i % Q_COLORS.length];
                  return (
                    <button
                      key={q.question_key}
                      onClick={() => setSelectedQKey(q.question_key)}
                      style={{
                        padding: "7px 18px", borderRadius: 99, fontSize: 13, fontWeight: 700,
                        cursor: "pointer", border: `1.5px solid ${isSelected ? color : "#e2e8f0"}`,
                        background: isSelected ? color : "white",
                        color: isSelected ? "white" : "#64748b",
                        transition: "all 0.15s",
                      }}
                    >
                      Q{i + 1}
                    </button>
                  );
                })}
              </div>

              {/* Selected question text */}
              {selectedQuestion && (
                <div style={{
                  padding: "10px 16px", borderRadius: 10,
                  background: "#f0fdf4", border: "1px solid #bbf7d0",
                  marginBottom: 16, fontSize: 13, color: "#374151",
                }}>
                  <span style={{ fontWeight: 700, color: "#15803d" }}>{selectedQKey.toUpperCase()}: </span>
                  {selectedQuestion.question_text}
                </div>
              )}

              {/* Chart */}
              {qChartData.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8", fontSize: 14 }}>No data for this question yet.</div>
              ) : (
                <div style={{ width: "100%", overflowX: "auto" }}>
                  <div style={{ width: "100%", minWidth: 0 }}>
                    <CustomLineChart
                      data={qChartData}
                      maxY={selectedQuestion?.max_value ?? 10}
                      height={300}
                    />
                  </div>
                </div>
              )}

              {/* Color legend */}
              <div style={{ display: "flex", gap: 16, marginTop: 16, flexWrap: "wrap" }}>
                {[
                  { label: "Low (1–3.9)", color: "#22c55e" },
                  { label: "Medium (4–5.9)", color: "#f59e0b" },
                  { label: "High (6–10)", color: "#ef4444" },
                ].map(item => (
                  <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: item.color }} />
                    <span style={{ fontSize: 12, color: "#64748b" }}>{item.label}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

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
                const hasOverride = sub.override_triggered;
                return (
                  <div key={sub.id} style={{ borderRadius: 16, border: `1.5px solid ${isOpen ? "#378ADD33" : "#f1f5f9"}`, overflow: "hidden", transition: "border-color 0.2s" }}>
                    <button
                      onClick={() => setExpandedDay(isOpen ? null : sub.day_number)}
                      style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", background: isOpen ? "#f0f7ff" : "#f8fafc", border: "none", cursor: "pointer", transition: "background 0.15s", gap: 12 }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <div className="heading-font" style={{ fontSize: 16, fontWeight: 800, color: isOpen ? "#378ADD" : "#0f172a" }}>Day {sub.day_number}</div>
                        <span style={{ fontSize: 11, color: "#94a3b8" }}>{fmtTime(sub.submitted_at)}</span>
                        {hasOverride && <span style={{ padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 700, background: "#fee2e2", color: "#dc2626" }}>🚨 Override</span>}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ padding: "4px 12px", borderRadius: 99, fontSize: 12, fontWeight: 700, background: getScoreColor(sub.disease_score).background, color: getScoreColor(sub.disease_score).color }}>
                          {sub.disease_score} — {sub.disease_score < 4 ? "Low" : sub.disease_score < 6 ? "Medium" : "High"}
                        </span>
                        {isOpen ? <ChevronUp size={16} color="#94a3b8" /> : <ChevronDown size={16} color="#94a3b8" />}
                      </div>
                    </button>
                    {isOpen && (
                      <div style={{ padding: "20px", borderTop: "1px solid #f1f5f9", background: "white" }}>
                        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
                          {[
                            { label: "Disease Score", value: sub.disease_score, color: getScoreColor(sub.disease_score).color, bg: getScoreColor(sub.disease_score).background },
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
          .header-stat-item { padding: 0; }
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
          .patient-header-bar h1 { font-size: 18px !important; }
          .patient-header-bar > div:first-child > div:first-child { gap: 12px !important; }
          .patient-header-bar .heading-font { font-size: 16px !important; }
          .header-stat-item > div:first-child { font-size: 9px !important; }
          .personal-info-grid > div > div:first-child { font-size: 10px !important; }
          .personal-info-grid > div > div:last-child { font-size: 13px !important; }

          @media (min-width: 640px) {
            .patient-header-bar { border-radius: 18px; padding: 18px 20px !important; margin-bottom: 16px !important; }
            .header-stats-grid { grid-template-columns: 1fr 1fr; gap: 16px; }
            .personal-info-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
            .patient-header-bar h1 { font-size: 20px !important; }
            .patient-header-bar .heading-font { font-size: 17px !important; }
            .header-stat-item > div:first-child { font-size: 10px !important; }
            .personal-info-grid > div > div:first-child { font-size: 11px !important; }
            .personal-info-grid > div > div:last-child { font-size: 14px !important; }
          }

          @media (min-width: 1024px) {
            .patient-header-bar { border-radius: 20px; padding: 28px 32px !important; margin-bottom: 24px !important; }
            .header-stats-grid {
              grid-template-columns: auto 1px auto 1px auto 1px 1fr;
              gap: 0;
              align-items: start;
            }
            .header-stat-item { padding: 0 28px; }
            .header-stat-item:first-child { padding-left: 0; }
            .header-stat-item:last-child { padding-right: 0; }
            .header-stat-divider { display: block; }
            .two-col-grid { grid-template-columns: 1fr 1fr; gap: 20px; }
            .personal-info-grid { grid-template-columns: repeat(3, 1fr); gap: 12px; }
            .patient-header-bar h1 { font-size: 26px !important; }
            .patient-header-bar .heading-font { font-size: 17px !important; }
            .header-stat-item > div:first-child { font-size: 10px !important; }
            .personal-info-grid > div > div:first-child { font-size: 11px !important; }
            .personal-info-grid > div > div:last-child { font-size: 14px !important; }
          }

          @media (min-width: 1400px) {
            .personal-info-grid { grid-template-columns: repeat(4, 1fr); gap: 12px; }
          }
        `}</style>
      </main>
    </div>
  );
}