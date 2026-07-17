import { useState, useEffect, useRef } from "react";
import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom";
import "./App.css";
import { IconRun, IconSun, IconMoon, IconMenu, IconX, IconLogOut, IconUser, IconChevronDown } from "./icons.jsx";
import { useAuth } from "./auth/useAuth.js";

/* ---- Nav links, shared between the desktop bar and the mobile menu ---- */
const navLinks = (onNavigate) => (
  <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? " active" : ""}`} onClick={onNavigate}>
    Home
  </NavLink>
);

/* ---- Right-side account dropdown: Log in/Sign up when logged out,
   Dashboard (super admin)/Logout when logged in ---- */
function AccountMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const handleKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className="account-menu" ref={rootRef}>
      <button
        type="button"
        className="account-menu-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <IconUser />
        <span>{user ? user.name || user.email : "Account"}</span>
        <IconChevronDown />
      </button>

      {open && (
        <div className="account-menu-panel">
          {user ? (
            <>
              {(user.role === "super_admin" || user.role === "admin") && (
                <NavLink to="/admin" className="account-menu-item" onClick={close}>
                  Dashboard
                </NavLink>
              )}
              <button type="button" className="account-menu-item" onClick={() => { close(); onLogout(); }}>
                <IconLogOut /> Logout
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className="account-menu-item" onClick={close}>Log in</NavLink>
              <NavLink to="/signup" className="account-menu-item" onClick={close}>Sign up</NavLink>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ================================================================
   App — shared layout (header + footer) wrapping the routed pages
   ================================================================ */
function App() {
  // Initialise from localStorage so the preference survives refreshes
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem("runsdb-theme") === "dark"
  );
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  /* Close the mobile menu whenever the route changes. Adjusting state
     during render (rather than in an effect) avoids an extra re-render. */
  const [prevPathname, setPrevPathname] = useState(location.pathname);
  if (location.pathname !== prevPathname) {
    setPrevPathname(location.pathname);
    setMobileNavOpen(false);
  }

  /* Apply theme attribute to <html> and persist choice */
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
    localStorage.setItem("runsdb-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  return (
    <div className="app">
      {/* ====== HEADER ====== */}
      <header className="header">
        <div className="header-inner">
          {/* Brand */}
          <div className="brand">
            <span className="brand-icon"><IconRun /></span>
            <span className="brand-name">Runs<span className="brand-dot">DB</span></span>
          </div>

          {/* Navigation */}
          <nav className="nav">{navLinks(null)}</nav>

          {/* Account + toggle */}
          <div className="header-right">
            <AccountMenu user={user} onLogout={handleLogout} />
            <button
              className="theme-toggle"
              onClick={() => setDarkMode((d) => !d)}
              aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              {darkMode ? <IconSun /> : <IconMoon />}
            </button>
            <button
              className="mobile-nav-toggle"
              onClick={() => setMobileNavOpen((o) => !o)}
              aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileNavOpen}
            >
              {mobileNavOpen ? <IconX /> : <IconMenu />}
            </button>
          </div>
        </div>

        {mobileNavOpen && (
          <nav className="mobile-nav">
            {navLinks(() => setMobileNavOpen(false))}
            {(user?.role === "super_admin" || user?.role === "admin") && (
              <NavLink to="/admin" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`} onClick={() => setMobileNavOpen(false)}>
                Dashboard
              </NavLink>
            )}
            {user ? (
              <button className="nav-link" onClick={() => { setMobileNavOpen(false); handleLogout(); }}>
                <IconLogOut /> Logout
              </button>
            ) : (
              <>
                <NavLink to="/login" className="nav-link" onClick={() => setMobileNavOpen(false)}>Log in</NavLink>
                <NavLink to="/signup" className="nav-link" onClick={() => setMobileNavOpen(false)}>Sign up</NavLink>
              </>
            )}
          </nav>
        )}
      </header>

      {/* ====== ROUTED PAGE ====== */}
      <Outlet />

      {/* ====== FOOTER ====== */}
      <footer className="footer">
        <div className="container footer-inner">
          <div className="footer-brand">
            <span className="brand-icon"><IconRun /></span>
            <span className="brand-name">RunsDB</span>
          </div>
          <p className="footer-copy">
            © {new Date().getFullYear()} RunsDB. All rights reserved.
          </p>
          <div className="footer-links">
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
            <a href="#">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
