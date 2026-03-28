import { PlacesAutocomplete } from "~/components/score/PlacesAutocomplete";
import { PubGoogleMapEmbed } from "~/components/pub/PubGoogleMapEmbed";

export interface CompetitionLocationFieldProps {
  locationName: string;
  locationAddress: string;
  onLocationNameChange: (v: string) => void;
  onLocationAddressChange: (v: string) => void;
  fieldClass: string;
}

export function CompetitionLocationField({
  locationName,
  locationAddress,
  onLocationNameChange,
  onLocationAddressChange,
  fieldClass,
}: CompetitionLocationFieldProps) {
  const mapQuery = [locationName.trim(), locationAddress.trim()]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="space-y-2">
      <div>
        <label className="type-label mb-1 block">
          Location{" "}
          <span className="font-normal text-guinness-tan/60">(optional)</span>
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
        <p className="type-meta mt-1.5 text-guinness-tan/55">
          Search with Google Maps — picking a result fills venue name and address. You
          can also type a name and confirm with &quot;Use this name&quot;.
        </p>
      </div>
      {mapQuery ? (
        <div className="overflow-hidden rounded-xl border border-guinness-gold/15 bg-guinness-black/30">
          <PubGoogleMapEmbed searchQuery={mapQuery} title="Competition location preview" />
        </div>
      ) : null}
    </div>
  );
}
