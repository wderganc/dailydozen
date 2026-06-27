const STORAGE_KEY = "state:v1";
const FACETIME_VIDEO_KEY_PREFIX = "facetime-video:v1:";

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
const DESKTOP_PICTURE_LIMIT = 12;
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
    const data = await hydrateStoredData(store, stored);
    return json({ data });
  }

  if (request.method === "POST") {
    try {
      const payload = await request.json();
      const incomingData = normalizeData(payload.data);
      const storedData = await hydrateStoredData(store, await store.get(STORAGE_KEY, "json"));
      const facetimeVideos = mergeFacetimeVideos(storedData.facetimeVideos, incomingData.facetimeVideos);
      const data = mergeStoredData(storedData, incomingData, facetimeVideos);
      await putFacetimeVideos(store, facetimeVideos);
      await store.put(STORAGE_KEY, JSON.stringify(getStateDataForStorage(data)));
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
    desktopPictures: normalizeDesktopPictures(data?.desktopPictures),
    facetimeVideos: normalizeFacetimeVideos(data?.facetimeVideos, data?.facetimeVideo),
  };
}

async function hydrateStoredData(store, stored) {
  const stateData = normalizeData(stored);
  const storedVideos = await getStoredFacetimeVideos(store);

  return {
    ...stateData,
    facetimeVideos: mergeFacetimeVideos(stateData.facetimeVideos, storedVideos),
  };
}

function mergeStoredData(storedData, incomingData, facetimeVideos = mergeFacetimeVideos(storedData.facetimeVideos, incomingData.facetimeVideos)) {
  return {
    ...incomingData,
    iconPositions: mergeIconPositions(storedData.iconPositions, incomingData.iconPositions),
    desktopPictures: mergeDesktopPictures(storedData.desktopPictures, incomingData.desktopPictures),
    facetimeVideos,
  };
}

function getStateDataForStorage(data) {
  return {
    ...data,
    facetimeVideos: {},
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

function normalizeDesktopPictures(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map(normalizeDesktopPicture)
    .filter((picture) => picture.id && picture.data)
    .slice(-DESKTOP_PICTURE_LIMIT);
}

function normalizeDesktopPicture(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const data = normalizeWallpaper(value.data);
  if (!data) return {};

  const id = normalizeShortText(value.id, "", 96) || `${data.length}-${data.slice(-36)}`;

  return {
    id,
    data,
    name: normalizeShortText(value.name, "Picture", 96),
    type: normalizeShortText(value.type, "image/jpeg", 48),
    size: Number.isFinite(Number(value.size)) ? Math.max(0, Math.round(Number(value.size))) : 0,
    uploadedBy: normalizeShortText(value.uploadedBy, "Daily Dozen", 80),
    uploadedAt: normalizeShortText(value.uploadedAt, "", 48),
  };
}

function mergeDesktopPictures(storedPictures, incomingPictures) {
  const picturesById = new Map();

  normalizeDesktopPictures(storedPictures).forEach((picture) => {
    picturesById.set(picture.id, picture);
  });

  normalizeDesktopPictures(incomingPictures).forEach((picture) => {
    picturesById.set(picture.id, picture);
  });

  return [...picturesById.values()].slice(-DESKTOP_PICTURE_LIMIT);
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

function hasFacetimeVideo(video) {
  return Boolean(video?.data);
}

async function getStoredFacetimeVideos(store) {
  const entries = await Promise.all(
    USER_IDS.map(async (userId) => {
      const video = normalizeFacetimeVideo(await store.get(`${FACETIME_VIDEO_KEY_PREFIX}${userId}`, "json"), userId);
      return [userId, video];
    }),
  );

  return Object.fromEntries(entries.filter(([, video]) => hasFacetimeVideo(video)));
}

async function putFacetimeVideos(store, videos) {
  await Promise.all(
    Object.entries(normalizeFacetimeVideos(videos)).map(([userId, video]) => {
      return store.put(`${FACETIME_VIDEO_KEY_PREFIX}${userId}`, JSON.stringify(video));
    }),
  );
}

function mergeFacetimeVideos(storedVideos, incomingVideos) {
  const merged = { ...(storedVideos || {}) };

  Object.entries(incomingVideos || {}).forEach(([userId, incomingVideo]) => {
    const storedVideo = merged[userId];

    if (!hasFacetimeVideo(storedVideo) || isNewerFacetimeVideo(incomingVideo, storedVideo)) {
      merged[userId] = incomingVideo;
    }
  });

  return merged;
}

function isNewerFacetimeVideo(candidate, current) {
  const candidateTime = Date.parse(candidate?.uploadedAt || "");
  const currentTime = Date.parse(current?.uploadedAt || "");

  if (Number.isFinite(candidateTime) && Number.isFinite(currentTime)) return candidateTime > currentTime;
  if (Number.isFinite(candidateTime)) return true;
  if (Number.isFinite(currentTime)) return false;
  return getFacetimeVideoId(candidate) !== getFacetimeVideoId(current);
}

function getFacetimeVideoId(video) {
  return video?.videoId || video?.uploadedAt || "";
}

function normalizeFacetimeVideo(value, fallbackUserId = "") {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const type = normalizeVideoMimeType(value.type, value.name);
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
  const [, payload = ""] = dataUrl.split(",");
  if (!payload) return "";
  const mime = normalizeVideoMimeType(type, "");

  if (
    dataUrl.startsWith("data:video/") ||
    dataUrl.startsWith("data:;base64,") ||
    dataUrl.startsWith("data:application/octet-stream;base64,")
  ) {
    return `data:${mime};base64,${payload}`;
  }

  return "";
}

function normalizeVideoMimeType(type, name = "") {
  const cleanType = normalizeShortText(type, "", 48).toLowerCase();
  if (/\.webm$/i.test(name)) return "video/webm";
  if (/\.ogv$/i.test(name)) return "video/ogg";
  if (/\.(mp4|m4v|mov)$/i.test(name)) return "video/mp4";
  if (cleanType === "video/quicktime" || cleanType === "video/x-m4v") return "video/mp4";
  return cleanType.startsWith("video/") ? cleanType : "video/mp4";
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

function mergeIconPositions(storedPositions, incomingPositions) {
  return {
    ...normalizeIconPositions(storedPositions),
    ...normalizeIconPositions(incomingPositions),
  };
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
