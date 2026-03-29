import { seoMetaForRoute } from "~/i18n/seo-meta";

export function meta({ params }: { params: { lang?: string } }) {
  return seoMetaForRoute(params, "/profile/account", "account");
}

/** Form and sign-out live in the parent layout when this route is active. */
export default function ProfileAccountPage() {
  return null;
}
