"use client";
import Sidebar from "@/components/Sidebar";
import { DOCTOR } from "@/lib/dummyData";
import { User, Stethoscope, Smartphone, Mail, Star, FileText, Lock, Hospital } from "lucide-react";

export default function ProfilePage() {
  return (
    <div className="page-shell">
      <Sidebar />
      <main className="main-content" style={{ padding: 32 }}>
        <div style={{ background: "#378ADD", padding: "20px 24px", borderRadius: 16, marginBottom: 28, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
          <div>
            <h1 className="heading-font" style={{ fontSize: 28, fontWeight: 800, color: "white", margin: 0 }}>My Profile</h1>
            <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 14, marginTop: 4 }}>Your professional information</p>
          </div>
          <button className="btn-primary" style={{ fontSize: 13, padding: "10px 20px", whiteSpace: "nowrap", background:"#3cdba9" }}>Edit Profile</button>
        </div>

        <div style={{ maxWidth: 1220 }}>
          {/* Avatar Card */}
          

          {/* Grid for Details and Change Password */}
          <div className="responsive-grid-2" style={{ gap: 24 }}>
            {/* Details */}
            <div style={{ background: "white", borderRadius: 20, padding: 28, boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
              <h3 className="heading-font" style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 20 }}>Professional Details</h3>
              <div className="responsive-grid-2" style={{ gap: 20 }}>
                {[
                  { label: "Full Name", value: DOCTOR.name, icon: User },
                  { label: "Specialization", value: DOCTOR.specialization, icon: Stethoscope },
                  { label: "Phone", value: DOCTOR.phone, icon: Smartphone },
                  { label: "Email", value: DOCTOR.email, icon: Mail },
                  { label: "Experience", value: DOCTOR.experience, icon: Star },
                  { label: "License No.", value: DOCTOR.license, icon: FileText },
                  { label: "Hospital", value: DOCTOR.hospital, icon: Hospital },
                ].map(item => (
                  <div key={item.label} style={{ padding: "16px", background: "#fafafa", borderRadius: 14, border: "1px solid #f1f5f9" }}>
                    <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                      <item.icon size={14} style={{ color: "#64748b" }} />{item.label}
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#0f172a" }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Change Password */}
            <div style={{ background: "white", borderRadius: 20, padding: 28, boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
              <h3 className="heading-font" style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}><Lock size={16} />Change Password</h3>
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
