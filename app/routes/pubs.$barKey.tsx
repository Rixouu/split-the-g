import {
  Await,
  data,
  useFetcher,
  useLoaderData,
  useNavigate,
  useRevalidator,
} from "react-router";
import { AppLink } from "~/i18n/app-link";
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
import { useI18n } from "~/i18n/context";
import { createTranslator } from "~/i18n/load-messages";
import { langFromParams } from "~/i18n/lang-param";
import { seoMetaForRoute } from "~/i18n/seo-meta";
import type { loader as pubDetailLoader } from "./pubs.$barKey.loader";
import { AdSlotBanner } from "~/components/ad-slot-banner";
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
export function meta({
  params,
}: {
  params: { barKey?: string; lang?: string };
}) {
  const barKey = params.barKey?.trim();
  return seoMetaForRoute(
    params,
    barKey ? `/pubs/${encodeURIComponent(barKey)}` : "/pubs",
    "pubDetail",
  );
}
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

export async function action({ request, params }: ActionFunctionArgs) {
  const t = createTranslator(langFromParams(params ?? {}));
  if (request.method !== "POST") {
    return data(
      {
        ok: false,
        message: t("pages.pubDetail.actionMethodNotAllowed"),
      } satisfies ImportGoogleActionData,
      {
        status: 405,
      },
    );
  }

  const formData = await request.formData();
  if (formData.get("intent") !== "importGooglePlace") {
    return data(
      {
        ok: false,
        message: t("pages.pubDetail.actionInvalid"),
      } satisfies ImportGoogleActionData,
      {
        status: 400,
      },
    );
  }

  const accessToken = String(formData.get("accessToken") ?? "").trim();
  const placeInput = String(formData.get("placeInput") ?? "").trim();
  const barFallback = String(formData.get("barGooglePlaceId") ?? "").trim();
  const barDisplayName = String(formData.get("barDisplayName") ?? "").trim();
  const barSampleAddress = String(formData.get("barSampleAddress") ?? "").trim();

  if (!accessToken) {
    return data(
      {
        ok: false,
        message: t("pages.pubDetail.actionSignInToImport"),
      } satisfies ImportGoogleActionData,
      {
        status: 401,
      },
    );
  }

  const { data: userData, error: userErr } =
    await supabase.auth.getUser(accessToken);
  const email = userData.user?.email;
  if (userErr || !isPubDirectoryAdmin(email)) {
    return data(
      {
        ok: false,
        message: t("pages.pubDetail.actionAdminOnly"),
      } satisfies ImportGoogleActionData,
      {
        status: 403,
      },
    );
  }

  const mapsKey = resolveGoogleMapsKeyForServer();
  if (!mapsKey) {
    return data({
      ok: false,
      message: t("pages.pubDetail.actionMissingMapsKey"),
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
  const { t } = useI18n();
  const todayLabel = weekdayLabelTodayEnUs();

  if (googleOpeningHoursLines && googleOpeningHoursLines.length > 0) {
    return (
      <div className={`mt-1 border-t ${pubStroke} pt-4`}>
        <ul
          className={`list-none overflow-hidden rounded-xl border ${pubStroke} bg-guinness-black/40 shadow-[inset_0_1px_0_rgba(212,175,55,0.04)]`}
          aria-label={t("pages.pubDetail.openingHoursAria")}
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
                          {t("pages.pubDetail.hoursTodayBadge")}
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
        {t("pages.pubDetail.hoursEmptyPublic")}
      </p>
    </div>
  );
}

function PubOpeningHoursDeferred({
  googleOpeningHoursLines,
}: {
  googleOpeningHoursLines: Promise<string[] | null>;
}) {
  const { t } = useI18n();
  return (
    <Suspense
      fallback={
        <div
          className={`mt-1 rounded-xl border ${pubStroke} bg-guinness-black/25 px-3 py-4 text-center sm:px-4`}
        >
          <p className="type-meta leading-relaxed text-guinness-tan/55">
            {t("pages.pubDetail.hoursLoadingDeferred")}
          </p>
        </div>
      }
    >
      <Await
        resolve={googleOpeningHoursLines}
        errorElement={<PubOpeningHoursReadOnly googleOpeningHoursLines={null} />}
      >
        {(resolvedGoogleOpeningHoursLines: string[] | null) => (
          <PubOpeningHoursReadOnly
            googleOpeningHoursLines={resolvedGoogleOpeningHoursLines}
          />
        )}
      </Await>
    </Suspense>
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
  const { t } = useI18n();
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
    userId: loaderUserId,
    userEmail: loaderUserEmail,
    favId: initialFavId,
  } = useLoaderData<typeof pubDetailLoader>();
  const revalidator = useRevalidator();
  const navigate = useNavigate();
  const importFetcher = useFetcher<ImportGoogleActionData>();
  const lastImportHandledKey = useRef<string | null>(null);

  useEffect(() => {
    lastImportHandledKey.current = null;
  }, [barKey]);

  const [userId, setUserId] = useState<string | null>(loaderUserId);
  const [userEmail, setUserEmail] = useState<string | null>(loaderUserEmail);
  const [favId, setFavId] = useState<string | null>(initialFavId);
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
        ? t("pages.pubDetail.importHoursReview")
        : t("pages.pubDetail.importHoursMissing");
      setToast(
        bits
          ? t("pages.pubDetail.importSuccessWithBits", { bits, hint: hoursMsg })
          : t("pages.pubDetail.importSuccessNoBits", { hint: hoursMsg }),
      );
    } else {
      setToastOk(false);
      setToast(d.message ?? t("pages.pubDetail.importFailedFallback"));
    }
  }, [importFetcher.state, importFetcher.data, t]);

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


  async function toggleFavorite() {
    setToast(null);
    if (!userId) {
      setToastOk(false);
      setToast(t("pages.pubs.signInForFavorites"));
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
        setToast(t("pages.pubDetail.toastFavoriteRemoved"));
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
        setToast(t("pages.pubDetail.toastFavoriteSaved"));
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
      setToast(t("pages.pubDetail.toastSignInUpdatePub"));
      return;
    }
    if (!isPubDirectoryAdmin(auth.user.email)) {
      setToastOk(false);
      setToast(t("pages.pubDetail.toastAdminOnlyDirectory"));
      return;
    }
    setDirectoryBusy(true);
    try {
      const nameTrim = canonicalBarName.trim();
      if (!nameTrim) {
        setToastOk(false);
        setToast(t("pages.pubDetail.toastPubNameRequired"));
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
            ? t("pages.pubDetail.toastPubMigrationHint")
            : (rpcError.message ?? t("pages.pubDetail.toastCouldNotUpdatePours")),
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
      setToast(t("pages.pubDetail.toastPubSaved"));
      if (newBarKey !== barKey) {
        navigate(pubDetailPath(newBarKey), { replace: true });
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
      setToast(t("pages.pubDetail.toastSignInMerge"));
      return;
    }
    if (!isPubDirectoryAdmin(auth.user.email)) {
      setToastOk(false);
      setToast(t("pages.pubDetail.toastAdminOnlyMerge"));
      return;
    }
    const pasted = normalizeBarKeyInput(mergeTargetBarKey);
    if (!pasted) {
      setToastOk(false);
      setToast(t("pages.pubDetail.toastMergePasteTarget"));
      return;
    }
    const tgt = await resolveBarKeyFromPubPathSegment(supabase, pasted);
    if (!tgt) {
      setToastOk(false);
      setToast(t("pages.pubDetail.toastMergePubNotFound"));
      return;
    }
    if (tgt === barKey) {
      setToastOk(false);
      setToast(t("pages.pubDetail.toastMergeSamePub"));
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
            ? t("pages.pubDetail.toastMergeMigrationHint")
            : (error.message ?? t("pages.pubDetail.toastMergeFailed")),
        );
        return;
      }
      setToastOk(true);
      setToast(t("pages.pubDetail.toastMergeSuccess"));
      setMergeTargetBarKey("");
      navigate(pubDetailPath(tgt), { replace: true });
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
      setToast(t("pages.pubDetail.toastSignInImport"));
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
          description={t("pages.pubDetail.pageDescription")}
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
              <span>
                {favBusy
                  ? t("pages.pubDetail.favoriteBusy")
                  : favId
                    ? t("pages.pubDetail.saved")
                    : t("pages.pubDetail.favorite")}
              </span>
            </button>
            <AppLink
              to="/pubs"
              className={pageHeaderActionButtonClass}
            >
              {t("pages.pubDetail.allPubs")}
            </AppLink>
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
            {t("pages.pubDetail.couldNotLoadSpend", {
              error: String(extraError),
            })}{" "}
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
                {t("pages.pubDetail.locationMapTitle")}
              </h2>
              <p className="type-meta mb-3 text-guinness-tan/70">
                {t("pages.pubDetail.locationMapBlurb")}
              </p>
              {bar.sample_address ? (
                <p className="mb-3 text-sm leading-relaxed text-guinness-cream">
                  {bar.sample_address}
                </p>
              ) : (
                <p className="type-meta mb-3 text-guinness-tan/55">
                  {t("pages.pubDetail.noAddressYet")}
                </p>
              )}

              <PubGoogleMapEmbed
                searchQuery={mapSearchQuery}
                title={t("pages.pubDetail.mapEmbedTitle", {
                  name: bar.display_name,
                })}
              />

              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  href={mapsHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={pageHeaderActionButtonClass}
                >
                  {t("pages.pubDetail.openInGoogleMaps")}
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
                {t("pages.pubDetail.openingHoursTitle")}
              </h2>
              <p className="type-meta mb-3 text-guinness-tan/70">
                {t("pages.pubDetail.openingHoursBlurb")}
              </p>
              <PubOpeningHoursDeferred
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
                {t("pages.pubDetail.pourActivityTitle")}
              </h2>
              <p className="type-meta mb-4 text-guinness-tan/65">
                {t("pages.pubDetail.pourActivityBlurb")}
              </p>

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                <div className={pubPanelMuted}>
                  <p className="type-meta text-guinness-tan/65">
                    {t("pages.pubDetail.statAvgPourRating")}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-guinness-gold sm:text-xl">
                    {bar.rating_count > 0 && bar.avg_pour_rating != null
                      ? `${bar.avg_pour_rating.toFixed(1)} / 5`
                      : "—"}
                  </p>
                  {bar.rating_count > 0 ? (
                    <p className="type-meta mt-1 text-guinness-tan/50">
                      {bar.rating_count === 1
                        ? t("pages.pubDetail.statRatedPourOne", {
                            count: String(bar.rating_count),
                          })
                        : t("pages.pubDetail.statRatedPourMany", {
                            count: String(bar.rating_count),
                          })}
                    </p>
                  ) : (
                    <p className="type-meta mt-1 text-guinness-tan/50">
                      {t("pages.pubDetail.statNoRatingsYet")}
                    </p>
                  )}
                </div>
                <div className={pubPanelMuted}>
                  <p className="type-meta text-guinness-tan/65">
                    {t("pages.pubDetail.statPours")}
                  </p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-guinness-cream sm:text-xl">
                    {bar.submission_count}
                  </p>
                  <p className="type-meta mt-1 text-guinness-tan/50">
                    {t("pages.pubDetail.statRecordedHere")}
                  </p>
                </div>
                <div className={pubPanelMuted}>
                  <p className="type-meta text-guinness-tan/65">
                    {t("pages.pubDetail.statPouring")}
                  </p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-guinness-cream sm:text-xl">
                    {extra.distinct_drinkers}
                  </p>
                  <p className="type-meta mt-1 text-guinness-tan/50">
                    {t("pages.pubDetail.statDistinctPeople")}
                  </p>
                </div>
                <div className={pubPanelMuted}>
                  <p className="type-meta text-guinness-tan/65">
                    {t("pages.pubDetail.statCommunitySpend")}
                  </p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-guinness-gold sm:text-xl">
                    {formatSpend(extra.total_pint_spend)}
                  </p>
                  <p className="type-meta mt-1 text-guinness-tan/50">
                    {t("pages.pubDetail.statPricesOnPours")}
                  </p>
                </div>
                <div className="col-span-2 lg:col-span-2">
                  <div className={pubPanelMuted}>
                    <p className="type-meta text-guinness-tan/65">
                      {t("pages.pubDetail.statYourSpend")}
                    </p>
                    <p className="mt-1 text-lg font-semibold tabular-nums text-guinness-cream sm:text-xl">
                      {userId ? formatSpend(extra.my_pint_spend) : "—"}
                    </p>
                    <p className="type-meta mt-1 text-guinness-tan/50">
                      {userId
                        ? t("pages.pubDetail.spendSignedInHint")
                        : t("pages.pubDetail.spendSignInHint")}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <AdSlotBanner
              ariaLabel={t("pages.pubDetail.advertiseBannerAria")}
              slotLabel={t("pages.pubDetail.advertiseBannerSlotLabel")}
              title={t("pages.pubDetail.advertiseBannerTitle")}
              body={t("pages.pubDetail.advertiseBannerBody")}
              ctaHref="mailto:jonathan.rycx@gmail.com?subject=Split%20the%20G%20%E2%80%94%20banner%20ads"
              ctaLabel={t("pages.pubDetail.advertiseBannerCta")}
            />

            <div className={`${pubPanelShell} min-w-0`}>
              <div
                className="mb-5 w-full min-w-0 border-b border-[#322914] pb-4"
                role="tablist"
                aria-label={t("pages.pubDetail.pubSectionsAria")}
              >
                <div className="grid w-full min-w-0 grid-cols-3 gap-2 sm:gap-3">
                  {(
                    [
                      ["promos", t("pages.pubDetail.tabPromos")],
                      ["competitions", t("pages.pubDetail.tabsCompetitions")],
                      ["wall", t("pages.pubDetail.tabsWall")],
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
                    {t("pages.pubDetail.guinnessPromosTitle")}
                  </h2>
                  <p className="type-meta mb-4 text-guinness-tan/70">
                    {canEditPubDirectory
                      ? t("pages.pubDetail.directoryPublicBlurbEdit")
                      : t("pages.pubDetail.directoryPublicBlurbTeam")}
                  </p>

                  <DirectorySection title={t("pages.pubDetail.sectionGuinness")}>
                    {placeDetails?.guinness_info?.trim() ? (
                      <p className="whitespace-pre-wrap">
                        {placeDetails.guinness_info.trim()}
                      </p>
                    ) : (
                      <p className="text-guinness-tan/55">
                        {t("pages.pubDetail.guinnessEmptyHint")}
                      </p>
                    )}
                  </DirectorySection>
                  <div className={`${pubDivider} mt-5 pt-5`}>
                    <DirectorySection
                      title={t("pages.pubDetail.sectionPromotions")}
                    >
                      {placeDetails?.alcohol_promotions?.trim() ? (
                        <p className="whitespace-pre-wrap">
                          {placeDetails.alcohol_promotions.trim()}
                        </p>
                      ) : (
                        <p className="text-guinness-tan/55">
                          {t("pages.pubDetail.promotionsNothingYet")}
                        </p>
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
                      {t("pages.pubDetail.updatePubDetailsTitle")}
                    </h3>
                    <p className="type-meta mb-6 text-guinness-tan/65">
                      {t("pages.pubDetail.updatePubDetailsBlurb")}
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
                            {t("pages.pubDetail.labelPubNameOnPours")}
                          </label>
                          <p className="type-meta text-guinness-tan/45">
                            {t("pages.pubDetail.hintPubNameOnPours")}
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
                            {t("pages.pubDetail.labelAddressOnPours")}
                          </label>
                          <p className="type-meta text-guinness-tan/45">
                            {t("pages.pubDetail.hintAddressOnPours")}
                          </p>
                          <input
                            id="pub-admin-canonical-address"
                            type="text"
                            value={canonicalBarAddress}
                            onChange={(e) => setCanonicalBarAddress(e.target.value)}
                            className={fieldInputClass}
                            placeholder={t(
                              "pages.pubDetail.canonicalAddressPlaceholder",
                            )}
                            autoComplete="street-address"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label
                          htmlFor="pub-admin-opening-hours"
                          className="type-meta block text-guinness-tan/80"
                        >
                          {t("pages.pubDetail.labelOpeningHoursAdmin")}
                        </label>
                        <p className="type-meta text-guinness-tan/45">
                          {t("pages.pubDetail.hintOpeningHoursAdmin")}
                        </p>
                        <textarea
                          id="pub-admin-opening-hours"
                          value={openingHours}
                          onChange={(e) => setOpeningHours(e.target.value)}
                          rows={5}
                          className={fieldTextareaClass}
                          placeholder={t(
                            "pages.pubDetail.placeholderOpeningHoursExample",
                          )}
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
                            {t("pages.pubDetail.labelGuinnessNotes")}
                          </label>
                          <textarea
                            id="pub-admin-guinness"
                            value={guinnessInfo}
                            onChange={(e) => setGuinnessInfo(e.target.value)}
                            rows={4}
                            className={fieldTextareaClass}
                            placeholder={t("pages.pubDetail.placeholderGuinnessHow")}
                          />
                        </div>
                        <div className="space-y-2 sm:min-w-0">
                          <label
                            htmlFor="pub-admin-promos"
                            className="type-meta block text-guinness-tan/80"
                          >
                            {t("pages.pubDetail.labelPromosOther")}
                          </label>
                          <textarea
                            id="pub-admin-promos"
                            value={promotions}
                            onChange={(e) => setPromotions(e.target.value)}
                            rows={4}
                            className={fieldTextareaClass}
                            placeholder={t("pages.pubDetail.promotionsPlaceholder")}
                          />
                        </div>
                      </div>

                      <div
                        className={`space-y-4 rounded-xl border ${pubStroke} bg-guinness-black/25 p-4 sm:p-5`}
                      >
                        <div>
                          <p className="type-label text-guinness-gold">
                            {t("pages.pubDetail.googleListingTitle")}
                          </p>
                          <p className="type-meta mt-1 text-guinness-tan/50">
                            {t("pages.pubDetail.googleListingBlurb")}
                          </p>
                        </div>

                        <div className="space-y-2">
                          <label
                            htmlFor="pub-admin-place-id"
                            className="type-meta block text-guinness-tan/80"
                          >
                            {t("pages.pubDetail.labelPlaceIdOrUrl")}
                          </label>
                          <input
                            id="pub-admin-place-id"
                            type="text"
                            value={directoryGooglePlaceId}
                            onChange={(e) =>
                              setDirectoryGooglePlaceId(e.target.value)
                            }
                            className={fieldInputClass}
                            placeholder={t("pages.pubDetail.placeholderPlaceId")}
                            autoComplete="off"
                            spellCheck={false}
                          />
                        </div>

                        <div className="space-y-2">
                          <label
                            htmlFor="pub-admin-maps-url"
                            className="type-meta block text-guinness-tan/80"
                          >
                            {t("pages.pubDetail.labelCustomMapsUrl")}
                          </label>
                          <input
                            id="pub-admin-maps-url"
                            type="url"
                            value={mapsPlaceUrl}
                            onChange={(e) => setMapsPlaceUrl(e.target.value)}
                            className={fieldInputClass}
                            placeholder={t(
                              "pages.pubDetail.placeholderMapsShortUrl",
                            )}
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
                              ? t("pages.pubDetail.importingMaps")
                              : t("pages.pubDetail.importFromGoogleMaps")}
                          </button>
                          <p className="type-meta max-w-xl text-guinness-tan/50 sm:text-right">
                            {t("pages.pubDetail.importInlineBlurb")}{" "}
                            <span className="text-guinness-tan/70">
                              {t("pages.pubDetail.importInlineBlurbSave")}
                            </span>
                            {t("pages.pubDetail.importInlineBlurbSuffix")}
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
                              {t("pages.pubDetail.mergeDuplicateTitle")}
                            </span>
                            <span className="type-meta mt-0.5 block text-guinness-tan/50">
                              {t("pages.pubDetail.mergeDuplicateSubtitle")}
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
                              {t("pages.pubDetail.mergeExplainer")}
                            </p>
                            <div className="space-y-2">
                              <label
                                htmlFor="pub-admin-merge-target"
                                className="type-meta block text-guinness-tan/80"
                              >
                                {t("pages.pubDetail.labelTargetBarKey")}
                              </label>
                              <input
                                id="pub-admin-merge-target"
                                type="text"
                                value={mergeTargetBarKey}
                                onChange={(e) =>
                                  setMergeTargetBarKey(e.target.value)
                                }
                                className={fieldInputClass}
                                placeholder={t(
                                  "pages.pubDetail.placeholderTargetBarKey",
                                )}
                                autoComplete="off"
                                spellCheck={false}
                              />
                              <p className="type-meta text-guinness-tan/45">
                                {t("pages.pubDetail.mergeTargetKeyHint")}{" "}
                                <code className="rounded bg-guinness-black/50 px-1 text-guinness-gold/90">
                                  /pubs/
                                </code>{" "}
                                {t("pages.pubDetail.mergeTargetKeyHintAfter")}
                              </p>
                            </div>
                            <button
                              type="button"
                              disabled={mergeBusy || directoryBusy}
                              onClick={() => void mergeIntoTargetPub()}
                              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-amber-500/40 bg-guinness-black/40 px-4 py-2.5 text-sm font-semibold text-amber-100/95 transition-colors hover:border-amber-400/55 hover:bg-guinness-brown/40 disabled:opacity-50"
                            >
                              {mergeBusy
                                ? t("pages.pubDetail.mergeBusy")
                                : t("pages.pubDetail.mergeIntoTarget")}
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
                      {directoryBusy
                        ? t("pages.pubDetail.savingPubDetails")
                        : t("pages.pubDetail.savePubDetails")}
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
                    {t("pages.pubDetail.tabsCompetitions")}
                  </h2>
                  {linkedCompetitions.length === 0 ? (
                    <p className="type-meta text-guinness-tan/65">
                      {t("pages.pubDetail.linkedCompsEmpty")}
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {linkedCompetitions.map((c) => (
                        <li key={c.id}>
                          <AppLink
                            to={competitionDetailPath(c)}
                            viewTransition
                            className={`block rounded-xl border ${pubStroke} bg-guinness-black/25 px-3 py-2.5 transition-colors hover:border-guinness-gold/35 hover:bg-guinness-brown/40 sm:px-4 sm:py-3`}
                          >
                            <span className="font-semibold text-guinness-gold">
                              {c.title}
                            </span>
                            <span className="type-meta mt-0.5 block text-guinness-tan/65">
                              {t("pages.pubDetail.ends")}{" "}
                              {new Date(c.ends_at).toLocaleString()}
                            </span>
                          </AppLink>
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
                    {t("pages.pubDetail.tabsWall")}
                  </h2>
                  <p className="type-meta mb-4 text-guinness-tan/70">
                    {t("pages.pubDetail.wallIntro", {
                      limit: String(PUB_WALL_PAGE_LIMIT),
                    })}
                  </p>
                  {wallError ? (
                    <p className="type-meta mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-100/90">
                      {wallError}
                    </p>
                  ) : null}
                  <Suspense
                    fallback={
                      <p className="type-meta rounded-lg border border-[#322914] bg-guinness-black/20 px-3 py-2 text-guinness-tan/70">
                        {t("pages.pubDetail.loadingWall")}
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
