import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { setUiLang } from "../i18n";

const LISTING_LANGS = ["de", "en", "fr", "it", "nl", "es"];

export default function SettingsPage() {
  const { t } = useTranslation();
  const { user, setUser } = useAuth();
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const saveLangs = async (patch: { preferredUiLang?: string; lastListingLang?: string }) => {
    if (!user) return;
    try {
      const res = await api<{ user: typeof user }>("/me/settings", { method: "PUT", body: patch });
      setUser(res.user);
      if (patch.preferredUiLang) setUiLang(patch.preferredUiLang);
      setMessage({ kind: "ok", text: t("settings.saved") });
    } catch {
      /* optional */
    }
  };

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="font-display text-3xl uppercase">{t("settings.title")}</h1>
        <p className="mt-4 font-mono text-sm">
          <Link to="/login" className="underline">
            {t("nav.login")}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-8 px-4 py-8">
      <h1 className="font-display text-3xl uppercase leading-none">{t("settings.title")}</h1>

      <div className="card-pixel space-y-4 p-6">
        <h2 className="font-display text-lg uppercase">{t("settings.uiLang")}</h2>
        <select
          className="input-pixel"
          value={user.preferred_ui_lang ?? "de"}
          onChange={(e) => void saveLangs({ preferredUiLang: e.target.value })}
        >
          {LISTING_LANGS.map((l) => (
            <option key={l} value={l}>
              {t(`lang.${l}`)}
            </option>
          ))}
        </select>
      </div>

      <div className="card-pixel space-y-4 p-6">
        <h2 className="font-display text-lg uppercase">{t("settings.listingLangDefault")}</h2>
        <select
          className="input-pixel"
          value={user.last_listing_lang ?? "de"}
          onChange={(e) => void saveLangs({ lastListingLang: e.target.value })}
        >
          {LISTING_LANGS.map((l) => (
            <option key={l} value={l}>
              {t(`lang.${l}`)}
            </option>
          ))}
        </select>
      </div>

      {message && (
        <p
          className={`border-2 px-3 py-2 font-mono text-xs ${
            message.kind === "ok" ? "border-ink" : "border-signal text-signal"
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
