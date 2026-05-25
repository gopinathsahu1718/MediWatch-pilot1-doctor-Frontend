"use client";
// import { Suspense, useState } from "react";
import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Smartphone, Lock, Eye, EyeOff } from "lucide-react";

const BASE_URL = "https://api.mediwatch.in";

type Step = "login" | "reset1" | "reset2" | "reset3";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>("login");

  // Login state
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  // Reset flow state
  const [resetPhone, setResetPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");

  // UI state
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // 👁 Eye toggle state – one per password field
  const [showPassword, setShowPassword]       = useState(false);
  const [showNewPass, setShowNewPass]         = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  // ─── Login ───────────────────────────────────────────────────────────────
// If already logged in, redirect to dashboard
useEffect(() => {
  const token = document.cookie
    .split("; ")
    .find(row => row.startsWith("doctor_token="))
    ?.split("=")[1];

  if (token) {
    window.location.href = "/dashboard";
  }
}, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (phone.length < 10) { setError("Enter a valid phone number"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }

    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/v1/auth/staff/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.message || "Login failed. Please check your credentials.");
        return;
      }

      // Store token in localStorage (client reads) and cookie (middleware reads)
      const token = data?.token || data?.data?.token || data?.accessToken;
      if (token) {
        localStorage.setItem("doctor_token", token);
        // Secure cookie for middleware – expires in 7 days
        document.cookie = `doctor_token=${token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Strict`;
      }

      // Redirect to the originally requested page, or dashboard
      // window.location.href forces a full HTTP request so middleware
      // can read the cookie and allow the user through
      const redirectTo = searchParams.get("redirect") || "/dashboard";
      window.location.href = redirectTo;
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  // ─── Step 1 – Send OTP ───────────────────────────────────────────────────
  async function sendOTP() {
    if (resetPhone.length < 10) { setError("Enter a valid phone number"); return; }
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/v1/auth/staff/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: resetPhone }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.message || "Failed to send OTP. Please try again.");
        return;
      }

      setStep("reset2");
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  // ─── Step 2 – Verify OTP ─────────────────────────────────────────────────
  async function verifyOTP() {
    if (otp.length !== 6) { setError("Enter a valid 6-digit OTP"); return; }
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/v1/auth/staff/verify-reset-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: resetPhone, otp }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.message || "Invalid or expired OTP. Please try again.");
        return;
      }

      const token = data?.resetToken || data?.data?.resetToken || data?.token;
      if (!token) {
        setError("Something went wrong. Please restart the reset flow.");
        return;
      }
      setResetToken(token);
      setStep("reset3");
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  // ─── Step 3 – Reset Password ──────────────────────────────────────────────
  async function doReset() {
    if (newPass.length < 6) { setError("Password must be at least 6 characters"); return; }
    if (newPass !== confirmPass) { setError("Passwords do not match"); return; }
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/v1/auth/staff/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resetToken,
          newPassword: newPass,
          confirmPassword: confirmPass,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.message || "Failed to reset password. Please try again.");
        return;
      }

      setSuccess("Password reset successfully! You can now login.");
      setTimeout(() => {
        setSuccess("");
        setOtp("");
        setNewPass("");
        setConfirmPass("");
        setResetPhone("");
        setResetToken("");
        setShowNewPass(false);
        setShowConfirmPass(false);
        setStep("login");
      }, 2000);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  function goToLogin() {
    setStep("login");
    setError("");
    setSuccess("");
    setOtp("");
    setNewPass("");
    setConfirmPass("");
    setResetPhone("");
    setResetToken("");
    setShowNewPass(false);
    setShowConfirmPass(false);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "15px 48px 15px 48px",
    borderRadius: 16, border: "1.5px solid #e2e8f0",
    outline: "none", fontSize: 16, transition: "all 0.25s",
    fontFamily: "'DM Sans', sans-serif", background: "#fafafa",
    boxSizing: "border-box",
  };

  const btnPrimaryStyle: React.CSSProperties = {
    width: "100%", padding: "16px", fontSize: 16, borderRadius: 16,
    background: loading ? "#94a3b8" : "linear-gradient(to right, #1D9E75, #378ADD)",
    color: "white", border: "none", fontWeight: 700,
    cursor: loading ? "not-allowed" : "pointer", transition: "opacity 0.2s",
  };

  const eyeBtnStyle: React.CSSProperties = {
    position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)",
    background: "none", border: "none", cursor: "pointer",
    color: "#94a3b8", display: "inline-flex", alignItems: "center",
    padding: 4, borderRadius: 6, transition: "color 0.2s",
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
      padding: 16,
    }}>
      <div style={{ width: "100%", maxWidth: 440 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 0 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 14 }}>
            <div style={{ padding: "18px 14px 10px", borderBottom: "1px solid rgba(255,255,255,0.08)", textAlign: "center", margin: "auto" }}>
              <img src="/imageLogo.png" alt="MediWatch Logo" style={{ width: "100%", maxWidth: 300, height: "auto" }} />
            </div>
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: "white", borderRadius: 28,
          boxShadow: "0 30px 60px rgba(0,0,0,0.4)", overflow: "hidden",
        }}>

          {/* ── Login ── */}
          {step === "login" && (
            <div>
              <div style={{ padding: "32px 32px 16px", textAlign: "center" }}>
                <h2 className="heading-font" style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", margin: 0 }}>Welcome Doctor</h2>
                <p style={{ color: "#94a3b8", fontSize: 14, marginTop: 6 }}>Sign in to access your dashboard</p>
              </div>
              <form onSubmit={handleLogin} style={{ padding: "16px 32px 32px" }}>
                {error && (
                  <div style={{ background: "#fee2e2", color: "#dc2626", padding: "10px 16px", borderRadius: 12, marginBottom: 16, fontSize: 14 }}>
                    {error}
                  </div>
                )}

                {/* Phone */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 8 }}>Phone Number</label>
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: 18, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", display: "inline-flex" }}>
                      <Smartphone size={16} />
                    </span>
                    <input
                      type="tel" placeholder="+91 98765 43210" value={phone}
                      onChange={e => setPhone(e.target.value)} required style={inputStyle}
                      onFocus={e => { e.target.style.borderColor = "#378ADD"; e.target.style.boxShadow = "0 0 0 4px rgba(55,138,221,0.15)"; }}
                      onBlur={e => { e.target.style.borderColor = "#e2e8f0"; e.target.style.boxShadow = "none"; }}
                    />
                  </div>
                </div>

                {/* Password */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 8 }}>Password</label>
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: 18, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", display: "inline-flex" }}>
                      <Lock size={16} />
                    </span>
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••" value={password}
                      onChange={e => setPassword(e.target.value)} required style={inputStyle}
                      onFocus={e => { e.target.style.borderColor = "#378ADD"; e.target.style.boxShadow = "0 0 0 4px rgba(55,138,221,0.15)"; }}
                      onBlur={e => { e.target.style.borderColor = "#e2e8f0"; e.target.style.boxShadow = "none"; }}
                    />
                    <button
                      type="button"
                      style={eyeBtnStyle}
                      onClick={() => setShowPassword(v => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                  <button type="button" onClick={() => { setStep("reset1"); setError(""); }}
                    style={{ background: "none", border: "none", color: "#378ADD", fontSize: 13, fontWeight: 600, cursor: "pointer", margin: "auto" }}>
                    Forgot Password?
                  </button>
                </div>

                <button type="submit" disabled={loading} style={btnPrimaryStyle}>
                  {loading ? "Signing in…" : "Sign In"}
                </button>
              </form>
            </div>
          )}

          {/* ── Reset Step 1: Enter Phone ── */}
          {step === "reset1" && (
            <div style={{ padding: 32 }}>
              <h3 className="heading-font" style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>Reset Password</h3>
              <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 24 }}>Enter your registered phone number</p>
              {error && (
                <div style={{ background: "#fee2e2", color: "#dc2626", padding: "10px 16px", borderRadius: 12, marginBottom: 16, fontSize: 14 }}>
                  {error}
                </div>
              )}
              <input
                type="tel" className="mw-input" placeholder="+91 98765 43210"
                value={resetPhone} onChange={e => setResetPhone(e.target.value)}
              />
              <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
                <button className="btn-outline" onClick={goToLogin} style={{ flex: 1 }} disabled={loading}>Cancel</button>
                <button className="btn-primary" onClick={sendOTP} style={{ flex: 1 }} disabled={loading}>
                  {loading ? "Sending…" : "Send OTP"}
                </button>
              </div>
            </div>
          )}

          {/* ── Reset Step 2: Enter OTP ── */}
          {step === "reset2" && (
            <div style={{ padding: 32 }}>
              <h3 className="heading-font" style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>Enter OTP</h3>
              <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 24 }}>
                We sent a 6-digit OTP to <strong>{resetPhone}</strong>
              </p>
              {error && (
                <div style={{ background: "#fee2e2", color: "#dc2626", padding: "10px 16px", borderRadius: 12, marginBottom: 16, fontSize: 14 }}>
                  {error}
                </div>
              )}
              <input
                type="text" className="mw-input" maxLength={6} placeholder="Enter 6-digit OTP"
                value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ""))}
                style={{ textAlign: "center", fontSize: 18, letterSpacing: 5 }}
              />
              <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
                <button className="btn-outline" onClick={goToLogin} style={{ flex: 1 }} disabled={loading}>Cancel</button>
                <button className="btn-primary" onClick={verifyOTP} style={{ flex: 1 }} disabled={loading}>
                  {loading ? "Verifying…" : "Verify OTP"}
                </button>
              </div>
            </div>
          )}

          {/* ── Reset Step 3: New Password ── */}
          {step === "reset3" && (
            <div style={{ padding: 32 }}>
              <h3 className="heading-font" style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>Create New Password</h3>
              <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 24 }}>Enter and confirm your new password</p>
              {error && (
                <div style={{ background: "#fee2e2", color: "#dc2626", padding: "10px 16px", borderRadius: 12, marginBottom: 16, fontSize: 14 }}>
                  {error}
                </div>
              )}
              {success && (
                <div style={{ background: "#dcfce7", color: "#15803d", padding: "10px 16px", borderRadius: 12, marginBottom: 16, fontSize: 14 }}>
                  {success}
                </div>
              )}

              {/* New Password */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 8 }}>New Password</label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showNewPass ? "text" : "password"}
                    className="mw-input"
                    placeholder="••••••••"
                    value={newPass}
                    onChange={e => setNewPass(e.target.value)}
                    style={{ paddingRight: 48 }}
                  />
                  <button
                    type="button"
                    style={eyeBtnStyle}
                    onClick={() => setShowNewPass(v => !v)}
                    aria-label={showNewPass ? "Hide password" : "Show password"}
                  >
                    {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 8 }}>Confirm New Password</label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showConfirmPass ? "text" : "password"}
                    className="mw-input"
                    placeholder="••••••••"
                    value={confirmPass}
                    onChange={e => setConfirmPass(e.target.value)}
                    style={{ paddingRight: 48 }}
                  />
                  <button
                    type="button"
                    style={eyeBtnStyle}
                    onClick={() => setShowConfirmPass(v => !v)}
                    aria-label={showConfirmPass ? "Hide password" : "Show password"}
                  >
                    {showConfirmPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
                <button className="btn-outline" onClick={goToLogin} style={{ flex: 1 }} disabled={loading}>Cancel</button>
                <button
                  onClick={doReset}
                  disabled={loading}
                  style={{
                    flex: 1,
                    background: loading ? "#94a3b8" : "linear-gradient(to right, #059669, #10b981)",
                    color: "white", border: "none", borderRadius: 14,
                    padding: "14px", fontWeight: 600, fontSize: 15,
                    cursor: loading ? "not-allowed" : "pointer",
                  }}
                >
                  {loading ? "Resetting…" : "Reset Password"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}