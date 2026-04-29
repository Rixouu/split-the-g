import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { BrandedToast } from "~/components/branded/BrandedToast";
import { toastAutoCloseForVariant } from "~/components/branded/feedback-variant";
import { useI18n } from "~/i18n/context";
import { localizePath } from "~/i18n/paths";
import {
  COMPETITION_ROW_SELECT,
  GLASSES_PER_PERSON_UNLIMITED_SENTINEL,
  isPrivateCompetition,
  toDatetimeLocalValue,
  type CompetitionRow,
} from "~/routes/competitions.shared";
import { competitionDetailPath } from "~/utils/competitionPath";
import { getSupabaseBrowserClient } from "~/utils/supabase-browser";
import {
  CompetitionFormFields,
  type CompetitionFormValues,
  useCompetitionBarLinkOptions,
  useCompetitionFormCopy,
  validateCompetitionForm,
} from "./competition-form-shared";

interface CompetitionEditFormProps {
  competition: CompetitionRow;
}

export function CompetitionEditForm({ competition }: CompetitionEditFormProps) {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [participantCount, setParticipantCount] = useState(0);
  const barLinkOptions = useCompetitionBarLinkOptions();
  const copy = useCompetitionFormCopy(t);
  const [values, setValues] = useState<CompetitionFormValues>({
    title: competition.title,
    maxParticipants: competition.max_participants,
    glassesPerPerson:
      competition.win_rule === "most_submissions"
        ? GLASSES_PER_PERSON_UNLIMITED_SENTINEL
        : competition.glasses_per_person,
    startsAt: toDatetimeLocalValue(competition.starts_at),
    endsAt: toDatetimeLocalValue(competition.ends_at),
    isPublic: !isPrivateCompetition(competition),
    winRule: competition.win_rule === "highest_score" ||
      competition.win_rule === "lowest_score" ||
      competition.win_rule === "best_average" ||
      competition.win_rule === "closest_to_target" ||
      competition.win_rule === "most_submissions"
      ? competition.win_rule
      : "highest_score",
    targetScore:
      competition.target_score != null ? String(competition.target_score) : "2.50",
    locationName: competition.location_name?.trim() ?? "",
    locationAddress: competition.location_address?.trim() ?? "",
    linkedBarKey: competition.linked_bar_key?.trim() ?? "",
  });
  const [editBusy, setEditBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [uiToast, setUiToast] = useState<{ text: string; variant: "success" } | null>(
    null,
  );

  useEffect(() => {
    void (async () => {
      const supabase = await getSupabaseBrowserClient();
      const [{ count }] = await Promise.all([
        supabase
          .from("competition_participants")
          .select("*", { count: "exact", head: true })
          .eq("competition_id", competition.id),
      ]);
      setParticipantCount(count ?? 0);
    })();
  }, [competition.id]);

  useEffect(() => {
    setValues({
      title: competition.title,
      maxParticipants: competition.max_participants,
      glassesPerPerson:
        competition.win_rule === "most_submissions"
          ? GLASSES_PER_PERSON_UNLIMITED_SENTINEL
          : competition.glasses_per_person,
      startsAt: toDatetimeLocalValue(competition.starts_at),
      endsAt: toDatetimeLocalValue(competition.ends_at),
      isPublic: !isPrivateCompetition(competition),
      winRule: competition.win_rule === "highest_score" ||
        competition.win_rule === "lowest_score" ||
        competition.win_rule === "best_average" ||
        competition.win_rule === "closest_to_target" ||
        competition.win_rule === "most_submissions"
        ? competition.win_rule
        : "highest_score",
      targetScore:
        competition.target_score != null ? String(competition.target_score) : "2.50",
      locationName: competition.location_name?.trim() ?? "",
      locationAddress: competition.location_address?.trim() ?? "",
      linkedBarKey: competition.linked_bar_key?.trim() ?? "",
    });
  }, [competition]);

  async function handleUpdate() {
    setFormError(null);
    setEditBusy(true);
    try {
      const supabase = await getSupabaseBrowserClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user || userData.user.id !== competition.created_by) {
        setFormError(t("pages.competitions.errEditOwnOnly"));
        return;
      }

      const validated = validateCompetitionForm(values, t, { participantCount });
      if ("error" in validated) {
        setFormError(validated.error);
        return;
      }
      const starts = new Date(values.startsAt);
      const ends = new Date(values.endsAt);

      const { error } = await supabase
        .from("competitions")
        .update({
          title: values.title.trim(),
          max_participants: values.maxParticipants,
          glasses_per_person: values.winRule === "most_submissions"
            ? GLASSES_PER_PERSON_UNLIMITED_SENTINEL
            : values.glassesPerPerson,
          starts_at: starts.toISOString(),
          ends_at: ends.toISOString(),
          win_rule: values.winRule,
          target_score: values.winRule === "closest_to_target" ? validated.target : null,
          visibility: values.isPublic ? "public" : "private",
          location_name: values.locationName.trim() || null,
          location_address: values.locationAddress.trim() || null,
          linked_bar_key: values.linkedBarKey.trim() || null,
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

  return (
    <>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void handleUpdate();
        }}
      >
        <CompetitionFormFields
          mode="edit"
          values={values}
          onChange={setValues}
          barLinkOptions={barLinkOptions}
          copy={copy}
          publicLabel={t("pages.competitions.publicAnyoneJoin")}
          linkedPubHint={t("pages.competitions.pubListingsHintEdit")}
          submitLabel={
            editBusy
              ? t("pages.competitions.saving")
              : t("pages.competitions.saveChanges")
          }
          cancelLabel={t("pages.competitions.formCancel")}
          cancelTo={competitionDetailPath(competition)}
          saving={editBusy}
          locationFieldKey={competition.id}
        />
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
