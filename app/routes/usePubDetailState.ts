import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { NavigateFunction } from "react-router";
import type { BarStat } from "~/routes/pubs";
import type { TranslateFn } from "~/i18n/translate";
import { pubDetailPath, resolveBarKeyFromPubPathSegment } from "~/utils/pubPath";
import { supabase } from "~/utils/supabase";
import {
  isPubDirectoryAdmin,
  normalizeBarKeyInput,
  type ImportGoogleActionData,
  type PubPlaceRow,
} from "./pubs.$barKey.shared";

type ImportFetcherLike = {
  state: string;
  data?: ImportGoogleActionData;
  submit: (formData: FormData, options: { method: "post" }) => void;
};

type UsePubDetailStateArgs = {
  barKey: string;
  bar: BarStat;
  placeDetails: PubPlaceRow | null;
  loaderUserId: string | null;
  loaderUserEmail: string | null;
  initialFavId: string | null;
  importFetcher: ImportFetcherLike;
  revalidator: { revalidate: () => void };
  navigate: NavigateFunction;
  t: TranslateFn;
};

export function usePubDetailState({
  barKey,
  bar,
  placeDetails,
  loaderUserId,
  loaderUserEmail,
  initialFavId,
  importFetcher,
  revalidator,
  navigate,
  t,
}: UsePubDetailStateArgs) {
  const lastImportHandledKey = useRef<string | null>(null);
  const [userId] = useState<string | null>(loaderUserId);
  const [userEmail] = useState<string | null>(loaderUserEmail);
  const [favId, setFavId] = useState<string | null>(initialFavId);
  const [favBusy, setFavBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [toastOk, setToastOk] = useState(true);
  const [openingHours, setOpeningHours] = useState(placeDetails?.opening_hours ?? "");
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
  const [canonicalBarName, setCanonicalBarName] = useState(bar.display_name);
  const [canonicalBarAddress, setCanonicalBarAddress] = useState(
    bar.sample_address ?? "",
  );
  const [mergeTargetBarKey, setMergeTargetBarKey] = useState("");
  const [mergeBusy, setMergeBusy] = useState(false);
  const [mergeSectionOpen, setMergeSectionOpen] = useState(false);
  const [directoryBusy, setDirectoryBusy] = useState(false);
  const [pubTab, setPubTab] = useState<"promos" | "competitions" | "wall">(
    "promos",
  );

  useEffect(() => {
    lastImportHandledKey.current = null;
  }, [barKey]);

  useEffect(() => {
    if (importFetcher.state !== "idle" || importFetcher.data == null) return;
    const key = JSON.stringify(importFetcher.data);
    if (lastImportHandledKey.current === key) return;
    lastImportHandledKey.current = key;

    const payload = importFetcher.data;
    if (payload.ok) {
      if (payload.weekdayLines?.length) setOpeningHours(payload.weekdayLines.join("\n"));
      if (payload.mapsUrl) setMapsPlaceUrl(payload.mapsUrl);
      if (payload.placeId) setDirectoryGooglePlaceId(payload.placeId);
      if (payload.name?.trim()) setCanonicalBarName(payload.name.trim());
      if (payload.formattedAddress?.trim()) {
        setCanonicalBarAddress(payload.formattedAddress.trim());
      }
      setToastOk(true);
      const bits = [payload.name, payload.formattedAddress].filter(Boolean).join(" — ");
      const hoursMsg = payload.weekdayLines?.length
        ? t("pages.pubDetail.importHoursReview")
        : t("pages.pubDetail.importHoursMissing");
      setToast(
        bits
          ? t("pages.pubDetail.importSuccessWithBits", { bits, hint: hoursMsg })
          : t("pages.pubDetail.importSuccessNoBits", { hint: hoursMsg }),
      );
      return;
    }

    setToastOk(false);
    setToast(payload.message ?? t("pages.pubDetail.importFailedFallback"));
  }, [importFetcher.data, importFetcher.state, t]);

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

  useEffect(() => {
    setFavId(initialFavId);
  }, [initialFavId]);

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
        return;
      }

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
    } finally {
      setFavBusy(false);
    }
  }

  async function saveDirectory(event: FormEvent) {
    event.preventDefault();
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
      const addressTrim = canonicalBarAddress.trim();
      const placeTrim = directoryGooglePlaceId.trim();

      const { data: rpcData, error: rpcError } = await supabase.rpc(
        "admin_apply_pub_canonical_on_scores",
        {
          p_current_bar_key: barKey,
          p_bar_name: nameTrim,
          p_bar_address: addressTrim || null,
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
      const { error } = await supabase.from("pub_place_details").upsert(payload, {
        onConflict: "bar_key",
      });
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
    const target = await resolveBarKeyFromPubPathSegment(supabase, pasted);
    if (!target) {
      setToastOk(false);
      setToast(t("pages.pubDetail.toastMergePubNotFound"));
      return;
    }
    if (target === barKey) {
      setToastOk(false);
      setToast(t("pages.pubDetail.toastMergeSamePub"));
      return;
    }

    setMergeBusy(true);
    try {
      const { error } = await supabase.rpc("admin_merge_pub_into_target", {
        p_source_bar_key: barKey,
        p_target_bar_key: target,
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
      navigate(pubDetailPath(target), { replace: true });
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
      .map((value) => value.trim())
      .filter(Boolean)
      .join("\n");
    const formData = new FormData();
    formData.set("intent", "importGooglePlace");
    formData.set("accessToken", token);
    formData.set("placeInput", placeInput);
    formData.set("barGooglePlaceId", bar.google_place_id ?? "");
    formData.set("barDisplayName", bar.display_name);
    formData.set("barSampleAddress", bar.sample_address ?? "");
    importFetcher.submit(formData, { method: "post" });
  }

  return {
    userId,
    userEmail,
    favId,
    favBusy,
    toast,
    toastOk,
    openingHours,
    setOpeningHours,
    guinnessInfo,
    setGuinnessInfo,
    promotions,
    setPromotions,
    mapsPlaceUrl,
    setMapsPlaceUrl,
    directoryGooglePlaceId,
    setDirectoryGooglePlaceId,
    canonicalBarName,
    setCanonicalBarName,
    canonicalBarAddress,
    setCanonicalBarAddress,
    mergeTargetBarKey,
    setMergeTargetBarKey,
    mergeBusy,
    mergeSectionOpen,
    setMergeSectionOpen,
    directoryBusy,
    pubTab,
    setPubTab,
    canEditPubDirectory,
    toggleFavorite,
    saveDirectory,
    mergeIntoTargetPub,
    submitImportFromGoogle,
  };
}
