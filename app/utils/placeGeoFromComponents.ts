export interface ParsedPlaceGeo {
  city: string | null;
  region: string | null;
  country: string | null;
  countryCode: string | null;
}

type ComponentLike = {
  longText?: string | null;
  shortText?: string | null;
  types: string[];
};

/** Map Places `addressComponents` into score row geo fields. */
export function parsePlaceGeoFromComponents(
  components: ComponentLike[] | undefined | null,
): ParsedPlaceGeo {
  const out: ParsedPlaceGeo = {
    city: null,
    region: null,
    country: null,
    countryCode: null,
  };
  if (!components?.length) return out;

  for (const c of components) {
    const types = c.types ?? [];
    const long = c.longText?.trim() || null;
    const short = c.shortText?.trim() || null;
    if (!long && !short) continue;

    if (types.includes("locality")) {
      out.city = long;
    } else if (
      types.includes("sublocality") ||
      types.includes("sublocality_level_1") ||
      types.includes("neighborhood")
    ) {
      if (!out.city) out.city = long;
    } else if (
      types.includes("administrative_area_level_1") ||
      types.includes("administrative_area_level_2")
    ) {
      if (!out.region) out.region = long;
    } else if (types.includes("country")) {
      out.country = long;
      out.countryCode = short;
    }
  }

  return out;
}
