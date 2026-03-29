import { useState, useEffect, useRef } from "react";
import { useI18n } from "~/i18n/context";
import {
  parsePlaceGeoFromComponents,
  type ParsedPlaceGeo,
} from "~/utils/placeGeoFromComponents";
import { normalizeGooglePlaceId } from "~/utils/googlePlaceDetails";

export type PlaceSelection = {
  name: string;
  address: string;
  /** From Google address components when a suggestion is chosen; null for manual entry. */
  geo: ParsedPlaceGeo | null;
  /**
   * Set when the user picks a Places row (not “type name only”).
   * Stored on scores for pub pages (opening hours via Place Details).
   */
  placeId?: string | null;
};

export type PlacesAutocompleteProps = {
  onSelect: (data: PlaceSelection) => void;
  /** Keeps parent bar name in sync when the user types (so submit works without picking a row). */
  onChangeText: (value: string) => void;
  initialValue?: string;
  className?: string;
};

type SuggestionRow = {
  placeId: string;
  name: string;
  address: string;
  placePrediction: google.maps.places.PlacePrediction;
};

function isNewPlacesAutocompleteReady(): boolean {
  return Boolean(
    typeof google !== "undefined" &&
      google.maps?.places?.AutocompleteSuggestion?.fetchAutocompleteSuggestions,
  );
}

function formatPredictionRow(
  prediction: google.maps.places.PlacePrediction,
): { name: string; address: string } {
  const name =
    prediction.mainText?.text?.trim() ||
    prediction.text.text.split(",")[0]?.trim() ||
    prediction.text.text;
  const address = prediction.secondaryText?.text?.trim() ?? "";
  return { name, address };
}

type MapsUiStatus = "loading" | "ready" | "no_key" | "unavailable";

