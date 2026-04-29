import type { User } from "@supabase/supabase-js";
import type { FormEvent } from "react";
import { PushNotificationsManager } from "~/components/PushNotificationsManager";
import { ProfileCountryPicker } from "~/components/profile/ProfileCountryPicker";
import { useI18n } from "~/i18n/context";
import type { AnalyticsConsentStatus } from "~/utils/analytics/consent";
import { setAnalyticsConsent } from "~/utils/analytics/consent";
import {
  flagEmojiFromIso2,
  type CountryOption,
} from "~/utils/countryDisplay";
import { ProfileTierAvatar } from "./profile-tier-avatar";

type AccountAchievementSummary = {
  unlockedCount: number;
  maxTierAmongUnlocked: number;
  totalCount: number;
};

type ProfileAccountSectionProps = {
  user: User;
  fullName: string;
  setFullName: (value: string) => void;
  nickname: string;
  setNickname: (value: string) => void;
  countryCode: string;
  setCountryCode: (value: string) => void;
  profileSaving: boolean;
  onSaveProfile: (event: FormEvent) => Promise<void>;
  countryOptions: CountryOption[];
  countryTriggerClass: string;
  analyticsConsentStatus: AnalyticsConsentStatus;
  setAnalyticsConsentStatus: (status: AnalyticsConsentStatus) => void;
  showToast: (message: string, title?: string) => void;
  onOpenSignOutConfirm: () => void;
  inputClass: string;
  accountAchievementSummary: AccountAchievementSummary;
};

