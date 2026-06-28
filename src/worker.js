const STORAGE_KEY = "state:v1";
const FACETIME_VIDEO_KEY_PREFIX = "facetime-video:v1:";
const FACETIME_VIDEO_META_KEY_PREFIX = "facetime-video-meta:v1:";
const FACETIME_ARCHIVE_KEY_PREFIX = "facetime-video-archive:v1:";
const FACETIME_ARCHIVE_INDEX_KEY_PREFIX = "facetime-video-archive-index:v1:";
const DESKTOP_PICTURE_KEY_PREFIX = "desktop-picture:v1:";

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
  const url = new URL(request.url);

  if (request.method === "GET") {
    const requestedVideoUserId = url.searchParams.get("facetimeVideo");
    if (requestedVideoUserId) {
      if (!USER_IDS.includes(requestedVideoUserId)) return json({ error: "Unknown FaceTime user." }, 404);
      const video = await getStoredFacetimeVideo(store, requestedVideoUserId);
      return json({ video });
    }

    const requestedArchiveUserId = url.searchParams.get("facetimeArchive");
    if (requestedArchiveUserId) {
      if (!USER_IDS.includes(requestedArchiveUserId)) return json({ error: "Unknown FaceTime archive user." }, 404);
      const archive = await getStoredFacetimeArchive(store, requestedArchiveUserId);
      return json({ archive });
    }

    const requestedArchiveVideoUserId = url.searchParams.get("facetimeArchiveVideo");
    if (requestedArchiveVideoUserId) {
      if (!USER_IDS.includes(requestedArchiveVideoUserId)) return json({ error: "Unknown FaceTime archive user." }, 404);
      const videoId = url.searchParams.get("videoId") || "";
      const video = await getStoredFacetimeArchiveVideo(store, requestedArchiveVideoUserId, videoId);
      return json({ video });
    }

    const includeMedia = url.searchParams.get("media") !== "lite";
    const stored = await store.get(STORAGE_KEY, "json");
    const data = await hydrateStoredData(store, stored, { includeMedia });
    return json({ data });
  }

  if (request.method === "POST") {
    try {
      const payload = await request.json();
      const incomingData = normalizeData(payload.data);
      const storedData = await hydrateStoredData(store, await store.get(STORAGE_KEY, "json"), { includeMedia: true });
      const facetimeVideos = mergeFacetimeVideos(storedData.facetimeVideos, incomingData.facetimeVideos);
      const desktopPictures = mergeDesktopPictures(storedData.desktopPictures, incomingData.desktopPictures);
      const data = mergeStoredData(storedData, incomingData, facetimeVideos, desktopPictures);
      await putDesktopPictures(store, incomingData.desktopPictures);
      await archiveReplacedFacetimeVideos(store, storedData.facetimeVideos, incomingData.facetimeVideos);
      await putFacetimeVideos(store, incomingData.facetimeVideos);
      await store.put(STORAGE_KEY, JSON.stringify(getStateDataForStorage(data)));
      return json({ data: getStateDataForResponse(data, { includeMedia: false }) });
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

async function hydrateStoredData(store, stored, { includeMedia = true } = {}) {
  const storedPictureMeta = normalizeDesktopPictureMetadataList(stored?.desktopPictures);
  const stateData = normalizeData(stored);
  const storedPictures = await getStoredDesktopPictures(store, storedPictureMeta);
  const storedVideos = includeMedia ? await getStoredFacetimeVideos(store) : await getStoredFacetimeVideoMetadata(store);

  return {
    ...stateData,
    desktopPictures: mergeDesktopPictures(stateData.desktopPictures, storedPictures),
    facetimeVideos: mergeFacetimeVideos(stateData.facetimeVideos, storedVideos),
  };
}

function mergeStoredData(
  storedData,
  incomingData,
  facetimeVideos = mergeFacetimeVideos(storedData.facetimeVideos, incomingData.facetimeVideos),
  desktopPictures = mergeDesktopPictures(storedData.desktopPictures, incomingData.desktopPictures),
) {
  const shared = mergeSharedNoteState(storedData, incomingData);

  return {
    items: areDefaultItems(incomingData.items) && !areDefaultItems(storedData.items) ? storedData.items : incomingData.items,
    completions: mergeCompletionSets(storedData.completions, incomingData.completions),
    notes: mergeNestedObjects(storedData.notes, incomingData.notes),
    sharedNotes: shared.notes,
    sharedNoteMeta: shared.meta,
    wallpaper: incomingData.wallpaper || storedData.wallpaper || "",
    wallpaperMode: incomingData.wallpaperMode || storedData.wallpaperMode || DEFAULT_WALLPAPER_MODE,
    iconPositions: mergeIconPositions(storedData.iconPositions, incomingData.iconPositions),
    desktopPictures,
    facetimeVideos,
  };
}

function getStateDataForStorage(data) {
  return {
    ...data,
    desktopPictures: getDesktopPictureMetadataList(data.desktopPictures),
    facetimeVideos: getFacetimeVideoMetadataMap(data.facetimeVideos),
  };
}

function getStateDataForResponse(data, { includeMedia = true } = {}) {
  return {
    ...data,
    facetimeVideos: includeMedia ? data.facetimeVideos : getFacetimeVideoMetadataMap(data.facetimeVideos),
  };
}

function mergeSharedNoteState(storedData, incomingData) {
  const notes = {};
  const meta = {};
  const dateKeys = new Set([
    ...Object.keys(storedData.sharedNotes || {}),
    ...Object.keys(incomingData.sharedNotes || {}),
    ...Object.keys(storedData.sharedNoteMeta || {}),
    ...Object.keys(incomingData.sharedNoteMeta || {}),
  ]);

  dateKeys.forEach((dateKey) => {
    const storedMeta = storedData.sharedNoteMeta?.[dateKey] || {};
    const incomingMeta = incomingData.sharedNoteMeta?.[dateKey] || {};
    const storedTime = Date.parse(storedMeta.editedAt || "");
    const incomingTime = Date.parse(incomingMeta.editedAt || "");
    const useIncoming =
      Object.hasOwn(incomingData.sharedNotes || {}, dateKey) &&
      (!Object.hasOwn(storedData.sharedNotes || {}, dateKey) ||
        (Number.isFinite(incomingTime) && (!Number.isFinite(storedTime) || incomingTime >= storedTime)));

    notes[dateKey] = useIncoming ? incomingData.sharedNotes[dateKey] : storedData.sharedNotes?.[dateKey] || "";
    meta[dateKey] = useIncoming ? incomingMeta : storedMeta;
  });

  return { notes, meta };
}

function mergeNestedObjects(base, override) {
  const merged = { ...(base || {}) };

  Object.entries(override || {}).forEach(([dateKey, value]) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    merged[dateKey] = {
      ...(merged[dateKey] || {}),
      ...value,
    };
  });

  return merged;
}

function mergeCompletionSets(base, override) {
  const merged = mergeNestedObjects(base, override);

  Object.entries(base || {}).forEach(([dateKey, users]) => {
    Object.entries(users || {}).forEach(([userId, items]) => {
      const current = new Set(merged[dateKey]?.[userId] || []);
      (Array.isArray(items) ? items : []).forEach((item) => current.add(item));
      merged[dateKey] ||= {};
      merged[dateKey][userId] = [...current].sort((a, b) => a - b);
    });
  });

  return merged;
}

function areDefaultItems(items) {
  return normalizeItems(items).every((item, index) => item === DEFAULT_ITEMS[index]);
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

function normalizeDesktopPictureMetadataList(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map(normalizeDesktopPictureMetadata)
    .filter((picture) => picture.id)
    .slice(-DESKTOP_PICTURE_LIMIT);
}

function normalizeDesktopPictureMetadata(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return {
    id: normalizeShortText(value.id, "", 96),
    name: normalizeShortText(value.name, "Picture", 96),
    type: normalizeShortText(value.type, "image/jpeg", 48),
    size: Number.isFinite(Number(value.size)) ? Math.max(0, Math.round(Number(value.size))) : 0,
    uploadedBy: normalizeShortText(value.uploadedBy, "Daily Dozen", 80),
    uploadedAt: normalizeShortText(value.uploadedAt, "", 48),
  };
}

function getDesktopPictureMetadataList(pictures) {
  return normalizeDesktopPictures(pictures).map(({ data, ...picture }) => picture);
}

async function getStoredDesktopPictures(store, pictureMeta) {
  const entries = await Promise.all(
    normalizeDesktopPictureMetadataList(pictureMeta).map(async (meta) => {
      const stored = await store.get(getDesktopPictureKey(meta.id), "json");
      const picture = normalizeDesktopPicture({ ...meta, ...(stored || {}) });
      return picture;
    }),
  );

  return entries.filter((picture) => picture.id && picture.data);
}

async function putDesktopPictures(store, pictures) {
  await Promise.all(
    normalizeDesktopPictures(pictures).map((picture) => {
      return store.put(getDesktopPictureKey(picture.id), JSON.stringify(picture));
    }),
  );
}

function getDesktopPictureKey(id) {
  return `${DESKTOP_PICTURE_KEY_PREFIX}${encodeURIComponent(id)}`;
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
      if (hasFacetimeVideoRecord(normalized)) videos[userId] = normalized;
    });
  }

  if (!hasFacetimeVideoRecords(videos)) {
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

function hasFacetimeVideoRecord(video) {
  return Boolean(video?.data || getFacetimeVideoId(video));
}

function hasFacetimeVideoRecords(videos) {
  return Object.values(videos || {}).some(hasFacetimeVideoRecord);
}

async function getStoredFacetimeVideos(store) {
  const entries = await Promise.all(
    USER_IDS.map(async (userId) => {
      const video = await getStoredFacetimeVideo(store, userId);
      return [userId, video];
    }),
  );

  return Object.fromEntries(entries.filter(([, video]) => hasFacetimeVideoRecord(video)));
}

async function getStoredFacetimeVideo(store, userId) {
  return normalizeFacetimeVideo(await store.get(`${FACETIME_VIDEO_KEY_PREFIX}${userId}`, "json"), userId);
}

async function getStoredFacetimeVideoMetadata(store) {
  const entries = await Promise.all(
    USER_IDS.map(async (userId) => {
      const storedMeta = normalizeFacetimeVideo(await store.get(`${FACETIME_VIDEO_META_KEY_PREFIX}${userId}`, "json"), userId);
      if (hasFacetimeVideoRecord(storedMeta)) return [userId, storedMeta];

      const storedVideo = await getStoredFacetimeVideo(store, userId);
      return [userId, getFacetimeVideoMetadata(storedVideo)];
    }),
  );

  return Object.fromEntries(entries.filter(([, video]) => hasFacetimeVideoRecord(video)));
}

async function putFacetimeVideos(store, videos) {
  await Promise.all(
    Object.entries(normalizeFacetimeVideos(videos)).map(([userId, video]) => {
      const metadata = getFacetimeVideoMetadata(video);
      const writes = [store.put(`${FACETIME_VIDEO_META_KEY_PREFIX}${userId}`, JSON.stringify(metadata))];
      if (hasFacetimeVideo(video)) writes.push(store.put(`${FACETIME_VIDEO_KEY_PREFIX}${userId}`, JSON.stringify(video)));
      return Promise.all(writes);
    }),
  );
}

async function archiveReplacedFacetimeVideos(store, storedVideos, incomingVideos) {
  await Promise.all(
    Object.entries(normalizeFacetimeVideos(incomingVideos)).map(async ([userId, incomingVideo]) => {
      if (!hasFacetimeVideo(incomingVideo)) return;

      const storedVideo = normalizeFacetimeVideo(storedVideos?.[userId], userId);
      if (!hasFacetimeVideo(storedVideo)) return;
      if (getFacetimeVideoId(storedVideo) === getFacetimeVideoId(incomingVideo)) return;

      await putArchivedFacetimeVideo(store, userId, storedVideo);
    }),
  );
}

async function getStoredFacetimeArchive(store, userId) {
  return normalizeFacetimeArchiveList(await store.get(getFacetimeArchiveIndexKey(userId), "json"));
}

async function getStoredFacetimeArchiveVideo(store, userId, videoId) {
  const normalizedId = normalizeShortText(videoId, "", 96);
  if (!normalizedId) return {};

  return normalizeFacetimeVideo(await store.get(getFacetimeArchiveVideoKey(userId, normalizedId), "json"), userId);
}

async function putArchivedFacetimeVideo(store, userId, video) {
  const archivedVideo = normalizeFacetimeVideo(video, userId);
  if (!hasFacetimeVideo(archivedVideo)) return;

  const videoId = getFacetimeVideoId(archivedVideo);
  if (!videoId) return;

  const archiveKey = getFacetimeArchiveVideoKey(userId, videoId);
  const indexKey = getFacetimeArchiveIndexKey(userId);
  const metadata = getFacetimeVideoMetadata(archivedVideo);
  const archive = [
    metadata,
    ...(await getStoredFacetimeArchive(store, userId)).filter((entry) => getFacetimeVideoId(entry) !== videoId),
  ];

  await store.put(archiveKey, JSON.stringify(archivedVideo));
  await store.put(indexKey, JSON.stringify(archive));
}

function normalizeFacetimeArchiveList(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => getFacetimeVideoMetadata(entry))
    .filter(hasFacetimeVideoRecord);
}

