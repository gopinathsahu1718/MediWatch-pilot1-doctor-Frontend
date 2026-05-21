"use client";
import { useState, type ReactNode } from "react";
import Sidebar from "@/components/Sidebar";
import { User, Stethoscope, CheckCircle2 } from "lucide-react";

export default function RegisterPage() {
  const [submitted, setSubmitted] = useState(false);
  const [patientId, setPatientId] = useState("");
  const [duration, setDuration] = useState("");
  const [risk, setRisk] = useState("Low");
  const [conditionType, setConditionType] = useState("New");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!duration.trim()) {
      alert("Monitoring Duration is required");
      return;
    }
    const id = "MW-" + Math.floor(100000 + Math.random() * 900000);
    setPatientId(id);
    setSubmitted(true);
  }

  const labelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 8 };
  const sectionTitle = (icon: ReactNode, title: string) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
      <div style={{ width: 36, height: 36, background: "rgba(186,117,23,0.1)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#925000" }}>{icon}</div>
      <h3 className="heading-font reg-section-title" style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", margin: 0 }}>{title}</h3>
    </div>
  );

  if (submitted) {
    return (
      <div className="page-shell">
        <Sidebar />
        <main className="main-content" style={{ padding: 32, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center", maxWidth: 440 }}>
            <div style={{ fontSize: 72, marginBottom: 16 }}><CheckCircle2 size={72} color="#16a34a" /></div>
            <h2 className="heading-font reg-success-title" style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>Patient Registered!</h2>
            <p className="reg-success-text" style={{ color: "#64748b", marginBottom: 8 }}>Record created successfully.</p>
            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 16, padding: "16px 24px", marginBottom: 28 }}>
              <span className="reg-patient-id" style={{ color: "#15803d", fontWeight: 700, fontSize: 20 }}>{patientId}</span>
            </div>
            <button className="btn-primary" onClick={() => { setSubmitted(false); setDuration(""); setRisk("Low"); setConditionType("New"); }}>
              Register Another Patient
            </button>
          </div>
        </main>

        <style>{`
          @media (max-width: 767px) {
            .reg-success-title { font-size: 22px !important; }
            .reg-success-text { font-size: 13px !important; }
            .reg-patient-id { font-size: 16px !important; }
          }
          @media (max-width: 480px) {
            .reg-success-title { font-size: 18px !important; }
            .reg-success-text { font-size: 12px !important; }
            .reg-patient-id { font-size: 14px !important; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="page-shell" style={{ width: "100%" }}>
      <Sidebar />
      <main className="main-content" style={{ padding: 32, flex: 1 }}>
        <div style={{ background: "#378ADD", padding: "20px 24px", borderRadius: 16, marginBottom: 28 }}>
          <h1 className="heading-font reg-header-title" style={{ fontSize: 28, fontWeight: 800, color: "white", margin: 0 }}>Patient Registration</h1>
          <p className="reg-header-subtitle" style={{ color: "rgba(255,255,255,0.8)", fontSize: 14, marginTop: 4 }}>Fill in all mandatory fields to register a new patient</p>
        </div>

        <form onSubmit={handleSubmit} style={{ width: "100%" }}>
          <div className="responsive-form-grid-3" style={{ width: "100%" }}>
            
            {/* Basic Details */}
            <div style={{ background: "white", borderRadius: 20, padding: 28, boxShadow: "0 4px 20px rgba(0,0,0,0.06)", gridColumn: "1 / -1" }} className="reg-card">
              {sectionTitle(<User size={18} />, "Basic Details")}
              <div className="responsive-form-grid-3" style={{ gap: 20 }}>
                <div style={{ gridColumn: "1/2" }}>
                  <label className="reg-label" style={labelStyle}>Full Name <span style={{ color: "#ef4444" }}>*</span></label>
                  <input required className="mw-input reg-input-text" type="text" placeholder="e.g. Priya Sharma" />
                </div>
                <div className="reg-age-gender">
                  <label className="reg-label" style={labelStyle}>Age <span style={{ color: "#ef4444" }}>*</span></label>
                  <input required className="mw-input reg-input-text" type="number" min="1" max="120" placeholder="42" />
                </div>
                <div className="reg-age-gender">
                  <label className="reg-label" style={labelStyle}>Gender <span style={{ color: "#ef4444" }}>*</span></label>
                  <select required className="mw-input reg-input-text" style={{ cursor: "pointer" }}>
                    <option value="">Select</option>
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label className="reg-label" style={labelStyle}>Patient Contact <span style={{ color: "#ef4444" }}>*</span></label>
                  <input required className="mw-input reg-input-text" type="tel" placeholder="+91 98765 43210" />
                </div>
                <div>
                  <label className="reg-label" style={labelStyle}>Relative / Emergency Contact</label>
                  <input className="mw-input reg-input-text" type="tel" placeholder="+91 87654 32109" />
                </div>
                <div>
                  <label className="reg-label" style={labelStyle}>State <span style={{ color: "#ef4444" }}>*</span></label>
                  <select required className="mw-input reg-input-text" style={{ cursor: "pointer" }}>
                    <option>Andhra Pradesh</option>
                    <option>Tamil Nadu</option>
                    <option>Kerala</option>
                    <option>Karnataka</option>
                    <option>Telangana</option>
                  </select>
                </div>
                <div>
                  <label className="reg-label" style={labelStyle}>District <span style={{ color: "#ef4444" }}>*</span></label>
                  <input required className="mw-input reg-input-text" type="text" placeholder="e.g. Guntur" />
                </div>
              </div>
            </div>

            {/* Medical Details */}
            <div style={{ background: "white", borderRadius: 20, padding: 28, boxShadow: "0 4px 20px rgba(0,0,0,0.06)", gridColumn: "1 / -1" }} className="reg-card">
              {sectionTitle(<Stethoscope size={18} />, "Medical Details")}
              <div className="responsive-form-grid-2" style={{ gap: 20 }}>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label className="reg-label" style={labelStyle}>Diagnosis <span style={{ color: "#ef4444" }}>*</span></label>
                  <select required className="mw-input reg-input-text" style={{ cursor: "pointer" }}>
                    <option value="">Select Diagnosis</option>
                    <option>Rheumatoid arthritis</option>
                    <option>Spondyloarthritis</option>
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Condition Type</label>
                  <div style={{ display: "flex", gap: 12 }}>
                    {["New", "Follow-up"].map(ct => (
                      <label key={ct} style={{ flex: 1, cursor: "pointer" }}>
                        <div onClick={() => setConditionType(ct)} style={{
                          padding: "13px 0", textAlign: "center", borderRadius: 14, fontWeight: 600, fontSize: 14, transition: "all 0.2s",
                          border: `2px solid ${conditionType === ct ? "#1D9E75" : "#e2e8f0"}`,
                          background: conditionType === ct ? "rgba(29,158,117,0.08)" : "white",
                          color: conditionType === ct ? "#1D9E75" : "#64748b",
                        }}>{ct === "New" ? "New Patient" : "Follow-up"}</div>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Risk Category <span style={{ color: "#ef4444" }}>*</span></label>
                  <div style={{ display: "flex", gap: 10 }}>
                    {[
                      { v: "Low", color: "#15803d", bg: "#f0fdf4", border: "#bbf7d0" },
                      { v: "Medium", color: "#a16207", bg: "#fefce8", border: "#fde68a" },
                      { v: "High", color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
                    ].map(r => (
                      <div key={r.v} onClick={() => setRisk(r.v)} style={{
                        flex: 1, padding: "12px 0", textAlign: "center", borderRadius: 14,
                        border: `2px solid ${risk === r.v ? r.color : r.border}`,
                        background: risk === r.v ? r.bg : "white",
                        color: risk === r.v ? r.color : "#94a3b8",
                        fontWeight: 600, fontSize: 14, cursor: "pointer", transition: "all 0.2s"
                      }}>{r.v}</div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="reg-label" style={labelStyle}>Monitoring Duration (days) <span style={{ color: "#ef4444" }}>*</span></label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {[7, 10, 14].map(d => (
                      <button key={d} type="button" onClick={() => setDuration(String(d))} style={{
                        flex: 1, padding: "12px 0", borderRadius: 12, fontSize: 13,
                        border: `2px solid ${duration === String(d) ? "#1D9E75" : "#e2e8f0"}`,
                        background: duration === String(d) ? "rgba(29,158,117,0.08)" : "white",
                        color: duration === String(d) ? "#1D9E75" : "#64748b",
                        fontWeight: 600, cursor: "pointer", transition: "all 0.2s"
                      }}>{d}</button>
                    ))}
                    <input type="number" className="mw-input reg-input-text reg-duration-other" placeholder="Other"
                      value={!["7", "10", "14"].includes(duration) ? duration : ""}
                      onChange={e => setDuration(e.target.value)}
                      style={{ width: 80, textAlign: "center", padding: "12px 8px", fontSize: 13 }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Consent + Submit */}
            <div style={{ background: "white", borderRadius: 20, padding: 28, boxShadow: "0 4px 20px rgba(0,0,0,0.06)", gridColumn: "1 / -1" }} className="reg-card">
              <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", marginBottom: 24 }}>
                <input type="checkbox" required style={{ width: 20, height: 20, accentColor: "#1D9E75", cursor: "pointer" }} />
                <span className="reg-label" style={{ fontSize: 14, color: "#374151" }}>
                  Patient consent form signed and understood <span style={{ color: "#ef4444" }}>*</span>
                </span>
              </label>
              <button type="submit" className="btn-primary reg-button-text" style={{ width: "100%", padding: "18px", fontSize: 17, borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                REGISTER PATIENT
              </button>
              <p className="reg-helper-text" style={{ textAlign: "center", color: "#94a3b8", fontSize: 12, marginTop: 12 }}>All fields are securely saved • Auto timestamped</p>
            </div>
          </div>
        </form>
      </main>

      <style>{`
        /* ── Responsive Typography ── */
        
        /* Tablet 768–1023px */
        @media (max-width: 1023px) {
          .reg-header-title { font-size: 24px !important; }
          .reg-header-subtitle { font-size: 12px !important; }
          .reg-section-title { font-size: 16px !important; }
          .reg-label { font-size: 12px !important; }
          .reg-button-text { font-size: 15px !important; }
          .reg-helper-text { font-size: 11px !important; }
        }

        /* Mobile ≤767px */
        @media (max-width: 767px) {
          .reg-header-title { font-size: 20px !important; }
          .reg-header-subtitle { font-size: 11px !important; }
          .reg-section-title { font-size: 14px !important; }
          .reg-label { font-size: 11px !important; }
          .reg-button-text { font-size: 13px !important; }
          .reg-helper-text { font-size: 12px !important; }
          .reg-input-text { font-size: 13px !important; }
          .reg-card { padding: 20px !important; }
          .responsive-form-grid-3 { grid-template-columns: repeat(2, 1fr) !important; }
          .responsive-form-grid-3 > div:first-child { grid-column: 1 / -1 !important; }
          .reg-age-gender { grid-column: auto !important; }
          .reg-duration-other { display: none !important; }
        }

        /* Small Mobile ≤480px */
        @media (max-width: 480px) {
          .reg-header-title { font-size: 18px !important; }
          .reg-header-subtitle { font-size: 12px !important; }
          .reg-section-title { font-size: 13px !important; }
          .reg-label { font-size: 12px !important; }
          .reg-button-text { font-size: 12px !important; }
          .reg-helper-text { font-size: 9px !important; }
          .reg-input-text { font-size: 12px !important; }
          .reg-card { padding: 16px !important; }
        }
      `}</style>
    </div>
  );
}
