import { seoMetaForRoute } from "~/i18n/seo-meta";
import { ProfileAchievementsPanel } from "./profile-achievements-panel";

export function meta({ params }: { params: { lang?: string } }) {
  return seoMetaForRoute(params, "/profile/achievements", "achievements");
}

export default function ProfileAchievementsPage() {
  return (
    <div className="pb-2 md:pb-0">
      <ProfileAchievementsPanel />
    </div>
  );
}
