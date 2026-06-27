const STORAGE_KEY = "state:v1";

const DEFAULT_ITEMS = [
  "Exercise",
  "Meditation",
  "Yoga",
  "Reading",
  "Studying",
  "Singing",
  "Drawing",
  "Nighttime wind down",
  "Making time for you",
  "Walk outside",
  "Tidy reset",
  "Gratitude note",
];

const HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

const DEFAULT_WALLPAPER_MODE = "tile";

export async function onRequestGet({ env }) {
  const store = getStore(env);
  if (!store) return json({ error: "Daily Dozen KV binding is missing." }, 500);

  const stored = await store.get(STORAGE_KEY, "json");
  return json({ data: normalizeData(stored) });
}

export async function onRequestPost({ request, env }) {
  const store = getStore(env);
  if (!store) return json({ error: "Daily Dozen KV binding is missing." }, 500);

  try {
    const payload = await request.json();
    const data = normalizeData(payload.data);
    await store.put(STORAGE_KEY, JSON.stringify(data));
    return json({ data });
  } catch {
    return json({ error: "Could not save Daily Dozen state." }, 400);
  }
}

function getStore(env) {
  return env.DAILY_DOZEN;
}

function normalizeData(data) {
  return {
    items: normalizeItems(data?.items),
    completions: normalizeObject(data?.completions),
    notes: normalizeObject(data?.notes),
    sharedNotes: normalizeObject(data?.sharedNotes),
    sharedNoteMeta: normalizeObject(data?.sharedNoteMeta),
    wallpaper: normalizeWallpaper(data?.wallpaper),
    wallpaperMode: normalizeWallpaperMode(data?.wallpaperMode),
    iconPositions: normalizeIconPositions(data?.iconPositions),
    facetimeVideo: normalizeFacetimeVideo(data?.facetimeVideo),
  };
}

function normalizeItems(items) {
  const normalized = Array.isArray(items)
    ? items.map((item) => String(item || "").trim()).filter(Boolean)
    : [];

  return [...normalized, ...DEFAULT_ITEMS].slice(0, 12);
}

function normalizeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeFacetimeVideo(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const data = typeof value.data === "string" && value.data.startsWith("data:video/") ? value.data : "";
  if (!data) return {};

  return {
    data,
    name: normalizeShortText(value.name, "Shared video", 96),
    type: normalizeShortText(value.type, "video/mp4", 48),
    size: Number.isFinite(Number(value.size)) ? Math.max(0, Math.round(Number(value.size))) : 0,
    uploadedBy: normalizeShortText(value.uploadedBy, "Daily Dozen", 80),
    uploadedAt: normalizeShortText(value.uploadedAt, "", 48),
  };
}

function normalizeShortText(value, fallback = "", maxLength = 80) {
  const normalized = String(value || "").trim();
  return (normalized || fallback).slice(0, maxLength);
}

function normalizeIconPositions(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value)
      .map(([id, position]) => [
        id,
        {
          x: clampIconCoordinate(position?.x),
          y: clampIconCoordinate(position?.y),
        },
      ])
      .filter(([, position]) => position.x || position.y),
  );
}

function clampIconCoordinate(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(-900, Math.min(900, Math.round(number)));
}

function normalizeWallpaper(value) {
  if (typeof value !== "string") return "";
  return value.startsWith("data:image/") ? value : "";
}

function normalizeWallpaperMode(value) {
  return value === "fill" ? "fill" : DEFAULT_WALLPAPER_MODE;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: HEADERS,
  });
}
