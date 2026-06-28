const USERS = [
  {
    id: "you",
    name: "Scotty P.",
    pin: "1111",
    color: "#b84a3c",
    room: "Room 01",
  },
  {
    id: "wife",
    name: "Claudie D.",
    pin: "2222",
    color: "#2f6f73",
    room: "Room 02",
  },
];

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

const ITEM_ICONS = [
  "shoe",
  "lotus",
  "stretch",
  "book",
  "desk",
  "music",
  "pencil",
  "moon",
  "heart",
  "sun",
  "spark",
  "note",
];

const STORAGE_KEY = "daily-dozen-state-v1";
const SESSION_KEY = "daily-dozen-session-v1";
const CRT_KEY = "daily-dozen-crt-v1";
const ICON_POSITIONS_KEY = "daily-dozen-icon-positions-v1";
const MESSAGE_READS_KEY = "daily-dozen-message-reads-v1";
const FACETIME_VIDEO_READS_KEY = "daily-dozen-facetime-video-reads-v1";
const API_STATE_URL = "/api/state";
const APP_BUILD_LABEL = "Build: 2026-06-28 10:58:15 AM EDT";
const REMOTE_SYNC_INTERVAL_MS = 15000;
const REMOTE_SAVE_DEBOUNCE_MS = 1200;
const WALLPAPER_MAX_SIDE = 1400;
const WALLPAPER_JPEG_QUALITY = 0.78;
const DESKTOP_PICTURE_MAX_SIDE = 900;
const DESKTOP_PICTURE_JPEG_QUALITY = 0.76;
const DESKTOP_PICTURE_LIMIT = 12;
const DEFAULT_WALLPAPER_MODE = "tile";
const KIMCHI_QUEST_MAX_BITES = 5;
const MONKEY_VIDEO_URL = "assets/proboscis-monkey.mp4";
const FACETIME_VIDEO_MAX_BYTES = 8 * 1024 * 1024;
const FACETIME_RECORDING_MAX_MS = 20000;
const UKULELE_VIDEOS = [
  {
    watch: "https://www.youtube.com/watch?v=Xl-BNTeJXjw",
    embed: "https://www.youtube.com/embed/Xl-BNTeJXjw?autoplay=1&rel=0&controls=0&modestbranding=1&playsinline=1&fs=0&iv_load_policy=3&disablekb=1",
  },
  {
    watch: "https://www.youtube.com/watch?v=iMJEtLjnO7E",
    embed: "https://www.youtube.com/embed/iMJEtLjnO7E?autoplay=1&rel=0&controls=0&modestbranding=1&playsinline=1&fs=0&iv_load_policy=3&disablekb=1",
  },
];
const CLAUDIA_SEEDS = [
  { name: "Cosmos", tag: "annual", tone: "pink" },
  { name: "Basil", tag: "herb", tone: "green" },
  { name: "Zinnia", tag: "summer", tone: "orange" },
  { name: "Nasturtium", tag: "edible", tone: "yellow" },
  { name: "Lavender", tag: "perennial", tone: "purple" },
  { name: "Sunflower", tag: "tall", tone: "gold" },
];
const COLORED_PENCILS = [
  { name: "Carmine", color: "#c8282f" },
  { name: "Marigold", color: "#f0a72d" },
  { name: "Canary", color: "#f5d94c" },
  { name: "Clover", color: "#2e8d57" },
  { name: "Sky", color: "#4a8bd8" },
  { name: "Violet", color: "#7650a8" },
  { name: "Umber", color: "#8a5b33" },
  { name: "Slate", color: "#60646f" },
];

const app = document.querySelector("#app");
let remoteSaveTimer;
let remoteSaveOptions = {};
let remoteSyncTimer;
const facetimeVideoUrlCache = {};
const facetimeVideoLoads = {};
const facetimeArchiveLoads = {};
const facetimeArchiveVideoLoads = {};
let facetimeRecorder = null;
let facetimeRecordingStream = null;
let facetimeRecordingChunks = [];
let facetimeRecordingTimer = null;
let facetimeRecordingDiscard = false;

const state = {
  currentUserId: sessionStorage.getItem(SESSION_KEY),
  selectedDate: toDateKey(new Date()),
  data: loadData(),
  activeLoginUserId: USERS[0].id,
  loginPin: "",
  loginError: "",
  settingsOpen: false,
  remoteReady: false,
  remoteStatus: "checking",
  remoteError: "",
  crtEnabled: loadCrtPreference(),
  messageReads: loadMessageReads(),
  facetimeVideoReads: loadFacetimeVideoReads(),
  kimchiQuestOpen: false,
  kimchiQuestBites: 0,
  monkeyWindowOpen: false,
  ukuleleWindowOpen: false,
  ukuleleVideoIndex: 0,
  seedWindows: {
    claudia: false,
    genevieve: false,
  },
  coloredPencilsWindowOpen: false,
  pictureWindowId: "",
  facetimeWindowOpen: false,
  facetimeArchiveOpen: false,
  facetimeArchiveOwnerId: "",
  facetimeArchiveVideoId: "",
  facetimeArchive: {},
  facetimeArchiveStatus: "",
  facetimeUploadStatus: "",
  facetimeMode: "shared",
  facetimePlaybackStatus: "",
  facetimeRecordingActive: false,
  facetimeRecordingStatus: "",
  windowPositions: {},
};

function loadIconPositions() {
  try {
    const parsed = JSON.parse(localStorage.getItem(ICON_POSITIONS_KEY));
    if (!parsed || typeof parsed !== "object") return {};

    return Object.fromEntries(
      Object.entries(parsed)
        .map(([id, position]) => [
          id,
          {
            x: clampIconCoordinate(position?.x),
            y: clampIconCoordinate(position?.y),
          },
        ])
        .filter(([, position]) => position.x || position.y),
    );
  } catch {
    return {};
  }
}

function clampIconCoordinate(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(-900, Math.min(900, Math.round(number)));
}

function loadMessageReads() {
  try {
    const parsed = JSON.parse(localStorage.getItem(MESSAGE_READS_KEY));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveMessageReads() {
  localStorage.setItem(MESSAGE_READS_KEY, JSON.stringify(state.messageReads));
}

function loadFacetimeVideoReads() {
  try {
    const parsed = JSON.parse(localStorage.getItem(FACETIME_VIDEO_READS_KEY));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveFacetimeVideoReads() {
  localStorage.setItem(FACETIME_VIDEO_READS_KEY, JSON.stringify(state.facetimeVideoReads));
}

function setDesktopBackground(imageData) {
  state.data.wallpaper = imageData;
  state.data.wallpaperMode ||= DEFAULT_WALLPAPER_MODE;
  saveData({ immediate: true, includeWallpaper: true });
}

function toggleWallpaperMode() {
  state.data.wallpaperMode = getWallpaperMode() === "tile" ? "fill" : "tile";
  saveData({ immediate: true });
  render();
}

function loadCrtPreference() {
  return localStorage.getItem(CRT_KEY) === "on";
}

function setCrtEnabled(enabled) {
  state.crtEnabled = enabled;
  localStorage.setItem(CRT_KEY, enabled ? "on" : "off");
  updateCrtMode();
}

function updateCrtMode() {
  document.body.classList.toggle("crt-on", state.crtEnabled);
  document.querySelectorAll("[data-crt-toggle]").forEach((button) => {
    button.textContent = state.crtEnabled ? "crt: on" : "crt: off";
    button.setAttribute("aria-pressed", String(state.crtEnabled));
  });
}

function getDefaultData() {
  return {
    items: DEFAULT_ITEMS,
    completions: {},
    notes: {},
    sharedNotes: {},
    sharedNoteMeta: {},
    wallpaper: "",
    wallpaperMode: DEFAULT_WALLPAPER_MODE,
    iconPositions: {},
    desktopPictures: [],
    facetimeVideos: {},
  };
}

function loadData() {
  const fallback = getDefaultData();

  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!parsed || !Array.isArray(parsed.items)) return fallback;

    return {
      items: normalizeItems(parsed.items),
      completions: parsed.completions || {},
      notes: parsed.notes || {},
      sharedNotes: parsed.sharedNotes || {},
      sharedNoteMeta: parsed.sharedNoteMeta || {},
      wallpaper: normalizeWallpaper(parsed.wallpaper),
      wallpaperMode: normalizeWallpaperMode(parsed.wallpaperMode),
      iconPositions: normalizeIconPositions(parsed.iconPositions || loadIconPositions()),
      desktopPictures: normalizeDesktopPictures(parsed.desktopPictures),
      facetimeVideos: normalizeFacetimeVideos(parsed.facetimeVideos, parsed.facetimeVideo),
    };
  } catch {
    return fallback;
  }
}

function normalizeData(data) {
  return {
    items: normalizeItems(Array.isArray(data?.items) ? data.items : DEFAULT_ITEMS),
    completions: data?.completions && typeof data.completions === "object" ? data.completions : {},
    notes: data?.notes && typeof data.notes === "object" ? data.notes : {},
    sharedNotes: data?.sharedNotes && typeof data.sharedNotes === "object" ? data.sharedNotes : {},
    sharedNoteMeta: data?.sharedNoteMeta && typeof data.sharedNoteMeta === "object" ? data.sharedNoteMeta : {},
    wallpaper: normalizeWallpaper(data?.wallpaper),
    wallpaperMode: normalizeWallpaperMode(data?.wallpaperMode),
    iconPositions: normalizeIconPositions(data?.iconPositions),
    desktopPictures: normalizeDesktopPictures(data?.desktopPictures),
    facetimeVideos: normalizeFacetimeVideos(data?.facetimeVideos, data?.facetimeVideo),
  };
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

function normalizeFacetimeVideos(value, legacyVideo) {
  const videos = {};

  if (value && typeof value === "object" && !Array.isArray(value)) {
    Object.entries(value).forEach(([userId, video]) => {
      if (!USERS.some((user) => user.id === userId)) return;

      const normalized = normalizeFacetimeVideo(video, userId);
      if (hasFacetimeVideoRecord(normalized)) videos[userId] = normalized;
    });
  }

  if (!hasFacetimeVideoRecords(videos)) {
    const legacy = normalizeFacetimeVideo(legacyVideo);
    if (hasFacetimeVideo(legacy)) {
      const userId = inferFacetimeUploaderId(legacy) || USERS[0].id;
      videos[userId] = {
        ...legacy,
        uploadedUserId: userId,
        uploadedBy: USERS.find((user) => user.id === userId)?.name || legacy.uploadedBy,
      };
    }
  }

  return videos;
}

function normalizeFacetimeVideo(value, fallbackUserId = "") {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const type = normalizeVideoMimeType(value.type, value.name);
  const rawData = typeof value.data === "string" ? value.data : "";
  const data = normalizeVideoDataUrl(rawData, type);
  const uploadedAt = normalizeShortText(value.uploadedAt, "", 48);
  const videoId =
    normalizeShortText(value.videoId, "", 96) ||
    uploadedAt ||
    (data.startsWith("data:video/") ? getFacetimeVideoFallbackId(data, uploadedAt) : "");
  if (!data.startsWith("data:video/") && !videoId) return {};
  const uploadedUserId = USERS.some((user) => user.id === value.uploadedUserId)
    ? value.uploadedUserId
    : fallbackUserId;

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

function normalizeFacetimeArchiveList(value, fallbackUserId = "") {
  if (!Array.isArray(value)) return [];

  const seen = new Set();
  return value
    .map((entry) => normalizeFacetimeVideo(entry, fallbackUserId))
    .filter((entry) => {
      const videoId = getFacetimeVideoId(entry);
      if (!hasFacetimeVideoRecord(entry) || !videoId || seen.has(videoId)) return false;
      seen.add(videoId);
      return true;
    });
}

function mergeFacetimeArchiveEntry(list, video, fallbackUserId = "") {
  const entry = normalizeFacetimeVideo(video, fallbackUserId);
  const videoId = getFacetimeVideoId(entry);
  if (!hasFacetimeVideoRecord(entry) || !videoId) return normalizeFacetimeArchiveList(list, fallbackUserId);

  return [
    entry,
    ...normalizeFacetimeArchiveList(list, fallbackUserId).filter((candidate) => getFacetimeVideoId(candidate) !== videoId),
  ];
}

function inferFacetimeUploaderId(video) {
  if (USERS.some((user) => user.id === video.uploadedUserId)) return video.uploadedUserId;
  const uploadedBy = String(video.uploadedBy || "").trim().toLowerCase();
  return USERS.find((user) => user.name.toLowerCase() === uploadedBy)?.id || "";
}

function getFacetimeVideoFallbackId(data, uploadedAt = "") {
  const time = normalizeShortText(uploadedAt, "", 48);
  return time || `${data.length}-${data.slice(-36)}`;
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

function normalizeWallpaper(value) {
  if (typeof value !== "string") return "";
  return value.startsWith("data:image/") ? value : "";
}

function normalizeWallpaperMode(value) {
  return value === "fill" ? "fill" : DEFAULT_WALLPAPER_MODE;
}

function normalizeItems(items) {
  const normalized = items.map((item) => String(item || "").trim()).filter(Boolean);
  const withDefaults = [...normalized, ...DEFAULT_ITEMS].slice(0, 12);
  return withDefaults;
}

function saveLocalData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
  } catch {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state.data, wallpaper: "", desktopPictures: [], facetimeVideo: {}, facetimeVideos: {} }));
    } catch {}
  }
}

function saveData({ immediate = false, includeWallpaper = false, includeDesktopPictures = false, includeFacetimeVideos = false, facetimeUserId = "" } = {}) {
  saveLocalData();
  const options = {
    includeWallpaper,
    includeDesktopPictures,
    includeFacetimeVideos,
    facetimeUserId,
  };

  if (immediate) {
    window.clearTimeout(remoteSaveTimer);
    const pendingOptions = mergeRemoteSaveOptions(remoteSaveOptions, options);
    remoteSaveOptions = {};
    saveRemoteData(pendingOptions);
    return;
  }

  scheduleRemoteSave(options);
}

function scheduleRemoteSave(options = {}) {
  remoteSaveOptions = mergeRemoteSaveOptions(remoteSaveOptions, options);
  window.clearTimeout(remoteSaveTimer);
  remoteSaveTimer = window.setTimeout(() => {
    const pendingOptions = remoteSaveOptions;
    remoteSaveOptions = {};
    saveRemoteData(pendingOptions);
  }, REMOTE_SAVE_DEBOUNCE_MS);
}

function mergeRemoteSaveOptions(current = {}, incoming = {}) {
  return {
    includeWallpaper: Boolean(current.includeWallpaper || incoming.includeWallpaper),
    includeDesktopPictures: Boolean(current.includeDesktopPictures || incoming.includeDesktopPictures),
    includeFacetimeVideos: Boolean(current.includeFacetimeVideos || incoming.includeFacetimeVideos),
    facetimeUserId: incoming.facetimeUserId || current.facetimeUserId || "",
  };
}

