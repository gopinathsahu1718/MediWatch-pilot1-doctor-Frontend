"use client";
import { use } from "react";
import Sidebar from "@/components/Sidebar";
import { DUMMY_PATIENTS } from "@/lib/dummyData";
import { useRouter } from "next/navigation";

export default function PatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const patient = DUMMY_PATIENTS.find(p => p.id === id);

  if (!patient) {
    return (
      <div style={{ display: "flex" }}>
        <Sidebar />
        <main className="main-content" style={{ padding: 32, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 64 }}>😕</div>
            <h2 className="heading-font" style={{ fontSize: 24, color: "#0f172a" }}>Patient Not Found</h2>
            <button className="btn-primary" onClick={() => router.push("/patients")} style={{ marginTop: 16 }}>← Back to Patients</button>
          </div>
        </main>
      </div>
    );
  }

  const riskColor = patient.risk === "High" ? "#dc2626" : patient.risk === "Medium" ? "#d97706" : "#15803d";
  const riskBg = patient.risk === "High" ? "#fef2f2" : patient.risk === "Medium" ? "#fefce8" : "#f0fdf4";

  return (
    <div style={{ display: "flex" }}>
      <Sidebar />
      <main className="main-content" style={{ padding: 32 }}>
        {/* Back */}
        <button onClick={() => router.back()} style={{
          background: "none", border: "none", color: "#64748b", fontWeight: 600,
          fontSize: 14, cursor: "pointer", marginBottom: 20, display: "flex", alignItems: "center", gap: 6
        }}>← Back</button>

        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)",
          borderRadius: 24, padding: 28, marginBottom: 24, display: "flex", alignItems: "center", gap: 20
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: "linear-gradient(135deg, #1D9E75, #378ADD)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "white", fontSize: 24, fontWeight: 700, flexShrink: 0
          }}>{patient.name.charAt(0)}</div>
          <div style={{ flex: 1 }}>
            <h1 className="heading-font" style={{ color: "white", fontSize: 24, fontWeight: 800, margin: 0 }}>{patient.name}</h1>
            <p style={{ color: "#94a3b8", margin: "4px 0 0", fontSize: 14 }}>{patient.id} • {patient.age} yrs • {patient.gender} • {patient.district}, {patient.state}</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ background: riskBg, color: riskColor, padding: "6px 18px", borderRadius: 99, fontWeight: 700, fontSize: 14 }}>{patient.risk} Risk</div>
            <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 8 }}>Registered: {patient.registeredOn}</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          {/* Personal Info */}
          <div style={{ background: "white", borderRadius: 20, padding: 24, boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
            <h3 className="heading-font" style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>Personal Information</h3>
            {[
              ["Contact", patient.contact],
              ["Emergency Contact", patient.relativeContact || "—"],
              ["State", patient.state],
              ["District", patient.district],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #f8fafc" }}>
                <span style={{ color: "#94a3b8", fontSize: 13 }}>{k}</span>
                <span style={{ color: "#0f172a", fontSize: 13, fontWeight: 500 }}>{v}</span>
              </div>
            ))}
          </div>

          {/* Medical Info */}
          <div style={{ background: "white", borderRadius: 20, padding: 24, boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
            <h3 className="heading-font" style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>Medical Information</h3>
            {[
              ["Diagnosis", patient.diagnosis],
              ["Condition Type", patient.conditionType],
              ["Monitoring Duration", `${patient.monitoringDays} days`],
              ["Days Submitted", `${patient.submissions.length} / ${patient.monitoringDays}`],
              ["Status", patient.status],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #f8fafc" }}>
                <span style={{ color: "#94a3b8", fontSize: 13 }}>{k}</span>
                <span style={{ color: "#0f172a", fontSize: 13, fontWeight: 500 }}>{v}</span>
              </div>
            ))}
          </div>

          {/* Medicines */}
          <div style={{ background: "white", borderRadius: 20, padding: 24, boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
            <h3 className="heading-font" style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>💊 Prescribed Medicines</h3>
            {patient.medicines.map((m, i) => (
              <div key={i} style={{ background: "#fafafa", borderRadius: 14, padding: "14px 16px", marginBottom: 10, border: "1px solid #f1f5f9" }}>
                <div style={{ fontWeight: 600, color: "#0f172a", fontSize: 14 }}>{m.name}</div>
                <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>
                  {m.duration} days • {m.frequency} • {m.instruction}
                </div>
              </div>
            ))}
          </div>

          {/* Monitoring History */}
          <div style={{ background: "white", borderRadius: 20, padding: 24, boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
            <h3 className="heading-font" style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>📊 Monitoring History</h3>
            {patient.submissions.length === 0 && (
              <div style={{ textAlign: "center", color: "#94a3b8", padding: "24px 0" }}>No submissions yet</div>
            )}
            {patient.submissions.map((s) => (
              <div key={s.day} style={{ borderRadius: 14, padding: "14px 16px", marginBottom: 10, border: "1px solid #f1f5f9", background: "#fafafa" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, color: "#0f172a", fontSize: 13 }}>Day {s.day}</span>
                  <span style={{ color: "#94a3b8", fontSize: 12 }}>{s.date}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  <div style={{ textAlign: "center", background: "white", borderRadius: 10, padding: "8px 4px" }}>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>Pain</div>
                    <div style={{ fontWeight: 700, color: "#dc2626", fontSize: 18 }}>{s.painScore}</div>
                  </div>
                  <div style={{ textAlign: "center", background: "white", borderRadius: 10, padding: "8px 4px" }}>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>Swelling</div>
                    <div style={{ fontWeight: 600, color: "#0f172a", fontSize: 12 }}>{s.swelling}</div>
                  </div>
                  <div style={{ textAlign: "center", background: "white", borderRadius: 10, padding: "8px 4px" }}>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>Mobility</div>
                    <div style={{ fontWeight: 600, color: "#0f172a", fontSize: 12 }}>{s.mobility}</div>
                  </div>
                </div>
                {s.notes && <div style={{ marginTop: 8, color: "#475569", fontSize: 12, fontStyle: "italic" }}>{s.notes}</div>}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
