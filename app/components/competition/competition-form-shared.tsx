import { useEffect, useMemo, useState } from "react";
import { AppLink } from "~/i18n/app-link";
import { useI18n } from "~/i18n/context";
import type { TranslateFn } from "~/i18n/translate";
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
import { getSupabaseBrowserClient } from "~/utils/supabase-browser";
import { CompetitionDateTimeRangeField } from "../competitions/CompetitionDateTimeRangeField";
import { CompetitionLocationField } from "../competitions/CompetitionLocationField";

export type CompetitionFormValues = {
  title: string;
  maxParticipants: number;
  glassesPerPerson: number;
  startsAt: string;
  endsAt: string;
  isPublic: boolean;
  winRule: WinRuleChoice;
  targetScore: string;
  locationName: string;
  locationAddress: string;
  linkedBarKey: string;
};

type CompetitionFormCopy = {
  date: {
    chooseWindow: string;
    dialogAriaLabel: string;
    timesLocal: string;
    start: string;
    end: string;
    clear: string;
    done: string;
    sectionLabel: string;
    hint: string;
  };
  location: {
    locationLabel: string;
    optionalSuffix: string;
    hint: string;
    mapPreviewTitle: string;
  };
};

type CompetitionFormFieldsProps = {
  mode: "create" | "edit";
  values: CompetitionFormValues;
  onChange: (next: CompetitionFormValues) => void;
  barLinkOptions: BarLinkOption[];
  copy: CompetitionFormCopy;
  publicLabel: string;
  linkedPubHint: string;
  submitLabel: string;
  cancelLabel: string;
  cancelTo: string;
  saving: boolean;
  formClassName?: string;
  locationFieldKey?: string;
};

export function useCompetitionFormCopy(t: TranslateFn): CompetitionFormCopy {
  return useMemo(
    () => ({
      date: {
        chooseWindow: t("pages.competitions.dateChooseWindow"),
        dialogAriaLabel: t("pages.competitions.dateDialogAria"),
        timesLocal: t("pages.competitions.dateTimesLocal"),
        start: t("pages.competitions.dateStart"),
        end: t("pages.competitions.dateEnd"),
        clear: t("pages.competitions.dateClear"),
        done: t("pages.competitions.dateDone"),
        sectionLabel: t("pages.competitions.dateSectionLabel"),
        hint: t("pages.competitions.dateHint"),
      },
      location: {
        locationLabel: t("pages.competitions.locationLabel"),
        optionalSuffix: t("pages.competitions.locationOptional"),
        hint: t("pages.competitions.locationHint"),
        mapPreviewTitle: t("pages.competitions.mapPreviewTitle"),
      },
    }),
    [t],
  );
}

export function useCompetitionBarLinkOptions() {
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

  return barLinkOptions;
}

export function updateGlassesPerPersonForWinRule(
  next: WinRuleChoice,
  previous: number,
): number {
  if (winRuleUsesUnlimitedGlasses(next)) {
    return GLASSES_PER_PERSON_UNLIMITED_SENTINEL;
  }
  if (previous >= GLASSES_PER_PERSON_UNLIMITED_SENTINEL) return 1;
  return previous;
}

export function validateCompetitionForm(
  values: CompetitionFormValues,
  t: TranslateFn,
  options?: { participantCount?: number },
): { target: number | null } | { error: string } {
  if (!values.title.trim()) {
    return { error: t("pages.competitions.errGiveName") };
  }
  if (!values.startsAt || !values.endsAt) {
    return { error: t("pages.competitions.errChooseTimes") };
  }

  const starts = new Date(values.startsAt);
  const ends = new Date(values.endsAt);
  if (ends <= starts) {
    return { error: t("pages.competitions.errEndAfterStart") };
  }

  if (
    options?.participantCount != null &&
    values.maxParticipants < options.participantCount
  ) {
    return {
      error: t("pages.competitions.errMaxBelowParticipants", {
        count: String(options.participantCount),
      }),
    };
  }

  let target: number | null = null;
  if (values.winRule === "closest_to_target") {
    const parsedTarget = parseFloat(values.targetScore);
    if (!Number.isFinite(parsedTarget) || parsedTarget < 0 || parsedTarget > 5) {
      return { error: t("pages.competitions.errTargetScoreRange") };
    }
    target = parsedTarget;
  }

  return { target };
}