function getRemoteStateUrl({ includeMedia = false } = {}) {
  return includeMedia ? API_STATE_URL : `${API_STATE_URL}?media=lite`;
}

function getFacetimeVideoApiUrl(userId) {
  return `${API_STATE_URL}?facetimeVideo=${encodeURIComponent(userId || "")}`;
}

function getFacetimeArchiveApiUrl(userId) {
  return `${API_STATE_URL}?facetimeArchive=${encodeURIComponent(userId || "")}`;
}

function getFacetimeArchiveVideoApiUrl(userId, videoId) {
  return `${API_STATE_URL}?facetimeArchiveVideo=${encodeURIComponent(userId || "")}&videoId=${encodeURIComponent(videoId || "")}`;
}

function getDataForRemoteSave(data, options = {}) {
  const normalized = normalizeData(data);

  return {
    ...normalized,
    wallpaper: options.includeWallpaper ? normalized.wallpaper : "",
    desktopPictures: options.includeDesktopPictures ? normalized.desktopPictures : [],
    facetimeVideos: getFacetimeVideosForRemoteSave(normalized.facetimeVideos, options),
  };
}

function getFacetimeVideosForRemoteSave(videos, options = {}) {
  const normalized = normalizeFacetimeVideos(videos);

  if (!options.includeFacetimeVideos) return getFacetimeVideoMetadataMap(normalized);

  return Object.fromEntries(
    Object.entries(normalized).map(([userId, video]) => [
      userId,
      !options.facetimeUserId || userId === options.facetimeUserId ? video : getFacetimeVideoMetadata(video),
    ]),
  );
}

async function saveRemoteData(options = {}) {
  state.remoteStatus = "saving";
  updateSyncIndicator();

  try {
    let dataToSave = state.data;

    try {
      const currentResponse = await fetch(getRemoteStateUrl({ includeMedia: false }), {
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      });

      if (currentResponse.ok) {
        const currentPayload = await currentResponse.json();
        const currentData = normalizeData(currentPayload.data);
        dataToSave = mergeData(currentData, state.data);
        state.data = dataToSave;
        saveLocalData();
      }
    } catch {}

    const response = await fetch(API_STATE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: getDataForRemoteSave(dataToSave, options) }),
    });

    if (!response.ok) throw new Error(`Remote save failed: ${response.status}`);
    const savedPayload = await response.json().catch(() => null);
    const savedData = normalizeData(savedPayload?.data);
    state.data = mergeData(savedData, state.data);
    saveLocalData();
    state.remoteReady = true;
    state.remoteStatus = "synced";
    state.remoteError = "";
  } catch (error) {
    state.remoteReady = false;
    state.remoteStatus = "local";
    state.remoteError = error.message || "Remote save failed.";
  } finally {
    updateSyncIndicator();
  }
}

