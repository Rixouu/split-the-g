import {
  PubVenueCard,
  pubVenueCardActionDangerClass,
  pubVenueCardActionOutlineClass,
} from "~/components/pub-venue-card";
import { PlacesAutocomplete } from "~/components/score/PlacesAutocomplete";
import { pubDetailPath } from "~/utils/pubPath";
import { useI18n } from "~/i18n/context";
import { seoMetaForRoute } from "~/i18n/seo-meta";
import { barKey, favoriteMapsUrl } from "./profile-shared";
import { useProfileOutlet } from "./profile-context";

export function meta({ params }: { params: { lang?: string } }) {
  return seoMetaForRoute(params, "/profile/favorites", "favorites");
}

export default function ProfileFavoritesPage() {
  const { t } = useI18n();
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
      <h2 className="type-card-title mb-1">
        {t("pages.profile.favoritesSectionTitle")}
      </h2>
      <p className="type-meta mb-4 text-guinness-tan/65">
        {t("pages.profile.favoritesSectionBlurb")}
      </p>
      <form onSubmit={(ev) => void addFavorite(ev)} className="space-y-3">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <label
              htmlFor="fav-bar-search"
              className="type-label mb-1.5 block text-guinness-tan/85"
            >
              {t("pages.profile.favoritesSearchLabel")}
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
            {t("pages.profile.favoritesSaveButton")}
          </button>
        </div>
        <p className="text-xs leading-relaxed text-guinness-tan/55">
          {t("pages.profile.favoritesAddressHint")}
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
                      {t("pages.profile.favoritesMaps")}
                    </a>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void removeFavorite(f.id)}
                      className={pubVenueCardActionDangerClass}
                    >
                      {t("pages.profile.favoritesRemove")}
                    </button>
                  </>
                }
              />
            );
          })}
        </ul>
      ) : (
        <p className="type-meta mt-6 text-guinness-tan/65">
          {t("pages.profile.favoritesEmpty")}
        </p>
      )}
    </section>
  );
}
