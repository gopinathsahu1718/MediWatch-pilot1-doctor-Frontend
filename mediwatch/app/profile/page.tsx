"use client";
import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import {
  User, Stethoscope, Smartphone, Mail, Star,
  FileText, Lock, Hospital, Pencil, X, Check,
  Eye, EyeOff, AlertCircle, CheckCircle2,
} from "lucide-react";

const BASE_URL = "https://api.mediwatch.in";

// ─── Types ────────────────────────────────────────────────────────────────────
interface DoctorProfile {
  name: string;
  phone: string;
  email?: string;
  specialization?: string;
  experience?: string;
  license?: string;
  hospital?: string;
  department_name?: string;
  [key: string]: string | undefined;
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ message, type, onClose }: { message: string; type: "success" | "error"; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 9999,
      display: "flex", alignItems: "center", gap: 10,
      background: type === "success" ? "#f0fdf4" : "#fef2f2",
      border: `1px solid ${type === "success" ? "#bbf7d0" : "#fecaca"}`,
      color: type === "success" ? "#15803d" : "#dc2626",
      padding: "14px 18px", borderRadius: 14,
      boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
      fontSize: 14, fontWeight: 600, maxWidth: 360,
      animation: "slideInToast 0.3s cubic-bezier(0.4,0,0.2,1)",
    }}>
      {type === "success"
        ? <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
        : <AlertCircle size={18} style={{ flexShrink: 0 }} />}
      {message}
      <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "inherit", padding: 0, display: "flex" }}>
        <X size={15} />
      </button>
      <style>{`@keyframes slideInToast { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }`}</style>
    </div>
  );
}

// ─── Field Card ───────────────────────────────────────────────────────────────
function FieldCard({ label, value, icon: Icon }: { label: string; value?: string; icon: React.ElementType }) {
  return (
    <div style={{ padding: "16px", background: "#fafafa", borderRadius: 14, border: "1px solid #f1f5f9" }}>
      <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
        <Icon size={14} style={{ color: "#64748b" }} />{label}
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, color: value ? "#0f172a" : "#cbd5e1" }}>
        {value || "—"}
      </div>
    </div>
  );
}