async function loadRemoteData({ mergeLocal = false, renderAfter = false, includeMedia = false } = {}) {
  state.remoteStatus = "checking";
  updateSyncIndicator();
  const previousFacetimeVideoId = getVisibleFacetimeVideoId();
  const previousPartnerFacetimeVideoId = getFacetimeUnreadStatus().videoId;
  const previousDesktopPicturesSignature = getDesktopPicturesSignature();

  try {
    const response = await fetch(getRemoteStateUrl({ includeMedia }), {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) throw new Error(`Remote load failed: ${response.status}`);

    const payload = await response.json();
    const remoteData = normalizeData(payload.data);
    state.data = mergeData(remoteData, state.data);
    state.remoteReady = true;
    state.remoteStatus = "synced";
    state.remoteError = "";
    saveLocalData();

    if (mergeLocal && hasLocalActivity(state.data)) {
      scheduleRemoteSave();
    }

    const facetimeVideoChanged = previousFacetimeVideoId !== getVisibleFacetimeVideoId();
    const partnerFacetimeVideoChanged = previousPartnerFacetimeVideoId !== getFacetimeUnreadStatus().videoId;
    const desktopPicturesChanged = previousDesktopPicturesSignature !== getDesktopPicturesSignature();
    if (facetimeVideoChanged) state.facetimePlaybackStatus = "";
    if (partnerFacetimeVideoChanged && state.facetimeWindowOpen && state.facetimeMode === "shared") {
      markFacetimePartnerVideoRead();
    }

    if (
      renderAfter &&
      !isTextEditing() &&
      (desktopPicturesChanged ||
        (!state.monkeyWindowOpen &&
          !state.ukuleleWindowOpen &&
          (!state.facetimeWindowOpen || facetimeVideoChanged || partnerFacetimeVideoChanged)))
    ) {
      render();
    } else {
      updateSyncIndicator();
    }
  } catch (error) {
    state.remoteReady = false;
    state.remoteStatus = "local";
    state.remoteError = error.message || "Remote load failed.";
    updateSyncIndicator();
  }
}

function getSyncLabel() {
  const labels = {
    checking: "sync checking",
    saving: "sync saving",
    synced: "synced",
    local: "local only",
  };

  return labels[state.remoteStatus] || "sync";
}

function updateSyncIndicator() {
  document.querySelectorAll("[data-sync-status]").forEach((element) => {
    element.textContent = getSyncLabel();
    element.dataset.syncStatus = state.remoteStatus;
    element.title = state.remoteError || "Shared Cloudflare KV sync";
  });
}

function mergeData(remoteData, localData) {
  const remote = normalizeData(remoteData);
  const local = normalizeData(localData);
  const shared = mergeSharedNoteState(remote, local);

  return {
    items: areDefaultItems(remote.items) ? local.items : remote.items,
    completions: mergeCompletionSets(local.completions, remote.completions),
    notes: mergeNestedObjects(local.notes, remote.notes),
    sharedNotes: shared.notes,
    sharedNoteMeta: shared.meta,
    wallpaper: remote.wallpaper || local.wallpaper || "",
    wallpaperMode: remote.wallpaperMode || local.wallpaperMode || DEFAULT_WALLPAPER_MODE,
    iconPositions: mergeIconPositions(remote.iconPositions, local.iconPositions),
    desktopPictures: mergeDesktopPictures(remote.desktopPictures, local.desktopPictures),
    facetimeVideos: mergeFacetimeVideos(remote.facetimeVideos, local.facetimeVideos),
  };
}

function mergeSharedNoteState(remote, local) {
  const notes = {};
  const meta = {};
  const dateKeys = new Set([
    ...Object.keys(local.sharedNotes || {}),
    ...Object.keys(remote.sharedNotes || {}),
    ...Object.keys(local.sharedNoteMeta || {}),
    ...Object.keys(remote.sharedNoteMeta || {}),
  ]);

  dateKeys.forEach((dateKey) => {
    const localMeta = local.sharedNoteMeta?.[dateKey] || {};
    const remoteMeta = remote.sharedNoteMeta?.[dateKey] || {};
    const localTime = Date.parse(localMeta.editedAt || "");
    const remoteTime = Date.parse(remoteMeta.editedAt || "");
    const useRemote =
      Object.hasOwn(remote.sharedNotes || {}, dateKey) &&
      (!Object.hasOwn(local.sharedNotes || {}, dateKey) ||
        (Number.isFinite(remoteTime) && (!Number.isFinite(localTime) || remoteTime >= localTime)));

    notes[dateKey] = useRemote ? remote.sharedNotes[dateKey] : local.sharedNotes?.[dateKey] || "";
    meta[dateKey] = useRemote ? remoteMeta : localMeta;
  });

  return { notes, meta };
}

function hasIconPositions(iconPositions) {
  return Object.keys(iconPositions || {}).length > 0;
}

function mergeIconPositions(remotePositions, localPositions) {
  return {
    ...normalizeIconPositions(remotePositions),
    ...normalizeIconPositions(localPositions),
  };
}

function hasFacetimeVideo(video) {
  return Boolean(video?.data);
}

function hasFacetimeVideoRecord(video) {
  return Boolean(video?.data || getFacetimeVideoId(video));
}

function hasFacetimeVideos(videos) {
  return Object.values(videos || {}).some(hasFacetimeVideo);
}

function hasFacetimeVideoRecords(videos) {
  return Object.values(videos || {}).some(hasFacetimeVideoRecord);
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

function hasDesktopPictures(pictures) {
  return normalizeDesktopPictures(pictures).length > 0;
}

function mergeDesktopPictures(remotePictures, localPictures) {
  const picturesById = new Map();

  normalizeDesktopPictures(remotePictures).forEach((picture) => {
    picturesById.set(picture.id, picture);
  });

  normalizeDesktopPictures(localPictures).forEach((picture) => {
    picturesById.set(picture.id, picture);
  });

  return [...picturesById.values()].slice(-DESKTOP_PICTURE_LIMIT);
}

function getDesktopPicturesSignature() {
  return normalizeDesktopPictures(state.data.desktopPictures)
    .map((picture) => `${picture.id}:${picture.uploadedAt}`)
    .join("|");
}

function mergeFacetimeVideos(remoteVideos, localVideos) {
  const merged = { ...(remoteVideos || {}) };

  Object.entries(localVideos || {}).forEach(([userId, localVideo]) => {
    merged[userId] = mergeFacetimeVideoRecord(merged[userId], localVideo);
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

function mergeNestedObjects(base, override) {
  const merged = { ...base };

  Object.entries(override || {}).forEach(([dateKey, value]) => {
    merged[dateKey] = {
      ...(merged[dateKey] || {}),
      ...(value || {}),
    };
  });

  return merged;
}

function mergeCompletionSets(base, override) {
  const merged = mergeNestedObjects(base, override);

  Object.entries(base || {}).forEach(([dateKey, users]) => {
    Object.entries(users || {}).forEach(([userId, items]) => {
      const current = new Set(merged[dateKey]?.[userId] || []);
      items.forEach((item) => current.add(item));
      merged[dateKey] ||= {};
      merged[dateKey][userId] = [...current].sort((a, b) => a - b);
    });
  });

  return merged;
}

function areDefaultItems(items) {
  return normalizeItems(items).every((item, index) => item === DEFAULT_ITEMS[index]);
}

function hasLocalActivity(data) {
  return (
    !areDefaultItems(data.items) ||
    Object.keys(data.completions || {}).length > 0 ||
    Object.keys(data.notes || {}).length > 0 ||
    Object.keys(data.sharedNotes || {}).length > 0 ||
    Object.keys(data.sharedNoteMeta || {}).length > 0 ||
    hasIconPositions(data.iconPositions) ||
    hasDesktopPictures(data.desktopPictures) ||
    hasFacetimeVideos(data.facetimeVideos) ||
    Boolean(data.wallpaper) ||
    data.wallpaperMode === "fill"
  );
}

function isTextEditing() {
  return Boolean(document.activeElement?.matches("input, textarea"));
}

function startRemoteSync() {
  loadRemoteData({ mergeLocal: true, renderAfter: true });

  window.clearInterval(remoteSyncTimer);
  remoteSyncTimer = window.setInterval(() => {
    if (document.visibilityState === "visible" && !isTextEditing()) {
      loadRemoteData({ renderAfter: Boolean(getUser()) });
    }
  }, REMOTE_SYNC_INTERVAL_MS);

  window.addEventListener("focus", () => {
    if (!isTextEditing()) {
      loadRemoteData({ renderAfter: Boolean(getUser()) });
    }
  });
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(dateKey, style = "long") {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  if (style === "short") {
    return new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
    }).format(date);
  }

  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

function getUser() {
  return USERS.find((user) => user.id === state.currentUserId);
}

function getOtherUser(userId = state.currentUserId) {
  return USERS.find((user) => user.id !== userId) || null;
}

function getFacetimeVideoForUser(userId) {
  if (!userId) return {};
  return state.data.facetimeVideos?.[userId] || {};
}

function getFacetimeVideoId(video) {
  if (!video || typeof video !== "object") return "";
  return video.videoId || video.uploadedAt || (video.data ? getFacetimeVideoFallbackId(video.data, video.uploadedAt) : "");
}

function getVisibleFacetimeOwner() {
  const user = getUser();
  if (!user) return null;
  return state.facetimeMode === "mine" ? user : getOtherUser(user.id);
}

function getVisibleFacetimeVideo() {
  return getFacetimeVideoForUser(getVisibleFacetimeOwner()?.id);
}

function getVisibleFacetimeVideoId() {
  return getFacetimeVideoId(getVisibleFacetimeVideo());
}

function getFacetimeUnreadStatus(userId = state.currentUserId) {
  const partner = getOtherUser(userId);
  const video = getFacetimeVideoForUser(partner?.id);
  const videoId = getFacetimeVideoId(video);

  return {
    unread: Boolean(userId && partner && videoId && state.facetimeVideoReads[userId]?.[partner.id] !== videoId),
    partner,
    video,
    videoId,
  };
}

function markFacetimePartnerVideoRead(userId = state.currentUserId) {
  const status = getFacetimeUnreadStatus(userId);
  if (!status.partner || !status.videoId || !status.unread) return;

  state.facetimeVideoReads[userId] ||= {};
  state.facetimeVideoReads[userId][status.partner.id] = status.videoId;
  saveFacetimeVideoReads();
}

async function loadVisibleFacetimeVideo({ renderAfter = false } = {}) {
  const owner = getVisibleFacetimeOwner();
  if (!owner) return null;
  return loadFacetimeVideoForUser(owner.id, { renderAfter });
}

async function loadFacetimeVideoForUser(userId, { renderAfter = false } = {}) {
  if (!userId) return null;

  const currentVideo = getFacetimeVideoForUser(userId);
  if (hasFacetimeVideo(currentVideo)) return currentVideo;
  if (facetimeVideoLoads[userId]) return facetimeVideoLoads[userId];

  state.facetimePlaybackStatus = "Loading video...";
  setFacetimePlaybackStatus("Loading video...");

  facetimeVideoLoads[userId] = fetch(getFacetimeVideoApiUrl(userId), {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Video load failed: ${response.status}`);
      const payload = await response.json();
      const loadedVideo = normalizeFacetimeVideo(payload.video, userId);
      if (!hasFacetimeVideoRecord(loadedVideo)) return null;

      state.data.facetimeVideos ||= {};
      state.data.facetimeVideos[userId] = mergeFacetimeVideoRecord(state.data.facetimeVideos[userId], loadedVideo);
      state.remoteReady = true;
      state.remoteStatus = "synced";
      state.remoteError = "";
      saveLocalData();

      if (renderAfter && state.facetimeWindowOpen && getVisibleFacetimeOwner()?.id === userId) {
        state.facetimePlaybackStatus = "";
        render();
      } else {
        updateSyncIndicator();
      }

      return state.data.facetimeVideos[userId];
    })
    .catch((error) => {
      state.remoteReady = false;
      state.remoteStatus = "local";
      state.remoteError = error.message || "Video load failed.";
      setFacetimePlaybackStatus("Could not load video from the cloud.");
      updateSyncIndicator();
      return null;
    })
    .finally(() => {
      delete facetimeVideoLoads[userId];
    });

  return facetimeVideoLoads[userId];
}

function getFacetimeArchiveOwner() {
  return USERS.find((user) => user.id === state.facetimeArchiveOwnerId) || getVisibleFacetimeOwner() || getUser() || USERS[0];
}

function getFacetimeArchiveList(userId = getFacetimeArchiveOwner()?.id) {
  return normalizeFacetimeArchiveList(state.facetimeArchive?.[userId], userId);
}

function getSelectedFacetimeArchiveVideo() {
  const owner = getFacetimeArchiveOwner();
  if (!owner || !state.facetimeArchiveVideoId) return {};

  return getFacetimeArchiveList(owner.id).find((video) => getFacetimeVideoId(video) === state.facetimeArchiveVideoId) || {};
}

async function loadFacetimeArchive(userId, { renderAfter = false, force = false } = {}) {
  if (!userId) return [];
  if (!force && state.facetimeArchive?.[userId]) return getFacetimeArchiveList(userId);
  if (facetimeArchiveLoads[userId]) return facetimeArchiveLoads[userId];

  state.facetimeArchiveStatus = "Loading archive...";

  facetimeArchiveLoads[userId] = fetch(getFacetimeArchiveApiUrl(userId), {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Archive load failed: ${response.status}`);
      const payload = await response.json();
      state.facetimeArchive ||= {};
      state.facetimeArchive[userId] = normalizeFacetimeArchiveList(payload.archive, userId);
      state.facetimeArchiveStatus = "";
      state.remoteReady = true;
      state.remoteStatus = "synced";
      state.remoteError = "";

      if (renderAfter && state.facetimeArchiveOpen && getFacetimeArchiveOwner()?.id === userId) {
        mountFacetimeArchiveWindow();
      } else {
        updateSyncIndicator();
      }

      return getFacetimeArchiveList(userId);
    })
    .catch((error) => {
      state.remoteReady = false;
      state.remoteStatus = "local";
      state.remoteError = error.message || "Archive load failed.";
      state.facetimeArchiveStatus = "Could not load archive.";
      updateSyncIndicator();
      return [];
    })
    .finally(() => {
      delete facetimeArchiveLoads[userId];
    });

  return facetimeArchiveLoads[userId];
}

async function loadFacetimeArchiveVideo(userId, videoId, { renderAfter = false } = {}) {
  if (!userId || !videoId) return null;

  const currentVideo = getFacetimeArchiveList(userId).find((video) => getFacetimeVideoId(video) === videoId);
  if (hasFacetimeVideo(currentVideo)) return currentVideo;

  const loadKey = `${userId}:${videoId}`;
  if (facetimeArchiveVideoLoads[loadKey]) return facetimeArchiveVideoLoads[loadKey];

  state.facetimeArchiveStatus = "Loading archived video...";

  facetimeArchiveVideoLoads[loadKey] = fetch(getFacetimeArchiveVideoApiUrl(userId, videoId), {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Archived video load failed: ${response.status}`);
      const payload = await response.json();
      const loadedVideo = normalizeFacetimeVideo(payload.video, userId);
      if (!hasFacetimeVideoRecord(loadedVideo)) return null;

      state.facetimeArchive ||= {};
      state.facetimeArchive[userId] = mergeFacetimeArchiveEntry(state.facetimeArchive[userId], loadedVideo, userId);
      state.facetimeArchiveStatus = "";
      state.remoteReady = true;
      state.remoteStatus = "synced";
      state.remoteError = "";

      if (renderAfter && state.facetimeArchiveOpen && getFacetimeArchiveOwner()?.id === userId) {
        mountFacetimeArchiveWindow();
      } else {
        updateSyncIndicator();
      }

      return loadedVideo;
    })
    .catch((error) => {
      state.remoteReady = false;
      state.remoteStatus = "local";
      state.remoteError = error.message || "Archived video load failed.";
      state.facetimeArchiveStatus = "Could not load archived video.";
      updateSyncIndicator();
      return null;
    })
    .finally(() => {
      delete facetimeArchiveVideoLoads[loadKey];
    });

  return facetimeArchiveVideoLoads[loadKey];
}

function renderFacetimeBadge() {
  return getFacetimeUnreadStatus().unread ? `<span class="desktop-badge" data-facetime-badge aria-label="1 new video">1</span>` : "";
}

function getCompletion(userId, dateKey = state.selectedDate) {
  return state.data.completions[dateKey]?.[userId] || [];
}

function setCompletion(userId, itemIndex, checked) {
  const dateKey = state.selectedDate;
  state.data.completions[dateKey] ||= {};
  const current = new Set(state.data.completions[dateKey][userId] || []);

  if (checked) {
    current.add(itemIndex);
  } else {
    current.delete(itemIndex);
  }

  state.data.completions[dateKey][userId] = [...current].sort((a, b) => a - b);
  saveData({ immediate: true });
}

function getNote(userId, dateKey = state.selectedDate) {
  return state.data.notes[dateKey]?.[userId] || "";
}

function setNote(userId, value) {
  const dateKey = state.selectedDate;
  state.data.notes[dateKey] ||= {};
  state.data.notes[dateKey][userId] = value;
  saveData();
}

function getSharedNote(dateKey = state.selectedDate) {
  return state.data.sharedNotes?.[dateKey] || "";
}

function setSharedNote(value) {
  state.data.sharedNotes ||= {};
  state.data.sharedNoteMeta ||= {};
  state.data.sharedNotes[state.selectedDate] = value;
  const user = getUser();

  if (user) {
    const messageId = createMessageId(user.id);
    state.data.sharedNoteMeta[state.selectedDate] = {
      editorId: user.id,
      editedAt: new Date().toISOString(),
      messageId,
    };
    markMessageIdRead(user.id, state.selectedDate, messageId);
  }

  saveData();
}

function createMessageId(userId) {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${userId}-${Date.now()}`;
}

function getSharedNoteMeta(dateKey = state.selectedDate) {
  const meta = state.data.sharedNoteMeta?.[dateKey];
  return meta && typeof meta === "object" ? meta : {};
}

function getSharedNoteStatus(userId, dateKey = state.selectedDate) {
  const meta = getSharedNoteMeta(dateKey);
  const messageId = meta.messageId || "";
  const editor = USERS.find((candidate) => candidate.id === meta.editorId);
  const unread = Boolean(
    messageId &&
      userId &&
      meta.editorId &&
      meta.editorId !== userId &&
      state.messageReads[userId]?.[dateKey] !== messageId,
  );

  return {
    unread,
    from: editor?.name || "Daily Dozen",
    editedAt: meta.editedAt ? formatMessageTime(meta.editedAt) : "",
    messageId,
  };
}

function formatMessageTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function markMessageIdRead(userId, dateKey, messageId) {
  if (!userId || !messageId) return;
  state.messageReads[userId] ||= {};
  state.messageReads[userId][dateKey] = messageId;
  saveMessageReads();
}

function markSharedNoteRead() {
  const user = getUser();
  if (!user) return;

  const status = getSharedNoteStatus(user.id);
  if (!status.messageId || !status.unread) return;

  markMessageIdRead(user.id, state.selectedDate, status.messageId);
  updateSharedMessageIndicator();
}

function updateSharedMessageIndicator() {
  const user = getUser();
  if (!user) return;

  const status = getSharedNoteStatus(user.id);
  const block = document.querySelector("[data-shared-message-state]");
  block?.classList.toggle("has-unread", status.unread);
  if (block) block.dataset.sharedMessageState = status.unread ? "unread" : "read";

  const from = document.querySelector("[data-shared-message-from]");
  if (from) from.textContent = status.unread ? `From ${status.from}` : "For both of you";

  const title = document.querySelector("[data-shared-message-title]");
  if (title) title.textContent = status.unread ? "1 new message!" : "Shared note";

  const meta = document.querySelector("[data-shared-message-meta]");
  if (meta) meta.textContent = status.editedAt ? `Last edited ${status.editedAt}` : "";
}

function getProgress(userId, dateKey = state.selectedDate) {
  const count = getCompletion(userId, dateKey).length;
  return {
    count,
    total: 12,
    percentage: Math.round((count / 12) * 100),
  };
}

function changeDate(offset) {
  const [year, month, day] = state.selectedDate.split("-").map(Number);
  const nextDate = new Date(year, month - 1, day + offset);
  state.selectedDate = toDateKey(nextDate);
  render();
}

function iconMarkup(name) {
  const common = 'viewBox="0 0 24 24" aria-hidden="true" focusable="false"';
  const icons = {
    shoe: `<svg ${common}><path d="M4.5 14.5c2.8.7 5.4-.2 7.1-2.5l1.3-1.8c.5-.7 1.6-.7 2.1 0l1.1 1.5c.9 1.2 2.2 2 3.7 2.3l.7.1v3.1H4.5v-2.7Z"/><path d="M6 17.2v1.4h14.5"/></svg>`,
    lotus: `<svg ${common}><path d="M12 19c-2.6-1.4-4-3.4-4-6.1 0-2.1 1.2-4.2 4-6.4 2.8 2.2 4 4.3 4 6.4 0 2.7-1.4 4.7-4 6.1Z"/><path d="M8.4 16.6C5.6 16 4 14.4 3.2 11.7c2.5-.3 4.6.4 6.2 2.2"/><path d="M15.6 16.6c2.8-.6 4.4-2.2 5.2-4.9-2.5-.3-4.6.4-6.2 2.2"/></svg>`,
    stretch: `<svg ${common}><path d="M15 5.5a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z"/><path d="M6 19c2.6-3.5 4.8-5.3 8.5-5.8L19 12"/><path d="m8 8 5 3 4-1.2"/><path d="m10.5 12.5-2.1 4.7"/></svg>`,
    book: `<svg ${common}><path d="M5 5.5c2.8-.9 5-.5 7 1.3v12c-2-1.8-4.2-2.2-7-1.3v-12Z"/><path d="M19 5.5c-2.8-.9-5-.5-7 1.3v12c2-1.8 4.2-2.2 7-1.3v-12Z"/></svg>`,
    desk: `<svg ${common}><path d="M4 9h16"/><path d="M6 9V6h12v3"/><path d="M7 9v10"/><path d="M17 9v10"/><path d="M7 14h10"/></svg>`,
    music: `<svg ${common}><path d="M9 18.2a2.4 2.4 0 1 1-1-2V6.8l10-2v9.4a2.4 2.4 0 1 1-1-2V8.3l-8 1.6v8.3Z"/></svg>`,
    pencil: `<svg ${common}><path d="M5 18.5 6.2 14 15.8 4.4a2 2 0 0 1 2.8 0l1 1a2 2 0 0 1 0 2.8L10 17.8 5 18.5Z"/><path d="m14.4 5.8 3.8 3.8"/></svg>`,
    moon: `<svg ${common}><path d="M18.2 15.4A7.5 7.5 0 0 1 8.6 5.8 8 8 0 1 0 18.2 15.4Z"/></svg>`,
    heart: `<svg ${common}><path d="M12 19.2s-7-4.3-7-9.1A3.8 3.8 0 0 1 11.8 8 3.8 3.8 0 0 1 19 10.1c0 4.8-7 9.1-7 9.1Z"/></svg>`,
    sun: `<svg ${common}><path d="M12 16.2a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4Z"/><path d="M12 2.8V5"/><path d="M12 19v2.2"/><path d="m4.3 4.3 1.6 1.6"/><path d="m18.1 18.1 1.6 1.6"/><path d="M2.8 12H5"/><path d="M19 12h2.2"/><path d="m4.3 19.7 1.6-1.6"/><path d="m18.1 5.9 1.6-1.6"/></svg>`,
    spark: `<svg ${common}><path d="M12 3.8 14 10l6.2 2-6.2 2-2 6.2-2-6.2-6.2-2 6.2-2 2-6.2Z"/><path d="M5 4.5 6 7.2l2.7 1L6 9.1 5 12 4 9.1 1.3 8.2 4 7.2 5 4.5Z"/></svg>`,
    note: `<svg ${common}><path d="M6 4.5h9l3 3v12H6v-15Z"/><path d="M15 4.5v3h3"/><path d="M8.5 11h7"/><path d="M8.5 14.5h7"/></svg>`,
    key: `<svg ${common}><path d="M14 9.5a4.5 4.5 0 1 1-1.2-3.1L21 14.6V18h-3.4v-2.4h-2.4v-2.4l-2.4-2.4A4.6 4.6 0 0 1 14 9.5Z"/><path d="M7.5 9.5h.1"/></svg>`,
    lock: `<svg ${common}><path d="M6.5 10h11v9.5h-11V10Z"/><path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10"/></svg>`,
    logout: `<svg ${common}><path d="M10 6H5.5v12H10"/><path d="M13 8.5 16.5 12 13 15.5"/><path d="M16.5 12H9"/></svg>`,
    edit: `<svg ${common}><path d="M5 19h4l10-10a2.1 2.1 0 0 0-3-3L6 16v3Z"/><path d="m14.5 7.5 2 2"/></svg>`,
    calendar: `<svg ${common}><path d="M5 5.5h14v14H5v-14Z"/><path d="M8 3.5v4"/><path d="M16 3.5v4"/><path d="M5 9.5h14"/></svg>`,
    chevronLeft: `<svg ${common}><path d="m14.5 6-6 6 6 6"/></svg>`,
    chevronRight: `<svg ${common}><path d="m9.5 6 6 6-6 6"/></svg>`,
    check: `<svg ${common}><path d="m5 12.5 4.2 4.2L19.5 6.8"/></svg>`,
  };

  return icons[name] || icons.spark;
}

function render() {
  const preservedMediaWindows = collectPreservedMediaWindows();
  const restorableMediaIds = getRestorableMediaIds(preservedMediaWindows);
  const mediaParkingLot = parkPreservedMediaWindows(preservedMediaWindows);
  const user = getUser();
  app.innerHTML = renderMacShell(user ? renderDashboard(user) : renderLogin(), restorableMediaIds);
  bindEvents();
  restorePreservedMediaWindows(preservedMediaWindows);
  mediaParkingLot?.remove();
}

function collectPreservedMediaWindows() {
  return ["facetime", "facetime-archive", "monkey-see-genevieve-do", "ulaylee"]
    .map((id) => {
      const node = document.querySelector(`[data-draggable-window="${id}"]`);

      return {
        id,
        key: node?.dataset.mediaPreserveKey || "",
        node,
        playback: getMediaPlaybackSnapshot(node),
      };
    })
    .filter((entry) => entry.key && entry.node);
}

function getRestorableMediaIds(entries) {
  return new Set(entries.filter(({ id, key }) => key === getMediaWindowPreserveKey(id)).map(({ id }) => id));
}

function parkPreservedMediaWindows(entries) {
  const restorableEntries = entries.filter(({ id, key }) => key === getMediaWindowPreserveKey(id));
  if (!restorableEntries.length) return null;

  const parkingLot = document.createElement("div");
  parkingLot.setAttribute("aria-hidden", "true");
  parkingLot.style.cssText = "position:fixed;inset:0;overflow:hidden;opacity:0;pointer-events:none;z-index:-1;";
  document.body.append(parkingLot);
  restorableEntries.forEach(({ node }) => parkingLot.append(node));
  return parkingLot;
}

function restorePreservedMediaWindows(entries) {
  entries.forEach(({ id, key, node, playback }) => {
    if (key !== getMediaWindowPreserveKey(id)) return;

    const replacement = document.querySelector(`[data-media-window-placeholder="${id}"], [data-draggable-window="${id}"]`);
    if (!replacement) return;

    replacement.replaceWith(node);
    restoreMediaPlayback(node, playback);
  });
}

function getMediaPlaybackSnapshot(node) {
  if (!node) return [];

  return Array.from(node.querySelectorAll("video")).map((video, index) => ({
    index,
    currentTime: Number.isFinite(video.currentTime) ? video.currentTime : 0,
    muted: video.muted,
    paused: video.paused,
    playbackRate: video.playbackRate,
  }));
}

function restoreMediaPlayback(node, snapshots) {
  snapshots.forEach((snapshot) => {
    const video = node.querySelectorAll("video")[snapshot.index];
    if (!video) return;

    const restore = () => {
      try {
        video.currentTime = snapshot.currentTime;
      } catch {}

      video.muted = snapshot.muted;
      video.playbackRate = snapshot.playbackRate || 1;

      if (!snapshot.paused) {
        video.play().catch(() => {});
      }
    };

    if (video.readyState >= 1) {
      restore();
      return;
    }

    video.addEventListener("loadedmetadata", restore, { once: true });
  });
}

function getMediaWindowPreserveKey(id) {
  if (id === "facetime") {
    return getFacetimeMediaPreserveKey();
  }

  if (id === "facetime-archive") {
    return getFacetimeArchiveMediaPreserveKey();
  }

  if (id === "monkey-see-genevieve-do") {
    return state.monkeyWindowOpen ? "monkey-see-genevieve-do" : "";
  }

  if (id === "ulaylee") {
    return state.ukuleleWindowOpen ? `ulaylee:${state.ukuleleVideoIndex}` : "";
  }

  return "";
}

function getFacetimeMediaPreserveKey() {
  const owner = getVisibleFacetimeOwner();
  const videoId = getVisibleFacetimeVideoId();
  return state.facetimeWindowOpen && owner && videoId ? `facetime:${state.facetimeMode}:${owner.id}:${videoId}` : "";
}

function getFacetimeArchiveMediaPreserveKey() {
  const owner = getFacetimeArchiveOwner();
  const video = getSelectedFacetimeArchiveVideo();
  const videoId = getFacetimeVideoId(video);
  return state.facetimeArchiveOpen && owner && hasFacetimeVideo(video) ? `facetime-archive:${owner.id}:${videoId}` : "";
}

function renderMediaWindowSlot(id, preservedMediaIds, html) {
  if (preservedMediaIds.has(id)) return `<div data-media-window-placeholder="${escapeAttribute(id)}"></div>`;
  return html;
}

function mountDesktopWindow(selector, html, bindWindowEvents = () => {}) {
  const surface = document.querySelector(".desktop-surface");
  if (!surface) {
    render();
    return;
  }

  const template = document.createElement("template");
  template.innerHTML = html.trim();
  const nextWindow = template.content.firstElementChild;
  if (!nextWindow) return;

  const currentWindow = surface.querySelector(selector);
  if (currentWindow) {
    currentWindow.replaceWith(nextWindow);
  } else {
    surface.append(nextWindow);
  }

  bindAppWindowDragging();
  bindWindowEvents();
}

function removeDesktopWindow(selector) {
  document.querySelector(selector)?.remove();
}

function getDesktopPictureIconId(pictureId) {
  return `desktop-picture-${pictureId}`;
}

function getDesktopPictureWindowId(pictureId) {
  return `picture-window-${pictureId}`;
}

function getDesktopPicture(pictureId) {
  return normalizeDesktopPictures(state.data.desktopPictures).find((picture) => picture.id === pictureId) || null;
}

function renderDesktopPictureIcons() {
  return normalizeDesktopPictures(state.data.desktopPictures)
    .map(
      (picture) => `
        <button class="desktop-icon desktop-picture-icon" type="button" data-desktop-icon="${escapeAttribute(getDesktopPictureIconId(picture.id))}" data-open-picture="${escapeAttribute(picture.id)}" aria-label="Open ${escapeAttribute(picture.name)}" style="${getDesktopIconStyle(getDesktopPictureIconId(picture.id))}">
          <span class="icon-picture" style="--picture-thumb: url(${escapeAttribute(picture.data)});"></span>
          <strong>${escapeHtml(picture.name)}</strong>
        </button>
      `,
    )
    .join("");
}

function renderMacShell(content, preservedMediaIds = new Set()) {
  return `
    <div class="mac-shell">
      <header class="system-menu" aria-hidden="true">
        <div class="menu-mark">D12</div>
        <div class="menu-items">
          <span>File</span>
          <span>Edit</span>
          <span>View</span>
          <span>Special</span>
          <span class="menu-help" title="${escapeAttribute(APP_BUILD_LABEL)}" data-build-label="${escapeAttribute(APP_BUILD_LABEL)}">Help</span>
        </div>
        <time>${formatClassicTime(new Date())}</time>
        <span class="system-glyph"></span>
      </header>

      <div class="desktop-surface ${getDesktopBackground() ? "has-custom-wallpaper" : ""}" ${getDesktopBackgroundStyle()}>
        <div class="apple-menu-card">
          <div>About Daily Dozen...</div>
          <div class="menu-separator"></div>
          <div>Daily Checklist</div>
          <div>Shared Note</div>
          <div>Progress Board</div>
          <button type="button" data-wallpaper-mode>Wallpaper: ${getWallpaperMode() === "tile" ? "Tile" : "Fill"}</button>
          <div class="menu-separator"></div>
          <div>Control Panels</div>
          <div>Find File</div>
          <div>Stickies</div>
        </div>

        <input class="background-file-input" type="file" accept="image/*" data-background-file />

        <div class="desktop-icons">
          <button class="desktop-icon desktop-drop-target" type="button" data-desktop-icon="daily-dozen-hd" data-background-drop aria-label="Choose or drop a shared desktop background image" title="Drop an image here to change the shared desktop background" style="${getDesktopIconStyle("daily-dozen-hd")}">
            <span class="icon-daily-dozen"></span>
            <strong>Daily Dozen HD</strong>
          </button>
          <button class="desktop-icon" type="button" data-desktop-icon="kimchi-quest" data-open-kimchi-quest aria-label="Open Kimchi Quest" style="${getDesktopIconStyle("kimchi-quest")}">
            <span class="icon-kimchi"></span>
            <strong>Kimchi Quest</strong>
          </button>
          <div class="desktop-icon" data-desktop-icon="bird-calls" style="${getDesktopIconStyle("bird-calls")}">
            <span class="icon-bird"></span>
            <strong>Bird Calls</strong>
          </div>
          <button class="desktop-icon desktop-drop-target" type="button" data-desktop-icon="facetime" data-facetime-drop aria-label="Open FaceTime or drop your video file" title="Drop your video here or open FaceTime" style="${getDesktopIconStyle("facetime")}">
            <span class="icon-facetime"></span>
            ${renderFacetimeBadge()}
            <strong>FaceTime</strong>
          </button>
          <button class="desktop-icon" type="button" data-desktop-icon="claudias-seed-collection" data-open-seed-window="claudia" aria-label="Open Claudia's Seed Collection" style="${getDesktopIconStyle("claudias-seed-collection")}">
            <span class="icon-folder"></span>
            <strong>Claudia's Seed Collection</strong>
          </button>
          <button class="desktop-icon" type="button" data-desktop-icon="monkey-see-genevieve-do" data-open-monkey-video aria-label="Open Monkey See Genevieve Do" style="${getDesktopIconStyle("monkey-see-genevieve-do")}">
            <span class="icon-monkey"></span>
            <strong>Monkey See Genevieve Do</strong>
          </button>
          <button class="desktop-icon" type="button" data-desktop-icon="ulaylee" data-open-ukulele aria-label="Open ULaylee" style="${getDesktopIconStyle("ulaylee")}">
            <span class="icon-ukulele"></span>
            <strong>ULaylee</strong>
          </button>
          <button class="desktop-icon" type="button" data-desktop-icon="colored-pencils" data-open-colored-pencils aria-label="Open Colored Pencils" style="${getDesktopIconStyle("colored-pencils")}">
            <span class="icon-pencils"></span>
            <strong>Colored Pencils</strong>
          </button>
          <button class="desktop-icon" type="button" data-desktop-icon="genevieves-seed-collection" data-open-seed-window="genevieve" aria-label="Open Genevieve's Seed Collection" style="${getDesktopIconStyle("genevieves-seed-collection")}">
            <span class="icon-folder icon-folder-green"></span>
            <strong>Genevieve's Seed Collection</strong>
          </button>
          ${renderDesktopPictureIcons()}
          <div class="desktop-icon" data-desktop-icon="trash" style="${getDesktopIconStyle("trash")}">
            <span class="icon-trash"></span>
            <strong>Trash</strong>
          </div>
        </div>

        ${content}
        ${state.kimchiQuestOpen ? renderKimchiQuestWindow() : ""}
        ${state.monkeyWindowOpen ? renderMediaWindowSlot("monkey-see-genevieve-do", preservedMediaIds, renderMonkeyWindow()) : ""}
        ${state.ukuleleWindowOpen ? renderMediaWindowSlot("ulaylee", preservedMediaIds, renderUkuleleWindow()) : ""}
        ${state.seedWindows.claudia ? renderSeedWindow("claudia") : ""}
        ${state.seedWindows.genevieve ? renderSeedWindow("genevieve") : ""}
        ${state.coloredPencilsWindowOpen ? renderColoredPencilsWindow() : ""}
        ${state.pictureWindowId ? renderDesktopPictureWindow(state.pictureWindowId) : ""}
        ${state.facetimeWindowOpen ? renderMediaWindowSlot("facetime", preservedMediaIds, renderFacetimeWindow()) : ""}
        ${state.facetimeArchiveOpen ? renderMediaWindowSlot("facetime-archive", preservedMediaIds, renderFacetimeArchiveWindow()) : ""}
      </div>
    </div>
  `;
}

function getDesktopBackgroundStyle() {
  const background = getDesktopBackground();
  if (!background) return "";
  const mode = getWallpaperMode();
  const repeat = mode === "tile" ? "repeat" : "no-repeat";
  const size = mode === "tile" ? "240px auto" : "cover";
  const position = mode === "tile" ? "0 0" : "center";
  return `style="--custom-wallpaper: url(${escapeAttribute(background)}); --wallpaper-repeat: ${repeat}; --wallpaper-size: ${size}; --wallpaper-position: ${position}"`;
}

function getDesktopBackground() {
  return state.data.wallpaper || "";
}

function getDesktopIconStyle(id) {
  const position = state.data.iconPositions?.[id];
  if (!position) return "";
  return `--icon-x: ${position.x}px; --icon-y: ${position.y}px;`;
}

function getWindowStyle(id) {
  const position = state.windowPositions[id];
  if (!position) return "";
  return `--window-x: ${position.x}px; --window-y: ${position.y}px;`;
}

function getWallpaperMode() {
  return normalizeWallpaperMode(state.data.wallpaperMode);
}

function formatClassicTime(date) {
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function renderLogin() {
  const userButtons = USERS.map((user) => {
    const active = user.id === state.activeLoginUserId ? "is-active" : "";
    return `
      <button class="passport ${active}" type="button" data-login-user="${user.id}" style="--user-color: ${user.color}">
        <span class="passport-room">${user.room}</span>
        <span class="passport-name">${escapeHtml(user.name)}</span>
      </button>
    `;
  }).join("");

  return `
    <section class="login-screen mac-program">
      <div class="login-illustration" aria-hidden="true">
        <div class="hotel-roof"></div>
        <div class="hotel-body">
          <span></span><span></span><span></span>
          <span></span><span></span><span></span>
        </div>
        <div class="hotel-awning"></div>
      </div>

      <div class="login-copy mac-window" data-window-title="Daily Dozen">
        <p class="eyebrow">private daily ledger</p>
        <h1>Daily Dozen</h1>
        <p class="dek">Scotty P. / Claudie D.</p>
        <button class="crt-toggle" type="button" data-crt-toggle aria-pressed="${state.crtEnabled}">${state.crtEnabled ? "crt: on" : "crt: off"}</button>
      </div>

      <form class="login-panel mac-window" data-window-title="Users" data-login-form>
        <div class="passport-row">
          ${userButtons}
        </div>

        <label class="field-label" for="pin">PIN</label>
        <div class="pin-wrap">
          ${iconMarkup("key")}
          <input id="pin" name="pin" type="password" inputmode="numeric" autocomplete="current-password" placeholder="Enter PIN" value="${escapeAttribute(state.loginPin)}" data-pin />
        </div>
        ${state.loginError ? `<p class="form-error">${escapeHtml(state.loginError)}</p>` : ""}

        <button class="primary-button" type="submit">
          ${iconMarkup("lock")}
          Open Today
        </button>
      </form>

    </section>
  `;
}

function renderDashboard(user) {
  const progress = getProgress(user.id);
  const partner = USERS.find((candidate) => candidate.id !== user.id);
  const userItems = getCompletion(user.id);
  const sharedStatus = getSharedNoteStatus(user.id);

  return `
    <section class="dashboard mac-program">
      <header class="app-header mac-window" data-window-title="Daily Dozen">
        <div class="brand-lockup">
          <span class="brand-mark" aria-hidden="true">12</span>
          <div>
            <p class="eyebrow">daily dozen</p>
            <h1>${escapeHtml(user.name)}'s ledger</h1>
          </div>
        </div>
        <div class="header-actions">
          <button class="crt-toggle" type="button" data-crt-toggle aria-pressed="${state.crtEnabled}">${state.crtEnabled ? "crt: on" : "crt: off"}</button>
          <button class="sync-pill" type="button" data-sync-now data-sync-status="${state.remoteStatus}" title="${escapeAttribute(state.remoteError || "Shared Cloudflare KV sync")}">${getSyncLabel()}</button>
          <button class="icon-button" type="button" data-open-settings aria-label="Edit dozen items" title="Edit dozen items">
            ${iconMarkup("edit")}
          </button>
          <button class="icon-button" type="button" data-logout aria-label="Log out" title="Log out">
            ${iconMarkup("logout")}
          </button>
        </div>
      </header>

      <nav class="date-strip mac-window" data-window-title="Calendar" aria-label="Date">
        <button class="icon-button" type="button" data-date-offset="-1" aria-label="Previous day" title="Previous day">
          ${iconMarkup("chevronLeft")}
        </button>
        <div class="date-card">
          ${iconMarkup("calendar")}
          <div>
            <span>Date on file</span>
            <strong>${formatDate(state.selectedDate)}</strong>
          </div>
        </div>
        <button class="icon-button" type="button" data-date-offset="1" aria-label="Next day" title="Next day">
          ${iconMarkup("chevronRight")}
        </button>
        <button class="today-button" type="button" data-today>Today</button>
      </nav>

      <section class="overview-band mac-window" data-window-title="Progress">
        <div class="progress-feature" style="--user-color: ${user.color}; --progress: ${progress.percentage}%">
          <div class="meter">
            <div class="meter-fill"></div>
            <span>${progress.count}/12</span>
          </div>
          <div>
            <p class="eyebrow">Your count</p>
            <h2>${progress.count === 12 ? "The full dozen is done." : `${12 - progress.count} still on the tray.`}</h2>
          </div>
        </div>

        <div class="couple-board">
          ${USERS.map(renderMiniUser).join("")}
        </div>
      </section>

      <section class="work-area">
        <div class="checklist-shell mac-window" data-window-title="Checklist">
          <div class="section-heading">
            <p class="eyebrow">${formatDate(state.selectedDate, "short")}</p>
            <h2>Check off your twelve</h2>
          </div>
          <div class="checklist-grid">
            ${state.data.items.map((item, index) => renderChecklistItem(item, index, userItems.includes(index))).join("")}
          </div>
        </div>

        <aside class="side-panel">
          <div class="mini-marquee" aria-hidden="true">
            <span></span><span></span><span></span><span></span>
          </div>
          <div class="note-block note-block-shared ${sharedStatus.unread ? "has-unread" : ""} mac-window" data-window-title="Shared Note" data-shared-message-state="${sharedStatus.unread ? "unread" : "read"}">
            <div class="section-heading">
              <p class="eyebrow" data-shared-message-from>${sharedStatus.unread ? `From ${escapeHtml(sharedStatus.from)}` : "For both of you"}</p>
              <h2 data-shared-message-title>${sharedStatus.unread ? "1 new message!" : "Shared note"}</h2>
              <p class="message-meta" data-shared-message-meta>${sharedStatus.editedAt ? `Last edited ${escapeHtml(sharedStatus.editedAt)}` : ""}</p>
            </div>
            <textarea data-shared-note maxlength="360" placeholder="Leave a note you both can see.">${escapeHtml(getSharedNote())}</textarea>
          </div>
          <div class="note-block mac-window" data-window-title="Private Note">
            <div class="section-heading">
              <p class="eyebrow">Your note</p>
              <h2>Private line</h2>
            </div>
            <textarea data-note maxlength="240" placeholder="One sentence about today.">${escapeHtml(getNote(user.id))}</textarea>
          </div>
          <div class="partner-glance mac-window" data-window-title="Other User">
            <span style="--user-color: ${partner.color}"></span>
            <p>${escapeHtml(partner.name)} is at <strong>${getProgress(partner.id).count}/12</strong>.</p>
          </div>
        </aside>
      </section>

      ${state.settingsOpen ? renderSettings() : ""}
    </section>
  `;
}

function renderMiniUser(user) {
  const progress = getProgress(user.id);
  return `
    <article class="mini-user" style="--user-color: ${user.color}">
      <div class="mini-avatar">${escapeHtml(user.name.slice(0, 1))}</div>
      <div>
        <span>${escapeHtml(user.name)}</span>
        <strong>${progress.count}/12</strong>
      </div>
      <div class="mini-track" aria-hidden="true">
        <span style="width: ${progress.percentage}%"></span>
      </div>
    </article>
  `;
}

function renderChecklistItem(item, index, checked) {
  return `
    <label class="check-item ${checked ? "is-checked" : ""}">
      <input type="checkbox" data-item-index="${index}" ${checked ? "checked" : ""} />
      <span class="item-icon">${iconMarkup(ITEM_ICONS[index])}</span>
      <span class="item-text">${escapeHtml(item)}</span>
      <span class="item-check">${iconMarkup("check")}</span>
    </label>
  `;
}

function renderSettings() {
  return `
    <div class="modal-backdrop" data-close-settings>
      <section class="settings-panel mac-window" data-window-title="Control Panel" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <div class="settings-header">
          <div>
            <p class="eyebrow">The twelve</p>
            <h2 id="settings-title">Edit checklist items</h2>
          </div>
          <button class="icon-button" type="button" data-close-settings aria-label="Close settings" title="Close settings">×</button>
        </div>
        <form data-settings-form>
          <div class="settings-list">
            ${state.data.items
              .map(
                (item, index) => `
                  <label>
                    <span>${String(index + 1).padStart(2, "0")}</span>
                    <input name="item-${index}" maxlength="32" value="${escapeAttribute(item)}" />
                  </label>
                `,
              )
              .join("")}
          </div>
          <div class="settings-actions">
            <button class="secondary-button" type="button" data-reset-items>Reset list</button>
            <button class="primary-button" type="submit">${iconMarkup("check")} Save dozen</button>
          </div>
        </form>
      </section>
    </div>
  `;
}

function renderKimchiQuestWindow() {
  const bites = Math.max(0, Math.min(KIMCHI_QUEST_MAX_BITES, state.kimchiQuestBites));
  const bitesLeft = KIMCHI_QUEST_MAX_BITES - bites;
  const won = bites >= KIMCHI_QUEST_MAX_BITES;

  return `
    <section class="kimchi-game-window mac-window" data-window-title="Kimchi Quest" data-draggable-window="kimchi-quest" style="${getWindowStyle("kimchi-quest")}" role="dialog" aria-labelledby="kimchi-quest-title">
      <button class="window-close" type="button" data-close-kimchi-quest aria-label="Close Kimchi Quest" title="Close">×</button>
      <div class="kimchi-game-copy">
        <p class="eyebrow">play the game</p>
        <h2 id="kimchi-quest-title">${won ? "Jar cleared" : "Eat the kimchi"}</h2>
        <p>${won ? "You won. The jar is gloriously empty." : `${bitesLeft} bite${bitesLeft === 1 ? "" : "s"} left.`}</p>
      </div>
      <button class="kimchi-jar-button" type="button" data-kimchi-jar aria-label="${won ? "Kimchi jar is empty" : "Eat some kimchi"}" ${won ? "disabled" : ""}>
        <span class="kimchi-jar" data-bites="${bites}" aria-hidden="true">
          <span class="kimchi-fill"></span>
        </span>
      </button>
      <div class="kimchi-game-meter" aria-label="${bites} of ${KIMCHI_QUEST_MAX_BITES} bites eaten">
        ${Array.from({ length: KIMCHI_QUEST_MAX_BITES }, (_, index) => `<span class="${index < bites ? "is-eaten" : ""}"></span>`).join("")}
      </div>
      ${won ? `<button class="secondary-button" type="button" data-reset-kimchi-quest>Play again</button>` : ""}
    </section>
  `;
}

function renderMonkeyWindow() {
  return `
    <section class="monkey-video-window mac-window" data-window-title="Monkey See Genevieve Do" data-draggable-window="monkey-see-genevieve-do" data-media-preserve-key="monkey-see-genevieve-do" style="${getWindowStyle("monkey-see-genevieve-do")}" role="dialog" aria-label="Monkey See Genevieve Do">
      <button class="window-close" type="button" data-close-monkey-video aria-label="Close Monkey See Genevieve Do" title="Close">×</button>
      <video class="monkey-video" controls autoplay playsinline data-monkey-video src="${MONKEY_VIDEO_URL}"></video>
    </section>
  `;
}

function renderUkuleleWindow() {
  const video = UKULELE_VIDEOS[state.ukuleleVideoIndex] || UKULELE_VIDEOS[0];

  return `
    <section class="youtube-window mac-window" data-window-title="ULaylee" data-draggable-window="ulaylee" data-media-preserve-key="ulaylee:${state.ukuleleVideoIndex}" style="${getWindowStyle("ulaylee")}" role="dialog" aria-label="ULaylee">
      <button class="window-close" type="button" data-close-ukulele aria-label="Close ULaylee" title="Close">×</button>
      <div class="youtube-frame-shell">
        <iframe src="${escapeAttribute(video.embed)}" title="ULaylee YouTube video" scrolling="no" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"></iframe>
      </div>
    </section>
  `;
}

function renderDesktopPictureWindow(pictureId) {
  const picture = getDesktopPicture(pictureId);
  if (!picture) return "";

  const windowId = getDesktopPictureWindowId(picture.id);

  return `
    <section class="picture-window mac-window" data-window-title="${escapeAttribute(picture.name)}" data-draggable-window="${escapeAttribute(windowId)}" style="${getWindowStyle(windowId)}" role="dialog" aria-labelledby="picture-window-title">
      <button class="window-close" type="button" data-close-picture-window aria-label="Close ${escapeAttribute(picture.name)}" title="Close">×</button>
      <figure class="picture-frame">
        <img src="${escapeAttribute(picture.data)}" alt="${escapeAttribute(picture.name)}" />
        <figcaption>
          <strong id="picture-window-title">${escapeHtml(picture.name)}</strong>
          <span>${picture.uploadedAt ? escapeHtml(formatMessageTime(picture.uploadedAt)) : "Shared picture"}${picture.uploadedBy ? ` · ${escapeHtml(picture.uploadedBy)}` : ""}</span>
        </figcaption>
      </figure>
    </section>
  `;
}

function renderFacetimeWindow() {
  const viewingMine = state.facetimeMode === "mine";
  const owner = getVisibleFacetimeOwner();
  const video = getVisibleFacetimeVideo();
  const hasVideo = hasFacetimeVideo(video);
  const hasVideoRecord = hasFacetimeVideoRecord(video);
  const ownerName = owner?.name || "Daily Dozen";
  const partnerVideoLabel = `Video from ${ownerName}`;
  const mediaPreserveKey = hasVideo ? getFacetimeMediaPreserveKey() : "";
  const waitingForVideo = (!hasVideo && hasVideoRecord) || (!hasVideo && !state.remoteReady && state.remoteStatus === "checking");
  const emptyVideoMessage =
    viewingMine && state.facetimeUploadStatus
      ? state.facetimeUploadStatus
      : waitingForVideo
      ? "Looking for video..."
      : viewingMine
      ? "No video from you yet."
      : `No video from ${ownerName} yet.`;
  const status =
    state.facetimePlaybackStatus ||
    state.facetimeUploadStatus ||
    (waitingForVideo
      ? "Looking for video..."
      : hasVideo
      ? viewingMine
        ? "Your uploaded video"
        : `From ${ownerName}`
      : emptyVideoMessage);

  return `
    <section class="facetime-window mac-window" data-window-title="FaceTime" data-draggable-window="facetime" data-media-preserve-key="${escapeAttribute(mediaPreserveKey)}" style="${getWindowStyle("facetime")}" role="dialog" aria-labelledby="facetime-title">
      <button class="window-close" type="button" data-close-facetime aria-label="Close FaceTime" title="Close">×</button>
      <div class="facetime-window-header">
        <p class="eyebrow">${viewingMine ? "my upload" : escapeHtml(partnerVideoLabel)}</p>
        <h2 id="facetime-title">FaceTime</h2>
        <p data-facetime-status>${escapeHtml(status)}</p>
      </div>
      <div class="facetime-toolbar">
        <div class="facetime-mode-switch" role="group" aria-label="FaceTime view">
          <button class="facetime-mode-button ${!viewingMine ? "is-active" : ""}" type="button" data-facetime-mode="shared" aria-pressed="${!viewingMine}">${escapeHtml(partnerVideoLabel)}</button>
          <button class="facetime-mode-button ${viewingMine ? "is-active" : ""}" type="button" data-facetime-mode="mine" aria-pressed="${viewingMine}">My video</button>
        </div>
        <button class="facetime-archive-link" type="button" data-open-facetime-archive>Archive</button>
      </div>
      <div class="facetime-actions" data-facetime-recording-controls>
        <button class="facetime-record-button" type="button" data-start-facetime-recording ${state.facetimeRecordingActive || !canUseBrowserRecorder() ? "disabled" : ""}>Record video</button>
        <button class="facetime-record-button" type="button" data-stop-facetime-recording ${state.facetimeRecordingActive ? "" : "disabled"}>Stop</button>
        <span data-facetime-recording-status>${escapeHtml(state.facetimeRecordingStatus)}</span>
      </div>
      ${
        hasVideo
          ? `
            <video class="facetime-video" controls autoplay playsinline preload="auto" data-facetime-video data-facetime-owner="${escapeAttribute(owner?.id || "")}" data-facetime-video-id="${escapeAttribute(getFacetimeVideoId(video))}"></video>
            <p class="facetime-meta">${escapeHtml(video.name)}${video.size ? ` - ${formatFileSize(video.size)}` : ""}${video.uploadedAt ? ` - ${formatMessageTime(video.uploadedAt)}` : ""}</p>
            <a class="facetime-download-link" data-facetime-download download="${escapeAttribute(video.name)}">Download video</a>
          `
          : `
            <div class="facetime-empty">
              <span class="icon-facetime" aria-hidden="true"></span>
              <p>${escapeHtml(emptyVideoMessage)}</p>
            </div>
          `
      }
    </section>
  `;
}

function renderFacetimeArchiveWindow() {
  const owner = getFacetimeArchiveOwner();
  const archive = getFacetimeArchiveList(owner?.id);
  const selectedVideo = getSelectedFacetimeArchiveVideo();
  const selectedVideoId = getFacetimeVideoId(selectedVideo);
  const hasSelectedVideo = hasFacetimeVideo(selectedVideo);
  const mediaPreserveKey = hasSelectedVideo ? getFacetimeArchiveMediaPreserveKey() : "";
  const status = state.facetimeArchiveStatus || (archive.length ? `${archive.length} saved` : "No archived videos yet.");

  return `
    <section class="facetime-archive-window mac-window" data-window-title="FaceTime Archive" data-draggable-window="facetime-archive" data-media-preserve-key="${escapeAttribute(mediaPreserveKey)}" style="${getWindowStyle("facetime-archive")}" role="dialog" aria-labelledby="facetime-archive-title">
      <button class="window-close" type="button" data-close-facetime-archive aria-label="Close FaceTime archive" title="Close">×</button>
      <div class="facetime-window-header">
        <p class="eyebrow">${escapeHtml(owner?.name || "Daily Dozen")}</p>
        <h2 id="facetime-archive-title">FaceTime Archive</h2>
        <p data-facetime-archive-status>${escapeHtml(status)}</p>
      </div>
      <div class="facetime-archive-owner-switch" role="group" aria-label="Archive owner">
        ${USERS.map(
          (user) => `
            <button class="facetime-mode-button ${owner?.id === user.id ? "is-active" : ""}" type="button" data-facetime-archive-owner="${user.id}" aria-pressed="${owner?.id === user.id}">${escapeHtml(user.name)}</button>
          `,
        ).join("")}
      </div>
      <div class="facetime-archive-body">
        <div class="facetime-archive-list">
          ${
            archive.length
              ? archive
                  .map((video) => {
                    const videoId = getFacetimeVideoId(video);
                    return `
                      <button class="facetime-archive-item ${videoId === selectedVideoId ? "is-active" : ""}" type="button" data-play-facetime-archive-video="${escapeAttribute(videoId)}" aria-pressed="${videoId === selectedVideoId}">
                        <strong>${escapeHtml(video.name || "Archived video")}</strong>
                        <span>${video.uploadedAt ? escapeHtml(formatMessageTime(video.uploadedAt)) : "Saved video"}${video.size ? ` · ${formatFileSize(video.size)}` : ""}</span>
                      </button>
                    `;
                  })
                  .join("")
              : `<div class="facetime-archive-empty">Archive is empty.</div>`
          }
        </div>
        ${
          hasSelectedVideo
            ? `
              <div class="facetime-archive-player">
                <video class="facetime-video facetime-archive-video" controls autoplay playsinline preload="auto" data-facetime-archive-video data-facetime-archive-owner="${escapeAttribute(owner?.id || "")}" data-facetime-archive-video-id="${escapeAttribute(selectedVideoId)}"></video>
                <p class="facetime-meta">${escapeHtml(selectedVideo.name)}${selectedVideo.size ? ` - ${formatFileSize(selectedVideo.size)}` : ""}${selectedVideo.uploadedAt ? ` - ${formatMessageTime(selectedVideo.uploadedAt)}` : ""}</p>
                <a class="facetime-download-link" data-facetime-archive-download download="${escapeAttribute(selectedVideo.name)}">Download video</a>
              </div>
            `
            : ""
        }
      </div>
    </section>
  `;
}

function renderSeedWindow(owner) {
  const isClaudia = owner === "claudia";
  const title = isClaudia ? "Claudia's Seed Collection" : "Genevieve's Seed Collection";
  const windowId = isClaudia ? "claudia-seeds" : "genevieve-seeds";
  const titleId = `${windowId}-title`;

  return `
    <section class="seed-window ${isClaudia ? "seed-window-claudia" : "seed-window-genevieve"} mac-window" data-window-title="${escapeAttribute(title)}" data-seed-owner="${owner}" data-draggable-window="${windowId}" style="${getWindowStyle(windowId)}" role="dialog" aria-labelledby="${titleId}">
      <button class="window-close" type="button" data-close-seed-window="${owner}" aria-label="Close ${escapeAttribute(title)}" title="Close">×</button>
      <div class="seed-window-header">
        <p class="eyebrow">${isClaudia ? "cataloged packets" : "field notes"}</p>
        <h2 id="${titleId}">${escapeHtml(title)}</h2>
      </div>
      ${isClaudia ? renderClaudiaSeeds() : renderGenevieveSeeds()}
    </section>
  `;
}

function renderClaudiaSeeds() {
  return `
    <div class="seed-catalog">
      ${CLAUDIA_SEEDS.map(
        (seed, index) => `
          <article class="seed-packet seed-tone-${seed.tone}">
            <span class="seed-index">${String(index + 1).padStart(2, "0")}</span>
            <strong>${escapeHtml(seed.name)}</strong>
            <span>${escapeHtml(seed.tag)}</span>
          </article>
        `,
      ).join("")}
    </div>
  `;
}

function renderGenevieveSeeds() {
  return `
    <div class="seed-scatter" aria-label="Scattered seeds, hair ties, and a smiley note">
      <span class="loose-seed loose-seed-1"></span>
      <span class="loose-seed loose-seed-2"></span>
      <span class="loose-seed loose-seed-3"></span>
      <span class="loose-seed loose-seed-4"></span>
      <span class="loose-seed loose-seed-5"></span>
      <span class="loose-seed loose-seed-6"></span>
      <span class="loose-seed loose-seed-7"></span>
      <span class="hair-tie hair-tie-1"></span>
      <span class="hair-tie hair-tie-2"></span>
      <span class="smiley-note" aria-hidden="true">:)</span>
    </div>
  `;
}

function renderColoredPencilsWindow() {
  return `
    <section class="colored-pencils-window mac-window" data-window-title="Colored Pencils" data-draggable-window="colored-pencils" style="${getWindowStyle("colored-pencils")}" role="dialog" aria-labelledby="colored-pencils-title">
      <button class="window-close" type="button" data-close-colored-pencils aria-label="Close Colored Pencils" title="Close">×</button>
      <div class="colored-pencils-header">
        <p class="eyebrow">fresh points</p>
        <h2 id="colored-pencils-title">Colored Pencils</h2>
      </div>
      <div class="pencil-pack" aria-label="A pack of colored pencils">
        <div class="pencil-pack-lid">
          <span>DAILY DOZEN</span>
          <strong>8 color pencils</strong>
        </div>
        <div class="pencil-row">
          ${COLORED_PENCILS.map(
            (pencil, index) => `
              <span class="colored-pencil colored-pencil-${index + 1}" style="--pencil-color: ${pencil.color};" title="${escapeAttribute(pencil.name)}">
                <span></span>
              </span>
            `,
          ).join("")}
        </div>
      </div>
    </section>
  `;
}

function bindEvents() {
  document.querySelectorAll("[data-login-user]").forEach((button) => {
    button.addEventListener("click", () => {
      state.loginPin = document.querySelector("#pin")?.value || state.loginPin;
      state.activeLoginUserId = button.dataset.loginUser;
      state.loginError = "";
      render();
      document.querySelector("#pin")?.focus();
    });
  });

  document.querySelector("[data-pin]")?.addEventListener("input", (event) => {
    state.loginPin = event.currentTarget.value;
  });

  document.querySelector("[data-login-form]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const pin = String(form.get("pin") || "");
    state.loginPin = pin;
    const user = USERS.find((candidate) => candidate.id === state.activeLoginUserId);

    if (user?.pin === pin) {
      state.currentUserId = user.id;
      sessionStorage.setItem(SESSION_KEY, user.id);
      state.loginError = "";
      state.loginPin = "";
      render();
      return;
    }

    state.loginError = "That PIN does not match the selected room.";
    render();
  });

  document.querySelector("[data-logout]")?.addEventListener("click", () => {
    state.currentUserId = "";
    sessionStorage.removeItem(SESSION_KEY);
    render();
  });

  document.querySelectorAll("[data-date-offset]").forEach((button) => {
    button.addEventListener("click", () => changeDate(Number(button.dataset.dateOffset)));
  });

  document.querySelector("[data-today]")?.addEventListener("click", () => {
    state.selectedDate = toDateKey(new Date());
    render();
  });

  document.querySelectorAll("[data-crt-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      setCrtEnabled(!state.crtEnabled);
    });
  });

  bindDesktopBackgroundEvents();
  bindDesktopPictureEvents();
  bindDesktopIconDragging();
  bindAppWindowDragging();
  bindKimchiQuestEvents();
  bindUkuleleEvents();
  bindSeedWindowEvents();
  bindColoredPencilsEvents();
  bindMonkeyVideoEvents();
  bindFacetimeEvents();
  bindFacetimeArchiveEvents();

  document.querySelector("[data-wallpaper-mode]")?.addEventListener("click", () => {
    toggleWallpaperMode();
  });

  document.querySelector("[data-sync-now]")?.addEventListener("click", async () => {
    await saveRemoteData();
    await loadRemoteData({ renderAfter: Boolean(getUser()) });
  });

  document.querySelectorAll("[data-item-index]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      setCompletion(getUser().id, Number(checkbox.dataset.itemIndex), checkbox.checked);
      render();
    });
  });

  document.querySelector("[data-note]")?.addEventListener("input", (event) => {
    setNote(getUser().id, event.currentTarget.value);
  });

  const sharedNote = document.querySelector("[data-shared-note]");
  sharedNote?.addEventListener("focus", markSharedNoteRead);
  sharedNote?.addEventListener("click", markSharedNoteRead);
  sharedNote?.addEventListener("input", (event) => {
    setSharedNote(event.currentTarget.value);
  });

  document.querySelector("[data-open-settings]")?.addEventListener("click", () => {
    state.settingsOpen = true;
    render();
  });

  document.querySelectorAll("[data-close-settings]").forEach((element) => {
    element.addEventListener("click", (event) => {
      if (event.target === element || element.matches("button")) {
        state.settingsOpen = false;
        render();
      }
    });
  });

  document.querySelector("[data-settings-form]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    state.data.items = state.data.items.map((item, index) => {
      const next = String(form.get(`item-${index}`) || "").trim();
      return next || item;
    });
    saveData();
    state.settingsOpen = false;
    render();
  });

  document.querySelector("[data-reset-items]")?.addEventListener("click", () => {
    state.data.items = DEFAULT_ITEMS;
    saveData();
    render();
  });
}

