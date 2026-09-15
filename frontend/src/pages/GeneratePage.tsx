import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, ApiError } from "../api";
import { useAuth, errorMessage } from "../auth";
import { getFingerprint } from "../fingerprint";
import { compressImage } from "../image";
import ResultView, { type ListingData, type VisionData } from "../components/ResultView";

interface Platform {
  platform: string;
  title_limit: number;
  description_limit: number;
  max_images: number;
  hashtag_limit: number;
  tone_notes: string;
}

interface GenerateResponse {
  id: string;
  output: ListingData;
  vision: VisionData;
  truncated: boolean;
  quotaRemaining: number | null;
}

interface Quota {
  total: number;
  used: number;
  remaining: number;
  supportTier: boolean;
  flagged: boolean;
}

const LISTING_LANGS = ["de", "en", "fr", "it", "nl", "es"];

export default function GeneratePage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [platform, setPlatform] = useState("ebay");
  const [listingLang, setListingLang] = useState(user?.last_listing_lang || "de");
  const [keywords, setKeywords] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [step, setStep] = useState<"idle" | "vision" | "harness">("idle");
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [sessionHistory, setSessionHistory] = useState<GenerateResponse[]>([]);
  const [error, setError] = useState("");
  const [quota, setQuota] = useState<Quota | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api<{ platforms: Platform[] }>("/platforms")
      .then((res) => setPlatforms(res.platforms))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const fp = await getFingerprint();
      const qs = new URLSearchParams({ fingerprint: fp });
      try {
        const q = await api<Quota>(`/quota?${qs}`);
        if (alive) setQuota(q);
      } catch {
        // Quota-Anzeige optional
      }
    })();
    return () => {
      alive = false;
    };
  }, [user]);

  const addFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).slice(0, 24);
    const compressed: string[] = [];
    for (const f of list) {
      if (!f.type.startsWith("image/")) continue;
      compressed.push(await compressImage(f));
    }
    setImages((prev) => [...prev, ...compressed].slice(0, 24));
  };

  const submit = async () => {
    setError("");
    if (images.length === 0) return;
    setStep("vision");
    setResult(null);
    try {
      const fp = await getFingerprint();
      const res = await api<GenerateResponse>("/generate", {
        method: "POST",
        body: {
          images,
          keywords,
          platform,
          listingLang,
          fingerprintHash: fp,
        },
      });
      setStep("harness");
      await new Promise((r) => setTimeout(r, 150));
      setResult(res);
      setSessionHistory((h) => [res, ...h].slice(0, 20));
      if (quota) setQuota({ ...quota, remaining: res.quotaRemaining ?? quota.remaining, used: quota.used + 1 });
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "";
      setError(
        code === "quota_exceeded"
          ? t("generate.quotaExceeded")
          : code === "no_key"
            ? t("generate.noKey")
            : `${t("generate.errorProvider")}: ${errorMessage(err, t("generate.errorGeneric"))}`,
      );
    } finally {
      setStep("idle");
    }
  };

  const platformCfg = platforms.find((p) => p.platform === platform);

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <div>
        <h1 className="font-display text-4xl uppercase leading-none">{t("generate.pageTitle")}</h1>
        <p className="mt-2 font-mono text-sm text-gray3">{t("app.tagline")}</p>
      </div>

      {quota && (
        <div className="card-pixel flex items-center justify-between gap-4 p-4">
          <span className="label-pixel">{t("generate.quota")}</span>
          {quota.supportTier ? (
            <span className="mono-counter">{t("generate.quotaUnlimited")}</span>
          ) : (
            <span className="mono-counter">
              {t("generate.quotaLeft", { count: quota.remaining, total: quota.total })}
            </span>
          )}
        </div>
      )}

      <div className="space-y-6">
        {/* Bilder */}
        <div>
          <span className="label-pixel">
            {t("generate.images")} — {t("generate.imagesHint")}
          </span>
          <div
            className="halftone-light cursor-pointer border-4 border-dashed border-ink bg-paper p-6 text-center"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void addFiles(e.dataTransfer.files);
            }}
          >
            <p className="font-mono text-sm">{t("generate.dropzone")}</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && void addFiles(e.target.files)}
            />
          </div>
          {images.length > 0 && (
            <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
              {images.map((img, i) => (
                <div key={i} className="relative border-2 border-ink">
                  <img src={img} alt="" className="aspect-square w-full object-cover" />
                  {i === 0 && (
                    <span className="absolute bottom-0 left-0 bg-ink px-1 font-mono text-[10px] text-paper">
                      MAIN
                    </span>
                  )}
                  <button
                    className="absolute right-0 top-0 bg-signal px-1 font-mono text-[10px] text-paper"
                    onClick={() => setImages(images.filter((_, j) => j !== i))}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stichworte */}
        <div>
          <label className="label-pixel" htmlFor="keywords">
            {t("generate.keywords")}
          </label>
          <textarea
            id="keywords"
            className="input-pixel min-h-[5rem]"
            placeholder={t("generate.keywordsPlaceholder")}
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
          />
        </div>

        {/* Plattform + Sprache */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label-pixel" htmlFor="platform">
              {t("generate.platform")}
            </label>
            <select
              id="platform"
              className="input-pixel"
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
            >
              {platforms.map((p) => (
                <option key={p.platform} value={p.platform}>
                  {p.platform === "kleinanzeigen" ? "eBay Kleinanzeigen" : p.platform.charAt(0).toUpperCase() + p.platform.slice(1)}
                </option>
              ))}
            </select>
            {platformCfg && (
              <p className="mt-1 font-mono text-[10px] text-gray3">
                {t("generate.title")} ≤ {platformCfg.title_limit > 0 ? platformCfg.title_limit : "—"} ·{" "}
                {t("generate.description")} ≤ {platformCfg.description_limit} ·{" "}
                {platformCfg.tone_notes}
              </p>
            )}
          </div>
          <div>
            <label className="label-pixel" htmlFor="listingLang">
              {t("generate.listingLang")}
            </label>
            <select
              id="listingLang"
              className="input-pixel"
              value={listingLang}
              onChange={(e) => setListingLang(e.target.value)}
            >
              {LISTING_LANGS.map((l) => (
                <option key={l} value={l}>
                  {t(`lang.${l}`)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Gast-Key entfällt: BYOK gekippt, Provider-Key liegt serverseitig */}

        {error && (
          <p className="border-2 border-signal bg-signal/10 px-3 py-2 font-mono text-xs text-signal">
            {error}
          </p>
        )}

        <button className="btn-pixel-solid w-full py-4 text-lg" onClick={submit} disabled={step !== "idle" || images.length === 0}>
          {step === "idle" ? t("generate.submit") : step === "vision" ? t("generate.visionStep") : t("generate.harnessStep")}
        </button>
      </div>

      {result && <ResultView listing={result.output} vision={result.vision} truncated={result.truncated} generationId={user ? result.id : undefined} showFeedback={!!user} />}

      {!user && sessionHistory.length > 0 && (
        <div className="card-pixel p-4">
          <span className="label-pixel">{t("history.title")} ({t("history.guestHint")})</span>
          <div className="mt-2 space-y-2">
            {sessionHistory.map((h) => (
              <button
                key={h.id}
                className="btn-pixel w-full justify-start"
                onClick={() => setResult(h)}
              >
                {h.output.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
