import { PlacesAutocomplete } from "~/components/score/PlacesAutocomplete";
import { PubGoogleMapEmbed } from "~/components/pub/PubGoogleMapEmbed";

export interface CompetitionLocationFieldCopy {
  locationLabel: string;
  optionalSuffix: string;
  hint: string;
  mapPreviewTitle: string;
}

const DEFAULT_LOCATION_COPY: CompetitionLocationFieldCopy = {
  locationLabel: "Location",
  optionalSuffix: "(optional)",
  hint: 'Search with Google Maps. Picking a result fills venue name and address. You can also type a name and confirm with "Use this name".',
  mapPreviewTitle: "Competition location preview",
};

export interface CompetitionLocationFieldProps {
  locationName: string;
  locationAddress: string;
  onLocationNameChange: (v: string) => void;
  onLocationAddressChange: (v: string) => void;
  fieldClass: string;
  copy?: Partial<CompetitionLocationFieldCopy>;
}

export function CompetitionLocationField({
  locationName,
  locationAddress,
  onLocationNameChange,
  onLocationAddressChange,
  fieldClass,
  copy: copyPartial,
}: CompetitionLocationFieldProps) {
  const copy = { ...DEFAULT_LOCATION_COPY, ...copyPartial };
  const mapQuery = [locationName.trim(), locationAddress.trim()]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="space-y-2">
      <div>
        <label className="type-label mb-1 block">
          {copy.locationLabel}{" "}
          <span className="font-normal text-guinness-tan/60">
            {copy.optionalSuffix}
          </span>
        </label>
        <PlacesAutocomplete
          initialValue={locationName.trim() || locationAddress.trim()}
          className={fieldClass}
          onChangeText={(v) => {
            onLocationNameChange(v);
            onLocationAddressChange("");
          }}
          onSelect={(data) => {
            onLocationNameChange(data.name);
            onLocationAddressChange(data.address);
          }}
        />
        <p className="type-meta mt-1.5 text-guinness-tan/55">{copy.hint}</p>
      </div>
      {mapQuery ? (
        <div className="overflow-hidden rounded-xl border border-guinness-gold/15 bg-guinness-black/30">
          <PubGoogleMapEmbed searchQuery={mapQuery} title={copy.mapPreviewTitle} />
        </div>
      ) : null}
    </div>
  );
}
