import { redirect, type LoaderFunctionArgs } from "react-router";
import { DEFAULT_LOCALE } from "~/i18n/config";

/** Legacy /collage → localized wall */
export async function loader(_args: LoaderFunctionArgs) {
  return redirect(`/${DEFAULT_LOCALE}/wall`);
}

export default function CollageRedirect() {
  return null;
}
