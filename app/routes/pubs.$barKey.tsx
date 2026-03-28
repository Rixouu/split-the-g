import {
  data,
  Link,
  useFetcher,
  useLoaderData,
  useNavigate,
  useRevalidator,
} from "react-router";
import type { ActionFunctionArgs } from "react-router";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
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
import { competitionDetailPath } from "~/utils/competitionPath";
import { supabase } from "~/utils/supabase";
import {
  fetchPlaceDetailsForDirectoryImport,
  resolveGoogleMapsKeyForServer,
  resolvePlaceIdForPubImport,
} from "~/utils/googlePlaceDetails";
import {
  pubDetailPath,
  resolveBarKeyFromPubPathSegment,
} from "~/utils/pubPath";
import type { loader as pubDetailLoader } from "./pubs.$barKey.loader";
import {
  PUB_WALL_PAGE_LIMIT,
  isPubDirectoryAdmin,
  mapsSearchUrl,
  normalizeBarKeyInput,
  pubDivider,
  pubPanel,
  pubPanelShell,
  pubPanelMuted,
  pubStroke,
} from "./pubs.$barKey.shared";

export { loader } from "./pubs.$barKey.loader";
const PubWallTab = lazy(async () => {
  const mod = await import("~/components/pub/PubWallTab");
  return { default: mod.PubWallTab };
});


type ImportGoogleActionData =
  | {
      ok: true;
      placeId: string;
      name: string | null;
      formattedAddress: string | null;
      weekdayLines: string[] | null;
      mapsUrl: string | null;
    }
  | { ok: false; message?: string };

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return data({ ok: false, message: "Method not allowed" } satisfies ImportGoogleActionData, {
      status: 405,
    });
  }

  const formData = await request.formData();
  if (formData.get("intent") !== "importGooglePlace") {
    return data({ ok: false, message: "Invalid action" } satisfies ImportGoogleActionData, {
      status: 400,
    });
  }

  const accessToken = String(formData.get("accessToken") ?? "").trim();
  const placeInput = String(formData.get("placeInput") ?? "").trim();
  const barFallback = String(formData.get("barGooglePlaceId") ?? "").trim();
  const barDisplayName = String(formData.get("barDisplayName") ?? "").trim();
  const barSampleAddress = String(formData.get("barSampleAddress") ?? "").trim();

  if (!accessToken) {
    return data({ ok: false, message: "Sign in to import." } satisfies ImportGoogleActionData, {
      status: 401,
    });
  }

  const { data: userData, error: userErr } =
    await supabase.auth.getUser(accessToken);
  const email = userData.user?.email;
  if (userErr || !isPubDirectoryAdmin(email)) {
    return data({ ok: false, message: "Admin only." } satisfies ImportGoogleActionData, {
      status: 403,
    });
  }

  const mapsKey = resolveGoogleMapsKeyForServer();
  if (!mapsKey) {
    return data({
      ok: false,
      message:
        "Missing VITE_GOOGLE_MAPS_API_KEY or GOOGLE_MAPS_SERVER_KEY on the server.",
    } satisfies ImportGoogleActionData);
  }

  const pasteBlob = [placeInput, barFallback].filter(Boolean).join("\n").trim();
  const resolved = await resolvePlaceIdForPubImport(
    pasteBlob,
    mapsKey,
    barDisplayName
      ? {
          displayName: barDisplayName,
          sampleAddress: barSampleAddress || null,
        }
      : null,
  );

  if (!resolved.ok) {
    return data({
      ok: false,
      message: resolved.message,
    } satisfies ImportGoogleActionData);
  }

  const fetched = await fetchPlaceDetailsForDirectoryImport(
    resolved.placeId,
    mapsKey,
  );
  if (!fetched.ok) {
    return data({
      ok: false,
      message: fetched.message ?? `Google: ${fetched.status}`,
    } satisfies ImportGoogleActionData);
  }

  const d = fetched.data;
  return data({
    ok: true,
    placeId: d.placeId,
    name: d.name,
    formattedAddress: d.formattedAddress,
    weekdayLines: d.weekdayLines,
    mapsUrl: d.mapsUrl,
  } satisfies ImportGoogleActionData);
}