function bindFacetimeEvents() {
  const icon = document.querySelector("[data-facetime-drop]");

  if (!icon) return;

  icon.addEventListener("click", () => {
    if (icon.dataset.dragMoved === "true") {
      icon.dataset.dragMoved = "";
      return;
    }

    state.facetimeWindowOpen = true;
    state.facetimeMode = "shared";
    state.facetimeUploadStatus = "";
    state.facetimePlaybackStatus = "";
    markFacetimePartnerVideoRead();
    render();
    loadRemoteData({ renderAfter: true }).then(() => loadVisibleFacetimeVideo({ renderAfter: true }));
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    icon.addEventListener(eventName, (event) => {
      event.preventDefault();
      icon.classList.add("is-drag-over");
    });
  });

  ["dragleave", "dragend"].forEach((eventName) => {
    icon.addEventListener(eventName, () => {
      icon.classList.remove("is-drag-over");
    });
  });

  icon.addEventListener("drop", (event) => {
    event.preventDefault();
    icon.classList.remove("is-drag-over");
    const file = getFirstVideoFile(event.dataTransfer?.files);
    if (file) setFacetimeVideoFromFile(file);
  });

  document.querySelector("[data-close-facetime]")?.addEventListener("click", () => {
    if (state.facetimeRecordingActive) cancelFacetimeRecording();
    state.facetimeWindowOpen = false;
    state.facetimeUploadStatus = "";
    state.facetimePlaybackStatus = "";
    state.facetimeMode = "shared";
    render();
  });

  document.querySelectorAll("[data-facetime-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.facetimeMode = button.dataset.facetimeMode === "mine" ? "mine" : "shared";
      state.facetimeUploadStatus = "";
      state.facetimePlaybackStatus = "";
      if (state.facetimeMode === "shared") markFacetimePartnerVideoRead();
      render();
      loadVisibleFacetimeVideo({ renderAfter: true });
    });
  });

  document.querySelector("[data-open-facetime-archive]")?.addEventListener("click", () => {
    const owner = getVisibleFacetimeOwner() || getUser() || USERS[0];
    state.facetimeArchiveOpen = true;
    state.facetimeArchiveOwnerId = owner.id;
    state.facetimeArchiveStatus = "";
    mountFacetimeArchiveWindow();
    loadFacetimeArchive(owner.id, { renderAfter: true });
  });

  document.querySelector("[data-start-facetime-recording]")?.addEventListener("click", () => {
    startFacetimeRecording();
  });

  document.querySelector("[data-stop-facetime-recording]")?.addEventListener("click", () => {
    stopFacetimeRecording();
  });

  updateFacetimeRecordingControls();
  attachFacetimeVideo();
}

