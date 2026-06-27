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

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });
}