export function CompetitionFormFields({
  mode,
  values,
  onChange,
  barLinkOptions,
  copy,
  publicLabel,
  linkedPubHint,
  submitLabel,
  cancelLabel,
  cancelTo,
  saving,
  formClassName,
  locationFieldKey,
}: CompetitionFormFieldsProps) {
  const { t } = useI18n();
  const fieldClass = competitionFieldClass;
  const nativeSelectClass = competitionSelectFieldClass;
  const outlineBtn = competitionOutlineButtonClass;

  const idPrefix = mode === "create" ? "create" : "edit";
  const submitButtonClass =
    "min-w-0 rounded-lg bg-guinness-gold px-3 py-2.5 text-center text-sm font-semibold text-guinness-black transition-colors hover:bg-guinness-tan disabled:opacity-50 sm:text-base";
  const actionsClass =
    mode === "create" ? "grid grid-cols-2 gap-2 pt-1" : "grid grid-cols-2 gap-2 pt-2";

  const setValue = <K extends keyof CompetitionFormValues>(
    key: K,
    next: CompetitionFormValues[K],
  ) => {
    onChange({ ...values, [key]: next });
  };

  return (
    <div
      className={
        formClassName ??
        "space-y-6 rounded-2xl border border-guinness-gold/35 bg-guinness-brown/50 p-5 sm:p-6 lg:p-8"
      }
    >
      <div className={mode === "edit" ? "grid gap-8 lg:grid-cols-2 lg:gap-10" : "space-y-4"}>
        <div className="space-y-4">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={values.isPublic}
              onChange={(event) => setValue("isPublic", event.target.checked)}
              className="rounded border-guinness-gold/40"
            />
            <span className="text-sm text-guinness-tan/85">{publicLabel}</span>
          </label>
          <div>
            <label htmlFor={`${idPrefix}-win-rule`} className="type-label mb-1 block">
              {t("pages.competitions.winRuleField")}
            </label>
            <select
              id={`${idPrefix}-win-rule`}
              value={values.winRule}
              onChange={(event) => {
                const next = normalizeWinRuleChoice(event.target.value);
                onChange({
                  ...values,
                  winRule: next,
                  glassesPerPerson: updateGlassesPerPersonForWinRule(
                    next,
                    values.glassesPerPerson,
                  ),
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
          {values.winRule === "closest_to_target" ? (
            <div>
              <label htmlFor={`${idPrefix}-target`} className="type-label mb-1 block">
                {t("pages.competitions.targetScoreLabel")}
              </label>
              <input
                id={`${idPrefix}-target`}
                type="number"
                step="0.01"
                min={0}
                max={5}
                value={values.targetScore}
                onChange={(event) => setValue("targetScore", event.target.value)}
                className={fieldClass}
              />
            </div>
          ) : null}
          <div>
            <label htmlFor={`${idPrefix}-title`} className="type-label mb-1 block">
              {t("pages.competitions.formName")}
            </label>
            <input
              id={`${idPrefix}-title`}
              value={values.title}
              onChange={(event) => setValue("title", event.target.value)}
              className={fieldClass}
              placeholder={
                mode === "create" ? t("pages.competitions.namePlaceholder") : undefined
              }
              autoComplete="off"
            />
          </div>
          <CompetitionLocationField
            key={locationFieldKey}
            fieldClass={fieldClass}
            copy={copy.location}
            locationName={values.locationName}
            locationAddress={values.locationAddress}
            onLocationNameChange={(next) => setValue("locationName", next)}
            onLocationAddressChange={(next) => setValue("locationAddress", next)}
          />
          <div>
            <label htmlFor={`${idPrefix}-linked-pub`} className="type-label mb-1 block">
              {t("pages.competitions.pubListingsOptional")}
            </label>
            <select
              id={`${idPrefix}-linked-pub`}
              value={values.linkedBarKey}
              onChange={(event) => setValue("linkedBarKey", event.target.value)}
              className={nativeSelectClass}
            >
              <option value="">{t("pages.competitions.pubNotLinked")}</option>
              {barLinkOptions.map((option) => (
                <option key={option.bar_key} value={option.bar_key}>
                  {option.display_name}
                </option>
              ))}
            </select>
            <p className="type-meta mt-1 text-guinness-tan/60">{linkedPubHint}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor={`${idPrefix}-max`} className="type-label mb-1 block">
                {t("pages.competitions.maxPeople")}
              </label>
              <input
                id={`${idPrefix}-max`}
                type="number"
                min={2}
                max={500}
                value={values.maxParticipants}
                onChange={(event) =>
                  setValue(
                    "maxParticipants",
                    Number.parseInt(event.target.value, 10) || 2,
                  )
                }
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor={`${idPrefix}-glasses`} className="type-label mb-1 block">
                {t("pages.competitions.glassesPerPerson")}
              </label>
              {winRuleUsesUnlimitedGlasses(values.winRule) ? (
                <div
                  id={`${idPrefix}-glasses`}
                  className={`${fieldClass} text-guinness-tan/90`}
                >
                  {t("pages.competitions.glassesPerPersonUnlimited")}
                </div>
              ) : (
                <input
                  id={`${idPrefix}-glasses`}
                  type="number"
                  min={1}
                  max={20}
                  value={values.glassesPerPerson}
                  onChange={(event) =>
                    setValue(
                      "glassesPerPerson",
                      Number.parseInt(event.target.value, 10) || 1,
                    )
                  }
                  className={fieldClass}
                />
              )}
              {winRuleUsesUnlimitedGlasses(values.winRule) ? (
                <p className="type-meta mt-1 text-guinness-tan/55">
                  {t("pages.competitions.glassesUnlimitedHint")}
                </p>
              ) : null}
            </div>
          </div>
          <CompetitionDateTimeRangeField
            startLocal={values.startsAt}
            endLocal={values.endsAt}
            onChange={(start, end) => {
              onChange({ ...values, startsAt: start, endsAt: end });
            }}
            inputClass={fieldClass}
            copy={copy.date}
          />
          {mode === "create" ? (
            <p className="type-meta text-guinness-tan/65">
              {t("pages.competitions.privateExplainer")}
            </p>
          ) : null}
          <div className={actionsClass}>
            <button type="submit" disabled={saving} className={submitButtonClass}>
              {submitLabel}
            </button>
            <AppLink
              to={cancelTo}
              viewTransition
              className={`${outlineBtn} flex min-w-0 items-center justify-center px-3 py-2.5 text-center text-sm sm:text-base`}
            >
              {cancelLabel}
            </AppLink>
          </div>
        </div>
      </div>
    </div>
  );
}
