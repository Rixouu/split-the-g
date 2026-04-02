import { useI18n } from "~/i18n/context";
import { seoMetaForRoute } from "~/i18n/seo-meta";
import { ProfileAchievementsPanel } from "./profile-achievements-panel";

export function meta({ params }: { params: { lang?: string } }) {
  return seoMetaForRoute(params, "/profile/achievements", "achievements");
}

export default function ProfileAchievementsPage() {
  const { t } = useI18n();
  return (
    <div className="space-y-6">
      <p className="type-meta text-guinness-tan/70 md:hidden">
        {t("pages.profile.achievementsPageBlurb")}
      </p>
      <ProfileAchievementsPanel />
    </div>
  );
}
