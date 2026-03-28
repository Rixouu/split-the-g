import { Link, useLoaderData, useRevalidator } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  PageHeader,
  pageHeaderActionButtonClass,
  pageShellClass,
} from "~/components/PageHeader";
import { PubGoogleMapEmbed } from "~/components/pub/PubGoogleMapEmbed";
import { supabase } from "~/utils/supabase";
import type { BarStat } from "~/routes/pubs";

/** Only this account may edit pub directory fields (hours, promos, map URL). */
const PUB_DIRECTORY_ADMIN_EMAIL = "admin.rixou@gmail.com";

function isPubDirectoryAdmin(email: string | null | undefined): boolean {
  const e = email?.trim().toLowerCase();
  return Boolean(e && e === PUB_DIRECTORY_ADMIN_EMAIL.toLowerCase());
}

/** Brand stroke for pub surfaces (replaces light / white-leaning borders). */
const pubStroke = "border-[#372C16]";
const pubPanel = `rounded-2xl border ${pubStroke} bg-guinness-brown/25 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-5`;
const pubPanelMuted = `rounded-xl border ${pubStroke} bg-guinness-black/30 px-3 py-3 sm:px-4 sm:py-3.5`;
const pubDivider = `border-t ${pubStroke}`;

type PubExtraRow = {
  distinct_drinkers: number;
  total_pint_spend: number;
  my_pint_spend: number;
};

type PubPlaceRow = {
  bar_key: string;
  opening_hours: string | null;
  guinness_info: string | null;
  alcohol_promotions: string | null;
  maps_place_url: string | null;
  updated_at: string;
  updated_by: string | null;
};

type LinkedCompetition = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
};

