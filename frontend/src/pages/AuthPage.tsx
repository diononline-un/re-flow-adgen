import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, errorMessage } from "../auth";
import { getFingerprint } from "../fingerprint";

export default function AuthPage({ mode }: { mode: "login" | "register" }) {
  const { t } = useTranslation();
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "register") {
        const fp = await getFingerprint();
        await register(username.trim(), password, fp);
      } else {
        await login(username.trim(), password);
      }
      navigate("/");
    } catch (err) {
      setError(errorMessage(err, t("auth.wrongCredentials")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-sm space-y-6 px-4 py-12">
      <h1 className="font-display text-3xl uppercase leading-none">
        {mode === "login" ? t("auth.loginTitle") : t("auth.registerTitle")}
      </h1>
      <form className="card-pixel space-y-4 p-6" onSubmit={submit}>
        <div>
          <label className="label-pixel" htmlFor="username">
            {t("auth.username")}
          </label>
          <input
            id="username"
            className="input-pixel"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="username"
          />
          {mode === "register" && (
            <p className="mt-1 font-mono text-[10px] text-gray3">{t("auth.usernameHint")}</p>
          )}
        </div>
        <div>
          <label className="label-pixel" htmlFor="password">
            {t("auth.password")}
          </label>
          <input
            id="password"
            type="password"
            className="input-pixel"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
          {mode === "register" && (
            <p className="mt-1 font-mono text-[10px] text-gray3">{t("auth.passwordHint")}</p>
          )}
        </div>
        {error && (
          <p className="border-2 border-signal bg-signal/10 px-3 py-2 font-mono text-xs text-signal">
            {error}
          </p>
        )}
        <button className="btn-pixel-solid w-full" disabled={busy}>
          {mode === "login" ? t("auth.login") : t("auth.register")}
        </button>
        <p className="text-center font-mono text-xs">
          {mode === "login" ? (
            <>
              {t("auth.noAccount")}{" "}
              <Link to="/register" className="underline">
                {t("auth.register")}
              </Link>
            </>
          ) : (
            <>
              {t("auth.haveAccount")}{" "}
              <Link to="/login" className="underline">
                {t("auth.login")}
              </Link>
            </>
          )}
        </p>
      </form>
    </div>
  );
}
