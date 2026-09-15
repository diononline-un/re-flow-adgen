import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { useAuth } from "../auth";

export interface VisionData {
  category: string;
  brand: string;
  color: string;
  condition: string;
  flaws: string;
  material: string;
  notes: string;
}

export interface ListingData {
  title: string;
  description: string;
  tags: string[];
  hashtags?: string[];
  specifics?: { name: string; value: string }[];
}

function CopyButton({ text }: { text: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="btn-pixel px-2 py-1 text-[10px]"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? t("generate.copied") : t("generate.copy")}
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  mono,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="label-pixel">{label}</span>
        <div className="flex items-center gap-2">
          {mono && value && (
            <span className="mono-counter text-gray3">{value.length}</span>
          )}
          <CopyButton text={value} />
        </div>
      </div>
      {onChange ? (
        <textarea
          className="input-pixel min-h-[6rem]"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <pre className="whitespace-pre-wrap border-2 border-ink bg-paper p-3 font-mono text-sm">{value}</pre>
      )}
    </div>
  );
}

export default function ResultView({
  listing,
  vision,
  truncated,
  generationId,
  showFeedback,
}: {
  listing: ListingData;
  vision?: VisionData;
  truncated?: boolean;
  generationId?: string;
  showFeedback?: boolean;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [editable, setEditable] = useState<ListingData>(listing);
  const [feedbackState, setFeedbackState] = useState<"none" | "sent">("none");
  const [rating, setRating] = useState<1 | -1 | null>(null);
  const [comment, setComment] = useState("");
  const [ticketCreated, setTicketCreated] = useState(false);

  const sendFeedback = async (r: 1 | -1) => {
    setRating(r);
    if (r === 1) {
      try {
        await api("/feedback", { method: "POST", body: { generationId, rating: r, comment: "" } });
        setFeedbackState("sent");
      } catch {
        /* stilles Fehlschlagen ok */
      }
    }
  };

  const sendNegative = async () => {
    try {
      const res = await api<{ ticketId: string | null }>("/feedback", {
        method: "POST",
        body: { generationId, rating: -1, comment },
      });
      setTicketCreated(!!res.ticketId);
      setFeedbackState("sent");
    } catch {
      /* stilles Fehlschlagen ok */
    }
  };

  return (
    <div className="space-y-6">
      {truncated && (
        <p className="border-2 border-signal bg-signal/10 px-3 py-2 font-mono text-xs text-signal">
          {t("generate.truncated")}
        </p>
      )}

      <Field
        label={`${t("generate.title")} — ${editable.title.length}`}
        value={editable.title}
        onChange={(v) => setEditable({ ...editable, title: v })}
        mono
      />

      <Field
        label={`${t("generate.description")} — ${editable.description.length}`}
        value={editable.description}
        onChange={(v) => setEditable({ ...editable, description: v })}
        mono
      />

      {(editable.tags?.length ?? 0) > 0 && (
        <div>
          <span className="label-pixel">{t("generate.tags")}</span>
          <div className="flex flex-wrap gap-2">
            {editable.tags.map((tag, i) => (
              <span key={i} className="border-2 border-ink px-2 py-1 font-mono text-xs">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {(editable.hashtags?.length ?? 0) > 0 && (
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="label-pixel">{t("generate.hashtags")}</span>
            <CopyButton text={(editable.hashtags ?? []).join(" ")} />
          </div>
          <div className="flex flex-wrap gap-2">
            {editable.hashtags?.map((h, i) => (
              <span key={i} className="border-2 border-ink bg-ink px-2 py-1 font-mono text-xs text-paper">
                #{h}
              </span>
            ))}
          </div>
        </div>
      )}

      {(editable.specifics?.length ?? 0) > 0 && (
        <div>
          <span className="label-pixel">{t("generate.specifics")}</span>
          <table className="w-full border-collapse border-2 border-ink font-mono text-sm">
            <tbody>
              {editable.specifics?.map((s, i) => (
                <tr key={i} className="border-b-2 border-ink last:border-b-0">
                  <td className="border-r-2 border-ink px-2 py-1 font-bold">{s.name}</td>
                  <td className="px-2 py-1">{s.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {vision && (
        <details className="border-2 border-ink">
          <summary className="cursor-pointer px-3 py-2 font-display text-xs uppercase">
            {t("generate.visionResult")}
          </summary>
          <div className="border-t-2 border-ink p-3 font-mono text-xs leading-relaxed">
            {Object.entries(vision).map(([k, v]) => (
              <div key={k}>
                <span className="font-bold">{k}:</span> {String(v)}
              </div>
            ))}
          </div>
        </details>
      )}

      {showFeedback && generationId && (
        <div className="card-pixel p-4">
          <span className="label-pixel">{t("feedback.question")}</span>
          {feedbackState === "sent" ? (
            <p className="font-mono text-sm">
              {t("feedback.thanks")} {ticketCreated && t("feedback.ticketCreated")}
            </p>
          ) : (
            <div className="mt-2 flex flex-wrap items-start gap-2">
              <button className="btn-pixel" onClick={() => sendFeedback(1)}>
                👍 {t("feedback.up")}
              </button>
              <button className="btn-pixel" onClick={() => sendFeedback(-1)}>
                👎 {t("feedback.down")}
              </button>
              {rating === -1 && (
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-end">
                  <div className="grow">
                    <textarea
                      className="input-pixel"
                      rows={2}
                      placeholder={t("feedback.comment")}
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                    />
                  </div>
                  <button className="btn-pixel" onClick={sendNegative} disabled={!user}>
                    {t("feedback.send")}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <p className="font-mono text-xs text-gray3">{t("generate.editHint")}</p>
    </div>
  );
}
