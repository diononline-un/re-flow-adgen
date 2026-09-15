import { useState } from "react";
import { useTranslation } from "react-i18next";

const TIERS = [
  { key: "tier1", amount: "5", total: "5,00 €", per: "5,00 €" },
  { key: "tier3", amount: "13.50", total: "13,50 €", per: "4,50 €" },
  { key: "tier6", amount: "24", total: "24,00 €", per: "4,00 €" },
  { key: "tier12", amount: "39", total: "39,00 €", per: "3,25 €" },
];

export default function PricingPage() {
  const { t } = useTranslation();
  const [tier, setTier] = useState("tier1");

  const selected = TIERS.find((x) => x.key === tier);
  const link = selected
    ? `https://paypal.me/gruenebluete/${selected.amount}EUR`
    : "https://paypal.me/gruenebluete";

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <h1 className="font-display text-4xl uppercase leading-none">{t("pricing.title")}</h1>

      <div className="card-pixel p-6">
        <p className="font-display text-lg uppercase">{t("pricing.free")}</p>
        <p className="mt-2 font-mono text-sm">{t("pricing.freeGone")}</p>

        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div className="min-w-52">
            <label className="label-pixel" htmlFor="tierSelect">
              {t("pricing.selectTier")}
            </label>
            <select
              id="tierSelect"
              className="input-pixel"
              value={tier}
              onChange={(e) => setTier(e.target.value)}
            >
              {TIERS.map((x) => (
                <option key={x.key} value={x.key}>
                  {t(`pricing.${x.key}Label`)}
                </option>
              ))}
              <option value="custom">{t("pricing.custom")}</option>
            </select>
          </div>
          <a href={link} target="_blank" rel="noreferrer" className="btn-pixel-solid">
            {t("pricing.donate")} — paypal.me/gruenebluete
            {selected ? `/${selected.amount}EUR` : ""}
          </a>
        </div>
        <p className="mt-3 font-mono text-[10px] text-gray3">{t("pricing.donateHint")}</p>
      </div>

      <div className="card-pixel p-6">
        <h2 className="font-display text-lg uppercase">{t("pricing.tiersTitle")}</h2>
        <table className="mt-4 w-full border-collapse border-2 border-ink font-mono text-sm">
          <thead>
            <tr className="bg-ink text-paper">
              <th className="px-2 py-1 text-left">{t("pricing.duration")}</th>
              <th className="px-2 py-1 text-right">{t("pricing.total")}</th>
              <th className="px-2 py-1 text-right">{t("pricing.perMonth")}</th>
            </tr>
          </thead>
          <tbody>
            {TIERS.map((x) => (
              <tr key={x.key} className="border-b-2 border-ink last:border-b-0">
                <td className="px-2 py-1">{t(`pricing.${x.key}Duration`)}</td>
                <td className="px-2 py-1 text-right">{x.total}</td>
                <td className="px-2 py-1 text-right">{x.per}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 font-mono text-[10px] text-gray3">{t("pricing.tierNote")}</p>
      </div>
    </div>
  );
}
