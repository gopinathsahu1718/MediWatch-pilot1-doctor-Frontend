"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("doctor_token");
    if (!token) {
      router.replace("/login");
    } else {
      setChecked(true);
    }
  }, [router]);

  if (!checked) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f8fafc",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Frosted-glass blur overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(255, 255, 255, 0.55)",
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
          }}
        />

        {/* Spinner + text */}
        <div style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
          <div
            style={{
              width: 44,
              height: 44,
              border: "3px solid #e2e8f0",
              borderTop: "3px solid #1D9E75",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
              margin: "0 auto 16px",
            }}
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ color: "#94a3b8", fontSize: 14, margin: 0 }}>
            Verifying session…
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}