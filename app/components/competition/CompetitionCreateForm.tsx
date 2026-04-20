import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { AppLink } from "~/i18n/app-link";
import { BrandedToast } from "~/components/branded/BrandedToast";
import { CompetitionDateTimeRangeField } from "~/components/competitions/CompetitionDateTimeRangeField";
import { CompetitionLocationField } from "~/components/competitions/CompetitionLocationField";
import { useI18n } from "~/i18n/context";
import { localizePath } from "~/i18n/paths";
import {
  competitionFieldClass,
  competitionOutlineButtonClass,
  competitionSelectFieldClass,
  GLASSES_PER_PERSON_UNLIMITED_SENTINEL,
  normalizeWinRuleChoice,
  winRuleUsesUnlimitedGlasses,
  type BarLinkOption,
  type WinRuleChoice,
} from "~/routes/competitions.shared";
import { competitionDetailPath } from "~/utils/competitionPath";
import { getSupabaseBrowserClient } from "~/utils/supabase-browser";
import { analyticsEventNames } from "~/utils/analytics/events";
import { trackEvent } from "~/utils/analytics/client";

export function CompetitionCreateForm() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();

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

  const [title, setTitle] = useState("");
  const [maxParticipants, setMaxParticipants] = useState(8);
  const [glassesPerPerson, setGlassesPerPerson] = useState(1);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [createPublic, setCreatePublic] = useState(true);
  const [createWinRule, setCreateWinRule] = useState<WinRuleChoice>("highest_score");
  const [createTargetScore, setCreateTargetScore] = useState("2.50");
  const [createLocationName, setCreateLocationName] = useState("");
  const [createLocationAddress, setCreateLocationAddress] = useState("");
  const [createLinkedBarKey, setCreateLinkedBarKey] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [barLinkOptions, setBarLinkOptions] = useState<BarLinkOption[]>([]);

  useEffect(() => {
    void (async () => {
      const supabase = await getSupabaseBrowserClient();
      const { data } = await supabase
        .from("bar_pub_stats")
        .select("bar_key, display_name")
        .order("submission_count", { ascending: false })
        .limit(200);
      setBarLinkOptions((data ?? []) as BarLinkOption[]);
    })();
  }, []);

  const fieldClass = competitionFieldClass;
  const nativeSelectClass = competitionSelectFieldClass;
  const outlineBtn = competitionOutlineButtonClass;

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSaving(true);

    try {
      const supabase = await getSupabaseBrowserClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        setFormError(t("pages.competitions.errSignInGoogleFirst"));
        return;
      }

      if (!title.trim()) {
        setFormError(t("pages.competitions.errGiveName"));
        return;
      }
      if (!startsAt || !endsAt) {
        setFormError(t("pages.competitions.errChooseTimes"));
        return;
      }

      const starts = new Date(startsAt);
      const ends = new Date(endsAt);
      if (ends <= starts) {
        setFormError(t("pages.competitions.errEndAfterStart"));
        return;
      }

      let target: number | null = null;
      if (createWinRule === "closest_to_target") {
        const parsedTarget = parseFloat(createTargetScore);
        if (!Number.isFinite(parsedTarget) || parsedTarget < 0 || parsedTarget > 5) {
          setFormError(t("pages.competitions.errTargetScoreRange"));
          return;
        }
        target = parsedTarget;
      }

      const { data: inserted, error } = await supabase
        .from("competitions")
        .insert({
          title: title.trim(),
          created_by: userData.user.id,
          max_participants: maxParticipants,
          glasses_per_person: winRuleUsesUnlimitedGlasses(createWinRule)
            ? GLASSES_PER_PERSON_UNLIMITED_SENTINEL
            : glassesPerPerson,
          starts_at: starts.toISOString(),
          ends_at: ends.toISOString(),
          win_rule: createWinRule,
          target_score: target,
          visibility: createPublic ? "public" : "private",
          location_name: createLocationName.trim() || null,
          location_address: createLocationAddress.trim() || null,
          linked_bar_key: createLinkedBarKey.trim() || null,
        })
        .select("id, path_segment")
        .single();

      if (error) {
        setFormError(error.message);
        return;
      }

      if (!inserted?.id) {
        setFormError(t("pages.competitions.errCreateNoRow"));
        return;
      }
      trackEvent(analyticsEventNames.competitionCreated, {
        competitionId: inserted.id as string,
        visibility: createPublic ? "public" : "private",
        winRule: createWinRule,
      });

      navigate(
        localizePath(
          competitionDetailPath({
            id: inserted.id as string,
            path_segment: (inserted.path_segment as string | null) ?? null,
          }),
          lang,
        ),
        { replace: true },
      );
    } finally {
      setSaving(false);
    }
  }

  const toastOpen = Boolean(formError);
  const toastMessage = formError ?? "";
  const toastVariant = "danger" as const;
  const toastAuto = formError ? 9000 : undefined;

  return (
    <>
      <section className="rounded-2xl border border-guinness-gold/20 bg-guinness-brown/40 p-5 shadow-[0_18px_40px_rgba(0,0,0,0.18)] sm:p-6">
        <form onSubmit={(ev) => void handleCreate(ev)} className="space-y-4">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={createPublic}
              onChange={(e) => setCreatePublic(e.target.checked)}
              className="rounded border-guinness-gold/40"
            />
            <span className="text-sm text-guinness-tan/85">
              {t("pages.competitions.publicListing")}
            </span>
          </label>
          <div>
            <label htmlFor="create-win-rule" className="type-label mb-1 block">
              {t("pages.competitions.winRuleField")}
            </label>
            <select
              id="create-win-rule"
              value={createWinRule}
              onChange={(e) => {
                const next = normalizeWinRuleChoice(e.target.value);
                setCreateWinRule(next);
                setGlassesPerPerson((prev) => {
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
          {createWinRule === "closest_to_target" ? (
            <div>
              <label htmlFor="create-target" className="type-label mb-1 block">
                {t("pages.competitions.targetScoreLabel")}
              </label>
              <input
                id="create-target"
                type="number"
                step="0.01"
                min={0}
                max={5}
                value={createTargetScore}
                onChange={(e) => setCreateTargetScore(e.target.value)}
                className={fieldClass}
              />
            </div>
          ) : null}
          <div>
            <label htmlFor="comp-title" className="type-label mb-1 block">
              {t("pages.competitions.formName")}
            </label>
            <input
              id="comp-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={fieldClass}
              placeholder={t("pages.competitions.namePlaceholder")}
              autoComplete="off"
            />
          </div>
          <CompetitionLocationField
            fieldClass={fieldClass}
            copy={competitionLocationCopy}
            locationName={createLocationName}
            locationAddress={createLocationAddress}
            onLocationNameChange={setCreateLocationName}
            onLocationAddressChange={setCreateLocationAddress}
          />
          <div>
            <label htmlFor="comp-linked-pub" className="type-label mb-1 block">
              {t("pages.competitions.pubListingsOptional")}
            </label>
            <select
              id="comp-linked-pub"
              value={createLinkedBarKey}
              onChange={(e) => setCreateLinkedBarKey(e.target.value)}
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
              {t("pages.competitions.pubListingsHintCreate")}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="comp-max" className="type-label mb-1 block">
                {t("pages.competitions.maxPeople")}
              </label>
              <input
                id="comp-max"
                type="number"
                min={2}
                max={500}
                value={maxParticipants}
                onChange={(e) =>
                  setMaxParticipants(Number.parseInt(e.target.value, 10) || 2)
                }
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor="comp-glasses" className="type-label mb-1 block">
                {t("pages.competitions.glassesPerPerson")}
              </label>
              {winRuleUsesUnlimitedGlasses(createWinRule) ? (
                <div
                  id="comp-glasses"
                  className={`${fieldClass} text-guinness-tan/90`}
                >
                  {t("pages.competitions.glassesPerPersonUnlimited")}
                </div>
              ) : (
                <input
                  id="comp-glasses"
                  type="number"
                  min={1}
                  max={20}
                  value={glassesPerPerson}
                  onChange={(e) =>
                    setGlassesPerPerson(Number.parseInt(e.target.value, 10) || 1)
                  }
                  className={fieldClass}
                />
              )}
              {winRuleUsesUnlimitedGlasses(createWinRule) ? (
                <p className="type-meta mt-1 text-guinness-tan/55">
                  {t("pages.competitions.glassesUnlimitedHint")}
                </p>
              ) : null}
            </div>
          </div>
          <CompetitionDateTimeRangeField
            startLocal={startsAt}
            endLocal={endsAt}
            onChange={(s, e) => {
              setStartsAt(s);
              setEndsAt(e);
            }}
            inputClass={fieldClass}
            copy={competitionDateCopy}
          />
          <p className="type-meta text-guinness-tan/65">
            {t("pages.competitions.privateExplainer")}
          </p>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="min-w-0 rounded-lg bg-guinness-gold px-3 py-2.5 text-center text-sm font-semibold text-guinness-black transition-colors hover:bg-guinness-tan disabled:opacity-50 sm:text-base"
            >
              {saving
                ? t("pages.competitions.creating")
                : t("pages.competitions.createCompetition")}
            </button>
            <AppLink
              to="/competitions"
              viewTransition
              className={`${outlineBtn} flex min-w-0 items-center justify-center px-3 py-2.5 text-center text-sm sm:text-base`}
            >
              {t("pages.competitions.formCancel")}
            </AppLink>
          </div>
        </form>
      </section>

      <BrandedToast
        open={toastOpen}
        message={toastMessage}
        variant={toastVariant}
        title={formError ? t("toasts.toastDangerTitle") : undefined}
        onClose={() => {
          setFormError(null);
        }}
        autoCloseMs={toastAuto}
      />
    </>
  );
}
