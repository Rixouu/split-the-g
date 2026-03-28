import { redirect } from "react-router";

export function loader() {
  return redirect("/profile/progress");
}

/** Index URL `/profile` redirects in the loader; this is only a fallback. */
export default function ProfileIndexFallback() {
  return null;
}
