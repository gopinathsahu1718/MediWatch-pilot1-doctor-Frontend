"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FileText, User, LogOut, Home, Menu, X, ChevronLeft, ChevronRight, Users, CheckCircle2 } from "lucide-react";
import { useState, useEffect } from "react";

const navItems = [
  { href: "/dashboard",  label: "Dashboard",         icon: Home     },
  { href: "/patients",   label: "All Patients",      icon: Users    },
  { href: "/resolved-patients", label: "Resolved Patients", icon: CheckCircle2    },
  { href: "/register",   label: "Registration Form",  icon: FileText },
  { href: "/profile",    label: "Profile",            icon: User     },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed,  setCollapsed]  = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  useEffect(() => {
    document.body.classList.toggle("sidebar-collapsed", collapsed);
    return () => { document.body.classList.remove("sidebar-collapsed"); };
  }, [collapsed]);

  async function handleLogout() {
    try {
      const token = localStorage.getItem("doctor_token");
      if (token) {
        await fetch("https://api.mediwatch.in/api/v1/auth/staff/logout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify({}),
        });
      }
    } catch {
      // proceed with local logout even if API call fails
    } finally {
      localStorage.removeItem("doctor_token");
      document.cookie = "doctor_token=; path=/; max-age=0; SameSite=Strict";
      setShowLogoutModal(false);
      router.push("/login");
    }
  }

  return (
    <>
      <style>{`
        :root {
          --sw-full : 300px;
          --sw-icon : 72px;
          --topbar-h: 60px;

          --brand      : #1D9E75;
          --brand-12   : rgba(29,158,117,0.12);
          --brand-05   : rgba(29,158,117,0.05);
          --brand-blue : rgba(55,138,221,0.08);

          --bg         : #ffffff;
          --border     : #e2e8f0;
          --muted      : #64748b;
          --text        : #0f172a;

          --danger-bg  : rgba(255, 0, 0, 0.28);
          --danger-bd  : rgba(239,68,68,0.15);
          --danger-hv  : rgba(239,68,68,0.15);
          --danger     : #ef4444;

          --overlay    : rgba(15,23,42,0.50);
          --ease       : cubic-bezier(0.4,0,0.2,1);
          --dur        : 0.28s;
          --r          : 12px;
          --shadow-sm  : 0 1px 8px rgba(0,0,0,0.06);
          --shadow-md  : 0 4px 24px rgba(0,0,0,0.09);
          --shadow-lg  : 0 8px 40px rgba(0,0,0,0.18);
        }

        .topbar {
          display     : none;
          position    : fixed;
          top: 0; left: 0; right: 0;
          height      : var(--topbar-h);
          background  : var(--bg);
          border-bottom: 1px solid var(--border);
          z-index     : 400;
          align-items : center;
          justify-content: space-between;
          padding     : 0 16px;
          box-shadow  : var(--shadow-sm);
        }
        .topbar-logo {
          position : absolute;
          left: 50%; top: 50%;
          transform: translate(-50%,-50%);
          height   : 36px;
          width    : auto;
          max-width: 160px;
          object-fit: contain;
        }
        .topbar-btn {
          position : relative; z-index: 1;
          display  : flex;
          align-items: center;
          justify-content: center;
          width : 40px; height: 40px;
          border-radius: 10px;
          border: 1px solid var(--border);
          background: transparent;
          cursor: pointer;
          color: var(--muted);
          transition: background var(--dur) var(--ease), color var(--dur) var(--ease);
        }
        .topbar-btn:hover { background: var(--brand-12); color: var(--brand); }

        .sw-overlay {
          display  : none;
          position : fixed; inset: 0;
          z-index  : 390;
          background: var(--overlay);
          backdrop-filter: blur(3px);
          -webkit-backdrop-filter: blur(3px);
          opacity  : 0;
          pointer-events: none;
          transition: opacity var(--dur) var(--ease);
        }
        .sw-overlay.on { opacity: 1; pointer-events: all; }

        .sw-sidebar {
          position  : fixed;
          top: 0; left: 0;
          height    : 100dvh;
          width     : var(--sw-full);
          background: var(--bg);
          border-right: 1px solid var(--border);
          display   : flex;
          flex-direction: column;
          z-index   : 395;
          box-shadow: var(--shadow-md);
          transition: width var(--dur) var(--ease),
                      transform var(--dur) var(--ease);
          overflow  : hidden;
        }
        .sw-sidebar.is-collapsed { width: var(--sw-icon); }

        .sw-logo-row {
          display  : flex;
          align-items: center;
          justify-content: space-between;
          padding  : 16px 14px;
          border-bottom: 1px solid var(--border);
          min-height: 72px;
          flex-shrink: 0;
          gap: 8px;
        }
        .sw-logo {
          max-width: 220px;
          margin:auto;
          object-fit: contain;
          transition: max-width var(--dur) var(--ease),
                      opacity   var(--dur) var(--ease);
        }
        .sw-sidebar.is-collapsed .sw-logo {
          max-width: 0; opacity: 0; pointer-events: none;
        }

        .sw-collapse-control {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }

        .sw-collapsed-logo {
          display: none;
          width: 58px;
          height: 58px;
          object-fit: contain;
          flex-shrink: 0;
        }
        .sw-sidebar.is-collapsed .sw-collapsed-logo {
          display: block;
        }

        .sw-desk-btn {
          display: flex;
          align-items: center; justify-content: center;
          width: 30px; height: 30px;
          border-radius: 8px;
          border: 1px solid var(--border);
          background: transparent;
          cursor: pointer;
          color: var(--muted);
          flex-shrink: 0;
          transition: background var(--dur) var(--ease), color var(--dur) var(--ease);
        }
        .sw-desk-btn:hover { background: var(--brand-12); color: var(--brand); }

        .sw-close-btn {
          display: none;
          align-items: center; justify-content: center;
          width: 30px; height: 30px;
          border-radius: 8px;
          border: 1px solid var(--border);
          background: transparent;
          cursor: pointer;
          color: var(--muted);
          flex-shrink: 0;
          transition: background var(--dur) var(--ease), color var(--dur) var(--ease);
        }
        .sw-close-btn:hover { background: var(--danger-bg); color: var(--danger); }

        .sw-nav { flex:1; padding:10px 12px; overflow-y:auto; overflow-x:hidden; }
        .sw-nav::-webkit-scrollbar { width:3px; }
        .sw-nav::-webkit-scrollbar-thumb { background:var(--border); border-radius:4px; }

        .sw-label {
          font-size:10px; font-weight:700; letter-spacing:.1em;
          color:var(--muted); text-transform:uppercase;
          padding:6px 14px 8px;
          white-space:nowrap;
          transition: opacity var(--dur) var(--ease), padding var(--dur) var(--ease);
        }
        .sw-sidebar.is-collapsed .sw-label { opacity:0; padding-top:0; padding-bottom:0; }

        .sw-link { text-decoration:none; display:block; margin-bottom:3px; }

        .sw-item {
          display:flex; align-items:center; gap:12px;
          padding:11px 14px;
          border-radius:var(--r);
          border-right:3px solid transparent;
          cursor:pointer;
          white-space:nowrap; overflow:hidden;
          position:relative;
          transition: background var(--dur) var(--ease),
                      border-color var(--dur) var(--ease);
        }
        .sw-item.active {
          background: linear-gradient(to right, var(--brand-12), var(--brand-blue));
          border-right-color: var(--brand);
        }
        .sw-item:not(.active):hover { background: var(--brand-05); }

        .sw-icon  { flex-shrink:0; width:20px; height:20px; }
        .sw-itext {
          font-size:14px; font-weight:400;
          overflow:hidden;
          transition: opacity var(--dur) var(--ease), width var(--dur) var(--ease);
        }
        .sw-itext.bold { font-weight:600; }

        .sw-sidebar.is-collapsed .sw-nav   { padding:10px 6px; }
        .sw-sidebar.is-collapsed .sw-item  { justify-content:center; padding:11px; border-right:none; }
        .sw-sidebar.is-collapsed .sw-item.active { background:var(--brand-12); }
        .sw-sidebar.is-collapsed .sw-itext { opacity:0; width:0; }

        .sw-tip {
          position:absolute;
          left: calc(var(--sw-icon) + 6px);
          top:50%; transform:translateY(-50%);
          background:#1e293b; color:#fff;
          font-size:12px; font-weight:500;
          padding:5px 11px; border-radius:8px;
          white-space:nowrap; pointer-events:none;
          opacity:0; z-index:999;
          box-shadow:0 4px 16px rgba(0,0,0,.18);
          transition:opacity .15s;
          display:none;
        }
        .sw-sidebar.is-collapsed .sw-tip             { display:block; }
        .sw-sidebar.is-collapsed .sw-item:hover .sw-tip { opacity:1; }

        .sw-logout { padding:12px 12px 28px; flex-shrink:0; }
        .sw-sidebar.is-collapsed .sw-logout { padding:12px 6px 28px; }

        .sw-logout-btn {
          width:100%; padding:11px 16px;
          border-radius:var(--r);
          background:var(--danger-bg);
          border:1px solid var(--danger-bd);
          color:var(--danger);
          font-size:14px; font-weight:500;
          cursor:pointer;
          display:flex; align-items:center; gap:10px;
          white-space:nowrap; overflow:hidden;
          transition:background var(--dur) var(--ease);
        }
        .sw-logout-btn:hover { background:var(--danger-hv); }

        .sw-logout-txt {
          overflow:hidden;
          transition: opacity var(--dur) var(--ease), width var(--dur) var(--ease);
        }
        .sw-sidebar.is-collapsed .sw-logout-btn { justify-content:center; padding:11px; }
        .sw-sidebar.is-collapsed .sw-logout-txt { opacity:0; width:0; }

        @media (max-width:1023px) and (min-width:768px) {
          .topbar     { display:flex; }
          .sw-overlay { display:block; }
          .sw-sidebar {
            top: 0;
            transform: translateX(-100%);
            box-shadow: none;
          }
          .sw-sidebar.drawer-open {
            transform: translateX(0);
            box-shadow: var(--shadow-lg);
          }
          .sw-sidebar:not(.drawer-open) ~ .main-content {
            margin-left: 0 !important;
            width: 100% !important;
          }
          .sw-desk-btn  { display:none; }
          .sw-collapsed-logo { display:none !important; }
          .sw-close-btn { display:flex; }
          .sw-logo      { display:none; }
          .sw-tip { display:none !important; }
        }

        @media (max-width:767px) {
          .topbar     { display:flex; }
          .sw-overlay { display:block; }
          .sw-sidebar {
            top: 0;
            transform: translateX(-100%);
            box-shadow: none;
          }
          .sw-sidebar.drawer-open {
            transform: translateX(0);
            box-shadow: var(--shadow-lg);
          }
          .sw-sidebar:not(.drawer-open) ~ .main-content {
            margin-left: 0 !important;
            width: 100% !important;
          }
          .sw-desk-btn  { display:none; }
          .sw-collapsed-logo { display:none !important; }
          .sw-close-btn { display:flex; }
          .sw-logo      { display:none; }
          .sw-tip { display:none !important; }
        }

        @media (min-width:1024px) {
          .topbar         { display:none; }
          .sw-overlay     { display:none !important; }
          .sw-close-btn   { display:none; }
          .sw-desk-btn    { display:flex; }
          .sw-sidebar     { transform:none !important; }
        }
      `}</style>

      {/* TOP BAR (tablet + mobile) */}
      <header className="topbar" role="banner">
        <button
          className="topbar-btn"
          aria-label={drawerOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen(v => !v)}
        >
          {drawerOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <img src="/transparent logo.png" alt="MediWatch" className="topbar-logo" />
        <div style={{ width: 40 }} aria-hidden="true" />
      </header>

      {/* OVERLAY */}
      <div
        className={`sw-overlay${drawerOpen ? " on" : ""}`}
        onClick={() => setDrawerOpen(false)}
        aria-hidden="true"
      />

      {/* SIDEBAR */}
      <aside
        className={[
          "sw-sidebar",
          collapsed  ? "is-collapsed" : "",
          drawerOpen ? "drawer-open"  : "",
        ].filter(Boolean).join(" ")}
        aria-label="Main navigation"
      >
        {/* Logo row */}
        <div className="sw-logo-row">
          <img src="/transparent logo.png" alt="MediWatch Logo" className="sw-logo" />
          <div className="sw-collapse-control">
            <img src="/Desktop logo.png" alt="MediWatch" className="sw-collapsed-logo" />
            <button
              className="sw-desk-btn"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              onClick={() => setCollapsed(v => !v)}
            >
              {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
            </button>
          </div>
          <button
            className="sw-close-btn"
            aria-label="Close navigation"
            onClick={() => setDrawerOpen(false)}
          >
            <X size={15} />
          </button>
        </div>

        {/* Nav */}
        <nav className="sw-nav">
          <div className="sw-label">Menu</div>
          {navItems.map(item => {
            // exact match for dashboard, startsWith for everything else
            const active = item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className="sw-link">
                <div className={`sw-item${active ? " active" : ""}`}>
                  <item.icon
                    size={20}
                    strokeWidth={1.5}
                    className="sw-icon"
                    style={{ color: active ? "var(--brand)" : "var(--muted)" }}
                  />
                  <span
                    className={`sw-itext${active ? " bold" : ""}`}
                    style={{ color: active ? "var(--brand)" : "var(--muted)" }}
                  >
                    {item.label}
                  </span>
                  <span className="sw-tip" aria-hidden="true">{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="sw-logout">
          <button
            className="sw-logout-btn"
            onClick={() => setShowLogoutModal(true)}
            aria-label="Logout"
          >
            <LogOut size={18} strokeWidth={1.5} style={{ flexShrink: 0 }} />
            <span className="sw-logout-txt">Logout</span>
          </button>
        </div>
      </aside>

      {/* LOGOUT MODAL */}
      {showLogoutModal && (
        <>
          <div
            onClick={() => setShowLogoutModal(false)}
            style={{
              position: "fixed", inset: 0, zIndex: 1000,
              background: "rgba(15,23,42,0.55)",
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
              animation: "fadeIn 0.2s ease",
            }}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-title"
            style={{
              position: "fixed", zIndex: 1001,
              top: "50%", left: "50%",
              transform: "translate(-50%, -50%)",
              background: "#ffffff",
              borderRadius: 20,
              boxShadow: "0 24px 60px rgba(0,0,0,0.22)",
              padding: "32px 28px 24px",
              width: "min(90vw, 360px)",
              textAlign: "center",
              animation: "slideUp 0.22s cubic-bezier(0.4,0,0.2,1)",
            }}
          >
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: "rgba(239,68,68,0.1)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 16px",
            }}>
              <LogOut size={24} strokeWidth={1.8} style={{ color: "#ef4444" }} />
            </div>
            <h3 id="logout-title" style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", margin: "0 0 8px" }}>
              Confirm Logout
            </h3>
            <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 24px", lineHeight: 1.5 }}>
              Are you sure you want to sign out of your account?
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setShowLogoutModal(false)}
                style={{
                  flex: 1, padding: "12px",
                  borderRadius: 12, border: "1.5px solid #e2e8f0",
                  background: "#f8fafc", color: "#374151",
                  fontSize: 14, fontWeight: 600, cursor: "pointer",
                  transition: "background 0.2s",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "#f1f5f9")}
                onMouseLeave={e => (e.currentTarget.style.background = "#f8fafc")}
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                style={{
                  flex: 1, padding: "12px",
                  borderRadius: 12, border: "none",
                  background: "linear-gradient(to right, #dc2626, #ef4444)",
                  color: "#fff",
                  fontSize: 14, fontWeight: 600, cursor: "pointer",
                  transition: "opacity 0.2s",
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = "0.88")}
                onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
              >
                Yes, Logout
              </button>
            </div>
          </div>
          <style>{`
            @keyframes fadeIn  { from { opacity: 0 } to { opacity: 1 } }
            @keyframes slideUp { from { opacity: 0; transform: translate(-50%, -46%) } to { opacity: 1; transform: translate(-50%, -50%) } }
          `}</style>
        </>
      )}
    </>
  );
}