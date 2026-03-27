type LocationData = {
  city: string | null;
  region: string | null;
  country: string | null;
  country_code: string | null;
};

export async function getLocationData(ipAddress?: string): Promise<LocationData> {
  try {
    // Free, no-key geolocation API.
    const normalizedIp = ipAddress?.trim();
    const apiUrl = normalizedIp
      ? `https://ipwho.is/${encodeURIComponent(normalizedIp)}`
      : "https://ipwho.is/";

    const response = await fetch(apiUrl);

    if (!response.ok) {
      console.error('Failed to fetch location data:', response.statusText);
      return { city: null, region: null, country: null, country_code: null };
    }

    const data = await response.json();

    if (!data.success) {
      return { city: null, region: null, country: null, country_code: null };
    }

    return {
      city: data.city || null,
      region: data.region || null,
      country: data.country || null,
      country_code: data.country_code || null
    };
  } catch (error) {
    console.error('Error fetching location data:', error);
    return { city: null, region: null, country: null, country_code: null };
  }
} 