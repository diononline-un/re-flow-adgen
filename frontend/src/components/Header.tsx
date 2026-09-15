import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth";
import { UI_LANGS, setUiLang } from "../i18n";

const NAV = [
  { to: "/", key: "nav.generate" },
  { to: "/history", key: "nav.history" },
  { to: "/settings", key: "nav.settings" },
  { to: "/pricing", key: "nav.pricing" },
];

function isDark(): boolean {
  return document.documentElement.classList.contains("dark");
}

export default function Header() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dark, setDark] = useState(isDark);

  useEffect(() => {
    setDark(isDark());
  }, []);

  const toggleTheme = () => {
    const next = !isDark();
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("adgen_theme", next ? "dark" : "light");
    } catch {
      // localStorage nicht verfügbar — Theme gilt nur für diese Sitzung
    }
    setDark(next);
  };

  return (
    <header className="border-b-4 border-ink bg-paper">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3">
        <Link to="/" className="flex items-baseline gap-2">
          <span className="font-display text-2xl uppercase leading-none tracking-tight">
            Re-Flow<span className="halftone inline-block h-3 w-3 border-2 border-ink" />AdGen
          </span>
        </Link>

        <nav className="flex flex-wrap items-center gap-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `border-2 px-2 py-1 font-display text-xs uppercase tracking-wide ${
                  isActive ? "border-ink bg-ink text-paper" : "border-transparent hover:border-ink"
                }`
              }
            >
              {t(item.key)}
            </NavLink>
          ))}
          {user?.is_admin && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `border-2 px-2 py-1 font-display text-xs uppercase tracking-wide ${
                  isActive ? "border-ink bg-ink text-paper" : "border-transparent hover:border-ink"
                }`
              }
            >
              {t("nav.admin")}
            </NavLink>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <select
            aria-label={t("lang.label")}
            className="input-pixel w-auto"
            value={i18n.language}
            onChange={(e) => setUiLang(e.target.value)}
          >
            {UI_LANGS.map((l) => (
              <option key={l} value={l}>
                {t(`lang.${l}`)}
              </option>
            ))}
          </select>

          <button
            className="btn-pixel px-2 py-1 text-xs"
            onClick={toggleTheme}
            title={t("theme.label")}
            aria-label={t("theme.label")}
          >
            {dark ? t("theme.light") : t("theme.dark")}
          </button>

          {user ? (
            <div className="flex items-center gap-2">
              <span className="mono-counter hidden sm:inline" title={t("auth.loggedInAs")}>
                {user.username}
              </span>
              <button
                className="btn-pixel text-xs"
                onClick={() => {
                  logout();
                  navigate("/");
                }}
              >
                {t("nav.logout")}
              </button>
            </div>
          ) : (
            <Link to="/login" className="btn-pixel text-xs">
              {t("nav.login")}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
