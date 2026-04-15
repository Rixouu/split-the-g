import { redirect, type LoaderFunctionArgs } from "react-router";
import { DEFAULT_LOCALE } from "~/i18n/config";

/** Keep `?code=` / `error=` from Supabase PKCE when Site URL is `/`. */
export function loader({ request }: LoaderFunctionArgs) {
  const search = new URL(request.url).search;
  return redirect(`/${DEFAULT_LOCALE}/${search}`);
}

export default function RootRedirect() {
  return null;
}
