import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { api, ApiError } from "../api";
import { useAuth, errorMessage } from "../auth";
import { setUiLang } from "../i18n";

const LISTING_LANGS = ["de", "en", "fr", "it", "nl", "es"];

export default function SettingsPage() {
  const { t } = useTranslation();
  const { user, setUser } = useAuth();
  const [apiKey, setApiKey] = useState("");
  const [provider, setProvider] = useState("anthropic");
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const saveKey = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !apiKey.trim()) return;
    try {
      const res = await api<{ user: typeof user }>("/me/settings", {
        method: "PUT",
        body: { apiKey: apiKey.trim(), provider },
      });
      setUser(res.user);
      setApiKey("");
      setMessage({ kind: "ok", text: t("settings.saved") });
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "";
      setMessage({
        kind: "err",
        text: code === "key_in_use" ? t("settings.keyInUse") : errorMessage(err, t("generate.errorGeneric")),
      });
    }
  };

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

      <form className="card-pixel space-y-4 p-6" onSubmit={saveKey}>
        <h2 className="font-display text-lg uppercase">{t("settings.apiKey")}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="label-pixel" htmlFor="provider">
              {t("settings.provider")}
            </label>
            <select
              id="provider"
              className="input-pixel"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            >
              <option value="anthropic">{t("settings.providerAnthropic")}</option>
              <option value="deepseek">{t("settings.providerDeepseek")}</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label-pixel" htmlFor="apiKey">
              {t("settings.apiKey")}
            </label>
            <input
              id="apiKey"
              type="password"
              className="input-pixel"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={user.api_key_encrypted ? t("settings.clearKey", { provider: user.api_key_provider ?? "?" }) : ""}
            />
          </div>
        </div>
        <p className="font-mono text-[10px] text-gray3">{t("settings.apiKeyHint")}</p>
        <button className="btn-pixel-solid" disabled={!apiKey.trim()}>
          {t("settings.save")}
        </button>
      </form>

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
