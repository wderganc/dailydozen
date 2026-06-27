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
const USER_IDS = ["you", "wife"];
const USER_NAMES = {
  you: "Scotty P.",
  wife: "Claudie D.",
};

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
    facetimeVideos: normalizeFacetimeVideos(data?.facetimeVideos, data?.facetimeVideo),
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

function normalizeFacetimeVideos(value, legacyVideo) {
  const videos = {};

  if (value && typeof value === "object" && !Array.isArray(value)) {
    Object.entries(value).forEach(([userId, video]) => {
      if (!USER_IDS.includes(userId)) return;

      const normalized = normalizeFacetimeVideo(video, userId);
      if (normalized.data) videos[userId] = normalized;
    });
  }

  if (!Object.keys(videos).length) {
    const legacy = normalizeFacetimeVideo(legacyVideo);
    if (legacy.data) {
      const userId = inferFacetimeUploaderId(legacy) || USER_IDS[0];
      videos[userId] = {
        ...legacy,
        uploadedUserId: userId,
        uploadedBy: USER_NAMES[userId] || legacy.uploadedBy,
      };
    }
  }

  return videos;
}

function normalizeFacetimeVideo(value, fallbackUserId = "") {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const type = normalizeShortText(value.type, "video/mp4", 48);
  const data = normalizeVideoDataUrl(value.data, type);
  if (!data.startsWith("data:video/")) return {};
  const uploadedUserId = USER_IDS.includes(value.uploadedUserId) ? value.uploadedUserId : fallbackUserId;

  return {
    data,
    name: normalizeShortText(value.name, "Shared video", 96),
    type,
    size: Number.isFinite(Number(value.size)) ? Math.max(0, Math.round(Number(value.size))) : 0,
    uploadedBy: normalizeShortText(value.uploadedBy, "Daily Dozen", 80),
    uploadedAt: normalizeShortText(value.uploadedAt, "", 48),
    uploadedUserId,
    videoId: normalizeShortText(value.videoId, "", 96) || normalizeShortText(value.uploadedAt, "", 48) || `${data.length}-${data.slice(-36)}`,
  };
}

function inferFacetimeUploaderId(video) {
  if (USER_IDS.includes(video.uploadedUserId)) return video.uploadedUserId;
  const uploadedBy = String(video.uploadedBy || "").trim().toLowerCase();
  return USER_IDS.find((userId) => USER_NAMES[userId].toLowerCase() === uploadedBy) || "";
}

function normalizeVideoDataUrl(dataUrl, type) {
  if (typeof dataUrl !== "string") return "";
  if (dataUrl.startsWith("data:video/")) return dataUrl;
  if (dataUrl.startsWith("data:;base64,")) return `data:${type};base64,${dataUrl.split(",")[1] || ""}`;
  if (dataUrl.startsWith("data:application/octet-stream;base64,")) return `data:${type};base64,${dataUrl.split(",")[1] || ""}`;
  return "";
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
    headers: JSON_HEADERS,
  });
}
