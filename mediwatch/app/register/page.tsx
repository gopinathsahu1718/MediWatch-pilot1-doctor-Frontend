"use client";
import { useState, useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { User, Stethoscope, CheckCircle2 } from "lucide-react";

const BASE_URL = "https://api.mediwatch.in";

interface Disease {
  id: string;
  name: string;
  description: string | null;
  score_formula: string;
  created_at: string;
}

export default function RegisterPage() {
  const router = useRouter();

  // ── Submission state ──────────────────────────────────────────────────────
  const [submitted, setSubmitted]   = useState(false);
  const [patientId, setPatientId]   = useState("");
  const [apiError,  setApiError]    = useState("");
  const [loading,   setLoading]     = useState(false);

  // ── Diseases dropdown ─────────────────────────────────────────────────────
  const [diseases,        setDiseases]        = useState<Disease[]>([]);
  const [diseasesLoading, setDiseasesLoading] = useState(true);
  const [diseasesError,   setDiseasesError]   = useState("");

  // ── Form fields ───────────────────────────────────────────────────────────
  const [name,          setName]          = useState("");
  const [age,           setAge]           = useState("");
  const [gender,        setGender]        = useState("");
  const [phone,         setPhone]         = useState("");
  const [relativePhone, setRelativePhone] = useState("");
  const [state,         setState]         = useState("");
  const [district,      setDistrict]      = useState("");
  const [addressLine,   setAddressLine]   = useState("");
  const [diseaseId,     setDiseaseId]     = useState("");
  const [conditionType, setConditionType] = useState("New");
  const [risk,          setRisk]          = useState("Low");
  const [duration,      setDuration]      = useState("7");
  const [consent,       setConsent]       = useState(false);

  // ── Auth helper ───────────────────────────────────────────────────────────
  function getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("doctor_token");
  }

  // ── Fetch diseases on mount ───────────────────────────────────────────────
  useEffect(() => {
    async function fetchDiseases() {
      setDiseasesLoading(true);
      setDiseasesError("");
      try {
        const token = getToken();
        if (!token) {
          router.replace("/login");
          return;
        }
        const res = await fetch(`${BASE_URL}/api/v1/doctor/diseases`, {
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (res.status === 401) {
          // Token expired – clear and redirect to login
          localStorage.removeItem("doctor_token");
          document.cookie = "doctor_token=; path=/; max-age=0; SameSite=Strict";
          router.replace("/login");
          return;
        }

        const data = await res.json();

        if (!res.ok) {
          setDiseasesError(data?.message || "Failed to load diseases.");
          return;
        }

        setDiseases(data?.data?.diseases ?? []);
      } catch {
        setDiseasesError("Network error. Could not load diseases.");
      } finally {
        setDiseasesLoading(false);
      }
    }

    fetchDiseases();
  }, [router]);

  // ── Form submit ───────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setApiError("");

    if (!duration.trim()) {
      setApiError("Monitoring Duration is required.");
      return;
    }
    if (!diseaseId) {
      setApiError("Please select a diagnosis.");
      return;
    }
    if (!consent) {
      setApiError("Patient consent is required.");
      return;
    }

    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    setLoading(true);
    try {
      const body = {
        diseaseId,
        name:           name.trim(),
        age:            Number(age),
        gender:         gender.toLowerCase(),
        phone:          phone.trim(),
        relativePhone:  relativePhone.trim() || undefined,
        state:          state.trim(),
        district:       district.trim(),
        addressLine:    addressLine.trim() || "N/A",
        diagnosis:      diseases.find(d => d.id === diseaseId)?.name ?? "",
        conditionType:  conditionType.toLowerCase().replace("-", "_") as "new" | "follow_up",
        riskCategory:   risk.toLowerCase() as "low" | "medium" | "high",
        monitoringDays: Number(duration),
        consentGiven:   true,
      };

      const res = await fetch(`${BASE_URL}/api/v1/doctor/patients/register`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (res.status === 401) {
        localStorage.removeItem("doctor_token");
        document.cookie = "doctor_token=; path=/; max-age=0; SameSite=Strict";
        router.replace("/login");
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        setApiError(data?.message || "Registration failed. Please try again.");
        return;
      }

      // Use API-returned readable ID if available, else fallback to patient ID or generated display ID
      const returnedId =
        data?.data?.readable_id ||
        data?.data?.readableId ||
        data?.data?.patientId ||
        data?.data?.id ||
        "MW-" + Math.floor(100000 + Math.random() * 900000);

      setPatientId(returnedId);
      setSubmitted(true);
    } catch {
      setApiError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── Reset form ────────────────────────────────────────────────────────────
  function resetForm() {
    setSubmitted(false);
    setApiError("");
    setName(""); setAge(""); setGender(""); setPhone("");
    setRelativePhone(""); setState(""); setDistrict(""); setAddressLine("");
    setDiseaseId(""); setConditionType("New"); setRisk("Low");
    setDuration(""); setConsent(false);
  }

  // ── Style helpers ─────────────────────────────────────────────────────────
  const labelStyle: React.CSSProperties = {
    fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 8,
  };

  const sectionTitle = (icon: ReactNode, title: string) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
      <div style={{ width: 36, height: 36, background: "rgba(186,117,23,0.1)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#925000" }}>
        {icon}
      </div>
      <h3 className="heading-font reg-section-title" style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", margin: 0 }}>
        {title}
      </h3>
    </div>
  );

  // ── Success screen ────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="page-shell">
        <Sidebar />
        <main className="main-content" style={{ padding: 32, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center", maxWidth: 440 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <CheckCircle2 size={72} color="#16a34a" />
            </div>
            <h2 className="heading-font reg-success-title" style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>
              Patient Registered!
            </h2>
            <p className="reg-success-text" style={{ color: "#64748b", marginBottom: 8 }}>
              Record created successfully.
            </p>
            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 16, padding: "16px 24px", marginBottom: 28 }}>
              <span className="reg-patient-id" style={{ color: "#15803d", fontWeight: 700, fontSize: 20 }}>
                {patientId}
              </span>
            </div>
            <button className="btn-primary" onClick={resetForm}>
              Register Another Patient
            </button>
          </div>
        </main>

        <style>{`
          @media (max-width: 767px) {
            .reg-success-title { font-size: 22px !important; }
            .reg-success-text  { font-size: 13px !important; }
            .reg-patient-id    { font-size: 16px !important; }
          }
          @media (max-width: 480px) {
            .reg-success-title { font-size: 18px !important; }
            .reg-success-text  { font-size: 12px !important; }
            .reg-patient-id    { font-size: 14px !important; }
          }
        `}</style>
      </div>
    );
  }

  // ── Main form ─────────────────────────────────────────────────────────────
  return (
    <div className="page-shell" style={{ width: "100%" }}>
      <Sidebar />
      <main className="main-content" style={{ padding: 32, flex: 1 }}>

        {/* Header */}
        <div style={{ background: "#378ADD", padding: "20px 24px", borderRadius: 16, marginBottom: 28 }}>
          <h1 className="heading-font reg-header-title" style={{ fontSize: 28, fontWeight: 800, color: "white", margin: 0 }}>
            Patient Registration
          </h1>
          <p className="reg-header-subtitle" style={{ color: "rgba(255,255,255,0.8)", fontSize: 14, marginTop: 4 }}>
            Fill in all mandatory fields to register a new patient
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ width: "100%" }}>
          <div className="responsive-form-grid-3" style={{ width: "100%" }}>

            {/* ── Basic Details ── */}
            <div style={{ background: "white", borderRadius: 20, padding: 28, boxShadow: "0 4px 20px rgba(0,0,0,0.06)", gridColumn: "1 / -1" }} className="reg-card">
              {sectionTitle(<User size={18} />, "Basic Details")}
              <div className="responsive-form-grid-3" style={{ gap: 20 }}>

                <div style={{ gridColumn: "1/2" }}>
                  <label className="reg-label" style={labelStyle}>Full Name <span style={{ color: "#ef4444" }}>*</span></label>
                  <input
                    required className="mw-input reg-input-text" type="text"
                    placeholder="e.g. Priya Sharma"
                    value={name} onChange={e => setName(e.target.value)}
                  />
                </div>

                <div className="reg-age-gender">
                  <label className="reg-label" style={labelStyle}>Age <span style={{ color: "#ef4444" }}>*</span></label>
                  <input
                    required className="mw-input reg-input-text" type="number" min="1" max="120"
                    placeholder="42"
                    value={age} onChange={e => setAge(e.target.value)}
                  />
                </div>

                <div className="reg-age-gender">
                  <label className="reg-label" style={labelStyle}>Gender <span style={{ color: "#ef4444" }}>*</span></label>
                  <select
                    required className="mw-input reg-input-text" style={{ cursor: "pointer" }}
                    value={gender} onChange={e => setGender(e.target.value)}
                  >
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="reg-label" style={labelStyle}>Patient Contact <span style={{ color: "#ef4444" }}>*</span></label>
                  <input
                    required className="mw-input reg-input-text" type="tel"
                    placeholder="+91 98765 43210"
                    value={phone} onChange={e => setPhone(e.target.value)}
                  />
                </div>

                <div>
                  <label className="reg-label" style={labelStyle}>Relative / Emergency Contact</label>
                  <input
                    className="mw-input reg-input-text" type="tel"
                    placeholder="+91 87654 32109"
                    value={relativePhone} onChange={e => setRelativePhone(e.target.value)}
                  />
                </div>

                <div>
                  <label className="reg-label" style={labelStyle}>State <span style={{ color: "#ef4444" }}>*</span></label>
                  <select
                    required className="mw-input reg-input-text" style={{ cursor: "pointer" }}
                    value={state} onChange={e => setState(e.target.value)}
                  >
                    <option value="">Select State</option>
                    <option>Andhra Pradesh</option>
                    <option>Arunachal Pradesh</option>
                    <option>Assam</option>
                    <option>Bihar</option>
                    <option>Chhattisgarh</option>
                    <option>Goa</option>
                    <option>Gujarat</option>
                    <option>Haryana</option>
                    <option>Himachal Pradesh</option>
                    <option>Jharkhand</option>
                    <option>Karnataka</option>
                    <option>Kerala</option>
                    <option>Madhya Pradesh</option>
                    <option>Maharashtra</option>
                    <option>Manipur</option>
                    <option>Meghalaya</option>
                    <option>Mizoram</option>
                    <option>Nagaland</option>
                    <option>Odisha</option>
                    <option>Punjab</option>
                    <option>Rajasthan</option>
                    <option>Sikkim</option>
                    <option>Tamil Nadu</option>
                    <option>Telangana</option>
                    <option>Tripura</option>
                    <option>Uttar Pradesh</option>
                    <option>Uttarakhand</option>
                    <option>West Bengal</option>
                  </select>
                </div>

                <div>
                  <label className="reg-label" style={labelStyle}>District <span style={{ color: "#ef4444" }}>*</span></label>
                  <input
                    required className="mw-input reg-input-text" type="text"
                    placeholder="e.g. Guntur"
                    value={district} onChange={e => setDistrict(e.target.value)}
                  />
                </div>

                <div className="reg-address-field">
                  <label className="reg-label" style={labelStyle}>Address</label>
                  <input
                    className="mw-input reg-input-text" type="text"
                    placeholder="Door no., Street, Area"
                    value={addressLine} onChange={e => setAddressLine(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* ── Medical Details ── */}
            <div style={{ background: "white", borderRadius: 20, padding: 28, boxShadow: "0 4px 20px rgba(0,0,0,0.06)", gridColumn: "1 / -1" }} className="reg-card">
              {sectionTitle(<Stethoscope size={18} />, "Medical Details")}
              <div className="responsive-form-grid-2" style={{ gap: 20 }}>

                {/* Diagnosis dropdown – populated from API */}
                <div style={{ gridColumn: "1 / -1" }}>
                  <label className="reg-label" style={labelStyle}>Diagnosis <span style={{ color: "#ef4444" }}>*</span></label>
                  {diseasesLoading ? (
                    <div className="mw-input reg-input-text" style={{ display: "flex", alignItems: "center", gap: 8, color: "#94a3b8", cursor: "default" }}>
                      <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid #e2e8f0", borderTop: "2px solid #378ADD", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                      Loading diseases…
                      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    </div>
                  ) : diseasesError ? (
                    <div style={{ padding: "12px 16px", borderRadius: 12, background: "#fee2e2", color: "#dc2626", fontSize: 13 }}>
                      {diseasesError} — <button type="button" onClick={() => window.location.reload()} style={{ background: "none", border: "none", color: "#dc2626", textDecoration: "underline", cursor: "pointer", fontSize: 13 }}>Retry</button>
                    </div>
                  ) : (
                    <select
                      required className="mw-input reg-input-text" style={{ cursor: "pointer" }}
                      value={diseaseId} onChange={e => setDiseaseId(e.target.value)}
                    >
                      <option value="">Select Diagnosis</option>
                      {diseases.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label style={labelStyle}>Condition Type</label>
                  <div style={{ display: "flex", gap: 12 }}>
                    {["New", "Follow-up"].map(ct => (
                      <label key={ct} style={{ flex: 1, cursor: "pointer" }}>
                        <div
                          onClick={() => setConditionType(ct)}
                          style={{
                            padding: "13px 0", textAlign: "center", borderRadius: 14, fontWeight: 600, fontSize: 14, transition: "all 0.2s",
                            border: `2px solid ${conditionType === ct ? "#1D9E75" : "#e2e8f0"}`,
                            background: conditionType === ct ? "rgba(29,158,117,0.08)" : "white",
                            color: conditionType === ct ? "#1D9E75" : "#64748b",
                          }}
                        >
                          {ct === "New" ? "New Patient" : "Follow-up"}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Risk Category <span style={{ color: "#ef4444" }}>*</span></label>
                  <div style={{ display: "flex", gap: 10 }}>
                    {[
                      { v: "Low",    color: "#15803d", bg: "#f0fdf4", border: "#bbf7d0" },
                      { v: "Medium", color: "#a16207", bg: "#fefce8", border: "#fde68a" },
                      { v: "High",   color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
                    ].map(r => (
                      <div
                        key={r.v} onClick={() => setRisk(r.v)}
                        style={{
                          flex: 1, padding: "12px 0", textAlign: "center", borderRadius: 14,
                          border: `2px solid ${risk === r.v ? r.color : r.border}`,
                          background: risk === r.v ? r.bg : "white",
                          color: risk === r.v ? r.color : "#94a3b8",
                          fontWeight: 600, fontSize: 14, cursor: "pointer", transition: "all 0.2s",
                        }}
                      >
                        {r.v}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="reg-label" style={labelStyle}>Monitoring Duration (days) <span style={{ color: "#ef4444" }}>*</span></label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {[7, 10, 14].map(d => (
                      <button
                        key={d} type="button" onClick={() => setDuration(String(d))}
                        style={{
                          flex: 1, padding: "12px 0", borderRadius: 12, fontSize: 13,
                          border: `2px solid ${duration === String(d) ? "#1D9E75" : "#e2e8f0"}`,
                          background: duration === String(d) ? "rgba(29,158,117,0.08)" : "white",
                          color: duration === String(d) ? "#1D9E75" : "#64748b",
                          fontWeight: 600, cursor: "pointer", transition: "all 0.2s",
                        }}
                      >
                        {d}
                      </button>
                    ))}

                  </div>
                </div>
              </div>
            </div>

            {/* ── Consent + Submit ── */}
            <div style={{ background: "white", borderRadius: 20, padding: 28, boxShadow: "0 4px 20px rgba(0,0,0,0.06)", gridColumn: "1 / -1" }} className="reg-card">
              <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", marginBottom: 24 }}>
                <input
                  type="checkbox" required
                  style={{ width: 20, height: 20, accentColor: "#1D9E75", cursor: "pointer" }}
                  checked={consent} onChange={e => setConsent(e.target.checked)}
                />
                <span className="reg-label" style={{ fontSize: 14, color: "#374151" }}>
                  Patient consent form signed and understood <span style={{ color: "#ef4444" }}>*</span>
                </span>
              </label>

              {/* Error banner – shown near submit so user sees it in context */}
              {apiError && (
                <div style={{ background: "#fee2e2", color: "#dc2626", padding: "12px 18px", borderRadius: 12, marginBottom: 16, fontSize: 14, fontWeight: 500, display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <span style={{ flexShrink: 0, marginTop: 1 }}>⚠</span>
                  <span>{apiError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || diseasesLoading}
                className="btn-primary reg-button-text"
                style={{
                  width: "100%", padding: "18px", fontSize: 17, borderRadius: 18,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                  opacity: loading ? 0.7 : 1, cursor: loading ? "not-allowed" : "pointer",
                }}
              >
                {loading ? (
                  <>
                    <span style={{ display: "inline-block", width: 18, height: 18, border: "3px solid rgba(255,255,255,0.4)", borderTop: "3px solid white", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                    Registering…
                  </>
                ) : "REGISTER PATIENT"}
              </button>

              <p className="reg-helper-text" style={{ textAlign: "center", color: "#94a3b8", fontSize: 12, marginTop: 12 }}>
                All fields are securely saved • Auto timestamped
              </p>
            </div>
          </div>
        </form>
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Address sits beside District on tablet/desktop, full-width only on mobile */
        .reg-address-field { grid-column: auto; }

        /* Tablet 768–1023px */
        @media (max-width: 1023px) {
          .reg-header-title    { font-size: 24px !important; }
          .reg-header-subtitle { font-size: 12px !important; }
          .reg-section-title   { font-size: 16px !important; }
          .reg-label           { font-size: 12px !important; }
          .reg-button-text     { font-size: 15px !important; }
          .reg-helper-text     { font-size: 11px !important; }
        }

        /* Mobile ≤767px */
        @media (max-width: 767px) {
          .reg-header-title    { font-size: 20px !important; }
          .reg-header-subtitle { font-size: 11px !important; }
          .reg-section-title   { font-size: 14px !important; }
          .reg-label           { font-size: 11px !important; }
          .reg-button-text     { font-size: 13px !important; }
          .reg-helper-text     { font-size: 12px !important; }
          .reg-input-text      { font-size: 13px !important; }
          .reg-card            { padding: 20px !important; }
          .responsive-form-grid-3 { grid-template-columns: repeat(2, 1fr) !important; }
          .responsive-form-grid-3 > div:first-child { grid-column: 1 / -1 !important; }
          .reg-age-gender      { grid-column: auto !important; }
          .reg-address-field   { grid-column: 1 / -1 !important; }
        }

        /* Small Mobile ≤480px */
        @media (max-width: 480px) {
          .reg-header-title    { font-size: 18px !important; }
          .reg-header-subtitle { font-size: 12px !important; }
          .reg-section-title   { font-size: 13px !important; }
          .reg-label           { font-size: 12px !important; }
          .reg-button-text     { font-size: 12px !important; }
          .reg-helper-text     { font-size: 9px  !important; }
          .reg-input-text      { font-size: 12px !important; }
          .reg-card            { padding: 16px !important; }
        }
      `}</style>
    </div>
  );
}