// ─── Password Input ───────────────────────────────────────────────────────────
function PasswordInput({ value, onChange, placeholder, hasError = false }: { value: string; onChange: (v: string) => void; placeholder: string; hasError?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input
        type={show ? "text" : "password"}
        className="mw-input"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ 
          paddingRight: 44,
          borderColor: hasError ? "#dc2626" : undefined,
          borderWidth: hasError ? "1.5px" : undefined,
        }}
      />
      <button
        type="button"
        onClick={() => setShow(v => !v)}
        style={{
          position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
          background: "none", border: "none", cursor: "pointer", color: hasError ? "#dc2626" : "#94a3b8", display: "flex",
        }}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const [profile, setProfile] = useState<DoctorProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [fetchError, setFetchError] = useState("");

  // Edit profile state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Change password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ current?: boolean; new?: boolean; confirm?: boolean }>({});

  // Toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error") => setToast({ message, type });

  // ── Fetch profile ──────────────────────────────────────────────────────────
  useEffect(() => {
    async function fetchProfile() {
      setLoadingProfile(true);
      setFetchError("");
      try {
        const token = localStorage.getItem("doctor_token");
        const res = await fetch(`${BASE_URL}/api/v1/doctor/profile`, {
          headers: { "Authorization": `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) {
          setFetchError(data?.message || "Failed to load profile.");
          return;
        }
        const prof: DoctorProfile = data?.data || data?.doctor || data;
        setProfile(prof);
        setEditName(prof.name || "");
        setEditPhone(prof.phone || "");
        setEditEmail(prof.email || "");
      } catch {
        setFetchError("Network error. Could not load profile.");
      } finally {
        setLoadingProfile(false);
      }
    }
    fetchProfile();
  }, []);

  // ── Save profile ───────────────────────────────────────────────────────────
  async function handleSaveProfile() {
    if (!editName.trim()) { showToast("Name cannot be empty.", "error"); return; }
    if (editEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editEmail.trim())) {
      showToast("Enter a valid email address.", "error");
      return;
    }
    setSavingProfile(true);
    try {
      const token = localStorage.getItem("doctor_token");
      const payload: Record<string, string> = {};
      if (editName.trim()) payload.name = editName.trim();
      if (editEmail.trim()) payload.email = editEmail.trim();

      const res = await fetch(`${BASE_URL}/api/v1/doctor/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data?.message || "Failed to update profile.", "error");
        return;
      }
      const responseProfile = (data?.data || data?.doctor || {}) as Partial<DoctorProfile>;
      const updated: DoctorProfile = {
        ...profile!,
        ...responseProfile,
        name: editName.trim(),
        email: editEmail.trim() || profile?.email || "",
        phone: editPhone,
      };
      setProfile(updated);
      setEditing(false);
      showToast("Profile updated successfully!", "success");
    } catch {
      showToast("Network error. Please try again.", "error");
    } finally {
      setSavingProfile(false);
    }
  }

  function cancelEdit() {
    setEditName(profile?.name || "");
    setEditPhone(profile?.phone || "");
    setEditing(false);
  }

  // ── Change password ────────────────────────────────────────────────────────
  async function handleChangePassword() {
    setPwError("");
    setFieldErrors({});
    const errors: { current?: boolean; new?: boolean; confirm?: boolean } = {};
    let hasError = false;

    if (!currentPassword) { 
      setPwError("Enter your current password.");
      errors.current = true;
      hasError = true;
    }
    if (newPassword.length < 6) { 
      setPwError("New password must be at least 6 characters.");
      errors.new = true;
      hasError = true;
    }
    if (newPassword !== confirmPassword) { 
      setPwError("Passwords do not match.");
      errors.confirm = true;
      hasError = true;
    }
    
    setFieldErrors(errors);
    if (hasError) return;

    setPwLoading(true);
    try {
      const token = localStorage.getItem("doctor_token");
      const res = await fetch(`${BASE_URL}/api/v1/auth/staff/change-password`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPwError(data?.message || "Failed to change password.");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setFieldErrors({});
      showToast("Password changed successfully!", "success");
    } catch {
      setPwError("Network error. Please try again.");
    } finally {
      setPwLoading(false);
    }
  }

  // Auto-dismiss error message after 10 seconds
  useEffect(() => {
    if (pwError) {
      const t = setTimeout(() => setPwError(""), 10000);
      return () => clearTimeout(t);
    }
  }, [pwError]);

  // ── Derived display values ─────────────────────────────────────────────────
  const initials = profile?.name
    ? profile.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()
    : "DR";

  const fields = profile
    ? [
        { label: "Email",      value: profile.email,           icon: Mail       },
        { label: "Hospital",   value: profile.hospital,        icon: Hospital   },
        { label: "Department", value: profile.department_name, icon: Stethoscope },
      ]
    : [];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="page-shell">
      <Sidebar />
      <main className="main-content" style={{ padding: 32 }}>

        {/* Header */}
        <div style={{
          background: "#378ADD", padding: "20px 24px", borderRadius: 16,
          marginBottom: 28, display: "flex", alignItems: "center",
          justifyContent: "space-between", gap: 20,
        }}>
          <div>
            <h1 className="heading-font" style={{ fontSize: 28, fontWeight: 800, color: "white", margin: 0 }}>My Profile</h1>
            <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 14, marginTop: 4 }}>Your professional information</p>
          </div>
          {!editing && !loadingProfile && profile && (
            <button
              className="btn-primary"
              onClick={() => setEditing(true)}
              style={{ fontSize: 13, padding: "10px 20px", whiteSpace: "nowrap", background: "#3cdba9", display: "flex", alignItems: "center", gap: 6 }}
            >
              <Pencil size={14} /> Edit Profile
            </button>
          )}
        </div>

        <div style={{ maxWidth: 1220 }}>

          {/* Loading / Error state */}
          {loadingProfile && (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#94a3b8", fontSize: 15 }}>
              Loading profile…
            </div>
          )}
          {fetchError && !loadingProfile && (
            <div style={{ background: "#fee2e2", color: "#dc2626", padding: "14px 20px", borderRadius: 14, marginBottom: 24, display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
              <AlertCircle size={16} /> {fetchError}
            </div>
          )}

          {/* Avatar Card */}
          {/* {profile && (
            <div style={{
              background: "white", borderRadius: 20, padding: "24px 28px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.06)", marginBottom: 24,
              display: "flex", alignItems: "center", gap: 20,
            }}>
              <div style={{
                width: 72, height: 72, borderRadius: "50%",
                background: "linear-gradient(135deg, #378ADD, #1D9E75)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 26, fontWeight: 800, color: "white", flexShrink: 0,
              }}>
                {initials}
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#0f172a" }}>{profile.name}</div>
                {profile.department_name && (
                  <div style={{ fontSize: 13, color: "#64748b", marginTop: 3 }}>{profile.department_name}</div>
                )}
                {profile.phone && (
                  <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 2 }}>{profile.phone}</div>
                )}
              </div>
            </div>
          )} */}

          {/* Main grid */}
          {profile && (
            <div className="responsive-grid-2" style={{ gap: 24 }}>

              {/* ── Professional Details / Edit Form ── */}
              <div style={{ background: "white", borderRadius: 20, padding: 28, boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                  <h3 className="heading-font" style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", margin: 0 }}>
                    Professional Details
                  </h3>
                  {editing && (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={cancelEdit}
                        style={{
                          display: "flex", alignItems: "center", gap: 5, padding: "7px 14px",
                          borderRadius: 10, border: "1.5px solid #e2e8f0", background: "#f8fafc",
                          color: "#374151", fontSize: 13, fontWeight: 600, cursor: "pointer",
                        }}
                      >
                        <X size={13} /> Cancel
                      </button>
                      <button
                        onClick={handleSaveProfile}
                        disabled={savingProfile}
                        style={{
                          display: "flex", alignItems: "center", gap: 5, padding: "7px 14px",
                          borderRadius: 10, border: "none",
                          background: savingProfile ? "#94a3b8" : "linear-gradient(to right, #1D9E75, #378ADD)",
                          color: "white", fontSize: 13, fontWeight: 600,
                          cursor: savingProfile ? "not-allowed" : "pointer",
                        }}
                      >
                        <Check size={13} /> {savingProfile ? "Saving…" : "Save"}
                      </button>
                    </div>
                  )}
                </div>

                <div style={{ background: "#f8fafc", borderRadius: 18, padding: 20, marginBottom: 24, display: "flex", alignItems: "center", gap: 20, border: "1px solid #e2e8f0" }}>
                  <div style={{ width: 70, height: 70, borderRadius: "50%", background: "linear-gradient(135deg,#378ADD,#1D9E75)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 800, color: "white", flexShrink: 0 }}>
                    {initials}
                  </div>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>{profile.name}</div>
                    {profile.phone && (
                      <div style={{ fontSize: 15, fontWeight: 600, color: "#475569", marginTop: 8 }}>{profile.phone}</div>
                    )}
                  </div>
                </div>

                {editing ? (
                  /* Edit mode: only name is editable */
                  <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    <div style={{ padding: 24, background: "#f8fafc", borderRadius: 18, border: "1px solid #e2e8f0" }}>
                      <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 10 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><User size={14} /> Full Name</span>
                      </label>
                      <input
                        type="text"
                        className="mw-input"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        placeholder="Dr. Full Name"
                        style={{ width: "100%" }}
                      />
                    </div>

                    <div style={{ display: "grid", gap: 16 }}>
                      <div style={{ padding: "18px 20px", background: "#ffffff", borderRadius: 18, border: "1px solid #e2e8f0" }}>
                        <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600, marginBottom: 10 }}>Email Address</div>
                        <input
                          type="email"
                          className="mw-input"
                          value={editEmail}
                          onChange={e => setEditEmail(e.target.value)}
                          placeholder="name@example.com"
                          style={{ width: "100%" }}
                        />
                      </div>
                      <div style={{ padding: "18px 20px", background: "#f8fafc", borderRadius: 18, border: "1px solid #e2e8f0" }}>
                        <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600, marginBottom: 10 }}>Phone Number</div>
                        <input
                          type="tel"
                          className="mw-input"
                          value={editPhone}
                          readOnly
                          style={{ width: "100%", background: "#f8fafc", cursor: "not-allowed" }}
                        />
                      </div>
                    </div>

                    <div className="responsive-grid-2" style={{ gap: 14 }}>
                      {fields.filter(f => f.label !== "Full Name").map(item => (
                        <FieldCard key={item.label} {...item} />
                      ))}
                    </div>
                  </div>
                ) : (
                  /* View mode */
                  <div className="responsive-grid-2" style={{ gap: 20 }}>
                    {fields.map(item => (
                      <FieldCard key={item.label} {...item} />
                    ))}
                  </div>
                )}
              </div>

              {/* ── Change Password ── */}
              <div style={{ background: "white", borderRadius: 20, padding: 28, boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
                <h3 className="heading-font" style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
                  <Lock size={16} /> Change Password
                </h3>

                {pwError && (
                  <div style={{
                    background: "#fee2e2", color: "#dc2626",
                    padding: "10px 14px", borderRadius: 12,
                    marginBottom: 16, fontSize: 13,
                    display: "flex", alignItems: "center", gap: 8,
                  }}>
                    <AlertCircle size={14} /> {pwError}
                  </div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, color: fieldErrors.current ? "#dc2626" : "#374151", display: "block", marginBottom: 8 }}>Current Password</label>
                    <PasswordInput value={currentPassword} onChange={setCurrentPassword} placeholder="Enter current password" hasError={fieldErrors.current} />
                  </div>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, color: fieldErrors.new ? "#dc2626" : "#374151", display: "block", marginBottom: 8 }}>New Password</label>
                    <PasswordInput value={newPassword} onChange={setNewPassword} placeholder="At least 6 characters" hasError={fieldErrors.new} />
                  </div>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, color: fieldErrors.confirm ? "#dc2626" : "#374151", display: "block", marginBottom: 8 }}>Confirm New Password</label>
                    <PasswordInput value={confirmPassword} onChange={setConfirmPassword} placeholder="Re-enter new password" hasError={fieldErrors.confirm} />
                  </div>

                  {/* Strength indicator */}
                  {newPassword.length > 0 && (
                    <div style={{ display: "flex", gap: 4 }}>
                      {[1, 2, 3, 4].map(level => {
                        const strength = newPassword.length >= 12 ? 4 : newPassword.length >= 9 ? 3 : newPassword.length >= 6 ? 2 : 1;
                        const colors = ["#ef4444", "#f97316", "#eab308", "#22c55e"];
                        return (
                          <div key={level} style={{
                            flex: 1, height: 4, borderRadius: 2,
                            background: level <= strength ? colors[strength - 1] : "#e2e8f0",
                            transition: "background 0.3s",
                          }} />
                        );
                      })}
                    </div>
                  )}

                  <button
                    onClick={handleChangePassword}
                    disabled={pwLoading}
                    className="btn-primary"
                    style={{ alignSelf: "flex-start", marginTop: 4, opacity: pwLoading ? 0.7 : 1, cursor: pwLoading ? "not-allowed" : "pointer" }}
                  >
                    {pwLoading ? "Updating…" : "Update Password"}
                  </button>
                </div>
              </div>

            </div>
          )}
        </div>
      </main>

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}