function bindFacetimeArchiveEvents() {
  if (!state.facetimeArchiveOpen) return;

  bindFacetimeArchiveWindowEvents();
}

function bindFacetimeArchiveWindowEvents() {
  document.querySelector("[data-close-facetime-archive]")?.addEventListener("click", () => {
    state.facetimeArchiveOpen = false;
    state.facetimeArchiveVideoId = "";
    state.facetimeArchiveStatus = "";
    removeDesktopWindow('[data-draggable-window="facetime-archive"]');
  });

  document.querySelectorAll("[data-facetime-archive-owner]").forEach((button) => {
    button.addEventListener("click", () => {
      state.facetimeArchiveOwnerId = button.dataset.facetimeArchiveOwner || USERS[0].id;
      state.facetimeArchiveVideoId = "";
      state.facetimeArchiveStatus = "";
      mountFacetimeArchiveWindow();
      loadFacetimeArchive(state.facetimeArchiveOwnerId, { renderAfter: true });
    });
  });

  document.querySelectorAll("[data-play-facetime-archive-video]").forEach((button) => {
    button.addEventListener("click", () => {
      const owner = getFacetimeArchiveOwner();
      const videoId = button.dataset.playFacetimeArchiveVideo || "";
      if (!owner || !videoId) return;

      state.facetimeArchiveVideoId = videoId;
      state.facetimeArchiveStatus = "";
      mountFacetimeArchiveWindow();
      loadFacetimeArchiveVideo(owner.id, videoId, { renderAfter: true });
    });
  });

  attachFacetimeArchiveVideo();
}

