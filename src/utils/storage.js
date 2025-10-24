export const STORAGE_KEYS = {
  progress: "novel-reader-progress",
  preferences: "novel-reader-preferences",
};

const isClient = typeof window !== "undefined";

export const readStorage = (key, fallback = null) => {
  if (!isClient) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

export const writeStorage = (key, value) => {
  if (!isClient) return;
  window.localStorage.setItem(key, JSON.stringify(value));
};