export function PlacesAutocomplete({
  onSelect,
  onChangeText,
  initialValue = "",
  className = "",
}: PlacesAutocompleteProps) {
  const { t } = useI18n();
  const [inputValue, setInputValue] = useState(initialValue);
  const [suggestions, setSuggestions] = useState<SuggestionRow[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [mapsUiStatus, setMapsUiStatus] = useState<MapsUiStatus>("loading");
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(
    null,
  );
  const mapsReadyRef = useRef(false);

  useEffect(() => {
    if (typeof window !== "undefined" && !window.ENV?.GOOGLE_PLACES_API_KEY) {
      setMapsUiStatus("no_key");
      return;
    }

    let attempts = 0;
    const maxAttempts = 200;

    const checkReady = () => {
      if (isNewPlacesAutocompleteReady()) {
        mapsReadyRef.current = true;
        if (!sessionTokenRef.current) {
          sessionTokenRef.current =
            new google.maps.places.AutocompleteSessionToken();
        }
        setMapsUiStatus("ready");
        return;
      }
      attempts += 1;
      if (attempts >= maxAttempts) {
        setMapsUiStatus("unavailable");
        return;
      }
      if (typeof window !== "undefined" && !window.ENV?.GOOGLE_PLACES_API_KEY) {
        setMapsUiStatus("no_key");
        return;
      }
      setTimeout(checkReady, 100);
    };
    checkReady();
  }, []);

  useEffect(() => {
    setInputValue(initialValue);
  }, [initialValue]);

  function newSession() {
    sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
  }

  const handleInput = async (value: string) => {
    setInputValue(value);
    onChangeText(value);

    if (!value.trim() || !mapsReadyRef.current || !sessionTokenRef.current) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);

    try {
      const request: google.maps.places.AutocompleteRequest = {
        input: value,
        sessionToken: sessionTokenRef.current,
        includedRegionCodes: ["th"],
      };

      const { suggestions: raw } =
        await google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions(
          request,
        );

      const rows: SuggestionRow[] = [];
      for (const s of raw) {
        const pp = s.placePrediction;
        if (!pp) continue;
        const { name, address } = formatPredictionRow(pp);
        rows.push({
          placeId: pp.placeId,
          name,
          address,
          placePrediction: pp,
        });
      }

      setSuggestions(rows);
      setShowSuggestions(true);
    } catch {
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const hasManualOption = inputValue.trim().length > 0;
  const listOpen =
    showSuggestions && (suggestions.length > 0 || hasManualOption);

  async function handlePickPlace(row: SuggestionRow) {
    if (!mapsReadyRef.current) return;
    setIsSelecting(true);
    try {
      const place = row.placePrediction.toPlace();
      await place.fetchFields({
        fields: ["displayName", "formattedAddress", "addressComponents", "id"],
      });
      const name = place.displayName?.trim() || row.name;
      const address = place.formattedAddress?.trim() || row.address;
      const geo = parsePlaceGeoFromComponents(place.addressComponents);
      const rawPid =
        (typeof place.id === "string" && place.id.trim()) || row.placeId;
      const placeId = rawPid ? normalizeGooglePlaceId(rawPid) : null;
      onSelect({ name, address, geo, placeId });
      setInputValue(name);
      onChangeText(name);
      setShowSuggestions(false);
      setSuggestions([]);
      newSession();
    } catch {
      onSelect({
        name: row.name,
        address: row.address,
        geo: null,
        placeId: row.placeId ? normalizeGooglePlaceId(row.placeId) : null,
      });
      setInputValue(row.name);
      onChangeText(row.name);
      setShowSuggestions(false);
      setSuggestions([]);
      newSession();
    } finally {
      setIsSelecting(false);
    }
  }

  const helperText =
    mapsUiStatus === "no_key"
      ? t("pages.score.placesNoApiKey")
      : mapsUiStatus === "unavailable"
        ? t("pages.score.placesUnavailable")
        : null;

  return (
    <div className="relative">
      <input
        type="text"
        value={inputValue}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => {
          setTimeout(() => setShowSuggestions(false), 200);
        }}
        autoComplete="off"
        disabled={isSelecting}
        className={`w-full px-4 py-2 bg-guinness-black/50 border border-guinness-gold/20 rounded-lg text-guinness-tan focus:outline-none focus:border-guinness-gold ${className}`}
        placeholder={t("pages.score.placesPlaceholder")}
        aria-describedby={helperText ? "places-autocomplete-hint" : undefined}
      />

      {isLoading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="animate-spin h-5 w-5 border-2 border-guinness-gold border-t-transparent rounded-full" />
        </div>
      )}

      {listOpen && (
        <div className="absolute left-0 right-0 z-10 mt-1 top-full max-h-60 overflow-auto rounded-lg border border-guinness-gold/20 bg-guinness-black shadow-lg">
          {suggestions.map((place) => (
            <button
              key={place.placeId}
              type="button"
              className="w-full px-4 py-2 text-left hover:bg-guinness-gold/10 text-guinness-tan disabled:opacity-50"
              disabled={isSelecting}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => void handlePickPlace(place)}
            >
              <div className="font-medium">{place.name}</div>
              {place.address ? (
                <div className="text-sm text-guinness-tan/60">
                  {place.address}
                </div>
              ) : null}
            </button>
          ))}
          {hasManualOption && (
            <button
              type="button"
              className="w-full px-4 py-2 text-left hover:bg-guinness-gold/10 text-guinness-gold border-t border-guinness-gold/20"
              disabled={isSelecting}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSelect({
                  name: inputValue.trim(),
                  address: "",
                  geo: null,
                  placeId: null,
                });
                onChangeText(inputValue.trim());
                setShowSuggestions(false);
                newSession();
              }}
            >
              {t("pages.score.placesUseName", { name: inputValue.trim() })}
            </button>
          )}
        </div>
      )}

      {helperText ? (
        <p
          id="places-autocomplete-hint"
          className="type-meta mt-2 text-guinness-tan/65"
          role="status"
        >
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