function mountFacetimeArchiveWindow() {
  if (!state.facetimeArchiveOpen) return;
  mountDesktopWindow('[data-draggable-window="facetime-archive"]', renderFacetimeArchiveWindow(), bindFacetimeArchiveWindowEvents);
}

function attachFacetimeVideo() {
  const videoElement = document.querySelector("[data-facetime-video]");
  const downloadLink = document.querySelector("[data-facetime-download]");
  const video = getVisibleFacetimeVideo();
  if (!videoElement || !hasFacetimeVideo(video)) return;

  const url = getFacetimeSharedVideoUrl(video);
  const videoId = getFacetimeVideoId(video);

  videoElement.onloadedmetadata = () => {
    videoElement.dataset.facetimeLoading = "";
    setFacetimePlaybackStatus("Video ready.");
  };

  videoElement.oncanplay = () => {
    videoElement.dataset.facetimeLoading = "";
    playFacetimeVideo(videoElement);
  };

  videoElement.onplay = () => {
    videoElement.dataset.facetimeUserPaused = "";
  };

  videoElement.onpause = () => {
    if (videoElement.dataset.facetimeLoading === "true") return;
    if (!videoElement.ended) videoElement.dataset.facetimeUserPaused = "true";
  };

  videoElement.onwaiting = () => {
    setFacetimePlaybackStatus("Loading video...");
  };

  videoElement.onerror = () => {
    videoElement.dataset.facetimeLoading = "";
    retryFacetimeVideoSource(videoElement, video, setFacetimePlaybackStatus);
  };

  if (videoElement.dataset.facetimeSourceId !== videoId || videoElement.src !== url) {
    videoElement.dataset.facetimeSourceId = videoId;
    videoElement.dataset.facetimeFallbackTried = "";
    videoElement.dataset.facetimeUserPaused = "";
    videoElement.dataset.facetimeLoading = "true";
    videoElement.src = url;
    videoElement.load();
    setFacetimePlaybackStatus("Loading video...");
  }

  playFacetimeVideo(videoElement, setFacetimePlaybackStatus);

  if (downloadLink) {
    downloadLink.href = video.data;
    downloadLink.download = video.name || "shared-video";
  }
}

