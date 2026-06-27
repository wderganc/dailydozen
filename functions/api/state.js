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
    wallpaper: normalizeWallpaper(data?.wallpaper),
    wallpaperMode: normalizeWallpaperMode(data?.wallpaperMode),
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
