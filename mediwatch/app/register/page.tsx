"use client";
import { useState } from "react";
import Sidebar from "@/components/Sidebar";

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
  const sectionTitle = (icon: string, title: string) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
      <div style={{ width: 36, height: 36, background: "rgba(186,117,23,0.1)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{icon}</div>
      <h3 className="heading-font" style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", margin: 0 }}>{title}</h3>
    </div>
  );

  if (submitted) {
    return (
      <div style={{ display: "flex" }}>
        <Sidebar />
        <main className="main-content" style={{ padding: 32, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center", maxWidth: 440 }}>
            <div style={{ fontSize: 72, marginBottom: 16 }}>✅</div>
            <h2 className="heading-font" style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>Patient Registered!</h2>
            <p style={{ color: "#64748b", marginBottom: 8 }}>Record created successfully.</p>
            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 16, padding: "16px 24px", marginBottom: 28 }}>
              <span style={{ color: "#15803d", fontWeight: 700, fontSize: 20 }}>{patientId}</span>
            </div>
            <button className="btn-primary" onClick={() => { setSubmitted(false); setDuration(""); setRisk("Low"); setConditionType("New"); }}>
              Register Another Patient
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", width: "100%" }}>
      <Sidebar />
      <main className="main-content" style={{ padding: 32, flex: 1 }}>
        <div style={{ background: "#378ADD", padding: "20px 24px", borderRadius: 16, marginBottom: 28 }}>
          <h1 className="heading-font" style={{ fontSize: 28, fontWeight: 800, color: "white", margin: 0 }}>Patient Registration</h1>
          <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 14, marginTop: 4 }}>Fill in all mandatory fields to register a new patient</p>
        </div>

        <form onSubmit={handleSubmit} style={{ width: "100%" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24, width: "100%" }}>
            
            {/* Basic Details */}
            <div style={{ background: "white", borderRadius: 20, padding: 28, boxShadow: "0 4px 20px rgba(0,0,0,0.06)", gridColumn: "1 / -1" }}>
              {sectionTitle("👤", "Basic Details")}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
                <div style={{ gridColumn: "1/2" }}>
                  <label style={labelStyle}>Full Name <span style={{ color: "#ef4444" }}>*</span></label>
                  <input required className="mw-input" type="text" placeholder="e.g. Priya Sharma" />
                </div>
                <div>
                  <label style={labelStyle}>Age <span style={{ color: "#ef4444" }}>*</span></label>
                  <input required className="mw-input" type="number" min="1" max="120" placeholder="42" />
                </div>
                <div>
                  <label style={labelStyle}>Gender <span style={{ color: "#ef4444" }}>*</span></label>
                  <select required className="mw-input" style={{ cursor: "pointer" }}>
                    <option value="">Select</option>
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Patient Contact <span style={{ color: "#ef4444" }}>*</span></label>
                  <input required className="mw-input" type="tel" placeholder="+91 98765 43210" />
                </div>
                <div>
                  <label style={labelStyle}>Relative / Emergency Contact</label>
                  <input className="mw-input" type="tel" placeholder="+91 87654 32109" />
                </div>
                <div>
                  <label style={labelStyle}>State <span style={{ color: "#ef4444" }}>*</span></label>
                  <select required className="mw-input" style={{ cursor: "pointer" }}>
                    <option>Andhra Pradesh</option>
                    <option>Tamil Nadu</option>
                    <option>Kerala</option>
                    <option>Karnataka</option>
                    <option>Telangana</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>District <span style={{ color: "#ef4444" }}>*</span></label>
                  <input required className="mw-input" type="text" placeholder="e.g. Guntur" />
                </div>
              </div>
            </div>

            {/* Medical Details */}
            <div style={{ background: "white", borderRadius: 20, padding: 28, boxShadow: "0 4px 20px rgba(0,0,0,0.06)", gridColumn: "1 / -1" }}>
              {sectionTitle("🩺", "Medical Details")}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={labelStyle}>Diagnosis <span style={{ color: "#ef4444" }}>*</span></label>
                  <select required className="mw-input" style={{ cursor: "pointer" }}>
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
                  <label style={labelStyle}>Monitoring Duration (days) <span style={{ color: "#ef4444" }}>*</span></label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {[7, 10, 14].map(d => (
                      <button key={d} type="button" onClick={() => setDuration(String(d))} style={{
                        flex: 1, padding: "12px 0", borderRadius: 12,
                        border: `2px solid ${duration === String(d) ? "#1D9E75" : "#e2e8f0"}`,
                        background: duration === String(d) ? "rgba(29,158,117,0.08)" : "white",
                        color: duration === String(d) ? "#1D9E75" : "#64748b",
                        fontWeight: 600, fontSize: 14, cursor: "pointer", transition: "all 0.2s"
                      }}>{d}</button>
                    ))}
                    <input type="number" className="mw-input" placeholder="Other"
                      value={!["7", "10", "14"].includes(duration) ? duration : ""}
                      onChange={e => setDuration(e.target.value)}
                      style={{ width: 80, textAlign: "center", padding: "12px 8px" }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Consent + Submit */}
            <div style={{ background: "white", borderRadius: 20, padding: 28, boxShadow: "0 4px 20px rgba(0,0,0,0.06)", gridColumn: "1 / -1" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", marginBottom: 24 }}>
                <input type="checkbox" required style={{ width: 20, height: 20, accentColor: "#1D9E75", cursor: "pointer" }} />
                <span style={{ fontSize: 14, color: "#374151" }}>
                  Patient consent form signed and understood <span style={{ color: "#ef4444" }}>*</span>
                </span>
              </label>
              <button type="submit" className="btn-primary" style={{ width: "100%", padding: "18px", fontSize: 17, borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                ✓ REGISTER PATIENT
              </button>
              <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 12, marginTop: 12 }}>All fields are securely saved • Auto timestamped</p>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
