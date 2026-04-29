import { useLoaderData, useRevalidator } from "react-router";
import { AppLink } from "~/i18n/app-link";
import { AdSlotBanner } from "~/components/ad-slot-banner";
import {
  PageHeader,
  pageHeaderActionButtonClass,
  pageShellClass,
} from "~/components/PageHeader";
import { BrandedNotice } from "~/components/branded/BrandedNotice";
import { BrandedToast } from "~/components/branded/BrandedToast";
import { toastAutoCloseForVariant } from "~/components/branded/feedback-variant";
import { SegmentedTabs } from "~/components/ui/segmented-tabs";
import { ChevronDown, Pencil, Trash2 } from "lucide-react";
import {
  competitionDetailPath,
  competitionEditPath,
  competitionNewPath,
} from "~/utils/competitionPath";
import { useI18n } from "~/i18n/context";
import { seoMetaForRoute } from "~/i18n/seo-meta";
import type { loader as competitionsLoader } from "./competitions.loader";
import {
  competitionCardDividerClass,
  competitionCardFrameClass,
  competitionCardTopLightClass,
  competitionFieldClass,
  competitionOutlineButtonClass,
  competitionStatCellClass,
  isPrivateCompetition,
  isStoredGlassesUnlimited,
  winRuleLabelI18n,
  winRuleUsesUnlimitedGlasses,
} from "./competitions.shared";
import { useCompetitionsListState } from "./useCompetitionsListState";

export { loader } from "./competitions.loader";

export function meta({ params }: { params: { lang?: string } }) {
  return seoMetaForRoute(params, "/competitions", "competitions");
}

