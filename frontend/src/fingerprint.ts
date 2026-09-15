import FingerprintJS from "@fingerprintjs/fingerprintjs";

const FP_KEY = "adgen_fp";

let cached: string | null = null;

async function load(): Promise<string> {
  try {
    const fp = await FingerprintJS.load();
    const result = await fp.get();
    return result.visitorId;
  } catch {
    // Privatmodus/Adblock: Session-Hash als Fallback
    let session = sessionStorage.getItem("adgen_session_fp");
    if (!session) {
      session = crypto.randomUUID();
      sessionStorage.setItem("adgen_session_fp", session);
    }
    return `session-${session}`;
  }
}

export async function getFingerprint(): Promise<string> {
  if (cached) return cached;
  const stored = localStorage.getItem(FP_KEY);
  if (stored) {
    cached = stored;
    return stored;
  }
  const fp = await load();
  localStorage.setItem(FP_KEY, fp);
  cached = fp;
  return fp;
}