function getFacetimeArchiveIndexKey(userId) {
  return `${FACETIME_ARCHIVE_INDEX_KEY_PREFIX}${userId}`;
}

function getFacetimeArchiveVideoKey(userId, videoId) {
  return `${FACETIME_ARCHIVE_KEY_PREFIX}${userId}:${encodeURIComponent(videoId)}`;
}

function mergeFacetimeVideos(storedVideos, incomingVideos) {
  const merged = { ...(storedVideos || {}) };

  Object.entries(incomingVideos || {}).forEach(([userId, incomingVideo]) => {
    merged[userId] = mergeFacetimeVideoRecord(merged[userId], incomingVideo);
  });

  return merged;
}

function mergeFacetimeVideoRecord(current, incoming) {
  const currentVideo = normalizeFacetimeVideo(current);
  const incomingVideo = normalizeFacetimeVideo(incoming);

  if (!hasFacetimeVideoRecord(currentVideo)) return incomingVideo;
  if (!hasFacetimeVideoRecord(incomingVideo)) return currentVideo;

  const currentId = getFacetimeVideoId(currentVideo);
  const incomingId = getFacetimeVideoId(incomingVideo);

  if (currentId && currentId === incomingId) {
    return {
      ...currentVideo,
      ...incomingVideo,
      data: incomingVideo.data || currentVideo.data || "",
    };
  }

  return isNewerFacetimeVideo(incomingVideo, currentVideo) ? incomingVideo : currentVideo;
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
  const uploadedAt = normalizeShortText(value.uploadedAt, "", 48);
  const videoId =
    normalizeShortText(value.videoId, "", 96) ||
    uploadedAt ||
    (data.startsWith("data:video/") ? `${data.length}-${data.slice(-36)}` : "");
  if (!data.startsWith("data:video/") && !videoId) return {};
  const uploadedUserId = USER_IDS.includes(value.uploadedUserId) ? value.uploadedUserId : fallbackUserId;

  return {
    data,
    name: normalizeShortText(value.name, "Shared video", 96),
    type,
    size: Number.isFinite(Number(value.size)) ? Math.max(0, Math.round(Number(value.size))) : 0,
    uploadedBy: normalizeShortText(value.uploadedBy, "Daily Dozen", 80),
    uploadedAt,
    uploadedUserId,
    videoId,
  };
}

function getFacetimeVideoMetadata(video) {
  const normalized = normalizeFacetimeVideo(video);
  if (!hasFacetimeVideoRecord(normalized)) return {};
  const { data, ...metadata } = normalized;
  return metadata;
}

function getFacetimeVideoMetadataMap(videos) {
  return Object.fromEntries(
    Object.entries(normalizeFacetimeVideos(videos))
      .map(([userId, video]) => [userId, getFacetimeVideoMetadata(video)])
      .filter(([, video]) => hasFacetimeVideoRecord(video)),
  );
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
  const cleanType = normalizeShortText(type, "", 64).toLowerCase().split(";")[0].trim();
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
