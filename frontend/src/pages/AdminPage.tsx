import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { api, getToken } from "../api";
import { useAuth } from "../auth";

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

interface AdminUser {
  id: string;
  username: string;
  created: string;
  blocked: boolean;
  support_tier: boolean;
  gens_free_used: number;
  is_admin: boolean;
}

interface Counter {
  id: string;
  fingerprint_hash: string;
  count: number;
  accounts_seen: number;
  ip_last_seen: string;
  unlocked_by_admin: boolean;
  created: string;
}

export default function AdminPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  // App-Admin (is_admin) nutzt sein User-Token; sonst Superuser-Passwort-Login
  const [password, setPassword] = useState("");
  const [adminToken, setAdminToken] = useState<string | null>(
    sessionStorage.getItem("adgen_admin_token"),
  );
  const [error, setError] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [counters, setCounters] = useState<Counter[]>([]);

  const activeToken = adminToken ?? (user?.is_admin ? getToken() : null);

  const adminFetch = async <T,>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> => {
    const res = await fetch(`/api${path}`, {
      method: opts.method ?? "GET",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${activeToken}`,
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as T;
  };

  const loadAll = async () => {
    if (!activeToken) return;
    adminFetch<Stats>("/admin/stats").then(setStats).catch(() => {});
    adminFetch<{ items: Ticket[] }>("/admin/tickets").then((r) => setTickets(r.items)).catch(() => {});
    adminFetch<{ items: AdminUser[] }>("/admin/users").then((r) => setUsers(r.items)).catch(() => {});
    adminFetch<{ items: Counter[] }>("/admin/counters").then((r) => setCounters(r.items)).catch(() => {});
  };

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeToken]);

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

  if (!activeToken) {
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
    void loadAll();
  };

  const patchUser = async (id: string, patch: { support_tier?: boolean; blocked?: boolean }) => {
    await adminFetch(`/admin/users/${id}`, { method: "PATCH", body: patch });
    void loadAll();
  };

  const unlockCounter = async (id: string) => {
    await adminFetch(`/admin/counters/${id}`, { method: "PATCH", body: { unlocked_by_admin: true } });
    void loadAll();
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

      {/* User-Management */}
      <div className="card-pixel p-6">
        <h2 className="font-display text-lg uppercase">{t("admin.users")}</h2>
        <table className="mt-4 w-full border-collapse border-2 border-ink font-mono text-xs">
          <thead>
            <tr className="bg-ink text-paper">
              <th className="px-2 py-1 text-left">{t("auth.username")}</th>
              <th className="px-2 py-1 text-right">{t("admin.gensUsed")}</th>
              <th className="px-2 py-1 text-right">{t("admin.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b-2 border-ink last:border-b-0">
                <td className="px-2 py-1">
                  {u.username}
                  {u.is_admin && <span className="ml-2 border-2 border-signal px-1 text-signal">ADMIN</span>}
                </td>
                <td className="px-2 py-1 text-right">{u.gens_free_used}</td>
                <td className="px-2 py-1">
                  <div className="flex flex-wrap justify-end gap-1">
                    <button
                      className="btn-pixel px-2 py-0.5 text-[10px]"
                      onClick={() => void patchUser(u.id, { support_tier: !u.support_tier })}
                      title={t("admin.supportTier")}
                    >
                      {u.support_tier ? t("admin.revokeTier") : t("admin.grantTier")}
                    </button>
                    <button
                      className={`px-2 py-0.5 text-[10px] ${u.blocked ? "btn-pixel" : "btn-pixel-danger"}`}
                      onClick={() => void patchUser(u.id, { blocked: !u.blocked })}
                    >
                      {u.blocked ? t("admin.unblock") : t("admin.block")}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Geflaggte Geräte */}
      <div className="card-pixel p-6">
        <h2 className="font-display text-lg uppercase">{t("admin.flaggedDevices")}</h2>
        {counters.length === 0 && <p className="mt-2 font-mono text-sm">{t("admin.noFlags")}</p>}
        <div className="mt-4 space-y-2">
          {counters.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 border-2 border-ink p-2">
              <span className="font-mono text-xs">
                {c.fingerprint_hash.slice(0, 16)}… · {t("admin.accountsSeen")}: {c.accounts_seen} ·{" "}
                {t("admin.ip")}: {c.ip_last_seen}
              </span>
              {c.unlocked_by_admin ? (
                <span className="font-mono text-xs text-gray3">{t("admin.unlocked")}</span>
              ) : (
                <button className="btn-pixel px-2 py-0.5 text-[10px]" onClick={() => void unlockCounter(c.id)}>
                  {t("admin.unlock")}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Tickets */}
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
