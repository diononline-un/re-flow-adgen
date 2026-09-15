import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api";

interface Stats {
  generations_total: number;
  users_total: number;
  tickets_open: number;
  by_day: Record<string, number>;
  by_platform: Record<string, number>;
  by_lang: Record<string, number>;
}

interface Ticket {
  id: string;
  status: string;
  created: string;
  closed_at: string;
  expand?: { feedback_id?: { rating?: number; comment?: string; generation_id?: string } };
}

export default function AdminPage() {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [adminToken, setAdminToken] = useState<string | null>(sessionStorage.getItem("adgen_admin_token"));
  const [error, setError] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);

  const adminFetch = async <T,>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> => {
    const res = await fetch(`/api${path}`, {
      method: opts.method ?? "GET",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${adminToken}`,
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as T;
  };

  useEffect(() => {
    if (!adminToken) return;
    adminFetch<Stats>("/admin/stats")
      .then(setStats)
      .catch(() => {});
    adminFetch<{ items: Ticket[] }>("/admin/tickets")
      .then((r) => setTickets(r.items))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminToken]);

  const login = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const res = await api<{ token: string }>("/admin/login", { method: "POST", body: { password } });
      sessionStorage.setItem("adgen_admin_token", res.token);
      setAdminToken(res.token);
      setPassword("");
    } catch {
      setError(t("admin.wrongCredentials"));
    }
  };

  if (!adminToken) {
    return (
      <div className="mx-auto max-w-sm space-y-6 px-4 py-12">
        <h1 className="font-display text-3xl uppercase leading-none">{t("admin.title")}</h1>
        <form className="card-pixel space-y-4 p-6" onSubmit={login}>
          <div>
            <label className="label-pixel" htmlFor="adminPw">
              {t("admin.password")}
            </label>
            <input
              id="adminPw"
              type="password"
              className="input-pixel"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && (
            <p className="border-2 border-signal bg-signal/10 px-3 py-2 font-mono text-xs text-signal">
              {error}
            </p>
          )}
          <button className="btn-pixel-solid w-full">{t("admin.login")}</button>
        </form>
      </div>
    );
  }

  const setStatus = async (id: string, status: string) => {
    await adminFetch(`/admin/tickets/${id}`, { method: "PATCH", body: { status } });
    adminFetch<{ items: Ticket[] }>("/admin/tickets").then((r) => setTickets(r.items));
    adminFetch<Stats>("/admin/stats").then(setStats).catch(() => {});
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <h1 className="font-display text-3xl uppercase leading-none">{t("admin.title")}</h1>

      {stats && (
        <div className="card-pixel p-6">
          <h2 className="font-display text-lg uppercase">{t("admin.stats")}</h2>
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div className="border-2 border-ink p-3 text-center">
              <p className="font-display text-2xl">{stats.generations_total}</p>
              <p className="mono-counter text-gray3">{t("admin.generationsTotal")}</p>
            </div>
            <div className="border-2 border-ink p-3 text-center">
              <p className="font-display text-2xl">{stats.users_total}</p>
              <p className="mono-counter text-gray3">{t("admin.usersTotal")}</p>
            </div>
            <div className="border-2 border-ink p-3 text-center">
              <p className="font-display text-2xl">{stats.tickets_open}</p>
              <p className="mono-counter text-gray3">{t("admin.ticketsOpen")}</p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
            <Distribution title={t("admin.byPlatform")} data={stats.by_platform} />
            <Distribution title={t("admin.byLang")} data={stats.by_lang} />
            <Distribution title={t("admin.byDay")} data={stats.by_day} />
          </div>
        </div>
      )}

      <div className="card-pixel p-6">
        <h2 className="font-display text-lg uppercase">{t("admin.tickets")}</h2>
        {tickets.length === 0 && <p className="mt-2 font-mono text-sm">{t("admin.noData")}</p>}
        <div className="mt-4 space-y-3">
          {tickets.map((ticket) => (
            <div key={ticket.id} className="border-2 border-ink p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-xs">
                  {t("admin.rating")}: {ticket.expand?.feedback_id?.rating ?? "?"} ·{" "}
                  {new Date(ticket.created).toLocaleString()}
                </span>
                <select
                  className="input-pixel w-auto"
                  value={ticket.status}
                  onChange={(e) => void setStatus(ticket.id, e.target.value)}
                >
                  <option value="offen">{t("admin.statusOpen")}</option>
                  <option value="in Bearbeitung">{t("admin.statusInProgress")}</option>
                  <option value="geschlossen">{t("admin.statusClosed")}</option>
                </select>
              </div>
              <p className="mt-2 whitespace-pre-wrap font-mono text-sm">
                {ticket.expand?.feedback_id?.comment ?? "—"}
              </p>
            </div>
          ))}
        </div>
      </div>

      <p className="font-mono text-xs text-gray3">{t("admin.pbAdminHint")}</p>

      <button
        className="btn-pixel"
        onClick={() => {
          sessionStorage.removeItem("adgen_admin_token");
          setAdminToken(null);
        }}
      >
        {t("nav.logout")}
      </button>
    </div>
  );
}

function Distribution({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return <p className="font-mono text-xs">{title}: —</p>;
  return (
    <div>
      <span className="label-pixel">{title}</span>
      {entries.map(([k, v]) => (
        <div key={k} className="flex items-center justify-between border-b border-gray1 font-mono text-xs">
          <span>{k}</span>
          <span>{v}</span>
        </div>
      ))}
    </div>
  );
}
