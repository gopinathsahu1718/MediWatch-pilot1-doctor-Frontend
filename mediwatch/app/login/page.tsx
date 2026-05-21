"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Smartphone, Lock } from "lucide-react";

type Step = "login" | "reset1" | "reset2" | "reset3";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("login");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [resetPhone, setResetPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (phone.length < 10) { setError("Enter a valid phone number"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    router.push("/dashboard");
  }

  function sendOTP() {
    if (resetPhone.length < 10) { setError("Enter a valid phone number"); return; }
    setError(""); setStep("reset2");
  }

  function verifyOTP() {
    if (otp.length !== 6) { setError("Enter a valid 6-digit OTP"); return; }
    setError(""); setStep("reset3");
  }

  function doReset() {
    if (newPass.length < 6) { setError("Password must be at least 6 characters"); return; }
    if (newPass !== confirmPass) { setError("Passwords do not match"); return; }
    setError("");
    setSuccess("Password reset successfully! You can now login.");
    setTimeout(() => { setSuccess(""); setStep("login"); }, 2000);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "15px 20px 15px 48px",
    borderRadius: 16, border: "1.5px solid #e2e8f0",
    outline: "none", fontSize: 16, transition: "all 0.25s",
    fontFamily: "'DM Sans', sans-serif", background: "#fafafa",
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
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 14
          }}>
            <div style={{ padding: "18px 14px 10px", borderBottom: "1px solid rgba(255,255,255,0.08)", textAlign: "center",margin: "auto" }}>
        <img src="/imageLogo.png" alt="MediWatch Logo" style={{ width: "100%", maxWidth: 300, height: "auto" }} />
      </div>
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: "white", borderRadius: 28,
          boxShadow: "0 30px 60px rgba(0,0,0,0.4)", overflow: "hidden"
        }}>
          {/* Login */}
          {step === "login" && (
            <div>
              <div style={{ padding: "32px 32px 16px", textAlign: "center" }}>
                <h2 className="heading-font" style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", margin: 0 }}>Welcome Doctor</h2>
                <p style={{ color: "#94a3b8", fontSize: 14, marginTop: 6 }}>Sign in to access your dashboard</p>
              </div>
              <form onSubmit={handleLogin} style={{ padding: "16px 32px 32px" }}>
                {error && <div style={{ background: "#fee2e2", color: "#dc2626", padding: "10px 16px", borderRadius: 12, marginBottom: 16, fontSize: 14 }}>{error}</div>}
                
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 8 }}>Phone Number</label>
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: 18, top: "50%", transform: "translateY(-50%)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" }}><Smartphone size={16} /></span>
                    <input type="tel" placeholder="+91 98765 43210" value={phone} onChange={e => setPhone(e.target.value)}
                      required style={inputStyle}
                      onFocus={e => { e.target.style.borderColor = "#378ADD"; e.target.style.boxShadow = "0 0 0 4px rgba(55,138,221,0.15)"; }}
                      onBlur={e => { e.target.style.borderColor = "#e2e8f0"; e.target.style.boxShadow = "none"; }} />
                  </div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 8 }}>Password</label>
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: 18, top: "50%", transform: "translateY(-50%)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" }}><Lock size={16} /></span>
                    <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)}
                      required style={inputStyle}
                      onFocus={e => { e.target.style.borderColor = "#378ADD"; e.target.style.boxShadow = "0 0 0 4px rgba(55,138,221,0.15)"; }}
                      onBlur={e => { e.target.style.borderColor = "#e2e8f0"; e.target.style.boxShadow = "none"; }} />
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#64748b", cursor: "pointer" }}>
                    <input type="checkbox" style={{ accentColor: "#1D9E75", width: 16, height: 16 }} />
                    Remember me
                  </label>
                  <button type="button" onClick={() => { setStep("reset1"); setError(""); }}
                    style={{ background: "none", border: "none", color: "#378ADD", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    Reset Password
                  </button>
                </div>

                <button type="submit" className="btn-primary" style={{ width: "100%", padding: "16px", fontSize: 16, borderRadius: 16 }}>
                  Sign In
                </button>

                <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 12, marginTop: 16 }}>
                  Demo: any phone (10+ digits) + any password (6+ chars)
                </p>
              </form>
            </div>
          )}

          {/* Reset Step 1 */}
          {step === "reset1" && (
            <div style={{ padding: 32 }}>
              <h3 className="heading-font" style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>Reset Password</h3>
              <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 24 }}>Enter your registered phone number</p>
              {error && <div style={{ background: "#fee2e2", color: "#dc2626", padding: "10px 16px", borderRadius: 12, marginBottom: 16, fontSize: 14 }}>{error}</div>}
              <input type="tel" className="mw-input" placeholder="+91 98765 43210" value={resetPhone} onChange={e => setResetPhone(e.target.value)} />
              <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
                <button className="btn-outline" onClick={() => { setStep("login"); setError(""); }} style={{ flex: 1 }}>Cancel</button>
                <button className="btn-primary" onClick={sendOTP} style={{ flex: 1 }}>Send OTP</button>
              </div>
            </div>
          )}

          {/* Reset Step 2 */}
          {step === "reset2" && (
            <div style={{ padding: 32 }}>
              <h3 className="heading-font" style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>Enter OTP</h3>
              <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 24 }}>We sent a 6-digit OTP to <strong>{resetPhone}</strong></p>
              {error && <div style={{ background: "#fee2e2", color: "#dc2626", padding: "10px 16px", borderRadius: 12, marginBottom: 16, fontSize: 14 }}>{error}</div>}
              <input type="text" className="mw-input" maxLength={6} placeholder="Enter 6-digit OTP"
                value={otp} onChange={e => setOtp(e.target.value)}
                style={{ textAlign: "center", fontSize: 18, letterSpacing: 5 }} />
              <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
                <button className="btn-outline" onClick={() => { setStep("login"); setError(""); }} style={{ flex: 1 }}>Cancel</button>
                <button className="btn-primary" onClick={verifyOTP} style={{ flex: 1 }}>Verify OTP</button>
              </div>
            </div>
          )}

          {/* Reset Step 3 */}
          {step === "reset3" && (
            <div style={{ padding: 32 }}>
              <h3 className="heading-font" style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>Create New Password</h3>
              <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 24 }}>Enter your new password</p>
              {error && <div style={{ background: "#fee2e2", color: "#dc2626", padding: "10px 16px", borderRadius: 12, marginBottom: 16, fontSize: 14 }}>{error}</div>}
              {success && <div style={{ background: "#dcfce7", color: "#15803d", padding: "10px 16px", borderRadius: 12, marginBottom: 16, fontSize: 14 }}>{success}</div>}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 8 }}>New Password</label>
                <input type="password" className="mw-input" placeholder="••••••••" value={newPass} onChange={e => setNewPass(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 8 }}>Confirm New Password</label>
                <input type="password" className="mw-input" placeholder="••••••••" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} />
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
                <button className="btn-outline" onClick={() => { setStep("login"); setError(""); }} style={{ flex: 1 }}>Cancel</button>
                <button onClick={doReset} style={{
                  flex: 1, background: "linear-gradient(to right,#059669,#10b981)", color: "white",
                  border: "none", borderRadius: 14, padding: "14px", fontWeight: 600, fontSize: 15, cursor: "pointer"
                }}>Reset Password</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
