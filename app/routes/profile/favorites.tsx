import {
  PubVenueCard,
  pubVenueCardActionDangerClass,
  pubVenueCardActionOutlineClass,
} from "~/components/pub-venue-card";
import { PlacesAutocomplete } from "~/components/score/PlacesAutocomplete";
import { pubDetailPath } from "~/utils/pubPath";
import { seoMeta } from "~/utils/seo";
import { barKey, favoriteMapsUrl } from "./profile-shared";
import { useProfileOutlet } from "./profile-context";

export function meta() {
  return seoMeta({
    title: "Profile Favorite Bars",
    description: "Save and manage your favorite pubs in Split the G.",
    path: "/profile/favorites",
    keywords: ["favorite pubs", "profile favorites"],
  });
}

export default function ProfileFavoritesPage() {
  const {
    favorites,
    favoriteStats,
    busy,
    favName,
    setFavName,
    setFavAddress,
    addFavorite,
    removeFavorite,
    inputClass,
  } = useProfileOutlet();

  return (
    <section className="rounded-xl border border-[#372C16] bg-guinness-brown/40 p-4 sm:p-6">
      <h2 className="type-card-title mb-1">Favorite bars</h2>
      <p className="type-meta mb-4 text-guinness-tan/65">
        Save pubs you visit; we use Places for accurate addresses.
      </p>
      <form onSubmit={(ev) => void addFavorite(ev)} className="space-y-3">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <label
              htmlFor="fav-bar-search"
              className="type-label mb-1.5 block text-guinness-tan/85"
            >
              Search (Google Places)
            </label>
            <PlacesAutocomplete
              initialValue={favName}
              onChangeText={setFavName}
              onSelect={(p) => {
                setFavName(p.name);
                setFavAddress(p.address);
              }}
              className={inputClass}
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="h-11 w-full shrink-0 rounded-lg bg-guinness-gold px-6 text-sm font-semibold text-guinness-black transition-colors hover:bg-guinness-tan disabled:opacity-50 lg:min-w-[10.5rem]"
          >
            Save favorite
          </button>
        </div>
        <p className="text-xs leading-relaxed text-guinness-tan/55">
          Choose a suggestion when possible so we store the full address.
        </p>
      </form>

      {favorites.length > 0 ? (
        <ul className="mt-5 grid gap-3 border-t border-guinness-gold/15 pt-5 sm:gap-4">
          {favorites.map((f) => {
            const stats =
              favoriteStats[barKey(f.bar_name, f.bar_address)] ??
              favoriteStats[barKey(f.bar_name)] ??
              null;
            const wallTo = pubDetailPath(f.bar_name.trim().toLowerCase());
            const pourCount = stats?.count ?? 0;
            return (
              <PubVenueCard
                key={f.id}
                title={f.bar_name}
                address={f.bar_address}
                primaryTo={wallTo}
                submissionCount={pourCount}
                avgPourRating={stats?.avg ?? null}
                ratingCount={stats?.count ?? 0}
                actions={
                  <>
                    <a
                      href={favoriteMapsUrl(f)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={pubVenueCardActionOutlineClass}
                    >
                      Maps
                    </a>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void removeFavorite(f.id)}
                      className={pubVenueCardActionDangerClass}
                    >
                      Remove
                    </button>
                  </>
                }
              />
            );
          })}
        </ul>
      ) : (
        <p className="type-meta mt-6 text-guinness-tan/65">No favorites yet.</p>
      )}
    </section>
  );
}
