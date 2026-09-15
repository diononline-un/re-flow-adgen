import { useTranslation } from "react-i18next";

const TIERS = [
  { key: "tier1", price: "5,00 €", per: "5,00 €" },
  { key: "tier3", price: "13,50 €", per: "4,50 €" },
  { key: "tier6", price: "24,00 €", per: "4,00 €" },
  { key: "tier12", price: "39,00 €", per: "3,25 €" },
];

export default function PricingPage() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <h1 className="font-display text-4xl uppercase leading-none">{t("pricing.title")}</h1>

      <div className="card-pixel p-6">
        <p className="font-display text-lg uppercase">{t("pricing.free")}</p>
        <p className="mt-2 font-mono text-sm">{t("pricing.freeGone")}</p>
        <a
          href="https://paypal.me/dionotto/5EUR"
          target="_blank"
          rel="noreferrer"
          className="btn-pixel-solid mt-4"
        >
          {t("pricing.donate")} — paypal.me/dionotto
        </a>
        <p className="mt-3 font-mono text-[10px] text-gray3">{t("pricing.donateHint")}</p>
      </div>

      <div className="card-pixel p-6">
        <h2 className="font-display text-lg uppercase">{t("pricing.tiersTitle")}</h2>
        <table className="mt-4 w-full border-collapse border-2 border-ink font-mono text-sm">
          <thead>
            <tr className="bg-ink text-paper">
              <th className="px-2 py-1 text-left">Laufzeit</th>
              <th className="px-2 py-1 text-right">Gesamt</th>
              <th className="px-2 py-1 text-right">/Monat</th>
            </tr>
          </thead>
          <tbody>
            {TIERS.map((tier) => {
              const [months, price, per] = [
                tier.key === "tier1" ? "1" : tier.key === "tier3" ? "3" : tier.key === "tier6" ? "6" : "12",
                tier.price,
                tier.per,
              ];
              return (
                <tr key={tier.key} className="border-b-2 border-ink last:border-b-0">
                  <td className="px-2 py-1">{months} {t("pricing.month")}</td>
                  <td className="px-2 py-1 text-right">{price}</td>
                  <td className="px-2 py-1 text-right">{per}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-3 font-mono text-[10px] text-gray3">{t("pricing.tierNote")}</p>
      </div>
    </div>
  );
}
