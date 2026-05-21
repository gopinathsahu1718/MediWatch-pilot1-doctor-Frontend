"use client";
import { use } from "react";
import Sidebar from "@/components/Sidebar";
import { DUMMY_PATIENTS } from "@/lib/dummyData";
import { useRouter } from "next/navigation";
import { AlertCircle, BarChart3, User, Stethoscope, MapPin, Phone, Calendar, Activity, TrendingUp, TrendingDown, Minus } from "lucide-react";

export default function PatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const patient = DUMMY_PATIENTS.find(p => p.id === id);

  if (!patient) {
    return (
      <div className="page-shell">
        <Sidebar />
        <main className="main-content" style={{ padding: 32, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center" }}>
            <AlertCircle size={64} style={{ color: "#dc2626", margin: "0 auto 16px" }} />
            <h2 className="heading-font" style={{ fontSize: 24, color: "#0f172a" }}>Patient Not Found</h2>
            <button className="btn-primary" onClick={() => router.push("/patients")} style={{ marginTop: 16 }}>← Back to Patients</button>
          </div>
        </main>
      </div>
    );
  }

  const riskColor  = patient.risk === "High" ? "#dc2626" : patient.risk === "Medium" ? "#d97706" : "#15803d";
  const riskBg     = patient.risk === "High" ? "#fef2f2" : patient.risk === "Medium" ? "#fefce8" : "#f0fdf4";
  const statusColor = patient.status === "Active" ? "#15803d" : patient.status === "Completed" ? "#1d4ed8" : "#a16207";
  const statusBg    = patient.status === "Active" ? "#f0fdf4"  : patient.status === "Completed" ? "#eff6ff"  : "#fef9c3";

  const completionPct = Math.round((patient.submissions.length / patient.monitoringDays) * 100);

  const avgPain = patient.submissions.length
    ? (patient.submissions.reduce((a, s) => a + s.painScore, 0) / patient.submissions.length).toFixed(1)
    : "—";

  const latestSubmission = patient.submissions[patient.submissions.length - 1];

  return (
    <div className="page-shell">
      <Sidebar />
      <main className="main-content pd-main">

        {/* ── Back Button ── */}
        <button onClick={() => router.back()} className="pd-back-btn">
          <span style={{ fontSize: 18, lineHeight: 1 }}>←</span> Back to Patients
        </button>

        {/* ── Hero Header ── */}
        <div className="pd-hero">
          <div className="pd-hero-avatar">
            {patient.name.charAt(0)}
          </div>
          <div className="pd-hero-info">
            <div className="pd-hero-name-row">
              <h1 className="heading-font pd-hero-name">{patient.name}</h1>
              <div className="pd-hero-badges">
                <span style={{ background: riskBg, color: riskColor }} className="pd-badge">{patient.risk} Risk</span>
                <span style={{ background: statusBg, color: statusColor }} className="pd-badge">{patient.status}</span>
              </div>
            </div>
            <p className="pd-hero-sub">{patient.id} · {patient.age} yrs · {patient.gender}</p>
            <div className="pd-hero-meta">
              <span className="pd-hero-meta-item"><MapPin size={13} />{patient.district}, {patient.state}</span>
              <span className="pd-hero-meta-item"><Phone size={13} />{patient.contact}</span>
              <span className="pd-hero-meta-item"><Calendar size={13} />Registered {patient.registeredOn}</span>
            </div>
          </div>
        </div>

        {/* ── Quick Stats Row ── */}
        <div className="pd-stats-row">
          {[
            {
              icon: <Activity size={20} />,
              label: "Monitoring Days",
              value: patient.monitoringDays,
              sub: "Total planned",
              color: "#378ADD",
              bg: "#eff6ff",
            },
            {
              icon: <Calendar size={20} />,
              label: "Days Submitted",
              value: patient.submissions.length,
              sub: `of ${patient.monitoringDays} days`,
              color: "#1D9E75",
              bg: "#f0fdf4",
            },
            {
              icon: <TrendingUp size={20} />,
              label: "Completion",
              value: `${completionPct}%`,
              sub: "Progress",
              color: completionPct >= 70 ? "#15803d" : completionPct >= 40 ? "#d97706" : "#dc2626",
              bg: completionPct >= 70 ? "#f0fdf4" : completionPct >= 40 ? "#fefce8" : "#fef2f2",
            },
            {
              icon: <Stethoscope size={20} />,
              label: "Avg Pain Score",
              value: avgPain,
              sub: "Across submissions",
              color: "#dc2626",
              bg: "#fef2f2",
            },
          ].map((s) => (
            <div key={s.label} className="pd-stat-card" style={{ background: s.bg }}>
              <div className="pd-stat-icon" style={{ color: s.color }}>{s.icon}</div>
              <div className="heading-font pd-stat-value" style={{ color: s.color }}>{s.value}</div>
              <div className="pd-stat-label">{s.label}</div>
              <div className="pd-stat-sub">{s.sub}</div>
            </div>
          ))}
        </div>

        {/* ── Main Content Grid ── */}
        <div className="pd-content-grid">

          {/* LEFT COLUMN */}
          <div className="pd-col-left">

            {/* Personal Information */}
            <div className="pd-card">
              <div className="pd-card-header">
                <User size={16} />
                <h3>Personal Information</h3>
              </div>
              <div className="pd-info-list">
                {[
                  ["Contact",          patient.contact],
                  ["Emergency Contact",patient.relativeContact || "—"],
                  ["State",            patient.state],
                  ["District",         patient.district],
                ].map(([k, v]) => (
                  <div key={k} className="pd-info-row">
                    <span className="pd-info-key">{k}</span>
                    <span className="pd-info-val">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Medical Information */}
            <div className="pd-card">
              <div className="pd-card-header">
                <Stethoscope size={16} />
                <h3>Medical Information</h3>
              </div>
              <div className="pd-info-list">
                {[
                  ["Diagnosis",           patient.diagnosis],
                  ["Condition Type",      patient.conditionType],
                  ["Monitoring Duration", `${patient.monitoringDays} days`],
                  ["Days Submitted",      `${patient.submissions.length} / ${patient.monitoringDays}`],
                  ["Status",              patient.status],
                ].map(([k, v]) => (
                  <div key={k} className="pd-info-row">
                    <span className="pd-info-key">{k}</span>
                    <span className="pd-info-val">{v}</span>
                  </div>
                ))}
              </div>
              {/* Progress bar */}
              <div className="pd-progress-wrap">
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: "#94a3b8" }}>Treatment Progress</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{completionPct}%</span>
                </div>
                <div className="pd-progress-track">
                  <div className="pd-progress-fill" style={{ width: `${completionPct}%` }} />
                </div>
              </div>
            </div>

            {/* ── PRESCRIBED MEDICINES — commented out ──
            <div className="pd-card">
              <div className="pd-card-header">
                <Pill size={16} />
                <h3>Prescribed Medicines</h3>
              </div>
              {patient.medicines.map((m, i) => (
                <div key={i} className="pd-medicine-item">
                  <div style={{ fontWeight: 600, color: "#0f172a", fontSize: 14 }}>{m.name}</div>
                  <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>
                    {m.duration} days · {m.frequency} · {m.instruction}
                  </div>
                </div>
              ))}
            </div>
            ── end Prescribed Medicines ── */}

          </div>

          {/* RIGHT COLUMN */}
          <div className="pd-col-right">

            {/* Latest Snapshot */}
            {latestSubmission && (
              <div className="pd-card pd-snapshot-card">
                <div className="pd-card-header">
                  <Activity size={16} />
                  <h3>Latest Snapshot — Day {latestSubmission.day}</h3>
                  <span className="pd-snapshot-date">{latestSubmission.date}</span>
                </div>
                <div className="pd-snapshot-grid">
                  <div className="pd-snapshot-item" style={{ "--accent": "#dc2626" } as React.CSSProperties}>
                    <div className="pd-snapshot-metric">Pain Score</div>
                    <div className="pd-snapshot-val" style={{ color: "#dc2626" }}>{latestSubmission.painScore}<span>/10</span></div>
                  </div>
                  <div className="pd-snapshot-item" style={{ "--accent": "#d97706" } as React.CSSProperties}>
                    <div className="pd-snapshot-metric">Swelling</div>
                    <div className="pd-snapshot-val" style={{ color: "#d97706" }}>{latestSubmission.swelling}</div>
                  </div>
                  <div className="pd-snapshot-item" style={{ "--accent": "#1D9E75" } as React.CSSProperties}>
                    <div className="pd-snapshot-metric">Mobility</div>
                    <div className="pd-snapshot-val" style={{ color: "#1D9E75" }}>{latestSubmission.mobility}</div>
                  </div>
                </div>
                {latestSubmission.notes && (
                  <div className="pd-snapshot-notes">
                    <span style={{ fontWeight: 600, color: "#64748b" }}>Note: </span>
                    {latestSubmission.notes}
                  </div>
                )}
              </div>
            )}

            {/* Monitoring History */}
            <div className="pd-card pd-history-card">
              <div className="pd-card-header">
                <BarChart3 size={16} />
                <h3>Monitoring History</h3>
                <span className="pd-history-count">{patient.submissions.length} entries</span>
              </div>

              {patient.submissions.length === 0 && (
                <div className="pd-empty">No submissions yet</div>
              )}

              <div className="pd-history-list">
                {[...patient.submissions].reverse().map((s, idx) => {
                  const prev = patient.submissions[patient.submissions.length - idx - 2];
                  const trend = prev
                    ? s.painScore < prev.painScore
                      ? "down"
                      : s.painScore > prev.painScore
                      ? "up"
                      : "flat"
                    : "flat";

                  return (
                    <div key={s.day} className="pd-history-item">
                      <div className="pd-history-day-badge">D{s.day}</div>
                      <div className="pd-history-body">
                        <div className="pd-history-top-row">
                          <span className="pd-history-date">{s.date}</span>
                          <div className="pd-history-chips">
                            <span className="pd-chip pd-chip-pain">Pain: {s.painScore}</span>
                            <span className="pd-chip pd-chip-swelling">Swelling: {s.swelling}</span>
                            <span className="pd-chip pd-chip-mobility">Mobility: {s.mobility}</span>
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              {trend === "down" && (
                                <>
                                  <TrendingDown size={14} style={{ color: "#15803d" }} />
                                  <span style={{ fontSize: 10, color: "#15803d", fontWeight: 600 }}>Improving</span>
                                </>
                              )}
                              {trend === "up" && (
                                <>
                                  <TrendingUp size={14} style={{ color: "#dc2626" }} />
                                  <span style={{ fontSize: 10, color: "#dc2626", fontWeight: 600 }}>Worsening</span>
                                </>
                              )}
                              {trend === "flat" && (
                                <>
                                  <Minus size={14} style={{ color: "#94a3b8" }} />
                                  <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600 }}>Stable</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        {s.notes && <div className="pd-history-note">{s.notes}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      </main>

      <style>{`
        /* ── Page wrapper ── */
        .pd-main {
          padding: 28px 32px 48px;
        }

        /* ── Back button ── */
        .pd-back-btn {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          background: none;
          border: none;
          color: #64748b;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          margin-bottom: 22px;
          padding: 6px 0;
          transition: color 0.2s;
          font-family: 'DM Sans', sans-serif;
        }
        .pd-back-btn:hover { color: #1D9E75; }

        /* ── Hero ── */
        .pd-hero {
          background: linear-gradient(135deg, #0f172a 0%, #1a3555 60%, #1e4a70 100%);
          border-radius: 24px;
          padding: 28px 32px;
          margin-bottom: 22px;
          display: flex;
          align-items: center;
          gap: 24px;
          flex-wrap: wrap;
          position: relative;
          overflow: hidden;
        }
        
        .pd-hero-avatar {
          width: 72px; height: 72px;
          border-radius: 20px;
          background: linear-gradient(135deg, #1D9E75, #378ADD);
          display: flex; align-items: center; justify-content: center;
          color: white; font-size: 28px; font-weight: 800;
          flex-shrink: 0;
          font-family: 'Syne', sans-serif;
          box-shadow: 0 8px 24px rgba(29,158,117,0.35);
          position: relative; z-index: 1;
        }
        .pd-hero-info {
          flex: 1;
          min-width: 200px;
          position: relative; z-index: 1;
        }
        .pd-hero-name-row {
          display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
          margin-bottom: 4px;
        }
        .pd-hero-name {
          color: white; font-size: 26px; font-weight: 800; margin: 0;
        }
        .pd-hero-badges { display: flex; gap: 8px; flex-wrap: wrap; }
        .pd-badge {
          padding: 4px 14px; border-radius: 99px;
          font-size: 12px; font-weight: 700;
          white-space: nowrap;
        }
        .pd-hero-sub {
          color: #94a3b8; margin: 0 0 10px; font-size: 14px;
        }
        .pd-hero-meta {
          display: flex; gap: 18px; flex-wrap: wrap;
        }
        .pd-hero-meta-item {
          display: flex; align-items: center; gap: 5px;
          color: #cbd5e1; font-size: 13px;
        }

        /* ── Quick stats ── */
        .pd-stats-row {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }
        .pd-stat-card {
          border-radius: 18px;
          padding: 20px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.05);
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .pd-stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.09);
        }
        .pd-stat-icon {
          margin-bottom: 8px;
          opacity: 0.8;
        }
        .pd-stat-value {
          font-size: 30px; font-weight: 800; line-height: 1;
          margin-bottom: 4px;
        }
        .pd-stat-label {
          font-size: 13px; font-weight: 600; color: #374151;
          margin-bottom: 2px;
        }
        .pd-stat-sub { font-size: 11px; color: #9ca3af; }

        /* ── Content grid ── */
        .pd-content-grid {
          display: grid;
          grid-template-columns: 380px 1fr;
          gap: 20px;
          align-items: start;
        }
        .pd-col-left, .pd-col-right { display: flex; flex-direction: column; gap: 20px; }

        /* ── Card ── */
        .pd-card {
          background: white;
          border-radius: 20px;
          padding: 22px;
          box-shadow: 0 2px 16px rgba(0,0,0,0.06);
        }
        .pd-card-header {
          display: flex; align-items: center; gap: 8px;
          margin-bottom: 18px;
          color: #64748b;
        }
        .pd-card-header h3 {
          font-family: 'Syne', sans-serif;
          font-size: 15px; font-weight: 700;
          color: #0f172a; margin: 0; flex: 1;
        }

        /* ── Info list ── */
        .pd-info-list {}
        .pd-info-row {
          display: flex; justify-content: space-between; align-items: center;
          padding: 11px 0;
          border-bottom: 1px solid #f1f5f9;
        }
        .pd-info-row:last-child { border-bottom: none; }
        .pd-info-key { color: #94a3b8; font-size: 13px; }
        .pd-info-val { color: #0f172a; font-size: 13px; font-weight: 600; text-align: right; max-width: 55%; }

        /* Progress */
        .pd-progress-wrap { margin-top: 16px; padding-top: 14px; border-top: 1px solid #f1f5f9; }
        .pd-progress-track {
          height: 8px; background: #f1f5f9; border-radius: 99px; overflow: hidden;
        }
        .pd-progress-fill {
          height: 100%;
          background: linear-gradient(to right, #1D9E75, #378ADD);
          border-radius: 99px;
          transition: width 0.6s ease;
        }

        /* ── Snapshot ── */
        .pd-snapshot-card {}
        .pd-snapshot-date {
          font-size: 12px; color: #94a3b8; margin-left: auto;
        }
        .pd-snapshot-grid {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 12px;
        }
        .pd-snapshot-item {
          text-align: center;
          background: #fafafa;
          border-radius: 14px;
          padding: 14px 8px;
          border: 1px solid #f1f5f9;
        }
        .pd-snapshot-metric { font-size: 11px; color: #94a3b8; margin-bottom: 6px; }
        .pd-snapshot-val {
          font-family: 'Syne', sans-serif;
          font-size: 18px; font-weight: 800; line-height: 1;
        }
        .pd-snapshot-val span { font-size: 13px; opacity: 0.6; }
        .pd-snapshot-notes {
          background: #f8fafc; border-radius: 12px; padding: 10px 14px;
          font-size: 13px; color: #475569; font-style: italic;
          border-left: 3px solid #378ADD;
        }

        /* ── History ── */
        .pd-history-card {}
        .pd-history-count {
          font-size: 12px; background: #f1f5f9; color: #64748b;
          padding: 3px 10px; border-radius: 99px; font-weight: 600;
          margin-left: auto;
        }
        .pd-empty {
          text-align: center; color: #94a3b8; padding: 32px 0; font-size: 14px;
        }
        .pd-history-list {
          display: flex; flex-direction: column; gap: 10px;
          max-height: 500px; overflow-y: auto;
          padding-right: 4px;
        }
        .pd-history-list::-webkit-scrollbar { width: 4px; }
        .pd-history-list::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 99px; }

        .pd-history-item {
          display: flex; gap: 12px; align-items: flex-start;
          background: #fafafa; border-radius: 14px; padding: 12px 14px;
          border: 1px solid #f1f5f9;
          transition: background 0.15s;
        }
        .pd-history-item:hover { background: #f0f9ff; }

        .pd-history-day-badge {
          background: linear-gradient(135deg, #1D9E75, #378ADD);
          color: white; font-size: 11px; font-weight: 700;
          width: 36px; height: 36px; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; font-family: 'Syne', sans-serif;
        }
        .pd-history-body { flex: 1; min-width: 0; }
        .pd-history-top-row {
          display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 4px;
        }
        .pd-history-date { font-size: 12px; color: #94a3b8; white-space: nowrap; }
        .pd-history-chips { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-left: auto; }
        .pd-chip {
          padding: 3px 9px; border-radius: 99px; font-size: 11px; font-weight: 700;
          white-space: nowrap;
        }
        .pd-chip-pain      { background: #fef2f2; color: #dc2626; }
        .pd-chip-swelling  { background: #fefce8; color: #a16207; }
        .pd-chip-mobility  { background: #f0fdf4; color: #15803d; }
        .pd-history-note {
          font-size: 12px; color: #64748b; font-style: italic;
        }

        /* ════════════════════════════════
           RESPONSIVE BREAKPOINTS
        ════════════════════════════════ */

        /* Laptop 1024–1300 */
        @media (min-width:1024px) and (max-width:1300px) {
          .pd-main { padding: 22px 24px 40px; }
          .pd-content-grid { grid-template-columns: 320px 1fr; }
          .pd-stats-row { grid-template-columns: repeat(4,1fr); gap: 12px; }
          .pd-stat-value { font-size: 26px; }
          .pd-hero-name { font-size: 22px; }
        }

        /* Tablet 768–1023 */
        @media (max-width:1023px) {
          .pd-main { padding: 20px 20px 40px; }
          .pd-hero { padding: 22px 22px; gap: 18px; }
          .pd-hero-name { font-size: 20px; }
          .pd-stats-row { grid-template-columns: repeat(4, 1fr); gap: 12px; }
          .pd-content-grid { grid-template-columns: 1fr; }
          .pd-col-left { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
          .pd-snapshot-grid { gap: 8px; }
        }

        /* Mobile ≤767 */
        @media (max-width:767px) {
          .pd-main { padding: 14px 14px 40px; }

          .pd-hero {
            padding: 20px 18px;
            gap: 14px;
            border-radius: 18px;
          }
          .pd-hero-avatar { width: 56px; height: 56px; font-size: 22px; border-radius: 16px; }
          .pd-hero-name { font-size: 18px; }
          .pd-hero-sub { font-size: 13px; margin-bottom: 8px; }
          .pd-hero-meta { gap: 10px; }
          .pd-hero-meta-item { font-size: 12px; }

          .pd-stats-row {
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
            margin-bottom: 18px;
          }
          .pd-stat-card { padding: 14px 16px; border-radius: 14px; }
          .pd-stat-value { font-size: 24px; }
          .pd-stat-label { font-size: 12px; }
          .pd-stat-sub { font-size: 10px; }

          .pd-content-grid { gap: 16px; }
          .pd-col-left { display: flex; flex-direction: column; }
          .pd-card { padding: 18px 16px; border-radius: 16px; }

          .pd-snapshot-grid { grid-template-columns: repeat(3,1fr); gap: 6px; }
          .pd-snapshot-val { font-size: 18px; }

          .pd-history-chips { gap: 4px; }
          .pd-chip { padding: 2px 7px; font-size: 10px; }
          .pd-history-day-badge { width: 30px; height: 30px; font-size: 10px; border-radius: 8px; }
        }

        /* Small mobile ≤380 */
        @media (max-width:380px) {
          .pd-stats-row { grid-template-columns: 1fr 1fr; gap: 8px; }
          .pd-hero-name { font-size: 16px; }
          .pd-hero-meta { gap: 6px; }
          .pd-hero-meta-item { font-size: 11px; }
          .pd-snapshot-grid { grid-template-columns: 1fr 1fr 1fr; }
        }
      `}</style>
    </div>
  );
}