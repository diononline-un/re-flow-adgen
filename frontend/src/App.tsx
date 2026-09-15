import { Routes, Route } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Header from "./components/Header";
import GeneratePage from "./pages/GeneratePage";
import HistoryPage from "./pages/HistoryPage";
import SettingsPage from "./pages/SettingsPage";
import PricingPage from "./pages/PricingPage";
import AdminPage from "./pages/AdminPage";
import AuthPage from "./pages/AuthPage";

export default function App() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="grow">
        <Routes>
          <Route path="/" element={<GeneratePage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />
        </Routes>
      </main>
      <footer className="border-t-4 border-ink">
        <div className="halftone mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-4 font-mono text-xs">
          <span>{t("app.name")} — {t("footer.madeWith")}</span>
          <span>{t("footer.support")}</span>
        </div>
      </footer>
    </div>
  );
}
