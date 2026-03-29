import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { AppLink } from "~/i18n/app-link";
import { BrandedToast } from "~/components/branded/BrandedToast";
import { toastAutoCloseForVariant } from "~/components/branded/feedback-variant";
import { CompetitionDateTimeRangeField } from "~/components/competitions/CompetitionDateTimeRangeField";
import { CompetitionLocationField } from "~/components/competitions/CompetitionLocationField";
import { useI18n } from "~/i18n/context";
import { localizePath } from "~/i18n/paths";
import {
  COMPETITION_ROW_SELECT,
  competitionFieldClass,
  competitionOutlineButtonClass,
  competitionSelectFieldClass,
  GLASSES_PER_PERSON_UNLIMITED_SENTINEL,
  isPrivateCompetition,
  normalizeWinRuleChoice,
  toDatetimeLocalValue,
  winRuleUsesUnlimitedGlasses,
  type BarLinkOption,
  type CompetitionRow,
  type WinRuleChoice,
} from "~/routes/competitions.shared";
import { competitionDetailPath } from "~/utils/competitionPath";
import { getSupabaseBrowserClient } from "~/utils/supabase-browser";

interface CompetitionEditFormProps {
  competition: CompetitionRow;
}

export function CompetitionEditForm({ competition }: CompetitionEditFormProps) {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [participantCount, setParticipantCount] = useState(0);
  const [barLinkOptions, setBarLinkOptions] = useState<BarLinkOption[]>([]);
  const [editTitle, setEditTitle] = useState(competition.title);
  const [editMax, setEditMax] = useState(competition.max_participants);
  const [editGlasses, setEditGlasses] = useState(() =>
    winRuleUsesUnlimitedGlasses(competition.win_rule)
      ? GLASSES_PER_PERSON_UNLIMITED_SENTINEL
      : competition.glasses_per_person,
  );
  const [editStart, setEditStart] = useState(
    toDatetimeLocalValue(competition.starts_at),
  );
  const [editEnd, setEditEnd] = useState(toDatetimeLocalValue(competition.ends_at));
  const [editPublic, setEditPublic] = useState(!isPrivateCompetition(competition));
  const [editWinRule, setEditWinRule] = useState<WinRuleChoice>(() =>
    normalizeWinRuleChoice(competition.win_rule),
  );
  const [editTargetScore, setEditTargetScore] = useState(
    competition.target_score != null ? String(competition.target_score) : "2.50",
  );
  const [editLocationName, setEditLocationName] = useState(
    competition.location_name?.trim() ?? "",
  );
  const [editLocationAddress, setEditLocationAddress] = useState(
    competition.location_address?.trim() ?? "",
  );
  const [editLinkedBarKey, setEditLinkedBarKey] = useState(
    competition.linked_bar_key?.trim() ?? "",
  );
  const [editBusy, setEditBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [uiToast, setUiToast] = useState<{ text: string; variant: "success" } | null>(
    null,
  );

  const competitionDateCopy = useMemo(
    () => ({
      chooseWindow: t("pages.competitions.dateChooseWindow"),
      dialogAriaLabel: t("pages.competitions.dateDialogAria"),
      timesLocal: t("pages.competitions.dateTimesLocal"),
      start: t("pages.competitions.dateStart"),
      end: t("pages.competitions.dateEnd"),
      clear: t("pages.competitions.dateClear"),
      done: t("pages.competitions.dateDone"),
      sectionLabel: t("pages.competitions.dateSectionLabel"),
      hint: t("pages.competitions.dateHint"),
    }),
    [t],
  );

  const competitionLocationCopy = useMemo(
    () => ({
      locationLabel: t("pages.competitions.locationLabel"),
      optionalSuffix: t("pages.competitions.locationOptional"),
      hint: t("pages.competitions.locationHint"),
      mapPreviewTitle: t("pages.competitions.mapPreviewTitle"),
    }),
    [t],
  );

  useEffect(() => {
    void (async () => {
      const supabase = await getSupabaseBrowserClient();
      const [{ count }, { data: bars }] = await Promise.all([
        supabase
          .from("competition_participants")
          .select("*", { count: "exact", head: true })
          .eq("competition_id", competition.id),
        supabase
          .from("bar_pub_stats")
          .select("bar_key, display_name")
          .order("submission_count", { ascending: false })
          .limit(200),
      ]);
      setParticipantCount(count ?? 0);
      setBarLinkOptions((bars ?? []) as BarLinkOption[]);
    })();
  }, [competition.id]);

  async function handleUpdate(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setEditBusy(true);
    try {
      const supabase = await getSupabaseBrowserClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user || userData.user.id !== competition.created_by) {
        setFormError(t("pages.competitions.errEditOwnOnly"));
        return;
      }

      if (!editTitle.trim()) {
        setFormError(t("pages.competitions.errGiveName"));
        return;
      }
      if (!editStart || !editEnd) {
        setFormError(t("pages.competitions.errChooseTimes"));
        return;
      }

      const starts = new Date(editStart);
      const ends = new Date(editEnd);
      if (ends <= starts) {
        setFormError(t("pages.competitions.errEndAfterStart"));
        return;
      }

      if (editMax < participantCount) {
        setFormError(
          t("pages.competitions.errMaxBelowParticipants", {
            count: String(participantCount),
          }),
        );
        return;
      }

      let target: number | null = null;
      if (editWinRule === "closest_to_target") {
        const parsedTarget = parseFloat(editTargetScore);
        if (!Number.isFinite(parsedTarget) || parsedTarget < 0 || parsedTarget > 5) {
          setFormError(t("pages.competitions.errTargetScoreRange"));
          return;
        }
        target = parsedTarget;
      }

      const { error } = await supabase
        .from("competitions")
        .update({
          title: editTitle.trim(),
          max_participants: editMax,
          glasses_per_person: winRuleUsesUnlimitedGlasses(editWinRule)
            ? GLASSES_PER_PERSON_UNLIMITED_SENTINEL
            : editGlasses,
          starts_at: starts.toISOString(),
          ends_at: ends.toISOString(),
          win_rule: editWinRule,
          target_score: editWinRule === "closest_to_target" ? target : null,
          visibility: editPublic ? "public" : "private",
          location_name: editLocationName.trim() || null,
          location_address: editLocationAddress.trim() || null,
          linked_bar_key: editLinkedBarKey.trim() || null,
        })
        .eq("id", competition.id);

      if (error) {
        setFormError(error.message);
        return;
      }

      const { data: updated } = await supabase
        .from("competitions")
        .select(COMPETITION_ROW_SELECT)
        .eq("id", competition.id)
        .maybeSingle();

      setUiToast({
        text: t("pages.competitions.msgUpdated"),
        variant: "success",
      });

      const row = (updated ?? null) as CompetitionRow | null;
      if (row) {
        navigate(localizePath(competitionDetailPath(row), lang), { replace: true });
      } else {
        navigate(localizePath(competitionDetailPath(competition), lang), {
          replace: true,
        });
      }
    } finally {
      setEditBusy(false);
    }
  }

  const fieldClass = competitionFieldClass;
  const nativeSelectClass = competitionSelectFieldClass;
  const outlineBtn = competitionOutlineButtonClass;

  return (
    <>
      <form
        onSubmit={(ev) => void handleUpdate(ev)}
        className="space-y-6 rounded-2xl border border-guinness-gold/35 bg-guinness-brown/50 p-5 sm:p-6 lg:p-8"
      >
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
          <div className="space-y-4">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={editPublic}
                onChange={(e) => setEditPublic(e.target.checked)}
                className="rounded border-guinness-gold/40"
              />
              <span className="text-sm text-guinness-tan/85">
                {t("pages.competitions.publicAnyoneJoin")}
              </span>
            </label>
            <div>
              <label htmlFor="edit-win-rule" className="type-label mb-1 block">
                {t("pages.competitions.winRuleField")}
              </label>
              <select
                id="edit-win-rule"
                value={editWinRule}
                onChange={(e) => {
                  const next = normalizeWinRuleChoice(e.target.value);
                  setEditWinRule(next);
                  setEditGlasses((prev) => {
                    if (winRuleUsesUnlimitedGlasses(next)) {
                      return GLASSES_PER_PERSON_UNLIMITED_SENTINEL;
                    }
                    if (prev >= GLASSES_PER_PERSON_UNLIMITED_SENTINEL) return 1;
                    return prev;
                  });
                }}
                className={nativeSelectClass}
              >
                <option value="highest_score">
                  {t("pages.competitions.winRuleOptionHighest")}
                </option>
                <option value="lowest_score">
                  {t("pages.competitions.winRuleOptionLowest")}
                </option>
                <option value="best_average">
                  {t("pages.competitions.winRuleOptionBestAverage")}
                </option>
                <option value="closest_to_target">
                  {t("pages.competitions.winRuleOptionClosest")}
                </option>
                <option value="most_submissions">
                  {t("pages.competitions.winRuleOptionMost")}
                </option>
              </select>
            </div>
            {editWinRule === "closest_to_target" ? (
              <div>
                <label htmlFor="edit-target" className="type-label mb-1 block">
                  {t("pages.competitions.targetScoreLabel")}
                </label>
                <input
                  id="edit-target"
                  type="number"
                  step="0.01"
                  min={0}
                  max={5}
                  value={editTargetScore}
                  onChange={(e) => setEditTargetScore(e.target.value)}
                  className={fieldClass}
                />
              </div>
            ) : null}
            <div>
              <label htmlFor="edit-title" className="type-label mb-1 block">
                {t("pages.competitions.formName")}
              </label>
              <input
                id="edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className={fieldClass}
                autoComplete="off"
              />
            </div>
            <CompetitionLocationField
              key={competition.id}
              fieldClass={fieldClass}
              copy={competitionLocationCopy}
              locationName={editLocationName}
              locationAddress={editLocationAddress}
              onLocationNameChange={setEditLocationName}
              onLocationAddressChange={setEditLocationAddress}
            />
            <div>
              <label htmlFor="edit-linked-pub" className="type-label mb-1 block">
                {t("pages.competitions.pubListingsOptional")}
              </label>
              <select
                id="edit-linked-pub"
                value={editLinkedBarKey}
                onChange={(e) => setEditLinkedBarKey(e.target.value)}
                className={nativeSelectClass}
              >
                <option value="">{t("pages.competitions.pubNotLinked")}</option>
                {barLinkOptions.map((o) => (
                  <option key={o.bar_key} value={o.bar_key}>
                    {o.display_name}
                  </option>
                ))}
              </select>
              <p className="type-meta mt-1 text-guinness-tan/60">
                {t("pages.competitions.pubListingsHintEdit")}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="edit-max" className="type-label mb-1 block">
                  {t("pages.competitions.maxPeople")}
                </label>
                <input
                  id="edit-max"
                  type="number"
                  min={2}
                  max={500}
                  value={editMax}
                  onChange={(e) =>
                    setEditMax(Number.parseInt(e.target.value, 10) || 2)
                  }
                  className={fieldClass}
                />
              </div>
              <div>
                <label htmlFor="edit-glasses" className="type-label mb-1 block">
                  {t("pages.competitions.glassesPerPerson")}
                </label>
                {winRuleUsesUnlimitedGlasses(editWinRule) ? (
                  <div
                    id="edit-glasses"
                    className={`${fieldClass} text-guinness-tan/90`}
                  >
                    {t("pages.competitions.glassesPerPersonUnlimited")}
                  </div>
                ) : (
                  <input
                    id="edit-glasses"
                    type="number"
                    min={1}
                    max={20}
                    value={editGlasses}
                    onChange={(e) =>
                      setEditGlasses(Number.parseInt(e.target.value, 10) || 1)
                    }
                    className={fieldClass}
                  />
                )}
                {winRuleUsesUnlimitedGlasses(editWinRule) ? (
                  <p className="type-meta mt-1 text-guinness-tan/55">
                    {t("pages.competitions.glassesUnlimitedHint")}
                  </p>
                ) : null}
              </div>
            </div>
            <CompetitionDateTimeRangeField
              startLocal={editStart}
              endLocal={editEnd}
              onChange={(s, e) => {
                setEditStart(s);
                setEditEnd(e);
              }}
              inputClass={fieldClass}
              copy={competitionDateCopy}
            />
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="submit"
                disabled={editBusy}
                className="min-w-0 rounded-lg bg-guinness-gold px-3 py-2.5 text-center text-sm font-semibold text-guinness-black transition-colors hover:bg-guinness-tan disabled:opacity-50 sm:text-base"
              >
                {editBusy
                  ? t("pages.competitions.saving")
                  : t("pages.competitions.saveChanges")}
              </button>
              <AppLink
                to={competitionDetailPath(competition)}
                viewTransition
                className={`${outlineBtn} flex min-w-0 items-center justify-center px-3 py-2.5 text-center text-sm sm:text-base`}
              >
                {t("pages.competitions.formCancel")}
              </AppLink>
            </div>
          </div>
        </div>
      </form>

      <BrandedToast
        open={Boolean(formError || uiToast)}
        onClose={() => {
          setFormError(null);
          setUiToast(null);
        }}
        message={uiToast?.text ?? formError ?? ""}
        variant={uiToast?.variant ?? "danger"}
        autoCloseMs={
          uiToast != null
            ? toastAutoCloseForVariant(uiToast.variant)
            : formError
              ? 9000
              : undefined
        }
      />
    </>
  );
}