function attachFacetimeArchiveVideo() {
  const videoElement = document.querySelector("[data-facetime-archive-video]");
  const downloadLink = document.querySelector("[data-facetime-archive-download]");
  const video = getSelectedFacetimeArchiveVideo();
  if (!videoElement || !hasFacetimeVideo(video)) return;

  const url = getFacetimeVideoObjectUrl(video, "archive");
  const videoId = getFacetimeVideoId(video);

  videoElement.onloadedmetadata = () => {
    videoElement.dataset.facetimeLoading = "";
    setFacetimeArchiveStatus("Video ready.");
  };

  videoElement.oncanplay = () => {
    videoElement.dataset.facetimeLoading = "";
    playFacetimeVideo(videoElement, setFacetimeArchiveStatus);
  };

  videoElement.onplay = () => {
    videoElement.dataset.facetimeUserPaused = "";
  };

  videoElement.onpause = () => {
    if (videoElement.dataset.facetimeLoading === "true") return;
    if (!videoElement.ended) videoElement.dataset.facetimeUserPaused = "true";
  };

  videoElement.onwaiting = () => {
    setFacetimeArchiveStatus("Loading video...");
  };

  videoElement.onerror = () => {
    videoElement.dataset.facetimeLoading = "";
    retryFacetimeVideoSource(videoElement, video, setFacetimeArchiveStatus);
  };

  if (videoElement.dataset.facetimeSourceId !== videoId || videoElement.src !== url) {
    videoElement.dataset.facetimeSourceId = videoId;
    videoElement.dataset.facetimeFallbackTried = "";
    videoElement.dataset.facetimeUserPaused = "";
    videoElement.dataset.facetimeLoading = "true";
    videoElement.src = url;
    videoElement.load();
    setFacetimeArchiveStatus("Loading video...");
  }

  playFacetimeVideo(videoElement, setFacetimeArchiveStatus);

  if (downloadLink) {
    downloadLink.href = video.data;
    downloadLink.download = video.name || "archived-video";
  }
}

function playFacetimeVideo(videoElement, setStatus = setFacetimePlaybackStatus) {
  if (!videoElement || videoElement.dataset.facetimeUserPaused === "true") return;

  videoElement.muted = false;
  videoElement.play().then(() => {
    setStatus("Playing.");
  }).catch(() => {
    videoElement.muted = true;
    videoElement.play().then(() => {
      setStatus("Playing muted.");
    }).catch(() => {
      setStatus("Press play to start this video.");
    });
  });
}

function retryFacetimeVideoSource(videoElement, video, setStatus = setFacetimePlaybackStatus) {
  if (videoElement.dataset.facetimeFallbackTried !== "true" && video.data && videoElement.src !== video.data) {
    videoElement.dataset.facetimeFallbackTried = "true";
    videoElement.dataset.facetimeUserPaused = "";
    videoElement.dataset.facetimeLoading = "true";
    videoElement.src = video.data;
    videoElement.load();
    setStatus("Retrying video...");
    playFacetimeVideo(videoElement, setStatus);
    return;
  }

  setStatus("This video could not play here. MP4/H.264 works best.");
}

function getFacetimeSharedVideoUrl(video) {
  return getFacetimeVideoObjectUrl(video, "current");
}

function getFacetimeVideoObjectUrl(video, namespace = "current") {
  const videoKey = `${getFacetimeVideoId(video)}:${video.data?.length || 0}:${String(video.data || "").slice(-48)}`;
  const cached = facetimeVideoUrlCache[namespace];

  if (cached?.key === videoKey && cached.url) {
    return cached.url;
  }

  if (cached?.url?.startsWith("blob:")) {
    URL.revokeObjectURL(cached.url);
  }

  let url = video.data;
  try {
    url = URL.createObjectURL(dataUrlToBlob(video.data, video.type));
  } catch {
    url = video.data;
  }

  facetimeVideoUrlCache[namespace] = { key: videoKey, url };
  return url;
}

function dataUrlToBlob(dataUrl, fallbackType = "video/mp4") {
  const [header, payload] = dataUrl.split(",");
  if (!payload) throw new Error("Invalid video data.");

  const mime = header.match(/^data:([^;]+);base64$/)?.[1] || fallbackType;
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mime });
}

function setFacetimePlaybackStatus(message) {
  state.facetimePlaybackStatus = message;
  const status = document.querySelector("[data-facetime-status]");
  if (status) status.textContent = message;
}

function setFacetimeArchiveStatus(message) {
  state.facetimeArchiveStatus = message;
  const status = document.querySelector("[data-facetime-archive-status]");
  if (status) status.textContent = message;
}

function canUseBrowserRecorder() {
  return Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
}

function updateFacetimeRecordingControls() {
  const canRecord = canUseBrowserRecorder();

  document.querySelectorAll("[data-start-facetime-recording]").forEach((button) => {
    button.disabled = state.facetimeRecordingActive || !canRecord;
  });

  document.querySelectorAll("[data-stop-facetime-recording]").forEach((button) => {
    button.disabled = !state.facetimeRecordingActive;
  });

  document.querySelectorAll("[data-facetime-recording-status]").forEach((element) => {
    element.textContent = state.facetimeRecordingStatus;
  });
}

async function startFacetimeRecording() {
  if (state.facetimeRecordingActive || !getUser()) return;

  if (!canUseBrowserRecorder()) {
    state.facetimeRecordingStatus = "Recording is not available in this browser.";
    updateFacetimeRecordingControls();
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 480 },
        height: { ideal: 360 },
        frameRate: { ideal: 24, max: 30 },
      },
      audio: true,
    });
    const mimeType = getSupportedRecorderMimeType();
    const recorderOptions = {
      videoBitsPerSecond: 700000,
      audioBitsPerSecond: 128000,
    };
    if (mimeType) recorderOptions.mimeType = mimeType;

    const recorder = new MediaRecorder(stream, recorderOptions);
    facetimeRecordingStream = stream;
    facetimeRecorder = recorder;
    facetimeRecordingChunks = [];
    facetimeRecordingDiscard = false;

    recorder.addEventListener("dataavailable", (event) => {
      if (event.data?.size) facetimeRecordingChunks.push(event.data);
    });

    recorder.addEventListener("stop", async () => {
      const chunks = facetimeRecordingChunks;
      const discard = facetimeRecordingDiscard;
      const type = normalizeVideoMimeType(recorder.mimeType || mimeType || "video/webm", "");
      cleanupFacetimeRecording();

      if (discard) return;

      const blob = new Blob(chunks, { type });
      if (!blob.size) {
        state.facetimeRecordingStatus = "Recording was empty.";
        updateFacetimeRecordingControls();
        return;
      }

      if (blob.size > FACETIME_VIDEO_MAX_BYTES) {
        state.facetimeRecordingStatus = `Recording is ${formatFileSize(blob.size)}.`;
        state.facetimeUploadStatus = `That video is ${formatFileSize(blob.size)}. Please use ${formatFileSize(FACETIME_VIDEO_MAX_BYTES)} or less.`;
        render();
        return;
      }

      state.facetimeRecordingStatus = "Preparing recording...";
      updateFacetimeRecordingControls();

      try {
        const data = await readBlobAsDataUrl(blob);
        await saveFacetimeVideoData({
          data,
          name: getRecordingFileName(type),
          type,
          size: blob.size,
        });
        state.facetimeRecordingStatus = "";
        updateFacetimeRecordingControls();
      } catch {
        state.facetimeRecordingStatus = "Recording could not be saved.";
        updateFacetimeRecordingControls();
      }
    });

    recorder.start(1000);
    state.facetimeWindowOpen = true;
    state.facetimeMode = "mine";
    state.facetimeUploadStatus = "";
    state.facetimePlaybackStatus = "";
    state.facetimeRecordingActive = true;
    state.facetimeRecordingStatus = "Recording...";
    updateFacetimeRecordingControls();

    window.clearTimeout(facetimeRecordingTimer);
    facetimeRecordingTimer = window.setTimeout(() => {
      stopFacetimeRecording();
    }, FACETIME_RECORDING_MAX_MS);
  } catch {
    cleanupFacetimeRecording();
    state.facetimeRecordingStatus = "Camera was not available.";
    updateFacetimeRecordingControls();
  }
}

function stopFacetimeRecording() {
  if (!facetimeRecorder || facetimeRecorder.state === "inactive") {
    cleanupFacetimeRecording();
    return;
  }

  state.facetimeRecordingStatus = "Finishing recording...";
  updateFacetimeRecordingControls();
  facetimeRecorder.stop();
}

function cancelFacetimeRecording() {
  facetimeRecordingDiscard = true;
  stopFacetimeRecording();
}

function cleanupFacetimeRecording() {
  window.clearTimeout(facetimeRecordingTimer);
  facetimeRecordingTimer = null;

  facetimeRecordingStream?.getTracks?.().forEach((track) => {
    track.stop();
  });

  facetimeRecorder = null;
  facetimeRecordingStream = null;
  facetimeRecordingChunks = [];
  facetimeRecordingDiscard = false;
  state.facetimeRecordingActive = false;
  updateFacetimeRecordingControls();
}

function getSupportedRecorderMimeType() {
  if (!window.MediaRecorder?.isTypeSupported) return "";

  return (
    [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
      "video/mp4;codecs=h264,aac",
      "video/mp4",
    ].find((type) => MediaRecorder.isTypeSupported(type)) || ""
  );
}

function getRecordingFileName(type) {
  const extension = normalizeVideoMimeType(type, "").includes("mp4") ? "mp4" : "webm";
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `FaceTime recording ${stamp}.${extension}`;
}

async function setFacetimeVideoFromFile(file) {
  state.facetimeWindowOpen = true;
  state.facetimeMode = "mine";
  state.facetimePlaybackStatus = "";

  if (!isVideoFile(file)) {
    state.facetimeUploadStatus = "That is not a video file.";
    render();
    return;
  }

  if (file.size > FACETIME_VIDEO_MAX_BYTES) {
    state.facetimeUploadStatus = `That video is ${formatFileSize(file.size)}. Please use ${formatFileSize(FACETIME_VIDEO_MAX_BYTES)} or less.`;
    render();
    return;
  }

  state.facetimeUploadStatus = "Preparing video...";
  render();

  try {
    const type = getVideoMimeType(file);
    await saveFacetimeVideoData({
      data: await readBlobAsDataUrl(file),
      name: file.name || "Shared video",
      type,
      size: file.size,
    });
  } catch {
    state.facetimeUploadStatus = "That video could not be read.";
    render();
  }
}

async function saveFacetimeVideoData({ data, name, type, size }) {
  const user = getUser();
  if (!user) return;

  const videoType = normalizeVideoMimeType(type, name);
  const normalizedData = normalizeVideoDataUrl(data, videoType);
  if (!normalizedData.startsWith("data:video/")) {
    state.facetimeUploadStatus = "That video could not be prepared.";
    render();
    return;
  }

  const uploadedAt = new Date().toISOString();
  state.facetimeWindowOpen = true;
  state.facetimeMode = "mine";
  state.facetimePlaybackStatus = "";
  state.data.facetimeVideos ||= {};
  state.data.facetimeVideos[user.id] = {
    data: normalizedData,
    name: name || "Shared video",
    type: videoType,
    size,
    uploadedBy: user.name,
    uploadedUserId: user.id,
    uploadedAt,
    videoId: createMessageId(user.id),
  };
  state.facetimeUploadStatus = "Saving video...";
  saveLocalData();
  render();

  await saveRemoteData({ includeFacetimeVideos: true, facetimeUserId: user.id });
  state.facetimeUploadStatus = state.remoteReady ? "Video saved." : "Video saved here; sync will retry.";
  if (!state.remoteReady) scheduleRemoteSave({ includeFacetimeVideos: true, facetimeUserId: user.id });
  if (state.facetimeArchiveOpen && state.facetimeArchiveOwnerId === user.id) {
    await loadFacetimeArchive(user.id, { force: true, renderAfter: false });
  }
  render();
}

function readBlobAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")));
    reader.addEventListener("error", () => reject(new Error("File could not be read.")));
    reader.readAsDataURL(blob);
  });
}

function getFirstVideoFile(files) {
  return Array.from(files || []).find(isVideoFile) || null;
}

function isVideoFile(file) {
  return Boolean(file?.type?.startsWith("video/")) || /\.(mp4|m4v|mov|webm|ogv)$/i.test(file?.name || "");
}

function getVideoMimeType(file) {
  const name = file.name || "";
  if (/\.webm$/i.test(name)) return "video/webm";
  if (/\.ogv$/i.test(name)) return "video/ogg";
  if (/\.(mp4|m4v)$/i.test(name)) return "video/mp4";
  if (/\.mov$/i.test(name)) return getPlayableVideoMimeType(file.type, "video/mp4");
  if (file.type.startsWith("video/")) return normalizeVideoMimeType(file.type, name);
  return "video/mp4";
}

function getPlayableVideoMimeType(preferredType, fallbackType = "video/mp4") {
  const preferred = normalizeVideoMimeType(preferredType, "");
  return canBrowserPlayVideoType(preferred) ? preferred : fallbackType;
}

function canBrowserPlayVideoType(type) {
  if (!type || !type.startsWith("video/")) return false;
  return Boolean(document.createElement("video").canPlayType(type));
}

