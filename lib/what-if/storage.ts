export const WHATIF_STORAGE_KEY = "mumate.whatif.v1";
export const WHATIF_COOKIE_NAME = "whatif_played";
export const WHATIF_CARD_FILENAME = "mumate-what-if.png";
export const WHATIF_SHARE_URL = "https://bazichart.mumate.co/what-if";

const DB_NAME = "mumate.whatif";
const DB_VERSION = 1;
const CARD_STORE = "cards";
const CARD_KEY = "mumate.whatif.card.v1";

export type WhatIfGender = "male" | "female";

export type WhatIfResponse = {
  input: {
    birthDate: string;
    birthTime: string | null;
    gender: WhatIfGender;
    yearCe: number;
    age: number;
    currentJob: string;
  };
  engineMode: "full-chart" | "year-only";
  fourPillars: { position: string; stem: string; branch: string }[] | null;
  bookCareers: string[];
  destiny: {
    ganzhiLabel: string;
    element: string;
    polarity: string;
    animal: string;
    destinedCareer: string;
    careerReason: string;
  };
  story: { shift: string; peak: string; future: string };
  model: string;
  imageUrl: string | null;
};

export function markWhatIfPlayed() {
  if (typeof document === "undefined") return;
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${WHATIF_COOKIE_NAME}=1; Max-Age=${maxAge}; Path=/; SameSite=Lax`;
}

export function clearWhatIfPlayedCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${WHATIF_COOKIE_NAME}=; Max-Age=0; Path=/; SameSite=Lax`;
}

export function hasWhatIfPlayedCookie() {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split(";")
    .map((part) => part.trim())
    .some((part) => part === `${WHATIF_COOKIE_NAME}=1`);
}

export function saveWhatIfResult(result: WhatIfResponse) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    WHATIF_STORAGE_KEY,
    JSON.stringify({ version: 1, savedAt: new Date().toISOString(), result }),
  );
}

export function loadWhatIfResult(): WhatIfResponse | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(WHATIF_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { result?: WhatIfResponse };
    return parsed.result ?? null;
  } catch {
    return null;
  }
}

export function clearWhatIfResult() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(WHATIF_STORAGE_KEY);
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CARD_STORE)) db.createObjectStore(CARD_STORE);
    };
    request.onerror = () => reject(request.error ?? new Error("Cannot open IndexedDB"));
    request.onsuccess = () => resolve(request.result);
  });
}

export async function saveWhatIfCardBlob(blob: Blob) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(CARD_STORE, "readwrite");
    tx.objectStore(CARD_STORE).put(blob, CARD_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Cannot save what-if card"));
  });
  db.close();
}

export async function getWhatIfCardBlob(): Promise<Blob | null> {
  try {
    const db = await openDb();
    const blob = await new Promise<Blob | null>((resolve, reject) => {
      const tx = db.transaction(CARD_STORE, "readonly");
      const request = tx.objectStore(CARD_STORE).get(CARD_KEY);
      request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null);
      request.onerror = () => reject(request.error ?? new Error("Cannot read what-if card"));
    });
    db.close();
    return blob;
  } catch {
    return null;
  }
}

export async function clearWhatIfCardBlob() {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(CARD_STORE, "readwrite");
      tx.objectStore(CARD_STORE).delete(CARD_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Cannot clear what-if card"));
    });
    db.close();
  } catch {
    // Reset is best-effort; localStorage/cookie still clear even if IDB is unavailable.
  }
}

export async function clearWhatIfPlayedState() {
  clearWhatIfPlayedCookie();
  clearWhatIfResult();
  await clearWhatIfCardBlob();
}
