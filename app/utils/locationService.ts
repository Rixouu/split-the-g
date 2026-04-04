type LocationData = {
  city: string | null;
  region: string | null;
  country: string | null;
  country_code: string | null;
};

const EXTERNAL_LOOKUP_MS = 2500;

function decodeHeaderValue(raw: string | null): string | null {
  if (!raw?.trim()) return null;
  const v = raw.trim();
  try {
    return decodeURIComponent(v.replace(/\+/g, " "));
  } catch {
    return v;
  }
}

/**
 * Vercel attaches geo on the incoming request (no extra HTTP hop).
 * Prefer this over third-party IP APIs — many block serverless egress (403).
 */
function locationFromEdgeHeaders(headers: Headers): LocationData | null {
  const country_code =
    headers.get("x-vercel-ip-country")?.trim().toUpperCase() || null;
  const city = decodeHeaderValue(headers.get("x-vercel-ip-city"));
  const region = decodeHeaderValue(headers.get("x-vercel-ip-country-region"));
  if (!country_code && !city && !region) return null;
  return {
    city,
    region,
    country: null,
    country_code,
  };
}

/** Cloudflare sets this when the site is proxied. */
function locationFromCloudflareHeaders(headers: Headers): LocationData | null {
  const country_code = headers.get("cf-ipcountry")?.trim().toUpperCase() || null;
  if (!country_code || country_code === "XX") return null;
  return {
    city: null,
    region: null,
    country: null,
    country_code,
  };
}

/**
 * Best-effort geo for pour metadata. Uses edge headers first, then a short
 * timeout call to ipwho.is only when needed (local / non-edge hosts).
 */
export async function getLocationData(
  ipAddress?: string,
  requestHeaders?: Headers,
): Promise<LocationData> {
  if (requestHeaders) {
    const edge = locationFromEdgeHeaders(requestHeaders);
    if (edge && (edge.country_code != null || edge.city != null)) {
      return edge;
    }
    const cf = locationFromCloudflareHeaders(requestHeaders);
    if (cf) return cf;
  }

  try {
    const normalizedIp = ipAddress?.trim();
    const apiUrl = normalizedIp
      ? `https://ipwho.is/${encodeURIComponent(normalizedIp)}`
      : "https://ipwho.is/";

    const response = await fetch(apiUrl, {
      signal: AbortSignal.timeout(EXTERNAL_LOOKUP_MS),
    });

    if (!response.ok) {
      return { city: null, region: null, country: null, country_code: null };
    }

    const data = (await response.json()) as {
      success?: boolean;
      city?: string;
      region?: string;
      country?: string;
      country_code?: string;
    };

    if (!data.success) {
      return { city: null, region: null, country: null, country_code: null };
    }

    return {
      city: data.city || null,
      region: data.region || null,
      country: data.country || null,
      country_code: data.country_code || null,
    };
  } catch {
    return { city: null, region: null, country: null, country_code: null };
  }
}
