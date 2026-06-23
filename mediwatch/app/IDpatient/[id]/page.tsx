"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import {
  ArrowLeft, RefreshCcw, User, Phone, MapPin, Calendar, Activity,
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
  // Alert status is derived from activeAlerts[] returned by GET /doctor/patients/:id
  disease_name: string;
  department_name: string;
  basic_registered_by_name: string;
  medical_registered_by_name: string;
}

interface ActiveAlert {
  id: string;
  alert_type: "red" | "yellow";
  alert_status: "pending" | "in_process" | "resolved";
  created_at: string;
  resolution_note: string | null;
  resolution_category: string | null;
  in_process_at: string | null;
  resolved_at: string | null;
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

interface QuestionOption {
  label: string;
  value: number;
}

interface Question {
  question_key: string;
  question_text: string;
  question_type: string; // "range" | "selection" (backend may add more types over time)
  display_order: number;
  min_value: number;
  max_value: number;
  question_options?: QuestionOption[]; // present when question_type === "selection"
}

interface EnrichedAnswer {
  question_text: string;
  question_type: string; // "range" | "selection"
  min_value: number;
  max_value: number;
  display_order: number;
  value: number;
  question_options?: QuestionOption[]; // present when question_type === "selection"
  selection_label?: string; // human-readable label of the chosen option, when question_type === "selection"
}

interface EnrichedOverrideAnswer {
  question_text: string;
  display_order: number;
  triggered: boolean;
}

interface Submission {
  id: string;
  day_number: number;
  answers: Record<string, EnrichedAnswer>;
  override_answers: Record<string, EnrichedOverrideAnswer>;
  disease_score: number;
  trend_status: string;
  priority_value: number;
  override_triggered: boolean;
  images: string[];
  submitted_at: string;
}

interface HistoryAlert {
  id: string;
  alert_type: "red" | "yellow";
  alert_status: "pending" | "in_process" | "resolved";
  created_at: string;
  resolved_at: string | null;
  in_process_at: string | null;
  escalated_at: string | null;
  escalated_at_ist: string | null;
  resolution_note: string | null;
  resolution_category: string | null;
  in_process_by_name: string | null;
  resolved_by_name: string | null;
  reminder_count: number;
  escalated: boolean;
  submission_day_number: number | null;
  reminder_details?: Array<{
    sent_to_phone: string;
    sent_to_role: string;
    type: string;
    channel: string;
    status: string;
    sent_at: string;
  }>;
}

interface BasdaiPoint {
  dayNumber: number;
  date: string;
  diseaseScore: number;
  trendStatus: string;
}

interface OverrideAnswerEntry {
  question_text: string;
  display_order: number;
  triggered: boolean;
}

interface OverridePoint {
  dayNumber: number;
  date: string;
  overrideTriggered: boolean;
  overrideAnswers: Record<string, OverrideAnswerEntry>;
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

function formatScore(value: number | string | null | undefined): string {
  if (value == null) return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) return "—";
  return n.toFixed(1);
}

function addDaysIso(startIso: string, days: number): string {
  const date = new Date(startIso);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function buildDayDate(startIso: string, dayNumber: number): string {
  return addDaysIso(startIso, dayNumber - 1);
}

function isSameOrBeforeToday(iso: string): boolean {
  const date = new Date(iso);
  const normalized = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const today = new Date();
  const todayNormalized = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return normalized.getTime() <= todayNormalized.getTime();
}

// Prefer *_ist timestamp fields when present (API sometimes returns *_ist keys)
function pickAlertIso(alert: any, keyBase: "created_at" | "in_process_at" | "resolved_at" | "escalated_at") {
  if (!alert) return null;
  // prefer exact field
  if (alert[keyBase]) return alert[keyBase];
  // then try *_ist variant
  const istKey = `${keyBase}_ist`;
  if (istKey in alert && alert[istKey]) return alert[istKey];
  return null;
}

function getImageUrl(path: string | null | undefined): string {
  if (!path) return "";
  const trimmed = path.toString().trim();
  if (trimmed === "") return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  const normalized = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  try {
    return new URL(normalized, "https://api.mediwatch.in").toString();
  } catch {
    return `https://api.mediwatch.in${normalized}`;
  }
}

function transformOverridePoint(raw: any): OverridePoint {
  const answers = raw.overrideAnswers ?? {};
  return {
    dayNumber: raw.dayNumber,
    date: raw.date,
    overrideTriggered: raw.overrideTriggered === true,
    overrideAnswers: Object.fromEntries(Object.entries(answers).map(([key, value]) => {
      const answer = value as any;
      return [key, {
        question_text: answer?.question_text ?? "",
        display_order: Number(answer?.display_order ?? 0),
        triggered: answer?.triggered === true,
      }];
    })),
  };
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
  high: { label: "High Risk", color: "#ff6b6b", bg: "rgba(255,107,107,0.15)", border: "rgba(255,107,107,0.3)" },
  medium: { label: "Medium Risk", color: "#ffd93d", bg: "rgba(255,217,61,0.15)", border: "rgba(255,217,61,0.3)" },
  low: { label: "Low Risk", color: "#6bcb77", bg: "rgba(107,203,119,0.15)", border: "rgba(107,203,119,0.3)" },
};

const TREND_META: Record<string, { color: string; bg: string; label: string }> = {
  red: { color: "#dc2626", bg: "#fee2e2", label: "Critical" },
  yellow: { color: "#a16207", bg: "#fef9c3", label: "Warning" },
  green: { color: "#15803d", bg: "#dcfce7", label: "Stable" },
};

const STATUS_META: Record<string, { color: string; bg: string; label: string; dot: string }> = {
  active: { color: "#15803d", bg: "rgba(107, 203, 120, 0.8)", label: "Active", dot: "#00ff22" },
  inactive: { color: "#a16207", bg: "rgba(255,217,61,0.2)", label: "Inactive", dot: "#ffd93d" },
  completed: { color: "#378ADD", bg: "rgba(55,138,221,0.2)", label: "Completed", dot: "#378ADD" },
  incomplete: { color: "#ff6b6b", bg: "rgba(255,107,107,0.2)", label: "Incomplete", dot: "#ff6b6b" },
  pending_login: { color: "#c084fc", bg: "rgba(192,132,252,0.2)", label: "Pending Login", dot: "#c084fc" },
};

// ─── Score color helper ───────────────────────────────────────────────────────

interface ScoreColorObj { color: string; background: string; }

const getScoreColor = (score: number | undefined): ScoreColorObj => {
  if (score === undefined || score === null) return { color: "#cbd5e1", background: "#f8fafc" };
  if (score < 4) return { color: "#21d764", background: "#dcfce7" };
  if (score < 6) return { color: "#a16207", background: "#fef9c3" };
  return { color: "#dc2626", background: "#fee2e2" };
};

// Dot fill color by score value: 1–3.9 green, 4–5.9 yellow, 6–10 red
const getDotColor = (score: number): string => {
  if (score < 4) return "#22c55e";
  if (score < 6) return "#f59e0b";
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

// Severity color for any min/max scale, normalized onto the same 0–10 bands
// getScoreColor() uses. This lets selection-type questions (e.g. 0–2 scale)
// and range-type questions (e.g. 0–10 scale) share one consistent color logic,
// with zero visual change for existing 0–10 range questions.
function getScaledColor(value: number | null | undefined, max: number | null | undefined): ScoreColorObj {
  if (value == null) return getScoreColor(undefined);
  const m = max && max > 0 ? max : 10;
  return getScoreColor((value / m) * 10);
}

function isSelectionType(type: string | null | undefined): boolean {
  return type === "selection";
}

// Compact pill row for selection-type questions — shows every available option,
// highlighting the chosen one. Wraps naturally on narrow screens.
function SelectionPills({ options, value, max }: {
  options: QuestionOption[]; value: number | null; max: number;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {options.slice().sort((a, b) => a.value - b.value).map((opt) => {
        const isActive = value !== null && opt.value === value;
        const activeColors = getScaledColor(opt.value, max);
        return (
          <span
            key={opt.value}
            style={{
              padding: "5px 11px",
              borderRadius: 99,
              fontSize: 11,
              fontWeight: isActive ? 800 : 600,
              lineHeight: 1.3,
              color: isActive ? activeColors.color : "#94a3b8",
              background: isActive ? activeColors.background : "#f1f5f9",
              border: `1.5px solid ${isActive ? `${activeColors.color}55` : "#e2e8f0"}`,
              whiteSpace: "nowrap",
            }}
          >
            {opt.label}
          </span>
        );
      })}
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
  value: number | null;
  trendStatus?: string; // for BASDAI: "red" | "green" | "yellow"
  overrideTriggered?: boolean;
  missing?: boolean;
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
    if (cur.value == null || next.value == null) continue;
    const isWorsening = next.value > cur.value;
    segments.push({
      x1: xScale(i), y1: yScale(cur.value),
      x2: xScale(i + 1), y2: yScale(next.value),
      color: isWorsening ? "#ef4444" : "#22c55e",
    });
  }

  // Override trend points — plot override events on a separate dashed series across the chart
  const overrideSeries = overrideData.length > 0
    ? overrideData.map((op) => {
      const idx = data.findIndex(d => d.dayNumber === op.dayNumber);
      if (idx === -1) return null;
      const base = data[idx];
      return {
        dayNumber: op.dayNumber,
        date: op.date,
        value: base.value,
        x: xScale(idx),
        y: yScale(op.overrideTriggered ? maxY : 0),
        triggered: op.overrideTriggered,
      };
    }).filter(Boolean) as Array<{ dayNumber: number; date: string; value: number; x: number; y: number; triggered: boolean }> : [];

  // Y-axis grid lines
  const yTicks = [0, 2, 4, 6, 8, 10].filter(t => t <= maxY);

  // X-axis labels
  const xLabels = data.map((d, i) => ({ x: xScale(i), label: fmtShort(d.date) }));

  // Day labels (D1, D2...)
  const dayLabels = data.map((d, i) => ({ x: xScale(i), label: `D${d.dayNumber}` }));

  const tooltipLeft = tooltip
    ? Math.min(Math.max(tooltip.x + 16, 8), Math.max(W - 188, 8))
    : 0;
  const tooltipTop = tooltip
    ? Math.min(Math.max(tooltip.y - 20, 8), Math.max(H - 120, 8))
    : 0;

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
        {showOverrideLine && overrideSeries.length >= 2 && (
          <polyline
            points={overrideSeries.map(pt => `${pt.x},${pt.y}`).join(" ")}
            fill="none"
            stroke="#a78bfa"
            strokeWidth={2}
            strokeDasharray="6 4"
            opacity={0.8}
          />
        )}

        {showOverrideLine && overrideSeries.map((pt, i) => (
          <g key={i}
            onMouseEnter={() => setTooltip({ x: pt.x, y: pt.y, point: { dayNumber: pt.dayNumber, date: pt.date, value: pt.value, overrideTriggered: pt.triggered } })}
            style={{ cursor: "pointer" }}
          >
            <circle cx={pt.x} cy={pt.y} r={5} fill={pt.triggered ? "#fee2e2" : "#dcfce7"} stroke="white" strokeWidth={1.5} />
            <circle cx={pt.x} cy={pt.y} r={3} fill={pt.triggered ? "#dc2626" : "#16a34a"} />
          </g>
        ))}

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
          if (d.value == null) {
            const cy = PAD.top + chartH - 10;
            return (
              <g key={i} onMouseEnter={() => setTooltip({ x: cx, y: cy, point: d })} style={{ cursor: "pointer" }}>
                <circle cx={cx} cy={cy} r={8} fill="#f8fafc" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="3 3" />
                <text x={cx} y={cy + 4} textAnchor="middle" fontSize={10} fontWeight={700} fill="#64748b" fontFamily="sans-serif">—</text>
              </g>
            );
          }
          const cy = yScale(d.value);
          const dotColor = getDotColor(d.value);
          return (
            <g key={i}
              onMouseEnter={() => setTooltip({ x: cx, y: cy, point: d })}
              style={{ cursor: "pointer" }}
            >
              {/* Outer ring */}
              <circle cx={cx} cy={cy} r={14} fill={d.overrideTriggered ? "#a78bfa22" : `${dotColor}22`} />
              <circle cx={cx} cy={cy} r={10} fill="white" stroke={dotColor} strokeWidth={2} />
              <text x={cx} y={cy + 4} textAnchor="middle" fontSize={10} fontWeight={800} fill={dotColor} fontFamily="sans-serif">{formatScore(d.value)}</text>
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
              fill={op.overrideTriggered ? "#dc2626" : "#16a34a"}
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
          left: tooltipLeft,
          top: tooltipTop,
          background: "white",
          border: "1.5px solid #e2e8f0",
          borderRadius: 12,
          padding: "10px 14px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
          pointerEvents: "none",
          zIndex: 10,
          minWidth: 130,
          maxWidth: 180,
        }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a", marginBottom: 4 }}>Day {tooltip.point.dayNumber}</div>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>{fmt(tooltip.point.date)}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            {tooltip.point.value == null ? (
              <span style={{ fontSize: 14, fontWeight: 700, color: "#64748b" }}>Not submitted</span>
            ) : (
              <>
                <span style={{ fontSize: 22, fontWeight: 800, color: getDotColor(tooltip.point.value) }}>{formatScore(tooltip.point.value)}</span>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 99,
                  background: getScoreColor(tooltip.point.value).background,
                  color: getScoreColor(tooltip.point.value).color,
                }}>
                  {tooltip.point.value < 4 ? "Low" : tooltip.point.value < 6 ? "Medium" : "High"}
                </span>
              </>
            )}
          </div>
          {tooltip.point.overrideTriggered && (
            <div style={{ fontSize: 11, color: "#7c3aed", fontWeight: 700, textTransform: "uppercase" }}>
              Override triggered
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [overrideQs, setOverrideQs] = useState<OverrideQuestion[]>([]);
  const [latestSub, setLatestSub] = useState<LatestSubmission | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [basdaiGraph, setBasdaiGraph] = useState<BasdaiPoint[]>([]);
  const [overrideGraph, setOverrideGraph] = useState<OverridePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  const [selectedQKey, setSelectedQKey] = useState<string>("");
  const [activeAlerts, setActiveAlerts] = useState<ActiveAlert[]>([]);
  const [historyAlerts, setHistoryAlerts] = useState<HistoryAlert[]>([]);
  const [reminderModalAlert, setReminderModalAlert] = useState<any>(null);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [galleryDayLabel, setGalleryDayLabel] = useState<string>("");

  const routerRef = useRef(router);
  useEffect(() => { routerRef.current = router; }, [router]);

  const [refreshing, setRefreshing] = useState(false);

  const loadAll = useCallback(async (showPageLoader = false) => {
    if (!id) return;
    if (showPageLoader) setLoading(true);
    setRefreshing(true);
    setError(null);
    const token = getToken();
    if (!token) { routerRef.current.replace("/login"); setRefreshing(false); if (showPageLoader) setLoading(false); return; }
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
      const detailJson = await detailRes.json();
      const historyJson = await historyRes.json();
      const d = detailJson?.data;
      const h = historyJson?.data;
      setPatient(d?.patient ?? null);
      setOverrideQs(d?.overrideQuestions ?? []);
      setLatestSub(d?.latestSubmission ?? null);
      setActiveAlerts(d?.activeAlerts ?? []);
      const qs = h?.questions ?? [];
      setQuestions(qs);
      if (qs.length > 0) setSelectedQKey(qs[0].question_key);
      setSubmissions(h?.submissions ?? []);
      setBasdaiGraph(h?.basdaiGraph ?? []);
      setOverrideGraph(Array.isArray(h?.overrideGraph) ? h.overrideGraph.map(transformOverridePoint) : []);
      setHistoryAlerts(h?.alerts ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      if (showPageLoader) setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    loadAll(true);
  }, [loadAll]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const rm = RISK_META[patient?.risk_category ?? "low"];
  const sm = STATUS_META[patient?.status ?? "active"] ?? STATUS_META.active;
  const tm = TREND_META[latestSub?.trend_status ?? "green"] ?? TREND_META.green;
  const prog = patient
    ? monitoringProgress(patient.monitoring_start, patient.monitoring_end, patient.monitoring_days)
    : { daysPassed: 0, pct: 0 };

  const allDayNumbers = patient ? Array.from({ length: patient.monitoring_days }, (_, i) => i + 1) : [];
  const visibleDayNumbers = useMemo(() => {
    if (!patient) return [] as number[];
    return allDayNumbers.filter(day => isSameOrBeforeToday(buildDayDate(patient.monitoring_start, day)));
  }, [patient, allDayNumbers]);
  const submissionByDay = useMemo(() => new Map(submissions.map(s => [s.day_number, s])), [submissions]);

  const submissionHistory = useMemo(() => {
    if (!patient) return [] as (Submission & { missingSubmission?: boolean })[];
    return visibleDayNumbers.map(day => {
      const existing = submissionByDay.get(day);
      if (existing) return { ...existing, missingSubmission: false };
      return {
        id: `missing-${day}`,
        day_number: day,
        answers: {},
        override_answers: {},
        disease_score: 0,
        trend_status: "",
        priority_value: 0,
        override_triggered: false,
        images: [],
        submitted_at: buildDayDate(patient.monitoring_start, day),
        missingSubmission: true,
      } as Submission & { missingSubmission: true };
    });
  }, [patient, visibleDayNumbers, submissionByDay]);

  // BASDAI chart data
  const basdaiChartData: ChartPoint[] = useMemo(() => {
    if (!patient) return [];
    const overrideMap = new Map(overrideGraph.map(op => [op.dayNumber, op.overrideTriggered]));
    const basdaiByDay = new Map(basdaiGraph.map(p => [p.dayNumber, p]));
    return visibleDayNumbers.map(day => {
      const point = basdaiByDay.get(day);
      return {
        dayNumber: day,
        date: point?.date ?? buildDayDate(patient.monitoring_start, day),
        value: point?.diseaseScore ?? null,
        trendStatus: point?.trendStatus,
        overrideTriggered: overrideMap.get(day) ?? false,
        missing: point == null,
      };
    });
  }, [patient, basdaiGraph, overrideGraph, visibleDayNumbers]);

  // Trend summary
  const basdaiTrend = useMemo(() => {
    const realPoints = basdaiChartData.filter(d => d.value != null);
    if (realPoints.length < 2) return null;
    const first = realPoints[0].value!;
    const last = realPoints[realPoints.length - 1].value!;
    const diff = last - first;
    return { diff, isDown: diff < 0 };
  }, [basdaiChartData]);

  // Question-wise data
  const selectedQuestion = questions.find(q => q.question_key === selectedQKey);
  const qChartData: ChartPoint[] = useMemo(() => {
    if (!patient) return [];
    return visibleDayNumbers.map(day => {
      const sub = submissionByDay.get(day);
      return {
        dayNumber: day,
        date: sub?.submitted_at ?? buildDayDate(patient.monitoring_start, day),
        value: sub ? (sub.answers?.[selectedQKey]?.value ?? null) : null,
        missing: !sub,
      };
    });
  }, [patient, selectedQKey, submissionByDay, visibleDayNumbers]);

  const Q_COLORS = ["#22c55e", "#378ADD", "#a855f7", "#f59e0b", "#ec4899", "#14b8a6"];

  // Sorted submissions descending, including missing-day placeholders
  const sortedSubs = useMemo(() => [...submissionHistory].sort((a, b) => b.day_number - a.day_number), [submissionHistory]);

  // Derive alert status from activeAlerts (most recent non-resolved alert)
  // GET /doctor/patients/:id returns activeAlerts[] from the real alert table
  const latestAlert = activeAlerts[0] ?? null;
  const alertStatus = latestAlert?.alert_status ?? null;
  const isTriageResolved = alertStatus === "resolved";
  const isTriageInProcess = alertStatus === "in_process";
  const isTriagePending = alertStatus === "pending";
  const hasActiveAlert = latestAlert !== null;

  // Display labels for the alert panel
  const triageLabel = isTriageResolved ? "Resolved" : isTriageInProcess ? "In Process" : isTriagePending ? "Pending" : "No Alert";
  const triagePanelBg = isTriageResolved ? "rgba(68, 219, 88, 0.2)" : isTriageInProcess ? "rgba(255, 195, 14, 0.5)" : isTriagePending ? "rgba(220, 38, 38, 0.8)" : "rgba(100, 116, 139, 0.3)";
  const triagePanelBorder = isTriageResolved ? "rgba(255,255,255,0.4)" : isTriageInProcess ? "rgba(255,253,253,0.4)" : isTriagePending ? "rgba(252,165,165,0.4)" : "rgba(255,255,255,0.2)";
  const triageIconColor = isTriageResolved ? "#6bcb77" : isTriageInProcess ? "#ffd83d" : isTriagePending ? "#fca5a5" : "#94a3b8";

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
              onClick={() => router.back()}
              style={{ padding: "10px 24px", borderRadius: 12, background: "#378ADD", color: "white", border: "none", fontWeight: 600, cursor: "pointer", fontSize: 14 }}
            >← Back</button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <Sidebar />
      <main className="main-content" style={{ paddingBottom: 48 }}>

        {/* ── Back + Refresh Buttons ── */}
        <div style={{
          position: "sticky",
          top: 10,
          zIndex: 20,
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 10,
        }}>
          <button
            onClick={() => router.back()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "rgb(55, 138, 221)",
              cursor: "pointer",
              color: "white",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              padding: "8px 12px",
              border: "2px solid #c4d3e1",
              transition: "box-shadow 0.3s ease, transform 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow =
                "0 8px 20px rgba(55, 138, 221, 0.4)";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = "none";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <ArrowLeft size={16} />
            Back
          </button>
          <button
            onClick={() => loadAll(false)}
            disabled={refreshing || loading}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "white",
              color: "rgb(55, 138, 221)",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              padding: "8px 12px",
              border: "2px solid rgba(55, 138, 221, 0.18)",
              cursor: refreshing || loading ? "not-allowed" : "pointer",
              transition: "box-shadow 0.3s ease, transform 0.2s ease, opacity 0.2s ease",
              opacity: refreshing || loading ? 1 : 1,
            }}
            onMouseEnter={(e) => {
              if (refreshing || loading) return;
              e.currentTarget.style.boxShadow = "0 8px 20px rgba(55, 138, 221, 0.16)";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = "none";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <RefreshCcw size={16} />
            {refreshing ? "Refreshing" : "Refresh"}
          </button>
        </div>

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
                background: isTriageResolved ? "rgba(107,203,119,0.25)" : isTriageInProcess ? "rgba(255,193,7,0.65)" : isTriagePending ? "rgba(220,38,38,0.25)" : "rgba(148,163,184,0.25)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                {isTriageResolved ? <CheckCircle2 size={16} color={triageIconColor} /> : isTriageInProcess ? <Activity size={16} color={triageIconColor} /> : isTriagePending ? <AlertTriangle size={16} color={triageIconColor} /> : <Info size={16} color="#94a3b8" />}
              </div>
              <div style={{ minWidth: 0, flex: "1 1 0" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,1)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 2 }}>Alert Status</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: isTriageResolved ? "#3eff57" : isTriageInProcess ? "#ffd93d" : isTriagePending ? "#fca5a5" : "rgba(255,255,255,0.6)" }}>
                  {triageLabel}
                </div>
                {latestAlert?.resolution_note && <div style={{ fontSize: 12, color: "rgba(255, 255, 255, 1)", marginTop: 1, maxWidth: "100%", overflowWrap: "break-word", wordBreak: "break-word", whiteSpace: "normal" }}>{latestAlert.resolution_note}</div>}
                {(isTriageInProcess && latestAlert?.in_process_at) && (
                  <div style={{ fontSize: 12, color: "rgba(255, 255, 255, 1)", marginTop: 6, lineHeight: 1.4 }}>
                    {`In process since · ${fmtTime(latestAlert.in_process_at!)}`}
                  </div>
                )}
                {(isTriageResolved && latestAlert?.resolved_at) && (
                  <div style={{ fontSize: 12, color: "rgba(255, 255, 255, 1)", marginTop: 6, lineHeight: 1.4 }}>
                    {`Resolved · ${fmtTime(latestAlert.resolved_at!)}`}
                    {latestAlert.resolution_category && ` · ${latestAlert.resolution_category.replace(/_/g, " ")}`}
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
              {patient.condition_type && <div style={{ marginTop: 5, fontSize: 11, color: "rgba(255,255,255,0.55)", fontWeight: 500 }}>{patient.condition_type.charAt(0).toUpperCase() + patient.condition_type.slice(1)} Patient</div>}
            </div>
            <div className="header-stat-divider" />
            <div className="header-stat-item">
              <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.8)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Latest Score</div>
              {latestSub ? (
                <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <span style={{ fontSize: 32, fontWeight: 800, color: getScoreColor(latestSub.disease_score).color, lineHeight: 1 }}>{formatScore(latestSub.disease_score)}</span>
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
                  const enrichedAnswer = latestSub
                    ? (submissions.find(s => s.day_number === latestSub.day_number)?.answers?.[q.question_key] ?? null)
                    : null;
                  const latestAnswer = enrichedAnswer != null ? enrichedAnswer.value : null;
                  const hasOptions = Array.isArray(q.question_options) && q.question_options.length > 0;
                  const isSelection = isSelectionType(q.question_type) && hasOptions;
                  const selectedLabel = isSelection && latestAnswer !== null
                    ? (q.question_options!.find(o => o.value === latestAnswer)?.label ?? enrichedAnswer?.selection_label ?? null)
                    : null;
                  const selColors = getScaledColor(latestAnswer, q.max_value);
                  return (
                    <div key={q.question_key} style={{ padding: "10px 12px", borderRadius: 12, background: "#f8fafc", border: "1px solid #f1f5f9" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: latestAnswer !== null ? 8 : 0 }}>
                        <div style={{ flex: 1, paddingRight: 10 }}>
                          <span style={{ fontSize: 10, fontWeight: 800, color: "#378ADD", textTransform: "uppercase", letterSpacing: "0.07em" }}>Q{i + 1}</span>
                          <div style={{ fontSize: 12, color: "#374151", fontWeight: 500, marginTop: 3, lineHeight: 1.3 }}>{q.question_text}</div>
                        </div>
                        {latestAnswer !== null && !isSelection && (
                          <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 8, background: latestAnswer >= 6 ? "#fee2e2" : latestAnswer >= 4 ? "#fef9c3" : "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <span style={{ fontWeight: 800, fontSize: 14, color: latestAnswer >= 6 ? "#dc2626" : latestAnswer >= 4 ? "#a16207" : "#15803d" }}>{latestAnswer}</span>
                          </div>
                        )}
                        {isSelection && selectedLabel && (
                          <div style={{ flexShrink: 0, maxWidth: 130, padding: "5px 10px", borderRadius: 8, background: selColors.background, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <span style={{ fontWeight: 800, fontSize: 11, color: selColors.color, textAlign: "right", lineHeight: 1.3 }}>{selectedLabel}</span>
                          </div>
                        )}
                      </div>
                      {latestAnswer !== null && !isSelection && <ScoreBar value={latestAnswer} max={q.max_value} />}
                      {isSelection && latestAnswer !== null && (
                        <SelectionPills options={q.question_options!} value={latestAnswer} max={q.max_value} />
                      )}
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
                  const triggered = latestOverrideEntry
                    ? latestOverrideEntry.overrideAnswers[q.question_key]?.triggered === true
                    : null;
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
                          const val = og.overrideAnswers[q.question_key]?.triggered;
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
                  <div style={{
    width: 28,
    borderTop: "3px dotted #a78bfa",
  }} />
                  <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>Override graph</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#dc2626" }} />
                  <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>Override: Yes</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#16a34a" }} />
                  <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>Override: No</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", border: "1.5px dashed #94a3b8", background: "#f8fafc" }} />
                  <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>Missing day</span>
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
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", border: "1.5px dashed #94a3b8", background: "#f8fafc" }} />
                  <span style={{ fontSize: 12, color: "#64748b" }}>Missing day</span>
                </div>
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
                const isMissing = (sub as any).status === "missed" || (sub as any).missingSubmission === true;
                const hasOverride = !isMissing && sub.override_triggered === true;
                const imgCount = (!isMissing && sub.images?.length) ? sub.images.length : 0;
                const scoreColor = isMissing ? { color: "#94a3b8", background: "#f1f5f9" } : getScoreColor(sub.disease_score);
                const scoreLevel = isMissing ? "—" : sub.disease_score < 4 ? "Low" : sub.disease_score < 6 ? "Medium" : "High";

                return (
                  <div
                    key={sub.id ?? `missing-${sub.day_number}`}
                    style={{
                      borderRadius: 16,
                      border: `1.5px solid ${isOpen ? "#378ADD44" : "#f1f5f9"}`,
                      overflow: "hidden",
                      transition: "border-color 0.2s, box-shadow 0.2s",
                      boxShadow: isOpen ? "0 4px 20px rgba(55,138,221,0.10)" : "none",
                    }}
                  >
                    {/* ── Accordion Header ── */}
                    <button
                      onClick={() => setExpandedDay(isOpen ? null : sub.day_number)}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "14px 16px",
                        background: isOpen ? "#f0f7ff" : "#f8fafc",
                        border: "none",
                        cursor: "pointer",
                        transition: "background 0.15s",
                        gap: 10,
                        textAlign: "left",
                        flexWrap: "wrap",
                      }}
                    >
                      {/* Left: Day label + badges */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", flex: "1 1 0", minWidth: 0 }}>
                        {/* Day badge */}
                        <div style={{
                          flexShrink: 0,
                          width: 42, height: 42, borderRadius: 12,
                          background: isOpen ? "#378ADD" : (isMissing ? "#e2e8f0" : "#1e293b"),
                          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                          gap: 0,
                        }}>
                          <span style={{ fontSize: 8, fontWeight: 700, color: isOpen ? "#bfdbfe" : (isMissing ? "#94a3b8" : "#94a3b8"), letterSpacing: "0.06em", textTransform: "uppercase", lineHeight: 1 }}>DAY</span>
                          <span className="heading-font" style={{ fontSize: 18, fontWeight: 900, color: isOpen ? "white" : (isMissing ? "#64748b" : "white"), lineHeight: 1 }}>{sub.day_number}</span>
                        </div>

                        {/* Date + status chips */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, flex: "1 1 auto" }}>
                          {!isMissing && (
                            <span style={{ fontSize: 11, color: "#64748b", fontWeight: 500, whiteSpace: "normal" }}>{fmtTime(sub.submitted_at)}</span>
                          )}
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            {isMissing ? (
                              <span style={{ padding: "2px 9px", borderRadius: 99, fontSize: 11, fontWeight: 700, background: "#f1f5f9", color: "#64748b", border: "1px solid #e2e8f0" }}>Not submitted</span>
                            ) : (
                              <>
                                {hasOverride && (
                                  <span style={{ padding: "2px 9px", borderRadius: 99, fontSize: 11, fontWeight: 700, background: "#fee2e2", color: "#dc2626", border: "1px solid #fca5a5" }}>🚨 Override</span>
                                )}
                                {imgCount > 0 && (
                                  <span style={{ padding: "2px 9px", borderRadius: 99, fontSize: 11, fontWeight: 600, background: "#f0f9ff", color: "#0369a1", border: "1px solid #bae6fd" }}>
                                    📷 {imgCount} {imgCount === 1 ? "photo" : "photos"}
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Score + priority chips + chevron */}
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        gap: 10,
                        flexWrap: "wrap",
                        minWidth: 0,
                        maxWidth: "100%",
                      }}>
                        {!isMissing && (
                          <>
                            <div style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 4,
                              minWidth: 0,
                              background: scoreColor.background,
                              border: `1px solid ${scoreColor.color}33`,
                              padding: "10px 12px",
                              borderRadius: 14,
                            }}>
                              <span style={{ fontSize: 9, fontWeight: 700, color: scoreColor.color, textTransform: "uppercase", letterSpacing: "0.06em" }}>Score</span>
                              <div className="heading-font" style={{ fontSize: 17, fontWeight: 900, color: scoreColor.color, lineHeight: 1.1 }}>{formatScore(sub.disease_score)}</div>
                            </div>
                            <div style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 4,
                              minWidth: 0,
                              background: sub.priority_value >= 8 ? "#f5dbff" : sub.priority_value >= 5 ? "#ede9fe" : "#f8f3ff",
                              border: `1px solid ${sub.priority_value >= 8 ? "#c084fc" : sub.priority_value >= 5 ? "#a855f7" : "#c084fc"}33`,
                              padding: "10px 12px",
                              borderRadius: 14,
                            }}>
                              <span style={{ fontSize: 9, fontWeight: 700, color: sub.priority_value >= 8 ? "#9333ea" : sub.priority_value >= 5 ? "#7c3aed" : "#a855f7", textTransform: "uppercase", letterSpacing: "0.06em" }}>Priority</span>
                              <div className="heading-font" style={{ fontSize: 17, fontWeight: 900, color: sub.priority_value >= 8 ? "#9333ea" : sub.priority_value >= 5 ? "#7c3aed" : "#a855f7", lineHeight: 1.1 }}>{sub.priority_value}</div>
                            </div>
                          </>
                        )}
                        <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {isOpen
                            ? <ChevronUp size={16} color="#94a3b8" />
                            : <ChevronDown size={16} color="#94a3b8" />}
                        </div>
                      </div>
                    </button>

                    {/* ── Expanded Body ── */}
                    {isOpen && (
                      <div style={{ borderTop: "1px solid #f1f5f9", background: "white" }}>
                        {isMissing ? (
                          <div style={{ padding: "20px", fontSize: 13, color: "#475569", lineHeight: 1.7 }}>
                            No submission was recorded for this day. The patient did not submit their daily report.
                          </div>
                        ) : (
                          <>
                            {/* ── Symptom Answers ── */}
                            {sub.answers && Object.keys(sub.answers).length > 0 && (
                              <div style={{ padding: "0 16px 16px" }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>Symptom Answers</div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                  {Object.entries(sub.answers)
                                    .sort(([, a], [, b]) => (a.display_order ?? 999) - (b.display_order ?? 999))
                                    .map(([key, ans], i) => {
                                      const qColor = Q_COLORS[i % Q_COLORS.length];
                                      const hasOptions = Array.isArray(ans.question_options) && ans.question_options.length > 0;
                                      const isSelection = isSelectionType(ans.question_type) && hasOptions;
                                      const valColor = ans.value >= 6 ? "#dc2626" : ans.value >= 4 ? "#a16207" : "#15803d";
                                      const valBg = ans.value >= 6 ? "#fee2e2" : ans.value >= 4 ? "#fef9c3" : "#dcfce7";
                                      const selColors = getScaledColor(ans.value, ans.max_value);
                                      const selectedLabel = isSelection
                                        ? (ans.question_options!.find(o => o.value === ans.value)?.label ?? ans.selection_label ?? null)
                                        : null;
                                      return (
                                        <div key={key} style={{ borderRadius: 12, background: "#f8fafc", border: "1px solid #f1f5f9", overflow: "hidden" }}>
                                          <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
                                            {/* Q# badge */}
                                            <div style={{ width: 36, flexShrink: 0, alignSelf: "stretch", background: `${qColor}18`, display: "flex", alignItems: "center", justifyContent: "center", borderRight: `2px solid ${qColor}33` }}>
                                              <span style={{ fontSize: 10, fontWeight: 900, color: qColor, textTransform: "uppercase", letterSpacing: "0.05em" }}>Q{i + 1}</span>
                                            </div>
                                            <div style={{ flex: 1, padding: "10px 12px", minWidth: 0 }}>
                                              <div style={{ fontSize: 12, color: "#374151", fontWeight: 500, lineHeight: 1.4, marginBottom: 8 }}>{ans.question_text}</div>
                                              {isSelection ? (
                                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                                  {selectedLabel && (
                                                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                                                      {/* <span style={{
                                                        maxWidth: "100%", padding: "4px 10px", borderRadius: 8,
                                                        background: selColors.background, border: `1px solid ${selColors.color}33`,
                                                        fontWeight: 800, fontSize: 12, color: selColors.color,
                                                      }}>
                                                        {selectedLabel}
                                                      </span> */}
                                                    </div>
                                                  )}
                                                  <SelectionPills options={ans.question_options!} value={ans.value} max={ans.max_value} />
                                                  
                                                </div>
                                              ) : (
                                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                                  <div style={{ flex: 1, height: 6, borderRadius: 99, background: "#e2e8f0", overflow: "hidden" }}>
                                                    <div style={{ width: `${Math.min(100, (ans.value / (ans.max_value || 10)) * 100)}%`, height: "100%", borderRadius: 99, background: valColor, transition: "width 0.6s ease" }} />
                                                  </div>
                                                  <div style={{ flexShrink: 0, minWidth: 40, height: 32, borderRadius: 8, background: valBg, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${valColor}33` }}>
                                                    <span style={{ fontWeight: 900, fontSize: 14, color: valColor }}>{ans.value}</span>
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                </div>
                              </div>
                            )}

                            {/* ── Override Alerts + Wound Images row ── */}
                            {((sub.override_answers && Object.keys(sub.override_answers).length > 0) || imgCount > 0) && (
                              <div className="history-bottom-row">

                                {/* Override Alerts */}
                                {sub.override_answers && Object.keys(sub.override_answers).length > 0 && (
                                  <div className="history-override-col">
                                    <div style={{ fontSize: 11, fontWeight: 700, color: "#dc2626", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                                      <AlertTriangle size={13} color="#dc2626" />
                                      Override Alerts
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                                      {Object.entries(sub.override_answers)
                                        .sort(([, a], [, b]) => (a.display_order ?? 999) - (b.display_order ?? 999))
                                        .map(([key, ans]) => (
                                          <div key={key} style={{
                                            padding: "10px 12px", borderRadius: 10,
                                            background: ans.triggered ? "#fef2f2" : "#f0fdf4",
                                            border: `1px solid ${ans.triggered ? "#fca5a5" : "#86efac"}`,
                                            display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                                            gap: 10,
                                          }}>
                                            <span style={{ color: "#374151", fontSize: 12, flex: 1, lineHeight: 1.4 }}>{ans.question_text}</span>
                                            <span style={{
                                              flexShrink: 0, fontWeight: 700, fontSize: 11,
                                              padding: "3px 9px", borderRadius: 99,
                                              background: ans.triggered ? "#dc2626" : "#15803d",
                                              color: "white",
                                            }}>
                                              {ans.triggered ? "🚨 Yes" : "✓ No"}
                                            </span>
                                          </div>
                                        ))}
                                    </div>
                                  </div>
                                )}

                                {/* Wound Images */}
                                {imgCount > 0 && (
                                  <div className="history-images-col">
                                    <div style={{ fontSize: 11, fontWeight: 700, color: "#0369a1", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                                      <FileText size={13} color="#0369a1" />
                                      Wound Photos ({imgCount})
                                    </div>
                                    {/* Thumbnail grid — max 5 */}
                                    <div className="history-image-grid">
                                      {sub.images.slice(0, 5).map((img, idx) => {
                                        const isLast = idx === 4 && imgCount > 5;
                                        return (
                                          <button
                                            key={idx}
                                            type="button"
                                            onClick={() => {
                                              setGalleryImages(sub.images.map(getImageUrl));
                                              setGalleryIndex(idx);
                                              setGalleryDayLabel(`Day ${sub.day_number}`);
                                            }}
                                            style={{
                                              position: "relative",
                                              aspectRatio: "1 / 1",
                                              borderRadius: 12,
                                              overflow: "hidden",
                                              border: "1.5px solid #e2e8f0",
                                              background: "#f8fafc",
                                              cursor: "pointer",
                                              padding: 0,
                                              transition: "transform 0.15s, box-shadow 0.15s",
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.04)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.18)"; }}
                                            onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "none"; }}
                                          >
                                            <img
                                              src={getImageUrl(img)}
                                              alt={`Wound photo ${idx + 1} – Day ${sub.day_number}`}
                                              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                                            />
                                            {/* "View all" overlay on last thumbnail when > 5 images */}
                                            {isLast && (
                                              <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                <span style={{ color: "white", fontWeight: 800, fontSize: 14 }}>+{imgCount - 5}</span>
                                              </div>
                                            )}
                                            {/* Index dot */}
                                            {!isLast && (
                                              <div style={{ position: "absolute", bottom: 5, right: 5, background: "rgba(0,0,0,0.45)", borderRadius: 6, padding: "2px 6px", fontSize: 9, fontWeight: 700, color: "white" }}>
                                                {idx + 1}/{imgCount}
                                              </div>
                                            )}
                                          </button>
                                        );
                                      })}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setGalleryImages(sub.images.map(getImageUrl));
                                        setGalleryIndex(0);
                                        setGalleryDayLabel(`Day ${sub.day_number}`);
                                      }}
                                      style={{
                                        marginTop: 10, width: "100%",
                                        padding: "8px 0", borderRadius: 10,
                                        border: "1.5px solid #bae6fd",
                                        background: "#f0f9ff", color: "#0369a1",
                                        fontSize: 12, fontWeight: 700, cursor: "pointer",
                                        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                                        transition: "background 0.15s",
                                      }}
                                      onMouseEnter={e => { e.currentTarget.style.background = "#e0f2fe"; }}
                                      onMouseLeave={e => { e.currentTarget.style.background = "#f0f9ff"; }}
                                    >
                                      <ChevronRight size={14} />
                                      View all {imgCount} photos
                                    </button>
                                  </div>
                                )}

                              </div>
                            )}
                          </>
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
                SECTION 6 — ALERT HISTORY
            ══════════════════════════════════════════════════════════════ */}

            {/* ── Image Gallery Modal ── */}
            {galleryImages.length > 0 && (
              <div
                onClick={() => setGalleryImages([])}
                style={{
                  position: "fixed", inset: 0, background: "rgba(255, 255, 255, 0.56)",backdropFilter: "blur(2px)",
                  display: "flex", alignItems: "stretch", justifyContent: "center",
                  zIndex: 500, padding: 0,
                }}
              >
                <div
                  onClick={e => e.stopPropagation()}
                  style={{
                    width: "100%", maxWidth: 1000,
                    display: "flex", flexDirection: "column",
                    margin: "auto",
                    height: "1000px",
                    maxHeight: "75vh", borderRadius: 20, overflow: "hidden",
                  }}
                >
                  {/* Top bar */}
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "12px 16px",
                    background: "rgba(0, 0, 0, 0.7)",
                    backdropFilter: "blur(10px)",
                    flexShrink: 0, gap: 12,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(245, 245, 245, 0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <FileText size={15} color="white" />
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "white" }}>{galleryDayLabel} — Wound Photos</div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 1 }}>Photo {galleryIndex + 1} of {galleryImages.length}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => setGalleryImages([])}
                      style={{
                        width: 36, height: 36, borderRadius: 10,
                        border: "1px solid rgba(255,255,255,0.2)",
                        background: "rgba(255,255,255,0.1)", cursor: "pointer", color: "white",
                        fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0, transition: "background 0.15s",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.22)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}
                      aria-label="Close gallery"
                    >✕</button>
                  </div>

                  {/* Main image area */}
                  <div style={{ flex: 1, minHeight: 0, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", background: "#090e18" }}>
                    <img
                      key={galleryImages[galleryIndex]}
                      src={galleryImages[galleryIndex]}
                      alt={`${galleryDayLabel} wound photo ${galleryIndex + 1}`}
                      style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", display: "block", userSelect: "none" }}
                    />
                    {/* Prev */}
                    {galleryImages.length > 1 && (
                      <button
                        onClick={() => setGalleryIndex(i => (i - 1 + galleryImages.length) % galleryImages.length)}
                        style={{
                          position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
                          width: 44, height: 44, borderRadius: 12,
                          background: "rgba(255,255,255,0.12)", backdropFilter: "blur(8px)",
                          border: "1px solid rgba(255,255,255,0.2)", cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          transition: "background 0.15s", zIndex: 10,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.25)"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; }}
                        aria-label="Previous photo"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                      </button>
                    )}
                    {/* Next */}
                    {galleryImages.length > 1 && (
                      <button
                        onClick={() => setGalleryIndex(i => (i + 1) % galleryImages.length)}
                        style={{
                          position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                          width: 44, height: 44, borderRadius: 12,
                          background: "rgba(255,255,255,0.12)", backdropFilter: "blur(8px)",
                          border: "1px solid rgba(255,255,255,0.2)", cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          transition: "background 0.15s", zIndex: 10,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.25)"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; }}
                        aria-label="Next photo"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                      </button>
                    )}
                  </div>

                  {/* Thumbnail strip */}
                  {galleryImages.length > 1 && (
                    <div style={{
                      flexShrink: 0, padding: "10px 16px",
                      borderTop: "1px solid rgba(255,255,255,0.08)",
                      background: "rgba(0, 0, 0, 0.7)", backdropFilter: "blur(8px)",
                      display: "flex", gap: 8,
                      justifyContent: galleryImages.length <= 5 ? "center" : "flex-start",
                      overflowX: "auto",
                    }}>
                      {galleryImages.map((img, idx) => (
                        <button
                          key={idx}
                          onClick={() => setGalleryIndex(idx)}
                          style={{
                            flexShrink: 0, width: 56, height: 56, borderRadius: 10, overflow: "hidden",
                            border: `2.5px solid ${idx === galleryIndex ? "#378ADD" : "rgba(255,255,255,0.18)"}`,
                            cursor: "pointer", padding: 0, background: "rgba(0,0,0,0.3)",
                            opacity: idx === galleryIndex ? 1 : 0.55,
                            transform: idx === galleryIndex ? "scale(1.1)" : "scale(1)",
                            transition: "opacity 0.15s, border-color 0.15s, transform 0.15s",
                          }}
                          onMouseEnter={e => { if (idx !== galleryIndex) e.currentTarget.style.opacity = "0.8"; }}
                          onMouseLeave={e => { if (idx !== galleryIndex) e.currentTarget.style.opacity = "0.55"; }}
                          aria-label={`View photo ${idx + 1}`}
                        >
                          <img src={img} alt={`Thumbnail ${idx + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Dot indicators */}
                  {galleryImages.length > 1 && (
                    <div style={{ display: "flex", justifyContent: "center", gap: 6, padding: "8px 16px 12px", background: "rgba(0,0,0,0.7)", flexShrink: 0 }}>
                      {galleryImages.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={() => setGalleryIndex(idx)}
                          style={{
                            width: idx === galleryIndex ? 22 : 7, height: 7, borderRadius: 99,
                            background: idx === galleryIndex ? "#378ADD" : "rgba(255,255,255,0.3)",
                            border: "none", cursor: "pointer", padding: 0,
                            transition: "width 0.25s, background 0.25s",
                          }}
                          aria-label={`Go to photo ${idx + 1}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            {reminderModalAlert && (
              <div
                onClick={() => setReminderModalAlert(null)}
                style={{
                  position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  zIndex: 400, padding: 16,
                }}
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    background: "white", borderRadius: 16, width: "100%", maxWidth: 480,
                    maxHeight: "88vh", display: "flex", flexDirection: "column",
                    overflow: "hidden", border: "1px solid #e2e8f0",
                    boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
                  }}
                >
                  {/* Modal header */}
                  <div style={{
                    padding: "16px 20px", borderBottom: "1px solid #f1f5f9",
                    display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexShrink: 0,
                  }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99,
                          background: reminderModalAlert.alert_type === "red" ? "#fee2e2" : "#fef9c3",
                          color: reminderModalAlert.alert_type === "red" ? "#dc2626" : "#a16207",
                        }}>
                          {reminderModalAlert.alert_type === "red" ? "Red alert" : "Yellow alert"}
                          {reminderModalAlert.submission_day_number != null ? ` · Day ${reminderModalAlert.submission_day_number}` : ""}
                        </span>
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>Reminder details</div>
                    </div>
                    <button
                      onClick={() => setReminderModalAlert(null)}
                      style={{
                        width: 30, height: 30, borderRadius: 8, border: "1px solid #e2e8f0",
                        background: "transparent", cursor: "pointer", display: "flex",
                        alignItems: "center", justifyContent: "center", flexShrink: 0,
                        color: "#64748b", fontSize: 16,
                      }}
                    >✕</button>
                  </div>

                  {/* Modal meta grid */}
                  <div style={{
                    padding: "14px 20px", borderBottom: "1px solid #f1f5f9",
                    display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, flexShrink: 0,
                  }}>
                    {[
                      { label: "Alert triggered", value: fmtTime(pickAlertIso(reminderModalAlert, "created_at")) ? `${fmt(pickAlertIso(reminderModalAlert, "created_at"))}, ${fmtTime(pickAlertIso(reminderModalAlert, "created_at"))}` : "—" },
                      {
                        label: "In process by",
                        value: reminderModalAlert.in_process_by_name
                          ? `${reminderModalAlert.in_process_by_name} · ${fmtTime(pickAlertIso(reminderModalAlert, "in_process_at"))}`
                          : "—",
                      },
                      ...(reminderModalAlert.escalated_at_ist || reminderModalAlert.escalated_at
                        ? [{ label: "Escalated at", value: fmtTime(reminderModalAlert.escalated_at_ist || reminderModalAlert.escalated_at) }]
                        : []),
                      {
                        label: "Resolved by",
                        value: reminderModalAlert.resolved_by_name
                          ? `${reminderModalAlert.resolved_by_name} · ${fmtTime(pickAlertIso(reminderModalAlert, "resolved_at"))}`
                          : "—",
                      },
                      {
                        label: "Resolution category",
                        value: reminderModalAlert.resolution_category
                          ? reminderModalAlert.resolution_category.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
                          : "—",
                      },
                      { label: "Total reminders", value: String((reminderModalAlert.reminder_details ?? []).length) },
                    ].map((item) => (
                      <div key={item.label}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>{item.label}</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a" }}>{item.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Timeline */}
                  <div style={{ padding: "14px 20px", overflowY: "auto", flex: 1 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>
                      Notification timeline
                    </div>
                    {(reminderModalAlert.reminder_details ?? []).map((r: any, i: number, arr: any[]) => {
                      const isFirst = i === 0;
                      const isLast = i === arr.length - 1;
                      const isEscalation = r.type === "alert_escalation";
                      const dotCol = isEscalation ? "#9333ea" : isFirst ? "#dc2626" : "#f59e0b";
                      const actionText = isFirst && !isEscalation ? "Alert sent via WhatsApp"
                        : isEscalation ? "Escalation sent via WhatsApp"
                        : "Reminder sent via WhatsApp";
                      const chipStyle = r.sent_to_role === "doctor"
                        ? { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" }
                        : r.sent_to_role === "escalation"
                        ? { bg: "#fdf2f8", color: "#9333ea", border: "#e9d5ff" }
                        : { bg: "#f0fdf4", color: "#166534", border: "#bbf7d0" };
                      const roleLabel = r.sent_to_role.charAt(0).toUpperCase() + r.sent_to_role.slice(1);
                      const phoneFormatted = r.sent_to_phone ? `+91 ${r.sent_to_phone.slice(0,5)} ${r.sent_to_phone.slice(5)}` : "";
                      return (
                        <div key={i} style={{ display: "flex", gap: 12, marginBottom: isLast ? 0 : 14 }}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, width: 12 }}>
                            <div style={{ width: 10, height: 10, borderRadius: "50%", background: dotCol, flexShrink: 0, marginTop: 3 }} />
                            {!isLast && <div style={{ width: 1, flex: 1, background: "#e2e8f0", marginTop: 3 }} />}
                          </div>
                          <div style={{ flex: 1, minWidth: 0, paddingBottom: isLast ? 0 : 2 }}>
                            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 2 }}>{fmtTime(r.sent_at)}</div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", marginBottom: 5 }}>{actionText}</div>
                            <span style={{
                              display: "inline-flex", alignItems: "center", gap: 5,
                              fontSize: 11, padding: "2px 8px", borderRadius: 99,
                              background: chipStyle.bg, color: chipStyle.color, border: `1px solid ${chipStyle.border}`,
                            }}>
                              {roleLabel}{phoneFormatted ? ` · ${phoneFormatted}` : ""}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            <SectionCard title="Alert History" icon={AlertTriangle} accent="#dc2626">
              {historyAlerts.length === 0 ? (
                <div style={{ textAlign: "center", padding: "32px 0", color: "#94a3b8", fontSize: 14 }}>No alerts recorded for this patient.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {historyAlerts.map((alert) => {
                    const isResolved = alert.alert_status === "resolved";
                    const isInProcess = alert.alert_status === "in_process";
                    const alertColor = alert.alert_type === "red" ? "#dc2626" : "#a16207";
                    const alertBg = alert.alert_type === "red" ? "#fee2e2" : "#fef9c3";
                    const statusColor = isResolved ? "#15803d" : isInProcess ? "#a16207" : "#dc2626";
                    const statusBg = isResolved ? "#dcfce7" : isInProcess ? "#fef9c3" : "#fee2e2";
                    const statusLabel = isResolved ? "Resolved" : isInProcess ? "In process" : "Pending";
                    const createdIso = pickAlertIso(alert, "created_at");
                    const inProcessIso = pickAlertIso(alert, "in_process_at");
                    const resolvedIso = pickAlertIso(alert, "resolved_at");
                    const escalatedIso = (alert as any).escalated_at_ist || alert.escalated_at || null;
                    const latestReminderEntry = (alert as any).reminder_details?.length
                      ? [...((alert as any).reminder_details as any[])].sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())[0]
                      : null;

                    const cardBorder = isResolved ? "#86efac" : isInProcess ? "#fde68a" : "#fca5a5";
                    const cardBg = isResolved ? "#f0fdf4" : isInProcess ? "#fffbeb" : "#fef2f2";

                    return (
                      <div key={alert.id} style={{ borderRadius: 14, border: `1px solid ${cardBorder}`, background: cardBg, overflow: "hidden" }}>
                        {/* Top row */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", flexWrap: "wrap" }}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99, background: alertBg, color: alertColor, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            {alert.alert_type === "red" ? "Red alert" : "Yellow alert"}
                          </span>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99, background: statusBg, color: statusColor }}>
                            {statusLabel}
                          </span>
                          {alert.submission_day_number != null && (
                            <span style={{ fontSize: 11, color: "#64748b", fontWeight: 500, padding: "3px 8px", borderRadius: 99, background: "rgba(255,255,255,0.6)", border: "1px solid #e2e8f0" }}>
                              Day {alert.submission_day_number}
                            </span>
                          )}
                          {alert.escalated && (
                            <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99, background: "#fdf2f8", color: "#9333ea" }}>
                              ⚡ Escalated
                            </span>
                          )}
                          <span style={{ marginLeft: "auto", fontSize: 11, color: "#64748b", whiteSpace: "nowrap" }}>{fmtTime(createdIso)}</span>
                        </div>

                        {/* Info grid */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 8, padding: "0 16px 12px" }}>
                          {inProcessIso && (
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>In process at</div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>{fmtTime(inProcessIso)}</div>
                            </div>
                          )}
                          {alert.in_process_by_name && (
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>In process by</div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>{alert.in_process_by_name}</div>
                            </div>
                          )}
                          {resolvedIso && (
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Resolved at</div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>{fmtTime(resolvedIso)}</div>
                            </div>
                          )}
                          {alert.resolved_by_name && (
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Resolved by</div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>{alert.resolved_by_name}</div>
                            </div>
                          )}
                          {escalatedIso && (
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Escalated at</div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>{fmtTime(escalatedIso)}</div>
                            </div>
                          )}
                          {alert.resolution_category && (
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Resolution category</div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>
                                {alert.resolution_category.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Resolution note */}
                        {alert.resolution_note && (
                          <div style={{ padding: "10px 16px 14px", borderTop: `0px solid ${cardBorder}`,background: "rgb(255, 255, 255)" }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Resolution note</div>
                            <div style={{ fontSize: 12, color: "#334155", lineHeight: 1.6 }}>{alert.resolution_note}</div>
                          </div>
                        )}
                        {/* Reminder row */}
                        <div style={{ padding: "10px 16px", borderTop: `1px solid ${cardBorder}`, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", background: "rgba(255,255,255,0.4)" }}>
                          <div style={{
                            display: "flex", alignItems: "center", gap: 8,
                            padding: "5px 12px", borderRadius: 8,
                            background: "rgba(255,255,255,0.7)", border: "1px solid #e2e8f0",
                            fontSize: 12, color: "#475569",
                          }}>
                            <AlertCircle size={13} color="#94a3b8" />
                            <span><strong style={{ color: "#0f172a", fontWeight: 700 }}>{alert.reminder_count ?? 0}</strong> reminders</span>
                            {latestReminderEntry && (
                              <span style={{ color: "#94a3b8", fontSize: 11 }}>
                                · Last: {fmt(latestReminderEntry.sent_at)}, {fmtTime(latestReminderEntry.sent_at)}
                              </span>
                            )}
                          </div>
                          {(alert as any).reminder_details?.length > 0 && (
                            <button
                              onClick={() => setReminderModalAlert(alert as any)}
                              style={{
                                display: "inline-flex", alignItems: "center", gap: 6,
                                padding: "5px 14px", borderRadius: 8,
                                border: "1px solid #e2e8f0", background: "rgba(255,255,255,0.8)",
                                fontSize: 12, fontWeight: 600, color: "#378ADD", cursor: "pointer",
                                transition: "all 0.15s",
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = "#f0f7ff"; e.currentTarget.style.borderColor = "#378ADD"; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.8)"; e.currentTarget.style.borderColor = "#e2e8f0"; }}
                            >
                              <List size={13} />
                              Reminder details
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>

        {/* ══════════════════════════════════════════════════════════════
            SECTION 7 — PERSONAL INFORMATION
        ══════════════════════════════════════════════════════════════ */}
        <SectionCard title="Personal Information" icon={User} accent="#1D9E75">
          <div className="personal-info-grid">
            {[
              { label: "Full Name", value: patient.name ?? "—" },
              { label: "Patient ID", value: patient.readable_id ?? "—" },
              { label: "Age", value: patient.age ? `${patient.age} years` : "—" },
              { label: "Gender", value: patient.gender ? (patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1)) : "—" },
              { label: "Phone", value: patient.phone ?? "—" },
              { label: "Relative's Phone", value: patient.relative_phone ?? "—" },
              { label: "State", value: patient.state ?? "—" },
              { label: "District", value: patient.district ?? "—" },
              { label: "Address", value: patient.address_line ?? "—" },
              { label: "Department", value: patient.department_name ?? "—" },
              { label: "Diagnosis", value: patient.diagnosis ?? "—" },
              { label: "Condition Type", value: patient.condition_type ? (patient.condition_type.charAt(0).toUpperCase() + patient.condition_type.slice(1)) : "—" },
              { label: "Risk Category", value: patient.risk_category ? rm.label : "—" },
              { label: "Consent Given", value: patient.consent_given ? "Yes" : "No" },
              { label: "Monitoring Days", value: patient.monitoring_days ? `${patient.monitoring_days} days` : "—" },
              { label: "Monitoring Start", value: fmt(patient.monitoring_start) },
              { label: "Monitoring End", value: fmt(patient.monitoring_end) },
              { label: "Registered On", value: fmtTime(patient.created_at) },
              { label: "First Login", value: fmtTime(patient.first_login_at) },
              { label: "Last Submission", value: fmtTime(patient.last_submission_at) },
              { label: "Registered By", value: patient.basic_registered_by_name ?? "—" },
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

          /* ── Previous Day History layout classes ── */
          .history-score-row {
            display: grid;
            grid-template-columns: 1fr;
            gap: 12px;
            padding: 16px 16px 0;
            margin-bottom: 16px;
          }
          .history-score-card {
            border-radius: 14px;
            padding: 14px 16px;
          }
          .history-bottom-row {
            display: flex;
            flex-direction: column;
            gap: 16px;
            padding: 0 16px 16px;
          }
          .history-override-col { flex: 1; min-width: 0; }
          .history-images-col { flex: 1; min-width: 0; }
          .history-image-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
          }

          .history-header-score-group {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 8px;
            flex-wrap: wrap;
            min-width: 0;
          }
          .history-header-chip {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            justify-content: center;
            gap: 4px;
            padding: 8px 12px;
            border-radius: 12px;
            min-width: 0;
            max-width: 140px;
            white-space: nowrap;
          }
          .history-header-chip .heading-font {
            font-size: 17px !important;
          }

          @media (max-width: 640px) {
            .history-header-score-group {
              width: 100%;
              justify-content: flex-end;
            }
            .history-header-chip {
              flex: 1 1 120px;
              min-width: 0;
            }
          }

          @media (min-width: 641px) {
            .history-header-score-group {
              justify-content: flex-end;
            }
          }

          .history-image-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
          }

          @media (min-width: 480px) {
            .history-image-grid {
              grid-template-columns: repeat(5, 1fr);
            }
          }

          @media (min-width: 640px) {
            .history-score-row {
              grid-template-columns: 1fr 1fr;
              gap: 14px;
            }
            .history-bottom-row {
              flex-direction: row;
              align-items: flex-start;
            }
          }

          @media (min-width: 1024px) {
            .history-score-row {
              grid-template-columns: 1fr 1fr;
              padding: 20px 20px 0;
              margin-bottom: 20px;
            }
            .history-bottom-row {
              padding: 0 20px 20px;
            }
          }

          .history-score-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 10px;
          }
          .history-answers-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 8px;
          }
          .history-images-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
          }

          @media (min-width: 480px) {
            .history-images-grid {
              grid-template-columns: repeat(5, 1fr);
            }
          }
          @media (min-width: 640px) {
            .history-score-grid {
              grid-template-columns: 1fr 1fr;
              gap: 12px;
            }
            .history-answers-grid {
              grid-template-columns: repeat(2, 1fr);
              gap: 10px;
            }
          }
          @media (min-width: 1024px) {
            .history-answers-grid {
              grid-template-columns: repeat(3, 1fr);
            }
          }

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