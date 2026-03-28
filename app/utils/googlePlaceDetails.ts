/**
 * Server-side Place Details (legacy JSON) for opening hours.
 * Enable "Places API" in Google Cloud and allow this key for Place Details
 * (often the same key as Maps JS; referrer-only keys may fail on SSR — see docs).
 *
 * @see https://developers.google.com/maps/documentation/places/web-service/legacy/details-legacy
 */

export function normalizeGooglePlaceId(raw: string): string {
  return raw.replace(/^places\//, "").trim();
}

/**
 * Prefer `GOOGLE_MAPS_SERVER_KEY` in `.env` for SSR when the browser key is
 * HTTP-referrer restricted (Place Details from Node has no referrer).
 */
export function resolveGoogleMapsKeyForServer(): string {
  if (typeof process !== "undefined") {
    const server = process.env.GOOGLE_MAPS_SERVER_KEY?.trim();
    if (server) return server;
  }
  const vite = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  return typeof vite === "string" ? vite.trim() : "";
}

export async function fetchPlaceOpeningHoursWeekdayLines(
  placeId: string,
  apiKey: string,
): Promise<string[] | null> {
  const id = normalizeGooglePlaceId(placeId);
  if (!id || !apiKey) return null;

  const url = new URL(
    "https://maps.googleapis.com/maps/api/place/details/json",
  );
  url.searchParams.set("place_id", id);
  url.searchParams.set("fields", "opening_hours,current_opening_hours");
  url.searchParams.set("key", apiKey);

  let res: Response;
  try {
    res = await fetch(url.toString());
  } catch {
    return null;
  }
  if (!res.ok) return null;

  const data = (await res.json()) as {
    status: string;
    result?: {
      opening_hours?: { weekday_text?: string[] };
      current_opening_hours?: { weekday_text?: string[] };
    };
  };

  if (data.status !== "OK") return null;
  const primary = data.result?.opening_hours?.weekday_text?.filter(Boolean);
  const current =
    data.result?.current_opening_hours?.weekday_text?.filter(Boolean);
  const lines =
    primary && primary.length > 0
      ? primary
      : current && current.length > 0
        ? current
        : null;
  return lines ?? null;
}

/** Data returned from Place Details for admin “import from Google” on pub pages. */
export type PlaceDetailsImportPayload = {
  placeId: string;
  name: string | null;
  formattedAddress: string | null;
  weekdayLines: string[] | null;
  mapsUrl: string | null;
};

export type PlaceDetailsImportResult =
  | { ok: true; data: PlaceDetailsImportPayload }
  | { ok: false; status: string; message?: string };

/**
 * Full legacy Place Details fields used to pre-fill directory fields.
 * Fields: https://developers.google.com/maps/documentation/places/web-service/legacy/details-legacy
 */
export async function fetchPlaceDetailsForDirectoryImport(
  placeId: string,
  apiKey: string,
): Promise<PlaceDetailsImportResult> {
  const id = normalizeGooglePlaceId(placeId);
  if (!id || !apiKey) {
    return { ok: false, status: "INVALID_REQUEST", message: "Missing place or API key." };
  }

  const url = new URL(
    "https://maps.googleapis.com/maps/api/place/details/json",
  );
  url.searchParams.set("place_id", id);
  url.searchParams.set(
    "fields",
    "name,formatted_address,opening_hours,current_opening_hours,url,place_id",
  );
  url.searchParams.set("key", apiKey);

  let res: Response;
  try {
    res = await fetch(url.toString());
  } catch {
    return {
      ok: false,
      status: "FETCH_ERROR",
      message: "Could not reach Google Places.",
    };
  }
  if (!res.ok) {
    return { ok: false, status: "HTTP_ERROR", message: `HTTP ${res.status}` };
  }

  const body = (await res.json()) as {
    status: string;
    error_message?: string;
    result?: {
      place_id?: string;
      name?: string;
      formatted_address?: string;
      url?: string;
      opening_hours?: { weekday_text?: string[] };
      current_opening_hours?: { weekday_text?: string[] };
    };
  };

  if (body.status !== "OK" || !body.result) {
    return {
      ok: false,
      status: body.status,
      message:
        body.error_message?.trim() ||
        (body.status === "REQUEST_DENIED"
          ? "API key denied (enable Place Details; use GOOGLE_MAPS_SERVER_KEY if the key is referrer-restricted)."
          : "Place lookup failed."),
    };
  }

  const r = body.result;
  const primary = r.opening_hours?.weekday_text?.filter(Boolean) ?? [];
  const current =
    r.current_opening_hours?.weekday_text?.filter(Boolean) ?? [];
  const weekdayLines =
    primary.length > 0 ? primary : current.length > 0 ? current : null;

  return {
    ok: true,
    data: {
      placeId: normalizeGooglePlaceId(r.place_id ?? id),
      name: r.name?.trim() || null,
      formattedAddress: r.formatted_address?.trim() || null,
      weekdayLines,
      mapsUrl: r.url?.trim() || null,
    },
  };
}

/** Pull `ChIJ…` style id from pasted Maps URLs or return trimmed raw id. */
export function extractPlaceIdFromMapsInput(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s) && !/\s/.test(s) && s.length >= 10) {
    return normalizeGooglePlaceId(s);
  }
  const decoded = tryDecodeUriComponent(s);
  const m = decoded.match(/ChIJ[A-Za-z0-9_-]+/);
  return m ? normalizeGooglePlaceId(m[0]) : null;
}