export function ProfileAccountSection({
  user,
  fullName,
  setFullName,
  nickname,
  setNickname,
  countryCode,
  setCountryCode,
  profileSaving,
  onSaveProfile,
  countryOptions,
  countryTriggerClass,
  analyticsConsentStatus,
  setAnalyticsConsentStatus,
  showToast,
  onOpenSignOutConfirm,
  inputClass,
  accountAchievementSummary,
}: ProfileAccountSectionProps) {
  const { t } = useI18n();

  return (
    <section className="mt-6 rounded-xl border border-guinness-gold/20 bg-guinness-brown/40 p-5 sm:p-6">
      <div className="flex flex-col gap-5 border-b border-guinness-gold/10 pb-4 sm:flex-row sm:items-start sm:gap-6">
        <ProfileTierAvatar
          user={user}
          summary={accountAchievementSummary}
          variant="account"
          ariaLabel={
            accountAchievementSummary.unlockedCount > 0 &&
            accountAchievementSummary.maxTierAmongUnlocked > 0
              ? t("pages.profile.profileTierAvatarAria", {
                  tier: String(accountAchievementSummary.maxTierAmongUnlocked),
                  unlocked: String(accountAchievementSummary.unlockedCount),
                  total: String(accountAchievementSummary.totalCount),
                })
              : t("pages.profile.profileAvatarAriaSimple")
          }
          className="mx-auto sm:mx-0"
        />
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <p className="type-label text-guinness-gold">
            {t("pages.profile.signedIn")}
          </p>
          <p className="mt-1 truncate text-sm text-guinness-tan/80">
            {user.email}
          </p>
          <p className="mt-2 text-lg font-semibold text-guinness-cream">
            {countryCode ? (
              <span className="mr-2" title={countryCode} aria-hidden>
                {flagEmojiFromIso2(countryCode)}
              </span>
            ) : null}
            {fullName || t("pages.profile.namePlaceholderDash")}
          </p>
        </div>
      </div>

      <form onSubmit={(event) => void onSaveProfile(event)} className="mt-4 space-y-4">
        <div>
          <label
            htmlFor="profile-full-name"
            className="type-label mb-1.5 block text-guinness-tan/85"
          >
            {t("pages.profile.fullName")}
          </label>
          <input
            id="profile-full-name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            autoComplete="name"
            className={inputClass}
            placeholder={t("pages.profile.fullNamePlaceholder")}
          />
        </div>
        <div>
          <label
            htmlFor="profile-nickname"
            className="type-label mb-1.5 block text-guinness-tan/85"
          >
            {t("pages.profile.nickname")}
          </label>
          <input
            id="profile-nickname"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            className={inputClass}
            placeholder={t("pages.profile.nicknamePlaceholder")}
            maxLength={30}
            autoComplete="nickname"
          />
          <p className="type-meta mt-1.5 text-guinness-tan/60">
            {t("pages.profile.nicknameHint")}
          </p>
        </div>
        <div>
          <label
            htmlFor="profile-country"
            className="type-label mb-1.5 block text-guinness-tan/85"
          >
            {t("pages.profile.country")}
          </label>
          <ProfileCountryPicker
            id="profile-country"
            value={countryCode}
            onChange={setCountryCode}
            options={countryOptions}
            notSetLabel={t("pages.profile.countryNotSet")}
            fieldLabel={t("pages.profile.country")}
            searchPlaceholder={t("pages.profile.countrySearchPlaceholder")}
            noMatchesLabel={t("pages.profile.countryNoMatches")}
            triggerClassName={countryTriggerClass}
          />
          <p className="type-meta mt-1.5 text-guinness-tan/60">
            {t("pages.profile.countryHint")}{" "}
            <strong className="font-medium text-guinness-tan/75">
              {t("pages.profile.countryHintBold")}
            </strong>{" "}
            {t("pages.profile.countryHintRest")}
          </p>
        </div>
        <button
          type="submit"
          disabled={profileSaving}
          className="w-full rounded-lg bg-guinness-gold px-4 py-2.5 text-sm font-semibold text-guinness-black transition-colors hover:bg-guinness-tan disabled:opacity-50 sm:w-auto sm:px-8 md:w-full"
        >
          {profileSaving
            ? t("pages.profile.savingProfile")
            : t("pages.profile.saveProfile")}
        </button>
      </form>

      <div className="mt-5 border-t border-guinness-gold/10 pt-4">
        <div className="mb-6 rounded-lg border border-guinness-gold/20 bg-guinness-black/35 p-4">
          <p className="type-label text-guinness-gold/90">Tracking preference</p>
          <p className="type-meta mt-1 text-guinness-tan/75">
            Choose whether analytics can be used to improve app flows.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setAnalyticsConsent("accepted");
                setAnalyticsConsentStatus("accepted");
                showToast("Analytics enabled.");
              }}
              className={`rounded-md border px-3 py-2 text-xs font-semibold transition-colors ${
                analyticsConsentStatus === "accepted"
                  ? "border-guinness-gold bg-guinness-gold text-guinness-black"
                  : "border-guinness-gold/35 text-guinness-tan/90 hover:bg-guinness-gold/10"
              }`}
            >
              Allow analytics
            </button>
            <button
              type="button"
              onClick={() => {
                setAnalyticsConsent("rejected");
                setAnalyticsConsentStatus("rejected");
                showToast("Analytics disabled.");
              }}
              className={`rounded-md border px-3 py-2 text-xs font-semibold transition-colors ${
                analyticsConsentStatus === "rejected"
                  ? "border-guinness-gold bg-guinness-gold text-guinness-black"
                  : "border-guinness-gold/35 text-guinness-tan/90 hover:bg-guinness-gold/10"
              }`}
            >
              Disable analytics
            </button>
          </div>
        </div>
        <div className="mb-6 md:mb-8">
          <PushNotificationsManager />
        </div>
        <button
          type="button"
          onClick={onOpenSignOutConfirm}
          className="w-full rounded-lg border border-guinness-gold/35 bg-guinness-black/50 py-3 text-sm font-semibold text-guinness-tan transition-colors hover:border-guinness-gold/50 hover:bg-guinness-brown/55 hover:text-guinness-cream"
        >
          {t("pages.profile.signOut")}
        </button>
      </div>
    </section>
  );
}
