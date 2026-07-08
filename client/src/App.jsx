import { useState, useEffect } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import "./App.css";
import { IconRun, IconSearch, IconSun, IconMoon, IconMenu, IconX } from "./icons.jsx";

/* ---- Nav links, shared between the desktop bar and the mobile menu ---- */
const navLinks = (onNavigate) => (
  <>
    <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? " active" : ""}`} onClick={onNavigate}>
      Dashboard
    </NavLink>
    <NavLink to="/map" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`} onClick={onNavigate}>
      Map
    </NavLink>
    <a href="#" className="nav-link" onClick={onNavigate}>Analytics</a>
    <a href="#" className="nav-link" onClick={onNavigate}>About</a>
  </>
);

/* ================================================================
   App — shared layout (header + footer) wrapping the routed pages
   ================================================================ */
function App() {
  // Initialise from localStorage so the preference survives refreshes
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem("runsdb-theme") === "dark"
  );
  const [search, setSearch]         = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const location = useLocation();

  /* Close the mobile menu whenever the route changes */
  useEffect(() => { setMobileNavOpen(false); }, [location.pathname]);

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
          <nav className="nav">{navLinks()}</nav>

          {/* Search + toggle */}
          <div className="header-right">
            <div className="search-wrap">
              <span className="search-icon"><IconSearch /></span>
              <input
                type="text"
                className="search-input"
                placeholder="Search runs…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search runs"
              />
            </div>
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
          <nav className="mobile-nav">{navLinks(() => setMobileNavOpen(false))}</nav>
        )}
      </header>

      {/* ====== ROUTED PAGE ====== */}
      <Outlet context={{ search }} />

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