function tryDecodeUriComponent(s: string): string {
  try {
    return decodeURIComponent(s.replace(/\+/g, " "));
  } catch {
    return s;
  }
}

const MAPS_FETCH_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

/**
 * Follow redirects for maps.app.goo.gl / goo.gl until we land on a google.com/maps URL
 * that may contain a Place ID in the query or fragment.
 */
export async function expandGoogleMapsRedirectChain(
  startUrl: string,
  maxHops = 12,
): Promise<string> {
  let url = startUrl.trim();
  if (!/^https?:\/\//i.test(url)) return url;

  for (let hop = 0; hop < maxHops; hop++) {
    const res = await fetch(url, {
      method: "GET",
      redirect: "manual",
      headers: {
        "User-Agent": MAPS_FETCH_UA,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (res.status >= 301 && res.status <= 308) {
      const loc = res.headers.get("Location");
      if (!loc) return res.url || url;
      if (/^https?:\/\//i.test(loc)) {
        url = loc;
      } else if (loc.startsWith("/")) {
        url = new URL(loc, "https://www.google.com").href;
      } else {
        url = new URL(loc, url).href;
      }
      continue;
    }

    return res.url || url;
  }
  return url;
}

async function findPlaceIdFromTextQuery(
  query: string,
  apiKey: string,
): Promise<string | null> {
  const q = query.trim();
  if (!q || !apiKey) return null;

  const url = new URL(
    "https://maps.googleapis.com/maps/api/place/findplacefromtext/json",
  );
  url.searchParams.set("input", q);
  url.searchParams.set("inputtype", "textquery");
  url.searchParams.set("fields", "place_id");
  url.searchParams.set("key", apiKey);

  let res: Response;
  try {
    res = await fetch(url.toString());
  } catch {
    return null;
  }
  if (!res.ok) return null;

  const body = (await res.json()) as {
    status: string;
    candidates?: { place_id?: string }[];
  };
  if (body.status !== "OK" || !body.candidates?.length) return null;
  const pid = body.candidates[0]?.place_id;
  return pid ? normalizeGooglePlaceId(pid) : null;
}

export type ResolvePlaceIdResult =
  | {
      ok: true;
      placeId: string;
      via: "direct" | "redirect" | "findplace" | "textsearch";
    }
  | { ok: false; message: string };

/**
 * Decode `/maps/place/<slug>/` and lat/lng from `!3d…!4d…` or `@lat,lng`.
 * Modern share URLs often use `0x…:0x…` feature refs instead of ChIJ — Text Search
 * with these coords resolves the API place_id.
 */
export function parseGoogleMapsBrowserUrl(url: string): {
  title: string | null;
  lat: number | null;
  lng: number | null;
} {
  const decoded = tryDecodeUriComponent(url);

  let title: string | null = null;
  const placeSeg = decoded.match(/\/maps\/place\/([^/?@]+)/i);
  if (placeSeg?.[1]) {
    const seg = placeSeg[1];
    try {
      title =
        decodeURIComponent(seg)
          .replace(/\+/g, " ")
          .replace(/\s+/g, " ")
          .trim() || null;
    } catch {
      title = seg.replace(/\+/g, " ").replace(/\s+/g, " ").trim() || null;
    }
  }

  let lat: number | null = null;
  let lng: number | null = null;
  const pin = decoded.match(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/);
  if (pin) {
    lat = Number.parseFloat(pin[1]);
    lng = Number.parseFloat(pin[2]);
  }
  if (
    lat == null ||
    lng == null ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    const at = decoded.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)(?:,|\?|\/|$)/);
    if (at) {
      lat = Number.parseFloat(at[1]);
      lng = Number.parseFloat(at[2]);
    }
  }

  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { title, lat: null, lng: null };
  }
  return { title, lat, lng };
}

async function placeTextSearchNear(
  query: string,
  lat: number,
  lng: number,
  radiusM: number,
  apiKey: string,
): Promise<string | null> {
  const q = query.trim();
  if (!q || !apiKey) return null;

  const u = new URL(
    "https://maps.googleapis.com/maps/api/place/textsearch/json",
  );
  u.searchParams.set("query", q);
  u.searchParams.set("location", `${lat},${lng}`);
  u.searchParams.set("radius", String(radiusM));
  u.searchParams.set("key", apiKey);

  let res: Response;
  try {
    res = await fetch(u.toString());
  } catch {
    return null;
  }
  if (!res.ok) return null;

  const body = (await res.json()) as {
    status: string;
    results?: { place_id?: string }[];
  };
  if (body.status !== "OK" || !body.results?.length) return null;
  const pid = body.results[0]?.place_id;
  return pid ? normalizeGooglePlaceId(pid) : null;
}

/**
 * Resolve a Place ID from: ChIJ…, long/short Maps URLs (incl. `0x…:0x…` data= URLs),
 * Places Text Search near parsed coordinates, then Find Place from pub name.
 */
export async function resolvePlaceIdForPubImport(
  rawInput: string,
  apiKey: string,
  textFallback: { displayName: string; sampleAddress: string | null } | null,
): Promise<ResolvePlaceIdResult> {
  const blob = rawInput.trim();
  if (!blob && !textFallback?.displayName?.trim()) {
    return {
      ok: false,
      message:
        "Paste a Google Maps link, Place ID, or ensure this pub has a name to search.",
    };
  }

  let id = extractPlaceIdFromMapsInput(blob);
  if (id) return { ok: true, placeId: id, via: "direct" };

  const lines = blob
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    id = extractPlaceIdFromMapsInput(line);
    if (id) return { ok: true, placeId: id, via: "direct" };
  }

  const urlCandidates = new Set<string>();
  for (const line of lines) {
    if (!/^https?:\/\//i.test(line)) continue;
    urlCandidates.add(line);
    try {
      urlCandidates.add(await expandGoogleMapsRedirectChain(line));
    } catch {
      /* ignore */
    }
  }

  for (const u of urlCandidates) {
    id = extractPlaceIdFromMapsInput(u);
    if (id) return { ok: true, placeId: id, via: "redirect" };
    id = extractPlaceIdFromMapsInput(tryDecodeUriComponent(u));
    if (id) return { ok: true, placeId: id, via: "redirect" };
  }

  for (const u of urlCandidates) {
    if (!/\/maps\//i.test(u) && !/maps\.google\./i.test(u)) continue;
    const meta = parseGoogleMapsBrowserUrl(u);
    if (meta.title && meta.lat != null && meta.lng != null && apiKey) {
      for (const radius of [120, 400, 1500, 5000]) {
        const pid = await placeTextSearchNear(
          meta.title,
          meta.lat,
          meta.lng,
          radius,
          apiKey,
        );
        if (pid) return { ok: true, placeId: pid, via: "textsearch" };
      }
    }
    if (meta.title && apiKey) {
      const pid = await findPlaceIdFromTextQuery(meta.title, apiKey);
      if (pid) return { ok: true, placeId: pid, via: "findplace" };
    }
  }

  const searchParts = [
    textFallback?.displayName?.trim(),
    textFallback?.sampleAddress?.trim(),
  ].filter(Boolean);
  const searchQuery = searchParts.join(" ").trim();
  if (searchQuery && apiKey) {
    const found = await findPlaceIdFromTextQuery(searchQuery, apiKey);
    if (found) return { ok: true, placeId: found, via: "findplace" };
  }

  return {
    ok: false,
    message:
      "Could not resolve a Google Place ID. Import uses **legacy** web-service URLs (`/maps/api/place/…`): in Google Cloud enable **Places API** (classic), not only **Places API (New)**. Set **`GOOGLE_MAPS_SERVER_KEY`** in Vercel to a second key with **no HTTP referrer restriction** (API-restricted is fine); a referrer-only key always fails on the server. Or paste a **ChIJ…** id from Google’s Place ID finder.",
  };
}
