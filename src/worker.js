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

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

const DEFAULT_WALLPAPER_MODE = "tile";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/state") {
      return handleStateRequest(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};

async function handleStateRequest(request, env) {
  const store = env.DAILY_DOZEN;
  if (!store) return json({ error: "Daily Dozen KV binding is missing." }, 500);

  if (request.method === "GET") {
    const stored = await store.get(STORAGE_KEY, "json");
    return json({ data: normalizeData(stored) });
  }

  if (request.method === "POST") {
    try {
      const payload = await request.json();
      const data = normalizeData(payload.data);
      await store.put(STORAGE_KEY, JSON.stringify(data));
      return json({ data });
    } catch {
      return json({ error: "Could not save Daily Dozen state." }, 400);
    }
  }

  return json({ error: "Method not allowed." }, 405);
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
    headers: JSON_HEADERS,
  });
}
