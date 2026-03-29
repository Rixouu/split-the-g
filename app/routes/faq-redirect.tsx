import { redirect, type LoaderFunctionArgs } from "react-router";
import { DEFAULT_LOCALE } from "~/i18n/config";

/** Legacy /faq → localized profile FAQ */
export async function loader(_args: LoaderFunctionArgs) {
  return redirect(`/${DEFAULT_LOCALE}/profile/faq`);
}

export default function FaqRedirect() {
  return null;
}
