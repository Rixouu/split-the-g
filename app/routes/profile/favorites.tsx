import { PlacesAutocomplete } from "~/components/score/PlacesAutocomplete";
import { barKey, favoriteMapsUrl } from "./profile-shared";
import { useProfileOutlet } from "./profile-context";

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
        <ul className="mt-5 space-y-2 border-t border-guinness-gold/15 pt-5">
          {favorites.map((f) => {
            const stats =
              favoriteStats[barKey(f.bar_name, f.bar_address)] ??
              favoriteStats[barKey(f.bar_name)] ??
              null;
            return (
              <li
                key={f.id}
                className="rounded-lg border border-[#372C16] bg-guinness-black/35 p-3 sm:p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <p className="font-semibold leading-snug text-guinness-cream">{f.bar_name}</p>
                      {stats ? (
                        <span className="rounded-full bg-guinness-gold/12 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-guinness-gold">
                          {stats.avg.toFixed(1)} · {stats.count} rated
                        </span>
                      ) : (
                        <span className="text-[11px] text-guinness-tan/60">No ratings yet</span>
                      )}
                    </div>
                    {f.bar_address ? (
                      <p className="type-meta mt-1 line-clamp-2 text-guinness-tan/60">
                        {f.bar_address}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex w-full shrink-0 gap-2 sm:w-auto sm:justify-end">
                    <a
                      href={favoriteMapsUrl(f)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex flex-1 items-center justify-center rounded-lg border border-guinness-gold/30 px-3 py-2 text-xs font-medium text-guinness-gold hover:bg-guinness-gold/10 sm:flex-initial"
                    >
                      Maps
                    </a>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void removeFavorite(f.id)}
                      className="inline-flex flex-1 items-center justify-center rounded-lg border border-red-400/45 px-3 py-2 text-xs font-medium text-red-400/95 hover:bg-red-950/25 sm:flex-initial"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="type-meta mt-6 text-guinness-tan/65">No favorites yet.</p>
      )}
    </section>
  );
}
