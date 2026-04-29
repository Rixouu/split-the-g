import { useState } from "react";
import { useNavigate } from "react-router";
import { BrandedToast } from "~/components/branded/BrandedToast";
import { useI18n } from "~/i18n/context";
import { localizePath } from "~/i18n/paths";
import {
  GLASSES_PER_PERSON_UNLIMITED_SENTINEL,
} from "~/routes/competitions.shared";
import { competitionDetailPath } from "~/utils/competitionPath";
import { getSupabaseBrowserClient } from "~/utils/supabase-browser";
import { analyticsEventNames } from "~/utils/analytics/events";
import { trackEvent } from "~/utils/analytics/client";
import {
  CompetitionFormFields,
  type CompetitionFormValues,
  useCompetitionBarLinkOptions,
  useCompetitionFormCopy,
  validateCompetitionForm,
} from "./competition-form-shared";

export function CompetitionCreateForm() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const copy = useCompetitionFormCopy(t);
  const barLinkOptions = useCompetitionBarLinkOptions();
  const [values, setValues] = useState<CompetitionFormValues>({
    title: "",
    maxParticipants: 8,
    glassesPerPerson: 1,
    startsAt: "",
    endsAt: "",
    isPublic: true,
    winRule: "highest_score",
    targetScore: "2.50",
    locationName: "",
    locationAddress: "",
    linkedBarKey: "",
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    setFormError(null);
    setSaving(true);

    try {
      const supabase = await getSupabaseBrowserClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        setFormError(t("pages.competitions.errSignInGoogleFirst"));
        return;
      }

      const validated = validateCompetitionForm(values, t);
      if ("error" in validated) {
        setFormError(validated.error);
        return;
      }
      const starts = new Date(values.startsAt);
      const ends = new Date(values.endsAt);

      const { data: inserted, error } = await supabase
        .from("competitions")
        .insert({
          title: values.title.trim(),
          created_by: userData.user.id,
          max_participants: values.maxParticipants,
          glasses_per_person: values.winRule === "most_submissions"
            ? GLASSES_PER_PERSON_UNLIMITED_SENTINEL
            : values.glassesPerPerson,
          starts_at: starts.toISOString(),
          ends_at: ends.toISOString(),
          win_rule: values.winRule,
          target_score: validated.target,
          visibility: values.isPublic ? "public" : "private",
          location_name: values.locationName.trim() || null,
          location_address: values.locationAddress.trim() || null,
          linked_bar_key: values.linkedBarKey.trim() || null,
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
        visibility: values.isPublic ? "public" : "private",
        winRule: values.winRule,
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
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void handleCreate();
          }}
        >
          <CompetitionFormFields
            mode="create"
            values={values}
            onChange={setValues}
            barLinkOptions={barLinkOptions}
            copy={copy}
            publicLabel={t("pages.competitions.publicListing")}
            linkedPubHint={t("pages.competitions.pubListingsHintCreate")}
            submitLabel={
              saving
                ? t("pages.competitions.creating")
                : t("pages.competitions.createCompetition")
            }
            cancelLabel={t("pages.competitions.formCancel")}
            cancelTo="/competitions"
            saving={saving}
            formClassName="space-y-4"
          />
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