const fieldClass = `w-full rounded-lg border ${pubStroke} bg-guinness-black/60 px-3 py-2.5 text-sm leading-relaxed text-guinness-cream placeholder:text-guinness-tan/35 focus:border-guinness-gold focus:outline-none focus:ring-1 focus:ring-guinness-gold/40`;
const fieldTextareaClass = `${fieldClass} min-h-[7.5rem] resize-y sm:min-h-[8.5rem]`;
const fieldInputClass = `${fieldClass} min-h-11`;

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

/** Google `weekday_text` lines are typically `Monday: 9:00 AM – 5:00 PM`. */
function parseWeekdayHoursLine(
  line: string,
): { day: string; hours: string } | null {
  const idx = line.indexOf(":");
  if (idx <= 0) return null;
  const day = line.slice(0, idx).trim();
  const hours = line.slice(idx + 1).trim();
  if (!day || !hours) return null;
  return { day, hours };
}

function weekdayLabelTodayEnUs(): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(
    new Date(),
  );
}

function isSameWeekdayLabel(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function PubOpeningHoursReadOnly({
  googleOpeningHoursLines,
}: {
  googleOpeningHoursLines: string[] | null;
}) {
  const todayLabel = weekdayLabelTodayEnUs();

  if (googleOpeningHoursLines && googleOpeningHoursLines.length > 0) {
    return (
      <div className={`mt-1 border-t ${pubStroke} pt-4`}>
        <ul
          className={`list-none overflow-hidden rounded-xl border ${pubStroke} bg-guinness-black/40 shadow-[inset_0_1px_0_rgba(212,175,55,0.04)]`}
          aria-label="Weekly opening hours"
        >
          {googleOpeningHoursLines.map((line, i) => {
            const parsed = parseWeekdayHoursLine(line);
            const isToday =
              parsed != null &&
              isSameWeekdayLabel(parsed.day, todayLabel);
            const rowBase = `grid gap-x-4 border-b ${pubStroke} px-3 py-2.5 last:border-b-0 sm:px-4 sm:py-3`;
            const rowToday =
              "bg-guinness-gold/[0.07] ring-1 ring-inset ring-guinness-gold/20";
            return (
              <li
                key={`${i}-${line}`}
                className={
                  parsed
                    ? `${rowBase} grid-cols-1 sm:grid-cols-[minmax(5.5rem,1fr)_minmax(0,auto)] sm:items-baseline ${isToday ? rowToday : ""}`
                    : `${rowBase} ${isToday ? rowToday : ""}`
                }
                aria-current={isToday ? "true" : undefined}
              >
                {parsed ? (
                  <>
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span
                        className={`text-sm font-semibold tracking-tight ${isToday ? "text-guinness-gold" : "text-guinness-tan/88"}`}
                      >
                        {parsed.day}
                      </span>
                      {isToday ? (
                        <span className="type-meta shrink-0 rounded-md bg-guinness-gold/15 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-guinness-gold/90">
                          Today
                        </span>
                      ) : null}
                      <span
                        className={`basis-full text-sm tabular-nums leading-snug sm:hidden ${isToday ? "text-guinness-cream" : "text-guinness-cream/95"}`}
                      >
                        {parsed.hours}
                      </span>
                    </div>
                    <span
                      className={`hidden text-right text-sm tabular-nums leading-snug sm:block ${isToday ? "text-guinness-cream" : "text-guinness-cream/95"}`}
                    >
                      {parsed.hours}
                    </span>
                  </>
                ) : (
                  <div className="flex gap-3 text-sm leading-snug text-guinness-cream/95">
                    <span
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-guinness-gold/65"
                      aria-hidden
                    />
                    <span>{line}</span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <div
      className={`mt-1 rounded-xl border border-dashed ${pubStroke} bg-guinness-black/25 px-3 py-4 text-center sm:px-4`}
    >
      <p className="type-meta leading-relaxed text-guinness-tan/55">
        No linked listing hours yet. Add a Google Place ID or use admin import —
        visitors see hours from the business listing when available.
      </p>
    </div>
  );
}

function IconPubFavoriteHeart({
  className = "",
  filled,
}: {
  className?: string;
  filled: boolean;
}) {
  if (filled) {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden
      >
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
      </svg>
    );
  }
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.35l7.78-8.49 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
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
    googleOpeningHoursLines,
    wallPours,
    wallError,
  } = useLoaderData<typeof pubDetailLoader>();
  const revalidator = useRevalidator();
  const navigate = useNavigate();
  const importFetcher = useFetcher<ImportGoogleActionData>();
  const lastImportHandledKey = useRef<string | null>(null);

  useEffect(() => {
    lastImportHandledKey.current = null;
  }, [barKey]);

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
  const [directoryGooglePlaceId, setDirectoryGooglePlaceId] = useState(
    placeDetails?.google_place_id ?? "",
  );
  /** Written to every pour (scores) for this pub; import pre-fills from Google. */
  const [canonicalBarName, setCanonicalBarName] = useState(bar.display_name);
  const [canonicalBarAddress, setCanonicalBarAddress] = useState(
    bar.sample_address ?? "",
  );
  const [mergeTargetBarKey, setMergeTargetBarKey] = useState("");
  const [mergeBusy, setMergeBusy] = useState(false);
  /** Collapsed by default — admin-only merge tool. */
  const [mergeSectionOpen, setMergeSectionOpen] = useState(false);
  const [directoryBusy, setDirectoryBusy] = useState(false);

  const [pubTab, setPubTab] = useState<"promos" | "competitions" | "wall">(
    "promos",
  );

  useEffect(() => {
    if (importFetcher.state !== "idle" || importFetcher.data == null) return;
    const key = JSON.stringify(importFetcher.data);
    if (lastImportHandledKey.current === key) return;
    lastImportHandledKey.current = key;

    const d = importFetcher.data;
    if (d.ok) {
      if (d.weekdayLines?.length) setOpeningHours(d.weekdayLines.join("\n"));
      if (d.mapsUrl) setMapsPlaceUrl(d.mapsUrl);
      if (d.placeId) setDirectoryGooglePlaceId(d.placeId);
      if (d.name?.trim()) setCanonicalBarName(d.name.trim());
      if (d.formattedAddress?.trim())
        setCanonicalBarAddress(d.formattedAddress.trim());
      setToastOk(true);
      const bits = [d.name, d.formattedAddress].filter(Boolean).join(" — ");
      const hoursMsg = d.weekdayLines?.length
        ? "Review pub name / address below, then Save pub details to update pour records."
        : "Google did not return opening-hour lines for this listing (some venues omit them in the API). Name, address, Place ID, and Maps link were filled where available — add hours manually if needed, then save.";
      setToast(bits ? `Imported: ${bits}. ${hoursMsg}` : `Imported from Google. ${hoursMsg}`);
    } else {
      setToastOk(false);
      setToast(d.message ?? "Could not import from Google.");
    }
  }, [importFetcher.state, importFetcher.data]);

  useEffect(() => {
    setOpeningHours(placeDetails?.opening_hours ?? "");
    setGuinnessInfo(placeDetails?.guinness_info ?? "");
    setPromotions(placeDetails?.alcohol_promotions ?? "");
    setMapsPlaceUrl(placeDetails?.maps_place_url ?? "");
    setDirectoryGooglePlaceId(placeDetails?.google_place_id ?? "");
  }, [placeDetails]);

  useEffect(() => {
    setCanonicalBarName(bar.display_name);
    setCanonicalBarAddress(bar.sample_address ?? "");
  }, [bar.display_name, bar.sample_address, barKey]);

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
      const nameTrim = canonicalBarName.trim();
      if (!nameTrim) {
        setToastOk(false);
        setToast("Pub name on pours is required.");
        return;
      }
      const addrTrim = canonicalBarAddress.trim();
      const placeTrim = directoryGooglePlaceId.trim();

      const { data: rpcData, error: rpcError } = await supabase.rpc(
        "admin_apply_pub_canonical_on_scores",
        {
          p_current_bar_key: barKey,
          p_bar_name: nameTrim,
          p_bar_address: addrTrim || null,
          p_google_place_id: placeTrim || null,
        },
      );

      if (rpcError) {
        setToastOk(false);
        const msg = `${rpcError.message ?? ""} ${rpcError.code ?? ""}`.toLowerCase();
        setToast(
          rpcError.code === "42883" || msg.includes("admin_apply_pub_canonical")
            ? "Run migration 20260328310000_admin_pub_canonical_merge (admin_apply_pub_canonical_on_scores)."
            : (rpcError.message ?? "Could not update pour records."),
        );
        return;
      }

      const rpcRow = Array.isArray(rpcData) ? rpcData[0] : rpcData;
      const newBarKey = String(
        (rpcRow as { new_bar_key?: string } | null)?.new_bar_key ?? barKey,
      ).trim();

      const payload = {
        bar_key: newBarKey,
        opening_hours: openingHours.trim() || null,
        guinness_info: guinnessInfo.trim() || null,
        alcohol_promotions: promotions.trim() || null,
        maps_place_url: mapsPlaceUrl.trim() || null,
        google_place_id: placeTrim || null,
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
      if (newBarKey !== barKey) {
        navigate(pubDetailPath(newBarKey), { replace: true, viewTransition: true });
      }
      revalidator.revalidate();
    } finally {
      setDirectoryBusy(false);
    }
  }

  async function mergeIntoTargetPub() {
    setToast(null);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setToastOk(false);
      setToast("Sign in to merge pubs.");
      return;
    }
    if (!isPubDirectoryAdmin(auth.user.email)) {
      setToastOk(false);
      setToast("Only the site admin can merge pubs.");
      return;
    }
    const pasted = normalizeBarKeyInput(mergeTargetBarKey);
    if (!pasted) {
      setToastOk(false);
      setToast("Paste the target pub’s bar key (from its URL after /pubs/).");
      return;
    }
    const tgt = await resolveBarKeyFromPubPathSegment(supabase, pasted);
    if (!tgt) {
      setToastOk(false);
      setToast("Could not find that pub — check the URL segment after /pubs/.");
      return;
    }
    if (tgt === barKey) {
      setToastOk(false);
      setToast("Choose a different pub to merge into.");
      return;
    }
    setMergeBusy(true);
    try {
      const { error } = await supabase.rpc("admin_merge_pub_into_target", {
        p_source_bar_key: barKey,
        p_target_bar_key: tgt,
      });
      if (error) {
        setToastOk(false);
        const msg = `${error.message ?? ""} ${error.code ?? ""}`.toLowerCase();
        setToast(
          error.code === "42883" || msg.includes("admin_merge_pub_into_target")
            ? "Run migration 20260328310000_admin_pub_canonical_merge (admin_merge_pub_into_target)."
            : (error.message ?? "Merge failed."),
        );
        return;
      }
      setToastOk(true);
      setToast("Merged into target pub. Redirecting…");
      setMergeTargetBarKey("");
      navigate(pubDetailPath(tgt), { replace: true, viewTransition: true });
      revalidator.revalidate();
    } finally {
      setMergeBusy(false);
    }
  }

  async function submitImportFromGoogle() {
    setToast(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setToastOk(false);
      setToast("Sign in to import.");
      return;
    }
    const placeInput = [directoryGooglePlaceId, mapsPlaceUrl]
      .map((s) => s.trim())
      .filter(Boolean)
      .join("\n");
    const fd = new FormData();
    fd.set("intent", "importGooglePlace");
    fd.set("accessToken", token);
    fd.set("placeInput", placeInput);
    fd.set("barGooglePlaceId", bar.google_place_id ?? "");
    fd.set("barDisplayName", bar.display_name);
    fd.set("barSampleAddress", bar.sample_address ?? "");
    importFetcher.submit(fd, { method: "post" });
  }

  const mapsHref = useMemo(() => mapsSearchUrl(bar), [bar]);
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
              aria-busy={favBusy}
              aria-pressed={Boolean(favId)}
              onClick={() => void toggleFavorite()}
              className={`inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-lg border-2 px-4 py-2.5 text-sm font-semibold transition-[color,background-color,border-color,box-shadow] duration-200 disabled:pointer-events-none disabled:opacity-60 sm:w-auto ${
                favId
                  ? "border-guinness-gold/70 bg-guinness-gold/20 text-guinness-gold shadow-[inset_0_1px_0_rgba(212,175,55,0.14)] hover:border-guinness-gold hover:bg-guinness-gold/28 active:scale-[0.98]"
                  : `border-guinness-gold/45 bg-guinness-black/50 text-guinness-cream hover:border-guinness-gold hover:bg-guinness-gold/10 hover:text-guinness-gold active:scale-[0.98]`
              }`}
            >
              <IconPubFavoriteHeart
                filled={Boolean(favId)}
                className="h-4 w-4 shrink-0 sm:h-[1.125rem] sm:w-[1.125rem]"
              />
              <span>{favBusy ? "…" : favId ? "Saved" : "Favorite"}</span>
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

        <div className="flex flex-col gap-8 lg:grid lg:grid-cols-12 lg:items-start lg:gap-x-8 lg:gap-y-8 xl:gap-x-10">
          {/* Mobile: map & location first; desktop: narrower sidebar, more room for wall/tabs */}
          <aside className="order-1 space-y-5 lg:order-none lg:sticky lg:top-24 lg:col-span-4 lg:self-start">
            <section className={pubPanel} aria-labelledby="pub-location-heading">
              <h2
                id="pub-location-heading"
                className="type-card-title mb-1 text-guinness-gold"
              >
                Location & map
              </h2>
              <p className="type-meta mb-3 text-guinness-tan/70">
                Location reflects where the community has poured at this pub. Use
                the map to preview the area, or open Google Maps for directions
                and the full listing.
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
              </div>
            </section>

            <section
              className={pubPanel}
              aria-labelledby="pub-hours-aside-heading"
            >
              <h2
                id="pub-hours-aside-heading"
                className="type-card-title mb-1 text-guinness-gold"
              >
                Opening hours
              </h2>
              <p className="type-meta mb-3 text-guinness-tan/70">
                Hours from the linked Google Business Profile listing.
              </p>
              <PubOpeningHoursReadOnly
                googleOpeningHoursLines={googleOpeningHoursLines}
              />
            </section>
          </aside>

          <div className="order-2 min-w-0 space-y-8 lg:order-none lg:col-span-8">
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

            <div className={`${pubPanelShell} min-w-0`}>
              <div
                className="mb-5 w-full min-w-0 border-b border-[#322914] pb-4"
                role="tablist"
                aria-label="Pub sections"
              >
                <div className="grid w-full min-w-0 grid-cols-3 gap-2 sm:gap-3">
                  {(
                    [
                      ["promos", "Promos"],
                      ["competitions", "Competitions"],
                      ["wall", "Wall"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      id={`pub-section-tab-${id}`}
                      role="tab"
                      aria-selected={pubTab === id}
                      aria-controls="pub-section-panel"
                      className={`min-h-11 w-full min-w-0 rounded-lg px-2 py-2.5 text-center text-xs font-semibold leading-tight transition-colors sm:min-h-12 sm:px-3 sm:text-sm ${
                        pubTab === id
                          ? "bg-guinness-gold text-guinness-black shadow-[0_0_0_1px_rgba(212,175,55,0.35)]"
                          : `border ${pubStroke} bg-guinness-black/30 text-guinness-tan/90 hover:border-guinness-gold/30 hover:bg-guinness-brown/35 hover:text-guinness-cream`
                      }`}
                      onClick={() => setPubTab(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div
                id="pub-section-panel"
                role="tabpanel"
                aria-labelledby={`pub-section-tab-${pubTab}`}
                className="min-w-0"
              >
              {pubTab === "promos" ? (
                <>
                <section aria-labelledby="pub-directory-heading">
                  <h2
                    id="pub-directory-heading"
                    className="type-card-title mb-1 text-guinness-gold"
                  >
                    Guinness & promos
                  </h2>
                  <p className="type-meta mb-4 text-guinness-tan/70">
                    Community notes — visible to everyone.
                    {canEditPubDirectory
                      ? " Edit notes below. Listing hours appear in the left column when Google is linked."
                      : " Updates are managed by the team."}
                  </p>

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
                    className={`mt-6 ${pubPanel}`}
                  >
                    <h3 className="type-card-title mb-1 text-guinness-gold">
                      Update pub details
                    </h3>
                    <p className="type-meta mb-6 text-guinness-tan/65">
                      Admin only. Import fills Google fields and the pour name/address
                      below — saving updates every score tagged with this pub and moves
                      directory data if the normalized name changes.
                    </p>

                    <div className="space-y-8">
                      <div
                        className={`grid gap-5 rounded-xl border ${pubStroke} bg-guinness-black/20 p-4 sm:grid-cols-2 sm:gap-6 sm:p-5`}
                      >
                        <div className="space-y-2 sm:min-w-0">
                          <label
                            htmlFor="pub-admin-canonical-name"
                            className="type-meta block text-guinness-tan/80"
                          >
                            Pub name on pours
                          </label>
                          <p className="type-meta text-guinness-tan/45">
                            Must match one another on every pour for this listing.
                            Import sets this from Google; edit if needed before save.
                          </p>
                          <input
                            id="pub-admin-canonical-name"
                            type="text"
                            value={canonicalBarName}
                            onChange={(e) => setCanonicalBarName(e.target.value)}
                            className={fieldInputClass}
                            autoComplete="off"
                          />
                        </div>
                        <div className="space-y-2 sm:min-w-0">
                          <label
                            htmlFor="pub-admin-canonical-address"
                            className="type-meta block text-guinness-tan/80"
                          >
                            Address on pours
                          </label>
                          <p className="type-meta text-guinness-tan/45">
                            Shown on the pub card and map search. Leave empty to keep
                            existing addresses on each pour unchanged.
                          </p>
                          <input
                            id="pub-admin-canonical-address"
                            type="text"
                            value={canonicalBarAddress}
                            onChange={(e) => setCanonicalBarAddress(e.target.value)}
                            className={fieldInputClass}
                            placeholder="From Google import or type manually"
                            autoComplete="street-address"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label
                          htmlFor="pub-admin-opening-hours"
                          className="type-meta block text-guinness-tan/80"
                        >
                          Opening hours (admin backup)
                        </label>
                        <p className="type-meta text-guinness-tan/45">
                          Not shown on the public page — visitors only see Google listing
                          hours. Use for internal notes or when Google has no hours.
                        </p>
                        <textarea
                          id="pub-admin-opening-hours"
                          value={openingHours}
                          onChange={(e) => setOpeningHours(e.target.value)}
                          rows={5}
                          className={fieldTextareaClass}
                          placeholder="e.g. Mon–Thu 4pm–12am, Fri–Sun 2pm–1am"
                        />
                      </div>

                      <div
                        className={`grid gap-5 border-t ${pubStroke} pt-6 sm:grid-cols-2 sm:gap-6`}
                      >
                        <div className="space-y-2 sm:min-w-0">
                          <label
                            htmlFor="pub-admin-guinness"
                            className="type-meta block text-guinness-tan/80"
                          >
                            Guinness & pour notes
                          </label>
                          <textarea
                            id="pub-admin-guinness"
                            value={guinnessInfo}
                            onChange={(e) => setGuinnessInfo(e.target.value)}
                            rows={4}
                            className={fieldTextareaClass}
                            placeholder="How’s the Guinness here?"
                          />
                        </div>
                        <div className="space-y-2 sm:min-w-0">
                          <label
                            htmlFor="pub-admin-promos"
                            className="type-meta block text-guinness-tan/80"
                          >
                            Promotions & other drinks
                          </label>
                          <textarea
                            id="pub-admin-promos"
                            value={promotions}
                            onChange={(e) => setPromotions(e.target.value)}
                            rows={4}
                            className={fieldTextareaClass}
                            placeholder="Happy hour, other stouts, etc."
                          />
                        </div>
                      </div>

                      <div
                        className={`space-y-4 rounded-xl border ${pubStroke} bg-guinness-black/25 p-4 sm:p-5`}
                      >
                        <div>
                          <p className="type-label text-guinness-gold">
                            Google listing & import
                          </p>
                          <p className="type-meta mt-1 text-guinness-tan/50">
                            Link the business profile for hours on the left. Classic
                            Places API + server key required for import. Name and address
                            are applied to pour records when you save.
                          </p>
                        </div>

                        <div className="space-y-2">
                          <label
                            htmlFor="pub-admin-place-id"
                            className="type-meta block text-guinness-tan/80"
                          >
                            Google Place ID or Maps URL
                          </label>
                          <input
                            id="pub-admin-place-id"
                            type="text"
                            value={directoryGooglePlaceId}
                            onChange={(e) =>
                              setDirectoryGooglePlaceId(e.target.value)
                            }
                            className={fieldInputClass}
                            placeholder="ChIJ… or paste a full google.com/maps/place/… link"
                            autoComplete="off"
                            spellCheck={false}
                          />
                        </div>

                        <div className="space-y-2">
                          <label
                            htmlFor="pub-admin-maps-url"
                            className="type-meta block text-guinness-tan/80"
                          >
                            Custom Maps URL (optional)
                          </label>
                          <input
                            id="pub-admin-maps-url"
                            type="url"
                            value={mapsPlaceUrl}
                            onChange={(e) => setMapsPlaceUrl(e.target.value)}
                            className={fieldInputClass}
                            placeholder="https://maps.app.goo.gl/…"
                          />
                        </div>

                        <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
                          <button
                            type="button"
                            disabled={
                              importFetcher.state !== "idle" || directoryBusy
                            }
                            onClick={() => void submitImportFromGoogle()}
                            className={`inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border ${pubStroke} bg-guinness-black/40 px-4 py-2.5 text-sm font-semibold text-guinness-gold transition-colors hover:border-guinness-gold/40 hover:bg-guinness-brown/40 disabled:opacity-50`}
                          >
                            {importFetcher.state !== "idle"
                              ? "Importing…"
                              : "Import from Google Maps"}
                          </button>
                          <p className="type-meta max-w-xl text-guinness-tan/50 sm:text-right">
                            Uses Place ID field, custom URL, or pub name. Fills pour
                            name/address fields — then{" "}
                            <span className="text-guinness-tan/70">Save pub details</span>.
                          </p>
                        </div>
                      </div>

                      <div
                        className={`overflow-hidden rounded-xl border border-amber-500/25 bg-amber-500/[0.06]`}
                      >
                        <button
                          type="button"
                          id="pub-admin-merge-disclosure"
                          className="flex w-full min-h-11 items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-guinness-black/20 sm:min-h-[3rem] sm:px-5 sm:py-3.5"
                          aria-expanded={mergeSectionOpen}
                          aria-controls="pub-admin-merge-panel"
                          onClick={() => setMergeSectionOpen((o) => !o)}
                        >
                          <span className="min-w-0">
                            <span className="type-label block text-amber-100/95">
                              Merge duplicate pub
                            </span>
                            <span className="type-meta mt-0.5 block text-guinness-tan/50">
                              Admin only — expand to combine with another listing
                            </span>
                          </span>
                          <svg
                            className={`h-5 w-5 shrink-0 text-amber-200/75 transition-transform duration-200 ${
                              mergeSectionOpen ? "rotate-180" : ""
                            }`}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden
                          >
                            <path d="m6 9 6 6 6-6" />
                          </svg>
                        </button>
                        {mergeSectionOpen ? (
                          <div
                            id="pub-admin-merge-panel"
                            role="region"
                            aria-labelledby="pub-admin-merge-disclosure"
                            className={`space-y-4 border-t border-amber-500/20 px-4 pb-4 pt-3 sm:px-5 sm:pb-5`}
                          >
                            <p className="type-meta text-guinness-tan/55">
                              Use when this page is a manual duplicate of another listing
                              (e.g. “The Old English Pub” vs the full Google name). All
                              pours here are re-tagged to match the target pub; this
                              listing disappears from All pubs.
                            </p>
                            <div className="space-y-2">
                              <label
                                htmlFor="pub-admin-merge-target"
                                className="type-meta block text-guinness-tan/80"
                              >
                                Target bar key (from URL)
                              </label>
                              <input
                                id="pub-admin-merge-target"
                                type="text"
                                value={mergeTargetBarKey}
                                onChange={(e) =>
                                  setMergeTargetBarKey(e.target.value)
                                }
                                className={fieldInputClass}
                                placeholder="e.g. the-old-english-bangkok-british-pub-and-restaurant"
                                autoComplete="off"
                                spellCheck={false}
                              />
                              <p className="type-meta text-guinness-tan/45">
                                Open the canonical pub and copy the path after{" "}
                                <code className="rounded bg-guinness-black/50 px-1 text-guinness-gold/90">
                                  /pubs/
                                </code>{" "}
                                (hyphen slug or legacy name — both work).
                              </p>
                            </div>
                            <button
                              type="button"
                              disabled={mergeBusy || directoryBusy}
                              onClick={() => void mergeIntoTargetPub()}
                              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-amber-500/40 bg-guinness-black/40 px-4 py-2.5 text-sm font-semibold text-amber-100/95 transition-colors hover:border-amber-400/55 hover:bg-guinness-brown/40 disabled:opacity-50"
                            >
                              {mergeBusy ? "Merging…" : "Merge into target pub"}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={directoryBusy}
                      className="mt-8 w-full rounded-lg bg-guinness-gold px-4 py-3 text-sm font-semibold text-guinness-black hover:bg-guinness-tan disabled:opacity-50 sm:w-auto sm:min-w-[12rem]"
                    >
                      {directoryBusy ? "Saving…" : "Save pub details"}
                    </button>
                  </form>
                ) : null}
                </>
              ) : null}

              {pubTab === "competitions" ? (
                <section aria-labelledby="pub-comps-tab-heading">
                  <h2
                    id="pub-comps-tab-heading"
                    className="type-card-title mb-3 text-guinness-gold"
                  >
                    Competitions
                  </h2>
                  {linkedCompetitions.length === 0 ? (
                    <p className="type-meta text-guinness-tan/65">
                      No active competition linked. Organizers can attach this
                      pub when creating or editing a comp.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {linkedCompetitions.map((c) => (
                        <li key={c.id}>
                          <Link
                            to={competitionDetailPath(c)}
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
              ) : null}

              {pubTab === "wall" ? (
                <section className="min-w-0" aria-labelledby="pub-wall-heading">
                  <h2
                    id="pub-wall-heading"
                    className="type-card-title mb-1 text-guinness-gold"
                  >
                    Wall
                  </h2>
                  <p className="type-meta mb-4 text-guinness-tan/70">
                    Pours tagged with this pub — same filters as the main Wall.
                    Showing up to {PUB_WALL_PAGE_LIMIT} most recent.
                  </p>
                  {wallError ? (
                    <p className="type-meta mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-100/90">
                      {wallError}
                    </p>
                  ) : null}
                  <Suspense
                    fallback={
                      <p className="type-meta rounded-lg border border-[#322914] bg-guinness-black/20 px-3 py-2 text-guinness-tan/70">
                        Loading wall...
                      </p>
                    }
                  >
                    <PubWallTab items={wallPours} pubStroke={pubStroke} />
                  </Suspense>
                </section>
              ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