function mapsSearchUrl(b: BarStat): string {
  const q = [b.display_name, b.sample_address].filter(Boolean).join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

function numFromDb(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number.parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

export async function loader({ params }: LoaderFunctionArgs) {
  const raw = params.barKey?.trim();
  if (!raw) {
    throw new Response("Not found", { status: 404 });
  }
  const barKey = decodeURIComponent(raw).trim().toLowerCase();

  const { data: stat, error: statError } = await supabase
    .from("bar_pub_stats")
    .select("*")
    .eq("bar_key", barKey)
    .maybeSingle();

  if (statError || !stat) {
    throw new Response("Not found", { status: 404 });
  }

  const bar = stat as BarStat;

  const { data: extraRows, error: extraError } = await supabase.rpc(
    "pub_extra_stats_for_bar",
    { p_bar_key: barKey },
  );

  if (extraError) {
    return {
      barKey,
      bar,
      extra: {
        distinct_drinkers: 0,
        total_pint_spend: 0,
        my_pint_spend: 0,
      } satisfies PubExtraRow,
      extraError: extraError.message,
      placeDetails: null as PubPlaceRow | null,
      linkedCompetitions: [] as LinkedCompetition[],
    };
  }

  const rawExtra = (extraRows ?? [])[0] as
    | {
        distinct_drinkers?: unknown;
        total_pint_spend?: unknown;
        my_pint_spend?: unknown;
      }
    | undefined;

  const extra: PubExtraRow = {
    distinct_drinkers: Math.round(numFromDb(rawExtra?.distinct_drinkers)),
    total_pint_spend: numFromDb(rawExtra?.total_pint_spend),
    my_pint_spend: numFromDb(rawExtra?.my_pint_spend),
  };

  const { data: placeRow, error: placeErr } = await supabase
    .from("pub_place_details")
    .select("*")
    .eq("bar_key", barKey)
    .maybeSingle();

  const nowIso = new Date().toISOString();
  const { data: comps, error: compErr } = await supabase
    .from("competitions")
    .select("id, title, starts_at, ends_at")
    .eq("linked_bar_key", barKey)
    .gt("ends_at", nowIso)
    .order("ends_at", { ascending: true });

  return {
    barKey,
    bar,
    extra,
    extraError: null as string | null,
    placeDetails: !placeErr
      ? ((placeRow ?? null) as PubPlaceRow | null)
      : null,
    linkedCompetitions: !compErr ? ((comps ?? []) as LinkedCompetition[]) : [],
  };
}

const fieldClass = `w-full rounded-lg border ${pubStroke} bg-guinness-black/60 px-3 py-2 text-sm text-guinness-cream focus:border-guinness-gold focus:outline-none focus:ring-1 focus:ring-guinness-gold/40`;

function formatSpend(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function DirectorySection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <h3 className="type-label text-guinness-gold">{title}</h3>
      <div className="mt-2 text-sm leading-relaxed text-guinness-tan/90">
        {children}
      </div>
    </div>
  );
}

export default function PubDetail() {
  const {
    barKey,
    bar,
    extra,
    extraError,
    placeDetails,
    linkedCompetitions,
  } = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();

  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [favId, setFavId] = useState<string | null>(null);
  const [favBusy, setFavBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [toastOk, setToastOk] = useState(true);

  const [openingHours, setOpeningHours] = useState(
    placeDetails?.opening_hours ?? "",
  );
  const [guinnessInfo, setGuinnessInfo] = useState(
    placeDetails?.guinness_info ?? "",
  );
  const [promotions, setPromotions] = useState(
    placeDetails?.alcohol_promotions ?? "",
  );
  const [mapsPlaceUrl, setMapsPlaceUrl] = useState(
    placeDetails?.maps_place_url ?? "",
  );
  const [directoryBusy, setDirectoryBusy] = useState(false);

  useEffect(() => {
    setOpeningHours(placeDetails?.opening_hours ?? "");
    setGuinnessInfo(placeDetails?.guinness_info ?? "");
    setPromotions(placeDetails?.alcohol_promotions ?? "");
    setMapsPlaceUrl(placeDetails?.maps_place_url ?? "");
  }, [placeDetails]);

  const canEditPubDirectory = useMemo(
    () => isPubDirectoryAdmin(userEmail),
    [userEmail],
  );

  const loadFav = useCallback(async (uid: string) => {
    const { data: rows } = await supabase
      .from("user_favorite_bars")
      .select("id, bar_name")
      .eq("user_id", uid);
    const match = (rows ?? []).find(
      (r) => r.bar_name.trim().toLowerCase() === barKey,
    );
    setFavId(match?.id ?? null);
  }, [barKey]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      const uid = data.user?.id ?? null;
      setUserId(uid);
      setUserEmail(data.user?.email ?? null);
      if (uid) await loadFav(uid);
      else setFavId(null);
    }
    void run();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void run();
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [loadFav]);

  async function toggleFavorite() {
    setToast(null);
    if (!userId) {
      setToastOk(false);
      setToast("Sign in from Profile to save favorites.");
      return;
    }
    setFavBusy(true);
    try {
      if (favId) {
        const { error } = await supabase
          .from("user_favorite_bars")
          .delete()
          .eq("id", favId);
        if (error) {
          setToastOk(false);
          setToast(error.message);
          return;
        }
        setFavId(null);
        setToastOk(true);
        setToast("Removed from favorites.");
      } else {
        const { data, error } = await supabase
          .from("user_favorite_bars")
          .insert({
            user_id: userId,
            bar_name: bar.display_name,
            bar_address: bar.sample_address,
          })
          .select("id")
          .single();
        if (error) {
          setToastOk(false);
          setToast(error.message);
          return;
        }
        if (data?.id) setFavId(data.id as string);
        setToastOk(true);
        setToast("Saved to favorites.");
      }
    } finally {
      setFavBusy(false);
    }
  }

  async function saveDirectory(e: FormEvent) {
    e.preventDefault();
    setToast(null);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setToastOk(false);
      setToast("Sign in to update pub details.");
      return;
    }
    if (!isPubDirectoryAdmin(auth.user.email)) {
      setToastOk(false);
      setToast("Only the site admin can update pub directory details.");
      return;
    }
    setDirectoryBusy(true);
    try {
      const payload = {
        bar_key: barKey,
        opening_hours: openingHours.trim() || null,
        guinness_info: guinnessInfo.trim() || null,
        alcohol_promotions: promotions.trim() || null,
        maps_place_url: mapsPlaceUrl.trim() || null,
        updated_by: auth.user.id,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("pub_place_details").upsert(
        payload,
        { onConflict: "bar_key" },
      );
      if (error) {
        setToastOk(false);
        setToast(error.message);
        return;
      }
      setToastOk(true);
      setToast("Pub details saved. Thanks for helping the community.");
      revalidator.revalidate();
    } finally {
      setDirectoryBusy(false);
    }
  }

  const mapsHref = useMemo(() => mapsSearchUrl(bar), [bar]);
  const customMapsHref = mapsPlaceUrl.trim();
  const mapSearchQuery = useMemo(
    () => [bar.display_name, bar.sample_address].filter(Boolean).join(", "),
    [bar.display_name, bar.sample_address],
  );

  return (
    <main className="min-h-screen bg-guinness-black text-guinness-cream">
      <div className={pageShellClass}>
        <PageHeader
          title={bar.display_name}
          description="Community pours, ratings, and optional pub notes."
        >
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              disabled={favBusy}
              onClick={() => void toggleFavorite()}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50 ${
                favId
                  ? "border-guinness-gold/50 bg-guinness-gold/15 text-guinness-gold"
                  : `${pubStroke} text-guinness-tan hover:border-guinness-gold/35 hover:text-guinness-cream`
              }`}
            >
              {favBusy ? "…" : favId ? "Saved" : "Favorite"}
            </button>
            <Link
              to="/pubs"
              viewTransition
              className={pageHeaderActionButtonClass}
            >
              All pubs
            </Link>
          </div>
        </PageHeader>

        {toast ? (
          <p
            className={`type-meta mb-4 rounded-lg border px-3 py-2 ${pubStroke} ${
              toastOk
                ? "bg-emerald-500/[0.08] text-emerald-200/95"
                : "bg-red-500/[0.08] text-red-200/95"
            }`}
          >
            {toast}
          </p>
        ) : null}

        {extraError ? (
          <p className={`type-meta mb-4 rounded-lg border ${pubStroke} bg-guinness-brown/30 px-3 py-2 text-amber-200/90`}>
            Could not load pour spend stats ({extraError}). Apply migration{" "}
            <code className="rounded bg-guinness-black/60 px-1 text-guinness-gold">
              20260328260000_pub_details_and_comp_bar_link
            </code>
            .
          </p>
        ) : null}

        <div className="flex flex-col gap-8 lg:grid lg:grid-cols-12 lg:items-start lg:gap-8">
          {/* Mobile: map & location first; desktop: right column */}
          <aside className="order-1 space-y-4 lg:order-none lg:sticky lg:top-24 lg:col-span-5 lg:self-start">
            <section className={pubPanel} aria-labelledby="pub-location-heading">
              <h2
                id="pub-location-heading"
                className="type-card-title mb-1 text-guinness-gold"
              >
                Location & map
              </h2>
              <p className="type-meta mb-3 text-guinness-tan/70">
                Pulled from community pour data; embedded map uses Google Maps
                when your API key has{" "}
                <span className="text-guinness-cream">Maps Embed API</span>{" "}
                enabled.
              </p>
              {bar.sample_address ? (
                <p className="mb-3 text-sm leading-relaxed text-guinness-cream">
                  {bar.sample_address}
                </p>
              ) : (
                <p className="type-meta mb-3 text-guinness-tan/55">
                  No saved address yet — map search uses the pub name only.
                </p>
              )}

              <PubGoogleMapEmbed
                searchQuery={mapSearchQuery}
                title={`Map: ${bar.display_name}`}
              />

              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  href={mapsHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={pageHeaderActionButtonClass}
                >
                  Open in Google Maps
                </a>
                {customMapsHref ? (
                  <a
                    href={customMapsHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex min-h-11 items-center justify-center rounded-lg border ${pubStroke} bg-guinness-black/30 px-4 py-2 text-sm font-semibold text-guinness-gold hover:bg-guinness-brown/40`}
                  >
                    Community link
                  </a>
                ) : null}
              </div>
            </section>

            <section
              className={pubPanel}
              aria-labelledby="pub-comps-aside-heading"
            >
              <h2
                id="pub-comps-aside-heading"
                className="type-card-title mb-3 text-guinness-gold"
              >
                Competitions
              </h2>
              {linkedCompetitions.length === 0 ? (
                <p className="type-meta text-guinness-tan/65">
                  No active competition linked. Organizers can attach this pub
                  when creating or editing a comp.
                </p>
              ) : (
                <ul className="space-y-2">
                  {linkedCompetitions.map((c) => (
                    <li key={c.id}>
                      <Link
                        to={`/competitions/${c.id}`}
                        viewTransition
                        className={`block rounded-xl border ${pubStroke} bg-guinness-black/25 px-3 py-2.5 transition-colors hover:border-guinness-gold/35 hover:bg-guinness-brown/40 sm:px-4 sm:py-3`}
                      >
                        <span className="font-semibold text-guinness-gold">
                          {c.title}
                        </span>
                        <span className="type-meta mt-0.5 block text-guinness-tan/65">
                          Ends {new Date(c.ends_at).toLocaleString()}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>

          <div className="order-2 space-y-8 lg:order-none lg:col-span-7">
            <section
              className={pubPanel}
              aria-labelledby="pub-stats-heading"
            >
              <h2
                id="pub-stats-heading"
                className="type-card-title mb-1 text-guinness-gold"
              >
                Pour activity
              </h2>
              <p className="type-meta mb-4 text-guinness-tan/65">
                Ratings and spend from scores tagged with this pub name.
              </p>

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                <div className={pubPanelMuted}>
                  <p className="type-meta text-guinness-tan/65">
                    Avg pour rating
                  </p>
                  <p className="mt-1 text-lg font-semibold text-guinness-gold sm:text-xl">
                    {bar.rating_count > 0 && bar.avg_pour_rating != null
                      ? `${bar.avg_pour_rating.toFixed(1)} / 5`
                      : "—"}
                  </p>
                  {bar.rating_count > 0 ? (
                    <p className="type-meta mt-1 text-guinness-tan/50">
                      {bar.rating_count} rated pour
                      {bar.rating_count === 1 ? "" : "s"}
                    </p>
                  ) : (
                    <p className="type-meta mt-1 text-guinness-tan/50">
                      No ratings yet
                    </p>
                  )}
                </div>
                <div className={pubPanelMuted}>
                  <p className="type-meta text-guinness-tan/65">Pours</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-guinness-cream sm:text-xl">
                    {bar.submission_count}
                  </p>
                  <p className="type-meta mt-1 text-guinness-tan/50">
                    Recorded here
                  </p>
                </div>
                <div className={pubPanelMuted}>
                  <p className="type-meta text-guinness-tan/65">Pouring</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-guinness-cream sm:text-xl">
                    {extra.distinct_drinkers}
                  </p>
                  <p className="type-meta mt-1 text-guinness-tan/50">
                    Distinct people (approx.)
                  </p>
                </div>
                <div className={pubPanelMuted}>
                  <p className="type-meta text-guinness-tan/65">Community $</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-guinness-gold sm:text-xl">
                    {formatSpend(extra.total_pint_spend)}
                  </p>
                  <p className="type-meta mt-1 text-guinness-tan/50">
                    Prices entered on pours
                  </p>
                </div>
                <div className="col-span-2 lg:col-span-2">
                  <div className={pubPanelMuted}>
                    <p className="type-meta text-guinness-tan/65">
                      Your spend
                    </p>
                    <p className="mt-1 text-lg font-semibold tabular-nums text-guinness-cream sm:text-xl">
                      {userId ? formatSpend(extra.my_pint_spend) : "—"}
                    </p>
                    <p className="type-meta mt-1 text-guinness-tan/50">
                      {userId
                        ? "Your pours with a price, this pub."
                        : "Sign in to see your total."}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section
              className={pubPanel}
              aria-labelledby="pub-directory-heading"
            >
              <h2
                id="pub-directory-heading"
                className="type-card-title mb-1 text-guinness-gold"
              >
                Hours, Guinness & promos
              </h2>
              <p className="type-meta mb-4 text-guinness-tan/70">
                Community notes — visible to everyone.
                {canEditPubDirectory
                  ? " You can edit using the form below."
                  : " Updates are managed by the team."}
              </p>

              <DirectorySection title="Opening hours">
                {placeDetails?.opening_hours?.trim() ? (
                  <p className="whitespace-pre-wrap">
                    {placeDetails.opening_hours.trim()}
                  </p>
                ) : (
                  <p className="text-guinness-tan/55">Nothing added yet.</p>
                )}
              </DirectorySection>
              <div className={`${pubDivider} mt-5 pt-5`}>
                <DirectorySection title="Guinness">
                  {placeDetails?.guinness_info?.trim() ? (
                    <p className="whitespace-pre-wrap">
                      {placeDetails.guinness_info.trim()}
                    </p>
                  ) : (
                    <p className="text-guinness-tan/55">
                      Taps, pour quality, nitro — add below.
                    </p>
                  )}
                </DirectorySection>
              </div>
              <div className={`${pubDivider} mt-5 pt-5`}>
                <DirectorySection title="Promotions & drinks">
                  {placeDetails?.alcohol_promotions?.trim() ? (
                    <p className="whitespace-pre-wrap">
                      {placeDetails.alcohol_promotions.trim()}
                    </p>
                  ) : (
                    <p className="text-guinness-tan/55">Nothing added yet.</p>
                  )}
                </DirectorySection>
              </div>
            </section>

            {canEditPubDirectory ? (
              <form
                onSubmit={(ev) => void saveDirectory(ev)}
                className={pubPanel}
              >
                <h3 className="type-card-title mb-1 text-guinness-gold">
                  Update pub details
                </h3>
                <p className="type-meta mb-4 text-guinness-tan/65">
                  Admin only. Same fields as the directory above.
                </p>
                <div className="space-y-3">
                  <label className="block">
                    <span className="type-meta mb-1 block text-guinness-tan/75">
                      Opening hours
                    </span>
                    <textarea
                      value={openingHours}
                      onChange={(e) => setOpeningHours(e.target.value)}
                      rows={3}
                      className={fieldClass}
                      placeholder="e.g. Mon–Thu 4pm–12am, Fri–Sun 2pm–1am"
                    />
                  </label>
                  <label className="block">
                    <span className="type-meta mb-1 block text-guinness-tan/75">
                      Guinness & pour notes
                    </span>
                    <textarea
                      value={guinnessInfo}
                      onChange={(e) => setGuinnessInfo(e.target.value)}
                      rows={3}
                      className={fieldClass}
                      placeholder="How’s the Guinness here?"
                    />
                  </label>
                  <label className="block">
                    <span className="type-meta mb-1 block text-guinness-tan/75">
                      Promotions & other drinks
                    </span>
                    <textarea
                      value={promotions}
                      onChange={(e) => setPromotions(e.target.value)}
                      rows={3}
                      className={fieldClass}
                      placeholder="Happy hour, other stouts, etc."
                    />
                  </label>
                  <label className="block">
                    <span className="type-meta mb-1 block text-guinness-tan/75">
                      Custom Maps URL (optional)
                    </span>
                    <input
                      type="url"
                      value={mapsPlaceUrl}
                      onChange={(e) => setMapsPlaceUrl(e.target.value)}
                      className={fieldClass}
                      placeholder="https://maps.app.goo.gl/…"
                    />
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={directoryBusy}
                  className="mt-4 rounded-lg bg-guinness-gold px-4 py-2.5 text-sm font-semibold text-guinness-black hover:bg-guinness-tan disabled:opacity-50"
                >
                  {directoryBusy ? "Saving…" : "Save pub details"}
                </button>
              </form>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
