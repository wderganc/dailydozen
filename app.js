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
const API_STATE_URL = "/api/state";
const REMOTE_SYNC_INTERVAL_MS = 15000;
const WALLPAPER_MAX_SIDE = 1400;
const WALLPAPER_JPEG_QUALITY = 0.78;

const app = document.querySelector("#app");
let remoteSaveTimer;
let remoteSyncTimer;

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
};

function setDesktopBackground(imageData) {
  state.data.wallpaper = imageData;
  saveData({ immediate: true });
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
    wallpaper: "",
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
      wallpaper: normalizeWallpaper(parsed.wallpaper),
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
    wallpaper: normalizeWallpaper(data?.wallpaper),
  };
}

function normalizeWallpaper(value) {
  if (typeof value !== "string") return "";
  return value.startsWith("data:image/") ? value : "";
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state.data, wallpaper: "" }));
  }
}

function saveData({ immediate = false } = {}) {
  saveLocalData();

  if (immediate) {
    window.clearTimeout(remoteSaveTimer);
    saveRemoteData();
    return;
  }

  scheduleRemoteSave();
}

function scheduleRemoteSave() {
  window.clearTimeout(remoteSaveTimer);
  remoteSaveTimer = window.setTimeout(saveRemoteData, 450);
}

async function saveRemoteData() {
  state.remoteStatus = "saving";
  updateSyncIndicator();

  try {
    const response = await fetch(API_STATE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: state.data }),
    });

    if (!response.ok) throw new Error(`Remote save failed: ${response.status}`);
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

async function loadRemoteData({ mergeLocal = false, renderAfter = false } = {}) {
  state.remoteStatus = "checking";
  updateSyncIndicator();

  try {
    const response = await fetch(API_STATE_URL, {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) throw new Error(`Remote load failed: ${response.status}`);

    const payload = await response.json();
    const remoteData = normalizeData(payload.data);
    state.data = mergeLocal ? mergeData(remoteData, state.data) : remoteData;
    state.remoteReady = true;
    state.remoteStatus = "synced";
    state.remoteError = "";
    saveLocalData();

    if (mergeLocal && hasLocalActivity(state.data)) {
      scheduleRemoteSave();
    }

    if (renderAfter && !isTextEditing()) {
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

  return {
    items: areDefaultItems(remote.items) ? local.items : remote.items,
    completions: mergeCompletionSets(local.completions, remote.completions),
    notes: mergeNestedObjects(local.notes, remote.notes),
    sharedNotes: {
      ...local.sharedNotes,
      ...remote.sharedNotes,
    },
    wallpaper: remote.wallpaper || local.wallpaper || "",
  };
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
    Boolean(data.wallpaper)
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
  state.data.sharedNotes[state.selectedDate] = value;
  saveData();
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
  const user = getUser();
  app.innerHTML = renderMacShell(user ? renderDashboard(user) : renderLogin());
  bindEvents();
}

function renderMacShell(content) {
  return `
    <div class="mac-shell">
      <header class="system-menu" aria-hidden="true">
        <div class="menu-mark">D12</div>
        <div class="menu-items">
          <span>File</span>
          <span>Edit</span>
          <span>View</span>
          <span>Special</span>
          <span>Help</span>
        </div>
        <time>${formatClassicTime(new Date())}</time>
        <span class="system-glyph"></span>
      </header>

      <div class="desktop-surface ${getDesktopBackground() ? "has-custom-wallpaper" : ""}" ${getDesktopBackgroundStyle()}>
        <div class="apple-menu-card" aria-hidden="true">
          <div>About Daily Dozen...</div>
          <div class="menu-separator"></div>
          <div>Daily Checklist</div>
          <div>Shared Note</div>
          <div>Progress Board</div>
          <div class="menu-separator"></div>
          <div>Control Panels</div>
          <div>Find File</div>
          <div>Stickies</div>
        </div>

        <input class="background-file-input" type="file" accept="image/*" data-background-file />

        <div class="desktop-icons">
          <button class="desktop-icon desktop-drop-target" type="button" data-background-drop aria-label="Choose or drop a shared desktop background image" title="Drop an image here to change the shared desktop background">
            <span class="icon-drive"></span>
            <strong>Daily Dozen HD</strong>
          </button>
          <div class="desktop-icon">
            <span class="icon-kimchi"></span>
            <strong>Kimchi Quest</strong>
          </div>
          <div class="desktop-icon">
            <span class="icon-bird"></span>
            <strong>Bird Calls</strong>
          </div>
          <div class="desktop-icon">
            <span class="icon-folder"></span>
            <strong>Claudia's Seed Collection</strong>
          </div>
          <div class="desktop-icon">
            <span class="icon-monkey"></span>
            <strong>Monkey See Genevieve Do</strong>
          </div>
          <div class="desktop-icon">
            <span class="icon-ukulele"></span>
            <strong>ULaylee</strong>
          </div>
          <div class="desktop-icon">
            <span class="icon-pencils"></span>
            <strong>Colored Pencils</strong>
          </div>
          <div class="desktop-icon">
            <span class="icon-folder icon-folder-green"></span>
            <strong>Genevieve's Seed Collection</strong>
          </div>
          <div class="desktop-icon">
            <span class="icon-trash"></span>
            <strong>Trash</strong>
          </div>
        </div>

        ${content}
      </div>
    </div>
  `;
}

function getDesktopBackgroundStyle() {
  const background = getDesktopBackground();
  if (!background) return "";
  return `style="--custom-wallpaper: url(${escapeAttribute(background)})"`;
}

function getDesktopBackground() {
  return state.data.wallpaper || "";
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
          <div class="note-block note-block-shared mac-window" data-window-title="Shared Note">
            <div class="section-heading">
              <p class="eyebrow">For both of you</p>
              <h2>Shared note</h2>
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

  document.querySelector("[data-shared-note]")?.addEventListener("input", (event) => {
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

function bindDesktopBackgroundEvents() {
  const dropTarget = document.querySelector("[data-background-drop]");
  const fileInput = document.querySelector("[data-background-file]");

  if (!dropTarget || !fileInput) return;

  dropTarget.addEventListener("click", () => {
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

function setDesktopBackgroundFromFile(file) {
  if (!file.type.startsWith("image/")) return;

  const reader = new FileReader();

  reader.addEventListener("load", () => {
    const image = new Image();

    image.addEventListener("load", () => {
      const scale = Math.min(1, WALLPAPER_MAX_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      setDesktopBackground(canvas.toDataURL("image/jpeg", WALLPAPER_JPEG_QUALITY));
      render();
    });

    image.src = reader.result;
  });

  reader.readAsDataURL(file);
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
