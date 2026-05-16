"use client";
import Sidebar from "@/components/Sidebar";
import { DOCTOR } from "@/lib/dummyData";

export default function ProfilePage() {
  return (
    <div style={{ display: "flex" }}>
      <Sidebar />
      <main className="main-content" style={{ padding: 32 }}>
        <div style={{ background: "#378ADD", padding: "20px 24px", borderRadius: 16, marginBottom: 28 }}>
          <h1 className="heading-font" style={{ fontSize: 28, fontWeight: 800, color: "white", margin: 0 }}>My Profile</h1>
          <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 14, marginTop: 4 }}>Your professional information</p>
        </div>

        <div style={{ maxWidth: 1220 }}>
          {/* Avatar Card */}
          <div style={{
            background: "linear-gradient(135deg,#0f172a,#1e3a5f)", borderRadius: 24, padding: 32,
            marginBottom: 24, display: "flex", alignItems: "center", gap: 24
          }}>
            <div style={{
              width: 88, height: 88, borderRadius: "50%",
              background: "linear-gradient(135deg,#BA7517,#f59e0b)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "white", fontSize: 36, fontWeight: 800, flexShrink: 0
            }}>A</div>
            <div>
              <h2 className="heading-font" style={{ color: "white", fontSize: 26, fontWeight: 800, margin: 0 }}>{DOCTOR.name}</h2>
              <p style={{ color: "#94a3b8", margin: "6px 0 0", fontSize: 15 }}>{DOCTOR.specialization}</p>
              <p style={{ color: "#64748b", margin: "4px 0 0", fontSize: 13 }}>{DOCTOR.hospital}</p>
            </div>
            <div style={{ marginLeft: "auto" }}>
              <button className="btn-primary" style={{ fontSize: 13, padding: "10px 20px" }}>Edit Profile</button>
            </div>
          </div>

          {/* Grid for Details and Change Password */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            {/* Details */}
            <div style={{ background: "white", borderRadius: 20, padding: 28, boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
              <h3 className="heading-font" style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 20 }}>Professional Details</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                {[
                  { label: "Full Name", value: DOCTOR.name, icon: "👤" },
                  { label: "Specialization", value: DOCTOR.specialization, icon: "🩺" },
                  { label: "Phone", value: DOCTOR.phone, icon: "📱" },
                  { label: "Email", value: DOCTOR.email, icon: "📧" },
                  { label: "Experience", value: DOCTOR.experience, icon: "⭐" },
                  { label: "License No.", value: DOCTOR.license, icon: "📋" },
                  { label: "Hospital", value: DOCTOR.hospital, icon: "🏥" },
                ].map(item => (
                  <div key={item.label} style={{ padding: "16px", background: "#fafafa", borderRadius: 14, border: "1px solid #f1f5f9" }}>
                    <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                      <span>{item.icon}</span>{item.label}
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#0f172a" }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Change Password */}
            <div style={{ background: "white", borderRadius: 20, padding: 28, boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
              <h3 className="heading-font" style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 20 }}>🔒 Change Password</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {["Current Password", "New Password", "Confirm New Password"].map(label => (
                  <div key={label}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 8 }}>{label}</label>
                    <input type="password" className="mw-input" placeholder="••••••••" />
                  </div>
                ))}
                <button className="btn-primary" style={{ alignSelf: "flex-start", marginTop: 4 }}>Update Password</button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