function normalizeVideoMimeType(type, name = "") {
  const cleanType = normalizeShortText(type, "", 64).toLowerCase().split(";")[0].trim();
  if (/\.webm$/i.test(name)) return "video/webm";
  if (/\.ogv$/i.test(name)) return "video/ogg";
  if (/\.(mp4|m4v|mov)$/i.test(name)) return "video/mp4";
  if (cleanType === "video/quicktime" || cleanType === "video/x-m4v") return "video/mp4";
  return cleanType.startsWith("video/") ? cleanType : "video/mp4";
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

function formatFileSize(bytes) {
  const size = Number(bytes) || 0;
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}

function bindMonkeyVideoEvents() {
  const icon = document.querySelector("[data-open-monkey-video]");

  icon?.addEventListener("click", () => {
    if (icon.dataset.dragMoved === "true") {
      icon.dataset.dragMoved = "";
      return;
    }

    state.monkeyWindowOpen = true;
    mountMonkeyWindow();
    playMonkeyVideo({ restart: true });
  });

  bindMonkeyWindowEvents();
}

function bindMonkeyWindowEvents() {
  document.querySelector("[data-close-monkey-video]")?.addEventListener("click", () => {
    state.monkeyWindowOpen = false;
    removeDesktopWindow('[data-draggable-window="monkey-see-genevieve-do"]');
  });
}

function mountMonkeyWindow() {
  if (!state.monkeyWindowOpen) return;
  mountDesktopWindow('[data-draggable-window="monkey-see-genevieve-do"]', renderMonkeyWindow(), bindMonkeyWindowEvents);
}

function playMonkeyVideo({ restart = false } = {}) {
  const video = document.querySelector("[data-monkey-video]");
  if (!video) return;

  if (restart) video.currentTime = 0;
  video.play().catch(() => {});
}

function bindSeedWindowEvents() {
  document.querySelectorAll("[data-open-seed-window]").forEach((icon) => {
    icon.addEventListener("click", () => {
      if (icon.dataset.dragMoved === "true") {
        icon.dataset.dragMoved = "";
        return;
      }

      const owner = getSeedOwner(icon.dataset.openSeedWindow);
      state.seedWindows[owner] = true;
      mountSeedWindow(owner);
    });
  });

  bindSeedWindowControls();
}

function bindSeedWindowControls() {
  document.querySelectorAll("[data-close-seed-window]").forEach((button) => {
    button.addEventListener("click", () => {
      const owner = getSeedOwner(button.dataset.closeSeedWindow);
      state.seedWindows[owner] = false;
      removeDesktopWindow(getSeedWindowSelector(owner));
    });
  });
}

function mountSeedWindow(owner) {
  const seedOwner = getSeedOwner(owner);
  if (!state.seedWindows[seedOwner]) return;
  mountDesktopWindow(getSeedWindowSelector(seedOwner), renderSeedWindow(seedOwner), bindSeedWindowControls);
}

function getSeedOwner(owner) {
  return owner === "genevieve" ? "genevieve" : "claudia";
}

function getSeedWindowSelector(owner) {
  return `[data-draggable-window="${getSeedOwner(owner) === "genevieve" ? "genevieve-seeds" : "claudia-seeds"}"]`;
}

function bindColoredPencilsEvents() {
  const icon = document.querySelector("[data-open-colored-pencils]");

  icon?.addEventListener("click", () => {
    if (icon.dataset.dragMoved === "true") {
      icon.dataset.dragMoved = "";
      return;
    }

    state.coloredPencilsWindowOpen = true;
    mountColoredPencilsWindow();
  });

  bindColoredPencilsWindowEvents();
}

function bindColoredPencilsWindowEvents() {
  document.querySelector("[data-close-colored-pencils]")?.addEventListener("click", () => {
    state.coloredPencilsWindowOpen = false;
    removeDesktopWindow('[data-draggable-window="colored-pencils"]');
  });
}

function mountColoredPencilsWindow() {
  if (!state.coloredPencilsWindowOpen) return;
  mountDesktopWindow('[data-draggable-window="colored-pencils"]', renderColoredPencilsWindow(), bindColoredPencilsWindowEvents);
}

function bindUkuleleEvents() {
  const icon = document.querySelector("[data-open-ukulele]");

  icon?.addEventListener("click", () => {
    if (icon.dataset.dragMoved === "true") {
      icon.dataset.dragMoved = "";
      return;
    }

    state.ukuleleVideoIndex = Math.floor(Math.random() * UKULELE_VIDEOS.length);
    state.ukuleleWindowOpen = true;
    mountUkuleleWindow();
  });

  bindUkuleleWindowEvents();
}

function bindUkuleleWindowEvents() {
  document.querySelector("[data-close-ukulele]")?.addEventListener("click", () => {
    state.ukuleleWindowOpen = false;
    removeDesktopWindow('[data-draggable-window="ulaylee"]');
  });
}

function mountUkuleleWindow() {
  if (!state.ukuleleWindowOpen) return;
  mountDesktopWindow('[data-draggable-window="ulaylee"]', renderUkuleleWindow(), bindUkuleleWindowEvents);
}

function bindKimchiQuestEvents() {
  const icon = document.querySelector("[data-open-kimchi-quest]");

  icon?.addEventListener("click", () => {
    if (icon.dataset.dragMoved === "true") {
      icon.dataset.dragMoved = "";
      return;
    }

    state.kimchiQuestOpen = true;
    state.kimchiQuestBites = 0;
    mountKimchiQuestWindow();
  });

  bindKimchiQuestWindowEvents();
}

function bindKimchiQuestWindowEvents() {
  document.querySelector("[data-close-kimchi-quest]")?.addEventListener("click", () => {
    state.kimchiQuestOpen = false;
    removeDesktopWindow('[data-draggable-window="kimchi-quest"]');
  });

  document.querySelector("[data-kimchi-jar]")?.addEventListener("click", () => {
    state.kimchiQuestBites = Math.min(KIMCHI_QUEST_MAX_BITES, state.kimchiQuestBites + 1);
    mountKimchiQuestWindow();
  });

  document.querySelector("[data-reset-kimchi-quest]")?.addEventListener("click", () => {
    state.kimchiQuestBites = 0;
    mountKimchiQuestWindow();
  });
}

function mountKimchiQuestWindow() {
  if (!state.kimchiQuestOpen) return;
  mountDesktopWindow('[data-draggable-window="kimchi-quest"]', renderKimchiQuestWindow(), bindKimchiQuestWindowEvents);
}

function bindDesktopBackgroundEvents() {
  const dropTarget = document.querySelector("[data-background-drop]");
  const fileInput = document.querySelector("[data-background-file]");

  if (!dropTarget || !fileInput) return;

  dropTarget.addEventListener("click", () => {
    if (dropTarget.dataset.dragMoved === "true") {
      dropTarget.dataset.dragMoved = "";
      return;
    }

    fileInput.click();
  });

  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (file) {
      setDesktopBackgroundFromFile(file);
      fileInput.value = "";
    }
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    dropTarget.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropTarget.classList.add("is-drag-over");
    });
  });

  ["dragleave", "dragend"].forEach((eventName) => {
    dropTarget.addEventListener(eventName, () => {
      dropTarget.classList.remove("is-drag-over");
    });
  });

  dropTarget.addEventListener("drop", (event) => {
    event.preventDefault();
    dropTarget.classList.remove("is-drag-over");

    const file = event.dataTransfer?.files?.[0];
    if (file) setDesktopBackgroundFromFile(file);
  });
}

function bindDesktopPictureEvents() {
  const desktop = document.querySelector(".desktop-surface");
  if (!desktop) return;

  document.querySelectorAll("[data-open-picture]").forEach((icon) => {
    icon.addEventListener("click", () => {
      if (icon.dataset.dragMoved === "true") {
        icon.dataset.dragMoved = "";
        return;
      }

      state.pictureWindowId = icon.dataset.openPicture || "";
      mountDesktopPictureWindow();
    });
  });

  bindDesktopPictureWindowEvents();
  bindDesktopPictureDropEvents(desktop);
}

function bindDesktopPictureWindowEvents() {
  document.querySelector("[data-close-picture-window]")?.addEventListener("click", () => {
    state.pictureWindowId = "";
    removeDesktopWindow(".picture-window");
  });
}

function mountDesktopPictureWindow() {
  if (!state.pictureWindowId) return;
  mountDesktopWindow(".picture-window", renderDesktopPictureWindow(state.pictureWindowId), bindDesktopPictureWindowEvents);
}

function bindDesktopPictureDropEvents(desktop) {
  ["dragenter", "dragover"].forEach((eventName) => {
    desktop.addEventListener(eventName, (event) => {
      if (isSpecialDesktopDropTarget(event.target) || !hasDesktopPictureDrag(event.dataTransfer)) return;
      event.preventDefault();
      desktop.classList.add("is-picture-drag-over");
    });
  });

  ["dragleave", "dragend"].forEach((eventName) => {
    desktop.addEventListener(eventName, (event) => {
      if (eventName === "dragleave" && desktop.contains(event.relatedTarget)) return;
      desktop.classList.remove("is-picture-drag-over");
    });
  });

  desktop.addEventListener("drop", (event) => {
    if (isSpecialDesktopDropTarget(event.target)) return;

    if (!hasDesktopPictureDrag(event.dataTransfer)) return;

    event.preventDefault();
    desktop.classList.remove("is-picture-drag-over");

    const file = getFirstImageFile(event.dataTransfer?.files);
    if (!file) return;

    addDesktopPictureFromFile(file);
  });
}

function isSpecialDesktopDropTarget(target) {
  return Boolean(target?.closest?.("[data-background-drop], [data-facetime-drop]"));
}

function hasImageFile(files) {
  return Boolean(getFirstImageFile(files));
}

function hasDesktopPictureDrag(dataTransfer) {
  return hasImageFile(dataTransfer?.files) || Array.from(dataTransfer?.types || []).includes("Files");
}

function getFirstImageFile(files) {
  return Array.from(files || []).find(isImageFile) || null;
}

function bindAppWindowDragging() {
  document.querySelectorAll("[data-draggable-window]").forEach((windowElement) => {
    if (windowElement.dataset.windowDragBound === "true") return;
    windowElement.dataset.windowDragBound = "true";

    let pointerId = null;
    let startX = 0;
    let startY = 0;
    let baseX = 0;
    let baseY = 0;

    windowElement.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || !isWindowTitleBarPointer(event, windowElement)) return;

      const id = windowElement.dataset.draggableWindow;
      const position = state.windowPositions[id] || { x: 0, y: 0 };
      pointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      baseX = position.x;
      baseY = position.y;
      windowElement.classList.add("is-window-dragging");
      windowElement.setPointerCapture(pointerId);
      event.preventDefault();
    });

    windowElement.addEventListener("pointermove", (event) => {
      if (event.pointerId !== pointerId) return;

      const x = clampIconCoordinate(baseX + event.clientX - startX);
      const y = clampIconCoordinate(baseY + event.clientY - startY);
      setWindowOffset(windowElement, x, y);
    });

    windowElement.addEventListener("pointerup", (event) => {
      if (event.pointerId !== pointerId) return;
      finishWindowDrag(windowElement);
      pointerId = null;
    });

    windowElement.addEventListener("pointercancel", () => {
      finishWindowDrag(windowElement);
      pointerId = null;
    });
  });
}

function isWindowTitleBarPointer(event, windowElement) {
  if (event.target.closest("button, a, input, textarea, select, video, iframe")) return false;
  const rect = windowElement.getBoundingClientRect();
  return event.clientY - rect.top <= 22;
}

function finishWindowDrag(windowElement) {
  windowElement.classList.remove("is-window-dragging");

  const id = windowElement.dataset.draggableWindow;
  if (!id) return;

  state.windowPositions[id] = {
    x: clampIconCoordinate(windowElement.style.getPropertyValue("--window-x").replace("px", "")),
    y: clampIconCoordinate(windowElement.style.getPropertyValue("--window-y").replace("px", "")),
  };
}

function setWindowOffset(windowElement, x, y) {
  windowElement.style.setProperty("--window-x", `${x}px`);
  windowElement.style.setProperty("--window-y", `${y}px`);
}

function bindDesktopIconDragging() {
  document.querySelectorAll("[data-desktop-icon]").forEach((icon) => {
    let pointerId = null;
    let startX = 0;
    let startY = 0;
    let baseX = 0;
    let baseY = 0;
    let moved = false;

    icon.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;

      const id = icon.dataset.desktopIcon;
      const position = state.data.iconPositions?.[id] || { x: 0, y: 0 };
      pointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      baseX = position.x;
      baseY = position.y;
      moved = false;
      icon.classList.add("is-dragging");
      icon.setPointerCapture(pointerId);
    });

    icon.addEventListener("pointermove", (event) => {
      if (event.pointerId !== pointerId) return;

      const deltaX = event.clientX - startX;
      const deltaY = event.clientY - startY;

      if (!moved && Math.hypot(deltaX, deltaY) < 4) return;

      moved = true;
      setIconOffset(icon, baseX + deltaX, baseY + deltaY);
    });

    icon.addEventListener("pointerup", (event) => {
      if (event.pointerId !== pointerId) return;
      finishIconDrag(icon, moved);
      pointerId = null;
    });

    icon.addEventListener("pointercancel", () => {
      finishIconDrag(icon, moved);
      pointerId = null;
    });
  });
}

function finishIconDrag(icon, moved) {
  icon.classList.remove("is-dragging");

  if (!moved) return;

  const id = icon.dataset.desktopIcon;
  const x = clampIconCoordinate(icon.style.getPropertyValue("--icon-x").replace("px", ""));
  const y = clampIconCoordinate(icon.style.getPropertyValue("--icon-y").replace("px", ""));
  state.data.iconPositions ||= {};
  state.data.iconPositions[id] = { x, y };
  saveData({ immediate: true });

  icon.dataset.dragMoved = "true";
  window.setTimeout(() => {
    icon.dataset.dragMoved = "";
  }, 500);
}

function setIconOffset(icon, x, y) {
  icon.style.setProperty("--icon-x", `${clampIconCoordinate(x)}px`);
  icon.style.setProperty("--icon-y", `${clampIconCoordinate(y)}px`);
}

async function setDesktopBackgroundFromFile(file) {
  if (!isImageFile(file)) return;

  try {
    const imageData = await resizeImageFile(file, WALLPAPER_MAX_SIDE, WALLPAPER_JPEG_QUALITY);
    setDesktopBackground(imageData);
    render();
  } catch {}
}

async function addDesktopPictureFromFile(file) {
  if (!isImageFile(file)) return;

  const user = getUser();
  let imageData = "";

  try {
    imageData = await resizeImageFile(file, DESKTOP_PICTURE_MAX_SIDE, DESKTOP_PICTURE_JPEG_QUALITY);
  } catch {
    return;
  }

  const id = createMessageId(user?.id || "picture");
  const picture = {
    id,
    data: imageData,
    name: normalizeShortText(file.name || "Picture", "Picture", 96),
    type: "image/jpeg",
    size: file.size,
    uploadedBy: user?.name || "Daily Dozen",
    uploadedAt: new Date().toISOString(),
  };

  state.data.desktopPictures = mergeDesktopPictures(state.data.desktopPictures, [picture]);
  state.pictureWindowId = id;
  saveLocalData();
  render();

  await saveRemoteData({ includeDesktopPictures: true });
  if (!state.remoteReady) scheduleRemoteSave({ includeDesktopPictures: true });
  if (getDesktopPicture(id)) render();
}

function isImageFile(file) {
  return Boolean(file?.type?.startsWith("image/")) || /\.(avif|gif|heic|heif|jpe?g|png|webp)$/i.test(file?.name || "");
}

function resizeImageFile(file, maxSide, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener("load", () => {
      const image = new Image();

      image.addEventListener("load", () => {
        const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      });

      image.addEventListener("error", () => reject(new Error("Image could not be loaded.")));
      image.src = reader.result;
    });

    reader.addEventListener("error", () => reject(new Error("Image could not be read.")));
    reader.readAsDataURL(file);
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

updateCrtMode();
render();
startRemoteSync();
