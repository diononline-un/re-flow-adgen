import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import ResultView, { type ListingData, type VisionData } from "../components/ResultView";

interface HistoryItem {
  id: string;
  platform: string;
  listing_lang: string;
  input_keywords: string;
  vision_result_json: VisionData;
  output_json: ListingData;
  created: string;
  images: string[];
}

export default function HistoryPage() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [selected, setSelected] = useState<HistoryItem | null>(null);

  useEffect(() => {
    if (!user) return;
    api<{ items: HistoryItem[] }>("/history")
      .then((res) => setItems(res.items))
      .catch(() => {});
  }, [user]);

  if (loading) return null;

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="font-display text-3xl uppercase">{t("history.title")}</h1>
        <p className="mt-4 font-mono text-sm">
          {t("history.guestHint")}{" "}
          <Link to="/login" className="underline">
            {t("nav.login")}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <h1 className="font-display text-3xl uppercase leading-none">{t("history.title")}</h1>
      {items.length === 0 && <p className="font-mono text-sm">{t("history.empty")}</p>}
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="card-pixel p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-display text-sm uppercase">{item.output_json.title}</p>
                <p className="mono-counter text-gray3">
                  {item.platform} · {item.listing_lang} · {new Date(item.created).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-2">
                {item.images[0] && (
                  <img src={item.images[0]} alt="" className="h-12 w-12 border-2 border-ink object-cover" />
                )}
                <button className="btn-pixel text-xs" onClick={() => setSelected(item)}>
                  {t("history.view")}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {selected && (
        <div className="border-4 border-ink p-4">
          <ResultView
            listing={selected.output_json}
            vision={selected.vision_result_json}
            generationId={selected.id}
            showFeedback
          />
          <button className="btn-pixel mt-4" onClick={() => setSelected(null)}>
            ×
          </button>
        </div>
      )}
    </div>
  );
}
