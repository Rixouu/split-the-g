import { seoMeta } from "~/utils/seo";
import { seoPath } from "~/utils/seo-path";

export function meta({ params }: { params: { lang?: string } }) {
  return seoMeta({
    title: "Account",
    description:
      "Update your display name, leaderboard nickname, country flag, and sign-in for Split the G.",
    path: seoPath(params, "/profile/account"),
    keywords: ["split the g account", "profile settings"],
  });
}

/** Form and sign-out live in the parent layout when this route is active. */
export default function ProfileAccountPage() {
  return null;
}