export default function Competitions() {
  const { t } = useI18n();
  const { competitions, listError, participantCounts: loaderCounts } =
    useLoaderData<typeof competitionsLoader>();
  const revalidator = useRevalidator();
  const {
    formError,
    uiToast,
    deleteTarget,
    counts,
    myFriends,
    invitesByComp,
    inviteInputs,
    inviteBusy,
    invitedTitles,
    listingsTab,
    userId,
    joinedIds,
    pastWinnerByCompId,
    openCompetitions,
    pastCompetitions,
    mergedCompetitions,
    visibleCompetitions,
    setInviteInputs,
    setListingsTab,
    requestDeleteCompetition,
    confirmDeleteCompetition,
    handleJoin,
    handleLeave,
    addEmailInvite,
    removeInvite,
    addFriendParticipant,
    dismissToast,
    closeDeleteNotice,
  } = useCompetitionsListState({
    competitions,
    loaderCounts,
    revalidatorState: revalidator.state,
    revalidate: () => revalidator.revalidate(),
    t,
  });

  const fieldClass = competitionFieldClass;
  const outlineBtn = competitionOutlineButtonClass;
  const isPrivate = isPrivateCompetition;
  const compCardTopLight = competitionCardTopLightClass;
  const compCardFrame = competitionCardFrameClass;
  const compCardDivider = competitionCardDividerClass;
  const compStatCell = competitionStatCellClass;

  const toastOpen = Boolean(formError || uiToast);
  const toastMessage = uiToast?.text ?? formError ?? "";
  const toastVariant = uiToast?.variant ?? "danger";
  const toastAuto =
    uiToast != null
      ? toastAutoCloseForVariant(uiToast.variant)
      : formError
        ? 9000
        : undefined;

  return (
    <main className="min-h-screen bg-guinness-black text-guinness-cream">
      <div className={pageShellClass}>
        <PageHeader
          title={t("pages.competitions.title")}
          description={t("pages.descriptions.competitions")}
        >
          <AppLink
            to={competitionNewPath()}
            viewTransition
            className={pageHeaderActionButtonClass}
          >
            {t("pages.competitions.newCompetition")}
          </AppLink>
        </PageHeader>

        {invitedTitles.length > 0 ? (
          <div className="mb-6 rounded-lg border border-guinness-gold/30 bg-guinness-gold/10 px-4 py-3 text-sm text-guinness-cream">
            <p className="font-semibold text-guinness-gold">
              {t("pages.competitions.youreInvited")}
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-guinness-tan/90">
              {invitedTitles.map((row) => (
                <li key={row.competition_id}>{row.title}</li>
              ))}
            </ul>
            <p className="type-meta mt-2 text-guinness-tan/70">
              {t("pages.competitions.invitedHint")}
            </p>
          </div>
        ) : null}

        <AdSlotBanner
          className="mb-6"
          ariaLabel={t("pages.competitions.advertiseBannerAria")}
          slotLabel={t("pages.competitions.advertiseBannerSlotLabel")}
          title={t("pages.competitions.advertiseBannerTitle")}
          body={t("pages.competitions.advertiseBannerBody")}
          ctaHref="mailto:jonathan.rycx@gmail.com?subject=Split%20the%20G%20%E2%80%94%20competitions%20advertising"
          ctaLabel={t("pages.competitions.advertiseBannerCta")}
        />

        <section className="rounded-2xl border border-solid border-guinness-frame bg-gradient-to-b from-guinness-brown/25 to-guinness-black/30 p-4 shadow-inner shadow-black/20 sm:p-6">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <h2 className="type-card-title">
                  {t("pages.competitions.mineHeading")}
                </h2>
                <p className="type-meta mt-1 max-w-2xl text-guinness-tan/75">
                  {t("pages.descriptions.competitionsOpenListings")}
                </p>
              </div>
              <p className="type-meta shrink-0 text-guinness-tan/60">
                {t("pages.competitions.openPastCounts", {
                  open: String(openCompetitions.length),
                  past: String(pastCompetitions.length),
                })}
              </p>
            </div>

            <SegmentedTabs
              className="mb-5 w-full"
              layoutClassName="flex w-full"
              variant="rowEqual"
              aria-label={t("pages.competitions.ariaListScope")}
              value={listingsTab}
              onValueChange={(v) => setListingsTab(v === "past" ? "past" : "open")}
              items={[
                { value: "open", label: t("pages.competitions.tabOpen") },
                { value: "past", label: t("pages.competitions.tabPast") },
              ]}
            />

            {listError ? (
              <p className="type-meta rounded-lg border border-guinness-gold/20 bg-guinness-brown/30 p-4 text-guinness-tan/80">
                {t("pages.competitions.listError", { detail: listError })}
              </p>
            ) : mergedCompetitions.length === 0 ? (
              <p className="type-meta text-guinness-tan/70">
                {t("pages.competitions.noCompsYet")}
              </p>
            ) : visibleCompetitions.length === 0 ? (
              <p className="type-meta text-guinness-tan/70">
                {listingsTab === "open"
                  ? t("pages.competitions.noOpenComps")
                  : t("pages.competitions.noPastComps")}
              </p>
            ) : (
              <ul className="space-y-3">
                {visibleCompetitions.map((c) => {
                  const count = counts[c.id] ?? 0;
                  const isOwner = userId === c.created_by;
                  const isJoined = joinedIds.has(c.id);
                  const isPastTab = listingsTab === "past";
                  const full = count >= c.max_participants;
                  const priv = isPrivate(c);
                  const invites = invitesByComp[c.id] ?? [];
                  const rawWinner = pastWinnerByCompId[c.id];
                  const winnerLine =
                    rawWinner === undefined
                      ? t("pages.competitions.winnerDash")
                      : rawWinner === null
                        ? t("pages.competitions.noPoursLogged")
                        : rawWinner;

                  return (
                    <li
                      key={c.id}
                      className={`group/card relative overflow-hidden ${compCardFrame}`}
                    >
                      <div className={compCardTopLight} aria-hidden />
                      <div className="relative z-0 flex flex-col gap-4 px-3.5 pb-4 pt-6 sm:gap-4 sm:p-5">
                        <div className="flex flex-col gap-4 min-[520px]:flex-row min-[520px]:items-start min-[520px]:justify-between min-[520px]:gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                              <h3 className="text-base font-semibold leading-snug text-guinness-cream sm:text-lg">
                                {c.title}
                              </h3>
                              {isPastTab ? (
                                <span className="rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-200/95">
                                  {t("pages.competitions.badgeEnded")}
                                </span>
                              ) : null}
                              {isJoined ? (
                                <span
                                  className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                                    isPastTab
                                      ? "border-guinness-tan/35 bg-guinness-black/45 text-guinness-tan/85"
                                      : "border-emerald-500/45 bg-emerald-500/12 text-emerald-200/95"
                                  }`}
                                >
                                  {isPastTab
                                    ? t("pages.competitions.badgeYouParticipated")
                                    : t("pages.competitions.badgeYoureIn")}
                                </span>
                              ) : null}
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                                  priv
                                    ? "border border-solid border-guinness-frame bg-guinness-black/55 text-guinness-tan/90"
                                    : "bg-guinness-gold text-guinness-black shadow-sm shadow-black/20"
                                }`}
                              >
                                {priv
                                  ? t("pages.competitions.badgePrivate")
                                  : t("pages.competitions.badgePublic")}
                              </span>
                            </div>
                            <p className="mt-1.5 text-[11px] leading-relaxed text-guinness-tan/50 sm:text-xs sm:text-guinness-tan/55">
                              {new Date(c.starts_at).toLocaleString()} →{" "}
                              {new Date(c.ends_at).toLocaleString()}
                            </p>
                            {isPastTab ? (
                              <p className="mt-2 flex flex-wrap items-center gap-2 text-sm font-semibold text-guinness-gold">
                                <span className="type-meta font-bold uppercase tracking-wide text-amber-200/90">
                                  {t("pages.competitions.winner")}
                                </span>
                                <span className="text-guinness-cream">{winnerLine}</span>
                              </p>
                            ) : null}
                          </div>

                          <div
                            className={`grid w-full gap-3 min-[520px]:w-auto min-[520px]:max-w-none min-[520px]:shrink-0 min-[520px]:justify-end min-[520px]:gap-2 ${
                              isOwner
                                ? "grid-cols-3 min-[520px]:flex min-[520px]:flex-wrap"
                                : "grid-cols-1"
                            }`}
                          >
                            <AppLink
                              to={competitionDetailPath(c)}
                              viewTransition
                              className={`${pageHeaderActionButtonClass} inline-flex min-h-10 w-full items-center justify-center px-3 text-xs min-[520px]:min-w-[6.25rem] min-[520px]:w-auto sm:px-4 sm:text-sm`}
                            >
                              {t("pages.competitions.view")}
                            </AppLink>
                            {isOwner ? (
                              <>
                                <AppLink
                                  to={competitionEditPath(c)}
                                  viewTransition
                                  className={`${outlineBtn} inline-flex min-h-10 w-full items-center justify-center gap-1.5 px-2.5 text-xs min-[520px]:w-auto sm:px-3 sm:text-sm`}
                                >
                                  <Pencil
                                    className="h-3.5 w-3.5 shrink-0 opacity-90"
                                    aria-hidden
                                  />
                                  <span className="truncate">
                                    {t("pages.competitions.edit")}
                                  </span>
                                </AppLink>
                                <button
                                  type="button"
                                  onClick={() => void requestDeleteCompetition(c)}
                                  className="inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-red-400/40 bg-red-950/20 text-red-400/95 transition-colors hover:border-red-400/55 hover:bg-red-950/40 min-[520px]:w-11 min-[520px]:px-0"
                                  aria-label={t("pages.competitions.delete")}
                                >
                                  <Trash2 className="h-4 w-4" aria-hidden />
                                </button>
                              </>
                            ) : userId ? (
                              isJoined ? (
                                <button
                                  type="button"
                                  onClick={() => void handleLeave(c.id)}
                                  className="w-full rounded-lg border border-guinness-gold/30 px-3 py-2 text-xs font-semibold text-guinness-tan hover:bg-guinness-brown/50 sm:w-auto sm:py-1.5"
                                >
                                  {t("pages.competitions.leave")}
                                </button>
                              ) : isPastTab ? (
                                <span className="type-meta w-full py-2 text-center text-guinness-tan/50 sm:text-right">
                                  {t("pages.competitions.closed")}
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={full}
                                  onClick={() => void handleJoin(c.id)}
                                  className="w-full rounded-lg bg-guinness-gold/15 px-3 py-2 text-xs font-semibold text-guinness-gold hover:bg-guinness-gold/25 disabled:opacity-40 sm:w-auto sm:py-1.5"
                                >
                                  {full
                                    ? t("pages.competitions.full")
                                    : t("pages.competitions.join")}
                                </button>
                              )
                            ) : isPastTab ? null : (
                              <p className="type-meta w-full text-center text-guinness-tan/55 sm:text-left">
                                {t("pages.competitions.signInToJoinShort")}
                              </p>
                            )}
                          </div>
                        </div>

                        <div
                          className={`grid grid-cols-2 gap-x-3 gap-y-3 border-t pt-5 sm:grid-cols-3 sm:gap-x-4 sm:gap-y-3 sm:pt-4 ${compCardDivider}`}
                        >
                          <div className={`${compStatCell} col-span-1`}>
                            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-guinness-gold/65">
                              {t("pages.competitions.statJoined")}
                            </span>
                            <span className="mt-0.5 text-sm font-semibold tabular-nums text-guinness-gold sm:text-base">
                              {count}
                              <span className="text-guinness-tan/45"> / </span>
                              {c.max_participants}
                            </span>
                          </div>
                          <div className={`${compStatCell} col-span-1`}>
                            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-guinness-gold/65">
                              {t("pages.competitions.statGlassesEach")}
                            </span>
                            <span className="mt-0.5 text-sm font-semibold text-guinness-cream sm:text-base">
                              {winRuleUsesUnlimitedGlasses(c.win_rule) ||
                              isStoredGlassesUnlimited(c.glasses_per_person)
                                ? t("pages.competitions.glassesPerPersonUnlimited")
                                : c.glasses_per_person}
                            </span>
                          </div>
                          <div
                            className={`${compStatCell} col-span-2 sm:col-span-1`}
                          >
                            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-guinness-gold/65">
                              {t("pages.competitions.statRule")}
                            </span>
                            <span className="mt-0.5 block text-sm font-semibold leading-snug text-guinness-cream">
                              {winRuleLabelI18n(t, c.win_rule)}
                              {c.win_rule === "closest_to_target" &&
                              c.target_score != null
                                ? ` · ${Number(c.target_score).toFixed(2)}`
                                : ""}
                            </span>
                          </div>
                        </div>
                      </div>

                      {isOwner && !isPastTab ? (
                        <details
                          className={`group relative border-t bg-guinness-black/25 ${compCardDivider}`}
                        >
                          <summary className="cursor-pointer list-none px-3.5 py-2.5 text-sm font-semibold text-guinness-gold transition-colors hover:bg-guinness-brown/35 sm:px-5 sm:py-3 [&::-webkit-details-marker]:hidden">
                            <span className="flex items-center justify-between gap-2">
                              <span>
                                {t("pages.competitions.invitesFriendsSection")}
                              </span>
                              <ChevronDown
                                className="h-4 w-4 shrink-0 text-guinness-gold/60 transition-transform duration-200 group-open:rotate-180"
                                aria-hidden
                                strokeWidth={2.25}
                              />
                            </span>
                          </summary>
                          <div
                            className={`space-y-4 border-t px-3.5 pb-3.5 pt-3.5 sm:px-5 sm:pb-5 sm:pt-4 ${compCardDivider}`}
                          >
                            <div>
                              <p className="type-label text-guinness-tan/85">
                                {t("pages.competitions.inviteByEmail")}
                              </p>
                              <p className="type-meta mt-1 text-guinness-tan/60">
                                {t("pages.competitions.inviteByEmailHint")}
                              </p>
                              <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-stretch">
                                <input
                                  type="email"
                                  value={inviteInputs[c.id] ?? ""}
                                  onChange={(e) =>
                                    setInviteInputs((prev) => ({
                                      ...prev,
                                      [c.id]: e.target.value,
                                    }))
                                  }
                                  placeholder={t(
                                    "pages.competitions.invitePlaceholder",
                                  )}
                                  className={fieldClass}
                                />
                                <button
                                  type="button"
                                  disabled={inviteBusy === c.id}
                                  onClick={() => void addEmailInvite(c.id)}
                                  className="min-h-11 rounded-lg bg-guinness-gold/20 px-4 py-2 text-xs font-semibold text-guinness-gold hover:bg-guinness-gold/30 disabled:opacity-50 sm:min-w-[8.5rem]"
                                >
                                  {t("pages.competitions.sendInvite")}
                                </button>
                              </div>
                              {invites.length > 0 ? (
                                <ul
                                  className={`mt-3 space-y-2 rounded-lg border bg-guinness-black/30 px-3 py-2 text-xs text-guinness-tan/80 ${compCardDivider}`}
                                >
                                  {invites.map((inv) => (
                                    <li
                                      key={inv.id}
                                      className="flex items-center justify-between gap-2 py-0.5"
                                    >
                                      <span className="min-w-0 truncate">
                                        {inv.invited_email}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          void removeInvite(c.id, inv.id)
                                        }
                                        className="shrink-0 text-red-400/90 hover:underline"
                                      >
                                        {t("pages.competitions.remove")}
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                            </div>

                            {myFriends.length > 0 ? (
                              <div className={`border-t pt-4 ${compCardDivider}`}>
                                <p className="type-label text-guinness-tan/85">
                                  {t("pages.competitions.addFriendsTitle")}
                                </p>
                                <p className="type-meta mt-1 text-guinness-tan/60">
                                  {t("pages.competitions.addFriendsHint")}
                                </p>
                                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                                  {myFriends.map((f) => (
                                    <li
                                      key={f.friend_user_id}
                                      className={`flex flex-col gap-2 rounded-lg border bg-guinness-black/30 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between ${compCardDivider}`}
                                    >
                                      <span className="min-w-0 truncate text-sm text-guinness-cream">
                                        {f.peer_email ||
                                          f.friend_user_id.slice(0, 8) + "…"}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          void addFriendParticipant(
                                            c.id,
                                            f.friend_user_id,
                                          )
                                        }
                                        className={`${outlineBtn} shrink-0 self-start sm:self-auto`}
                                      >
                                        {t("pages.competitions.addToComp")}
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}
                          </div>
                        </details>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
      </div>

      <BrandedToast
        open={toastOpen}
        message={toastMessage}
        variant={toastVariant}
        title={
          formError && !uiToast ? t("toasts.toastDangerTitle") : undefined
        }
        onClose={dismissToast}
        autoCloseMs={toastAuto}
      />

      <BrandedNotice
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) closeDeleteNotice();
        }}
        title={
          deleteTarget
            ? t("pages.competitions.deleteConfirmNamed", {
                title: deleteTarget.title,
              })
            : t("pages.competitions.deleteConfirmGeneric")
        }
        description={t("pages.competitions.deleteDescription")}
        variant="danger"
        secondaryLabel={t("pages.competitions.keepCompetition")}
        primaryLabel={t("pages.competitions.deleteCompetition")}
        onPrimary={() => void confirmDeleteCompetition()}
      />
    </main>
  );
}
